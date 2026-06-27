// hand.js — Computes the value of a hand (a "deck slot") of cards
const { isFaceCard, faceCardTiebreakValue } = require('./deck');

/**
 * Computes the best possible score for a list of cards (handles Ace 1/11).
 * Returns { score, isSoft, hasJoker }. If the hand contains a joker, score = null.
 */
function computeHandScore(cards) {
  if (cards.some((c) => c.isJoker)) {
    return { score: null, isSoft: false, hasJoker: true };
  }

  let total = 0;
  let aceCount = 0;

  for (const card of cards) {
    if (card.value === 'A') {
      aceCount++;
      total += 11; // start by counting Aces as 11
    } else if (isFaceCard(card)) {
      total += 10;
    } else {
      total += parseInt(card.value, 10);
    }
  }

  // Reduce Aces from 11 to 1 as many times as needed to avoid busting
  let acesAs11 = aceCount;
  while (total > 21 && acesAs11 > 0) {
    total -= 10;
    acesAs11--;
  }

  const isSoft = acesAs11 > 0; // at least one Ace still counts as 11

  return { score: total, isSoft, hasJoker: false };
}

/**
 * Is this hand a Black Jack (Ace + face card, exactly 2 cards)?
 */
function isBlackJack(cards) {
  if (cards.length !== 2) return false;
  if (cards.some((c) => c.isJoker)) return false;
  const hasAce = cards.some((c) => c.value === 'A');
  const hasFace = cards.some((c) => isFaceCard(c));
  return hasAce && hasFace;
}

/**
 * Is this hand a "21 in 2 cards" but NOT a Black Jack
 * (Ace + a card worth 10 that is not a face card, i.e. Ace + 10)
 */
function isTwoCardTwentyOneNonBJ(cards) {
  if (cards.length !== 2) return false;
  if (cards.some((c) => c.isJoker)) return false;
  const { score } = computeHandScore(cards);
  if (score !== 21) return false;
  const hasAce = cards.some((c) => c.value === 'A');
  const hasTen = cards.some((c) => c.value === '10');
  const hasFace = cards.some((c) => isFaceCard(c));
  return hasAce && hasTen && !hasFace;
}

/**
 * Number of face cards in a hand
 */
function countFaceCards(cards) {
  return cards.filter((c) => !c.isJoker && isFaceCard(c)).length;
}

/**
 * Cumulative tiebreak value of the face cards in a hand (J=12, Q=13, K=14)
 */
function faceCardTotalValue(cards) {
  return cards
    .filter((c) => !c.isJoker && isFaceCard(c))
    .reduce((sum, c) => sum + faceCardTiebreakValue(c), 0);
}

/**
 * Are two cards strictly identical (same value AND same suit)?
 * This is required for a split.
 */
function areCardsIdenticalForSplit(cardA, cardB) {
  if (cardA.isJoker || cardB.isJoker) return false;
  return cardA.value === cardB.value && cardA.suit === cardB.suit;
}

module.exports = {
  computeHandScore,
  isBlackJack,
  isTwoCardTwentyOneNonBJ,
  countFaceCards,
  faceCardTotalValue,
  areCardsIdenticalForSplit,
};
