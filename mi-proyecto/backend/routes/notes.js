// CRUD de notas con busqueda, papelera y notas publicas

const validator = require("validator");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

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

// GET /api/notes  -- busqueda por ?q= y filtro por ?tag=
router.get("/", (req, res) => {
  const { q, tag } = req.query;
  const db = getDb();
  let sql = "SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL";
  const params = [req.user.id];
  if (q) { sql += " AND (title LIKE ? OR content LIKE ?)"; params.push(`%${q}%`, `%${q}%`); }
  if (tag) { sql += ` AND tags LIKE ?`; params.push(`%"${tag}"%`); }
  sql += " ORDER BY updated_at DESC";
  return res.json({ notes: db.prepare(sql).all(...params).map(formatNote) });
});

// GET /api/notes/trash -- papelera del usuario
router.get("/trash", (req, res) => {
  const db = getDb();
  const notes = db
    .prepare("SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC")
    .all(req.user.id);
  return res.json({ notes: notes.map(formatNote) });
});

// GET /api/notes/:id
router.get("/:id", (req, res) => {
  const db = getDb();
  const note = db.prepare("SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
  if (!note) return res.status(404).json({ error: "Nota no encontrada" });
  if (note.user_id !== req.user.id) return res.status(403).json({ error: "Sin acceso a esta nota" });
  return res.json({ note: formatNote(note) });
});

// POST /api/notes -- crear nota
router.post("/", (req, res) => {
  const { title, content = "", color = "#fef08a", tags = [], is_public = false } = req.body;
  if (!title || title.trim().length === 0)
    return res.status(400).json({ error: "El titulo es obligatorio" });
  if (title.length > 200)
    return res.status(400).json({ error: "Titulo demasiado largo (max 200 caracteres)" });
  if (content.length > 10000)
    return res.status(400).json({ error: "Contenido demasiado largo (max 10.000 caracteres)" });
  if (!Array.isArray(tags))
    return res.status(400).json({ error: "Las etiquetas deben ser un array" });

  const db = getDb();
  const id = uuidv4();
  const share_token = is_public ? uuidv4() : null;

  const cleanTitle = validator.escape(title.trim());
  const cleanContent = validator.escape(content.trim());

  db.prepare(
    "INSERT INTO notes (id, user_id, title, content, color, tags, is_public, share_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, req.user.id, cleanTitle, cleanContent, color, JSON.stringify(tags), is_public ? 1 : 0, share_token);
  db.prepare(
    "INSERT INTO activity_log (id, user_id, note_id, action) VALUES (?, ?, ?, 'created')"
  ).run(uuidv4(), req.user.id, id);

  return res.status(201).json({ note: formatNote(db.prepare("SELECT * FROM notes WHERE id = ?").get(id)) });
});

// PUT /api/notes/:id -- editar nota (solo los campos enviados cambian)
router.put("/:id", (req, res) => {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Nota no encontrada" });
  if (existing.user_id !== req.user.id && !["admin", "gestor"].includes(req.user.role))
  return res.status(403).json({ error: "Sin acceso a esta nota" });

  const { title, content, color, tags, is_public } = req.body;
  if (title !== undefined && title.trim().length === 0)
    return res.status(400).json({ error: "El titulo no puede estar vacio" });
  if (title !== undefined && title.length > 200)
    return res.status(400).json({ error: "Titulo demasiado largo (max 200)" });
  if (content !== undefined && content.length > 10000)
    return res.status(400).json({ error: "Contenido demasiado largo (max 10.000)" });

  const newTitle    = title     !== undefined ? validator.escape(title.trim()) : existing.title;
  const newContent  = content   !== undefined ? validator.escape(content.trim()) : existing.content;
  const newColor    = color     !== undefined ? color                : existing.color;
  const newTags     = tags      !== undefined ? JSON.stringify(tags) : existing.tags;
  const newIsPublic = is_public !== undefined ? (is_public ? 1 : 0) : existing.is_public;

  // Logica del share_token:
  let newToken = existing.share_token;
  if (newIsPublic && !existing.share_token) newToken = uuidv4();
  else if (!newIsPublic) newToken = null;

  db.prepare(
    "UPDATE notes SET title=?, content=?, color=?, tags=?, is_public=?, share_token=?, updated_at=datetime('now') WHERE id=?"
  ).run(newTitle, newContent, newColor, newTags, newIsPublic, newToken, req.params.id);

  return res.json({ note: formatNote(db.prepare("SELECT * FROM notes WHERE id = ?").get(req.params.id)) });
});

// DELETE /api/notes/:id -- borrado LOGICO (va a la papelera, no se borra de la BD)
router.delete("/:id", (req, res) => {
  const db = getDb();
  const note = db.prepare("SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
  if (!note) return res.status(404).json({ error: "Nota no encontrada" });
  if (note.user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo un admin puede borrar notas de otros usuarios" });
  }
  db.prepare("UPDATE notes SET deleted_at=datetime('now'), is_public=0, share_token=NULL WHERE id=?")
    .run(req.params.id);
  return res.json({ message: "Nota movida a la papelera" });
});

// POST /api/notes/:id/restore -- recuperar de la papelera
router.post("/:id/restore", (req, res) => {
  const db = getDb();
  const note = db.prepare("SELECT * FROM notes WHERE id = ? AND deleted_at IS NOT NULL").get(req.params.id);
  if (!note) return res.status(404).json({ error: "Nota no encontrada en la papelera" });
  if (note.user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo un admin puede borrar notas de otros usuarios" });
  }
  db.prepare("UPDATE notes SET deleted_at=NULL, updated_at=datetime('now') WHERE id=?").run(req.params.id);
  return res.json({ note: formatNote(db.prepare("SELECT * FROM notes WHERE id = ?").get(req.params.id)) });
});

// DELETE /api/notes/:id/permanent -- borrado DEFINITIVO desde la papelera
router.delete("/:id/permanent", (req, res) => {
  const db = getDb();
  const note = db.prepare("SELECT * FROM notes WHERE id = ? AND deleted_at IS NOT NULL").get(req.params.id);
  if (!note) return res.status(404).json({ error: "Nota no encontrada en la papelera" });
  if (note.user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo un admin puede borrar notas de otros usuarios" });
  }
  db.prepare("DELETE FROM notes WHERE id = ?").run(req.params.id);
  return res.json({ message: "Nota eliminada permanentemente" });
});

module.exports = router;