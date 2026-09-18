PRAGMA foreign_keys = ON;

CREATE TABLE round_assets (
  id TEXT PRIMARY KEY NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('satellite')),
  clue_path TEXT NOT NULL UNIQUE,
  answer_latitude REAL NOT NULL CHECK (answer_latitude BETWEEN -90 AND 90),
  answer_longitude REAL NOT NULL CHECK (answer_longitude BETWEEN -180 AND 180),
  attribution TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX round_assets_mode_enabled_idx
  ON round_assets (mode, enabled);

CREATE TABLE games (
  id TEXT PRIMARY KEY NOT NULL,
  nickname TEXT NOT NULL,
  normalized_nickname TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('satellite')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete')),
  current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round BETWEEN 1 AND 5),
  total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score BETWEEN 0 AND 25000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX games_status_expires_idx ON games (status, expires_at);

CREATE TABLE game_rounds (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 5),
  asset_id TEXT NOT NULL REFERENCES round_assets (id),
  guess_latitude REAL CHECK (guess_latitude BETWEEN -90 AND 90),
  guess_longitude REAL CHECK (guess_longitude BETWEEN -180 AND 180),
  distance_km REAL CHECK (distance_km >= 0),
  points INTEGER CHECK (points BETWEEN 0 AND 5000),
  guessed_at TEXT,
  UNIQUE (game_id, round_number)
);

CREATE INDEX game_rounds_game_idx ON game_rounds (game_id, round_number);

INSERT INTO round_assets (
  id,
  mode,
  clue_path,
  answer_latitude,
  answer_longitude,
  attribution,
  source_reference
)
VALUES
  (
    '774cdf0811128739b445',
    'satellite',
    '/clues/774cdf0811128739b445.png',
    37.5445773,
    126.9580078,
    'Contains modified Copernicus Sentinel data (2025)',
    'S2C_MSIL2A_20250322T021601_R003_T52SCG_20250322T062116'
  ),
  (
    '1b2d40b729dd7219af43',
    'satellite',
    '/clues/1b2d40b729dd7219af43.png',
    35.2097216,
    129.0673828,
    'Contains modified Copernicus Sentinel data (2025)',
    'S2B_MSIL2A_20251129T020939_R103_T52SDE_20251129T034700'
  ),
  (
    '687ba6aa6f5209f0c5b6',
    'satellite',
    '/clues/687ba6aa6f5209f0c5b6.png',
    37.4748581,
    126.6943359,
    'Contains modified Copernicus Sentinel data (2025)',
    'S2A_MSIL2A_20250910T022131_R003_T52SBG_20250910T062313'
  ),
  (
    '029690a787769dc11d64',
    'satellite',
    '/clues/029690a787769dc11d64.png',
    35.8534396,
    128.6279297,
    'Contains modified Copernicus Sentinel data (2024)',
    'S2B_MSIL2A_20240518T020649_R103_T52SDE_20240518T054112'
  ),
  (
    'c2d2ab5c2b7d0aa1f221',
    'satellite',
    '/clues/c2d2ab5c2b7d0aa1f221.png',
    36.350527,
    127.3974609,
    'Contains modified Copernicus Sentinel data (2025)',
    'S2C_MSIL2A_20250322T021601_R003_T52SCF_20250322T062116'
  );

UPDATE app_metadata
SET value = 'm1', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
