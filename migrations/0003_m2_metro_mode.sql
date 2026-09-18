PRAGMA defer_foreign_keys = TRUE;

CREATE TABLE round_assets_m2 (
  id TEXT PRIMARY KEY NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('satellite', 'metro')),
  clue_path TEXT NOT NULL UNIQUE,
  answer_latitude REAL NOT NULL CHECK (answer_latitude BETWEEN -90 AND 90),
  answer_longitude REAL NOT NULL CHECK (answer_longitude BETWEEN -180 AND 180),
  attribution TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE games_m2 (
  id TEXT PRIMARY KEY NOT NULL,
  nickname TEXT NOT NULL,
  normalized_nickname TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('satellite', 'metro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete')),
  current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round BETWEEN 1 AND 5),
  total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score BETWEEN 0 AND 25000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE game_rounds_m2 (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL REFERENCES games_m2 (id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 5),
  asset_id TEXT NOT NULL REFERENCES round_assets_m2 (id),
  guess_latitude REAL CHECK (guess_latitude BETWEEN -90 AND 90),
  guess_longitude REAL CHECK (guess_longitude BETWEEN -180 AND 180),
  distance_km REAL CHECK (distance_km >= 0),
  points INTEGER CHECK (points BETWEEN 0 AND 5000),
  guessed_at TEXT,
  UNIQUE (game_id, round_number)
);

INSERT INTO round_assets_m2
SELECT * FROM round_assets;

INSERT INTO games_m2
SELECT * FROM games;

INSERT INTO game_rounds_m2
SELECT * FROM game_rounds;

DROP TABLE game_rounds;
DROP TABLE games;
DROP TABLE round_assets;

ALTER TABLE round_assets_m2 RENAME TO round_assets;
ALTER TABLE games_m2 RENAME TO games;
ALTER TABLE game_rounds_m2 RENAME TO game_rounds;

CREATE INDEX round_assets_mode_enabled_idx
  ON round_assets (mode, enabled);
CREATE INDEX games_status_expires_idx ON games (status, expires_at);
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
    '025bf5ac57b01cda1154',
    'metro',
    '/clues/metro/025bf5ac57b01cda1154.json',
    37.5663105,
    126.977135,
    '© OpenStreetMap contributors (ODbL)',
    'osm-overpass:426b81463b788d396a8be4b6265de433b47f92173797a532a32eb71f17c375aa'
  ),
  (
    '0a2d8a61ed81d77fc90b',
    'metro',
    '/clues/metro/0a2d8a61ed81d77fc90b.json',
    35.1797724,
    129.0764751,
    '© OpenStreetMap contributors (ODbL)',
    'osm-overpass:dd4aa369ef1c339303fb27240388fbed90675058a967c1450cc0c7233467c5e8'
  ),
  (
    'ccf74cbe4d4242ad838c',
    'metro',
    '/clues/metro/ccf74cbe4d4242ad838c.json',
    37.4567305,
    126.7028705,
    '© OpenStreetMap contributors (ODbL)',
    'osm-overpass:b1444a61e00cb5ac8b0b2e5ea9b252d95d98f7fa803149fa7e37e3f21e52c7b5'
  ),
  (
    'b147b379c515134bb988',
    'metro',
    '/clues/metro/b147b379c515134bb988.json',
    35.8760602,
    128.6050621,
    '© OpenStreetMap contributors (ODbL)',
    'osm-overpass:eab1f2aeca72d7b936e01f4d43dec1edbafb73cc1e2fe72d31c1576f21e5bfac'
  ),
  (
    'a957a7358bef3dcf0069',
    'metro',
    '/clues/metro/a957a7358bef3dcf0069.json',
    36.3514596,
    127.3865539,
    '© OpenStreetMap contributors (ODbL)',
    'osm-overpass:35e7b2f7dd44f41821872c107d434da8edd0e95acdaf71e6d21f80d8a62d5aed'
  );

UPDATE app_metadata
SET value = 'm2', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
