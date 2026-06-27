-- schema.sql — BLACK JACK 292 database schema

CREATE TABLE IF NOT EXISTS players (
  id              SERIAL PRIMARY KEY,
  last_name       TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  gmail           TEXT NOT NULL UNIQUE,
  display_pseudo  TEXT NOT NULL UNIQUE,
  country         TEXT NOT NULL,
  display_country TEXT NOT NULL,
  password        TEXT NOT NULL,
  emoji           TEXT, -- secondary emoji shown after the country flag, optional
  balance         BIGINT NOT NULL DEFAULT 72808,
  balance_before_last_game BIGINT NOT NULL DEFAULT 72808,
  has_played      BOOLEAN NOT NULL DEFAULT FALSE, -- false => shown in "Unranked"
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- One row per finished game (a "round" with up to 8 hands)
CREATE TABLE IF NOT EXISTS games (
  id                  SERIAL PRIMARY KEY,
  player_id           INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  balance_before       BIGINT NOT NULL,
  balance_after        BIGINT NOT NULL,
  total_bet            BIGINT NOT NULL,
  total_won            BIGINT NOT NULL, -- sum of positive net gains across hands
  total_lost           BIGINT NOT NULL, -- sum of absolute negative net losses across hands
  net_change           BIGINT NOT NULL, -- total_won - total_lost (can be negative)
  dealer_cards_json    JSONB NOT NULL,
  hands_json           JSONB NOT NULL, -- full detail of every hand: cards, bet, result, etc.
  surrendered          BOOLEAN NOT NULL DEFAULT FALSE,
  reveals_used          INTEGER NOT NULL DEFAULT 0,
  played_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_player_id ON games(player_id);
CREATE INDEX IF NOT EXISTS idx_games_played_at ON games(played_at DESC);
