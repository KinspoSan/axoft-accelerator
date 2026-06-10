import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbPath = process.env.DB_PATH || 'data/axoft.db';
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS vendors (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    email            TEXT    UNIQUE NOT NULL,
    password_hash    TEXT    NOT NULL,
    company          TEXT    NOT NULL,
    inn              TEXT    NOT NULL,
    direction        TEXT,
    stage            TEXT,
    skolkovo         INTEGER DEFAULT 0,
    tier             TEXT    DEFAULT 'base',
    bitrix_lead_id   INTEGER,
    created_at       TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT    NOT NULL,
    token      TEXT    UNIQUE NOT NULL,
    expires_at TEXT    NOT NULL,
    used       INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id      INTEGER NOT NULL REFERENCES vendors(id),
    service_id     TEXT,
    service_name   TEXT    NOT NULL,
    block          TEXT,
    price          INTEGER DEFAULT 0,
    price_display  TEXT,
    payment_type   TEXT    DEFAULT 'Счёт',
    status         TEXT    DEFAULT 'new',
    status_label   TEXT    DEFAULT 'Новый',
    bitrix_deal_id INTEGER,
    bitrix_lead_id INTEGER,
    created_at     TEXT    DEFAULT (datetime('now'))
  );
`);

export default db;
