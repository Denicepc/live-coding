// middleware/auth.js — Verificacion de JWT y comprobacion de rol admin

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "stickyboard_dev_secret_change_in_prod";

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Acceso restringido a administradores" });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware, JWT_SECRET };