// deck.js — Card shoe management
// 4 suits (clubs, hearts, diamonds, spades) x 13 values x 12 copies = 624 cards
// + 48 Jokers
// Total: 672 cards

const SUITS = ['clubs', 'hearts', 'diamonds', 'spades'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const COPIES_PER_CARD = 12;
const JOKER_COUNT = 48;

/**
 * Creates a full shuffled shoe of 672 cards.
 * Each card is an object: { id, suit, value, isJoker }
 */
function createShoe() {
  const cards = [];
  let idCounter = 0;

  for (const suit of SUITS) {
    for (const value of VALUES) {
      for (let copy = 0; copy < COPIES_PER_CARD; copy++) {
        cards.push({
          id: `c${idCounter++}`,
          suit,
          value,
          isJoker: false,
        });
      }
    }
  }

  for (let j = 0; j < JOKER_COUNT; j++) {
    cards.push({
      id: `j${idCounter++}`,
      suit: null,
      value: 'JOKER',
      isJoker: true,
    });
  }

  return shuffle(cards);
}

/**
 * Shuffles an array of cards (Fisher-Yates)
 */
function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Base point value of a card (Ace = 1 by default, adjusted dynamically in hand.js)
 */
function baseCardPoints(card) {
  if (card.isJoker) return null; // a joker has no point value; it causes an instant loss
  if (card.value === 'A') return 1;
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  return parseInt(card.value, 10);
}

/**
 * Is this card a "face card" (J, Q, K)?
 */
function isFaceCard(card) {
  return ['J', 'Q', 'K'].includes(card.value);
}

/**
 * Tiebreak value of a face card (used to resolve pushes)
 * Jack = 12, Queen = 13, King = 14
 */
function faceCardTiebreakValue(card) {
  const map = { J: 12, Q: 13, K: 14 };
  return map[card.value] || 0;
}

module.exports = {
  SUITS,
  VALUES,
  COPIES_PER_CARD,
  JOKER_COUNT,
  createShoe,
  shuffle,
  baseCardPoints,
  isFaceCard,
  faceCardTiebreakValue,
};
