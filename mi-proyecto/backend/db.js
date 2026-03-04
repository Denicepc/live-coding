// db.js — Conexion a SQLite y definicion del esquema

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "stickyboard.db");

let db;

function getDb() {
  if (!db) {
    const fs = require("fs");
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      username    TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'user'
                  CHECK(role IN ('admin', 'gestor', 'user')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL DEFAULT '',
      color       TEXT NOT NULL DEFAULT '#fef08a',
      tags        TEXT NOT NULL DEFAULT '[]',
      is_public   INTEGER NOT NULL DEFAULT 0,
      share_token TEXT UNIQUE,
      deleted_at  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note_id        TEXT REFERENCES notes(id) ON DELETE SET NULL,
      action         TEXT NOT NULL,
      target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notes_user_id      ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_share_token  ON notes(share_token);
    CREATE INDEX IF NOT EXISTS idx_activity_user_id   ON activity_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_note_id   ON activity_log(note_id);
  `);
    runMigrations(db);
}

function runMigrations(db) {
  // Comprueba si la columna 'assigned_to' existe en notes.
  // Si no existe, la añade (bases de datos creadas antes de este cambio).
  const columns = db.prepare("PRAGMA table_info(notes)").all();
  const hasAssignedTo = columns.some(c => c.name === "assigned_to");
  if (!hasAssignedTo) {
    db.exec("ALTER TABLE notes ADD COLUMN assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL");
    console.log("Migracion aplicada: columna assigned_to añadida a notes");
  }

  // Comprueba si la tabla activity_log existe ya
  // (por si se ejecuta initSchema varias veces)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='activity_log'").all();
  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE activity_log (
        id             TEXT PRIMARY KEY,
        user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        note_id        TEXT REFERENCES notes(id) ON DELETE SET NULL,
        action         TEXT NOT NULL,
        target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_activity_user_id ON activity_log(user_id);
      CREATE INDEX idx_activity_note_id ON activity_log(note_id);
    `);
    console.log("Migracion aplicada: tabla activity_log creada");
  }
}

module.exports = { getDb };