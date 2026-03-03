// routes/shared.js -- Acceso publico a notas compartidas por enlace

const express = require("express");
const { getDb } = require("../db");

const router = express.Router();

// GET /api/shared/:token
router.get("/:token", (req, res) => {
  const db = getDb();

  const note = db
    .prepare("SELECT * FROM notes WHERE share_token = ? AND is_public = 1 AND deleted_at IS NULL")
    .get(req.params.token);

  if (!note)
    return res.status(404).json({ error: "Nota no encontrada o ya no es publica" });

  return res.json({
    note: {
      id: note.id,
      title: note.title,
      content: note.content,
      color: note.color,
      tags: (() => { try { return JSON.parse(note.tags); } catch { return []; } })(),
      created_at: note.created_at,
      updated_at: note.updated_at
    }
  });
});

module.exports = router;