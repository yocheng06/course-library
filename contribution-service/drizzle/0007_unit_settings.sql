CREATE TABLE IF NOT EXISTS unit_settings (
  course TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS unit_settings_history (
  id TEXT PRIMARY KEY, course TEXT NOT NULL, revision INTEGER NOT NULL,
  before_data TEXT NOT NULL, after_data TEXT NOT NULL, actor TEXT NOT NULL, created_at INTEGER NOT NULL
);
