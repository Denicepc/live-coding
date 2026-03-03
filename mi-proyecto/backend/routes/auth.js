// routes/auth.js -- Registro, login y consulta del usuario actual

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../db");
const { JWT_SECRET, authMiddleware } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { email, username, password, confirmPassword } = req.body;

  // Validaciones en backend (nunca confiar solo en el frontend)
  if (!email || !username || !password || !confirmPassword)
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  if (password !== confirmPassword)
    return res.status(400).json({ error: "Las contraseñas no coinciden" });
  if (password.length < 8)
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Email no valido" });
  if (username.length < 3 || username.length > 30)
    return res.status(400).json({ error: "El username debe tener entre 3 y 30 caracteres" });

  const db = getDb();

  // Comprobar que el email y el username no esten ya en uso
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ? OR username = ?")
    .get(email, username);
  if (existing)
    return res.status(409).json({ error: "El email o username ya esta en uso" });

  // Si no hay ningun usuario aun, este sera el admin automaticamente
  const { c } = db.prepare("SELECT COUNT(*) as c FROM users").get();
  const role = c === 0 ? "admin" : "user";

  // Hashear la contraseña con bcrypt, coste 12 (buen equilibrio seguridad/velocidad)
  const hashedPassword = bcrypt.hashSync(password, 12);
  const id = uuidv4();

  db.prepare(
    "INSERT INTO users (id, email, username, password, role) VALUES (?, ?, ?, ?, ?)"
  ).run(id, email.toLowerCase().trim(), username.trim(), hashedPassword, role);

  // Devolver el token directamente para que el frontend no tenga que hacer login aparte
  const token = jwt.sign({ id, email, username, role }, JWT_SECRET, { expiresIn: "7d" });
  return res.status(201).json({ token, user: { id, email, username, role } });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password)
    return res.status(400).json({ error: "Identificador y contraseña son obligatorios" });

  const db = getDb();
  const user = db
    .prepare("SELECT * FROM users WHERE email = ? OR username = ?")
    .get(identifier.toLowerCase().trim(), identifier.trim());

  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: "Credenciales incorrectas" });

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  return res.json({
    token,
    user: { id: user.id, email: user.email, username: user.username, role: user.role }
  });
});

// GET /api/auth/me  [PROTEGIDO]
router.get("/me", authMiddleware, (req, res) => {
  const db = getDb();
  const user = db
    .prepare("SELECT id, email, username, role, created_at FROM users WHERE id = ?")
    .get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json({ user });
});

module.exports = router;