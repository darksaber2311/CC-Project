import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

// Ensure storage directories exist
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.storagePath, { recursive: true });

export const db = new DatabaseSync(config.dbPath);

// Enable WAL mode and enforce foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

export function initDatabase() {
  db.exec(`
    -- 1. Users Table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      full_name TEXT NOT NULL,
      department TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    -- 2. Sessions Table
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    -- 3. Documents Table
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      original_filename TEXT NOT NULL,
      stored_filename TEXT UNIQUE NOT NULL,
      owner_id TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      file_extension TEXT NOT NULL,
      sensitivity_level TEXT NOT NULL CHECK(sensitivity_level IN ('public', 'internal', 'confidential')),
      description TEXT,
      storage_path TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_documents_sensitivity ON documents(sensitivity_level);
    CREATE INDEX IF NOT EXISTS idx_documents_is_deleted ON documents(is_deleted);

    -- 4. Document Permissions Table
    CREATE TABLE IF NOT EXISTS document_permissions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      permission_type TEXT NOT NULL CHECK(permission_type IN ('view', 'download')),
      granted_by TEXT NOT NULL,
      granted_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      UNIQUE(document_id, user_id, permission_type),
      FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(granted_by) REFERENCES users(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_doc_perm_user ON document_permissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_doc_perm_doc ON document_permissions(document_id);

    -- 5. Audit Logs Table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      actor_id TEXT,
      actor_username TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      outcome TEXT NOT NULL CHECK(outcome IN ('success', 'failure', 'denied')),
      ip_address TEXT,
      user_agent TEXT,
      details_json TEXT,
      correlation_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_outcome ON audit_logs(outcome);

    -- 6. Security Alerts Table
    CREATE TABLE IF NOT EXISTS security_alerts (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
      risk_score INTEGER NOT NULL CHECK(risk_score >= 0 AND risk_score <= 100),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'acknowledged', 'resolved')),
      trigger_user_id TEXT,
      trigger_username TEXT,
      related_document_id TEXT,
      detected_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      acknowledged_at TEXT,
      acknowledged_by TEXT,
      resolved_at TEXT,
      resolved_by TEXT,
      resolution_note TEXT,
      is_synthetic INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(trigger_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(related_document_id) REFERENCES documents(id) ON DELETE SET NULL,
      FOREIGN KEY(acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(resolved_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_status ON security_alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON security_alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_alerts_detected_at ON security_alerts(detected_at);

    -- 7. Alert Triggering Events Table
    CREATE TABLE IF NOT EXISTS alert_events (
      alert_id TEXT NOT NULL,
      audit_log_id TEXT NOT NULL,
      PRIMARY KEY(alert_id, audit_log_id),
      FOREIGN KEY(alert_id) REFERENCES security_alerts(id) ON DELETE CASCADE,
      FOREIGN KEY(audit_log_id) REFERENCES audit_logs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_alert_events_log ON alert_events(audit_log_id);
  `);
}

// Helper methods for queries
export function query(sql, ...params) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

export function queryOne(sql, ...params) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

export function execute(sql, ...params) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

export function transaction(callback) {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = callback(db);
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// Auto-initialize schema
initDatabase();
