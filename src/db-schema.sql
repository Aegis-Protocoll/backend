CREATE TABLE IF NOT EXISTS risk_scores (
  wallet        TEXT PRIMARY KEY,
  score         INT NOT NULL,
  level         TEXT NOT NULL,
  flags         TEXT[] DEFAULT '{}',
  reasoning     TEXT,
  hop_distance  INT,
  is_compliant  BOOLEAN,
  layer         TEXT,
  tx_hash       TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS score_history (
  id            SERIAL PRIMARY KEY,
  wallet        TEXT NOT NULL,
  score         INT NOT NULL,
  level         TEXT NOT NULL,
  flags         TEXT[] DEFAULT '{}',
  reasoning     TEXT,
  hop_distance  INT,
  layer         TEXT,
  tx_hash       TEXT,
  scored_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_wallet ON risk_scores(wallet);
CREATE INDEX IF NOT EXISTS idx_history_wallet ON score_history(wallet);
CREATE INDEX IF NOT EXISTS idx_history_scored_at ON score_history(scored_at);
