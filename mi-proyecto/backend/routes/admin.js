// routes/admin.js -- Gestion de usuarios y estadisticas (solo admins)

const express = require("express");
const { getDb } = require("../db");
const { authMiddleware, adminMiddleware, gestorMiddleware } = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");

function parseTags(raw) { try { return JSON.parse(raw); } catch { return []; } }

function formatNote(note) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    color: note.color,
    tags: parseTags(note.tags),
    is_public: !!note.is_public,
    share_token: note.is_public ? note.share_token : null,
    created_at: note.created_at,
    updated_at: note.updated_at,
    deleted_at: note.deleted_at || null
  };
}

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/users -- lista todos los usuarios (sin password)
router.get("/users", (req, res) => {
  const db = getDb();
  const users = db
    .prepare("SELECT id, email, username, role, created_at FROM users ORDER BY created_at DESC")
    .all();
  return res.json({ users });
});

// PUT /api/admin/users/:id/role -- cambia el rol de un usuario
// Un admin no puede cambiar su propio rol para evitar quedarse sin acceso.
router.put("/users/:id/role", (req, res) => {
  const { role } = req.body;
  if (role === "admin" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo un admin puede asignar rol admin" });
  }
  if (!["admin", "gestor", "user"].includes(role))
      return res.status(400).json({ error: "Rol no valido. Usa admin, gestor o user" });
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: "No puedes cambiar tu propio rol" });

  const db = getDb();
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
  return res.json({ message: `Rol actualizado a '${role}'` });
});

// DELETE /api/admin/users/:id -- elimina un usuario y todas sus notas (CASCADE)
router.delete("/users/:id", (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });

  const db = getDb();
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  return res.json({ message: "Usuario eliminado correctamente" });
});

// GET /api/admin/stats -- estadisticas para el panel de administracion
router.get("/stats", (req, res) => {
  const db = getDb();
  const { total_users }   = db.prepare("SELECT COUNT(*) as total_users FROM users").get();
  const { active_users }  = db.prepare("SELECT COUNT(*) as active_users FROM users WHERE role='user'").get();
  const { total_notes }   = db.prepare("SELECT COUNT(*) as total_notes FROM notes WHERE deleted_at IS NULL").get();
  const { public_notes }  = db.prepare("SELECT COUNT(*) as public_notes FROM notes WHERE is_public=1 AND deleted_at IS NULL").get();
  const { trashed_notes } = db.prepare("SELECT COUNT(*) as trashed_notes FROM notes WHERE deleted_at IS NOT NULL").get();
  return res.json({ stats: { total_users, active_users, total_notes, public_notes, trashed_notes } });
});

// GET /api/admin/users-with-notes
// Lista todos los usuarios con el número de notas que tiene cada uno
router.get("/users-with-notes", (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.role,
           COUNT(n.id) as note_count
    FROM users u
    LEFT JOIN notes n ON n.user_id = u.id AND n.deleted_at IS NULL
    GROUP BY u.id
    ORDER BY u.username ASC
  `).all();
  return res.json({ users });
});

// GET /api/admin/users/:id/notes
// Notas de un usuario concreto
// Admin ve todas; gestor solo ve las públicas
router.get("/users/:id/notes", (req, res) => {
  const db = getDb();
  const sql = req.user.role === "admin"
    ? "SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC"
    : "SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL AND is_public = 1 ORDER BY updated_at DESC";
  const notes = db.prepare(sql).all(req.params.id);
  return res.json({ notes: notes.map(formatNote) });
});

// POST /api/admin/notes/:id/assign
// Asigna una nota a otro usuario (admin y gestor)
// El gestor NO puede borrar notas, pero sí reasignarlas
router.post("/notes/:id/assign", gestorMiddleware, (req, res) => {
  const { target_user_id } = req.body;
  if (!target_user_id)
    return res.status(400).json({ error: "target_user_id es obligatorio" });

  const db = getDb();
  const note = db
    .prepare("SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL")
    .get(req.params.id);
  if (!note) return res.status(404).json({ error: "Nota no encontrada" });

  const targetUser = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(target_user_id);
  if (!targetUser) return res.status(404).json({ error: "Usuario destino no encontrado" });

  db.prepare(
    "UPDATE notes SET user_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(target_user_id, req.params.id);

  // Registrar en el log quién asignó qué nota a quién
  db.prepare(
    "INSERT INTO activity_log (id, user_id, note_id, action, target_user_id) VALUES (?, ?, ?, 'assigned', ?)"
  ).run(uuidv4(), req.user.id, req.params.id, target_user_id);

  return res.json({ message: "Nota asignada correctamente" });
});

module.exports = router;