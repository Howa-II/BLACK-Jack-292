// routes/game.js — Game session routes
// Holds active games in memory (keyed by playerId) and exposes endpoints
// for every action of the BLACK JACK 292 engine. On resolution, persists
// the result to the database and updates the player's balance/history.

const express = require('express');
const pool = require('../db/pool');
const engine = require('../game');

const router = express.Router();

// In-memory active games. For a small friends-and-family project this is fine;
// a production-grade app would persist in-progress state too.
const activeGames = new Map(); // playerId -> game object

function getActiveGame(playerId) {
  const game = activeGames.get(String(playerId));
  if (!game) throw new Error('No active game for this player. Start a new game first.');
  return game;
}

function handleEngineError(res, err) {
  console.error('Game engine error:', err.message);
  return res.status(400).json({ error: err.message });
}

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/new — starts a brand new game (7 hands)
// ---------------------------------------------------------------------------
router.post('/:playerId/new', async (req, res) => {
  try {
    const playerResult = await pool.query('SELECT balance FROM players WHERE id = $1', [req.params.playerId]);
    if (playerResult.rows.length === 0) return res.status(404).json({ error: 'Player not found.' });

    const balance = Number(playerResult.rows[0].balance);
    const game = engine.createGame(req.params.playerId, balance);
    activeGames.set(String(req.params.playerId), game);

    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/bet — { handIndex, amount }
// ---------------------------------------------------------------------------
router.post('/:playerId/bet', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.placeBet(game, req.body.handIndex, req.body.amount);
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/deal-first — deals the 1st hidden card to all hands
// ---------------------------------------------------------------------------
router.post('/:playerId/deal-first', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.dealFirstCard(game);
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/reveal-first — { handIndex, reveal }
// ---------------------------------------------------------------------------
router.post('/:playerId/reveal-first', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.decideRevealFirstCard(game, req.body.handIndex, req.body.reveal);
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/deal-second
// ---------------------------------------------------------------------------
router.post('/:playerId/deal-second', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.dealSecondCard(game);
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/reveal-second — { handIndex, reveal }
// ---------------------------------------------------------------------------
router.post('/:playerId/reveal-second', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.decideRevealSecondCard(game, req.body.handIndex, req.body.reveal);
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/finalize-reveals — closes the reveal window, opens player turn
// ---------------------------------------------------------------------------
router.post('/:playerId/finalize-reveals', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.finalizeRevealDecisions(game);
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/hit — { handIndex }
// ---------------------------------------------------------------------------
router.post('/:playerId/hit', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.hit(game, req.body.handIndex);
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/stand — { handIndex }
// ---------------------------------------------------------------------------
router.post('/:playerId/stand', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.stand(game, req.body.handIndex);
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/double — { handIndex }
// ---------------------------------------------------------------------------
router.post('/:playerId/double', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.doubleDown(game, req.body.handIndex);
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/split — { handIndex }
// ---------------------------------------------------------------------------
router.post('/:playerId/split', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    const newHand = engine.checkAndApplySplit(game, req.body.handIndex);
    if (!newHand) {
      return res.status(400).json({ error: 'This hand is not eligible for a split.' });
    }
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/insurance — { handIndex }
// ---------------------------------------------------------------------------
router.post('/:playerId/insurance', (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.placeInsurance(game, req.body.handIndex);
    return res.json({ game: sanitizeGame(game) });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/surrender — surrenders ALL hands at once
// ---------------------------------------------------------------------------
router.post('/:playerId/surrender', async (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    engine.surrenderAllHands(game);
    const summary = await persistFinishedGame(game);
    return res.json({ game: sanitizeGame(game), summary });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/game/:playerId/resolve — reveals dealer + resolves all hands + saves to DB
// ---------------------------------------------------------------------------
router.post('/:playerId/resolve', async (req, res) => {
  try {
    const game = getActiveGame(req.params.playerId);
    const resolution = engine.resolveGame(game);
    const summary = await persistFinishedGame(game, resolution);
    return res.json({ game: sanitizeGame(game), resolution, summary });
  } catch (err) {
    return handleEngineError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Saves the finished game to the database and updates the player's balance.
 * Also clears the game from the in-memory active games map.
 */
async function persistFinishedGame(game, resolution = null) {
  const balanceBefore = game.balance - (resolution ? resolution.totalDelta : 0);
  const totalBet = game.hands.reduce((sum, h) => sum + h.bet, 0);

  let totalWon = 0;
  let totalLost = 0;
  if (resolution && resolution.handSummaries) {
    for (const h of resolution.handSummaries) {
      if (h.net > 0) totalWon += h.net;
      if (h.net < 0) totalLost += Math.abs(h.net);
      if (h.insurance && h.insurance.net > 0) totalWon += h.insurance.net;
      if (h.insurance && h.insurance.net < 0) totalLost += Math.abs(h.insurance.net);
    }
  }

  const netChange = totalWon - totalLost;

  await pool.query(
    `INSERT INTO games
      (player_id, balance_before, balance_after, total_bet, total_won, total_lost, net_change,
       dealer_cards_json, hands_json, surrendered, reveals_used)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      game.playerId,
      balanceBefore,
      game.balance,
      totalBet,
      totalWon,
      totalLost,
      netChange,
      JSON.stringify(game.dealer.cards),
      JSON.stringify(resolution ? resolution.handSummaries : game.hands),
      game.surrenderedAllHands,
      game.revealsUsed,
    ]
  );

  await pool.query(
    `UPDATE players
     SET balance = $1, balance_before_last_game = $2, has_played = true
     WHERE id = $3`,
    [game.balance, balanceBefore, game.playerId]
  );

  activeGames.delete(String(game.playerId));

  return { balanceBefore, balanceAfter: game.balance, totalBet, totalWon, totalLost, netChange };
}

/**
 * Strips the shoe (deck) from the game object before sending it to the client,
 * so the player can never inspect upcoming cards via dev tools network tab.
 */
function sanitizeGame(game) {
  const { shoe, ...rest } = game;
  return { ...rest, cardsRemaining: shoe.length };
}

module.exports = router;
