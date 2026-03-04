// routes/activity.js -- Log de actividad (el "blog")
// Admin y gestor ven toda la actividad.
// Usuario normal solo ve la suya propia.

const express = require("express");
const { getDb } = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/activity
router.get("/", (req, res) => {
  const db = getDb();
  const isPrivileged = ["admin", "gestor"].includes(req.user.role);

  const sql = isPrivileged
    ? `SELECT a.id, a.action, a.created_at,
              u.username as actor,
              n.id as note_id, n.title as note_title,
              t.username as target_username
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN notes n ON n.id = a.note_id
       LEFT JOIN users t ON t.id = a.target_user_id
       ORDER BY a.created_at DESC
       LIMIT 100`
    : `SELECT a.id, a.action, a.created_at,
              u.username as actor,
              n.id as note_id, n.title as note_title,
              t.username as target_username
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN notes n ON n.id = a.note_id
       LEFT JOIN users t ON t.id = a.target_user_id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC
       LIMIT 50`;

  const logs = isPrivileged
    ? db.prepare(sql).all()
    : db.prepare(sql).all(req.user.id);

  return res.json({ logs });
});

module.exports = router;