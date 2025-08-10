import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const dbPath = process.env.DB_PATH || './data/gsmb.db';
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);

// Initialize schema
db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  display_name TEXT,
  FOREIGN KEY(role_id) REFERENCES roles(id)
);

-- licenses now includes owner_user_id (added via ALTER below if missing)
CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY,
  license_no TEXT UNIQUE NOT NULL,
  owner_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' -- ACTIVE | SUSPENDED
);

CREATE TABLE IF NOT EXISTS lorries (
  id INTEGER PRIMARY KEY,
  plate TEXT UNIQUE NOT NULL,
  license_id INTEGER NOT NULL,
  FOREIGN KEY(license_id) REFERENCES licenses(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  plate TEXT NOT NULL,
  location TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | CHECKED | FINED | CLOSED
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  officer_id INTEGER,
  FOREIGN KEY(officer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS fines (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  reason TEXT,
  payment_ref TEXT UNIQUE NOT NULL,
  is_paid INTEGER NOT NULL DEFAULT 0,
  paid_via TEXT, -- 'webhook' | 'manual' | 'manual_review'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  fine_id INTEGER NOT NULL,
  gateway_txn_id TEXT,
  amount INTEGER NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(fine_id) REFERENCES fines(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY,
  actor_user_id INTEGER,
  action TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(actor_user_id) REFERENCES users(id)
);
`);

/** --------- MIGRATIONS (safe re-run) --------- **/
// Add licenses.owner_user_id if missing (SQLite has no IF NOT EXISTS for ALTER)
const licenseCols = db.prepare(`PRAGMA table_info('licenses')`).all();
const hasOwnerUserId = licenseCols.some(c => (c.name || '').toLowerCase() === 'owner_user_id');
if (!hasOwnerUserId) {
  db.exec(`ALTER TABLE licenses ADD COLUMN owner_user_id INTEGER;`);
}

// Create fine_evidence if missing (for slip uploads + manual review)
db.exec(`
CREATE TABLE IF NOT EXISTS fine_evidence (
  id INTEGER PRIMARY KEY,
  fine_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
  uploaded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(fine_id) REFERENCES fines(id),
  FOREIGN KEY(uploaded_by) REFERENCES users(id)
);
`);

// Helpful indexes (idempotent create)
db.exec(`
CREATE INDEX IF NOT EXISTS idx_lorries_license_id ON lorries(license_id);
CREATE INDEX IF NOT EXISTS idx_reports_plate ON reports(plate);
CREATE INDEX IF NOT EXISTS idx_fines_report_id ON fines(report_id);
CREATE INDEX IF NOT EXISTS idx_payments_fine_id ON payments(fine_id);
CREATE INDEX IF NOT EXISTS idx_fine_evidence_fine_id ON fine_evidence(fine_id);
`);

/** --------- SEED DATA (only on first bootstrap) --------- **/
const roleCount = db.prepare('SELECT COUNT(*) as c FROM roles').get().c;
if (roleCount === 0) {
  db.exec(`
  INSERT INTO roles (name) VALUES ('POLICE'), ('GSMB'), ('OWNER');
  INSERT INTO users (username, password, role_id, display_name) VALUES
    ('police', 'police123', (SELECT id FROM roles WHERE name='POLICE'), 'Officer Priyantha'),
    ('gsmb', 'gsmb123', (SELECT id FROM roles WHERE name='GSMB'), 'GSMB Officer Nimal'),
    ('owner', 'owner123', (SELECT id FROM roles WHERE name='OWNER'), 'License Owner Sahan');

  INSERT INTO licenses (license_no, owner_name, status) VALUES
    ('LIC-2025-001', 'Sahan Minerals', 'ACTIVE'),
    ('LIC-2025-002', 'Anupa Sands', 'ACTIVE');

  INSERT INTO lorries (plate, license_id) VALUES
    ('SP-1234', (SELECT id FROM licenses WHERE license_no='LIC-2025-001')),
    ('NC-5678', (SELECT id FROM licenses WHERE license_no='LIC-2025-002'));
  `);
  // map demo licenses to the demo owner user
  db.exec(`
    UPDATE licenses
    SET owner_user_id = (SELECT id FROM users WHERE username='owner')
    WHERE license_no IN ('LIC-2025-001','LIC-2025-002');
  `);
  console.log('Seeded demo data');
} else {
  // If DB already existed from older version, try to backfill owner_user_id for demo data (safe no-op if missing)
  const owner = db.prepare(`SELECT id FROM users WHERE username='owner'`).get();
  if (owner?.id) {
    db.exec(`
      UPDATE licenses
      SET owner_user_id = ${owner.id}
      WHERE owner_user_id IS NULL
        AND license_no IN ('LIC-2025-001','LIC-2025-002');
    `);
  }
}

export default db;
