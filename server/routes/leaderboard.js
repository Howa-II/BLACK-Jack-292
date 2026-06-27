// routes/leaderboard.js — Ranked leaderboard + "Unranked" section
//
// Players who have an account but have never played a game (has_played = false)
// are shown separately under "Unranked", not mixed into the ranked list.

const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/leaderboard  — ranked players, sorted by current balance (descending)
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const ranked = await pool.query(
      `SELECT id, display_pseudo, display_country, emoji, balance, balance_before_last_game
       FROM players
       WHERE has_played = true
       ORDER BY balance DESC`
    );

    const unranked = await pool.query(
      `SELECT id, display_pseudo, display_country, emoji, balance
       FROM players
       WHERE has_played = false
       ORDER BY display_pseudo ASC`
    );

    // For each ranked player, fetch their most recent game to compute
    // bet / lost / won / net change for the "last game" summary line.
    const rankedWithLastGame = await Promise.all(
      ranked.rows.map(async (player) => {
        const lastGame = await pool.query(
          `SELECT total_bet, total_lost, total_won, net_change, played_at
           FROM games WHERE player_id = $1
           ORDER BY played_at DESC LIMIT 1`,
          [player.id]
        );
        return {
          ...player,
          lastGame: lastGame.rows[0] || null,
        };
      })
    );

    return res.json({
      ranked: rankedWithLastGame,
      unranked: unranked.rows,
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error fetching leaderboard.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/leaderboard/:playerId/history  — full game history + chess.com-style stats
// ---------------------------------------------------------------------------
router.get('/:playerId/history', async (req, res) => {
  try {
    const games = await pool.query(
      `SELECT id, balance_before, balance_after, total_bet, total_won, total_lost,
              net_change, surrendered, reveals_used, played_at
       FROM games WHERE player_id = $1
       ORDER BY played_at DESC`,
      [req.params.playerId]
    );

    const total = games.rows.length;
    const wins = games.rows.filter((g) => g.net_change > 0).length;
    const losses = games.rows.filter((g) => g.net_change < 0).length;
    const pushes = games.rows.filter((g) => g.net_change === 0).length;
    const totalWagered = games.rows.reduce((sum, g) => sum + Number(g.total_bet), 0);
    const biggestWin = games.rows.reduce((max, g) => Math.max(max, Number(g.net_change)), 0);
    const biggestLoss = games.rows.reduce((min, g) => Math.min(min, Number(g.net_change)), 0);

    return res.json({
      stats: {
        totalGames: total,
        wins,
        losses,
        pushes,
        winRate: total > 0 ? (wins / total) * 100 : 0,
        totalWagered,
        biggestWin,
        biggestLoss,
      },
      games: games.rows,
    });
  } catch (err) {
    console.error('History error:', err);
    return res.status(500).json({ error: 'Internal server error fetching history.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/leaderboard/game/:gameId  — full detail of one game (for "view more")
// Includes the final dealer reveal, every hand's cards/result, and game-wide stats.
// ---------------------------------------------------------------------------
router.get('/game/:gameId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM games WHERE id = $1', [req.params.gameId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Game not found.' });
    return res.json({ game: result.rows[0] });
  } catch (err) {
    console.error('Game detail error:', err);
    return res.status(500).json({ error: 'Internal server error fetching game detail.' });
  }
});

module.exports = router;
