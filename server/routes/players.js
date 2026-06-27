// routes/players.js — Account creation, login, and profile editing
// Profile editing follows a Discord-style flow:
//   1. The user re-enters ALL current info.
//   2. Every field is checked against what's stored.
//   3. If everything matches -> a second screen opens for the new info.
//   4. If something doesn't match -> a precise error per field (e.g. "Error in pseudo").
//
// Uniqueness rule: last_name, first_name, gmail, display_pseudo, and emoji must be
// unique across all players (country and password are excluded from this check).

const express = require('express');
const pool = require('../db/pool');

const router = express.Router();
const STARTING_BALANCE = 72808;

const UNIQUE_FIELDS = ['last_name', 'first_name', 'gmail', 'display_pseudo', 'emoji'];
const FIELD_LABELS = {
  last_name: 'last name',
  first_name: 'first name',
  gmail: 'Gmail address',
  display_pseudo: 'displayed pseudo',
  country: 'country',
  display_country: 'displayed country',
  password: 'password',
  emoji: 'emoji',
};

/**
 * Checks whether any of the unique fields are already used by ANOTHER player
 * (excludeId lets us ignore the current player's own row when editing).
 */
async function findUniquenessConflicts(fields, excludeId = null) {
  const conflicts = [];

  for (const field of UNIQUE_FIELDS) {
    const value = fields[field];
    if (value === undefined || value === null || value === '') continue;

    const query = excludeId
      ? `SELECT id FROM players WHERE ${field} = $1 AND id != $2`
      : `SELECT id FROM players WHERE ${field} = $1`;
    const params = excludeId ? [value, excludeId] : [value];

    const result = await pool.query(query, params);
    if (result.rows.length > 0) {
      conflicts.push(field);
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// POST /api/players/signup
// ---------------------------------------------------------------------------
router.post('/signup', async (req, res) => {
  const {
    last_name,
    first_name,
    gmail,
    display_pseudo,
    country,
    display_country,
    password,
    emoji,
  } = req.body;

  if (!last_name || !first_name || !gmail || !display_pseudo || !country || !display_country || !password) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const conflicts = await findUniquenessConflicts({
      last_name,
      first_name,
      gmail,
      display_pseudo,
      emoji,
    });

    if (conflicts.length > 0) {
      return res.status(409).json({
        errors: conflicts.map((field) => `${FIELD_LABELS[field]} is already used by another player.`),
        fields: conflicts,
      });
    }

    const result = await pool.query(
      `INSERT INTO players
        (last_name, first_name, gmail, display_pseudo, country, display_country, password, emoji, balance, balance_before_last_game, has_played)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,false)
       RETURNING id, display_pseudo, display_country, emoji, balance`,
      [last_name, first_name, gmail, display_pseudo, country, display_country, password, emoji || null, STARTING_BALANCE]
    );

    return res.status(201).json({ player: result.rows[0] });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error during signup.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/players/login
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { display_pseudo, password } = req.body;

  if (!display_pseudo || !password) {
    return res.status(400).json({ error: 'Pseudo and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM players WHERE display_pseudo = $1',
      [display_pseudo]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Error in pseudo: no account found.' });
    }

    const player = result.rows[0];
    if (player.password !== password) {
      return res.status(401).json({ error: 'Error in password.' });
    }

    delete player.password;
    return res.json({ player });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/players/:id/verify  — Step 1 of profile editing: re-enter ALL current info
// Returns per-field errors if anything doesn't match.
// ---------------------------------------------------------------------------
router.post('/:id/verify', async (req, res) => {
  const { id } = req.params;
  const submitted = req.body;

  try {
    const result = await pool.query('SELECT * FROM players WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }

    const player = result.rows[0];
    const errors = [];

    const fieldsToCheck = [
      'last_name', 'first_name', 'gmail', 'display_pseudo',
      'country', 'display_country', 'password', 'emoji',
    ];

    for (const field of fieldsToCheck) {
      const submittedValue = submitted[field] ?? '';
      const storedValue = player[field] ?? '';
      if (String(submittedValue) !== String(storedValue)) {
        errors.push(`Error in ${FIELD_LABELS[field]}.`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ verified: false, errors });
    }

    return res.json({ verified: true });
  } catch (err) {
    console.error('Verify error:', err);
    return res.status(500).json({ error: 'Internal server error during verification.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/players/:id  — Step 2 of profile editing: apply new info
// (Should only be called by the client AFTER /verify succeeded.)
// ---------------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const allowedFields = [
    'last_name', 'first_name', 'gmail', 'display_pseudo',
    'country', 'display_country', 'password', 'emoji',
  ];

  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = $${paramIndex}`);
      values.push(updates[field]);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No fields to update.' });
  }

  try {
    const conflicts = await findUniquenessConflicts(updates, id);
    if (conflicts.length > 0) {
      return res.status(409).json({
        errors: conflicts.map((field) => `${FIELD_LABELS[field]} is already used by another player.`),
        fields: conflicts,
      });
    }

    values.push(id);
    const query = `UPDATE players SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id, display_pseudo, display_country, emoji, balance`;
    const result = await pool.query(query, values);

    return res.json({ player: result.rows[0] });
  } catch (err) {
    console.error('Update error:', err);
    return res.status(500).json({ error: 'Internal server error during update.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/players/:id  — fetch a player's public profile
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, display_pseudo, display_country, emoji, balance, balance_before_last_game, has_played
       FROM players WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found.' });
    return res.json({ player: result.rows[0] });
  } catch (err) {
    console.error('Get player error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
