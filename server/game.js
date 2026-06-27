// game.js — Main game engine for "BLACK JACK 292"
// Implements the full custom ruleset:
// 7 starting hands (slots), hidden/revealed cards with a 4-reveal quota per game,
// hit/stand/double/split/insurance/surrender, and the full payout resolution.

const { createShoe } = require('./deck');
const {
  computeHandScore,
  isBlackJack,
  isTwoCardTwentyOneNonBJ,
  countFaceCards,
  faceCardTotalValue,
  areCardsIdenticalForSplit,
} = require('./hand');
const { RESULT_TYPES, calculatePayout, calculateInsurancePayout } = require('./payouts');

const STARTING_HANDS = 7;
const MAX_HITS_PER_HAND = 3;
const MAX_VOLUNTARY_REVEALS = 4;
const MAX_SPECIAL_ACTIONS = 1;

function createGame(playerId, startingBalance) {
  const shoe = createShoe();
  const hands = [];
  for (let i = 0; i < STARTING_HANDS; i++) hands.push(createEmptyHand(i));

  return {
    playerId,
    shoe,
    balance: startingBalance,
    hands,
    dealer: { cards: [], revealed: false },
    revealsUsed: 0,
    doubleUsed: false,
    insuranceUsed: false,
    surrenderUsed: false,
    surrenderedAllHands: false,
    phase: 'BETTING',
    log: [],
  };
}

function createEmptyHand(index) {
  return {
    index,
    cards: [],
    bet: 0,
    insuranceBet: 0,
    status: 'ACTIVE',
    isSplitHand: false,
    splitFromIndex: null,
    doubledDown: false,
    finished: false,
    result: null,
  };
}

function drawCard(game) {
  if (game.shoe.length === 0) throw new Error('Shoe is empty — this should never happen.');
  return game.shoe.pop();
}

// ---------------------------------------------------------------------------
// BETTING PHASE
// ---------------------------------------------------------------------------

function placeBet(game, handIndex, amount) {
  if (game.phase !== 'BETTING') throw new Error('Bets can only be placed during the betting phase.');
  const hand = game.hands[handIndex];
  if (!hand) throw new Error('Invalid hand index.');
  hand.bet = amount;
}

function dealFirstCard(game) {
  if (game.phase !== 'BETTING') throw new Error('Wrong phase for dealing.');
  for (const hand of game.hands) {
    const card = drawCard(game);
    hand.cards.push({ card, hidden: true });
  }
  game.dealer.cards.push(drawCard(game));
  game.phase = 'REVEAL_DECISION_1';
}

function decideRevealFirstCard(game, handIndex, reveal) {
  if (game.phase !== 'REVEAL_DECISION_1') throw new Error('Wrong phase.');
  const hand = game.hands[handIndex];
  if (reveal) {
    if (game.revealsUsed >= MAX_VOLUNTARY_REVEALS) {
      throw new Error('No more voluntary reveals available (max 4 per game).');
    }
    hand.cards[0].hidden = false;
    game.revealsUsed++;
  }
}

function dealSecondCard(game) {
  if (game.phase !== 'REVEAL_DECISION_1') throw new Error('Wrong phase for dealing.');
  for (const hand of game.hands) {
    const card = drawCard(game);
    hand.cards.push({ card, hidden: true });
  }
  game.dealer.cards.push(drawCard(game));
  game.phase = 'REVEAL_DECISION_2';
}

function decideRevealSecondCard(game, handIndex, reveal) {
  if (game.phase !== 'REVEAL_DECISION_2') throw new Error('Wrong phase.');
  const hand = game.hands[handIndex];
  const firstCardRevealed = !hand.cards[0].hidden;

  if (reveal && !firstCardRevealed) {
    throw new Error('Cannot reveal the second card if the first card was not revealed.');
  }
  if (reveal) {
    if (game.revealsUsed >= MAX_VOLUNTARY_REVEALS) {
      throw new Error('No more voluntary reveals available (max 4 per game).');
    }
    hand.cards[1].hidden = false;
    game.revealsUsed++;
  }
}

