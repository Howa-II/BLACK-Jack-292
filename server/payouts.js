// payouts.js — Win/loss payout calculations
//
// Multiplier summary (applied to the bet amount):
//
// PLAYER WINS
//  - Simple win                          : net +2.5x, total returned = 3.5x bet
//  - 21 with 3+ cards                    : net +3x,   total returned = 4x bet
//  - 21 in 2 cards (Ace+10, not face)    : net +3.5x, total returned = 4.5x bet
//  - Black Jack (Ace + face card)        : net +4x,   total returned = 5x bet
//
// DEALER (MICHAEL) WINS
//  - Simple loss                         : net -1.5x (loses bet + pays 0.5x), returned = 0
//  - Dealer wins with 21                 : net -2x   (loses bet + pays 1x),   returned = 0
//  - Dealer wins with Black Jack         : net -2.5x (loses bet + pays 1.5x), returned = 0
//  - Player busts with a Joker           : net -3x   (loses bet + pays 2x),   returned = 0
//
// PUSH: returned = bet (net 0)
//
// SURRENDER: returned = bet (net 0) — "you keep your 10 but pay 10 back, net 0"
//
// INSURANCE (side bet = half the main bet, called insuranceBet)
//  - Dealer has 21 (not BJ)  : returned = 5x insuranceBet (net +4x insuranceBet)
//  - Dealer has Black Jack   : returned = 6x insuranceBet (net +5x insuranceBet)
//  - Dealer has nothing      : returned = 0 (loses insuranceBet, pays an extra 4.5x, rounded)
//
// NOTE: all amounts are rounded to the nearest whole number.

function roundAmount(amount) {
  return Math.round(amount);
}

const RESULT_TYPES = {
  WIN_SIMPLE: 'WIN_SIMPLE',
  WIN_21_MULTI: 'WIN_21_MULTI', // 21 reached with 3+ cards
  WIN_21_TWO_CARDS: 'WIN_21_TWO_CARDS', // Ace + 10 (not face card), 2 cards
  WIN_BLACKJACK: 'WIN_BLACKJACK', // Ace + face card
  PUSH: 'PUSH',
  LOSE_SIMPLE: 'LOSE_SIMPLE',
  LOSE_DEALER_21: 'LOSE_DEALER_21',
  LOSE_DEALER_BLACKJACK: 'LOSE_DEALER_BLACKJACK',
  LOSE_JOKER: 'LOSE_JOKER',
  SURRENDER: 'SURRENDER',
};

/**
 * Computes the total amount "returned" to the player (including the original bet
 * if won/pushed) for a given hand, based on the result type.
 *
 * @param {string} resultType - one of RESULT_TYPES
 * @param {number} bet - the bet placed on this hand
 * @returns {{ returned: number, net: number }} returned = total amount the player gets back,
 *           net = gain (positive) or loss (negative) relative to the original bet
 */
function calculatePayout(resultType, bet) {
  let returned = 0;

  switch (resultType) {
    case RESULT_TYPES.WIN_SIMPLE:
      returned = bet + bet * 2.5;
      break;
    case RESULT_TYPES.WIN_21_MULTI:
      returned = bet + bet * 3;
      break;
    case RESULT_TYPES.WIN_21_TWO_CARDS:
      returned = bet + bet * 3.5;
      break;
    case RESULT_TYPES.WIN_BLACKJACK:
      returned = bet + bet * 4;
      break;
    case RESULT_TYPES.PUSH:
      returned = bet;
      break;
    case RESULT_TYPES.LOSE_SIMPLE:
    case RESULT_TYPES.LOSE_DEALER_21:
    case RESULT_TYPES.LOSE_DEALER_BLACKJACK:
    case RESULT_TYPES.LOSE_JOKER:
      returned = 0;
      break;
    case RESULT_TYPES.SURRENDER:
      returned = bet;
      break;
    default:
      throw new Error(`Unknown result type: ${resultType}`);
  }

  returned = roundAmount(returned);
  const net = returned - bet;

  // Loss cases: the player loses more than just the bet (an extra penalty is paid).
  let lossExtra = 0;
  if (resultType === RESULT_TYPES.LOSE_SIMPLE) lossExtra = bet * 0.5;
  if (resultType === RESULT_TYPES.LOSE_DEALER_21) lossExtra = bet * 1;
  if (resultType === RESULT_TYPES.LOSE_DEALER_BLACKJACK) lossExtra = bet * 1.5;
  if (resultType === RESULT_TYPES.LOSE_JOKER) lossExtra = bet * 2;

  lossExtra = roundAmount(lossExtra);
  const totalNet = resultType.startsWith('LOSE') ? -(bet + lossExtra) : net;

  return { returned, net: totalNet };
}

/**
 * Computes the insurance side-bet result.
 * @param {string} dealerOutcome - 'BLACKJACK' | '21' | 'NONE'
 * @param {number} insuranceBet - the insurance bet (half the main bet)
 */
function calculateInsurancePayout(dealerOutcome, insuranceBet) {
  if (dealerOutcome === '21') {
    const returned = roundAmount(insuranceBet + insuranceBet * 5);
    return { returned, net: returned - insuranceBet };
  }
  if (dealerOutcome === 'BLACKJACK') {
    const returned = roundAmount(insuranceBet + insuranceBet * 6);
    return { returned, net: returned - insuranceBet };
  }
  // Dealer has nothing: lose the insuranceBet + pay an extra 4.5x
  const lossExtra = roundAmount(insuranceBet * 4.5);
  return { returned: 0, net: -(insuranceBet + lossExtra) };
}

module.exports = {
  RESULT_TYPES,
  calculatePayout,
  calculateInsurancePayout,
  roundAmount,
};
