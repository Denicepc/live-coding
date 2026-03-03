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
      role        TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
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

    CREATE INDEX IF NOT EXISTS idx_notes_user_id    ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_share_token ON notes(share_token);
  `);
}

module.exports = { getDb };