function finalizeRevealDecisions(game) {
  if (game.phase !== 'REVEAL_DECISION_2') throw new Error('Wrong phase.');
  game.phase = 'PLAYER_TURN';
  checkAutoOutcomesForAllHands(game);
}

// ---------------------------------------------------------------------------
// AUTO-OUTCOMES (21, bust, joker)
// ---------------------------------------------------------------------------

function forceRevealHand(hand) {
  for (const entry of hand.cards) entry.hidden = false;
}

function checkHandAutoOutcome(hand) {
  if (hand.finished) return true;

  const cards = hand.cards.map((e) => e.card);
  const lastCard = cards[cards.length - 1];

  if (lastCard.isJoker) {
    forceRevealHand(hand);
    hand.status = 'JOKER_LOSS';
    hand.finished = true;
    hand.result = RESULT_TYPES.LOSE_JOKER;
    return true;
  }

  const { score } = computeHandScore(cards);

  if (score === 21) {
    forceRevealHand(hand);
    hand.status = 'WIN21';
    hand.finished = true;
    return true;
  }

  if (score > 21) {
    forceRevealHand(hand);
    hand.status = 'BUST';
    hand.finished = true;
    hand.result = RESULT_TYPES.LOSE_SIMPLE;
    return true;
  }

  return false;
}

function checkAutoOutcomesForAllHands(game) {
  for (const hand of game.hands) {
    if (!hand.finished && hand.cards.length > 0) checkHandAutoOutcome(hand);
  }
}

// ---------------------------------------------------------------------------
// PLAYER ACTIONS
// ---------------------------------------------------------------------------

function assertPlayableHand(game, handIndex) {
  if (game.phase !== 'PLAYER_TURN') throw new Error('Wrong phase for player actions.');
  const hand = game.hands[handIndex];
  if (!hand) throw new Error('Invalid hand index.');
  if (hand.finished) throw new Error('This hand is already finished.');
  return hand;
}

function hit(game, handIndex) {
  const hand = assertPlayableHand(game, handIndex);
  const hitsSoFar = hand.cards.length - 2;
  if (hitsSoFar >= MAX_HITS_PER_HAND) throw new Error('Maximum of 3 hits per hand reached.');
  const card = drawCard(game);
  hand.cards.push({ card, hidden: true, fromHit: true });
  checkHandAutoOutcome(hand);
}

function stand(game, handIndex) {
  const hand = assertPlayableHand(game, handIndex);
  hand.status = 'STANDING';
  hand.finished = true;
}

function doubleDown(game, handIndex) {
  const hand = assertPlayableHand(game, handIndex);
  if (game.doubleUsed) throw new Error('Double Down already used this game (limit: once per game).');
  if (!hand.cards[1].hidden) throw new Error('Cannot double down if the second card is revealed.');

  game.doubleUsed = true;
  hand.bet *= 2;
  hand.doubledDown = true;

  const card = drawCard(game);
  hand.cards.push({ card, hidden: true, fromHit: true, fromDouble: true });
  checkHandAutoOutcome(hand);

  if (!hand.finished) {
    hand.status = 'STANDING';
    hand.finished = true;
  }
}

function checkAndApplySplit(game, handIndex) {
  const hand = game.hands[handIndex];
  if (hand.cards.length !== 2) return null;

  const [first, second] = hand.cards.map((e) => e.card);
  if (!areCardsIdenticalForSplit(first, second)) return null;

  hand.cards[0].hidden = false;
  hand.cards[1].hidden = false;

  const newHand = createEmptyHand(game.hands.length);
  newHand.bet = hand.bet;
  newHand.isSplitHand = true;
  newHand.splitFromIndex = handIndex;
  newHand.cards.push({ card: second, hidden: false });

  hand.cards = [{ card: first, hidden: false }];
  hand.isSplitHand = true;

  const newCardForOriginal = drawCard(game);
  hand.cards.push({ card: newCardForOriginal, hidden: true, fromSplit: true });

  const newCardForNew = drawCard(game);
  newHand.cards.push({ card: newCardForNew, hidden: true, fromSplit: true });

  game.hands.push(newHand);

  checkHandAutoOutcome(hand);
  checkHandAutoOutcome(newHand);

  return newHand;
}

