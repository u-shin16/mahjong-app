'use strict';

const Agari = (() => {
  function canFormSets(tiles) {
    if (tiles.length === 0) return true;
    if (tiles.length % 3 !== 0) return false;

    const sorted = Tiles.sortTiles(tiles);
    const first = sorted[0];
    const rest = sorted.slice(1);

    // Try triplet
    const i1 = rest.findIndex(t => Tiles.isSame(t, first));
    if (i1 !== -1) {
      const rest2 = rest.filter((_, i) => i !== i1);
      const i2 = rest2.findIndex(t => Tiles.isSame(t, first));
      if (i2 !== -1) {
        if (canFormSets(rest2.filter((_, i) => i !== i2))) return true;
      }
    }

    // Try sequence
    const suit = first.suit;
    if (suit !== 'wind' && suit !== 'dragon') {
      const matchColor = suit === 'colored' ? first.color : null;
      const idx2 = rest.findIndex(t => t.suit === suit && t.num === first.num + 1 && (!matchColor || t.color === matchColor));
      if (idx2 !== -1) {
        const rest2 = rest.filter((_, i) => i !== idx2);
        const idx3 = rest2.findIndex(t => t.suit === suit && t.num === first.num + 2 && (!matchColor || t.color === matchColor));
        if (idx3 !== -1) {
          if (canFormSets(rest2.filter((_, i) => i !== idx3))) return true;
        }
      }
    }

    return false;
  }

  function isWinningHand(tiles) {
    if (!tiles || tiles.length < 2) return false;

    // Chiitoitsu (7 pairs) for 14-tile hands
    if (tiles.length === 14) {
      const sorted = Tiles.sortTiles(tiles);
      let pairs = 0;
      const used = new Array(sorted.length).fill(false);
      for (let i = 0; i < sorted.length; i++) {
        if (used[i]) continue;
        for (let j = i + 1; j < sorted.length; j++) {
          if (!used[j] && Tiles.isSame(sorted[i], sorted[j])) {
            pairs++;
            used[j] = true;
            break;
          }
        }
      }
      if (pairs === 7) return true;
    }

    // Standard: try each pair as head
    const sorted = Tiles.sortTiles(tiles);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (Tiles.isSame(sorted[i], sorted[i + 1])) {
        const remaining = sorted.filter((_, idx) => idx !== i && idx !== i + 1);
        if (canFormSets(remaining)) return true;
        // skip duplicates
        while (i + 2 < sorted.length && Tiles.isSame(sorted[i], sorted[i + 2])) i++;
      }
    }

    return false;
  }

  // For num-only tiles (Chapter 1): hand is array of numbers
  function isWinningNums(nums) {
    const tiles = nums.map((n, i) => ({ suit: 'num', num: n, id: `n${i}` }));
    return isWinningHand(tiles);
  }

  // Check if a single number tile added to 13-tile hand makes it win
  function numHandWaitsFor(hand13nums) {
    const waits = [];
    for (let n = 1; n <= 9; n++) {
      if (isWinningNums([...hand13nums, n])) waits.push(n);
    }
    return waits;
  }

  function getTenpaiWaits(tiles13) {
    const waits = [];
    const allSuits = ['man', 'pin', 'sou'];
    const maxN = { man: 9, pin: 9, sou: 9, wind: 4, dragon: 3 };

    for (const suit of allSuits) {
      for (let n = 1; n <= 9; n++) {
        const test = { suit, num: n, id: 'test_wait' };
        if (isWinningHand([...tiles13, test])) {
          waits.push({ suit, num: n });
        }
      }
    }
    for (let n = 1; n <= 4; n++) {
      const test = { suit: 'wind', num: n, id: 'test_wait' };
      if (isWinningHand([...tiles13, test])) waits.push({ suit: 'wind', num: n });
    }
    for (let n = 1; n <= 3; n++) {
      const test = { suit: 'dragon', num: n, id: 'test_wait' };
      if (isWinningHand([...tiles13, test])) waits.push({ suit: 'dragon', num: n });
    }
    return waits;
  }

  return { isWinningHand, isWinningNums, numHandWaitsFor, getTenpaiWaits, canFormSets };
})();
