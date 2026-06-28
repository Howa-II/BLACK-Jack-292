// app.js — BLACK JACK 292 frontend logic
(function () {
  const API = '/api';
  let currentPlayer = null; // { id, display_pseudo, display_country, emoji, balance }
  let currentGame = null;
  let selectedChip = null;
  let selectedHandForBet = 0;

  const CHIP_VALUES = [
    1, 5, 10, 15, 20, 25, 30, 40, 50,
    100, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000,
    10000, 50000, 100000, 150000, 200000, 250000, 300000, 400000, 500000,
    1000000, 5000000, 10000000, 15000000, 20000000, 25000000, 30000000, 40000000, 50000000,
    100000000,
  ];

  // ---------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'leaderboard') loadLeaderboard();
    });
  });

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  async function apiCall(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed');
      err.data = data;
      throw err;
    }
    return data;
  }

  function formatMoney(n) {
    return Number(n).toLocaleString('en-US') + ' $';
  }

  function showFormErrors(formEl, errors) {
    const box = formEl.querySelector('.form-errors');
    box.textContent = '';
    if (Array.isArray(errors)) {
      box.textContent = errors.join(' ');
    } else if (typeof errors === 'string') {
      box.textContent = errors;
    }
  }

  // ---------------------------------------------------------------------
  // PROFILE TAB — login / signup
  // ---------------------------------------------------------------------
  const showLoginBtn = document.getElementById('show-login');
  const showSignupBtn = document.getElementById('show-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  showLoginBtn.addEventListener('click', () => {
    showLoginBtn.classList.add('active');
    showSignupBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  });

  showSignupBtn.addEventListener('click', () => {
    showSignupBtn.classList.add('active');
    showLoginBtn.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    try {
      const data = await apiCall('POST', '/players/login', {
        display_pseudo: formData.get('display_pseudo'),
        password: formData.get('password'),
      });
      onLoginSuccess(data.player);
    } catch (err) {
      showFormErrors(loginForm, err.message);
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(signupForm);
    const payload = {};
    for (const [key, value] of formData.entries()) payload[key] = value;
    try {
      const data = await apiCall('POST', '/players/signup', payload);
      onLoginSuccess(data.player);
    } catch (err) {
      showFormErrors(signupForm, err.data && err.data.errors ? err.data.errors : err.message);
    }
  });

  function onLoginSuccess(player) {
    currentPlayer = player;
    document.getElementById('profile-logged-out').classList.add('hidden');
    document.getElementById('profile-logged-in').classList.remove('hidden');
    document.getElementById('play-login-gate').classList.add('hidden');
    document.getElementById('play-game').classList.remove('hidden');
    refreshProfileDisplay();
  }

  function refreshProfileDisplay() {
    document.getElementById('profile-display-name').textContent =
      `${currentPlayer.display_pseudo} ${currentPlayer.display_country || ''} ${currentPlayer.emoji || ''}`;
    document.getElementById('profile-balance').textContent = formatMoney(currentPlayer.balance);
    document.getElementById('balance-display').textContent = formatMoney(currentPlayer.balance);
  }

  document.getElementById('btn-logout').addEventListener('click', () => {
    currentPlayer = null;
    currentGame = null;
    document.getElementById('profile-logged-out').classList.remove('hidden');
    document.getElementById('profile-logged-in').classList.add('hidden');
    document.getElementById('play-login-gate').classList.remove('hidden');
    document.getElementById('play-game').classList.add('hidden');
    document.getElementById('balance-display').textContent = '—';
  });

  // ---------------------------------------------------------------------
  // PROFILE TAB — edit flow (Discord-style verify then update)
  // ---------------------------------------------------------------------
  document.getElementById('btn-edit-profile').addEventListener('click', () => {
    document.getElementById('edit-step-1').classList.remove('hidden');
    document.getElementById('edit-step-2').classList.add('hidden');
  });

  document.getElementById('verify-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {};
    for (const [key, value] of formData.entries()) payload[key] = value;
    try {
      await apiCall('POST', `/players/${currentPlayer.id}/verify`, payload);
      document.getElementById('edit-step-1').classList.add('hidden');
      document.getElementById('edit-step-2').classList.remove('hidden');
    } catch (err) {
      showFormErrors(e.target, err.data && err.data.errors ? err.data.errors : err.message);
    }
  });

  document.getElementById('update-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {};
    for (const [key, value] of formData.entries()) {
      if (value) payload[key] = value; // only send non-empty fields
    }
    try {
      const data = await apiCall('PUT', `/players/${currentPlayer.id}`, payload);
      currentPlayer = { ...currentPlayer, ...data.player };
      refreshProfileDisplay();
      document.getElementById('edit-step-2').classList.add('hidden');
    } catch (err) {
      showFormErrors(e.target, err.data && err.data.errors ? err.data.errors : err.message);
    }
  });

  // ---------------------------------------------------------------------
  // CHIP TRAY
  // ---------------------------------------------------------------------
  function renderChipTray() {
    const tray = document.getElementById('chip-tray');
    tray.innerHTML = '';
    CHIP_VALUES.forEach((value) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = value >= 1000000 ? (value / 1000000) + 'M' : value >= 1000 ? (value / 1000) + 'K' : value;
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
        chip.classList.add('selected');
        selectedChip = value;
      });
      tray.appendChild(chip);
    });
  }
  renderChipTray();

  // ---------------------------------------------------------------------
  // GAME TAB
  // ---------------------------------------------------------------------
  document.getElementById('btn-deal-first').addEventListener('click', startNewGameFlow);
  document.getElementById('btn-new-game').addEventListener('click', startNewGameFlow);
  document.getElementById('btn-finalize-reveals').addEventListener('click', finalizeReveals);
  document.getElementById('btn-hit').addEventListener('click', () => handAction('hit'));
  document.getElementById('btn-stand').addEventListener('click', () => handAction('stand'));
  document.getElementById('btn-double').addEventListener('click', () => handAction('double'));
  document.getElementById('btn-split').addEventListener('click', () => handAction('split'));
  document.getElementById('btn-insurance').addEventListener('click', () => handAction('insurance'));
  document.getElementById('btn-surrender').addEventListener('click', surrenderGame);
  document.getElementById('btn-resolve').addEventListener('click', resolveGame);

  async function startNewGameFlow() {
    if (!currentPlayer) return;
    const data = await apiCall('POST', `/game/${currentPlayer.id}/new`);
    currentGame = data.game;

    // Simple default: ask the player for one bet amount, applied to all 7 hands.
    const betAmount = selectedChip || 10;
    for (let i = 0; i < 7; i++) {
      await apiCall('POST', `/game/${currentPlayer.id}/bet`, { handIndex: i, amount: betAmount });
    }
    const dealt = await apiCall('POST', `/game/${currentPlayer.id}/deal-first`);
    currentGame = dealt.game;
    renderGame();
  }

  async function finalizeReveals() {
    const data = await apiCall('POST', `/game/${currentPlayer.id}/finalize-reveals`);
    currentGame = data.game;
    renderGame();
  }

  async function handAction(action) {
    const handIndex = selectedHandForBet;
    const endpointMap = {
      hit: 'hit', stand: 'stand', double: 'double',
      split: 'split', insurance: 'insurance',
    };
    const data = await apiCall('POST', `/game/${currentPlayer.id}/${endpointMap[action]}`, { handIndex });
    currentGame = data.game;
    renderGame();
  }

  async function surrenderGame() {
    const data = await apiCall('POST', `/game/${currentPlayer.id}/surrender`);
    currentGame = data.game;
    currentPlayer.balance = data.summary.balanceAfter;
    refreshProfileDisplay();
    renderGame();
    showResult('Game surrendered. No gain, no loss.');
  }

  async function resolveGame() {
    const data = await apiCall('POST', `/game/${currentPlayer.id}/resolve`);
    currentGame = data.game;
    currentPlayer.balance = data.summary.balanceAfter;
    refreshProfileDisplay();
    renderGame();
    showResult(`Game resolved. Net change: ${data.summary.netChange >= 0 ? '+' : ''}${formatMoney(data.summary.netChange)}`);
  }

  function showResult(text) {
    const banner = document.getElementById('result-banner');
    banner.textContent = text;
    banner.classList.remove('hidden');
  }

  function renderGame() {
    if (!currentGame) return;

    document.getElementById('btn-deal-first').classList.toggle('hidden', currentGame.phase !== 'BETTING');

    const dealerCardsEl = document.getElementById('dealer-cards');
    dealerCardsEl.innerHTML = '';
    currentGame.dealer.cards.forEach((card) => {
      dealerCardsEl.appendChild(buildCardElement(card, !currentGame.dealer.revealed && currentGame.dealer.cards.indexOf(card) > 0));
    });

    const handsArea = document.getElementById('hands-area');
    handsArea.innerHTML = '';
    currentGame.hands.forEach((hand, idx) => {
      const block = document.createElement('div');
      block.className = 'hand-block';
      if (idx === selectedHandForBet) block.style.outline = '2px solid #ffd700';
      block.addEventListener('click', () => { selectedHandForBet = idx; renderGame(); });

      const header = document.createElement('div');
      header.className = 'hand-header';
      header.textContent = `Hand ${idx + 1} — Bet: ${formatMoney(hand.bet)} — ${hand.status}`;
      block.appendChild(header);

      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'hand-container';
      hand.cards.forEach((entry) => {
        cardsContainer.appendChild(buildCardElement(entry.card, entry.hidden));
      });
      block.appendChild(cardsContainer);

      handsArea.appendChild(block);
    });

    const isRevealPhase1 = currentGame.phase === 'REVEAL_DECISION_1';
    const isRevealPhase2 = currentGame.phase === 'REVEAL_DECISION_2';
    const isPlayerTurn = currentGame.phase === 'PLAYER_TURN';
    const isResolved = currentGame.phase === 'RESOLVED';

    document.getElementById('btn-finalize-reveals').classList.toggle('hidden', !(isRevealPhase1 || isRevealPhase2));
    document.getElementById('btn-hit').classList.toggle('hidden', !isPlayerTurn);
    document.getElementById('btn-stand').classList.toggle('hidden', !isPlayerTurn);
    document.getElementById('btn-double').classList.toggle('hidden', !isPlayerTurn);
    document.getElementById('btn-split').classList.toggle('hidden', !isPlayerTurn);
    document.getElementById('btn-insurance').classList.toggle('hidden', !isPlayerTurn);
    document.getElementById('btn-surrender').classList.toggle('hidden', !isPlayerTurn);
    document.getElementById('btn-resolve').classList.toggle('hidden', !isPlayerTurn);
    document.getElementById('btn-new-game').classList.toggle('hidden', !isResolved);

    document.getElementById('reveal-quota').textContent = `Reveals used: ${currentGame.revealsUsed} / 4`;
  }

  function buildCardElement(card, hidden) {
    const el = document.createElement('div');
    el.className = 'card';
    if (window.CardAssets) {
      window.CardAssets.renderCardOnElement(el, card, hidden);
    }
    return el;
  }

  // ---------------------------------------------------------------------
  // LEADERBOARD TAB
  // ---------------------------------------------------------------------
  async function loadLeaderboard() {
    const data = await apiCall('GET', '/leaderboard');
    const rankedEl = document.getElementById('leaderboard-ranked');
    const unrankedEl = document.getElementById('leaderboard-unranked');

    rankedEl.innerHTML = '';
    data.ranked.forEach((p) => {
      rankedEl.appendChild(buildLeaderboardEntry(p, true));
    });

    unrankedEl.innerHTML = '';
    data.unranked.forEach((p) => {
      unrankedEl.appendChild(buildLeaderboardEntry(p, false));
    });
  }

  function buildLeaderboardEntry(player, ranked) {
    const div = document.createElement('div');
    div.className = 'leaderboard-entry';

    const nameLine = document.createElement('div');
    nameLine.className = 'name-line';
    nameLine.textContent = `${player.display_pseudo} ${player.display_country || ''} ${player.emoji || ''}`;
    div.appendChild(nameLine);

    const balanceLine = document.createElement('div');
    balanceLine.className = 'stat-line';
    balanceLine.textContent = `Current balance: ${formatMoney(player.balance)}`;
    div.appendChild(balanceLine);

    if (ranked && player.lastGame) {
      const g = player.lastGame;
      [
        `Balance before last game: ${formatMoney(player.balance_before_last_game)}`,
        `Last bet: ${formatMoney(g.total_bet)}`,
        `Last loss: ${formatMoney(g.total_lost)}`,
        `Last win: ${formatMoney(g.total_won)}`,
        `Net change: ${g.net_change >= 0 ? '+' : ''}${formatMoney(g.net_change)}`,
      ].forEach((text) => {
        const line = document.createElement('div');
        line.className = 'stat-line';
        line.textContent = text;
        div.appendChild(line);
      });

      const historyBtn = document.createElement('button');
      historyBtn.className = 'link-btn';
      historyBtn.textContent = 'View history';
      historyBtn.addEventListener('click', () => openHistory(player.id));
      div.appendChild(historyBtn);
    } else if (!ranked) {
      const line = document.createElement('div');
      line.className = 'stat-line';
      line.textContent = 'No games played yet.';
      div.appendChild(line);
    }

    return div;
  }

  async function openHistory(playerId) {
    const data = await apiCall('GET', `/leaderboard/${playerId}/history`);
    const modal = document.getElementById('history-modal');
    const statsEl = document.getElementById('history-stats');
    const listEl = document.getElementById('history-list');

    statsEl.innerHTML = `
      <p>Total games: ${data.stats.totalGames}</p>
      <p>Wins: ${data.stats.wins} — Losses: ${data.stats.losses} — Pushes: ${data.stats.pushes}</p>
      <p>Win rate: ${data.stats.winRate.toFixed(1)}%</p>
      <p>Total wagered: ${formatMoney(data.stats.totalWagered)}</p>
      <p>Biggest win: ${formatMoney(data.stats.biggestWin)} — Biggest loss: ${formatMoney(data.stats.biggestLoss)}</p>
    `;

    listEl.innerHTML = '';
    data.games.forEach((g) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-entry';
      row.innerHTML = `
        <div class="stat-line">${new Date(g.played_at).toLocaleString()}</div>
        <div class="stat-line">Bet: ${formatMoney(g.total_bet)} — Net: ${g.net_change >= 0 ? '+' : ''}${formatMoney(g.net_change)}</div>
      `;
      const detailBtn = document.createElement('button');
      detailBtn.className = 'link-btn';
      detailBtn.textContent = 'View more';
      detailBtn.addEventListener('click', () => openGameDetail(g.id));
      row.appendChild(detailBtn);
      listEl.appendChild(row);
    });

    modal.classList.remove('hidden');
  }

  document.getElementById('close-history').addEventListener('click', () => {
    document.getElementById('history-modal').classList.add('hidden');
  });

  async function openGameDetail(gameId) {
    const data = await apiCall('GET', `/leaderboard/game/${gameId}`);
    const modal = document.getElementById('game-detail-modal');
    const content = document.getElementById('game-detail-content');
    content.innerHTML = `<pre style="white-space:pre-wrap; font-size:12px;">${JSON.stringify(data.game, null, 2)}</pre>`;
    modal.classList.remove('hidden');
  }

  document.getElementById('close-game-detail').addEventListener('click', () => {
    document.getElementById('game-detail-modal').classList.add('hidden');
  });
})();
