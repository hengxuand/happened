-- ============================================================
-- Google News RSS items table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.google_news_rss (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic            TEXT        NOT NULL,
  language         TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  source           TEXT        NOT NULL DEFAULT '',
  pub_date         TEXT,
  guid             TEXT        NOT NULL,
  link             TEXT,
  description      TEXT,
  importance_score REAL,
  published_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guid)
);
