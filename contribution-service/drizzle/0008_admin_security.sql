CREATE TABLE IF NOT EXISTS admin_security (
 id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 0,
 secret TEXT,pending_secret TEXT,pending_at INTEGER,version INTEGER NOT NULL DEFAULT 0,
 last_counter INTEGER NOT NULL DEFAULT -1,recovery_hashes TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO admin_security(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS admin_revoked_sessions (
 token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL
);