function placeInsurance(game, handIndex) {
  const hand = assertPlayableHand(game, handIndex);
  if (game.insuranceUsed) throw new Error('Insurance already used this game (limit: once per game).');
  const dealerUpCard = game.dealer.cards[0];
  if (dealerUpCard.value !== 'A') throw new Error('Insurance is only available when the dealer shows an Ace.');
  if (!hand.cards[1].hidden) throw new Error('Cannot place insurance if the second card is revealed.');

  game.insuranceUsed = true;
  hand.insuranceBet = Math.round(hand.bet / 2);
}

function surrenderAllHands(game) {
  if (game.surrenderUsed) throw new Error('Surrender already used this game (limit: once per game).');
  if (game.phase !== 'PLAYER_TURN') {
    throw new Error('Surrender can only be used right after the reveal-decision window closes.');
  }

  game.surrenderUsed = true;
  game.surrenderedAllHands = true;

  for (const hand of game.hands) {
    hand.status = 'SURRENDERED';
    hand.finished = true;
    hand.result = RESULT_TYPES.SURRENDER;
  }

  game.phase = 'RESOLVED';
}

// ---------------------------------------------------------------------------
// DEALER RESOLUTION
// ---------------------------------------------------------------------------

function resolveDealer(game) {
  game.dealer.revealed = true;
  while (true) {
    const cards = game.dealer.cards;
    if (cards.some((c) => c.isJoker)) break;
    const { score } = computeHandScore(cards);
    if (score === null || score >= 17) break;
    game.dealer.cards.push(drawCard(game));
  }
}

function getDealerOutcome(game) {
  const cards = game.dealer.cards;
  if (cards.some((c) => c.isJoker)) return 'JOKER';
  const { score } = computeHandScore(cards);
  if (score > 21) return 'BUST';
  if (isBlackJack(cards)) return 'BLACKJACK';
  if (score === 21) return '21';
  return 'STANDARD';
}

// ---------------------------------------------------------------------------
// FINAL RESOLUTION
// ---------------------------------------------------------------------------

function resolvePushTiebreak(playerCards, dealerCards) {
  const playerHasFace = countFaceCards(playerCards) > 0;
  const dealerHasFace = countFaceCards(dealerCards) > 0;

  if (playerHasFace && !dealerHasFace) return 'PLAYER';
  if (dealerHasFace && !playerHasFace) return 'DEALER';

  const playerFaceCount = countFaceCards(playerCards);
  const dealerFaceCount = countFaceCards(dealerCards);
  if (playerFaceCount !== dealerFaceCount) {
    return playerFaceCount > dealerFaceCount ? 'PLAYER' : 'DEALER';
  }

  const playerFaceValue = faceCardTotalValue(playerCards);
  const dealerFaceValue = faceCardTotalValue(dealerCards);
  if (playerFaceValue !== dealerFaceValue) {
    return playerFaceValue > dealerFaceValue ? 'PLAYER' : 'DEALER';
  }

  return 'TIE';
}

function pickWinResult(playerCards) {
  if (isBlackJack(playerCards)) return RESULT_TYPES.WIN_BLACKJACK;
  if (isTwoCardTwentyOneNonBJ(playerCards)) return RESULT_TYPES.WIN_21_TWO_CARDS;
  const { score } = computeHandScore(playerCards);
  if (score === 21 && playerCards.length > 2) return RESULT_TYPES.WIN_21_MULTI;
  return RESULT_TYPES.WIN_SIMPLE;
}

