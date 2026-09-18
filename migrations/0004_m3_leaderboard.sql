CREATE TABLE leaderboard_entries (
  mode TEXT NOT NULL CHECK (mode IN ('satellite', 'metro')),
  normalized_nickname TEXT NOT NULL,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 25000),
  game_id TEXT NOT NULL UNIQUE,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (mode, normalized_nickname)
);

CREATE INDEX leaderboard_mode_score_idx
  ON leaderboard_entries (
    mode,
    score DESC,
    completed_at ASC,
    normalized_nickname ASC
  );

UPDATE app_metadata
SET value = 'm3', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
