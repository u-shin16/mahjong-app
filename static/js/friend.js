'use strict';

/* ============================================================
   FriendGame: 友人戦（6桁ルームIDのオンライン対戦）
   ------------------------------------------------------------
   - Firestore の rooms/{ルームID} 1 ドキュメントで部屋を管理
   - 部屋を作った人（ホスト）の端末がゲーム進行役になる
   - ルールは CPU 戦（battle.js）の簡易対局に合わせる
     * 3人打ち / 4人打ち
     * ツモ・ロン・リーチ・ドラ・裏ドラ
     * 三麻の北抜き
     * ポン・チー・カン・暗カン
     * 東風戦（人数ぶんの局）
   ============================================================ */
var FriendGame = (function() {
  var _db = null;
  var _room = null;
  var _game = null;
  var _code = null;
  var _unsub = null;
  var _listeners = [];
  var _lastProcessedSeq = -1;
  var _lastError = null;
  var _heartbeatTimer = null;
  var _hostLoopTimer = null;

  var BASE_SCORES = [1000, 2000, 3900, 7700, 8000, 12000, 16000];
  var CPU_UID_PREFIX = 'cpu:';
  var HEARTBEAT_MS = 4000;
  var DISCONNECT_MS = 15000;
  var HOST_TICK_MS = 700;

  function defaultRules(playerCount) {
    playerCount = playerCount === 3 ? 3 : 4;
    return {
      playerCount: playerCount,
      gameType: 'tonpu',
      startScore: playerCount === 3 ? 35000 : 25000,
      suddenDeath: false,
      baseSeconds: 5,
      reserveSeconds: 20,
    };
  }

  function normalizeRules(rules, playerCount) {
    var base = defaultRules(playerCount);
    rules = rules || {};
    var n = rules.playerCount === 3 ? 3 : (rules.playerCount === 4 ? 4 : base.playerCount);
    var start = parseInt(rules.startScore, 10);
    var baseSec = parseInt(rules.baseSeconds, 10);
    var reserveSec = parseInt(rules.reserveSeconds, 10);
    return {
      playerCount: n,
      gameType: rules.gameType === 'hanchan' ? 'hanchan' : 'tonpu',
      startScore: isFinite(start) && start >= 10000 && start <= 60000 ? start : (n === 3 ? 35000 : 25000),
      suddenDeath: !!rules.suddenDeath,
      baseSeconds: isFinite(baseSec) && baseSec >= 3 && baseSec <= 15 ? baseSec : 5,
      reserveSeconds: isFinite(reserveSec) && reserveSec >= 0 && reserveSec <= 120 ? reserveSec : 20,
    };
  }

  function getRoundLimit(gameType, playerCount) {
    return (gameType === 'hanchan' ? 2 : 1) * playerCount;
  }

  function humanUids(players) {
    return (players || []).filter(function(p) { return !p.isCpu; }).map(function(p) { return p.uid; });
  }

  function isCpuPlayer(p) {
    return !!(p && (p.isCpu || String(p.uid || '').indexOf(CPU_UID_PREFIX) === 0));
  }

  function isCpuSeat(seat) {
    return !!(_room && _room.players && isCpuPlayer(_room.players[seat]));
  }

  function readyMapFor(players, oldMap) {
    var map = {};
    oldMap = oldMap || {};
    (players || []).forEach(function(p) {
      if (!isCpuPlayer(p)) map[p.uid] = !!oldMap[p.uid];
    });
    return map;
  }

  function allPlayersReady(room) {
    if (!room || room.status !== 'waiting') return false;
    var players = room.players || [];
    if (players.length !== room.playerCount) return false;
    var readyMap = room.readyMap || {};
    return players.every(function(p) { return isCpuPlayer(p) || readyMap[p.uid] === true; });
  }

  function randomRoomCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function db() {
    if (!_db) _db = firebase.firestore();
    return _db;
  }
  function ready() {
    return window.Auth && Auth.enabled() && Auth.user();
  }
  function me() { return Auth.user(); }
  function roomRef(code) { return db().collection('rooms').doc(code); }
  function _notify() {
    _listeners.forEach(function(cb) { try { cb(); } catch (e) {} });
  }

  function errorMessage(e) {
    var msg = String((e && e.message) || '');
    if ((e && e.code === 'permission-denied') || msg.indexOf('Missing or insufficient permissions') >= 0) {
      return 'Firestoreのルールで友人戦が許可されていません。Firebase Console の Firestore ルールに firestore.rules の内容を反映してください。';
    }
    return msg || '通信エラーが発生しました';
  }

  function parseGame(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (e) {
      console.warn('game parse error', e);
      return null;
    }
  }

  function normalizeCode(code) {
    return String(code || '').replace(/\D/g, '').slice(0, 6);
  }

  function validateCode(code) {
    if (!code) throw new Error('6桁のルームIDを入力してください');
    if (!/^\d{6}$/.test(code)) throw new Error('ルームIDは6桁の数字で入力してください');
  }

  function playerName(u) {
    return (u.displayName || u.email || 'プレイヤー').slice(0, 24);
  }

  function makeArray(n, value) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(typeof value === 'function' ? value(i) : value);
    return arr;
  }

  function playerUidAt(room, seat) {
    return room && room.players && room.players[seat] ? room.players[seat].uid : null;
  }

  function _sendHeartbeat() {
    if (!_code || !me() || !_room) return;
    if ((_room.playerUids || []).indexOf(me().uid) < 0) return;
    var patch = {};
    patch['presence.' + me().uid] = Date.now();
    roomRef(_code).update(patch)['catch'](function(e) {
      _lastError = e;
    });
  }

  function _startHeartbeat() {
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    _sendHeartbeat();
    _heartbeatTimer = setInterval(_sendHeartbeat, HEARTBEAT_MS);
  }

  function _stopHeartbeat() {
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }

  function _syncHostLoop() {
    var shouldRun = !!(_room && me() && _room.hostUid === me().uid);
    if (shouldRun && !_hostLoopTimer) {
      _hostLoopTimer = setInterval(function() {
        if (_room && _game && _room.hostUid === me().uid) _hostProcess();
      }, HOST_TICK_MS);
    } else if (!shouldRun && _hostLoopTimer) {
      clearInterval(_hostLoopTimer);
      _hostLoopTimer = null;
    }
  }

  /* ---------- 部屋の購読 ---------- */
  function _subscribe(code) {
    _unsubscribe();
    _code = code;
    _startHeartbeat();
    _unsub = roomRef(code).onSnapshot(function(snap) {
      _lastError = null;
      if (!snap.exists) { _room = null; _game = null; _syncHostLoop(); _notify(); return; }
      _room = snap.data();
      _game = parseGame(_room.game);
      _sendHeartbeat();
      _syncHostLoop();
      if (_room.hostUid === me().uid) _hostProcess();
      _notify();
    }, function(e) {
      _lastError = e;
      console.warn('room listen error', e);
      _notify();
    });
  }

  function _unsubscribe() {
    if (_unsub) { _unsub(); _unsub = null; }
    _room = null;
    _game = null;
    _code = null;
    _lastProcessedSeq = -1;
    _stopHeartbeat();
    _syncHostLoop();
  }

  /* ---------- 部屋を作る / 参加する / 退出 ---------- */
  function createRoom(code, playerCount) {
    var u = me();
    code = normalizeCode(code);
    playerCount = playerCount === 3 ? 3 : 4;
    var manualCode = !!code;

    function tryCreate(candidate, remain) {
      validateCode(candidate);
      return roomRef(candidate).get().then(function(snap) {
        if (snap.exists) {
          var d = snap.data();
          if (d.status !== 'ended') {
            if (!manualCode && remain > 0) return tryCreate(randomRoomCode(), remain - 1);
            throw new Error('このルームIDの部屋はすでに使われています。別のIDにしてください');
          }
        }
        var rules = defaultRules(playerCount);
        var players = [{ uid: u.uid, name: playerName(u), isCpu: false }];
        return roomRef(candidate).set({
          code: candidate,
          hostUid: u.uid,
          playerCount: playerCount,
          rules: rules,
          readyMap: readyMapFor(players),
          presence: {},
          status: 'waiting',
          players: players,
          playerUids: [u.uid],
          game: null,
          action: null,
          version: 3,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }).then(function() { _subscribe(candidate); });
    }

    return tryCreate(code || randomRoomCode(), 8);
  }

  function joinRoom(code) {
    var u = me();
    code = normalizeCode(code);
    validateCode(code);

    return db().runTransaction(function(tx) {
      return tx.get(roomRef(code)).then(function(snap) {
        if (!snap.exists) throw new Error('そのルームIDの部屋が見つかりません');
        var d = snap.data();
        d.players = d.players || [];
        d.playerUids = d.playerUids || humanUids(d.players);
        d.readyMap = d.readyMap || {};
        var already = d.players.some(function(p) { return p.uid === u.uid; });
        if (already) return;
        if (d.status !== 'waiting') throw new Error('この部屋はすでに対局中です');
        if (d.players.length >= d.playerCount) throw new Error('この部屋は満員です');
        d.players.push({ uid: u.uid, name: playerName(u), isCpu: false });
        d.playerUids.push(u.uid);
        d.readyMap[u.uid] = false;
        tx.update(roomRef(code), { players: d.players, playerUids: d.playerUids, readyMap: d.readyMap });
      });
    }).then(function() { _subscribe(code); });
  }

  function leaveRoom() {
    var u = me();
    var code = _code;
    var room = _room;
    _unsubscribe();
    _notify();

    if (!code || !room) return Promise.resolve();
    if (room.hostUid === u.uid && room.status !== 'playing') {
      return roomRef(code).delete()['catch'](function() {});
    }
    if (room.status === 'waiting') {
      var rest = (room.players || []).filter(function(p) { return p.uid !== u.uid; });
      var restReady = readyMapFor(rest, room.readyMap);
      return roomRef(code).update({ players: rest, playerUids: humanUids(rest), readyMap: restReady })['catch'](function() {});
    }
    return Promise.resolve();
  }

  function setReady(flag) {
    if (!_room || !_code || !me() || _room.status !== 'waiting') return Promise.resolve();
    var patch = {};
    patch['readyMap.' + me().uid] = !!flag;
    return roomRef(_code).update(patch);
  }

  function updateRules(patch) {
    if (!isHost() || !_room || _room.status !== 'waiting') return Promise.reject(new Error('ホストだけがルールを変更できます'));
    patch = patch || {};
    return db().runTransaction(function(tx) {
      return tx.get(roomRef(_code)).then(function(snap) {
        if (!snap.exists) throw new Error('部屋が見つかりません');
        var d = snap.data();
        if (d.status !== 'waiting') throw new Error('対局中はルールを変更できません');
        var players = d.players || [];
        var currentRules = normalizeRules(d.rules, d.playerCount);
        var nextRules = normalizeRules(Object.assign({}, currentRules, patch), patch.playerCount || d.playerCount);
        var humanCount = players.filter(function(p) { return !isCpuPlayer(p); }).length;
        if (humanCount > nextRules.playerCount) throw new Error('参加中の人数より少ない人数には変更できません');
        players = players.slice(0, nextRules.playerCount);
        tx.update(roomRef(_code), {
          playerCount: nextRules.playerCount,
          rules: nextRules,
          players: players,
          playerUids: humanUids(players),
          readyMap: readyMapFor(players),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
    });
  }

  function addCpu() {
    if (!isHost() || !_room || _room.status !== 'waiting') return Promise.reject(new Error('ホストだけがCPUを追加できます'));
    return db().runTransaction(function(tx) {
      return tx.get(roomRef(_code)).then(function(snap) {
        if (!snap.exists) throw new Error('部屋が見つかりません');
        var d = snap.data();
        var players = d.players || [];
        if (d.status !== 'waiting') throw new Error('対局中はCPUを追加できません');
        if (players.length >= d.playerCount) throw new Error('空き席がありません');
        var seat = players.length;
        players.push({
          uid: CPU_UID_PREFIX + _code + ':' + seat + ':' + Date.now(),
          name: 'CPU' + ['東', '南', '西', '北'][seat],
          isCpu: true,
        });
        tx.update(roomRef(_code), {
          players: players,
          playerUids: humanUids(players),
          readyMap: readyMapFor(players, d.readyMap),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
    });
  }

  function removeCpu(uid) {
    if (!isHost() || !_room || _room.status !== 'waiting') return Promise.reject(new Error('ホストだけがCPUを外せます'));
    return db().runTransaction(function(tx) {
      return tx.get(roomRef(_code)).then(function(snap) {
        if (!snap.exists) throw new Error('部屋が見つかりません');
        var d = snap.data();
        var players = (d.players || []).filter(function(p) { return !(p.uid === uid && isCpuPlayer(p)); });
        tx.update(roomRef(_code), {
          players: players,
          playerUids: humanUids(players),
          readyMap: readyMapFor(players, d.readyMap),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
    });
  }

  /* ---------- 便利関数 ---------- */
  function mySeat() {
    if (!_room || !me()) return -1;
    var uid = me().uid;
    for (var i = 0; i < (_room.players || []).length; i++) {
      if (_room.players[i].uid === uid) return i;
    }
    return -1;
  }

  function isHost() {
    return !!(_room && me() && _room.hostUid === me().uid);
  }

  function isClosed(state, seat) {
    var melds = (state.melds && state.melds[seat]) || [];
    return melds.every(function(m) { return m.type === 'ankan'; });
  }

  function doraFromInd(ind) {
    if (!ind) return null;
    var s = ind.suit, n = ind.num;
    if (s === 'wind')   return { suit: 'wind',   num: n === 4 ? 1 : n + 1 };
    if (s === 'dragon') return { suit: 'dragon', num: n === 3 ? 1 : n + 1 };
    return { suit: s, num: n === 9 ? 1 : n + 1 };
  }

  function sameKind(a, b) {
    return !!(a && b && a.suit === b.suit && a.num === b.num);
  }

  function countMatch(tiles, kind) {
    if (!kind) return 0;
    return (tiles || []).filter(function(t) { return sameKind(t, kind); }).length;
  }

  function getScoringTiles(state, seat) {
    var tiles = (state.hands[seat] || []).slice();
    var melds = (state.melds && state.melds[seat]) || [];
    melds.forEach(function(m) {
      (m.tiles || []).forEach(function(t) { tiles.push(t); });
    });
    return tiles;
  }

  function getValidWaits(state, tiles13) {
    var waits = Agari.getTenpaiWaits(tiles13 || []);
    if (!state || !state.isSanma) return waits;
    return waits.filter(function(w) {
      return w.suit !== 'man' || w.num === 1 || w.num === 9;
    });
  }

  function isTenpai13(tiles13) {
    return getValidWaits(_game, tiles13).length > 0;
  }

  function isNukiTile(state, tile) {
    return !!(state && state.isSanma && tile && tile.suit === 'wind' && tile.num === 4);
  }

  function findNukiIdx(state, seat, tileId) {
    var hand = (state.hands && state.hands[seat]) || [];
    var fallback = -1;
    for (var i = 0; i < hand.length; i++) {
      if (!isNukiTile(state, hand[i])) continue;
      if (tileId && hand[i].id === tileId) return i;
      if (fallback < 0) fallback = i;
    }
    return fallback;
  }

  function checkAnkanCandidates(state, seat) {
    if (!state || state.phase !== 'turn' || state.riichi[seat]) return [];
    var hand = state.hands[seat] || [];
    var cnt = {};
    hand.forEach(function(t) {
      var k = t.suit + '_' + t.num;
      if (!cnt[k]) cnt[k] = { tile: t, arr: [] };
      cnt[k].arr.push(t);
    });
    var res = [];
    Object.keys(cnt).forEach(function(k) {
      if (cnt[k].arr.length >= 4) res.push({ type: 'ankan', tiles: cnt[k].arr.slice(0, 4) });
    });
    return res;
  }

  function defaultAutoFlags(seat) {
    return {
      agari: isCpuSeat(seat),
      tsumogiri: isCpuSeat(seat),
      noCalls: isCpuSeat(seat),
    };
  }

  function ensureRuntimeArrays(state) {
    var n = state.playerCount || 4;
    state.rules = normalizeRules(state.rules, n);
    if (!state.autoFlags || state.autoFlags.length !== n) {
      state.autoFlags = makeArray(n, function(i) { return defaultAutoFlags(i); });
    }
    if (!state.timeBankMs || state.timeBankMs.length !== n) {
      state.timeBankMs = makeArray(n, state.rules.reserveSeconds * 1000);
    }
    if (!state.disconnected || state.disconnected.length !== n) {
      state.disconnected = makeArray(n, false);
    }
  }

  function getAutoFlags(state, seat) {
    ensureRuntimeArrays(state);
    return state.autoFlags[seat] || defaultAutoFlags(seat);
  }

  function seatDisconnected(state, seat) {
    return !!(state && state.disconnected && state.disconnected[seat]);
  }

  function shouldSkipReactions(state, seat) {
    var f = getAutoFlags(state, seat);
    return isCpuSeat(seat) || seatDisconnected(state, seat) || !!f.tsumogiri || !!f.noCalls || !!(state.riichi && state.riichi[seat]);
  }

  function shouldAutoAgari(state, seat) {
    var f = getAutoFlags(state, seat);
    return isCpuSeat(seat) || seatDisconnected(state, seat) || !!f.agari;
  }

  function _startTurnTimer(state, seat) {
    ensureRuntimeArrays(state);
    var now = Date.now();
    var baseMs = state.rules.baseSeconds * 1000;
    var reserveMs = Math.max(0, state.timeBankMs[seat] || 0);
    state.turnTimer = {
      seat: seat,
      phase: state.phase,
      startedAt: now,
      baseMs: baseMs,
      reserveMs: reserveMs,
      deadlineAt: now + baseMs + reserveMs,
      canAutoAt: now + (isCpuSeat(seat) ? 700 : 450),
    };
  }

  function _clearTurnTimer(state) {
    state.turnTimer = null;
  }

  function _consumeTurnTimer(state, seat) {
    ensureRuntimeArrays(state);
    var timer = state.turnTimer;
    if (!timer || timer.seat !== seat) return;
    var usedReserve = Math.max(0, Date.now() - timer.startedAt - timer.baseMs);
    state.timeBankMs[seat] = Math.max(0, timer.reserveMs - usedReserve);
    _clearTurnTimer(state);
  }

  function _findDrawnIdx(state, seat) {
    var hand = (state.hands && state.hands[seat]) || [];
    if (state.drawnId) {
      for (var i = 0; i < hand.length; i++) {
        if (hand[i].id === state.drawnId) return i;
      }
    }
    return hand.length - 1;
  }

  function _cpuChooseDiscard(state, seat) {
    var hand = state.hands[seat] || [];
    var drawn = _findDrawnIdx(state, seat);
    if (state.riichi && state.riichi[seat] && drawn >= 0) return drawn;
    var best = drawn >= 0 ? drawn : Math.max(0, hand.length - 1);
    var bestScore = -999;
    for (var i = 0; i < hand.length; i++) {
      var t = hand[i];
      var score = 0;
      if (t.suit === 'wind' || t.suit === 'dragon') score += 4;
      if (t.suit !== 'wind' && t.suit !== 'dragon' && (t.num === 1 || t.num === 9)) score += 2;
      if (state.drawnId && t.id === state.drawnId) score += 0.8;
      var same = countMatch(hand, t);
      if (same >= 2) score -= 3;
      var dora = doraFromInd(state.doraInd);
      if (sameKind(t, dora)) score -= 5;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  /* ---------- ゲーム状態の生成（ホスト） ---------- */
  function _deal(state) {
    ensureRuntimeArrays(state);
    var wall = state.isSanma ? Tiles.makeSanmaFull() : Tiles.makeFull();
    var n = state.playerCount;
    state.hands = [];
    state.discards = [];
    for (var i = 0; i < n; i++) {
      state.hands.push(Tiles.sortTiles(wall.splice(0, 13)));
      state.discards.push([]);
    }
    state.doraInd = wall.pop();
    state.uraInd = wall.pop();
    state.kanDoraInds = [];
    state.wall = wall;
    state.riichi = makeArray(n, false);
    state.riichiWaits = makeArray(n, function() { return []; });
    state.timeBankMs = makeArray(n, state.rules.reserveSeconds * 1000);
    state.disconnected = makeArray(n, false);
    state.nuki = makeArray(n, function() { return []; });
    state.melds = makeArray(n, function() { return []; });
    state.turn = (state.round - 1) % n;
    state.phase = 'turn';
    state.drawnId = null;
    state.result = null;
    state.ron = null;
    state.call = null;
    state.lastAutoAt = 0;
    _drawFor(state, state.turn);
  }

  function _drawFor(state, seat) {
    if (state.wall.length === 0) {
      state.phase = 'hand_end';
      state.result = { type: 'ryukyoku', deltas: state.scores.map(function() { return 0; }) };
      state.drawnId = null;
      _clearTurnTimer(state);
      return null;
    }
    var t = state.wall.pop();
    state.hands[seat].push(t);
    state.turn = seat;
    state.drawnId = t.id;
    state.phase = 'turn';
    _startTurnTimer(state, seat);
    return t;
  }

  function startGame() {
    if (!isHost() || !_room || (_room.players || []).length !== _room.playerCount) {
      return Promise.reject(new Error('メンバーが揃っていません'));
    }
    if (!allPlayersReady(_room)) {
      return Promise.reject(new Error('全員がReadyになるまで開始できません'));
    }
    var n = _room.playerCount;
    var rules = normalizeRules(_room.rules, n);
    var state = {
      seq: 0,
      playerCount: n,
      isSanma: n === 3,
      rules: rules,
      round: 1,
      roundLimit: getRoundLimit(rules.gameType, n),
      scores: makeArray(n, rules.startScore),
      autoFlags: makeArray(n, function(i) { return defaultAutoFlags(i); }),
      disconnected: makeArray(n, false),
      startedAt: Date.now(),
    };
    _deal(state);
    _lastProcessedSeq = -1;
    return roomRef(_code).update({ status: 'playing', game: JSON.stringify(state), action: null });
  }

  /* ---------- プレイヤーの操作送信 ---------- */
  function sendAction(type, payload) {
    if (!_game || !_code) return Promise.resolve();
    var a = { seq: _game.seq, seat: mySeat(), uid: me().uid, type: type, ts: Date.now() };
    if (payload) Object.keys(payload).forEach(function(k) { a[k] = payload[k]; });
    return roomRef(_code).update({ action: a });
  }

  /* ---------- ホスト側：操作の検証と反映 ---------- */
  function _publish(state) {
    state.seq++;
    return roomRef(_code).update({
      game: JSON.stringify(state),
      status: state.phase === 'match_end' ? 'ended' : 'playing',
    });
  }

  function addKanDora(state) {
    if (!state.kanDoraInds) state.kanDoraInds = [];
    if (state.wall.length > 1) state.kanDoraInds.push(state.wall.shift());
  }

  function _finishHand(state, winner, winType, fromSeat) {
    var hand = state.hands[winner];
    var scoringTiles = getScoringTiles(state, winner);
    var yaku = [];
    var closed = isClosed(state, winner);
    if (state.riichi[winner]) yaku.push({ name: '立直', han: 1 });
    if (winType === 'tsumo' && closed) yaku.push({ name: '門前清自摸和', han: 1 });

    var nuki = state.nuki && state.nuki[winner] ? state.nuki[winner].length : 0;
    var dora = countMatch(scoringTiles, doraFromInd(state.doraInd));
    var kanDora = 0;
    (state.kanDoraInds || []).forEach(function(ind) {
      kanDora += countMatch(scoringTiles, doraFromInd(ind));
    });
    var ura = 0;
    if (state.riichi[winner]) ura = countMatch(scoringTiles, doraFromInd(state.uraInd));

    if (yaku.length === 0) yaku.push({ name: '役あり', han: 1 });
    if (dora > 0) yaku.push({ name: 'ドラ', han: dora });
    if (kanDora > 0) yaku.push({ name: 'カンドラ', han: kanDora });
    if (ura > 0) yaku.push({ name: '裏ドラ', han: ura });
    if (nuki > 0) yaku.push({ name: '抜き北', han: nuki });

    var han = yaku.reduce(function(a, y) { return a + y.han; }, 0);
    var pts = BASE_SCORES[Math.min(Math.max(han, 1) - 1, BASE_SCORES.length - 1)];
    var deltas = state.scores.map(function() { return 0; });
    if (winType === 'ron') {
      deltas[winner] += pts;
      deltas[fromSeat] -= pts;
    } else {
      var each = Math.ceil(pts / (state.playerCount - 1) / 100) * 100;
      for (var i = 0; i < state.playerCount; i++) {
        if (i === winner) continue;
        deltas[i] -= each;
        deltas[winner] += each;
      }
    }
    for (var j = 0; j < state.playerCount; j++) state.scores[j] += deltas[j];

    state.phase = 'hand_end';
    state.result = {
      type: winType,
      winner: winner,
      from: (fromSeat != null ? fromSeat : null),
      yaku: yaku,
      han: han,
      pts: pts,
      deltas: deltas,
      hand: Tiles.sortTiles(hand.slice()),
      melds: (state.melds && state.melds[winner]) || [],
      nuki: state.nuki[winner] || [],
      uraInd: state.riichi[winner] ? state.uraInd : null,
      kanDoraInds: state.kanDoraInds || [],
    };
    state.ron = null;
    state.call = null;
    state.drawnId = null;
    _clearTurnTimer(state);
  }

  function _nextTurn(state, seat) {
    _drawFor(state, (seat + 1) % state.playerCount);
  }

  function getCallOptions(state, seat, tile, fromSeat) {
    if (!state || !tile || state.riichi[seat] || shouldSkipReactions(state, seat)) return [];
    var hand = state.hands[seat] || [];
    var opts = [];
    var same = hand.filter(function(t) { return sameKind(t, tile); });

    if (same.length >= 2) {
      opts.push({ type: 'pon', tiles: same.slice(0, 2), calledTile: tile, fromPlayer: fromSeat });
    }
    if (same.length >= 3) {
      opts.push({ type: 'kan', tiles: same.slice(0, 3), calledTile: tile, fromPlayer: fromSeat });
    }

    var upstream = (seat - 1 + state.playerCount) % state.playerCount;
    if (!state.isSanma && fromSeat === upstream && tile.suit !== 'wind' && tile.suit !== 'dragon') {
      for (var offset = -2; offset <= 0; offset++) {
        var trio = [tile.num + offset, tile.num + offset + 1, tile.num + offset + 2];
        if (trio[0] < 1 || trio[2] > 9) continue;
        var need = trio.filter(function(n) { return n !== tile.num; });
        var usedIdxs = [];
        var ok = true;
        for (var ni = 0; ni < need.length; ni++) {
          var found = -1;
          for (var hi = 0; hi < hand.length; hi++) {
            if (usedIdxs.indexOf(hi) < 0 && hand[hi].suit === tile.suit && hand[hi].num === need[ni]) {
              found = hi;
              break;
            }
          }
          if (found < 0) { ok = false; break; }
          usedIdxs.push(found);
        }
        if (ok) {
          opts.push({
            type: 'chi',
            tiles: usedIdxs.map(function(i) { return hand[i]; }),
            calledTile: tile,
            fromPlayer: fromSeat,
          });
        }
      }
    }
    return opts;
  }

  function buildCallMap(state, fromSeat, tile) {
    var map = {};
    for (var i = 0; i < state.playerCount; i++) {
      if (i === fromSeat) continue;
      var opts = getCallOptions(state, i, tile, fromSeat);
      if (opts.length > 0) map[i] = opts;
    }
    return map;
  }

  function callCandidates(callMap) {
    return Object.keys(callMap || {}).map(function(k) { return parseInt(k, 10); });
  }

  function hasCallOptions(callMap) {
    return callCandidates(callMap).length > 0;
  }

  function _setCallWait(state, tile, fromSeat, callMap) {
    _clearTurnTimer(state);
    state.phase = 'call_wait';
    state.call = {
      tile: tile,
      from: fromSeat,
      optionsBySeat: callMap,
      candidates: callCandidates(callMap),
      responses: {},
    };
  }

  function _afterDiscard(state, seat, tile) {
    _clearTurnTimer(state);
    state.ron = null;
    state.call = null;

    var ronCandidates = [];
    for (var i = 0; i < state.playerCount; i++) {
      if (i === seat) continue;
      if (Agari.isWinningHand((state.hands[i] || []).concat([tile]))) ronCandidates.push(i);
    }
    var callMap = buildCallMap(state, seat, tile);

    if (ronCandidates.length > 0) {
      var autoWinner = ronCandidates.find(function(c) { return shouldAutoAgari(state, c); });
      if (autoWinner != null) {
        state.hands[autoWinner] = Tiles.sortTiles(state.hands[autoWinner].concat([tile]));
        _finishHand(state, autoWinner, 'ron', seat);
        return;
      }
      state.phase = 'ron_wait';
      state.ron = {
        tile: tile,
        from: seat,
        candidates: ronCandidates,
        responses: {},
        callOptionsBySeat: callMap,
      };
      return;
    }

    if (hasCallOptions(callMap)) {
      _setCallWait(state, tile, seat, callMap);
      return;
    }

    _nextTurn(state, seat);
  }

  function removeTilesByIds(hand, tiles) {
    (tiles || []).forEach(function(u) {
      var idx = hand.findIndex(function(t) { return t.id === u.id; });
      if (idx >= 0) hand.splice(idx, 1);
    });
  }

  function _executeCall(state, seat, optionIdx, callType) {
    if (!state.call || state.call.candidates.indexOf(seat) < 0) return false;
    var opts = getCallOptions(state, seat, state.call.tile, state.call.from);
    var opt = opts[optionIdx];
    if (!opt || opt.type !== callType) return false;

    var hand = state.hands[seat];
    removeTilesByIds(hand, opt.tiles);

    var meldTiles = opt.tiles.concat([state.call.tile]);
    if (opt.type === 'chi') meldTiles = meldTiles.slice().sort(function(a, b) { return a.num - b.num; });
    state.melds[seat].push({
      type: opt.type,
      tiles: meldTiles,
      calledTile: state.call.tile,
      fromPlayer: state.call.from,
    });

    state.turn = seat;
    state.drawnId = null;
    state.ron = null;
    state.call = null;
    if (opt.type === 'kan') {
      addKanDora(state);
      _drawFor(state, seat);
    } else {
      state.phase = 'naki_discard';
      _startTurnTimer(state, seat);
    }
    return true;
  }

  function _executeAnkan(state, seat, tileKind) {
    if (state.phase !== 'turn' || seat !== state.turn || state.riichi[seat]) return false;
    var cands = checkAnkanCandidates(state, seat);
    var cand = null;
    for (var i = 0; i < cands.length; i++) {
      if (sameKind(cands[i].tiles[0], tileKind)) { cand = cands[i]; break; }
    }
    if (!cand) return false;
    _consumeTurnTimer(state, seat);
    removeTilesByIds(state.hands[seat], cand.tiles);
    state.melds[seat].push({ type: 'ankan', tiles: cand.tiles, calledTile: null, fromPlayer: -1 });
    addKanDora(state);
    _drawFor(state, seat);
    return true;
  }

  function _executeNuki(state, seat, tileId) {
    if (!state.isSanma || state.phase !== 'turn' || seat !== state.turn) return false;
    _consumeTurnTimer(state, seat);
    var idx = findNukiIdx(state, seat, tileId);
    if (idx < 0) return false;
    var tile = state.hands[seat].splice(idx, 1)[0];
    state.nuki[seat].push(tile);

    var ronCandidates = [];
    for (var i = 0; i < state.playerCount; i++) {
      if (i === seat) continue;
      if (Agari.isWinningHand((state.hands[i] || []).concat([tile]))) ronCandidates.push(i);
    }
    if (ronCandidates.length > 0) {
      var autoWinner = ronCandidates.find(function(c) { return shouldAutoAgari(state, c); });
      if (autoWinner != null) {
        state.hands[autoWinner] = Tiles.sortTiles(state.hands[autoWinner].concat([tile]));
        _finishHand(state, autoWinner, 'ron', seat);
        state.result.yaku = (state.result.yaku || []).filter(function(y) { return y.name !== '槍槓'; });
        return true;
      }
      _clearTurnTimer(state);
      state.phase = 'ron_wait';
      state.ron = {
        tile: tile,
        from: seat,
        candidates: ronCandidates,
        responses: {},
        callOptionsBySeat: {},
        isYarikita: true,
      };
      return true;
    }

    _drawFor(state, seat);
    return true;
  }

  function _discard(state, seat, idx, riichi) {
    if ((state.phase !== 'turn' && state.phase !== 'naki_discard') || seat !== state.turn) return false;
    if (riichi && state.phase !== 'turn') return false;
    var hand = state.hands[seat];
    if (idx == null || idx < 0 || idx >= hand.length) return false;
    var tile = hand[idx];

    if (state.riichi[seat] && tile.id !== state.drawnId) return false;
    _consumeTurnTimer(state, seat);
    if (riichi) {
      var rest = hand.filter(function(_, i) { return i !== idx; });
      var waits = getValidWaits(state, rest);
      if (state.riichi[seat] || !isClosed(state, seat) || waits.length === 0 || state.scores[seat] < 1000) return false;
      state.riichi[seat] = true;
      state.riichiWaits[seat] = waits;
      state.scores[seat] -= 1000;
    }

    hand.splice(idx, 1);
    state.hands[seat] = Tiles.sortTiles(hand);
    tile.riichiDiscard = !!riichi;
    state.discards[seat].push(tile);
    state.drawnId = null;
    _afterDiscard(state, seat, tile);
    return true;
  }

  function _syncDisconnects(state) {
    ensureRuntimeArrays(state);
    var changed = false;
    var now = Date.now();
    var presence = (_room && _room.presence) || {};
    var players = (_room && _room.players) || [];
    for (var i = 0; i < state.playerCount; i++) {
      var p = players[i];
      var disconnected = false;
      if (p && !isCpuPlayer(p)) {
        var last = presence[p.uid] || state.startedAt || now;
        disconnected = (now - last) > DISCONNECT_MS;
      }
      if (state.disconnected[i] !== disconnected) {
        state.disconnected[i] = disconnected;
        changed = true;
      }
    }
    return changed;
  }

  function _advanceRoundOrEnd(state) {
    var rules = normalizeRules(state.rules, state.playerCount);
    if (state.round >= state.roundLimit) {
      if (!rules.suddenDeath) {
        state.phase = 'match_end';
        return;
      }
      var target = Math.max(rules.startScore + 5000, state.playerCount === 3 ? 40000 : 30000);
      var top = Math.max.apply(null, state.scores || []);
      if (top >= target) {
        state.phase = 'match_end';
        return;
      }
      state.roundLimit += state.playerCount;
    }
    state.round++;
    _deal(state);
  }

  function _resolveRonPasses(state) {
    var from = state.ron.from;
    var tile = state.ron.tile;
    var callMap = state.ron.callOptionsBySeat || {};
    state.ron = null;
    if (hasCallOptions(callMap)) _setCallWait(state, tile, from, callMap);
    else _nextTurn(state, from);
  }

  function _hostTick(state) {
    if (!state || state.phase === 'hand_end' || state.phase === 'match_end') return false;
    ensureRuntimeArrays(state);
    var changed = _syncDisconnects(state);
    var now = Date.now();

    if (state.phase === 'ron_wait' && state.ron) {
      for (var r = 0; r < state.ron.candidates.length; r++) {
        var rc = state.ron.candidates[r];
        if (shouldAutoAgari(state, rc)) {
          state.hands[rc] = Tiles.sortTiles(state.hands[rc].concat([state.ron.tile]));
          _finishHand(state, rc, 'ron', state.ron.from);
          return true;
        }
      }
      state.ron.candidates.forEach(function(c) {
        if (shouldSkipReactions(state, c) && state.ron.responses[c] !== 'pass') {
          state.ron.responses[c] = 'pass';
          changed = true;
        }
      });
      if (state.ron.candidates.every(function(c) { return state.ron.responses[c] === 'pass'; })) {
        _resolveRonPasses(state);
        return true;
      }
      return changed;
    }

    if (state.phase === 'call_wait' && state.call) {
      state.call.candidates.forEach(function(c) {
        if (shouldSkipReactions(state, c) && state.call.responses[c] !== 'pass') {
          state.call.responses[c] = 'pass';
          changed = true;
        }
      });
      if (state.call.candidates.every(function(c) { return state.call.responses[c] === 'pass'; })) {
        var fromSeat = state.call.from;
        state.call = null;
        _nextTurn(state, fromSeat);
        return true;
      }
      return changed;
    }

    if ((state.phase === 'turn' || state.phase === 'naki_discard') && state.turn != null) {
      var seat = state.turn;
      if (!state.turnTimer || state.turnTimer.seat !== seat) {
        _startTurnTimer(state, seat);
        changed = true;
      }
      var timer = state.turnTimer;
      var flags = getAutoFlags(state, seat);
      var canWin = state.phase === 'turn' && Agari.isWinningHand(state.hands[seat] || []);
      if (canWin && shouldAutoAgari(state, seat) && now >= timer.canAutoAt) {
        _consumeTurnTimer(state, seat);
        _finishHand(state, seat, 'tsumo', null);
        return true;
      }
      if (state.phase === 'turn' && state.isSanma && isCpuSeat(seat)) {
        var nukiIdx = findNukiIdx(state, seat, null);
        if (nukiIdx >= 0 && now >= timer.canAutoAt) {
          _executeNuki(state, seat, (state.hands[seat] || [])[nukiIdx].id);
          return true;
        }
      }
      var autoDiscard = isCpuSeat(seat) || seatDisconnected(state, seat) || !!flags.tsumogiri || (!!state.riichi[seat] && !canWin);
      var dueAuto = autoDiscard && now >= timer.canAutoAt;
      var dueTimeout = now >= timer.deadlineAt;
      if (dueAuto || dueTimeout) {
        var idx = isCpuSeat(seat) && !dueTimeout ? _cpuChooseDiscard(state, seat) : _findDrawnIdx(state, seat);
        _discard(state, seat, idx, false);
        return true;
      }
    }

    return changed;
  }

  function _hostProcess() {
    var state = _game;
    if (!state || !_room) return;
    var a = _room.action;
    var ok = false;
    var processedAction = false;

    if (a && a.seq === state.seq && a.seq > _lastProcessedSeq &&
        a.seat != null && a.seat >= 0 && a.seat < state.playerCount &&
        playerUidAt(_room, a.seat) === a.uid) {
      var seat = a.seat;

      if (a.type === 'discard' || a.type === 'riichi') {
        ok = _discard(state, seat, a.idx, a.type === 'riichi');

      } else if (a.type === 'tsumo') {
        if (state.phase === 'turn' && seat === state.turn && Agari.isWinningHand(state.hands[seat])) {
          _consumeTurnTimer(state, seat);
          _finishHand(state, seat, 'tsumo', null);
          ok = true;
        }

      } else if (a.type === 'nuki') {
        ok = _executeNuki(state, seat, a.tileId);

      } else if (a.type === 'ankan') {
        ok = _executeAnkan(state, seat, a.tile);

      } else if (a.type === 'auto_flags') {
        ensureRuntimeArrays(state);
        var old = getAutoFlags(state, seat);
        state.autoFlags[seat] = {
          agari: !!(a.flags && a.flags.agari),
          tsumogiri: !!(a.flags && a.flags.tsumogiri),
          noCalls: !!(a.flags && a.flags.noCalls),
        };
        ok = old.agari !== state.autoFlags[seat].agari ||
          old.tsumogiri !== state.autoFlags[seat].tsumogiri ||
          old.noCalls !== state.autoFlags[seat].noCalls;

      } else if (a.type === 'ron' || a.type === 'pass') {
        if (state.phase === 'ron_wait' && state.ron && state.ron.candidates.indexOf(seat) >= 0) {
          if (a.type === 'ron') {
            state.hands[seat] = Tiles.sortTiles(state.hands[seat].concat([state.ron.tile]));
            _finishHand(state, seat, 'ron', state.ron.from);
            ok = true;
          } else {
            state.ron.responses[seat] = 'pass';
            if (state.ron.candidates.every(function(c) { return state.ron.responses[c] === 'pass'; })) {
              _resolveRonPasses(state);
            }
            ok = true;
          }
        } else if (state.phase === 'call_wait' && state.call && state.call.candidates.indexOf(seat) >= 0 && a.type === 'pass') {
          state.call.responses[seat] = 'pass';
          if (state.call.candidates.every(function(c) { return state.call.responses[c] === 'pass'; })) {
            var fromSeat = state.call.from;
            state.call = null;
            _nextTurn(state, fromSeat);
          }
          ok = true;
        }

      } else if (a.type === 'call') {
        if (state.phase === 'call_wait') ok = _executeCall(state, seat, a.optionIdx, a.callType);

      } else if (a.type === 'next_round') {
        if (state.phase === 'hand_end' && a.uid === _room.hostUid) {
          _advanceRoundOrEnd(state);
          ok = true;
        }
      }

      if (ok || a.type === 'auto_flags') {
        _lastProcessedSeq = a.seq;
        processedAction = true;
      }
    }

    var tickChanged = _hostTick(state);
    if (processedAction || tickChanged) {
      _publish(state);
    }
  }

  return {
    ready: ready,
    createRoom: createRoom,
    joinRoom: joinRoom,
    leaveRoom: leaveRoom,
    setReady: setReady,
    updateRules: updateRules,
    addCpu: addCpu,
    removeCpu: removeCpu,
    startGame: startGame,
    sendAction: sendAction,
    onChange: function(cb) { _listeners.push(cb); },
    room: function() { return _room; },
    game: function() { return _game; },
    error: function() { return _lastError; },
    errorMessage: errorMessage,
    code: function() { return _code; },
    mySeat: mySeat,
    isHost: isHost,
    isCpu: function(seat) { return isCpuSeat(seat); },
    allReady: function() { return allPlayersReady(_room); },
    rules: function() { return normalizeRules(_room && _room.rules, _room && _room.playerCount); },
    autoFlags: function(seat) { return _game ? getAutoFlags(_game, seat) : defaultAutoFlags(seat); },
    normalizeCode: normalizeCode,
    doraFromInd: doraFromInd,
    isTenpai13: isTenpai13,
    isNukiTile: function(tile) { return isNukiTile(_game, tile); },
    checkAnkan: function(seat) { return checkAnkanCandidates(_game, seat); },
  };
})();