function resolveHandResult(hand, game) {
  if (hand.result) return hand.result;

  const playerCards = hand.cards.map((e) => e.card);
  const dealerCards = game.dealer.cards;
  const dealerOutcome = getDealerOutcome(game);
  const { score: playerScore } = computeHandScore(playerCards);

  if (playerScore > 21) {
    hand.result = RESULT_TYPES.LOSE_SIMPLE;
    return hand.result;
  }

  if (dealerOutcome === 'BUST' || dealerOutcome === 'JOKER') {
    hand.result = pickWinResult(playerCards);
    return hand.result;
  }

  const dealerScore = computeHandScore(dealerCards).score;

  if (playerScore > dealerScore) {
    hand.result = pickWinResult(playerCards);
    return hand.result;
  }

  if (dealerScore > playerScore) {
    if (dealerOutcome === 'BLACKJACK') hand.result = RESULT_TYPES.LOSE_DEALER_BLACKJACK;
    else if (dealerOutcome === '21') hand.result = RESULT_TYPES.LOSE_DEALER_21;
    else hand.result = RESULT_TYPES.LOSE_SIMPLE;
    return hand.result;
  }

  const tiebreak = resolvePushTiebreak(playerCards, dealerCards);
  if (tiebreak === 'PLAYER') {
    hand.result = pickWinResult(playerCards);
  } else if (tiebreak === 'DEALER') {
    if (dealerOutcome === 'BLACKJACK') hand.result = RESULT_TYPES.LOSE_DEALER_BLACKJACK;
    else if (dealerOutcome === '21') hand.result = RESULT_TYPES.LOSE_DEALER_21;
    else hand.result = RESULT_TYPES.LOSE_SIMPLE;
  } else {
    hand.result = RESULT_TYPES.PUSH;
  }
  return hand.result;
}

function resolveGame(game) {
  if (game.phase === 'RESOLVED') return summarizeGame(game);

  resolveDealer(game);
  for (const hand of game.hands) forceRevealHand(hand);

  const dealerOutcome = getDealerOutcome(game);
  let totalDelta = 0;
  const handSummaries = [];

  for (const hand of game.hands) {
    if (hand.bet === 0) continue;

    const resultType = resolveHandResult(hand, game);
    const { returned, net } = calculatePayout(resultType, hand.bet);
    totalDelta += net;

    let insuranceSummary = null;
    if (hand.insuranceBet > 0) {
      const insOutcome = dealerOutcome === 'BLACKJACK' ? 'BLACKJACK' : dealerOutcome === '21' ? '21' : 'NONE';
      const insResult = calculateInsurancePayout(insOutcome, hand.insuranceBet);
      totalDelta += insResult.net;
      insuranceSummary = { outcome: insOutcome, ...insResult };
    }

    handSummaries.push({
      handIndex: hand.index,
      resultType,
      bet: hand.bet,
      returned,
      net,
      insurance: insuranceSummary,
      finalCards: hand.cards.map((e) => e.card),
    });
  }

  game.balance += totalDelta;
  game.phase = 'RESOLVED';

  return {
    dealerCards: game.dealer.cards,
    dealerOutcome,
    handSummaries,
    totalDelta,
    newBalance: game.balance,
  };
}

function summarizeGame(game) {
  return {
    dealerCards: game.dealer.cards,
    dealerOutcome: getDealerOutcome(game),
    newBalance: game.balance,
  };
}

module.exports = {
  STARTING_HANDS,
  MAX_HITS_PER_HAND,
  MAX_VOLUNTARY_REVEALS,
  MAX_SPECIAL_ACTIONS,
  createGame,
  placeBet,
  dealFirstCard,
  decideRevealFirstCard,
  dealSecondCard,
  decideRevealSecondCard,
  finalizeRevealDecisions,
  hit,
  stand,
  doubleDown,
  checkAndApplySplit,
  placeInsurance,
  surrenderAllHands,
  resolveGame,
};
