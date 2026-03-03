// routes/admin.js -- Gestion de usuarios y estadisticas (solo admins)

const express = require("express");
const { getDb } = require("../db");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

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
  if (!["admin", "user"].includes(role))
    return res.status(400).json({ error: "Rol no valido. Usa admin o user" });
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

module.exports = router;