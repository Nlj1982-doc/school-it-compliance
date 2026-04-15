import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "compliance.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  seedAdmin(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      school_name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      school_name TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      answers TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Add user_id column to existing assessments table if it doesn't exist
  try {
    db.exec(`ALTER TABLE assessments ADD COLUMN user_id TEXT REFERENCES users(id);`);
  } catch {
    // Column already exists — safe to ignore
  }
}

function seedAdmin(db: Database.Database) {
  const existing = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!existing) {
    const hash = bcrypt.hashSync("Admin1234!", 10);
    db.prepare(
      "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run("admin-seed", "admin", hash, "admin", new Date().toISOString());
  }
}

export interface Assessment {
  id: string;
  school_name: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  answers: string;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "user";
  school_name: string | null;
  created_at: string;
}
