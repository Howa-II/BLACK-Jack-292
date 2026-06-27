// index.js — Entry point for the BLACK JACK 292 server

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const playersRouter = require('./routes/players');
const leaderboardRouter = require('./routes/leaderboard');
const gameRouter = require('./routes/gameRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the frontend (built static files) once it exists in /public
app.use(express.static('public'));

app.use('/api/players', playersRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/game', gameRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', game: 'BLACK JACK 292' });
});

app.listen(PORT, () => {
  console.log(`BLACK JACK 292 server running on port ${PORT}`);
});
