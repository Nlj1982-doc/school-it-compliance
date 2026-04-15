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
    // School contact fields
    `ALTER TABLE schools ADD COLUMN address_line1 TEXT;`,
    `ALTER TABLE schools ADD COLUMN address_line2 TEXT;`,
    `ALTER TABLE schools ADD COLUMN city TEXT;`,
    `ALTER TABLE schools ADD COLUMN postcode TEXT;`,
    `ALTER TABLE schools ADD COLUMN phone TEXT;`,
    `ALTER TABLE schools ADD COLUMN website TEXT;`,
    // Head Teacher
    `ALTER TABLE schools ADD COLUMN ht_name TEXT;`,
    `ALTER TABLE schools ADD COLUMN ht_email TEXT;`,
    `ALTER TABLE schools ADD COLUMN ht_phone TEXT;`,
    // Designated Safeguarding Lead
    `ALTER TABLE schools ADD COLUMN dsl_name TEXT;`,
    `ALTER TABLE schools ADD COLUMN dsl_email TEXT;`,
    `ALTER TABLE schools ADD COLUMN dsl_phone TEXT;`,
    // Technical Lead
    `ALTER TABLE schools ADD COLUMN tech_name TEXT;`,
    `ALTER TABLE schools ADD COLUMN tech_email TEXT;`,
    `ALTER TABLE schools ADD COLUMN tech_phone TEXT;`,
    // Managed Service Provider
    `ALTER TABLE schools ADD COLUMN msp_name TEXT;`,
    `ALTER TABLE schools ADD COLUMN msp_contact TEXT;`,
    `ALTER TABLE schools ADD COLUMN msp_email TEXT;`,
    `ALTER TABLE schools ADD COLUMN msp_phone TEXT;`,
    `ALTER TABLE schools ADD COLUMN msp_contract_expiry TEXT;`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* already exists */ }
  }

  // Contracts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id),
      name TEXT NOT NULL,
      supplier TEXT,
      type TEXT,
      start_date TEXT,
      end_date TEXT,
      value TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      auto_renew INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id),
      device_type TEXT NOT NULL,
      asset_tag TEXT,
      device_name TEXT,
      make TEXT,
      model TEXT,
      serial_number TEXT,
      os TEXT,
      purchase_date TEXT,
      warranty_end_date TEXT,
      warranty_type TEXT,
      assigned_to TEXT,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);
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
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  ht_name: string | null;
  ht_email: string | null;
  ht_phone: string | null;
  dsl_name: string | null;
  dsl_email: string | null;
  dsl_phone: string | null;
  tech_name: string | null;
  tech_email: string | null;
  tech_phone: string | null;
  msp_name: string | null;
  msp_contact: string | null;
  msp_email: string | null;
  msp_phone: string | null;
  msp_contract_expiry: string | null;
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
