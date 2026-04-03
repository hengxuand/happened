-- ============================================================
-- RSS Fetch Schedule
--
-- Replaces the 10 individual cron jobs with a single table that
-- records what to fetch and how often.  A single cron job fires
-- every minute and calls the `orchestrate-rss-fetch` edge
-- function, which atomically claims the single most-overdue
-- language/topic pair, fetches it, then exits.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Schedule table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rss_fetch_schedule (
  id           SERIAL       PRIMARY KEY,
  language     TEXT         NOT NULL,
  topic        TEXT         NOT NULL,
  interval_min INT          NOT NULL,   -- desired refresh cadence in minutes
  last_run_at  TIMESTAMPTZ,             -- NULL = never run (highest priority)
  enabled      BOOLEAN      NOT NULL DEFAULT true,
  UNIQUE (language, topic)
);

-- ------------------------------------------------------------
-- 2. Seed – mirrors your current 10 cron jobs
-- ------------------------------------------------------------

INSERT INTO rss_fetch_schedule (language, topic, interval_min) VALUES
  ('en', 'WORLD',       7),
  ('en', 'NATION',      8),
  ('en', 'BUSINESS',    9),
  ('en', 'TECHNOLOGY',  10),
  ('en', 'POLITICS',    11),
  ('zh', 'WORLD',       12),
  ('zh', 'NATION',      13),
  ('zh', 'BUSINESS',    14),
  ('zh', 'TECHNOLOGY',  15),
  ('zh', 'POLITICS',    16)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 3. claim_next_due_rss_topic()
--
-- Atomically finds the most-overdue topic and stamps last_run_at
-- = NOW() in the same UPDATE, so a second concurrent caller
-- cannot claim the same row.
--
-- "Most overdue" = smallest (last_run_at + interval_min),
-- i.e. the topic whose next-due timestamp is furthest in the past.
-- Rows with last_run_at IS NULL (never run) are treated as
-- having next_due = -infinity, so they are always picked first.
--
-- FOR UPDATE SKIP LOCKED ensures that if two callers race, the
-- second one skips the already-locked row and either claims a
-- different due topic or returns nothing.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_next_due_rss_topic()
RETURNS TABLE (schedule_id INT, schedule_language TEXT, schedule_topic TEXT)
LANGUAGE sql
AS $$
  UPDATE rss_fetch_schedule
  SET last_run_at = NOW()
  WHERE id = (
    SELECT id
    FROM   rss_fetch_schedule
    WHERE  enabled = true
      AND  (
             last_run_at IS NULL
          OR last_run_at + (interval_min * INTERVAL '1 minute') <= NOW()
           )
    ORDER BY
      COALESCE(
        last_run_at + (interval_min * INTERVAL '1 minute'),
        '-infinity'::TIMESTAMPTZ
      ) ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id, language, topic;
$$;

