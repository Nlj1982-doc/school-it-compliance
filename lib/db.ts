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
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      urn TEXT,
      address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      school_id TEXT REFERENCES schools(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      school_id TEXT REFERENCES schools(id),
      school_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      answers TEXT NOT NULL DEFAULT '{}'
    );
  `);

  // Migrate existing tables — add new columns if they don't exist
  const migrations = [
    `ALTER TABLE users ADD COLUMN school_id TEXT REFERENCES schools(id);`,
    `ALTER TABLE assessments ADD COLUMN school_id TEXT REFERENCES schools(id);`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* already exists */ }
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

export interface School {
  id: string;
  name: string;
  urn: string | null;
  address: string | null;
  created_at: string;
}

export interface Assessment {
  id: string;
  school_id: string | null;
  school_name: string;
  created_at: string;
  updated_at: string;
  answers: string;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "user";
  school_id: string | null;
  created_at: string;
}
