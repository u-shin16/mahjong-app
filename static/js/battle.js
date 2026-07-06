'use strict';

var Battle = (function() {
  var PLAYER_NAMES = ['あなた', 'CPU南', 'CPU西', 'CPU北'];
  var PLAYER_NAME_SETS = {
    3: ['あなた', 'CPU南', 'CPU西'],
    4: ['あなた', 'CPU南', 'CPU西', 'CPU北'],
  };
  var WIND_NAMES = ['東', '南', '西', '北'];
  var WIND_READINGS = ['トン', 'ナン', 'シャー', 'ペー'];

  var state = null;

  function setPlayerNames(playerCount) {
    var names = PLAYER_NAME_SETS[playerCount] || PLAYER_NAME_SETS[4];
    PLAYER_NAMES.splice(0, PLAYER_NAMES.length);
    Array.prototype.push.apply(PLAYER_NAMES, names);
  }

  function makePlayerArray(playerCount, value) {
    var arr = [];
    for (var i = 0; i < playerCount; i++) {
      arr.push(typeof value === 'function' ? value(i) : value);
    }
    return arr;
  }

  function getRoundLimit(gameType, playerCount) {
    return (gameType === 'hanchan' ? 2 : 1) * playerCount;
  }

  function init(opts) {
    opts = opts || {};
    var playerCount = opts.playerCount === 3 ? 3 : 4;
    setPlayerNames(playerCount);
    state = {
      playerCount: playerCount,
      isSanma: playerCount === 3,
      wall: [],
      hands: [],
      discards: [],
      turn: 0,
      round: 1,
      roundLimit: getRoundLimit(opts.gameType, playerCount),
      gameType: opts.gameType || 'tonpu',
      roundWind: 0,
      scores: makePlayerArray(playerCount, playerCount === 3 ? 35000 : 25000),
      doraIndicator: null,
      kanDoraIndicators: [],
      riichi: makePlayerArray(playerCount, false),
      ippatsu: false,
      nuki: makePlayerArray(playerCount, function() { return []; }),
      melds:  makePlayerArray(playerCount, function() { return []; }),
      callPending:    null,   // pending_call 時に鳴き選択肢を保存
      nakiResumeFrom: null,   // 鳴き後の再開CPU番号
      phase: 'drawing',
      winner: -1,
      loser: -1,
      winType: '',
      winTile: null,
      pendingRon: null,
      selectedIdx: -1,
      aiAdvice: '',
      difficulty: opts.difficulty || 'easy',
      settled: false,
      lastScore: null,
    };
    startRound();
  }

  function startRound() {
    var wall = state.isSanma ? Tiles.makeSanmaFull() : Tiles.makeFull();
    var hands = [], discards = [];
    for (var i = 0; i < state.playerCount; i++) {
      hands.push(wall.splice(0, 13));
      discards.push([]);
    }
    state.wall = wall;
    state.hands = hands;
    state.discards = discards;
    state.turn = 0;
    state.roundWind = Math.floor((state.round - 1) / state.playerCount);
    state.doraIndicator = wall.pop();
    state.uraDoraIndicator = wall.pop();   // 裏ドラ表示牌（リーチしてアガったときだけ公開）
    state.riichi           = makePlayerArray(state.playerCount, false);
    state.ippatsu          = false;
    state.nuki             = makePlayerArray(state.playerCount, function() { return []; });
    state.melds            = makePlayerArray(state.playerCount, function() { return []; });
    state.callPending      = null;
    state.nakiResumeFrom   = null;
    state.kanDoraIndicators = [];
    state.phase = 'drawing';
    state.winner = -1;
    state.loser = -1;
    state.winType = '';
    state.winTile = null;
    state.pendingRon = null;
    state.selectedIdx = -1;
    state.aiAdvice = '';
    state.settled = false;
    state.lastScore = null;
    state.riichiWaits = [];
    state.drewTile = null;
    drawForPlayer();
  }

  function drawForPlayer() {
    if (state.wall.length === 0) { state.phase = 'ryukyoku'; return; }
    var t = state.wall.pop();
    state.hands[0].push(t);
    state.drewTile = t.id;
    state.phase = 'player_turn';
  }

  function getRoundLabel() {
    if (!state) return '東1局';
    var wind = WIND_NAMES[Math.min(state.roundWind, WIND_NAMES.length - 1)];
    var num = ((state.round - 1) % state.playerCount) + 1;
    return wind + num + '局';
  }

  function nextRound() {
    if (!state) return false;
    if (state.round >= state.roundLimit) {
      state.phase = 'match_end';
      return false;
    }
    state.round++;
    startRound();
    return true;
  }

  // 表示牌からドラ本体を求める（9→1、北→東、中→白と一周する）
  function doraFromIndicator(ind) {
    if (!ind) return null;
    var s = ind.suit, n = ind.num;
    if (s === 'wind')   return Tiles.make('wind',   n === 4 ? 1 : n + 1);
    if (s === 'dragon') return Tiles.make('dragon', n === 3 ? 1 : n + 1);
    return Tiles.make(s, n === 9 ? 1 : n + 1);
  }

  function getDora() {
    return doraFromIndicator(state.doraIndicator);
  }

  function countDora(hand) {
    var dora = getDora();
    if (!dora) return 0;
    return hand.filter(function(t) { return Tiles.isSame(t, dora); }).length;
  }

  function isNukiTile(tile) {
    return !!(state && state.isSanma && tile && tile.suit === 'wind' && tile.num === 4);
  }

  function findNukiIdx(pidx) {
    if (!state || !state.hands[pidx]) return -1;
    for (var i = 0; i < state.hands[pidx].length; i++) {
      if (isNukiTile(state.hands[pidx][i])) return i;
    }
    return -1;
  }

  function drawReplacement(pidx) {
    if (state.wall.length === 0) {
      state.phase = 'ryukyoku';
      return null;
    }
    var replacement = state.wall.pop();
    state.hands[pidx].push(replacement);
    return replacement;
  }

  function playerNuki(tileIdx) {
    if (!state || !state.isSanma || state.phase !== 'player_turn') return null;
    var idx = typeof tileIdx === 'number' && tileIdx >= 0 ? tileIdx : findNukiIdx(0);
    if (idx < 0 || !isNukiTile(state.hands[0][idx])) return null;

    var tile = state.hands[0].splice(idx, 1)[0];
    state.nuki[0].push(tile);
    var replacement = drawReplacement(0);
    state.drewTile = replacement ? replacement.id : null;
    state.selectedIdx = -1;
    return { tile: tile, replacement: replacement };
  }

  function autoNukiForCPU(pidx) {
    if (!state || !state.isSanma) return 0;
    var count = 0;
    while (state.phase !== 'ryukyoku') {
      var idx = findNukiIdx(pidx);
      if (idx < 0) break;
      state.nuki[pidx].push(state.hands[pidx].splice(idx, 1)[0]);
      count++;
      drawReplacement(pidx);
    }
    return count;
  }

  function getBattleWaits(tiles) {
    var waits = Agari.getTenpaiWaits(tiles);
    if (!state || !state.isSanma) return waits;
    return waits.filter(function(w) {
      return w.suit !== 'man' || w.num === 1 || w.num === 9;
    });
  }

  function calcShanten(tiles) {
    var sorted = Tiles.sortTiles(tiles);
    var n = sorted.length;
    // Estimate shanten with a greedy set-count
    var used = new Array(n).fill(false);
    var sets = 0;

    // Count triplets
    for (var i = 0; i < n; i++) {
      if (used[i]) continue;
      var same = [i];
      for (var j = i + 1; j < n && same.length < 3; j++) {
        if (!used[j] && Tiles.isSame(sorted[i], sorted[j])) same.push(j);
      }
      if (same.length >= 3) { sets++; same.forEach(function(k) { used[k] = true; }); }
    }

    // Count sequences
    for (var i = 0; i < n; i++) {
      if (used[i]) continue;
      var t = sorted[i];
      if (t.suit === 'wind' || t.suit === 'dragon') continue;
      var i2 = -1, i3 = -1;
      for (var j = i + 1; j < n; j++) {
        if (!used[j] && sorted[j].suit === t.suit) {
          if (sorted[j].num === t.num + 1 && i2 < 0) i2 = j;
          else if (sorted[j].num === t.num + 2 && i3 < 0) i3 = j;
        }
      }
      if (i2 >= 0 && i3 >= 0) { sets++; used[i] = used[i2] = used[i3] = true; }
    }

    var needed = Math.ceil(n / 3);
    return Math.max(0, needed - sets - 1);
  }

  function cpuChooseDiscard(pidx) {
    var hand = state.hands[pidx];
    if (state.difficulty === 'easy' && Math.random() < 0.35) {
      return Math.floor(Math.random() * hand.length);
    }
    var best = hand.length - 1, bestSh = 99;
    for (var i = 0; i < hand.length; i++) {
      var rest = hand.filter(function(_, j) { return j !== i; });
      var sh = calcShanten(rest);
      // Prefer to keep useful tiles; discard honors/terminals first if high shanten
      var penalty = 0;
      var t = hand[i];
      if (sh > 2) {
        if (t.suit === 'wind' || t.suit === 'dragon') penalty = -1;
        else if (t.num === 1 || t.num === 9) penalty = -0.5;
      }
      if (state.difficulty === 'hard' && Tiles.isSame(t, getDora())) penalty += 1.5;
      var score = sh + penalty;
      if (score < bestSh) { bestSh = score; best = i; }
    }
    return best;
  }

  function playerDiscard(tileIdx) {
    var discarded = state.hands[0].splice(tileIdx, 1)[0];
    state.discards[0].push(discarded);
    state.selectedIdx = -1;
    state.drewTile = null;

    // リーチ中のツモ切りで一発消滅
    if (state.ippatsu && state.riichi[0]) {
      state.ippatsu = false;
    }

    // CPU ロンチェック
    for (var i = 1; i < state.playerCount; i++) {
      var test = state.hands[i].slice();
      test.push(discarded);
      if (Agari.isWinningHand(test)) {
        state.hands[i].push(discarded);
        state.winner = i; state.loser = 0;
        state.winType = 'ron'; state.winTile = discarded;
        state.phase = 'end';
        return;
      }
    }

    // CPU 鳴きチェック（リーチ中は相手に鳴かれない）
    if (!state.riichi[0]) {
      for (var ci = 1; ci < state.playerCount; ci++) {
        var cpuCall = cpuDecideCall(ci, discarded, 0);
        if (cpuCall) {
          cpuExecuteCall(ci, cpuCall, discarded, 0);
          cpuDiscardAfterNaki(ci);
          if (state.phase === 'end' || state.phase === 'ryukyoku') return;
          runCPUTurns(ci + 1);
          return;
        }
      }
    }

    runCPUTurns();
  }

  // 鳴き後に手番を持ったプレイヤーが捨て牌するフェーズ
  function playerDiscardNaki(tileIdx) {
    if (!state || state.phase !== 'naki_discard') return;
    var resumeFrom = state.nakiResumeFrom;
    state.nakiResumeFrom = null;

    var discarded = state.hands[0].splice(tileIdx, 1)[0];
    state.discards[0].push(discarded);
    state.selectedIdx = -1;
    state.drewTile = null;
    state.ippatsu = false; // 鳴き後は一発なし

    // CPU ロンチェック
    for (var i = 1; i < state.playerCount; i++) {
      var test = state.hands[i].slice();
      test.push(discarded);
      if (Agari.isWinningHand(test)) {
        state.hands[i].push(discarded);
        state.winner = i; state.loser = 0;
        state.winType = 'ron'; state.winTile = discarded;
        state.phase = 'end';
        return;
      }
    }

    // CPU 鳴きチェック
    for (var ci = 1; ci < state.playerCount; ci++) {
      var cpuCall = cpuDecideCall(ci, discarded, 0);
      if (cpuCall) {
        cpuExecuteCall(ci, cpuCall, discarded, 0);
        cpuDiscardAfterNaki(ci);
        if (state.phase === 'end' || state.phase === 'ryukyoku') return;
        runCPUTurns(ci + 1);
        return;
      }
    }

    runCPUTurns(resumeFrom !== null ? resumeFrom : undefined);
  }

  function playerTsumo() {
    state.winner = 0;
    state.loser = -1;
    state.winType = 'tsumo';
    state.winTile = state.hands[0][state.hands[0].length - 1];
    state.phase = 'end';
  }

  function playerRiichi(tileIdx) {
    state.riichi[0] = true;
    state.scores[0] -= 1000;
    // リーチ宣言牌のインデックスを記録（捨てた後の discards 長さ = インデックス）
    state.riichiDiscardIdx = state.discards[0].length;
    // 捨てた後の13枚で待ち牌を計算して保存
    var afterDiscard = state.hands[0].filter(function(_, i) { return i !== tileIdx; });
    state.riichiWaits = getBattleWaits(afterDiscard);
    playerDiscard(tileIdx);
    // リーチ宣言牌の捨て後に一発フラグをセット
    // （playerDiscard内でippatsuリセットを試みるが、宣言時はfalseのため影響なし）
    if (state.phase !== 'end') {
      state.ippatsu = true;
    }
  }

  // テンパイできるかつ、どの牌を切ればテンパイかを返す（リーチ候補牌のactual index一覧）
  function getRiichiCandidates() {
    if (!state || state.riichi[0] || state.scores[0] < 1000) return [];
    var candidates = [];
    state.hands[0].forEach(function(_, i) {
      var test = state.hands[0].filter(function(_, j) { return j !== i; });
      if (getBattleWaits(test).length > 0) candidates.push(i);
    });
    return candidates;
  }

  function playerRonAccept() {
    if (!state.pendingRon) return;
    state.hands[0].push(state.pendingRon.tile);
    state.winner = 0;
    state.loser = state.pendingRon.from;
    state.winType = 'ron';
    state.winTile = state.pendingRon.tile;
    state.phase = 'end';
    state.pendingRon = null;
  }

  function playerRonSkip() {
    var nextCpu = state.pendingRon ? state.pendingRon.from + 1 : state.playerCount;
    state.pendingRon = null;
    if (nextCpu >= state.playerCount) drawForPlayer();
    else runCPUTurns(nextCpu);
  }

  function runCPUTurns(startIdx) {
    for (var pidx = startIdx || 1; pidx < state.playerCount; pidx++) {
      if (state.wall.length === 0) { state.phase = 'ryukyoku'; return; }

      var drew = state.wall.pop();
      state.hands[pidx].push(drew);
      autoNukiForCPU(pidx);
      if (state.phase === 'ryukyoku') return;

      // CPU 暗カンチェック
      var cpuAnkans = cpuCheckAnkan(pidx);
      if (cpuAnkans.length > 0 && Math.random() < 0.6) {
        cpuExecuteAnkan(pidx, cpuAnkans[0]);
        if (state.phase === 'ryukyoku') return;
        // 嶺上ツモ
        drew = state.wall.pop();
        if (!drew) { state.phase = 'ryukyoku'; return; }
        state.hands[pidx].push(drew);
      }

      // CPU ツモ和了チェック
      if (Agari.isWinningHand(state.hands[pidx])) {
        state.winner = pidx;
        state.loser = -1;
        state.winType = 'tsumo';
        state.winTile = drew;
        state.phase = 'end';
        return;
      }

      var di = cpuChooseDiscard(pidx);
      var disc = state.hands[pidx].splice(di, 1)[0];
      state.discards[pidx].push(disc);

      // プレイヤー ロンチェック
      var playerTest = state.hands[0].slice();
      playerTest.push(disc);
      if (Agari.isWinningHand(playerTest)) {
        state.pendingRon = { tile: disc, from: pidx };
        state.phase = 'pending_ron';
        return;
      }

      // プレイヤー 鳴きチェック（リーチ中は鳴けない）
      if (!state.riichi[0]) {
        var callOpts = getPlayerCallOptions(disc, pidx);
        if (callOpts.length > 0) {
          state.callPending = { tile: disc, fromPlayer: pidx, nextCPUIdx: pidx + 1, options: callOpts };
          state.phase = 'pending_call';
          return;
        }
      }

      // CPU が他CPUに鳴けるかチェック
      for (var other = 1; other < state.playerCount; other++) {
        if (other === pidx) continue;
        var otherCall = cpuDecideCall(other, disc, pidx);
        if (otherCall) {
          cpuExecuteCall(other, otherCall, disc, pidx);
          cpuDiscardAfterNaki(other);
          if (state.phase === 'end' || state.phase === 'ryukyoku') return;
          // 鳴いたCPUの次から再開
          runCPUTurns(other + 1 < state.playerCount ? other + 1 : undefined);
          return;
        }
      }
    }
    drawForPlayer();
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //   鳴き / カン 関連関数
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // player0 が `tile` (fromPlayer が捨てた牌) を鳴ける選択肢を返す
  function getPlayerCallOptions(tile, fromPlayerIdx) {
    if (!state || !tile) return [];
    var hand = state.hands[0];
    var opts  = [];

    // 同じ牌を手牌から探す
    var same = hand.filter(function(t) { return Tiles.isSame(t, tile); });

    // ポン: 2枚以上
    if (same.length >= 2) {
      opts.push({ type: 'pon', tiles: same.slice(0, 2), calledTile: tile, fromPlayer: fromPlayerIdx });
    }
    // 大明カン: 3枚
    if (same.length >= 3) {
      opts.push({ type: 'kan', tiles: same.slice(0, 3), calledTile: tile, fromPlayer: fromPlayerIdx });
    }
    // チー: 四人麻雀のみ、上家(最後のCPU)からのみ、数牌のみ
    var upstream = state.playerCount - 1;
    if (!state.isSanma && fromPlayerIdx === upstream) {
      var suit = tile.suit, num = tile.num;
      if (suit !== 'wind' && suit !== 'dragon') {
        for (var offset = -2; offset <= 0; offset++) {
          var trio = [num + offset, num + offset + 1, num + offset + 2];
          if (trio[0] < 1 || trio[2] > 9) continue;
          var need = trio.filter(function(n) { return n !== num; });
          var usedIdxs = [], ok = true;
          for (var ni = 0; ni < need.length; ni++) {
            var found = -1;
            for (var hi = 0; hi < hand.length; hi++) {
              if (usedIdxs.indexOf(hi) < 0 && hand[hi].suit === suit && hand[hi].num === need[ni]) {
                found = hi; break;
              }
            }
            if (found < 0) { ok = false; break; }
            usedIdxs.push(found);
          }
          if (ok) {
            opts.push({ type: 'chi', tiles: usedIdxs.map(function(i) { return hand[i]; }),
                        calledTile: tile, fromPlayer: fromPlayerIdx });
          }
        }
      }
    }
    return opts;
  }

  // player0 の暗カン候補を返す
  function checkAnkan() {
    if (!state || state.phase !== 'player_turn') return [];
    var hand = state.hands[0];
    var cnt = {};
    hand.forEach(function(t) {
      var k = t.suit + '_' + t.num;
      if (!cnt[k]) cnt[k] = { tile: t, arr: [] };
      cnt[k].arr.push(t);
    });
    var res = [];
    Object.keys(cnt).forEach(function(k) {
      if (cnt[k].arr.length >= 4) res.push({ type: 'ankan', tiles: cnt[k].arr });
    });
    return res;
  }

  // カン後のドラ追加 (嶺上牌も山の末尾から取る簡易実装)
  function addKanDora() {
    if (state.wall.length > 1) {
      // 山の先頭をカンドラ表示に追加
      var ind = state.wall.shift();
      state.kanDoraIndicators.push(ind);
    }
  }

  // 嶺上牌をツモ
  function drawRinshanForPlayer() {
    if (state.wall.length === 0) { state.phase = 'ryukyoku'; return false; }
    var t = state.wall.pop();
    state.hands[0].push(t);
    state.drewTile = t.id;
    state.phase = 'player_turn';
    return true;
  }

  // ポン実行
  function playerPon(calledTile, fromPlayerIdx) {
    if (!state) return false;
    var hand = state.hands[0];
    var same = hand.filter(function(t) { return Tiles.isSame(t, calledTile); });
    if (same.length < 2) return false;
    var use = same.slice(0, 2);
    use.forEach(function(u) {
      var idx = hand.findIndex(function(t) { return t.id === u.id; });
      if (idx >= 0) hand.splice(idx, 1);
    });
    state.melds[0].push({ type: 'pon', tiles: [use[0], use[1], calledTile],
                           calledTile: calledTile, fromPlayer: fromPlayerIdx });
    state.callPending    = null;
    state.nakiResumeFrom = fromPlayerIdx + 1 < state.playerCount ? fromPlayerIdx + 1 : null;
    state.ippatsu        = false;
    state.phase          = 'naki_discard';
    return true;
  }

  // チー実行
  function playerChi(calledTile, fromPlayerIdx, tilesFromHand) {
    if (!state || state.isSanma) return false;
    var hand = state.hands[0];
    if (!tilesFromHand || tilesFromHand.length < 2) return false;
    tilesFromHand.forEach(function(u) {
      var idx = hand.findIndex(function(t) { return t.id === u.id; });
      if (idx >= 0) hand.splice(idx, 1);
    });
    var all3 = [tilesFromHand[0], tilesFromHand[1], calledTile]
                 .sort(function(a, b) { return a.num - b.num; });
    state.melds[0].push({ type: 'chi', tiles: all3, calledTile: calledTile, fromPlayer: fromPlayerIdx });
    state.callPending    = null;
    state.nakiResumeFrom = fromPlayerIdx + 1 < state.playerCount ? fromPlayerIdx + 1 : null;
    state.ippatsu        = false;
    state.phase          = 'naki_discard';
    return true;
  }

  // 大明カン実行
  function playerKan(calledTile, fromPlayerIdx) {
    if (!state) return false;
    var hand = state.hands[0];
    var same = hand.filter(function(t) { return Tiles.isSame(t, calledTile); });
    if (same.length < 3) return false;
    var use = same.slice(0, 3);
    use.forEach(function(u) {
      var idx = hand.findIndex(function(t) { return t.id === u.id; });
      if (idx >= 0) hand.splice(idx, 1);
    });
    state.melds[0].push({ type: 'kan', tiles: [use[0], use[1], use[2], calledTile],
                           calledTile: calledTile, fromPlayer: fromPlayerIdx });
    addKanDora();
    state.callPending = null;
    state.ippatsu     = false;
    return drawRinshanForPlayer();
  }

  // 暗カン実行
  function playerAnkan(tileToKan) {
    if (!state || state.phase !== 'player_turn') return false;
    var hand = state.hands[0];
    var same = hand.filter(function(t) { return Tiles.isSame(t, tileToKan); });
    if (same.length < 4) return false;
    same.forEach(function(u) {
      var idx = hand.findIndex(function(t) { return t.id === u.id; });
      if (idx >= 0) hand.splice(idx, 1);
    });
    state.melds[0].push({ type: 'ankan', tiles: same, calledTile: null, fromPlayer: -1 });
    addKanDora();
    state.ippatsu = false;
    return drawRinshanForPlayer();
  }

  // スキップ（鳴かない）
  function skipCall() {
    if (!state || !state.callPending) return;
    var nextIdx = state.callPending.nextCPUIdx;
    state.callPending = null;
    state.phase = 'drawing';
    if (nextIdx < state.playerCount) {
      runCPUTurns(nextIdx);
    } else {
      drawForPlayer();
    }
  }

  // ── CPU 鳴き判定 ──────────────────────────────────────────────

  // CPUが鳴くべきか判断して鳴き種別を返す（null = 鳴かない）
  function cpuDecideCall(pidx, tile, fromPlayerIdx) {
    if (!state) return null;
    var hand = state.hands[pidx];

    // 大明カン (3枚持ち)
    var same = hand.filter(function(t) { return Tiles.isSame(t, tile); });
    if (same.length >= 3 && Math.random() < 0.5) return 'kan';

    // ポン (2枚持ち): 役牌は積極的に、それ以外は30%
    if (same.length >= 2) {
      var isYaku = (tile.suit === 'dragon') ||
        (tile.suit === 'wind' && (tile.num === (state.roundWind + 1) || tile.num === (pidx + 1)));
      if (isYaku || Math.random() < 0.3) return 'pon';
    }

    // チー: 四人麻雀のみ、上家からのみ、20%の確率
    var upstream = pidx === 0 ? state.playerCount - 1 : pidx - 1;
    if (!state.isSanma && fromPlayerIdx === upstream && Math.random() < 0.2) {
      if (tile.suit !== 'wind' && tile.suit !== 'dragon') {
        // チーできる組み合わせがあれば
        var suit = tile.suit, num = tile.num;
        for (var off = -2; off <= 0; off++) {
          var trio = [num+off, num+off+1, num+off+2];
          if (trio[0] < 1 || trio[2] > 9) continue;
          var need = trio.filter(function(n){ return n !== num; });
          var ok = need.every(function(n) {
            return hand.some(function(t) { return t.suit === suit && t.num === n; });
          });
          if (ok) return 'chi';
        }
      }
    }

    return null;
  }

  // CPU が鳴き処理を実行
  function cpuExecuteCall(pidx, callType, tile, fromPlayerIdx) {
    if (!state) return;
    var hand = state.hands[pidx];
    var same = hand.filter(function(t) { return Tiles.isSame(t, tile); });

    if (callType === 'kan' && same.length >= 3) {
      same.slice(0,3).forEach(function(u) {
        var idx = hand.findIndex(function(t){ return t.id === u.id; });
        if (idx >= 0) hand.splice(idx, 1);
      });
      state.melds[pidx].push({ type:'kan', tiles:[same[0],same[1],same[2],tile],
                                calledTile:tile, fromPlayer:fromPlayerIdx });
      addKanDora();
    } else if (callType === 'pon' && same.length >= 2) {
      var use = same.slice(0,2);
      use.forEach(function(u) {
        var idx = hand.findIndex(function(t){ return t.id === u.id; });
        if (idx >= 0) hand.splice(idx, 1);
      });
      state.melds[pidx].push({ type:'pon', tiles:[use[0],use[1],tile],
                                calledTile:tile, fromPlayer:fromPlayerIdx });
    } else if (callType === 'chi' && !state.isSanma) {
      // チーに使う2枚を探す
      var suit = tile.suit, num = tile.num;
      for (var off = -2; off <= 0; off++) {
        var trio = [num+off, num+off+1, num+off+2];
        if (trio[0] < 1 || trio[2] > 9) continue;
        var need = trio.filter(function(n){ return n !== num; });
        var usedIdxs = [], ok = true;
        for (var ni = 0; ni < need.length; ni++) {
          var fi = hand.findIndex(function(t, idx) {
            return usedIdxs.indexOf(idx) < 0 && t.suit === suit && t.num === need[ni];
          });
          if (fi < 0) { ok = false; break; }
          usedIdxs.push(fi);
        }
        if (ok) {
          var useTiles = usedIdxs.map(function(i){ return hand[i]; });
          usedIdxs.sort(function(a,b){return b-a;}).forEach(function(i){ hand.splice(i,1); });
          var all3 = [useTiles[0], useTiles[1], tile].sort(function(a,b){ return a.num-b.num; });
          state.melds[pidx].push({ type:'chi', tiles:all3, calledTile:tile, fromPlayer:fromPlayerIdx });
          break;
        }
      }
    }
  }

  // CPU の暗カン候補
  function cpuCheckAnkan(pidx) {
    var hand = state.hands[pidx];
    var cnt = {};
    hand.forEach(function(t) {
      var k = t.suit+'_'+t.num;
      if (!cnt[k]) cnt[k] = { tile:t, arr:[] };
      cnt[k].arr.push(t);
    });
    var res = [];
    Object.keys(cnt).forEach(function(k){
      if (cnt[k].arr.length >= 4) res.push(cnt[k].arr);
    });
    return res;
  }

  function cpuExecuteAnkan(pidx, tiles) {
    var hand = state.hands[pidx];
    tiles.forEach(function(u) {
      var idx = hand.findIndex(function(t){ return t.id === u.id; });
      if (idx >= 0) hand.splice(idx, 1);
    });
    state.melds[pidx].push({ type:'ankan', tiles:tiles, calledTile:null, fromPlayer:-1 });
    addKanDora();
    // 嶺上牌を引く
    if (state.wall.length > 0) {
      var t = state.wall.pop();
      state.hands[pidx].push(t);
    } else {
      state.phase = 'ryukyoku';
    }
  }

  // CPU が鳴いた後に1枚捨てる
  function cpuDiscardAfterNaki(pidx) {
    if (state.phase === 'end' || state.phase === 'ryukyoku') return;
    var di = cpuChooseDiscard(pidx);
    var disc = state.hands[pidx].splice(di, 1)[0];
    state.discards[pidx].push(disc);
    // プレイヤー ロン確認
    var playerTest = state.hands[0].slice();
    playerTest.push(disc);
    if (Agari.isWinningHand(playerTest)) {
      state.pendingRon = { tile: disc, from: pidx };
      state.phase = 'pending_ron';
    }
  }

  function calcScore() {
    if (state.winner < 0) return null;
    var hand = state.hands[state.winner];
    var dora = countDora(hand);
    var nuki = state.nuki && state.nuki[state.winner] ? state.nuki[state.winner].length : 0;
    // カンドラ（手牌にカンドラが含まれる場合）
    var kanDora = 0;
    if (state.kanDoraIndicators && state.kanDoraIndicators.length > 0) {
      state.kanDoraIndicators.forEach(function(ind) {
        var kd = doraFromIndicator(ind);
        kanDora += hand.filter(function(t) { return Tiles.isSame(t, kd); }).length;
      });
    }

    // 裏ドラ（リーチしてアガった人だけ数えられる）
    var uraDora = 0;
    if (state.riichi[state.winner] && state.uraDoraIndicator) {
      var ura = doraFromIndicator(state.uraDoraIndicator);
      uraDora = hand.filter(function(t) { return Tiles.isSame(t, ura); }).length;
    }
    // 役の内訳を組み立てる（合計翻＝内訳の合計になるよう一本化）
    var w = state.winner;
    var isPlayer = w === 0;
    var isTsumo = state.winType === 'tsumo';
    var ippatsu = !!(state.ippatsu && isPlayer && state.riichi[0]);
    var yaku = [];

    if (state.riichi[w]) yaku.push({ name: '立直', reading: 'リーチ', han: 1 });
    if (ippatsu)         yaku.push({ name: '一発', reading: 'イッパツ', han: 1 });
    if (isTsumo && isPlayer) yaku.push({ name: '門前清自摸和', reading: 'メンゼンツモ', han: 1 });
    // 役が一つも無い場合のみ「役あり」を1つ補填（簡易エンジンのため役なしを避ける）
    if (yaku.length === 0) yaku.push({ name: '役あり', reading: 'やくあり', han: 1 });

    // ドラ系（役とは別だが翻として加算）
    if (dora > 0)    yaku.push({ name: 'ドラ',     reading: 'ドラ',     han: dora });
    if (kanDora > 0) yaku.push({ name: 'カンドラ', reading: 'カンドラ', han: kanDora });
    if (uraDora > 0) yaku.push({ name: '裏ドラ',   reading: 'ウラドラ', han: uraDora });
    if (nuki > 0)    yaku.push({ name: '抜き北',   reading: 'ヌキペー', han: nuki });

    var han = yaku.reduce(function(acc, y) { return acc + y.han; }, 0);

    var baseScores = [1000, 2000, 3900, 7700, 8000, 12000, 16000];
    var pts = baseScores[Math.min(han - 1, baseScores.length - 1)];
    var label = han >= 5 ? '満貫' : han + '翻';

    return { han: han, dora: dora, nuki: nuki, kanDora: kanDora, uraDora: uraDora,
             pts: pts, label: label, yaku: yaku, ippatsu: ippatsu };
  }

  function round100(n) {
    return Math.ceil(n / 100) * 100;
  }

  function settleScore() {
    if (!state || state.winner < 0) return null;
    if (state.settled) return state.lastScore;

    var sc = calcScore();
    if (!sc) return null;

    var deltas = makePlayerArray(state.playerCount, 0);
    if (state.winType === 'ron') {
      var loser = state.loser >= 0 ? state.loser : 0;
      deltas[state.winner] += sc.pts;
      deltas[loser] -= sc.pts;
    } else {
      var each = round100(sc.pts / (state.playerCount - 1));
      for (var i = 0; i < state.playerCount; i++) {
        if (i === state.winner) continue;
        deltas[i] -= each;
        deltas[state.winner] += each;
      }
    }

    for (var j = 0; j < state.playerCount; j++) state.scores[j] += deltas[j];
    sc.deltas = deltas;
    state.lastScore = sc;
    state.settled = true;
    return sc;
  }

  function isMatchOver() {
    return !!state && state.round >= state.roundLimit &&
      (state.phase === 'end' || state.phase === 'ryukyoku' || state.phase === 'match_end');
  }

  function getState() { return state; }
  function getDoraTile() { return getDora(); }

  return {
    init: init,
    getState: getState,
    getDoraTile: getDoraTile,
    getRoundLabel: getRoundLabel,
    nextRound: nextRound,
    isMatchOver: isMatchOver,
    countDora: countDora,
    playerDiscard: playerDiscard,
    playerTsumo: playerTsumo,
    playerRiichi: playerRiichi,
    playerRonAccept: playerRonAccept,
    playerRonSkip: playerRonSkip,
    calcScore: calcScore,
    settleScore: settleScore,
    getRiichiCandidates: getRiichiCandidates,
    playerNuki: playerNuki,
    canNuki: function() { return !!(state && state.isSanma && state.phase === 'player_turn' && findNukiIdx(0) >= 0); },
    isNukiTile: isNukiTile,
    canTsumo: function() { return state && Agari.isWinningHand(state.hands[0]); },
    canRiichi: function() {
      if (!state || state.riichi[0] || state.scores[0] < 1000) return false;
      var h = state.hands[0];
      for (var i = 0; i < h.length; i++) {
        var rest = h.filter(function(_, j) { return j !== i; });
        if (getBattleWaits(rest).length > 0) return true;
      }
      return false;
    },
    // 鳴き/カン
    playerDiscardNaki: playerDiscardNaki,
    playerPon:    playerPon,
    playerChi:    playerChi,
    playerKan:    playerKan,
    playerAnkan:  playerAnkan,
    skipCall:     skipCall,
    checkAnkan:   checkAnkan,
    getPlayerCallOptions: getPlayerCallOptions,
    PLAYER_NAMES:  PLAYER_NAMES,
    WIND_NAMES:    WIND_NAMES,
    WIND_READINGS: WIND_READINGS,
  };
})();
