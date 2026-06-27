// cardAssets.js — Maps every card to its visual asset (browser script, no bundler).
//
// Non-Ace cards (2..K) are cropped from the single sheet image (card_sheet.png)
// using CSS background-position percentages. Aces, the Joker, and all card
// backs are separate standalone image files.

(function () {
  const SHEET_COLUMNS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SHEET_ROWS = ['spades', 'hearts', 'clubs', 'diamonds']; // top-to-bottom order in card_sheet.png

  const SHEET_COLS_COUNT = SHEET_COLUMNS.length; // 12
  const SHEET_ROWS_COUNT = SHEET_ROWS.length; // 4

  function getSheetPosition(suit, value) {
    const colIndex = SHEET_COLUMNS.indexOf(value);
    const rowIndex = SHEET_ROWS.indexOf(suit);
    if (colIndex === -1 || rowIndex === -1) return null;

    const xPercent = (colIndex / (SHEET_COLS_COUNT - 1)) * 100;
    const yPercent = (rowIndex / (SHEET_ROWS_COUNT - 1)) * 100;

    return {
      backgroundImage: 'url(/assets/cards/card_sheet.png)',
      backgroundSize: `${SHEET_COLS_COUNT * 100}% ${SHEET_ROWS_COUNT * 100}%`,
      backgroundPosition: `${xPercent}% ${yPercent}%`,
    };
  }

  const ACE_FACES = {
    spades: '/assets/cards/ace_spades.png',
    hearts: '/assets/cards/ace_hearts.png',
    clubs: '/assets/cards/ace_clubs.png',
    diamonds: '/assets/cards/ace_diamonds.png',
  };

  const ACE_BACK = '/assets/cards/ace_back.png';

  const SUIT_BACKS = {
    spades: '/assets/cards/back_spades.png',
    hearts: '/assets/cards/back_hearts.png',
    clubs: '/assets/cards/back_clubs.png',
    diamonds: '/assets/cards/back_diamonds.png',
  };

  const JOKER_FACE = '/assets/cards/joker_face_star.png';
  const JOKER_BACK = '/assets/cards/joker_back.png';

  /**
   * Returns a description of how to render a given card.
   * @param {{ isJoker: boolean, suit: string|null, value: string }} card
   * @param {boolean} hidden - whether the card is currently face-down
   * @returns {{ type: 'image'|'sprite', src?: string, style?: object }}
   */
  function getCardVisual(card, hidden) {
    if (card.isJoker) {
      return { type: 'image', src: hidden ? JOKER_BACK : JOKER_FACE };
    }
    if (card.value === 'A') {
      return { type: 'image', src: hidden ? ACE_BACK : ACE_FACES[card.suit] };
    }
    if (hidden) {
      return { type: 'image', src: SUIT_BACKS[card.suit] };
    }
    return { type: 'sprite', style: getSheetPosition(card.suit, card.value) };
  }

  /**
   * Applies the visual to a DOM element (a <div class="card">).
   */
  function renderCardOnElement(el, card, hidden) {
    const visual = getCardVisual(card, hidden);
    el.style.backgroundImage = '';
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';

    if (visual.type === 'image') {
      el.style.backgroundImage = `url(${visual.src})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    } else if (visual.type === 'sprite' && visual.style) {
      el.style.backgroundImage = visual.style.backgroundImage;
      el.style.backgroundSize = visual.style.backgroundSize;
      el.style.backgroundPosition = visual.style.backgroundPosition;
    }
  }

  window.CardAssets = {
    getCardVisual,
    renderCardOnElement,
    SHEET_COLUMNS,
    SHEET_ROWS,
  };
})();
