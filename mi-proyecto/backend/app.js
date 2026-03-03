// app.js -- Punto de entrada del servidor

const express = require("express");
const cors = require("cors");

const authRoutes   = require("./routes/auth");
const notesRoutes  = require("./routes/notes");
const sharedRoutes = require("./routes/shared");
const adminRoutes  = require("./routes/admin");
const rateLimit = require("express-rate-limit");

const app = express();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ventana de 15 minutos
  max: 10,                   // máximo 10 intentos por IP en esa ventana
  message: { error: "Demasiados intentos. Espera 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false
});

// CORS (FRONTEND_URL se define en docker-compose.yml para produccion)
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Parsear el body de las peticiones como JSON.
app.use(express.json({ limit: "50kb" }));

app.use("/api/auth",   authRoutes);   
app.use("/api/notes",  notesRoutes);  
app.use("/api/shared", sharedRoutes); 
app.use("/api/admin",  adminRoutes);  

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", loginLimiter);

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Catch-all 404
app.use((_req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// Manejador de errores global
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sticky Board backend escuchando en http://localhost:${PORT}`);
});