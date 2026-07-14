'use strict';

// ===== Progress =====
var Progress = {
  _data: null,
  load: function() {
    try { this._data = JSON.parse(localStorage.getItem('mj_progress') || 'null') || {}; }
    catch (e) { this._data = {}; }
    if (!this._data.stars) this._data.stars = {};
    if (!this._data.titles) this._data.titles = [];
    return this;
  },
  save: function() {
    localStorage.setItem('mj_progress', JSON.stringify(this._data));
    // ログイン中ならクラウド（Firestore）にも保存
    if (window.Auth) Auth.schedulePush(this._data);
  },
  getStars: function(id) { return this._data.stars[id] || 0; },
  setStars: function(id, s) { if (s > (this._data.stars[id] || 0)) { this._data.stars[id] = s; this.save(); } },
  isCleared: function(id) { return (this._data.stars[id] || 0) > 0; },
  addTitle: function(t) { if (!this._data.titles.includes(t)) { this._data.titles.push(t); this.save(); } },
  getTitles: function() { return this._data.titles || []; },
};

// ===== Helpers =====
function showToast(msg, dur) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.classList.add('hidden'); }, dur || 2400);
}
function showOverlay(html) {
  document.getElementById('overlayInner').innerHTML = html;
  document.getElementById('overlay').classList.remove('hidden');
}
function hideOverlay() { document.getElementById('overlay').classList.add('hidden'); }
document.addEventListener('click', function(e) {
  var ov = document.getElementById('overlay');
  if (!ov.classList.contains('hidden') && e.target === ov) hideOverlay();
});
function starsHtml(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Bind choice tiles by data-ci
function bindChoiceTiles(sel, cb) {
  document.querySelectorAll(sel).forEach(function(el) {
    el.addEventListener('click', function() { cb(parseInt(el.dataset.ci, 10)); });
  });
}

// Shuffle questions per mini-game; qBank persists for the chapter session
// Pass qBank[mgIdx] = null to force re-shuffle (e.g. on chapter restart)
function getShuffledQ(qBank, mgIdx, qIdx, questions) {
  if (!qBank[mgIdx]) qBank[mgIdx] = Tiles.shuffle(questions.slice());
  return qBank[mgIdx][qIdx % qBank[mgIdx].length];
}

// Shuffle choices array and return a pair {choices, findOk} for tile choice questions
// findOk(ci, answer) checks whether display index ci is the correct answer
function shuffledChoices(originalChoices, isSameFn) {
  var disp = Tiles.shuffle(originalChoices.slice());
  return {
    choices: disp,
    findOk: function(ci, answer) { return isSameFn(disp[ci], answer); }
  };
}

// ===== Mini-game Intro Data =====
var CH_INTROS = {
  // Chapter 1
  ch1_0: {
    icon: '🃏',
    points: [
      '<strong>同じ数字3枚</strong> → セット（<strong>刻子</strong>・コーツ）',
      '<strong>連続した数字3枚</strong> → セット（<strong>順子</strong>・シュンツ）',
      'どちらも「3枚のセット」として使えるよ！',
    ],
    example: '✅ 1・2・3（続いてる！）\n✅ 5・5・5（同じ3枚！）\n❌ 1・3・5（続いてない…）',
    tip: '💡 5枚の中から、セットになる3枚をタップして選ぼう！',
  },
  ch1_1: {
    icon: '👑',
    points: [
      'アガリには 4セット＋<strong>頭（2枚ペア）</strong> が必要',
      '<strong>同じ数字2枚</strong>が頭になれる',
      '頭があってはじめてアガリの形が完成する！',
    ],
    example: '✅ 2・2（同じ数字！）\n✅ 9・9（同じ数字！）\n❌ 3・4（違う数字はNG）',
    tip: '💡 5枚の中から頭になる2枚を選ぼう！',
  },
  ch1_2: {
    icon: '🏆',
    points: [
      'あと1枚でアガリになる状態を「<strong>テンパイ</strong>」という',
      'アガリ形は「3枚セット×4つ＋頭1つ」＝14枚',
      '足りない面子の1枚を当てよう！',
    ],
    example: '手牌13枚を見て、\n「どれを引いたら14枚でアガリになるか」\nを4つの候補から選ぼう',
    tip: '💡 残っている2枚組（ターツ）に何を足すと3枚セットになるか見よう！',
  },
  // Chapter 2
  ch2_0: {
    icon: '🎨',
    points: [
      '色が違う牌は<strong>別の牌</strong>として扱う',
      '順子（連続3枚）は<strong>同じ色でないとNG</strong>！',
      '刻子（同じ3枚）は同じ色・同じ数字が必要',
    ],
    example: '✅ 赤1・赤2・赤3（同じ色で連続！）\n✅ 青5・青5・青5（同じ色・同じ数字！）\n❌ 赤1・青2・赤3（色がバラバラ）',
    tip: '💡 3枚を見て「セットになる？ならない？」を判定しよう！',
  },
  ch2_1: {
    icon: '🧩',
    points: [
      '3色（赤・青・緑）の牌を使ったアガリ形',
      '足りない1枚を4つの候補から選ぶ',
      '色と数字の両方が合う牌を探してね！',
    ],
    example: '手牌13枚を見て、\n「どの牌を引くと14枚でアガリになるか」\nを選ぼう',
    tip: '💡 未完成の面子に足りない色と数字を探そう！',
  },
  // Chapter 3
  ch3_0: {
    icon: '🀄',
    points: [
      '<strong>萬子（まんず）</strong>：「一・二・三…」の漢字が書いてある牌（赤系）',
      '<strong>筒子（ぴんず）</strong>：丸い模様の牌（青系）',
      '<strong>索子（そうず）</strong>：竹のような模様の牌（緑系）',
    ],
    example: '1萬〜9萬（萬子）\n1筒〜9筒（筒子）\n1索〜9索（索子）\nそれぞれ9種類ずつあるよ！',
    tip: '💡 表示された牌が「萬子・筒子・索子」のどれか選ぼう！',
  },
  ch3_1: {
    icon: '🎯',
    points: [
      '萬子・筒子・索子が混ざった手牌でアガリ牌を選ぼう',
      '同じ種類の牌でしか順子は作れない',
      '手牌の形（セットと頭）を確認してね',
    ],
    example: '例：7筒・9筒が残っている\n→ 8筒を引けば7・8・9筒の順子が完成！',
    tip: '💡 13枚の手牌を見て、面子が完成する牌を4択から選ぼう！',
  },
  // Chapter 4
  ch4_0: {
    icon: '🀄',
    points: [
      '字牌（じはい）は<strong>東・南・西・北・白・發・中</strong>の7種類',
      'まず7種類の見た目と読み方を確認してから、名前当てクイズに挑戦！',
      '数牌（1〜9の牌）と違って数字がないのが特徴',
    ],
    example: '東（トン）南（ナン）西（シャー）北（ペー）\n白（ハク）發（ハツ）中（チュン）',
    tip: '💡 全部の見た目を確認したら「クイズを始めよう」を押してね！',
  },
  ch4_1: {
    icon: '❓',
    points: [
      '字牌には数字がないから<strong>順子にはなれない</strong>！',
      '「東・南・西」は並んでいても順子ではない',
      '字牌で作れるのは<strong>刻子（同じ3枚）</strong>か<strong>頭（同じ2枚）</strong>だけ',
    ],
    example: '❌ 東・南・西（順子にならない！）\n✅ 1萬・2萬・3萬（数字が続くので順子OK）',
    tip: '💡 3枚が「順子になる？ならない？」を○✕で答えよう！',
  },
  ch4_2: {
    icon: '🎴',
    points: [
      '字牌でも<strong>同じ牌3枚</strong>で刻子（セット）が作れる',
      '例：東・東・東 = 東の刻子',
      '散らばった牌の中から同じ字牌を3枚選ぼう',
    ],
    example: '例：東・白・東・發・東 が並んでいたら\n→ 東を3枚選んで「東の刻子」完成！',
    tip: '💡 同じ字牌を3枚タップして選ぼう！',
  },
  // Chapter 5
  ch5_0: {
    icon: '🔍',
    points: [
      '役牌になるのは：<strong>白・發・中</strong>の刻子、<strong>場の風</strong>の刻子、<strong>自分の風</strong>の刻子',
      '東場なら東・東・東は役牌になる（場の風）',
      '自分が南家なら南・南・南も役牌になる（自風）',
    ],
    example: '✅ 白・白・白（三元牌はいつでも役牌！）\n✅ 中・中・中（三元牌はいつでも役牌！）\n❌ 西・西・西（場の風でも自風でもない場合）',
    tip: '💡 この問題では「場風=東、自風=南」で考えてね！',
  },
  ch5_1: {
    icon: '🏁',
    points: [
      '役牌の刻子を含む手でアガリ牌を選ぼう',
      '役牌があれば、あとは形を整えるだけ',
      '未完成の面子に足りない牌を探してね',
    ],
    example: '役牌の刻子＋完成セット＋頭を確認して、残った2枚に足りない牌を選ぼう！',
    tip: '💡 役牌（白・發・中など）がセットに入っているか確認しよう！',
  },
  // Chapter 6
  ch6_0: {
    icon: '📢',
    points: [
      '<strong>ポン</strong>：同じ牌2枚持ってれば、誰の捨て牌でもOK！',
      '<strong>チー</strong>：<strong>上家（左の人）</strong>の捨て牌でのみ、順子が作れる場合OK',
      '<strong>鳴けない</strong>：どちらの条件も満たさない',
    ],
    example: '手牌に5萬5萬 → 誰かが5萬を捨てたら「ポン！」\n手牌に3萬4萬 → 左の人が5萬を捨てたら「チー！」\n手牌に2萬6萬 → 4萬が来ても順子にならない → 鳴けない',
    tip: '💡 3択（ポン・チー・鳴けない）から正しい行動を選ぼう！',
  },
  ch6_1: {
    icon: '🤔',
    points: [
      'ポン・チーができても<strong>スルー（パス）</strong>という選択もある',
      '役がなくなる場合はスルーが正解なことも',
      'ポン・チー・スルーの3択から最善を選ぼう',
    ],
    example: '役牌の対子があるならポンを狙おう！\n順子が作れるならチーも有効。\n関係ない牌なら迷わずスルー！',
    tip: '💡 ポン・チー・スルーから状況に合った行動を選ぼう！',
  },
  ch6_2: {
    icon: '🎰',
    points: [
      '鳴きを使って手を完成させた後の最終アガリ牌を選ぼう',
      '副露（鳴いた面子）は表示されているよ',
      '残りの手牌に足りない面子の1枚を探そう',
    ],
    example: '副露あり → 手牌は通常より少ない\n残りの2枚組に足して3枚セットが完成する牌を選ぼう！',
    tip: '💡 副露牌＋手牌で「あと何が来ればアガリ？」を考えよう！',
  },
  // Chapter 7
  ch7: {
    icon: '🥋',
    points: [
      '第1〜6章の内容を総まとめ！',
      'セット・頭・字牌・役牌・鳴きなど全テーマから出題',
      '<strong>10問</strong>に答えて段位評価を目指そう！',
    ],
    example: '7問以上正解 → クリア！\n8問以上 → 期待の雀士\n10問全問 → もう打てる雀士！',
    tip: '💡 焦らず落ち着いて考えよう。解説を読んで次の問題に進もう！',
  },
  // Chapter 8: 初心者向けの役
  ch8_0: {
    icon: '🍃',
    points: [
      '<strong>タンヤオ</strong>＝2〜8の数牌だけで作る役（1翻）',
      '1・9の数牌や字牌が<strong>1枚でも</strong>入るとタンヤオにならない',
      'まずは「この牌はタンヤオに使える？」を判定しよう',
    ],
    example: '✅ 2・3・4萬（全部2〜8）\n✅ 6・7・8索（全部2〜8）\n❌ 1筒（1が入る）\n❌ 白（字牌が入る）',
    tip: '💡 3枚を見て「使える？使えない？」を○✕で答えよう！',
  },
  ch8_1: {
    icon: '📛',
    points: [
      '初心者がよく使う役：<strong>立直・タンヤオ・平和・役牌</strong>',
      '立直＝門前テンパイで宣言／平和＝全部順子＋両面待ちなど',
      '説明文を読んで、ぴったり合う役の名前を選ぼう',
    ],
    example: '「2〜8だけで作る役」→ タンヤオ\n「門前テンパイで1000点宣言」→ 立直',
    tip: '💡 4つの役から正しいものを1つ選ぼう！',
  },
  ch8_2: {
    icon: '🎯',
    points: [
      'タンヤオのテンパイから、アガリ牌を選ぶ問題',
      'アガっても<strong>全部2〜8のまま</strong>になる牌が正解',
      '1や9を引いてしまうとタンヤオが消えるので注意',
    ],
    example: '7筒・8筒で待ち → 6筒ならタンヤオ継続！\n9筒だと9が入ってタンヤオが消える',
    tip: '💡 4つの候補から、タンヤオを保てるアガリ牌を選ぼう！',
  },
  // Chapter 9: 翻を数えてみよう
  ch9_0: {
    icon: '🧮',
    points: [
      '点数は<strong>翻（ハン）</strong>の合計で決まる',
      '役の翻と<strong>ドラ（1枚＝1翻）</strong>を全部足そう',
      'まずは簡単な足し算で合計翻を求める練習',
    ],
    example: '立直1＋タンヤオ1＝2翻\n立直1＋タンヤオ1＋ドラ1＝3翻',
    tip: '💡 役の翻とドラを足して、合計翻を選ぼう！',
  },
  ch9_1: {
    icon: '💎',
    points: [
      '<strong>ドラ</strong>は持っているだけで翻が増えるボーナス牌',
      'ドラ表示牌の<strong>次の牌</strong>がドラになる',
      '9の次は1、北の次は東、中の次は白…と一周する',
    ],
    example: '表示牌が3萬 → ドラは4萬\n表示牌が9筒 → ドラは1筒（1に戻る）\n表示牌が白 → ドラは發',
    tip: '💡 表示牌の「次の牌」を4つの候補から選ぼう！',
  },
  ch9_2: {
    icon: '🏅',
    points: [
      '翻が増えると点数のランクが上がる',
      '<strong>満貫→跳満→倍満→三倍満→役満</strong>の順',
      '5翻＝満貫（子8000/親12000点）が大きな目安',
    ],
    example: '5翻 → 満貫\n6〜7翻 → 跳満\n8〜10翻 → 倍満\n11〜12翻 → 三倍満',
    tip: '💡 翻数に合う点数ランクの名前を選ぼう！',
  },
  // Chapter 10: 中級者向けの役
  ch10_0: {
    icon: '👯',
    points: [
      '<strong>七対子</strong>＝2枚ペアを7組そろえる特殊な形（2翻・門前のみ）',
      '<strong>7種類すべて違う牌</strong>のペアでなければダメ',
      '同じ牌4枚を「2ペア」と数えるのはNG',
    ],
    example: '✅ 7種類の違うペア\n❌ 同じ牌4枚を2ペア扱い（6種類しかない）',
    tip: '💡 14枚を見て「七対子になっている？」を○✕で答えよう！',
  },
  ch10_1: {
    icon: '🎴',
    points: [
      '中級でよく出る役：<strong>一盃口・七対子・対々和・三色同順</strong>',
      '一盃口＝同じ順子2組／対々和＝全部刻子',
      '説明に合う役を選んで覚えよう',
    ],
    example: '「同じ順子が2組」→ 一盃口\n「全部刻子」→ 対々和',
    tip: '💡 4つの役から正しいものを選ぼう！',
  },
  ch10_2: {
    icon: '🧱',
    points: [
      '<strong>対々和（トイトイ）</strong>＝全部の面子が刻子（同じ3枚）＋頭',
      '順子（連続3枚）が<strong>1組でも</strong>あると対々和にならない',
      '刻子だけで固めた形かどうかを見極めよう',
    ],
    example: '✅ 刻子4つ＋頭\n❌ 中に2・3・4のような順子がある',
    tip: '💡 14枚を見て「対々和の形？」を○✕で答えよう！',
  },
  // Chapter 11: 上級者向けの役
  ch11_0: {
    icon: '🟥',
    points: [
      '<strong>清一色（チンイツ）</strong>＝1種類の数牌だけで作る（字牌もなし・6翻）',
      '少しでも別の種類や字牌が混じると清一色ではない',
      '（字牌が混じると「混一色」という別の役になる）',
    ],
    example: '✅ 全部萬子だけ\n❌ 萬子＋筒子\n❌ 萬子＋白（字牌）→ これは混一色',
    tip: '💡 手牌が「1種類の数牌だけ？」を○✕で答えよう！',
  },
  ch11_1: {
    icon: '🔥',
    points: [
      '上級役：<strong>清一色・混一色・二盃口・三槓子</strong>',
      '混一色＝1種類の数牌＋字牌／二盃口＝一盃口が2組',
      '説明に合う役を選んで覚えよう',
    ],
    example: '「1種類の数牌だけ」→ 清一色\n「カンを3回」→ 三槓子',
    tip: '💡 4つの役から正しいものを選ぼう！',
  },
  ch11_2: {
    icon: '🔢',
    points: [
      '上級役の<strong>翻数</strong>を覚えよう',
      '清一色は門前6翻（鳴き5翻）、混一色は門前3翻（鳴き2翻）',
      '翻が高いほど大きな手になる',
    ],
    example: '清一色（門前）→ 6翻\n混一色（門前）→ 3翻\n二盃口 → 3翻',
    tip: '💡 役の翻数を4つの候補から選ぼう！',
  },
  // Chapter 12: 三人麻雀入門
  ch12_0: {
    icon: '🀄',
    points: [
      '<strong>三人麻雀（三麻）</strong>は3人で打つ麻雀',
      '<strong>萬子の2〜8を抜く</strong>（1萬・9萬は残す）',
      'チーは基本なし、抜いた北はドラ（北抜き）になることが多い',
    ],
    example: '○ 三麻は3人で対局\n○ 萬子の2〜8は使わない\n✕ 三麻は4人で打つ',
    tip: '💡 三麻のルールが正しいか○✕で答えよう！',
  },
  ch12_1: {
    icon: '🧭',
    points: [
      '三麻ならではのルールをクイズで確認',
      '使わない牌・北抜き・できない鳴きなどがポイント',
      '正しい答えを選んでルールを定着させよう',
    ],
    example: '「使わない牌」→ 萬子の2〜8\n「抜いた北」→ ドラ（北抜き）',
    tip: '💡 4つの選択肢から正しいものを選ぼう！',
  },
};

// ===== Show Mini-game Intro =====
function showMgIntro(main, chapterTitle, mgTitle, intro, onStart) {
  var pts = intro.points.map(function(p) {
    return '<div class="mg-intro-point"><div class="mg-intro-point-dot"></div><div>' + p + '</div></div>';
  }).join('');
  var exLines = intro.example.replace(/\n/g, '<br>');

  main.innerHTML =
    '<div class="mg-intro">' +
      '<div class="mg-intro-nav">' + esc(chapterTitle) + '<span class="mg-intro-nav-sep">›</span>' + esc(mgTitle) + '</div>' +
      '<div class="mg-intro-title">' + esc(mgTitle) + '</div>' +
      '<div class="mg-intro-card">' +
        '<span class="mg-intro-icon">' + intro.icon + '</span>' +
        '<div class="mg-intro-points">' + pts + '</div>' +
        '<div class="mg-intro-example">' + exLines + '</div>' +
        '<div class="mg-intro-tip">' + intro.tip + '</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<button class="btn-intro-start" id="btnIntroStart">わかった！はじめよう →</button>' +
      '</div>' +
    '</div>';

  document.getElementById('btnIntroStart').addEventListener('click', function() {
    onStart();
  });
}

// Show feedback + next button (replaces auto-advance setTimeout)
function showFeedback(ok, msg, onNext) {
  var fbEl = document.getElementById('feedback');
  if (!fbEl) return;
  var cls = ok ? 'feedback correct' : 'feedback incorrect';
  var icon = ok ? '✅ 正解！' : '❌ おしい！';
  fbEl.innerHTML =
    '<div class="' + cls + '">' + icon + ' ' + esc(msg) + '</div>' +
    '<div class="next-btn-wrap"><button class="btn-next-q" id="btnNextQ">解説を読んで次へ →</button></div>';
  var btn = document.getElementById('btnNextQ');
  if (btn) btn.addEventListener('click', function() { if (onNext) onNext(); });
}

// ===== AI Advice helper =====
function askAI(hand, context, level, targetEl, mode) {
  if (!targetEl) return;
  targetEl.innerHTML = '<div class="ai-loading">🤖 AI先生が考えています...</div>';
  var payload = {
    hand: hand || [],
    context: context || '手牌についてアドバイスください',
    level: level || 'beginner',
    mode: mode || 'general'
  };
  fetch('/api/ai-advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(r) { return r.json(); })
    .then(function(d) {
      targetEl.innerHTML = '<div class="ai-response ai-one-line">' + esc(d.advice || 'アドバイスがありません。') + '</div>';
    })
    .catch(function() { targetEl.innerHTML = '<div class="ai-response">通信エラーが発生しました。</div>'; });
}

function tileToAdviceId(tile) {
  if (!tile) return '';
  if (tile.suit === 'man') return tile.num + 'm';
  if (tile.suit === 'pin') return tile.num + 'p';
  if (tile.suit === 'sou') return tile.num + 's';
  if (tile.suit === 'wind') return ['east', 'south', 'west', 'north'][tile.num - 1] || '';
  if (tile.suit === 'dragon') return ['white', 'green', 'red'][tile.num - 1] || '';
  return '';
}

function adviceSeatTiles(tiles) {
  return (tiles || []).map(tileToAdviceId).filter(Boolean);
}

function tileDef(t) { return { suit: t.suit, num: t.num, color: t.color }; }
function makeFromDef(t) { return t.color ? Tiles.makeColored(t.color, t.num) : Tiles.make(t.suit, t.num); }
function renderDefTile(t, opts) { return Tiles.renderTile(makeFromDef(t), opts || {}); }
function sameDef(a, b) { return a && b && a.suit === b.suit && a.num === b.num && a.color === b.color; }

function splitWinningExample(y) {
  var full = (y.example || []).map(tileDef);
  var win = y.winTile ? tileDef(y.winTile) : full[full.length - 1];
  var idx = -1;
  for (var i = full.length - 1; i >= 0; i--) {
    if (sameDef(full[i], win)) { idx = i; break; }
  }
  var hand = full.slice();
  if (idx >= 0) win = hand.splice(idx, 1)[0];
  return { hand: hand, win: win, full: full };
}

function renderYakuExampleBoard(y) {
  if (!y.example || !y.example.length) return '';
  var ex = splitWinningExample(y);
  return '<div class="detail-section"><h3>上がり例の譜面</h3>' +
    '<div class="yaku-board">' +
      '<div class="yaku-board-block">' +
        '<div class="yaku-board-label">手牌13枚</div>' +
        '<div class="example-hand-row">' + ex.hand.map(function(t) {
          return renderDefTile(t, { noHover: true });
        }).join('') + '</div>' +
      '</div>' +
      '<div class="yaku-board-plus">+</div>' +
      '<div class="yaku-board-block win-block">' +
        '<div class="yaku-board-label">アガリ牌</div>' +
        '<div class="example-hand-row">' + renderDefTile(ex.win, { noHover: true, extraClass: 'win-tile' }) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="complete-hand-label">完成形</div>' +
    '<div class="complete-hand-row">' + ex.full.map(function(t) {
      return renderDefTile(t, { noHover: true, small: true });
    }).join('') + '</div>' +
    (y.winNote ? '<div class="win-tile-label">🏆 ' + esc(y.winNote) + '</div>' : '') +
    '</div>';
}

// ===== Dynamic Discard River Positioning =====
//
// 全4方向で共通の RIVER_GAP を使い、各河の「点数板側の端」を基準に配置する:
//   self     : 河の上端 = panel.bottom + RIVER_GAP
//   opposite : 河の下端 = panel.top    - RIVER_GAP
//   left     : 河の右端 = panel.left   - RIVER_GAP  (90°回転後の視覚右端)
//   right    : 河の左端 = panel.right  + RIVER_GAP  (-90°回転後の視覚左端)
//
// 牌の枚数が変わっても点数板側の端は固定、外側へ広がる。
function positionDiscardRivers() {
  var RIVER_GAP = 10; // 全4方向で統一 (px)

  var cpEl    = document.querySelector('.jt-center-panel');
  var tableEl = document.querySelector('.jt-table');
  if (!cpEl || !tableEl) return;

  var cp    = cpEl.getBoundingClientRect();
  var table = tableEl.getBoundingClientRect();

  // position:absolute の基準はボーダー内側 (content edge)
  var ts        = window.getComputedStyle(tableEl);
  var borderT   = parseFloat(ts.borderTopWidth)  || 0;
  var borderL   = parseFloat(ts.borderLeftWidth) || 0;

  // 点数板の四辺をテーブル content-edge 基準の座標に変換
  var pTop    = cp.top    - table.top    - borderT;
  var pBottom = cp.bottom - table.top    - borderT;
  var pLeft   = cp.left   - table.left   - borderL;
  var pRight  = cp.right  - table.left   - borderL;
  var pCenterY = (pTop + pBottom) / 2;

  // 共通スタイルセッター
  var set = function(el, obj) {
    for (var k in obj) el.style.setProperty(k, obj[k], 'important');
  };

  // ── SELF: 河の上端 = pBottom + RIVER_GAP ──────────────────
  var sv = document.querySelector('.disc-river-self');
  if (sv) {
    set(sv, {
      top:              (pBottom + RIVER_GAP) + 'px',
      left:             pLeft + 'px',
      right:            'auto',
      transform:        'none',
      'transform-origin': 'initial'
    });
  }

  // ── OPPOSITE: 河の下端 = pTop - RIVER_GAP ─────────────────
  // left = pLeft（点数板左端に揃える = selfと同じ横開始位置）
  // top  = pTop - RIVER_GAP - containerHeight（下端固定のため動的計算）
  var ov = document.querySelector('.disc-river-opposite');
  if (ov) {
    // transform を先にリセットしてから高さを計測
    ov.style.setProperty('transform',   'none', 'important');
    ov.style.setProperty('direction',   'ltr',  'important');
    var oH = ov.offsetHeight || 153;       // 実際の高さ（CSS height:153px 固定）
    set(ov, {
      top:              (pTop - RIVER_GAP - oH) + 'px',
      left:             pLeft + 'px',      // ← selfと同じ点数板左端基準
      right:            'auto',
      transform:        'none',
      direction:        'ltr',
      'transform-origin': 'initial'
    });
  }

  // ── LEFT: 90°CW 回転後の視覚右端 = pLeft - RIVER_GAP ──────
  // 視覚右端 = CSS_left + W/2 + H/2  → CSS_left = pLeft - GAP - W/2 - H/2
  var lv = document.querySelector('.disc-river-left');
  if (lv) {
    lv.style.setProperty('transform', 'none', 'important');
    var lW = lv.offsetWidth  || 171;
    var lH = lv.offsetHeight || 153;
    set(lv, {
      left:             (pLeft - RIVER_GAP - lW / 2 - lH / 2) + 'px',
      top:              (pCenterY - lH / 2) + 'px',
      right:            'auto',
      transform:        'rotate(90deg)',
      'transform-origin': 'center center'
    });
  }

  // ── RIGHT: -90°回転後の視覚左端 = pRight + RIVER_GAP ──────
  // 視覚左端 = CSS_left + W/2 - H/2  → CSS_left = pRight + GAP - W/2 + H/2
  var rv = document.querySelector('.disc-river-right');
  if (rv) {
    rv.style.setProperty('transform', 'none', 'important');
    var rW = rv.offsetWidth  || 171;
    var rH = rv.offsetHeight || 153;
    set(rv, {
      left:             (pRight + RIVER_GAP - rW / 2 + rH / 2) + 'px',
      top:              (pCenterY - rH / 2) + 'px',
      right:            'auto',
      transform:        'rotate(-90deg)',
      'transform-origin': 'center center'
    });
  }
}

// ウィンドウリサイズ時も再配置
window.addEventListener('resize', positionDiscardRivers);

// ===== App =====
var App = {
  history: [],
  current: null,
  currentParams: null,

  init: function() {
    Progress.load();
    var self = this;
    document.getElementById('btnBack').addEventListener('click', function() { self.goBack(); });
    document.getElementById('btnProgress').addEventListener('click', function() { self.navigate('progress'); });
    document.getElementById('headerTitle').addEventListener('click', function() { self.navigate('home'); });
    document.getElementById('btnAccount').addEventListener('click', function() { self.navigate('login'); });
    // ログイン状態が変わったら関連ページを再描画（進捗マージ後の星を反映）
    if (window.Auth) {
      Auth.onChange(function() {
        self._updateHeaderAccount();
        var p = self.current;
        if (p === 'home' || p === 'login' || p === 'progress' || p === 'chapters') {
          self._render(p, self.currentParams);
        }
      });
    }
    this.navigate('home');
  },

  // ヘッダー右上のアカウント表示を最新のログイン状態に合わせる
  _updateHeaderAccount: function() {
    var btn = document.getElementById('btnAccount');
    if (!btn) return;
    var u = (window.Auth && Auth.enabled() && Auth.user()) ? Auth.user() : null;
    if (u) {
      btn.textContent = '👤 ' + (u.displayName || u.email || 'アカウント');
      btn.classList.add('logged-in');
      btn.title = u.email || '';
    } else {
      btn.textContent = '👤 ログイン';
      btn.classList.remove('logged-in');
      btn.title = '';
    }
  },

  navigate: function(page, params) {
    params = params || {};
    if (this.current && !(this.current === 'home' && page === 'home'))
      this.history.push({ page: this.current, params: this.currentParams });
    this.current = page;
    this.currentParams = params;
    this._render(page, params);
  },

  goBack: function() {
    if (!this.history.length) { this.navigate('home'); return; }
    var prev = this.history.pop();
    this.current = prev.page;
    this.currentParams = prev.params;
    this._render(prev.page, prev.params);
  },

  _render: function(page, params) {
    this._updateHeaderAccount();   // 画面が変わるたびに右上のアカウント表示も更新
    var main = document.getElementById('appMain');
    main.className = 'app-main' + (page === 'battle' ? ' battle-main' : '');
    document.body.classList.toggle('is-battle-page', page === 'battle');
    document.getElementById('btnBack').classList.toggle('hidden', page === 'home');
    if      (page === 'home')          this._renderHome(main);
    else if (page === 'chapters')      this._renderChapters(main);
    else if (page === 'chapter')       this._renderChapterGame(main, params.id);
    else if (page === 'yaku')          this._renderYaku(main, params.filter || 'all');
    else if (page === 'yaku_detail')   this._renderYakuDetail(main, params.id);
    else if (page === 'terms')         this._renderTerms(main);
    else if (page === 'progress')      this._renderProgress(main);
    else if (page === 'battle_setup')  this._renderBattleSetup(main, params);
    else if (page === 'battle')        this._renderBattle(main, params);
    else if (page === 'ai_coach')      this._renderAICoach(main);
    else if (page === 'quiz_select')   this._renderQuizSelect(main);
    else if (page === 'quiz')          this._renderQuiz(main, params.source || 'mixed');
    else if (page === 'login')         this._renderLogin(main);
    else if (page === 'friend')        this._renderFriend(main);
    else main.innerHTML = '<p style="color:#8ab89c;text-align:center;padding:40px">準備中...</p>';
    window.scrollTo(0, 0);
  },

  // ===== Home =====
  _renderHome: function(main) {
    var self = this;
    var cards = [
      { label:'はじめる',     icon:'🎮', sub:'チャプター1から学ぼう', page:'chapter', params:{id:1}, cls:'primary' },
      { label:'チャプター選択', icon:'📚', sub:'好きな章から', page:'chapters' },
      { label:'VS CPU',       icon:'🤖', sub:'4人打ちCPU対局', page:'battle_setup', params:{playerCount:4} },
      { label:'単語クイズ',   icon:'📝', sub:'用語・役をランダム出題', page:'quiz_select' },
      { label:'AI先生',        icon:'💡', sub:'質問・手牌相談', page:'ai_coach' },
      { label:'友人戦',        icon:'👥', sub:'6桁IDでオンライン対戦', page:'friend' },
      { label:'三人麻雀',      icon:'🀄', sub:'北抜きありCPU対局', page:'battle_setup', params:{playerCount:3} },
      { label:'役一覧',        icon:'📖', sub:'全役を確認', page:'yaku' },
      { label:'麻雀用語',      icon:'💬', sub:'用語集', page:'terms' },
      { label:'役満モード',    icon:'🏆', sub:'test（近日公開）', disabled:true },
      { label:'学習進捗',      icon:'📊', sub:'マイページ', page:'progress' },
    ];
    main.innerHTML = '<div class="home-hero"><h2>まーじゃんしよか</h2><p>牌を動かしながら麻雀を覚えよう！</p></div>' +
      '<div class="home-grid" id="homeGrid">' +
      cards.map(function(c, i) {
        return '<div class="home-card ' + (c.cls||'') + (c.disabled?' disabled':'') + '" data-ci="'+i+'">' +
          '<span class="home-card-icon">'+c.icon+'</span>' +
          '<div class="home-card-label">'+c.label+'</div>' +
          '<div class="home-card-sub">'+c.sub+'</div></div>';
      }).join('') + '</div>';
    document.querySelectorAll('#homeGrid .home-card').forEach(function(el, i) {
      el.addEventListener('click', function() {
        var c = cards[i];
        if (c.disabled) { showToast('近日公開予定です！お楽しみに 🚧'); return; }
        self.navigate(c.page, c.params || {});
      });
    });
  },

  // ===== Chapter Select =====
  _renderChapters: function(main) {
    var self = this;
    main.innerHTML = '<div class="page-title">チャプター選択</div><div class="chapter-list" id="chList">' +
      GameData.CHAPTERS.map(function(c) {
        var stars = Progress.getStars(c.id);
        var cleared = stars > 0;
        // 前の章をクリアするまでロック（第1章は常に挑戦可能）
        var locked = c.id > 1 && !Progress.isCleared(c.id - 1);
        var rightCol = '';
        if (cleared) {
          rightCol = '<div class="chapter-cleared-col">' +
            '<div class="chapter-stars">'+starsHtml(stars)+'</div>' +
            '<span class="chapter-badge chapter-badge-replay">🔄 復習</span>' +
            '</div>';
        } else if (locked) {
          rightCol = '<span class="chapter-badge coming">🔒 ロック</span>';
        } else {
          rightCol = '<span class="chapter-badge">▶ プレイ</span>';
        }
        return '<div class="chapter-card '+(cleared?'cleared':'')+' '+(locked?'locked':'')+'" data-id="'+c.id+'" data-locked="'+locked+'">' +
          '<div class="chapter-num">'+c.id+'</div>' +
          '<div class="chapter-info">' +
          '<div class="chapter-title">'+c.short+'</div>' +
          '<div class="chapter-meta">⏱ 約'+c.min+'分 ・ 難易度'+'⭐'.repeat(c.diff)+'</div>' +
          '<div class="chapter-meta">'+c.topics.join(' / ')+'</div>' +
          '</div>' +
          rightCol + '</div>';
      }).join('') + '</div>';

    document.querySelectorAll('#chList .chapter-card').forEach(function(el) {
      el.addEventListener('click', function() {
        if (el.dataset.locked === 'true') {
          var lid = parseInt(el.dataset.id, 10);
          showToast('第'+(lid-1)+'章をクリアすると挑戦できるよ！ 🔒');
          return;
        }
        self.navigate('chapter', { id: parseInt(el.dataset.id, 10) });
      });
    });
  },

  // ===== Chapter Router =====
  _renderChapterGame: function(main, id) {
    var ch = GameData.CHAPTERS.find(function(c) { return c.id === id; });
    if (!ch) { main.innerHTML = '<p style="color:red">章が見つかりません</p>'; return; }
    // 前の章をクリアしていない章はロック（直接遷移もブロック）
    if (id > 1 && !Progress.isCleared(id - 1)) {
      main.innerHTML = '<div class="coming-soon"><div class="big-icon">🔒</div>' +
        '<p>第'+id+'章はまだロックされています。<br><strong>第'+(id-1)+'章</strong>をクリアすると挑戦できます。</p><br>' +
        '<button class="btn btn-primary" id="btnGoCh'+(id-1)+'">第'+(id-1)+'章に挑戦</button> ' +
        '<button class="btn btn-secondary" id="btnGoChs">チャプター選択へ</button></div>';
      document.getElementById('btnGoCh'+(id-1)).addEventListener('click', function() { App.navigate('chapter', { id: id-1 }); });
      document.getElementById('btnGoChs').addEventListener('click', function() { App.navigate('chapters'); });
      return;
    }
    var engines = [null,this._ch1.bind(this),this._ch2.bind(this),this._ch3.bind(this),
                   this._ch4.bind(this),this._ch5.bind(this),this._ch6.bind(this),this._ch7.bind(this)];
    var engine = engines[id] || this._chQuiz.bind(this);
    engine(main, ch);
  },

  // ===== CHAPTER 1 =====
  _ch1: function(main) {
    var mgs = [Chapters.ch1.mg1, Chapters.ch1.mg2, Chapters.ch1.mg3];
    var mgIdx = 0, qIdx = 0, correct = 0, showingFb = false, selected = [];
    var qBank = {}, introShown = {};

    var render = function() {
      if (mgIdx >= mgs.length) { showClear(1,3); return; }
      var mg = mgs[mgIdx];
      var pct = Math.round(mgIdx/mgs.length*100);
      // イントロ表示
      if (qIdx === 0 && !introShown[mgIdx]) {
        introShown[mgIdx] = true;
        var introKey = 'ch1_' + mgIdx;
        if (CH_INTROS[introKey]) { showMgIntro(main, '第1章 数字だけの麻雀', mg.title, CH_INTROS[introKey], render); return; }
      }

      if (mgIdx < 2) {
        var q = getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        // 牌の表示順をシャッフル（正解位置を左固定にしない）
        var numsIndexed = q.nums.map(function(n, i) { return {n: n, oi: i}; });
        var shuffledNums = Tiles.shuffle(numsIndexed);
        var tiles = shuffledNums.map(function(x) { return Tiles.makeNum(x.n); });
        selected = [];
        var sel = mgIdx === 0 ? 3 : 2;

        // ── 概念説明ヒント（答えは一切教えない） ──
        var ch1Hints;
        if (mgIdx === 0) {
          ch1Hints = [
            '「セット」とは<strong>3枚1組のまとまり</strong>のこと。①同じ数字3枚（刻子・コーツ）、または②数字が1ずつ続く3枚（順子・シュンツ）がセットになれるよ',
            'まず「同じ数字が3枚あるかな？」と考えてみよう。なければ次に「数字が1・2・3のように続いているかな？」と見てみよう',
          ];
        } else {
          ch1Hints = [
            '「頭」はアガリに必要な<strong>同じ数字2枚のペア</strong>のこと。5枚の中から同じ数字を探してみよう',
            '1枚ずつ「この牌と同じ数字の牌は他にあるかな？」と確認していくと見つかるよ',
          ];
        }
        var hintLv = 0;

        main.innerHTML = chHeader('第1章 数字だけの麻雀', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">'+mg.instruction+'<br><small style="color:#8ab89c">選ぶ枚数：<strong style="color:var(--gold)">'+sel+'枚</strong></small></div>' +
          '<div class="game-area"><div class="tiles-row" id="tilesRow">'+
          tiles.map(function(t){return Tiles.renderTile(t,{});}).join('')+
          '</div><div id="feedback"></div></div>' +
          '<div class="btn-row"><button class="btn btn-hint" id="btnHint">💡 ヒントを見る</button></div>' +
          '<div class="hint-box" id="hintBox"></div>';

        document.getElementById('btnHint').addEventListener('click', function() {
          var hb = document.getElementById('hintBox');
          var btn = document.getElementById('btnHint');
          hintLv = Math.min(hintLv + 1, ch1Hints.length);
          var txt = ch1Hints[hintLv - 1];
          hb.innerHTML = '<span style="font-size:0.72rem;color:var(--gold);font-weight:700;display:block;margin-bottom:4px">ヒント' + hintLv + '</span>' + txt;
          hb.classList.add('visible');
          if (hintLv >= ch1Hints.length) {
            btn.textContent = '💡 ヒントはここまで';
            btn.disabled = true;
          } else {
            btn.textContent = '💡 もっとヒントを見る（' + (hintLv + 1) + '/' + ch1Hints.length + '）';
          }
        });

        document.querySelectorAll('#tilesRow .tile').forEach(function(el, i) {
          el.addEventListener('click', function() {
            if (showingFb) return;
            var si = selected.indexOf(i);
            if (si >= 0) { selected.splice(si,1); el.classList.remove('selected'); }
            else if (selected.length < sel) { selected.push(i); el.classList.add('selected'); }
            if (selected.length === sel) {
              var selTiles = selected.map(function(si){return tiles[si];});
              var ok = mgIdx === 0 ? Tiles.isMeld(selTiles) : Tiles.isPair(selTiles);
              showingFb = true;
              showFeedback(ok, q.fb, function() {
                showingFb = false; selected = []; qIdx++;
                correct += (ok ? 1 : 0);
                if (!ok) { render(); return; }
                if (correct >= mg.passNeeded) {
                  var prev = mgIdx; mgIdx++; qIdx = 0; correct = 0;
                  if (mgIdx >= mgs.length) showClear(1,3); else showMgClear(prev,render);
                } else render();
              });
            }
          });
        });

      } else {
        var q = getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        var handTiles = q.hand.map(function(n){return Tiles.makeNum(n);});
        var dispChoices1 = Tiles.shuffle(q.choices.slice());
        var mg3Hints = [
          'この問題は「あと1枚でアガリになる手牌（テンパイ）」から、アガリに必要な牌を当てるものだよ。アガリには3枚セット×4つ＋頭（同じ2枚）が必要',
          '完成している3枚セットと頭を先に見つけよう。残った2枚が「あと1枚で面子になる形」なら、その足りない数字がアガリ牌だよ',
          'たとえば2・4なら3、7・9なら8、8・8の刻子を作りたい8・8なら8が必要だよ',
        ];
        var hintLv3 = 0;
        main.innerHTML = chHeader('第1章 数字だけの麻雀', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">'+mg.instruction+'</div>' +
          '<div class="game-area"><div class="tiles-label">手牌（13枚）</div>' +
          '<div class="tiles-row">'+handTiles.map(function(t){return Tiles.renderTile(t,{noHover:true});}).join('')+'</div>' +
          '<div style="margin-top:10px;color:#8ab89c;font-size:0.85rem">どの数字を引けばアガリ？</div>' +
          '<div class="choice-grid">'+dispChoices1.map(function(n,ci){return '<button class="btn-choice" data-ci="'+ci+'">'+n+'</button>';}).join('')+
          '</div><div id="feedback"></div></div>' +
          '<div class="btn-row"><button class="btn btn-hint" id="btnHint3">💡 ヒントを見る</button></div>' +
          '<div class="hint-box" id="hintBox3"></div>';

        document.getElementById('btnHint3').addEventListener('click', function() {
          var hb = document.getElementById('hintBox3');
          var btn = document.getElementById('btnHint3');
          hintLv3 = Math.min(hintLv3 + 1, mg3Hints.length);
          hb.innerHTML = '<span style="font-size:0.72rem;color:var(--gold);font-weight:700;display:block;margin-bottom:4px">ヒント' + hintLv3 + '</span>' + mg3Hints[hintLv3 - 1];
          hb.classList.add('visible');
          if (hintLv3 >= mg3Hints.length) { btn.textContent = '💡 ヒントはここまで'; btn.disabled = true; }
          else btn.textContent = '💡 もっとヒント（' + (hintLv3 + 1) + '/' + mg3Hints.length + '）';
        });

        document.querySelectorAll('.btn-choice').forEach(function(el) {
          el.addEventListener('click', function() {
            if (showingFb) return;
            showingFb = true;
            var ci = parseInt(el.dataset.ci, 10);
            var ok = dispChoices1[ci] === q.answer;
            if (ok) correct++;
            showFeedback(ok, q.fb, function() {
              showingFb = false; qIdx++;
              if (correct >= mg.passNeeded) { mgIdx++; qIdx = 0; correct = 0; if (mgIdx >= mgs.length) showClear(1,3); else showMgClear(2,render); }
              else render();
            });
          });
        });
      }
    };

    // Fix: showFeedback calls onNext which increments correct -- move correct++ into click handler before showFeedback
    render();
  },

  // ===== CHAPTER 2 =====
  _ch2: function(main) {
    var mgs = [Chapters.ch2.mg1, Chapters.ch2.mg2];
    var mgIdx = 0, qIdx = 0, correct = 0, showingFb = false;
    var qBank = {}, introShown = {};

    var render = function() {
      if (mgIdx >= mgs.length) { showClear(2,3); return; }
      var mg = mgs[mgIdx];
      if (qIdx === 0 && !introShown[mgIdx]) {
        introShown[mgIdx] = true;
        var introKey = 'ch2_' + mgIdx;
        if (CH_INTROS[introKey]) { showMgIntro(main, '第2章 色付き牌', mg.title, CH_INTROS[introKey], render); return; }
      }
      if (mgIdx >= mgs.length) { showClear(2,3); return; }
      var mg = mgs[mgIdx]; var pct = Math.round(mgIdx/mgs.length*100);

      if (mgIdx === 0) {
        var q = getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        var tiles = q.tiles.map(function(t){return Tiles.makeColored(t.c,t.n);});
        main.innerHTML = chHeader('第2章 色付き牌', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">'+mg.instruction+'</div>' +
          '<div class="game-area"><div class="tiles-row">'+tiles.map(function(t){return Tiles.renderTile(t,{noHover:true});}).join('')+'</div>' +
          '<div style="margin-top:12px;color:#8ab89c;font-size:0.85rem">この3枚はセット？</div>' +
          '<div class="yn-panel" style="margin-top:10px"><button class="btn btn-yes" id="btnY">○ セット</button><button class="btn btn-no" id="btnN">✕ ちがう</button></div>' +
          '<div id="feedback"></div></div>';
        var handleYN = function(chosen) {
          if (showingFb) return; showingFb = true;
          var ok = chosen === q.answer; if(ok) correct++;
          showFeedback(ok, q.fb, function() {
            showingFb = false; qIdx++;
            if (correct >= mg.passNeeded) { mgIdx++; qIdx=0; correct=0; showMgClear(0,render); } else render();
          });
        };
        document.getElementById('btnY').addEventListener('click', function(){handleYN(true);});
        document.getElementById('btnN').addEventListener('click', function(){handleYN(false);});

      } else {
        var q = getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        var sc2 = shuffledChoices(q.choices, function(c,ans){return c.c===ans.c && c.n===ans.n;});
        var handTiles = q.hand.map(function(t){return Tiles.makeColored(t.c,t.n);});
        main.innerHTML = chHeader('第2章 色付き牌', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">'+mg.instruction+'</div>' +
          '<div class="game-area"><div class="tiles-label">手牌（13枚）</div>' +
          '<div class="tiles-row">'+handTiles.map(function(t){return Tiles.renderTile(t,{noHover:true,small:true});}).join('')+'</div>' +
          '<div style="margin-top:10px;color:#8ab89c;font-size:0.85rem">アガリ牌はどれ？</div>' +
          '<div class="yn-tiles" id="choiceRow" style="margin-top:10px">'+
          sc2.choices.map(function(ch,ci){return '<div class="choice-tile" data-ci="'+ci+'">'+Tiles.renderTile(Tiles.makeColored(ch.c,ch.n),{})+'</div>';}).join('')+
          '</div><div id="feedback"></div></div>';
        bindChoiceTiles('#choiceRow .choice-tile', function(ci) {
          if (showingFb) return; showingFb = true;
          var ok = sc2.findOk(ci, q.answer); if(ok) correct++;
          showFeedback(ok, q.fb, function() { showingFb=false; qIdx++; if(correct>=mg.passNeeded) showClear(2,3); else render(); });
        });
      }
    };
    render();
  },

  // ===== CHAPTER 3 =====
  _ch3: function(main) {
    var mgs = [Chapters.ch3.mg1, Chapters.ch3.mg2];
    var mgIdx = 0, qIdx = 0, correct = 0, showingFb = false;
    var qBank = {}, introShown = {};
    var render = function() {
      if (mgIdx >= mgs.length) { showClear(3,3); return; }
      var mg = mgs[mgIdx]; var pct = Math.round(mgIdx/mgs.length*100);
      if (qIdx === 0 && !introShown[mgIdx]) {
        introShown[mgIdx] = true;
        var introKey = 'ch3_' + mgIdx;
        if (CH_INTROS[introKey]) { showMgIntro(main, '第3章 本物の麻雀牌', mg.title, CH_INTROS[introKey], render); return; }
      }
      if (mgIdx === 0) {
        var q = getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        main.innerHTML = chHeader('第3章 本物の麻雀牌', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">'+mg.instruction+'</div>' +
          '<div class="game-area">'+Tiles.renderTile(Tiles.make(q.suit,q.num),{noHover:true})+
          '<div class="choice-grid" style="max-width:300px;margin-top:12px" id="suitC">'+
          ['man','pin','sou'].map(function(s,ci){return '<button class="btn-choice" data-suit="'+s+'" data-ci="'+ci+'">'+(s==='man'?'萬子':s==='pin'?'筒子':'索子')+'</button>';}).join('')+
          '</div><div id="feedback"></div></div>';
        document.querySelectorAll('#suitC .btn-choice').forEach(function(el) {
          el.addEventListener('click', function() {
            if (showingFb) return; showingFb = true;
            var ok = el.dataset.suit === q.suit; if(ok) correct++;
            document.querySelectorAll('#suitC .btn-choice').forEach(function(b){b.classList.add(b.dataset.suit===q.suit?'correct-ans':'wrong-ans');});
            showFeedback(ok, q.fb, function() {
              showingFb=false; qIdx++;
              if(correct>=mg.passNeeded){mgIdx=1;qIdx=0;correct=0;showMgClear(0,render);} else render();
            });
          });
        });
      } else {
        var q = getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        var sc3 = shuffledChoices(q.choices, Tiles.isSame.bind(Tiles));
        var handTiles = q.hand.map(function(t){return Tiles.make(t.suit,t.num);});
        main.innerHTML = chHeader('第3章 本物の麻雀牌', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">'+mg.instruction+'</div>' +
          '<div class="game-area"><div class="tiles-label">手牌（13枚）</div>' +
          '<div class="tiles-row">'+handTiles.map(function(t){return Tiles.renderTile(t,{noHover:true,small:true});}).join('')+'</div>' +
          '<div class="yn-tiles" id="choiceRow" style="margin-top:10px">'+
          sc3.choices.map(function(ch,ci){return '<div class="choice-tile" data-ci="'+ci+'">'+Tiles.renderTile(Tiles.make(ch.suit,ch.num),{})+'</div>';}).join('')+
          '</div><div id="feedback"></div></div>';
        bindChoiceTiles('#choiceRow .choice-tile', function(ci) {
          if (showingFb) return; showingFb = true;
          var ok = sc3.findOk(ci, q.answer); if(ok) correct++;
          showFeedback(ok, q.fb, function() { showingFb=false; qIdx++; if(correct>=mgs[1].passNeeded) showClear(3,3); else render(); });
        });
      }
    };
    render();
  },

  // ===== CHAPTER 4 =====
  _ch4: function(main) {
    var mgs = [Chapters.ch4.mg1, Chapters.ch4.mg2, Chapters.ch4.mg3];
    var mgIdx = 0, qIdx = 0, correct = 0, showingFb = false;
    var qBank = {}, introShown = {};
    var render = function() {
      if (mgIdx >= mgs.length) { showClear(4,3); return; }
      var pct = Math.round(mgIdx/mgs.length*100);
      if (qIdx === 0 && !introShown[mgIdx]) {
        introShown[mgIdx] = true;
        var introKey = 'ch4_' + mgIdx;
        var mg4 = mgs[mgIdx];
        if (CH_INTROS[introKey]) { showMgIntro(main, '第4章 字牌を覚えよう', mg4.title, CH_INTROS[introKey], render); return; }
      }

      if (mgIdx === 0) {
        // ── 字牌の見た目・名前説明（問題なし） ──
        var HONOR_DATA = [
          {suit:'wind',   num:1, name:'東', read:'トン',   desc:'東の方角を表す牌。場の風・自風になれる'},
          {suit:'wind',   num:2, name:'南', read:'ナン',   desc:'南の方角を表す牌。場の風・自風になれる'},
          {suit:'wind',   num:3, name:'西', read:'シャー', desc:'西の方角を表す牌。場の風・自風になれる'},
          {suit:'wind',   num:4, name:'北', read:'ペー',   desc:'北の方角を表す牌。場の風・自風になれる'},
          {suit:'dragon', num:1, name:'白', read:'ハク',   desc:'白くて何も書いていない牌。三元牌の1つ'},
          {suit:'dragon', num:2, name:'發', read:'ハツ',   desc:'緑色の文字の牌。三元牌の1つ'},
          {suit:'dragon', num:3, name:'中', read:'チュン', desc:'赤色の牌。三元牌の1つ'},
        ];

        // 説明ページのみ（問題なし）。ボタンを押したら次のミニゲームへ
        main.innerHTML = chHeader('第4章 字牌を覚えよう', mgs[0].title, pct, 0, 0) +
          '<div class="game-instruction">字牌は全部で<strong>7種類</strong>。見た目・名前・読み方を確認しよう！</div>' +
          '<div class="game-area">' +
            '<div class="honor-intro-grid">' +
              HONOR_DATA.map(function(h) {
                var t = Tiles.make(h.suit, h.num);
                return '<div class="honor-intro-item">' +
                  Tiles.renderTile(t, {noHover: true}) +
                  '<div class="honor-intro-name">' + h.name + '</div>' +
                  '<div class="honor-intro-sub">' + h.read + '</div>' +
                '</div>';
              }).join('') +
            '</div>' +
            '<div class="honor-desc-list">' +
              HONOR_DATA.map(function(h) {
                return '<div class="honor-desc-item">' +
                  '<span class="honor-desc-name">' + h.name + '（' + h.read + '）</span>' +
                  '<span class="honor-desc-text">' + esc(h.desc) + '</span>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button class="btn btn-primary btn-large" id="btnHonorNext">覚えた！次へ →</button>' +
          '</div>';

        document.getElementById('btnHonorNext').addEventListener('click', function() {
          mgIdx = 1; qIdx = 0; correct = 0;
          showMgClear(0, render);
        });

      } else if (mgIdx === 1) {
        var mg=mgs[1]; var q=getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        // 概念説明ヒント（字牌の性質を理解させる）
        var ch4mg2Hints = [
          'この問題は「この3枚が順子（じゅんし）になれるか？」を問う問題。順子とは<strong>同じ種類の牌</strong>で<strong>数字が1ずつ続く</strong>3枚のことだよ',
          '字牌（東・南・西・北・白・發・中）は「場所の名前」や「役の名前」の牌。萬子・筒子・索子のように1〜9の数字がないよ。数字がないと順子は作れないね',
        ];
        var hLvCh4 = 0;
        main.innerHTML = chHeader('第4章 字牌を覚えよう', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">'+mg.instruction+'</div>' +
          '<div class="game-area"><div class="tiles-row">'+q.tiles.map(function(t){return Tiles.renderTile(Tiles.make(t.suit,t.num),{noHover:true});}).join('')+'</div>' +
          '<div class="yn-panel" style="margin-top:14px"><button class="btn btn-yes" id="btnY">○ なる</button><button class="btn btn-no" id="btnN">✕ ならない</button></div>' +
          '<div id="feedback"></div></div>' +
          '<div class="btn-row"><button class="btn btn-hint" id="btnHintCh4">💡 ヒントを見る</button></div>' +
          '<div class="hint-box" id="hintBoxCh4"></div>';
        var handleYN=function(ch){if(showingFb)return;showingFb=true;var ok=ch===q.answer;if(ok)correct++;
          showFeedback(ok,q.fb,function(){showingFb=false;qIdx++;if(correct>=mg.passNeeded){mgIdx=2;qIdx=0;correct=0;showMgClear(1,render);}else render();});};
        document.getElementById('btnY').addEventListener('click',function(){handleYN(true);});
        document.getElementById('btnN').addEventListener('click',function(){handleYN(false);});
        document.getElementById('btnHintCh4').addEventListener('click', function() {
          var hb = document.getElementById('hintBoxCh4'), btn = document.getElementById('btnHintCh4');
          hLvCh4 = Math.min(hLvCh4 + 1, ch4mg2Hints.length);
          hb.innerHTML = '<span style="font-size:0.72rem;color:var(--gold);font-weight:700;display:block;margin-bottom:4px">ヒント' + hLvCh4 + '</span>' + ch4mg2Hints[hLvCh4-1];
          hb.classList.add('visible');
          if (hLvCh4 >= ch4mg2Hints.length) { btn.textContent = '💡 ヒントはここまで'; btn.disabled = true; }
          else btn.textContent = '💡 もっとヒント（' + (hLvCh4+1) + '/' + ch4mg2Hints.length + '）';
        });

      } else {
        var mg=mgs[2]; var q=getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        var poolTiles=Tiles.shuffle(q.pool.map(function(t){return Tiles.make(t.suit,t.num);})); var selIds=[];
        main.innerHTML = chHeader('第4章 字牌を覚えよう', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">散らばった字牌から<strong style="color:var(--gold)">'+Tiles.label(q.target)+' を3枚</strong>選ぼう！</div>' +
          '<div class="game-area"><div class="tiles-row" id="poolRow">'+poolTiles.map(function(t){return Tiles.renderTile(t,{});}).join('')+'</div>' +
          '<div id="feedback"></div></div>';
        document.querySelectorAll('#poolRow .tile').forEach(function(el,i) {
          el.addEventListener('click', function() {
            if (showingFb) return;
            var si=selIds.indexOf(i);
            if(si>=0){selIds.splice(si,1);el.classList.remove('selected');}else if(selIds.length<3){selIds.push(i);el.classList.add('selected');}
            if(selIds.length===3){
              var ok=selIds.map(function(si){return poolTiles[si];}).every(function(t){return Tiles.isSame(t,q.target);});
              showingFb=true; if(ok)correct++;
              showFeedback(ok,ok?q.fb:'おしい！同じ字牌を3枚選んでね。',function(){showingFb=false;selIds=[];qIdx++;if(correct>=mg.passNeeded)showClear(4,3);else render();});
            }
          });
        });
      }
    };
    render();
  },

  // ===== CHAPTER 5 =====
  _ch5: function(main) {
    var mgs=[Chapters.ch5.mg2,Chapters.ch5.mg3];
    var mgIdx=0,qIdx=0,correct=0,showingFb=false;
    var qBank={},introShown={};
    var render=function(){
      if(mgIdx>=mgs.length){showClear(5,3);return;}
      var pct=Math.round(mgIdx/mgs.length*100);
      if(qIdx===0&&!introShown[mgIdx]){
        introShown[mgIdx]=true;
        var introKey='ch5_'+mgIdx;
        var mg5=mgs[mgIdx];
        if(CH_INTROS[introKey]){showMgIntro(main,'第5章 役牌を作ろう',mg5.title,CH_INTROS[introKey],render);return;}
      }

      if(mgIdx===0){
        var mg=mgs[0];var q=getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        var ch5mg2Hints = [
          'この問題は「同じ牌3枚の刻子が役牌になれるか？」を問うもの。役牌とは<strong>刻子を作ると役（得点の権利）になる特定の牌</strong>のこと',
          '役牌になれる牌は決まっている：<strong>白・發・中（三元牌）</strong>と、<strong>場の風牌</strong>と<strong>自分の風牌</strong>。それ以外の牌の刻子は役牌にならないよ',
        ];
        var hLvCh5 = 0;
        main.innerHTML=chHeader('第5章 役牌を作ろう',mg.title,pct,correct,mg.passNeeded)+
          '<div class="game-instruction">'+mg.instruction+'</div>'+
          '<div class="game-area"><div class="tiles-row">'+q.tiles.map(function(t){return Tiles.renderTile(Tiles.make(t.suit,t.num),{noHover:true});}).join('')+'</div>'+
          '<div class="yn-panel" style="margin-top:14px"><button class="btn btn-yes" id="btnY">○ 役牌</button><button class="btn btn-no" id="btnN">✕ 役牌でない</button></div>'+
          '<div id="feedback"></div></div>'+
          '<div class="btn-row"><button class="btn btn-hint" id="btnHintCh5">💡 ヒントを見る</button></div>'+
          '<div class="hint-box" id="hintBoxCh5"></div>';
        var handleYN=function(ch){if(showingFb)return;showingFb=true;var ok=ch===q.answer;if(ok)correct++;
          showFeedback(ok,q.fb,function(){showingFb=false;qIdx++;if(correct>=mg.passNeeded){mgIdx=1;qIdx=0;correct=0;showMgClear(0,render);}else render();});};
        document.getElementById('btnY').addEventListener('click',function(){handleYN(true);});
        document.getElementById('btnN').addEventListener('click',function(){handleYN(false);});
        document.getElementById('btnHintCh5').addEventListener('click', function() {
          var hb=document.getElementById('hintBoxCh5'), btn=document.getElementById('btnHintCh5');
          hLvCh5=Math.min(hLvCh5+1,ch5mg2Hints.length);
          hb.innerHTML='<span style="font-size:0.72rem;color:var(--gold);font-weight:700;display:block;margin-bottom:4px">ヒント'+hLvCh5+'</span>'+ch5mg2Hints[hLvCh5-1];
          hb.classList.add('visible');
          if(hLvCh5>=ch5mg2Hints.length){btn.textContent='💡 ヒントはここまで';btn.disabled=true;}
          else btn.textContent='💡 もっとヒント（'+(hLvCh5+1)+'/'+ch5mg2Hints.length+'）';
        });

      }else{
        var mg=mgs[1];var q=getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        var sc5=shuffledChoices(q.choices, Tiles.isSame.bind(Tiles));
        var handTiles=q.hand.map(function(t){return Tiles.make(t.suit,t.num);});
        main.innerHTML=chHeader('第5章 役牌を作ろう',mg.title,pct,correct,mg.passNeeded)+
          '<div class="game-instruction">'+mg.instruction+'</div>'+
          '<div class="game-area"><div class="tiles-label">手牌</div><div class="tiles-row">'+handTiles.map(function(t){return Tiles.renderTile(t,{noHover:true,small:true});}).join('')+'</div>'+
          '<div class="yn-tiles" id="choiceRow" style="margin-top:12px">'+sc5.choices.map(function(ch,ci){return '<div class="choice-tile" data-ci="'+ci+'">'+Tiles.renderTile(Tiles.make(ch.suit,ch.num),{})+'</div>';}).join('')+'</div><div id="feedback"></div></div>';
        bindChoiceTiles('#choiceRow .choice-tile',function(ci){if(showingFb)return;showingFb=true;var ok=sc5.findOk(ci,q.answer);if(ok)correct++;
          showFeedback(ok,q.fb,function(){showingFb=false;qIdx++;if(correct>=mg.passNeeded)showClear(5,3);else render();});});
      }
    };
    render();
  },

  // ===== CHAPTER 6 =====
  _ch6: function(main) {
    // MG1: ポン・チー・鳴けない 3択  MG2: ポン・チー・スルー選択  MG3: 鳴いてアガろう
    var mgs = [Chapters.ch6.mg1, Chapters.ch6.mg3, Chapters.ch6.mg4];
    var mgIdx = 0, qIdx = 0, correct = 0, showingFb = false;
    var qBank = {}, introShown = {};

    var FROM_LABEL = { right:'右（下家）', left:'上家（左）', opposite:'対面', left_only:'上家（左）' };

    var render = function() {
      if (mgIdx >= mgs.length) { showClear(6, 3); return; }
      var mg = mgs[mgIdx];
      var pct = Math.round(mgIdx / mgs.length * 100);
      if (qIdx === 0 && !introShown[mgIdx]) {
        introShown[mgIdx] = true;
        var introKey = 'ch6_' + mgIdx;
        if (CH_INTROS[introKey]) { showMgIntro(main, '第6章 鳴きを覚えよう', mg.title, CH_INTROS[introKey], render); return; }
      }

      // ── MG1: ポン・チー・鳴けない 3択 ──
      if (mgIdx === 0) {
        var q = getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        var handTiles = q.hand.map(function(t) { return Tiles.make(t.suit, t.num); });
        var disc = Tiles.make(q.discard.suit, q.discard.num);
        var fromLabel = FROM_LABEL[q.from] || (q.from === 'left' ? '上家（左）' : '相手');
        // ボタン順をシャッフルして正解位置を固定させない
        var nakiStyles = {
          pon:  { label:'🔴 ポン',   style:'background:#c0392b;color:#fff' },
          chi:  { label:'🔵 チー',   style:'background:#2471a3;color:#fff' },
          none: { label:'⚪ 鳴けない', style:'' }
        };
        var nakiOrder = ['pon', 'chi', 'none']; // 固定順：ポン・チー・鳴けない

        main.innerHTML = chHeader('第6章 鳴きを覚えよう', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">' + mg.instruction + '</div>' +
          '<div class="game-area">' +
            '<div class="tiles-label">自分の手牌（一部）</div>' +
            '<div class="tiles-row">' + handTiles.map(function(t) { return Tiles.renderTile(t, {noHover:true}); }).join('') + '</div>' +
            '<div class="tiles-label" style="margin-top:12px">' + fromLabel + 'の捨て牌</div>' +
            '<div class="tiles-row">' + Tiles.renderTile(disc, {noHover:true}) + '</div>' +
            '<div class="btn-row" id="nakiBtns" style="margin-top:16px">' +
            nakiOrder.map(function(act) {
              var s = nakiStyles[act];
              return '<button class="btn btn-secondary" style="' + s.style + '" data-act="' + act + '">' + s.label + '</button>';
            }).join('') +
            '</div>' +
            '<div id="feedback"></div>' +
          '</div>' +
          '<div class="btn-row"><button class="btn btn-hint" id="btnHintCh6">💡 ヒントを見る</button></div>' +
          '<div class="hint-box" id="hintBoxCh6"></div>';

        var ch6mg1Hints = [
          'この問題は「ポン・チー・鳴けない」の3択。<strong>ポン</strong>とは他人の捨て牌で刻子（同じ3枚）を作る鳴き。<strong>チー</strong>とは左の人の捨て牌で順子（連続3枚）を作る鳴き',
          '<strong>ポン</strong>の条件：手牌に同じ牌が2枚あること（どの方向からでもOK）。<strong>チー</strong>の条件：上家（左の人）からの捨て牌のみで、手牌2枚と合わせて順子が作れること。どちらにも当てはまらなければ「鳴けない」',
        ];
        var hLvCh6 = 0;
        document.getElementById('btnHintCh6').addEventListener('click', function() {
          var hb=document.getElementById('hintBoxCh6'), btn=document.getElementById('btnHintCh6');
          hLvCh6=Math.min(hLvCh6+1,ch6mg1Hints.length);
          hb.innerHTML='<span style="font-size:0.72rem;color:var(--gold);font-weight:700;display:block;margin-bottom:4px">ヒント'+hLvCh6+'</span>'+ch6mg1Hints[hLvCh6-1];
          hb.classList.add('visible');
          if(hLvCh6>=ch6mg1Hints.length){btn.textContent='💡 ヒントはここまで';btn.disabled=true;}
          else btn.textContent='💡 もっとヒント（'+(hLvCh6+1)+'/'+ch6mg1Hints.length+'）';
        });

        document.querySelectorAll('#nakiBtns .btn').forEach(function(el) {
          el.addEventListener('click', function() {
            if (showingFb) return;
            showingFb = true;
            var ok = el.dataset.act === q.correct;
            if (ok) correct++;
            showFeedback(ok, q.fb, function() {
              showingFb = false; qIdx++;
              if (correct >= mg.passNeeded) { mgIdx++; qIdx = 0; correct = 0; showMgClear(0, render); }
              else render();
            });
          });
        });

      // ── MG2 (旧MG3): ポン・チー・スルー ──
      } else if (mgIdx === 1) {
        var q = getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        var handTiles = q.hand.map(function(t) { return Tiles.make(t.suit, t.num); });
        var disc = Tiles.make(q.discard.suit, q.discard.num);
        var lbls = { pon:'ポン', chi:'チー', skip:'スルー' };
        var fromLabel = q.from === 'left' ? '上家（左）' : '相手';
        // ボタン順シャッフル
        var actOrder = Tiles.shuffle(q.choices.slice());

        main.innerHTML = chHeader('第6章 鳴きを覚えよう', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">' + mg.instruction + '</div>' +
          '<div class="game-area">' +
            '<div class="tiles-label">自分の手牌（一部）</div>' +
            '<div class="tiles-row">' + handTiles.map(function(t) { return Tiles.renderTile(t, {noHover:true}); }).join('') + '</div>' +
            '<div class="tiles-label" style="margin-top:10px">' + fromLabel + 'の捨て牌</div>' +
            '<div class="tiles-row">' + Tiles.renderTile(disc, {noHover:true}) + '</div>' +
            '<div class="btn-row" id="actBtns" style="margin-top:14px">' +
            actOrder.map(function(a) {
              var style = a==='pon' ? 'background:#c0392b;color:#fff' : a==='chi' ? 'background:#2471a3;color:#fff' : '';
              return '<button class="btn btn-secondary" style="'+style+'" data-action="'+a+'">'+lbls[a]+'</button>';
            }).join('') +
            '</div><div id="feedback"></div></div>';

        document.querySelectorAll('#actBtns .btn').forEach(function(el) {
          el.addEventListener('click', function() {
            if (showingFb) return; showingFb = true;
            var ok = el.dataset.action === q.correctAction; if (ok) correct++;
            showFeedback(ok, q.fb, function() {
              showingFb = false; qIdx++;
              if (correct >= mg.passNeeded) { mgIdx++; qIdx = 0; correct = 0; showMgClear(1, render); }
              else render();
            });
          });
        });

      // ── MG3 (旧MG4): 鳴いてアガろう ──
      } else {
        var q = getShuffledQ(qBank, mgIdx, qIdx, mg.questions);
        var sc6 = shuffledChoices(q.choices, Tiles.isSame.bind(Tiles));
        var handTiles = q.hand.map(function(t) { return Tiles.make(t.suit, t.num); });
        main.innerHTML = chHeader('第6章 鳴きを覚えよう', mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">' + mg.instruction + '</div>' +
          '<div class="game-area">' +
          q.calledMelds.map(function(m) {
            return '<div class="tiles-row">' + m.map(function(t) { return Tiles.renderTile(Tiles.make(t.suit, t.num), {noHover:true}); }).join('') + '</div>';
          }).join('') +
          '<div class="tiles-label" style="margin-top:10px">手牌</div>' +
          '<div class="tiles-row">' + handTiles.map(function(t) { return Tiles.renderTile(t, {noHover:true, small:true}); }).join('') + '</div>' +
          '<div class="yn-tiles" id="choiceRow" style="margin-top:10px">' +
          sc6.choices.map(function(ch, ci) {
            return '<div class="choice-tile" data-ci="' + ci + '">' + Tiles.renderTile(Tiles.make(ch.suit, ch.num), {}) + '</div>';
          }).join('') +
          '</div><div id="feedback"></div></div>';

        bindChoiceTiles('#choiceRow .choice-tile', function(ci) {
          if (showingFb) return; showingFb = true;
          var ok = sc6.findOk(ci, q.answer); if (ok) correct++;
          showFeedback(ok, q.fb, function() {
            showingFb = false; qIdx++;
            if (correct >= mg.passNeeded) showClear(6, 3); else render();
          });
        });
      }
    };
    render();
  },

  // ===== CHAPTER 7 =====
  _ch7: function(main) {
    var allQs=Tiles.shuffle(Chapters.ch7.questions.slice());
    var qIdx=0,correct=0,showingFb=false,introShown=false;
    var handleQ=function(ok,fb){
      if(showingFb)return;showingFb=true;if(ok)correct++;
      showFeedback(ok,fb,function(){showingFb=false;qIdx++;render();});
    };
    var render=function(){
      if(!introShown){
        introShown=true;
        if(CH_INTROS.ch7){showMgIntro(main,'第7章 復習テスト',Chapters.ch7.title,CH_INTROS.ch7,render);return;}
      }
      if(qIdx>=allQs.length){
        var g=qIdx>=10?correct>=10?{g:'もう打てる雀士',s:3}:correct>=8?{g:'期待の雀士',s:3}:correct>=7?{g:'初級雀士',s:2}:{g:'見習い雀士',s:1}:{g:'見習い雀士',s:1};
        Progress.setStars(7,g.s);if(g.s>=2)Progress.addTitle('道場初級クリア');
        main.innerHTML='<div class="clear-screen"><div class="clear-icon">🏆</div><div class="clear-title">道場チャレンジ 終了！</div>' +
          '<div class="stars-row">'+starsHtml(g.s)+'</div>' +
          '<div style="font-size:1.3rem;font-weight:900;color:var(--gold);margin-bottom:12px">段位：'+g.g+'</div>' +
          '<div style="font-size:1.1rem;color:#a8d8b0;margin-bottom:20px">正解 '+correct+' / '+allQs.length+' 問</div>' +
          (correct<7?'<div class="game-instruction" style="margin-bottom:18px">もう少し！チャプター1〜6を復習するともっと強くなれるよ。</div>':'')+
          '<div class="btn-row"><button class="btn btn-primary" id="btnR7">もう一度</button><button class="btn btn-secondary" id="btnCh7">章選択へ</button></div></div>';
        document.getElementById('btnR7').addEventListener('click',function(){App.navigate('chapter',{id:7});});
        document.getElementById('btnCh7').addEventListener('click',function(){App.navigate('chapters');});
        return;
      }
      var q=allQs[qIdx];var pct=Math.round(qIdx/allQs.length*100);
      var qHtml='';
      if(q.type==='find_set'||q.type==='find_pair'){
        // 牌の表示順をシャッフル → 正解位置を固定しない
        var numsIdx7=q.nums.map(function(n,i){return{n:n,oi:i};});
        var shuffled7=Tiles.shuffle(numsIdx7);
        var tiles=shuffled7.map(function(x){return Tiles.makeNum(x.n);});
        // 元の答えインデックス → シャッフル後のインデックスに変換
        var newAns7=shuffled7.reduce(function(acc,x,di){
          if(q.answer.indexOf(x.oi)>=0) acc.push(di); return acc;
        },[]).sort(function(a,b){return a-b;});
        var sel=q.type==='find_set'?3:2; var selected=[];
        qHtml='<div class="tiles-row" id="qTiles">'+tiles.map(function(t){return Tiles.renderTile(t,{});}).join('')+'</div><div style="color:#8ab89c;font-size:0.83rem;margin-top:6px">'+sel+'枚選ぼう</div><div id="feedback"></div>';
        main.innerHTML='<div class="game-wrap">'+
          '<div class="game-header"><div class="game-chapter-title">第7章 道場チャレンジ</div><div class="game-mg-title">問題'+(qIdx+1)+'/'+allQs.length+'</div></div>'+
          '<div class="game-progress-bar-wrap"><div class="game-progress-bar" style="width:'+pct+'%"></div></div>'+
          '<div class="game-score-text">現在の正解数：'+correct+'問</div>'+
          '<div class="game-instruction"><strong>'+q.q+'</strong></div>'+
          '<div class="game-area">'+qHtml+'</div></div>';
        document.querySelectorAll('#qTiles .tile').forEach(function(el,i){
          el.addEventListener('click',function(){if(showingFb)return;var si=selected.indexOf(i);
            if(si>=0){selected.splice(si,1);el.classList.remove('selected');}else if(selected.length<sel){selected.push(i);el.classList.add('selected');}
            if(selected.length===sel){
              var s2=selected.slice().sort(function(a,b){return a-b;});
              handleQ(s2.join(',')===newAns7.join(','),q.fb);
            }});});
        return;
      }
      if(q.type==='is_set_yn'||q.type==='is_honor_yn'||q.type==='is_yakuhai'||q.type==='can_pon'||q.type==='can_chi'){
        var dTiles=(q.tiles||q.hand||[]).map(function(t){return Tiles.make(t.suit,t.num);});
        var dDisc=q.discard?Tiles.make(q.discard.suit,q.discard.num):null;
        qHtml='<div class="tiles-row">'+dTiles.map(function(t){return Tiles.renderTile(t,{noHover:true});}).join('')+'</div>'+
          (dDisc?'<div style="margin-top:8px;color:#8ab89c;font-size:0.8rem">捨て牌：</div><div class="tiles-row">'+Tiles.renderTile(dDisc,{noHover:true})+'</div>':'')+
          '<div class="yn-panel" style="margin-top:12px"><button class="btn btn-yes" id="btnY">○ はい</button><button class="btn btn-no" id="btnN">✕ いいえ</button></div><div id="feedback"></div>';
      }else if(q.type==='suit_id'){
        var tile=Tiles.make(q.tile.suit,q.tile.num);
        qHtml=Tiles.renderTile(tile,{noHover:true})+'<div class="choice-grid" style="max-width:300px;margin-top:12px" id="suitC">'+
          ['man','pin','sou'].map(function(s,ci){return '<button class="btn-choice" data-suit="'+s+'" data-ci="'+ci+'">'+(s==='man'?'萬子':s==='pin'?'筒子':'索子')+'</button>';}).join('')+'</div><div id="feedback"></div>';
      }else if(q.type==='agari_tile'){
        var handT=q.hand.map(function(t){return Tiles.make(t.suit,t.num);});
        var sc7=shuffledChoices(q.choices, Tiles.isSame.bind(Tiles));
        qHtml='<div class="tiles-label">手牌（13枚）</div><div class="tiles-row">'+handT.map(function(t){return Tiles.renderTile(t,{noHover:true,small:true});}).join('')+'</div>'+
          '<div class="yn-tiles" id="choiceRow" style="margin-top:10px">'+sc7.choices.map(function(ch,ci){return '<div class="choice-tile" data-ci="'+ci+'">'+Tiles.renderTile(Tiles.make(ch.suit,ch.num),{})+'</div>';}).join('')+'</div><div id="feedback"></div>';
      }
      main.innerHTML='<div class="game-wrap">'+
        '<div class="game-header"><div class="game-chapter-title">第7章 道場チャレンジ</div><div class="game-mg-title">問題'+(qIdx+1)+'/'+allQs.length+'</div></div>'+
        '<div class="game-progress-bar-wrap"><div class="game-progress-bar" style="width:'+pct+'%"></div></div>'+
        '<div class="game-score-text">現在の正解数：'+correct+'問</div>'+
        '<div class="game-instruction"><strong>'+q.q+'</strong></div>'+
        '<div class="game-area">'+qHtml+'</div></div>';
      var yBtn=document.getElementById('btnY'),nBtn=document.getElementById('btnN');
      if(yBtn)yBtn.addEventListener('click',function(){handleQ(true===q.answer,q.fb);});
      if(nBtn)nBtn.addEventListener('click',function(){handleQ(false===q.answer,q.fb);});
      document.querySelectorAll('#suitC .btn-choice').forEach(function(el){el.addEventListener('click',function(){if(showingFb)return;showingFb=true;var ok=el.dataset.suit===q.answer;
        document.querySelectorAll('#suitC .btn-choice').forEach(function(b){b.classList.add(b.dataset.suit===q.answer?'correct-ans':'wrong-ans');});
        if(ok)correct++;showFeedback(ok,q.fb,function(){showingFb=false;qIdx++;render();});});});
      // sc7はagari_tile時のみ有効
      if(q.type==='agari_tile'){
        bindChoiceTiles('#choiceRow .choice-tile',function(ci){handleQ(sc7.findOk(ci,q.answer),q.fb);});
      }
    };
    render();
  },

  // ===== Generic quiz-style chapter engine (Ch 8-12) =====
  // Data shape: Chapters['ch'+id] = { mgs: [ { type:'yn'|'choice'|'agari', title, instruction,
  //   passNeeded, yesLabel?, noLabel?, handLabel?, questions:[...] } ] }
  _chQuiz: function(main, ch) {
    var def = Chapters['ch' + ch.id];
    if (!def || !def.mgs) { main.innerHTML = '<p style="color:red">章データが見つかりません</p>'; return; }
    var mgs = def.mgs;
    var navTitle = '第' + ch.id + '章 ' + ch.short;
    var mgIdx = 0, qIdx = 0, correct = 0, showingFb = false;
    var qBank = {}, introShown = {};

    var render = function() {
      if (mgIdx >= mgs.length) { showClear(ch.id, 3); return; }
      var mg = mgs[mgIdx];
      var pct = Math.round(mgIdx / mgs.length * 100);
      if (qIdx === 0 && !introShown[mgIdx]) {
        introShown[mgIdx] = true;
        var introKey = 'ch' + ch.id + '_' + mgIdx;
        if (CH_INTROS[introKey]) { showMgIntro(main, navTitle, mg.title, CH_INTROS[introKey], render); return; }
      }
      var q = getShuffledQ(qBank, mgIdx, qIdx, mg.questions);

      // advance to next question / mini-game / chapter clear
      var advance = function(ok) {
        if (showingFb) return;
        showingFb = true;
        if (ok) correct++;
        showFeedback(ok, q.fb, function() {
          showingFb = false; qIdx++;
          if (correct >= mg.passNeeded) {
            if (mgIdx >= mgs.length - 1) { showClear(ch.id, 3); }
            else { var done = mgIdx; mgIdx++; qIdx = 0; correct = 0; showMgClear(done, render); }
          } else render();
        });
      };

      var promptHtml = q.text ? '<div class="game-instruction" style="background:rgba(0,0,0,0.18)"><strong>' + q.text + '</strong></div>' : '';
      var tilesHtml = '';
      if (q.tiles) {
        var smallT = q.tiles.length > 7;
        tilesHtml = '<div class="tiles-row">' + q.tiles.map(function(t) {
          return Tiles.renderTile(Tiles.make(t.suit, t.num), {noHover: true, small: smallT});
        }).join('') + '</div>';
      }

      if (mg.type === 'yn') {
        main.innerHTML = chHeader(navTitle, mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">' + mg.instruction + '</div>' +
          '<div class="game-area">' + promptHtml + tilesHtml +
          '<div class="yn-panel" style="margin-top:14px">' +
            '<button class="btn btn-yes" id="btnY">' + (mg.yesLabel || '○ はい') + '</button>' +
            '<button class="btn btn-no" id="btnN">' + (mg.noLabel || '✕ いいえ') + '</button>' +
          '</div><div id="feedback"></div></div>';
        document.getElementById('btnY').addEventListener('click', function() { advance(q.answer === true); });
        document.getElementById('btnN').addEventListener('click', function() { advance(q.answer === false); });

      } else if (mg.type === 'choice') {
        var opts = Tiles.shuffle(q.choices.slice());
        main.innerHTML = chHeader(navTitle, mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">' + mg.instruction + '</div>' +
          '<div class="game-area">' + promptHtml + tilesHtml +
          '<div class="choice-grid" style="max-width:420px;margin:14px auto 0" id="optGrid">' +
          opts.map(function(o, ci) { return '<button class="btn-choice" data-ci="' + ci + '">' + esc(o) + '</button>'; }).join('') +
          '</div><div id="feedback"></div></div>';
        document.querySelectorAll('#optGrid .btn-choice').forEach(function(el) {
          el.addEventListener('click', function() {
            if (showingFb) return;
            var ci = parseInt(el.dataset.ci, 10);
            var ok = opts[ci] === q.answer;
            document.querySelectorAll('#optGrid .btn-choice').forEach(function(b) {
              b.classList.add(opts[parseInt(b.dataset.ci, 10)] === q.answer ? 'correct-ans' : 'wrong-ans');
            });
            advance(ok);
          });
        });

      } else { // 'agari' — pick the correct tile
        var handTiles = (q.hand || []).map(function(t) { return Tiles.make(t.suit, t.num); });
        var sc = shuffledChoices(q.choices, Tiles.isSame.bind(Tiles));
        main.innerHTML = chHeader(navTitle, mg.title, pct, correct, mg.passNeeded) +
          '<div class="game-instruction">' + mg.instruction + '</div>' +
          '<div class="game-area">' + promptHtml +
          '<div class="tiles-label">' + (mg.handLabel || '手牌') + '</div>' +
          '<div class="tiles-row">' + handTiles.map(function(t) { return Tiles.renderTile(t, {noHover: true, small: true}); }).join('') + '</div>' +
          '<div class="yn-tiles" id="choiceRow" style="margin-top:12px">' +
          sc.choices.map(function(c, ci) { return '<div class="choice-tile" data-ci="' + ci + '">' + Tiles.renderTile(Tiles.make(c.suit, c.num), {}) + '</div>'; }).join('') +
          '</div><div id="feedback"></div></div>';
        bindChoiceTiles('#choiceRow .choice-tile', function(ci) { advance(sc.findOk(ci, q.answer)); });
      }
    };
    render();
  },

  // ===== Friend Battle（友人戦） =====
  _renderFriend: function(main) {
    var self = this;
    if (this._frClockTimer) {
      clearTimeout(this._frClockTimer);
      this._frClockTimer = null;
    }

    // ルームの更新が来たら友人戦ページを再描画（初回だけ登録）
    if (!this._friendHooked) {
      this._friendHooked = true;
      if (window.FriendGame) FriendGame.onChange(function() {
        if (self.current === 'friend') self._render('friend', {});
      });
    }

    // ログイン必須（対戦相手に名前を表示するため）
    if (!window.Auth || !Auth.enabled() || !Auth.user()) {
      main.innerHTML = '<div class="page-title">友人戦</div>' +
        '<div class="game-instruction">友人戦にはログインが必要です。<br>右上の「👤 ログイン」からログインしてください。</div>' +
        '<div class="btn-row" style="justify-content:flex-start;margin-top:14px"><button class="btn btn-primary" id="btnGoLogin">ログイン画面へ</button></div>';
      document.getElementById('btnGoLogin').addEventListener('click', function() { self.navigate('login'); });
      return;
    }

    var room = FriendGame.room();

    // ── ロビー（部屋を作る / 6桁IDで参加）──
    if (!room) {
      main.innerHTML = '<div class="page-title">友人戦</div>' +
        '<div class="fr-wrap">' +
        '<div class="game-instruction">友だちに<strong>6桁のルームID</strong>を伝えて同じ部屋に入れます。<br>' +
        '<span style="font-size:0.82rem;color:#8ab89c">ホストが三麻/四麻、東風/半荘、持ち時間、CPU席を設定できます。</span></div>' +
        '<input class="ai-input fr-room-input" id="frCode" type="text" inputmode="numeric" maxlength="6" placeholder="参加するID（作成時は空でもOK）" style="width:100%;margin:12px 0 10px">' +
        '<div class="fr-row" id="frCount" style="margin-bottom:14px">' +
          '<span style="color:#8ab89c;font-size:0.85rem">人数：</span>' +
          '<button class="ai-level-btn" data-n="3">3人打ち</button>' +
          '<button class="ai-level-btn active" data-n="4">4人打ち</button>' +
        '</div>' +
        '<div class="btn-row" style="justify-content:flex-start">' +
          '<button class="btn btn-primary" id="btnFrCreate">ルームを作成</button>' +
          '<button class="btn btn-secondary" id="btnFrJoin">IDで参加</button>' +
        '</div>' +
        '<div id="frErr" style="color:#ff9a8a;font-size:0.85rem;margin-top:10px;min-height:1.3em"></div>' +
        '</div>';

      var count = 4;
      document.querySelectorAll('#frCount .ai-level-btn').forEach(function(b) {
        b.addEventListener('click', function() {
          document.querySelectorAll('#frCount .ai-level-btn').forEach(function(x) { x.classList.remove('active'); });
          b.classList.add('active');
          count = parseInt(b.dataset.n, 10);
        });
      });
      var errEl = document.getElementById('frErr');
      if (FriendGame.error && FriendGame.error()) {
        errEl.textContent = FriendGame.errorMessage(FriendGame.error());
      }
      document.getElementById('frCode').addEventListener('input', function(e) {
        e.target.value = FriendGame.normalizeCode(e.target.value);
      });
      var getCode = function(requireCode) {
        var c = FriendGame.normalizeCode(document.getElementById('frCode').value);
        if (requireCode && !/^\d{6}$/.test(c)) { errEl.textContent = '6桁のルームIDを入力してください'; return null; }
        return c;
      };
      document.getElementById('btnFrCreate').addEventListener('click', function() {
        var c = getCode(false);
        errEl.textContent = '';
        FriendGame.createRoom(c, count)['catch'](function(e) { errEl.textContent = FriendGame.errorMessage(e) || '部屋を作れませんでした'; });
      });
      document.getElementById('btnFrJoin').addEventListener('click', function() {
        var c = getCode(true); if (!c) return;
        errEl.textContent = '';
        FriendGame.joinRoom(c)['catch'](function(e) { errEl.textContent = FriendGame.errorMessage(e) || '参加できませんでした'; });
      });
      return;
    }

    // ── 待機室 ──
    if (room.status === 'waiting') {
      var need = room.playerCount - room.players.length;
      var rules = FriendGame.rules();
      var readyMap = room.readyMap || {};
      var meUid = Auth.user().uid;
      var myReady = readyMap[meUid] === true;
      var canStart = FriendGame.allReady();
      var hostControls = '';
      if (FriendGame.isHost()) {
        hostControls = '<div class="fr-panel fr-rule-panel">' +
          '<div class="fr-panel-title">ルール設定</div>' +
          '<div class="fr-rule-grid">' +
            '<label>人数<div class="fr-segment" id="frRuleCount">' +
              '<button class="ai-level-btn ' + (rules.playerCount === 3 ? 'active' : '') + '" data-rule-player-count="3">三麻</button>' +
              '<button class="ai-level-btn ' + (rules.playerCount === 4 ? 'active' : '') + '" data-rule-player-count="4">四麻</button>' +
            '</div></label>' +
            '<label>試合<div class="fr-segment" id="frRuleGame">' +
              '<button class="ai-level-btn ' + (rules.gameType === 'tonpu' ? 'active' : '') + '" data-rule-game-type="tonpu">東風</button>' +
              '<button class="ai-level-btn ' + (rules.gameType === 'hanchan' ? 'active' : '') + '" data-rule-game-type="hanchan">半荘</button>' +
            '</div></label>' +
            '<label>持ち点<input class="ai-input fr-small-input" id="frStartScore" type="number" min="10000" max="60000" step="1000" value="' + rules.startScore + '"></label>' +
            '<label>基本秒<input class="ai-input fr-small-input" id="frBaseSec" type="number" min="3" max="15" value="' + rules.baseSeconds + '"></label>' +
            '<label>持ち時間<input class="ai-input fr-small-input" id="frReserveSec" type="number" min="0" max="120" step="5" value="' + rules.reserveSeconds + '"></label>' +
            '<label class="fr-check-label"><input id="frSudden" type="checkbox" ' + (rules.suddenDeath ? 'checked' : '') + '> サドンデス</label>' +
          '</div>' +
          '<div class="fr-rule-note">変更するとReadyは解除されます。</div>' +
        '</div>';
      }
      main.innerHTML = '<div class="page-title">待機室</div>' +
        '<div class="fr-wrap">' +
        '<div class="game-instruction">ルームID：<strong class="fr-room-code">' + esc(room.code) + '</strong><br>' +
        '友だちにこのIDを伝えて「IDで参加」してもらおう！</div>' +
        hostControls +
        '<div class="fr-panel"><div class="fr-panel-title">メンバー（' + room.players.length + '/' + room.playerCount + '）</div>' +
        room.players.map(function(p, i) {
          var isCpu = !!p.isCpu || String(p.uid || '').indexOf('cpu:') === 0;
          var ready = isCpu || readyMap[p.uid] === true;
          return '<div class="fr-row fr-lobby-player"><span class="fr-name">' + esc(p.name) + '</span>' +
            (i === 0 ? '<span class="fr-host-badge">ホスト</span>' : '') +
            (isCpu ? '<span class="fr-cpu-badge">CPU</span>' : '<span class="fr-ready-badge ' + (ready ? 'ready' : '') + '">' + (ready ? 'Ready' : '未Ready') + '</span>') +
            (FriendGame.isHost() && isCpu ? '<button class="fr-mini-btn" data-remove-cpu="' + esc(p.uid) + '">外す</button>' : '') +
            '</div>';
        }).join('') +
        (need > 0 ? '<div style="color:#8ab89c;font-size:0.85rem;margin-top:6px">あと' + need + '席あります</div>' : '') +
        (FriendGame.isHost() && need > 0 ? '<div class="btn-row" style="justify-content:flex-start;margin-top:8px"><button class="btn btn-secondary" id="btnFrAddCpu">CPUを追加</button></div>' : '') +
        '</div>' +
        '<div class="btn-row" style="justify-content:flex-start">' +
        '<button class="btn ' + (myReady ? 'btn-secondary' : 'btn-primary') + '" id="btnFrReady">' + (myReady ? 'Ready解除' : 'Ready') + '</button>' +
        (FriendGame.isHost() ? '<button class="btn btn-primary" id="btnFrStart" ' + (!canStart ? 'disabled style="opacity:0.5"' : '') + '>対局開始</button>' : '') +
        '<button class="btn btn-secondary" id="btnFrLeave">退出</button></div>' +
        '<div id="frErr" style="color:#ff9a8a;font-size:0.85rem;margin-top:10px"></div></div>';

      var setErr = function(e) { document.getElementById('frErr').textContent = FriendGame.errorMessage(e) || String((e && e.message) || e || ''); };
      var updateRule = function(patch) {
        FriendGame.updateRules(patch)['catch'](setErr);
      };
      document.querySelectorAll('[data-rule-player-count]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var pc = parseInt(btn.dataset.rulePlayerCount, 10);
          updateRule({ playerCount: pc, startScore: pc === 3 ? 35000 : 25000 });
        });
      });
      document.querySelectorAll('[data-rule-game-type]').forEach(function(btn) {
        btn.addEventListener('click', function() { updateRule({ gameType: btn.dataset.ruleGameType }); });
      });
      var bindRuleInput = function(id, key, parse) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function() {
          var patch = {};
          patch[key] = parse ? parse(el.value) : el.value;
          updateRule(patch);
        });
      };
      bindRuleInput('frStartScore', 'startScore', function(v) { return parseInt(v, 10); });
      bindRuleInput('frBaseSec', 'baseSeconds', function(v) { return parseInt(v, 10); });
      bindRuleInput('frReserveSec', 'reserveSeconds', function(v) { return parseInt(v, 10); });
      var sudden = document.getElementById('frSudden');
      if (sudden) sudden.addEventListener('change', function() { updateRule({ suddenDeath: sudden.checked }); });
      var addCpu = document.getElementById('btnFrAddCpu');
      if (addCpu) addCpu.addEventListener('click', function() { FriendGame.addCpu()['catch'](setErr); });
      document.querySelectorAll('[data-remove-cpu]').forEach(function(btn) {
        btn.addEventListener('click', function() { FriendGame.removeCpu(btn.dataset.removeCpu)['catch'](setErr); });
      });
      document.getElementById('btnFrReady').addEventListener('click', function() {
        FriendGame.setReady(!myReady)['catch'](setErr);
      });
      var startBtn = document.getElementById('btnFrStart');
      if (startBtn) startBtn.addEventListener('click', function() {
        FriendGame.startGame()['catch'](setErr);
      });
      document.getElementById('btnFrLeave').addEventListener('click', function() {
        FriendGame.leaveRoom().then(function() { self._render('friend', {}); });
      });
      return;
    }

    // ── 対局画面 ──
    var g = FriendGame.game();
    if (!g) { main.innerHTML = '<div class="fr-msg">読み込み中…</div>'; return; }
    var my = FriendGame.mySeat();
    var n = g.playerCount;
    var names = room.players.map(function(p) { return p.name; });
    if (my < 0 || my >= n) {
      main.innerHTML = '<div class="fr-wrap"><div class="fr-panel"><div class="page-title">友人戦</div>' +
        '<div class="game-instruction">この部屋の参加メンバーではありません。ルームIDから入り直してください。</div>' +
        '<div class="btn-row"><button class="btn btn-primary" id="btnFrLeave2">ロビーへ</button></div></div></div>';
      document.getElementById('btnFrLeave2').addEventListener('click', function() {
        FriendGame.leaveRoom().then(function() { self._render('friend', {}); });
      });
      return;
    }

    if (this._frSeq !== g.seq) {
      this._frSeq = g.seq;
      this._frRiichiSel = false;
      this._frRonSent = false;
      this._frResponseSent = false;
      this._frSelectedIdx = -1;
    }
    if (this._frSortTiles == null) this._frSortTiles = localStorage.getItem('mj_friend_sort_tiles') !== '0';
    main.classList.add('battle-main');
    document.body.classList.add('is-battle-page');

    var WINDS = ['東', '南', '西', '北'];
    var dealerSeat = (g.round - 1) % n;
    var seatWind = function(seat) {
      return WINDS[(seat - dealerSeat + n) % n] || WINDS[seat] || '';
    };
    var isTurnSeat = function(seat) {
      return (g.phase === 'turn' || g.phase === 'naki_discard') && g.turn === seat;
    };
    var nukiCount = function(seat) {
      return g.nuki && g.nuki[seat] ? g.nuki[seat].length : 0;
    };
    var isDisconnected = function(seat) {
      return !!(g.disconnected && g.disconnected[seat]);
    };
    var showDiff = !!(this._frShowDiffUntil && Date.now() < this._frShowDiffUntil);
    var scoreText = function(seat) {
      if (!showDiff) return g.scores[seat].toLocaleString();
      var diff = g.scores[seat] - g.scores[my];
      if (seat === my) return '基準';
      return (diff > 0 ? '+' : '') + diff.toLocaleString();
    };
    var timer = g.turnTimer || null;
    var timerLeft = timer ? Math.max(0, timer.deadlineAt - Date.now()) : 0;
    var timerTotal = timer ? Math.max(1, timer.baseMs + timer.reserveMs) : 1;
    var timerPct = Math.max(0, Math.min(100, Math.round(timerLeft / timerTotal * 100)));
    var timerHtml = timer ? '<div class="fr-turn-timer ' + (timerLeft <= 5000 ? 'warn' : '') + '">' +
      '<span>' + (Math.ceil(timerLeft / 1000)) + 's</span><i style="width:' + timerPct + '%"></i></div>' : '';
    var meldSetHtml = function(melds) {
      return (melds || []).map(function(m, mi) {
        var typeLabel = m.type === 'pon' ? 'ポン' : m.type === 'chi' ? 'チー' : m.type === 'kan' ? 'カン' : '暗カン';
        var tiles = (m.tiles || []).map(function(t, ti) {
          var isCalled = m.calledTile && t.id === m.calledTile.id;
          var isHidden = m.type === 'ankan' && (ti === 0 || ti === 3);
          if (isHidden) return Tiles.renderTile({ suit: 'back', num: 0, id: 'frh_' + mi + '_' + ti }, { faceDown: true, noHover: true, extraClass: 'xxs' });
          return Tiles.renderTile(t, { noHover: true, extraClass: 'xxs' + (isCalled ? ' meld-called' : '') });
        }).join('');
        return '<div class="fr-meld-set meld-set meld-' + esc(m.type) + '"><span class="meld-type-label">' + typeLabel + '</span>' + tiles + '</div>';
      }).join('');
    };
    var meldHtml = function(seat) {
      var html = meldSetHtml(g.melds && g.melds[seat]);
      return html ? '<div class="fr-melds">' + html + '</div>' : '';
    };
    var nukiHtml = function(seat) {
      var tiles = g.nuki && g.nuki[seat] ? g.nuki[seat] : [];
      if (!tiles.length) return '';
      return '<div class="fr-nuki-row"><span>抜き北</span>' + tiles.map(function(t) {
        return Tiles.renderTile(t, { noHover: true, extraClass: 'xxs' });
      }).join('') + '</div>';
    };
    var riverHtml = function(seat) {
      return '<div class="fr-river">' + (g.discards[seat] || []).map(function(t) {
        return Tiles.renderTile(t, { noHover: true, extraClass: 'xxs' + (t.riichiDiscard ? ' fr-riichi-tile' : '') });
      }).join('') + '</div>';
    };
    var plate = function(seat) {
      return '<span class="fr-wind">' + seatWind(seat) + '</span>' +
        '<span class="fr-name">' + esc(names[seat] || ('P' + (seat + 1))) + '</span>' +
        '<span class="fr-score">' + scoreText(seat) + (showDiff && seat !== my ? '' : '点') + '</span>' +
        (isDisconnected(seat) ? '<span class="fr-disconnect-mark">⚡</span>' : '') +
        (nukiCount(seat) > 0 ? '<span class="fr-nuki-badge">北x' + nukiCount(seat) + '</span>' : '') +
        (g.riichi[seat] ? '<span class="fr-riichi-badge">リーチ</span>' : '') +
        (isTurnSeat(seat) ? '<span style="font-size:0.72rem;color:var(--gold)">▶ 手番</span>' : '');
    };

    var msg = '';
    if (g.phase === 'turn') msg = (g.turn === my) ? 'あなたの番！捨てる牌を選んでね' : esc(names[g.turn]) + ' の番です…';
    if (g.phase === 'naki_discard') msg = (g.turn === my) ? '鳴いた後です。1枚捨ててね' : esc(names[g.turn]) + ' が鳴いた後の捨て牌を選んでいます…';
    if (g.phase === 'ron_wait') msg = (g.ron && g.ron.candidates.indexOf(my) >= 0) ? 'ロンできます！' : 'ロン判定待ち…';
    if (g.phase === 'call_wait') msg = (g.call && g.call.candidates.indexOf(my) >= 0) ? '鳴けます！' : '鳴き判定待ち…';
    if (this._frRiichiSel) msg = 'リーチ宣言：テンパイが保てる牌を捨ててね（リーチをもう一度押すと取消）';

    var myHand = g.hands[my] || [];
    var myTurn = isTurnSeat(my);
    var drawnEntry = null;
    var sortedEntries = [];
    myHand.forEach(function(t, i) {
      var entry = { tile: t, idx: i };
      if (g.phase === 'turn' && t.id === g.drawnId) drawnEntry = entry;
      else sortedEntries.push(entry);
    });
    var friendTileSortKey = function(t) {
      var suitOrd = { man: 0, pin: 1, sou: 2, wind: 3, dragon: 4, num: 5, colored: 6 };
      var colorOrd = { red: 0, blue: 1, green: 2 };
      return [
        suitOrd[t.suit] || 0,
        t.suit === 'colored' ? (colorOrd[t.color] || 0) : 0,
        t.num || 0,
      ];
    };
    if (this._frSortTiles) {
      sortedEntries.sort(function(a, b) {
        var ak = friendTileSortKey(a.tile);
        var bk = friendTileSortKey(b.tile);
        for (var si = 0; si < ak.length; si++) {
          if (ak[si] !== bk[si]) return ak[si] - bk[si];
        }
        return 0;
      });
    }
    var displayEntries = sortedEntries.concat(drawnEntry ? [drawnEntry] : []);

    var myMelds = (g.melds && g.melds[my]) || [];
    var isClosed = myMelds.every(function(m) { return m.type === 'ankan'; });
    var ankanCands = (myTurn && g.phase === 'turn') ? FriendGame.checkAnkan(my) : [];
    var canNuki = g.isSanma && myTurn && g.phase === 'turn' && myHand.some(function(t) { return FriendGame.isNukiTile(t); });
    var actionBtns = '';
    if (myTurn && g.phase === 'turn' && Agari.isWinningHand(myHand)) actionBtns += '<button class="btn-battle btn-tsumo" id="btnFrTsumo">ツモ！</button>';
    if (canNuki) actionBtns += '<button class="btn-battle btn-nuki" id="btnFrNuki">北抜き</button>';
    ankanCands.forEach(function(c, ci) {
      actionBtns += '<button class="btn-battle btn-ankan" data-ankan-idx="' + ci + '">暗カン ' + esc(Tiles.label(c.tiles[0])) + '</button>';
    });
    if (myTurn && g.phase === 'turn' && isClosed && !g.riichi[my] && g.scores[my] >= 1000 && myHand.length % 3 === 2)
      actionBtns += '<button class="btn-battle btn-riichi" id="btnFrRiichi">リーチ</button>';
    if (g.phase === 'ron_wait' && g.ron && g.ron.candidates.indexOf(my) >= 0 && !this._frResponseSent) {
      actionBtns += '<button class="btn-battle btn-ron" id="btnFrRon">ロン！</button>' +
              '<button class="btn-battle btn-skip" id="btnFrPass">スルー</button>';
    }
    if (g.phase === 'call_wait' && g.call && g.call.candidates.indexOf(my) >= 0 && !this._frResponseSent) {
      var callOpts = (g.call.optionsBySeat && g.call.optionsBySeat[my]) || [];
      callOpts.forEach(function(opt, oi) {
        var label = opt.type === 'pon' ? 'ポン' : opt.type === 'chi' ? 'チー' : 'カン';
        var callClass = opt.type === 'pon' ? 'btn-pon' : opt.type === 'chi' ? 'btn-chi' : 'btn-kan';
        actionBtns += '<button class="btn-battle ' + callClass + '" data-call-idx="' + oi + '" data-call-type="' + esc(opt.type) + '">' + label + '</button>';
      });
      actionBtns += '<button class="btn-battle btn-skip-call" id="btnFrPass">スルー</button>';
    }
    var myFlags = FriendGame.autoFlags(my);
    var autoControls = '<div class="fr-auto-controls">' +
      '<button class="fr-toggle ' + (myFlags.agari ? 'active' : '') + '" data-fr-auto="agari">和了</button>' +
      '<button class="fr-toggle ' + (myFlags.tsumogiri ? 'active' : '') + '" data-fr-auto="tsumogiri">ツモ切り</button>' +
      '<button class="fr-toggle ' + (myFlags.noCalls ? 'active' : '') + '" data-fr-auto="noCalls">鳴きなし</button>' +
      '<button class="fr-toggle ' + (this._frSortTiles ? 'active' : '') + '" id="btnFrSortTiles">理牌</button>' +
    '</div>';

    var endHtml = '';
    if (g.phase === 'hand_end' || g.phase === 'match_end') {
      var r = g.result;
      if (g.phase === 'match_end') {
        var rank = names.map(function(nm, i) { return { nm: nm, sc: g.scores[i] }; })
          .sort(function(a, b) { return b.sc - a.sc; });
        endHtml = '<div class="fr-result-float"><div class="fr-panel" style="border-color:var(--gold)"><div class="page-title" style="margin-bottom:8px">対局終了</div>' +
          rank.map(function(x, i) { return '<div class="fr-row"><span>' + (i + 1) + '位</span><span class="fr-name">' + esc(x.nm) + '</span><span class="fr-score">' + x.sc.toLocaleString() + '点</span></div>'; }).join('') +
          '<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" id="btnFrExit">部屋を出る</button></div></div></div>';
      } else if (r && r.type === 'ryukyoku') {
        endHtml = '<div class="fr-result-float"><div class="fr-panel"><strong>流局</strong>（山がなくなりました）' +
          (FriendGame.isHost() ? '<div class="btn-row" style="margin-top:10px"><button class="btn btn-primary" id="btnFrNext">' + (g.round >= g.roundLimit ? '最終結果へ' : '次の局へ') + '</button></div>' : '<div style="font-size:0.8rem;color:#8ab89c;margin-top:8px">ホストの操作を待っています…</div>') +
          '</div></div>';
      } else if (r) {
        var resultHand = Tiles.sortTiles((r.hand || []).slice());
        endHtml = '<div class="fr-result-float"><div class="fr-panel" style="border-color:var(--gold)">' +
          '<div style="font-size:1.1rem;font-weight:900;color:var(--gold);margin-bottom:6px">' +
            esc(names[r.winner]) + ' の' + (r.type === 'tsumo' ? 'ツモ' : 'ロン') + '！</div>' +
          '<div class="fr-river" style="margin-bottom:8px">' + resultHand.map(function(t) { return Tiles.renderTile(t, { noHover: true, extraClass: 'xxs' }); }).join('') + '</div>' +
          (r.melds && r.melds.length ? '<div class="fr-melds">' + meldSetHtml(r.melds) + '</div>' : '') +
          (r.nuki && r.nuki.length ? '<div class="fr-nuki-row"><span>抜き北</span>' + r.nuki.map(function(t) { return Tiles.renderTile(t, { noHover: true, extraClass: 'xxs' }); }).join('') + '</div>' : '') +
          r.yaku.map(function(y) { return '<div class="fr-row"><span>' + esc(y.name) + '</span><span class="fr-score">' + y.han + '翻</span></div>'; }).join('') +
          '<div style="font-weight:900;color:var(--gold);margin:6px 0">' + r.han + '翻 ' + r.pts.toLocaleString() + '点</div>' +
          (r.uraInd ? '<div class="fr-row" style="margin-bottom:6px"><span style="font-size:0.8rem;color:#8ab89c">裏ドラ表示牌</span>' + Tiles.renderTile(r.uraInd, { noHover: true, extraClass: 'xxs' }) + '</div>' : '') +
          ((r.kanDoraInds || []).length ? '<div class="fr-row" style="margin-bottom:6px"><span style="font-size:0.8rem;color:#8ab89c">カンドラ表示牌</span>' + r.kanDoraInds.map(function(t) { return Tiles.renderTile(t, { noHover: true, extraClass: 'xxs' }); }).join('') + '</div>' : '') +
          r.deltas.map(function(d, i) { return d !== 0 ? '<div class="fr-row"><span>' + esc(names[i]) + '</span><span style="color:' + (d > 0 ? 'var(--gold)' : '#ff9a8a') + '">' + (d > 0 ? '+' : '') + d.toLocaleString() + '</span></div>' : ''; }).join('') +
          (FriendGame.isHost() ? '<div class="btn-row" style="margin-top:10px"><button class="btn btn-primary" id="btnFrNext">' + (g.round >= g.roundLimit ? '最終結果へ' : '次の局へ') + '</button></div>' : '<div style="font-size:0.8rem;color:#8ab89c;margin-top:8px">ホストの操作を待っています…</div>') +
          '</div></div>';
      }
    }

    var selfSeat = my;
    var rightSeat = (my + 1) % n;
    var topSeat = (my + 2) % n;
    var leftSeat = n === 4 ? (my + 3) % n : -1;
    var visualSeats = [selfSeat, rightSeat, topSeat].concat(leftSeat >= 0 ? [leftSeat] : []);
    var isSanma = n === 3;

    var hiddenTiles = function(prefix, count, max) {
      var total = Math.min(count || 0, max || 13);
      var html = '';
      for (var i = 0; i < total; i++) {
        html += Tiles.renderTile({ suit: 'back', num: 0, id: prefix + i }, { faceDown: true, noHover: true, extraClass: 'xxs' });
      }
      return html;
    };
    var renderDiscardRiver = function(discards, seat) {
      var RIVER_COLS = 6;
      var RIVER_ROWS = 4;
      var tiles = (discards || []).slice(0, RIVER_COLS * RIVER_ROWS).map(function(tile, i) {
        var isRiichi = tile && tile.riichiDiscard;
        var cls = 'river-tile' + (isRiichi ? ' river-riichi' : '');
        var tileHtml = Tiles.renderTile(tile, { noHover: true, extraClass: cls });
        var col = i % RIVER_COLS;
        var rowIdx = Math.floor(i / RIVER_COLS);
        var gridColumn = seat === 'opposite' ? (RIVER_COLS - col) : (col + 1);
        var gridRow = seat === 'opposite' ? (RIVER_ROWS - rowIdx) : (rowIdx + 1);
        return '<div class="rtile-wrap" style="grid-column:' + gridColumn + ';grid-row:' + gridRow + '">' + tileHtml + '</div>';
      }).join('');
      return '<div class="disc-river disc-river-' + seat + '">' + tiles + '</div>';
    };
    var seatAvatarText = function(seat) {
      if (seat === my) return '私';
      var nm = names[seat] || ('P' + (seat + 1));
      return esc(nm.slice(0, 1));
    };
    var seatBadge = function(seat, pos) {
      if (seat < 0 || seat >= n) return '';
      return '<div class="jt-seat jt-seat-' + pos + ' seat-' + seat + '">' +
        '<div class="jt-seat-avatar"><span>' + seatAvatarText(seat) + '</span></div>' +
        '<div class="jt-seat-caption">' +
          '<div class="jt-seat-name">' + esc(names[seat] || ('P' + (seat + 1))) + '</div>' +
          '<div class="jt-seat-points">' + g.scores[seat].toLocaleString() + '</div>' +
        '</div>' +
      '</div>';
    };
    var centerScoresHtml = '<div class="jt-center-score-list">' +
      visualSeats.map(function(seat) {
        return '<div class="jt-center-score-item seat-' + seat + ' ' + (seat === my ? 'me' : '') + '">' +
          '<span class="wind">' + seatWind(seat) + '</span>' +
          '<span class="name">' + esc(names[seat] || ('P' + (seat + 1))) + '</span>' +
          '<span class="pts ' + (showDiff && seat !== my ? (g.scores[seat] >= g.scores[my] ? 'plus' : 'minus') : '') + '">' + scoreText(seat) + '</span>' +
          (isDisconnected(seat) ? '<span class="fr-disconnect-mark">⚡</span>' : '') +
          (g.riichi[seat] ? '<span class="riichi">R</span>' : '') +
          (isSanma && nukiCount(seat) > 0 ? '<span class="nuki">北' + nukiCount(seat) + '</span>' : '') +
        '</div>';
      }).join('') + '</div>';
    var centerHtml = '<div class="jt-center"><div class="jt-center-panel fr-score-toggle" id="frScoreToggle" title="点差表示">' +
      '<div class="jt-center-roundline">東' + g.round + '局<span>山' + g.wall.length + '枚</span></div>' +
      timerHtml +
      centerScoresHtml +
    '</div></div>';
    var doraHtml = '<div class="jt-table-dora">ドラ表示：' +
      Tiles.renderTile(g.doraInd, { noHover: true, extraClass: 'xxs' }) +
      ((g.kanDoraInds || []).length ? (g.kanDoraInds || []).map(function(t) {
        return Tiles.renderTile(t, { noHover: true, extraClass: 'xxs' });
      }).join('') : '') +
    '</div>';
    var handTilesHtml = displayEntries.map(function(entry) {
      var isDrawn = drawnEntry && entry.idx === drawnEntry.idx;
      var isSelected = self._frSelectedIdx === entry.idx;
      return (isDrawn ? '<span class="fr-drawn-gap"></span>' : '') +
        '<span data-idx="' + entry.idx + '" class="fr-tile-wrap">' +
          Tiles.renderTile(entry.tile, { noHover: !myTurn, selected: isSelected }) +
        '</span>';
    }).join('');
    var actionHtml = '<div class="jt-battle-actions fr-table-actions">' +
      '<span class="fr-table-msg">' + msg + '</span>' +
      actionBtns +
    '</div>';
    var perPlayerMeldsHtml = '';
    var seatCls = {};
    seatCls[my] = 'seat-self';
    seatCls[topSeat] = 'seat-opposite';
    seatCls[rightSeat] = 'seat-right';
    if (leftSeat >= 0) seatCls[leftSeat] = 'seat-left';
    visualSeats.forEach(function(seat) {
      var sets = meldSetHtml(g.melds && g.melds[seat]);
      var nuki = nukiHtml(seat);
      if (!sets && !nuki) return;
      perPlayerMeldsHtml += '<div class="player-meld-area ' + seatCls[seat] + '">' + sets + nuki + '</div>';
    });

    main.innerHTML = '<div class="jt-outer fr-jt-outer">' +
      '<div class="jt-game-topbar">' +
        '<span class="fr-code-chip">ID：' + esc(room.code) + '</span>' +
        '<span class="fr-rule-chip">' + (g.isSanma ? '3人打ち' : '4人打ち') + '</span>' +
        '<button class="jt-game-nav" id="btnFrLeave2">退出</button>' +
      '</div>' +
      '<div class="jt-row ' + (isSanma ? 'sanma' : '') + '">' +
        (leftSeat >= 0 ? '<div class="jt-side"></div>' : '<div class="jt-side jt-side-empty"></div>') +
        '<div class="jt-table ' + (isSanma ? 'sanma' : '') + '">' +
          '<div class="jt-table-perspective" aria-hidden="true"></div>' +
          seatBadge(topSeat, 'top') +
          (leftSeat >= 0 ? seatBadge(leftSeat, 'left') : '') +
          seatBadge(rightSeat, 'right') +
          seatBadge(my, 'self') +
          doraHtml +
          '<div class="jt-hidden-hand jt-hidden-top">' + hiddenTiles('fr-top-wall-', (g.hands[topSeat] || []).length, 13) + '</div>' +
          (leftSeat >= 0 ? '<div class="jt-hidden-hand jt-hidden-left">' + hiddenTiles('fr-left-wall-', (g.hands[leftSeat] || []).length, 13) + '</div>' : '') +
          '<div class="jt-hidden-hand jt-hidden-right">' + hiddenTiles('fr-right-wall-', (g.hands[rightSeat] || []).length, 13) + '</div>' +
          renderDiscardRiver(g.discards[topSeat], 'opposite') +
          '<div class="jt-table-mid">' +
            (leftSeat >= 0 ? renderDiscardRiver(g.discards[leftSeat], 'left') : '') +
            centerHtml +
            renderDiscardRiver(g.discards[rightSeat], 'right') +
          '</div>' +
          renderDiscardRiver(g.discards[my], 'self') +
          '<div class="jt-hand-in-table">' +
            '<div class="jt-hand-infobar">' +
              '<span><span class="wind">' + seatWind(my) + '</span> あなた</span>' +
              '<span class="score">' + g.scores[my].toLocaleString() + '点</span>' +
              (isSanma ? '<span class="mj-nuki-count">抜き北 ' + nukiCount(my) + '</span>' : '') +
              (g.riichi[my] ? '<span class="mj-riichi-badge">リーチ中</span>' : '') +
              (isDisconnected(my) ? '<span class="fr-disconnect-mark">⚡ 切断扱い</span>' : '') +
            '</div>' +
            '<div class="jt-hand-tiles-row fr-table-hand" id="frHand"><div class="mj-sorted-tiles">' + handTilesHtml + '</div></div>' +
            autoControls +
            actionHtml +
          '</div>' +
          perPlayerMeldsHtml +
          endHtml +
        '</div>' +
        '<div class="jt-side"></div>' +
      '</div>' +
    '</div>';
    positionDiscardRivers();

    var sendFrAction = function(type, payload) {
      FriendGame.sendAction(type, payload)['catch'](function(e) {
        showToast(FriendGame.errorMessage(e), 4200);
      });
    };

    // ── イベント ──
    var scoreToggle = document.getElementById('frScoreToggle');
    if (scoreToggle) scoreToggle.addEventListener('click', function() {
      self._frShowDiffUntil = Date.now() + 5000;
      self._render('friend', {});
    });
    document.querySelectorAll('[data-fr-auto]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var next = {
          agari: !!myFlags.agari,
          tsumogiri: !!myFlags.tsumogiri,
          noCalls: !!myFlags.noCalls,
        };
        next[btn.dataset.frAuto] = !next[btn.dataset.frAuto];
        sendFrAction('auto_flags', { flags: next });
      });
    });
    var sortBtn = document.getElementById('btnFrSortTiles');
    if (sortBtn) sortBtn.addEventListener('click', function() {
      self._frSortTiles = !self._frSortTiles;
      localStorage.setItem('mj_friend_sort_tiles', self._frSortTiles ? '1' : '0');
      self._render('friend', {});
    });
    var discardIdx = function(idx) {
      var tile = myHand[idx];
      if (!tile) return;
      if (g.riichi[my] && tile.id !== g.drawnId) { showToast('リーチ中はツモった牌しか捨てられないよ'); return; }
      self._frSelectedIdx = -1;
      if (self._frRiichiSel) {
        var rest = myHand.filter(function(_, i) { return i !== idx; });
        if (!FriendGame.isTenpai13(rest)) { showToast('その牌を捨てるとテンパイが崩れちゃう！'); return; }
        sendFrAction('riichi', { idx: idx });
      } else {
        sendFrAction('discard', { idx: idx });
      }
    };
    if (myTurn) {
      document.querySelectorAll('#frHand .fr-tile-wrap').forEach(function(el) {
        var drag = null;
        el.addEventListener('pointerdown', function(e) {
          drag = { x: e.clientX, y: e.clientY };
          try { el.setPointerCapture(e.pointerId); } catch (ex) {}
        });
        el.addEventListener('pointermove', function(e) {
          if (!drag) return;
          var dy = Math.min(0, e.clientY - drag.y);
          if (dy < -8) el.style.transform = 'translateY(' + Math.max(dy, -48) + 'px)';
        });
        el.addEventListener('pointerup', function(e) {
          var idx = parseInt(el.dataset.idx, 10);
          var slideDiscard = drag && (drag.y - e.clientY) > 46;
          el.style.transform = '';
          drag = null;
          if (slideDiscard || self._frSelectedIdx === idx) {
            discardIdx(idx);
          } else {
            self._frSelectedIdx = idx;
            self._render('friend', {});
          }
        });
        el.addEventListener('pointercancel', function() {
          el.style.transform = '';
          drag = null;
        });
      });
    }
    var tsumoBtn = document.getElementById('btnFrTsumo');
    if (tsumoBtn) tsumoBtn.addEventListener('click', function() { sendFrAction('tsumo'); });
    var nukiBtn = document.getElementById('btnFrNuki');
    if (nukiBtn) nukiBtn.addEventListener('click', function() {
      var north = myHand.find(function(t) { return FriendGame.isNukiTile(t); });
      if (north) sendFrAction('nuki', { tileId: north.id });
    });
    document.querySelectorAll('[data-ankan-idx]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var cand = ankanCands[parseInt(btn.dataset.ankanIdx, 10)];
        if (cand && cand.tiles && cand.tiles[0]) {
          sendFrAction('ankan', { tile: { suit: cand.tiles[0].suit, num: cand.tiles[0].num } });
        }
      });
    });
    var riichiBtn = document.getElementById('btnFrRiichi');
    if (riichiBtn) riichiBtn.addEventListener('click', function() {
      self._frRiichiSel = !self._frRiichiSel;
      self._render('friend', {});
    });
    var ronBtn = document.getElementById('btnFrRon');
    if (ronBtn) ronBtn.addEventListener('click', function() {
      self._frResponseSent = true;
      self._frRonSent = true;
      sendFrAction('ron');
      self._render('friend', {});
    });
    document.querySelectorAll('[data-call-idx]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self._frResponseSent = true;
        sendFrAction('call', {
          optionIdx: parseInt(btn.dataset.callIdx, 10),
          callType: btn.dataset.callType,
        });
        self._render('friend', {});
      });
    });
    var passBtn = document.getElementById('btnFrPass');
    if (passBtn) passBtn.addEventListener('click', function() {
      self._frResponseSent = true;
      self._frRonSent = true;
      sendFrAction('pass');
      self._render('friend', {});
    });
    var nextBtn = document.getElementById('btnFrNext');
    if (nextBtn) nextBtn.addEventListener('click', function() { sendFrAction('next_round'); });
    var exitBtn = document.getElementById('btnFrExit');
    if (exitBtn) exitBtn.addEventListener('click', function() { FriendGame.leaveRoom().then(function() { self._render('friend', {}); }); });
    document.getElementById('btnFrLeave2').addEventListener('click', function() {
      if (confirm('対局から退出しますか？（ルームIDでまた戻れます）')) {
        FriendGame.leaveRoom().then(function() { self._render('friend', {}); });
      }
    });
    if (g.turnTimer || (self._frShowDiffUntil && Date.now() < self._frShowDiffUntil)) {
      this._frClockTimer = setTimeout(function() {
        if (self.current === 'friend') self._render('friend', {});
      }, 1000);
    }
  },

  // ===== Login / Account =====
  _renderLogin: function(main) {
    var self = this;

    // Firebase未設定のときは設定手順を案内
    if (!window.Auth || !Auth.enabled()) {
      main.innerHTML = '<div class="page-title">ログイン</div>' +
        '<div class="game-instruction">Firebaseの設定がまだ完了していません。<br><br>' +
        '<strong>static/js/firebase-config.js</strong> を開き、Firebaseコンソール' +
        '（プロジェクトの設定 → マイアプリ → ウェブアプリ）の構成値を貼り付けてください。<br>' +
        'あわせてコンソールの <strong>Authentication → ログイン方法</strong> で' +
        '「メール / パスワード」と「Google」を有効にしてください。</div>';
      return;
    }

    // ログイン済み → アカウント画面
    var u = Auth.user();
    if (u) {
      var hasPasswordProvider = Auth.hasPasswordProvider && Auth.hasPasswordProvider();
      var hasGoogleProvider = Auth.hasGoogleProvider && Auth.hasGoogleProvider();
      var loginProviderText = hasGoogleProvider ? 'Google' : 'メール / パスワード';
      var deleteAuthHtml = hasPasswordProvider
        ? '<input class="ai-input" id="delPass" type="password" placeholder="確認のためパスワードを入力" style="width:100%;margin-bottom:10px">'
        : '<div class="google-delete-note">削除前にGoogleアカウントで本人確認します。</div>';
      main.innerHTML = '<div class="page-title">アカウント</div>' +
        '<div style="max-width:460px;background:rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px">' +
        '<div style="font-size:0.85rem;color:#8ab89c;margin-bottom:4px">名前' +
          (u.displayName ? '' : '（まだ設定されていません。入力して保存してね）') + '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:14px">' +
          '<input class="ai-input" id="accName" type="text" value="' + esc(u.displayName || '') + '" placeholder="名前を入力" style="flex:1">' +
          '<button class="btn btn-secondary" id="btnSaveName" style="white-space:nowrap">保存</button>' +
        '</div>' +
        '<div style="margin-bottom:6px">メール：<strong>' + esc(u.email || '') + '</strong> ✅確認済み</div>' +
        '<div style="margin-bottom:12px;color:#8ab89c;font-size:0.85rem">登録方法：' + loginProviderText + '</div>' +
        '<div id="accMsg" style="color:#ff9a8a;font-size:0.82rem;min-height:1.2em;margin-bottom:4px"></div>' +
        '<div style="font-size:0.85rem;color:#8ab89c;margin-bottom:16px">学習進捗（クリア状況・星・称号）は自動でクラウドに保存され、他の端末でも引き継げます。</div>' +
        '<button class="btn btn-secondary" id="btnLogout">ログアウト</button>' +
        // ── 危険操作ゾーン：アカウント削除（2段階式） ──
        '<div style="margin-top:22px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08)">' +
          '<button class="btn btn-hint" id="btnDeleteToggle" style="color:#ff9a8a;font-size:0.8rem">⚠ アカウントを削除する</button>' +
          '<div id="deleteArea" style="display:none;margin-top:12px;padding:14px;border:1px solid rgba(255,120,100,0.4);border-radius:10px;background:rgba(120,30,20,0.15)">' +
            '<div style="font-size:0.85rem;color:#ff9a8a;line-height:1.7;margin-bottom:10px">' +
              '<strong>この操作は取り消せません。</strong><br>' +
              'クラウドに保存された学習進捗とアカウントが完全に削除されます。<br>' +
              '<span style="color:#8ab89c">※この端末内の進捗（localStorage）は残ります</span></div>' +
            deleteAuthHtml +
            '<button class="btn btn-secondary" id="btnDeleteConfirm" style="background:#8c2f28;border-color:#e9a49b;color:#ffe9e4">完全に削除する</button>' +
            '<div id="delMsg" style="color:#ff9a8a;font-size:0.82rem;min-height:1.2em;margin-top:8px"></div>' +
          '</div>' +
        '</div></div>';

      // 削除エリアの開閉
      document.getElementById('btnDeleteToggle').addEventListener('click', function() {
        var area = document.getElementById('deleteArea');
        area.style.display = area.style.display === 'none' ? 'block' : 'none';
      });

      // 削除の実行（登録方法に応じた再認証つき）
      var delBusy = false;
      document.getElementById('btnDeleteConfirm').addEventListener('click', function() {
        if (delBusy) return;
        var passEl = document.getElementById('delPass');
        var pass = passEl ? passEl.value : '';
        var delMsg = document.getElementById('delMsg');
        if (hasPasswordProvider && !pass) { delMsg.textContent = 'パスワードを入力してください'; return; }
        if (!confirm('本当にアカウントを削除しますか？\nクラウドの学習進捗もすべて消えます。')) return;
        delBusy = true;
        delMsg.textContent = hasPasswordProvider ? '削除しています…' : 'Googleで本人確認しています…';
        Auth.deleteAccount(pass).then(function() {
          delBusy = false;
          showToast('アカウントを削除しました');
          self._render('login', {});
        })['catch'](function(e) {
          delBusy = false;
          delMsg.textContent = Auth.jaError(e);
        });
      });

      document.getElementById('btnSaveName').addEventListener('click', function() {
        var name = document.getElementById('accName').value.trim();
        var msgEl = document.getElementById('accMsg');
        if (!name) { msgEl.textContent = '名前を入力してください'; return; }
        msgEl.textContent = '';
        Auth.updateName(name).then(function() {
          showToast('名前を「' + name + '」に設定しました');
          self._render('login', {});
        })['catch'](function(e) {
          msgEl.textContent = Auth.jaError(e);
        });
      });
      document.getElementById('btnLogout').addEventListener('click', function() {
        Auth.logout().then(function() {
          showToast('ログアウトしました');
          self._render('login', {});
        });
      });
      return;
    }

    // 未ログイン → ログイン / 新規登録フォーム
    main.innerHTML = '<div class="page-title">ログイン / 新規登録</div>' +
      '<div style="max-width:420px">' +
      '<button class="btn btn-google" id="btnGoogleLogin" type="button">' +
        '<span class="google-mark">G</span><span>Googleで続ける</span>' +
      '</button>' +
      '<div class="auth-divider"><span>または</span></div>' +
      '<input class="ai-input" id="authEmail" type="email" placeholder="メールアドレス" style="width:100%;margin-bottom:10px">' +
      '<input class="ai-input" id="authPass" type="password" placeholder="パスワード（6文字以上）" style="width:100%;margin-bottom:14px">' +
      '<div class="btn-row" style="justify-content:flex-start">' +
        '<button class="btn btn-primary" id="btnLogin">ログイン</button>' +
        '<button class="btn btn-secondary" id="btnRegister">新規登録</button>' +
      '</div>' +
      '<div id="authError" style="color:#ff9a8a;font-size:0.85rem;margin-top:10px;min-height:1.3em"></div>' +
      '<button class="btn btn-hint" id="btnResend" style="display:none;margin-top:6px;font-size:0.78rem">📧 確認メールを再送する</button>' +
      '<button class="btn btn-hint" id="btnPwReset" style="margin-top:6px;font-size:0.78rem">パスワードを忘れた（リセットメール送信）</button>' +
      '<div style="font-size:0.8rem;color:#8ab89c;margin-top:16px;line-height:1.7">' +
        '新規登録すると<strong>確認メール</strong>が届きます。メール内のリンクをクリックしてからログインしてください。<br>' +
        'ログインすると学習進捗がクラウドに保存され、別の端末・ブラウザでも続きから学習できます。</div>' +
      '</div>';

    var errEl = document.getElementById('authError');
    var resendBtn = document.getElementById('btnResend');
    var busy = false;
    var val = function(id) { return document.getElementById(id).value; };

    document.getElementById('btnGoogleLogin').addEventListener('click', function() {
      if (busy) return;
      busy = true; errEl.textContent = '';
      Auth.loginWithGoogle().then(function() {
        busy = false;
        showToast('Googleアカウントでログインしました');
        self._render('login', {});
      })['catch'](function(e) {
        busy = false;
        errEl.textContent = Auth.jaError(e);
      });
    });

    // 新規登録完了後に表示する「確認メールを送ったよ」画面
    var showVerifySent = function(email) {
      main.innerHTML = '<div class="page-title">確認メールを送信しました</div>' +
        '<div style="max-width:460px;background:rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;line-height:1.8">' +
        '<div style="font-size:2rem;text-align:center;margin-bottom:8px">📧</div>' +
        '<strong>' + esc(email) + '</strong> 宛てに確認メールを送りました。<br>' +
        'メール内のリンクをクリックして登録を完了してから、ログインしてください。<br>' +
        '<span style="font-size:0.8rem;color:#8ab89c">※メールが見つからないときは迷惑メールフォルダも確認してね</span><br><br>' +
        '<button class="btn btn-primary" id="btnGoLogin">ログイン画面へ</button></div>';
      document.getElementById('btnGoLogin').addEventListener('click', function() {
        self._render('login', {});
      });
    };

    document.getElementById('btnLogin').addEventListener('click', function() {
      if (busy) return;
      busy = true; errEl.textContent = '';
      Auth.login(val('authEmail').trim(), val('authPass')).then(function() {
        busy = false;
        showToast('ログインしました');
        self._render('login', {});
      })['catch'](function(e) {
        busy = false;
        errEl.textContent = Auth.jaError(e);
        // メール未確認エラーのときだけ「再送」ボタンを出す
        if (e && e.code === 'app/email-not-verified') resendBtn.style.display = 'inline-block';
      });
    });

    document.getElementById('btnRegister').addEventListener('click', function() {
      if (busy) return;
      var email = val('authEmail').trim();
      busy = true; errEl.textContent = '';
      Auth.register(email, val('authPass')).then(function() {
        busy = false;
        showVerifySent(email);
      })['catch'](function(e) {
        busy = false;
        errEl.textContent = Auth.jaError(e);
      });
    });

    resendBtn.addEventListener('click', function() {
      if (busy) return;
      busy = true; errEl.textContent = '';
      Auth.resendVerification(val('authEmail').trim(), val('authPass')).then(function() {
        busy = false;
        // すでに確認済みだった場合はそのままログインが成立している
        if (Auth.user()) { showToast('ログインしました'); self._render('login', {}); }
        else showToast('確認メールを再送しました 📧', 3000);
      })['catch'](function(e) {
        busy = false;
        errEl.textContent = Auth.jaError(e);
      });
    });

    document.getElementById('btnPwReset').addEventListener('click', function() {
      var em = val('authEmail').trim();
      if (!em) { errEl.textContent = 'メールアドレスを入力してからボタンを押してください'; return; }
      Auth.resetPassword(em)
        .then(function() { showToast('リセットメールを送信しました'); })
        ['catch'](function(e) { errEl.textContent = Auth.jaError(e); });
    });
  },

  // ===== Yaku List =====
  _renderYaku: function(main, filter) {
    var self = this;
    var filters = [{k:'all',l:'すべて'},{k:'1',l:'1翻'},{k:'2',l:'2翻'},{k:'3',l:'3翻'},{k:'6',l:'6翻'},{k:'yakuman',l:'役満'}];
    var filtered = filter==='all' ? GameData.YAKU : GameData.YAKU.filter(function(y){return String(y.han)===filter;});
    main.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
      '<div class="page-title" style="margin-bottom:0">役一覧</div>' +
      '<button class="btn btn-secondary" id="btnYakuQuiz" style="font-size:0.82rem;padding:7px 14px">📝 役クイズ</button></div>' +
      '<div class="yaku-tabs" id="yakuTabs">'+filters.map(function(f){return '<button class="tab-btn '+(filter===f.k?'active':'')+'" data-f="'+f.k+'">'+f.l+'</button>';}).join('')+'</div>' +
      '<div class="yaku-grid" id="yakuGrid">'+filtered.map(function(y){return '<div class="yaku-card" data-id="'+y.id+'">' +
        '<div class="yaku-name">'+y.name+'</div><div class="yaku-reading">'+y.reading+'</div>' +
        '<span class="yaku-han '+(y.han==='yakuman'?'yakuman':'')+'">'+( y.han==='yakuman'?'役満':y.han+'翻')+'</span>' +
        '<span class="yaku-naki">'+(y.hanOpen===null?'鳴き不可':y.hanOpen==='yakuman'?'鳴き可':'鳴き'+y.hanOpen+'翻')+'</span></div>';}).join('')+'</div>';
    document.getElementById('btnYakuQuiz').addEventListener('click', function() { self.navigate('quiz', {source:'yaku'}); });
    document.querySelectorAll('#yakuTabs .tab-btn').forEach(function(el){el.addEventListener('click',function(){self._renderYaku(main,el.dataset.f);});});
    document.querySelectorAll('#yakuGrid .yaku-card').forEach(function(el){el.addEventListener('click',function(){self.navigate('yaku_detail',{id:el.dataset.id});});});
  },

  // ===== Yaku Detail (with example hand + AI) =====
  _renderYakuDetail: function(main, id) {
    var self = this;
    var y = GameData.YAKU.find(function(y){return y.id===id;});
    if (!y) { main.innerHTML='<p style="color:red">役が見つかりません</p>'; return; }

    var exHtml = renderYakuExampleBoard(y);

    main.innerHTML = '<div class="yaku-detail">' +
      '<h2>'+y.name+'</h2><div class="reading">'+y.reading+'</div>' +
      '<div class="han-badge">'+(y.han==='yakuman'?'役満':y.han+'翻')+' ／ '+(y.hanOpen===null?'鳴き不可':y.hanOpen==='yakuman'?'鳴き可（役満）':'鳴き'+y.hanOpen+'翻')+'</div>' +
      exHtml +
      '<div class="detail-section"><h3>成立条件</h3><p>'+esc(y.condition)+'</p></div>' +
      '<div class="detail-section mistake-box"><strong>よくある間違い：</strong><br>'+esc(y.mistake)+'</div>' +
      (y.chapter?'<div class="detail-section"><h3>練習できる章</h3><button class="btn btn-secondary" id="btnPractice">第'+y.chapter+'章で練習する</button></div>':'') +
      '<div class="ai-panel"><div class="ai-panel-title"><span>🤖</span> AI先生に質問する</div>' +
      '<div class="ai-level-row" id="aiLevelRow">' +
        '<button class="ai-level-btn active" data-lv="beginner">🔰 初心者（やさしい）</button>' +
        '<button class="ai-level-btn" data-lv="advanced">⚡ 上級者（プロ視点）</button>' +
      '</div>' +
      '<div id="yakuLevelDesc" style="font-size:0.76rem;color:#8ab89c;margin-bottom:8px">' +
        '🔰 麻雀用語を使わず、日常語でやさしく解説します。' +
      '</div>' +
      '<div class="ai-mode-row" id="aiModeRow" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
        '<button class="ai-level-btn active" data-mode="rule">ルール確認</button>' +
        '<button class="ai-level-btn" data-mode="yaku">役の狙い方</button>' +
        '<button class="ai-level-btn" data-mode="general">自由質問</button>' +
      '</div>' +
      '<div class="ai-input-row">' +
        '<input class="ai-input" id="aiInput" type="text" placeholder="例：この役の条件は？ 狙いやすい場面は？">' +
        '<button class="btn-ai-ask" id="btnAiAsk">聞く</button>' +
      '</div>' +
      '<div id="aiResp" style="margin-top:10px"></div></div>' +
      '</div>';

    if (y.chapter) document.getElementById('btnPractice').addEventListener('click', function(){self.navigate('chapter',{id:y.chapter});});

    var YAKU_LEVEL_DESCS = {
      beginner: '🔰 麻雀用語を使わず、日常語でやさしく解説します。',
      advanced: '⚡ プロ棋士の打牌選択・牌効率・打点期待値を踏まえて解説します。'
    };
    var aiLevel = 'beginner', aiMode = 'rule';

    document.querySelectorAll('#aiLevelRow .ai-level-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('#aiLevelRow .ai-level-btn').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active');
        aiLevel = b.dataset.lv;
        var desc = document.getElementById('yakuLevelDesc');
        if (desc) desc.textContent = YAKU_LEVEL_DESCS[aiLevel] || '';
      });
    });
    document.querySelectorAll('#aiModeRow .ai-level-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('#aiModeRow .ai-level-btn').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active'); aiMode = b.dataset.mode;
      });
    });
    document.getElementById('btnAiAsk').addEventListener('click', function() {
      var q = document.getElementById('aiInput').value.trim() ||
        ('「' + y.name + '（' + y.reading + '）」の' + (aiMode === 'rule' ? '成立条件と注意点' : aiMode === 'yaku' ? '狙い方と実戦での使い方' : '特徴') + 'を教えてください。');
      var ctx = '役：' + y.name + '（' + y.reading + '、' + (y.han === 'yakuman' ? '役満' : y.han + '翻') + '）。' + q;
      askAI(y.example || [], ctx, aiLevel, document.getElementById('aiResp'), aiMode);
    });
    // デフォルトで役の説明を即表示
    askAI(
      y.example || [],
      '「' + y.name + '（' + y.reading + '）」の成立条件・よくある間違い・使いやすい場面を教えてください。',
      'beginner',
      document.getElementById('aiResp'),
      'rule'
    );
  },

  // ===== AI Coach =====
  _renderAICoach: function(main) {
    var sampleHand = [
      {suit:'man',num:2},{suit:'man',num:3},{suit:'man',num:4},
      {suit:'pin',num:3},{suit:'pin',num:4},{suit:'pin',num:5},
      {suit:'sou',num:6},{suit:'sou',num:7},{suit:'sou',num:8},
      {suit:'man',num:7},{suit:'man',num:8},{suit:'dragon',num:3},{suit:'dragon',num:3}
    ];
    main.innerHTML = '<div class="page-title">AI先生</div>' +
      '<div class="ai-coach-wrap">' +
        '<div class="ai-coach-card">' +
          '<div class="ai-coach-label">サンプル手牌</div>' +
          '<div class="example-hand-row ai-sample-hand">' + sampleHand.map(function(t) {
            return renderDefTile(t, { noHover: true, small: true });
          }).join('') + '</div>' +
          '<div class="ai-level-row" id="coachLevel">' +
            '<button class="ai-level-btn active" data-lv="beginner">🔰 初心者（やさしい）</button>' +
            '<button class="ai-level-btn" data-lv="advanced">⚡ 上級者（プロ視点）</button>' +
          '</div>' +
          '<div class="ai-level-desc" id="levelDesc" style="font-size:0.78rem;color:#8ab89c;margin-bottom:8px;min-height:32px">' +
            '🔰 麻雀用語を使わず、日常語でやさしく解説します。' +
          '</div>' +
          '<textarea class="ai-textarea" id="aiCoachInput" rows="4" placeholder="例：この手牌なら何を切る？ タンヤオを狙える？ リーチとポンどっちがいい？"></textarea>' +
          '<div class="btn-row"><button class="btn btn-primary" id="btnCoachAsk">質問する</button><button class="btn btn-secondary" id="btnCoachDiscard">この手牌の打牌相談</button></div>' +
        '</div>' +
        '<div class="ai-panel ai-coach-response"><div class="ai-panel-title"><span>🤖</span> AIの返答</div><div id="aiCoachResp" class="ai-response">質問を送るとここに表示されます。</div></div>' +
      '</div>';

    var LEVEL_DESCS = {
      beginner: '🔰 麻雀用語を使わず、日常語でやさしく解説します。',
      advanced: '⚡ プロ棋士の打牌選択・牌効率・打点期待値を踏まえて解説します。'
    };
    var level = 'beginner';
    document.querySelectorAll('#coachLevel .ai-level-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        document.querySelectorAll('#coachLevel .ai-level-btn').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active');
        level = b.dataset.lv;
        var desc = document.getElementById('levelDesc');
        if (desc) desc.textContent = LEVEL_DESCS[level] || '';
      });
    });
    document.getElementById('btnCoachAsk').addEventListener('click', function() {
      var q = document.getElementById('aiCoachInput').value.trim() || '麻雀で最初に意識するとよいことを教えてください。';
      askAI([], q, level, document.getElementById('aiCoachResp'));
    });
    document.getElementById('btnCoachDiscard').addEventListener('click', function() {
      var q = document.getElementById('aiCoachInput').value.trim();
      askAI(sampleHand, (q ? q + '。' : '') + 'この手牌なら何を切るのがおすすめですか？理由も短く教えてください。', level, document.getElementById('aiCoachResp'));
    });
  },

  // ===== Terms =====
  _renderTerms: function(main) {
    var self = this;
    main.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<div class="page-title" style="margin-bottom:0">麻雀用語一覧</div>' +
      '<button class="btn btn-secondary" id="btnTermsQuiz" style="font-size:0.82rem;padding:7px 14px">📝 用語クイズ</button></div>' +
      '<input class="terms-search" type="text" placeholder="用語を検索..." id="termSearch">' +
      '<div class="terms-list" id="termsList">' +
      GameData.TERMS.map(function(t){return '<div class="term-card"><div class="term-header"><span class="term-kanji">'+t.kanji+'</span><span class="term-reading">（'+t.reading+'）</span></div><div class="term-desc">'+esc(t.desc)+'</div></div>';}).join('') +
      '</div>';
    document.getElementById('btnTermsQuiz').addEventListener('click', function() { self.navigate('quiz', {source:'terms'}); });
    document.getElementById('termSearch').addEventListener('input', function() {
      var v = this.value.toLowerCase();
      document.querySelectorAll('#termsList .term-card').forEach(function(c){c.style.display=c.textContent.toLowerCase().includes(v)?'':'none';});
    });
  },

  // ===== Quiz Select =====
  _renderQuizSelect: function(main) {
    var self = this;
    var modes = [
      { src:'terms', icon:'💬', title:'用語クイズ', desc:'麻雀用語の読み方・意味を問います', count:GameData.TERMS.length + '語から出題' },
      { src:'yaku',  icon:'📖', title:'役クイズ',   desc:'役名・翻数・成立条件を問います',   count:GameData.YAKU.length + '役から出題' },
      { src:'mixed', icon:'🎲', title:'ランダムクイズ', desc:'用語と役を混ぜてランダム出題', count:'全' + (GameData.TERMS.length + GameData.YAKU.length) + '項目から' },
    ];
    main.innerHTML = '<div class="page-title">単語クイズ</div>' +
      '<p style="color:#8ab89c;font-size:0.88rem;margin-bottom:16px">用語・役を覚えているか確認しよう！1回10問・4択形式</p>' +
      '<div class="quiz-mode-grid" id="quizModeGrid">' +
      modes.map(function(m, i) {
        return '<div class="quiz-mode-card" data-ci="' + i + '">' +
          '<div class="quiz-mode-icon">' + m.icon + '</div>' +
          '<div class="quiz-mode-info">' +
          '<div class="quiz-mode-title">' + m.title + '</div>' +
          '<div class="quiz-mode-desc">' + m.desc + '</div>' +
          '<div class="quiz-mode-count">' + m.count + '</div>' +
          '</div></div>';
      }).join('') + '</div>';
    document.querySelectorAll('#quizModeGrid .quiz-mode-card').forEach(function(el, i) {
      el.addEventListener('click', function() {
        self.navigate('quiz', { source: modes[i].src });
      });
    });
  },

  // ===== Quiz Game =====
  _renderQuiz: function(main, source) {
    var self = this;
    var LABELS = ['A', 'B', 'C', 'D'];
    var Q_COUNT = 10;

    // ── Question generators ──
    function makeTermsQ() {
      var terms = GameData.TERMS;
      var q = terms[Math.floor(Math.random() * terms.length)];
      var wrong3 = Tiles.shuffle(terms.filter(function(t){ return t.kanji !== q.kanji; })).slice(0, 3);
      var qType = Math.random() < 0.5 ? 'reading' : 'meaning';
      if (qType === 'reading') {
        return {
          tag: '用語クイズ',
          key: '「' + q.kanji + '」',
          text: 'この用語の読み方は？',
          correct: q.reading,
          choices: Tiles.shuffle([q.reading].concat(wrong3.map(function(w){ return w.reading; }))),
          explanation: '<strong>' + q.kanji + '（' + q.reading + '）</strong><br>' + q.desc,
        };
      } else {
        return {
          tag: '用語クイズ',
          key: null,
          text: '次の説明にあてはまる用語は？\n\n「' + q.desc + '」',
          correct: q.kanji + '（' + q.reading + '）',
          choices: Tiles.shuffle([q.kanji + '（' + q.reading + '）'].concat(wrong3.map(function(w){ return w.kanji + '（' + w.reading + '）'; }))),
          explanation: '<strong>' + q.kanji + '（' + q.reading + '）</strong><br>' + q.desc,
        };
      }
    }

    function makeYakuQ() {
      var yaku = GameData.YAKU;
      var q = yaku[Math.floor(Math.random() * yaku.length)];
      var qType = Math.random() < 0.5 ? 'han' : 'condition';
      if (qType === 'han') {
        var hanStr = q.han === 'yakuman' ? '役満' : q.han + '翻';
        var allHans = Tiles.shuffle(['1翻','2翻','3翻','6翻','役満'].filter(function(h){ return h !== hanStr; })).slice(0, 3);
        return {
          tag: '役クイズ',
          key: q.name + '（' + q.reading + '）',
          text: 'この役は何翻？',
          correct: hanStr,
          choices: Tiles.shuffle([hanStr].concat(allHans)),
          explanation: '<strong>' + q.name + '（' + q.reading + '）' + (q.han === 'yakuman' ? '役満' : q.han + '翻') + '</strong><br>' + q.condition,
        };
      } else {
        var wrong3 = Tiles.shuffle(yaku.filter(function(y){ return y.id !== q.id; })).slice(0, 3);
        var cond = q.condition.length > 50 ? q.condition.slice(0, 50) + '…' : q.condition;
        return {
          tag: '役クイズ',
          key: null,
          text: '次の成立条件の役は？\n\n「' + cond + '」',
          correct: q.name + '（' + q.reading + '）',
          choices: Tiles.shuffle([q.name + '（' + q.reading + '）'].concat(wrong3.map(function(y){ return y.name + '（' + y.reading + '）'; }))),
          explanation: '<strong>' + q.name + '（' + q.reading + '）' + (q.han === 'yakuman' ? '役満' : q.han + '翻') + '</strong><br>' + q.condition,
        };
      }
    }

    // ── Generate questions ──
    var questions = [];
    for (var i = 0; i < Q_COUNT; i++) {
      var useTerms = source === 'terms' || (source === 'mixed' && i % 2 === 0);
      var useYaku  = source === 'yaku'  || (source === 'mixed' && i % 2 !== 0);
      if (source === 'mixed') {
        questions.push(Math.random() < 0.5 ? makeTermsQ() : makeYakuQ());
      } else if (source === 'terms') {
        questions.push(makeTermsQ());
      } else {
        questions.push(makeYakuQ());
      }
    }

    var qIdx = 0, correct = 0, wrongList = [];
    var answered = false;

    var render = function() {
      if (qIdx >= questions.length) { renderResult(); return; }
      var q = questions[qIdx];
      var pct = Math.round(qIdx / questions.length * 100);
      answered = false;

      main.innerHTML = '<div class="quiz-wrap">' +
        '<div class="quiz-progress-row">' +
          '<div class="quiz-progress-bar-wrap"><div class="quiz-progress-bar" style="width:' + pct + '%"></div></div>' +
          '<span class="quiz-score-badge">✅ ' + correct + ' / ' + qIdx + '</span>' +
        '</div>' +
        '<div class="quiz-question-box">' +
          '<span class="quiz-q-type-tag">' + q.tag + ' ― 問題 ' + (qIdx + 1) + ' / ' + questions.length + '</span>' +
          (q.key ? '<div class="quiz-q-key">' + esc(q.key) + '</div>' : '') +
          '<div class="quiz-q-text">' + esc(q.text).replace(/\n/g, '<br>') + '</div>' +
        '</div>' +
        '<div class="quiz-choices" id="quizChoices">' +
        q.choices.map(function(c, ci) {
          return '<button class="quiz-choice-btn" data-ci="' + ci + '">' +
            '<span class="quiz-choice-label">' + LABELS[ci] + '</span>' +
            esc(c) + '</button>';
        }).join('') +
        '</div>' +
        '<div id="quizFb"></div>' +
      '</div>';

      document.querySelectorAll('#quizChoices .quiz-choice-btn').forEach(function(el) {
        el.addEventListener('click', function() {
          if (answered) return;
          answered = true;
          var ci = parseInt(el.dataset.ci, 10);
          var chosen = q.choices[ci];
          var ok = chosen === q.correct;
          if (ok) correct++;
          else wrongList.push({ question: (q.key || q.text.slice(0, 40) + '…'), correct: q.correct, explanation: q.explanation });

          // Highlight all buttons
          document.querySelectorAll('#quizChoices .quiz-choice-btn').forEach(function(b) {
            b.disabled = true;
            if (q.choices[parseInt(b.dataset.ci, 10)] === q.correct) b.classList.add('correct');
            else if (b === el && !ok) b.classList.add('wrong');
          });

          var fbEl = document.getElementById('quizFb');
          if (fbEl) {
            fbEl.innerHTML =
              '<div class="quiz-explanation">' +
                (ok ? '✅ <strong>正解！</strong>' : '❌ <strong>不正解。正解：' + esc(q.correct) + '</strong>') +
                '<br>' + q.explanation +
              '</div>' +
              '<div class="next-btn-wrap">' +
                '<button class="btn-next-q" id="btnNextQ">' +
                (qIdx + 1 < questions.length ? '次の問題へ →' : '結果を見る →') +
                '</button>' +
              '</div>';
            var nextBtn = document.getElementById('btnNextQ');
            if (nextBtn) nextBtn.addEventListener('click', function() { qIdx++; render(); });
          }
        });
      });
    };

    var renderResult = function() {
      var rank, icon, msg;
      var pct = Math.round(correct / questions.length * 100);
      if (pct >= 90)      { rank = '🏆 完璧！'; icon = '🎯'; msg = '全問正解に近い！麻雀用語マスターだ！'; }
      else if (pct >= 70) { rank = '⭐ 合格！';  icon = '😄'; msg = '合格ライン突破！もう少しで完璧。'; }
      else if (pct >= 50) { rank = '📚 もう少し'; icon = '😅'; msg = '半分はクリア！間違えた問題を復習しよう。'; }
      else                { rank = '📖 要復習';   icon = '😓'; msg = '役・用語一覧を見直して再チャレンジ！'; }

      var wrongHtml = '';
      if (wrongList.length) {
        wrongHtml = '<div class="quiz-wrong-list"><h3>間違えた問題</h3>' +
          wrongList.map(function(w) {
            return '<div class="quiz-wrong-item">' +
              '<div class="q-label">問：' + esc(w.question) + '</div>' +
              '<div class="a-label">正解：' + esc(w.correct) + '</div>' +
            '</div>';
          }).join('') + '</div>';
      }

      main.innerHTML = '<div class="quiz-result">' +
        '<div class="quiz-result-icon">' + icon + '</div>' +
        '<div class="quiz-result-score">' + correct + '<span style="font-size:1.2rem;color:#8ab89c"> / ' + questions.length + '</span></div>' +
        '<div class="quiz-result-total">正解率 ' + pct + '%</div>' +
        '<div class="quiz-result-rank">' + rank + '</div>' +
        '<div class="quiz-result-msg">' + msg + '</div>' +
        wrongHtml +
        '<div class="btn-row">' +
          '<button class="btn btn-primary" id="btnQuizAgain">もう一度</button>' +
          '<button class="btn btn-secondary" id="btnQuizChange">クイズ選択へ</button>' +
        '</div></div>';

      document.getElementById('btnQuizAgain').addEventListener('click', function() {
        self.navigate('quiz', { source: source });
      });
      document.getElementById('btnQuizChange').addEventListener('click', function() {
        self.navigate('quiz_select');
      });
    };

    render();
  },

  // ===== Progress =====
  _renderProgress: function(main) {
    var self = this;
    var chs = GameData.CHAPTERS.filter(function(c){return !c.phase||c.phase===1;});
    var cleared = chs.filter(function(c){return Progress.isCleared(c.id);}).length;
    var titles = Progress.getTitles();
    main.innerHTML = '<div class="progress-wrap">' +
      '<div class="progress-header"><div class="progress-name">📊 学習進捗</div><div class="progress-sub">クリア章：'+cleared+' / '+chs.length+'</div></div>' +
      '<div class="progress-card"><h3>チャプター進捗</h3>' +
      GameData.CHAPTERS.map(function(c){var s=Progress.getStars(c.id);return '<div class="progress-chapter-row"><div class="progress-ch-title">第'+c.id+'章 '+c.short+'</div><div class="progress-ch-stars">'+(s>0?starsHtml(s):'─')+'</div></div>';}).join('')+
      '</div>' +
      (titles.length?'<div class="progress-card"><h3>獲得称号</h3><div class="title-badges">'+titles.map(function(t){return '<span class="title-badge">'+t+'</span>';}).join('')+'</div></div>':'')+
      '<div class="btn-row"><button class="btn btn-secondary" id="btnReset">進捗リセット</button></div></div>';
    document.getElementById('btnReset').addEventListener('click', function() {
      if (confirm('進捗をリセットしますか？')) { localStorage.removeItem('mj_progress'); Progress.load(); self._renderProgress(main); }
    });
  },

  // ===== Battle Setup =====
  _renderBattleSetup: function(main, params) {
    var self = this;
    params = params || {};
    var difficulty = 'easy', gameType = 'tonpu';
    var playerCount = params.playerCount === 3 ? 3 : 4;
    main.innerHTML = '<div class="page-title" id="battleSetupTitle">'+(playerCount === 3 ? '三人麻雀 対局設定' : 'VS CPU 対局設定')+'</div>' +
      '<div class="battle-setup-wrap">' +
      '<div class="setup-section"><h3>対局人数</h3><div class="setup-options" id="optPlayers">' +
      '<div class="setup-opt '+(playerCount === 4 ? 'active' : '')+'" data-v="4">4人打ち</div><div class="setup-opt '+(playerCount === 3 ? 'active' : '')+'" data-v="3">3人打ち</div>' +
      '</div><div class="setup-note" id="setupRuleNote"></div></div>' +
      '<div class="setup-section"><h3>対局形式</h3><div class="setup-options" id="optType">' +
      '<div class="setup-opt active" data-v="tonpu">東風戦</div><div class="setup-opt" data-v="hanchan">半荘戦</div>' +
      '</div></div>' +
      '<div class="setup-section"><h3>CPU難易度</h3><div class="setup-options" id="optDiff">' +
      '<div class="setup-opt active" data-v="easy">やさしい</div><div class="setup-opt" data-v="normal">ふつう</div><div class="setup-opt" data-v="hard">つよい</div>' +
      '</div></div>' +
      '<div class="btn-row" style="margin-top:20px"><button class="btn btn-primary btn-large" id="btnStartBattle">対局開始！</button></div></div>';

    var updateRuleNote = function() {
      var note = document.getElementById('setupRuleNote');
      var title = document.getElementById('battleSetupTitle');
      if (title) title.textContent = playerCount === 3 ? '三人麻雀 対局設定' : 'VS CPU 対局設定';
      if (note) note.textContent = playerCount === 3 ? '三麻：二〜八萬なし・北抜きあり' : '四麻：通常の牌セット';
    };
    document.querySelectorAll('#optPlayers .setup-opt').forEach(function(el) {
      el.addEventListener('click', function() {
        document.querySelectorAll('#optPlayers .setup-opt').forEach(function(x){x.classList.remove('active');});
        el.classList.add('active');
        playerCount = parseInt(el.dataset.v, 10);
        updateRuleNote();
      });
    });
    updateRuleNote();
    document.querySelectorAll('#optType .setup-opt').forEach(function(el) {
      el.addEventListener('click', function() {
        document.querySelectorAll('#optType .setup-opt').forEach(function(x){x.classList.remove('active');}); el.classList.add('active'); gameType=el.dataset.v;});
    });
    document.querySelectorAll('#optDiff .setup-opt').forEach(function(el) {
      el.addEventListener('click', function() {
        document.querySelectorAll('#optDiff .setup-opt').forEach(function(x){x.classList.remove('active');}); el.classList.add('active'); difficulty=el.dataset.v;});
    });
    document.getElementById('btnStartBattle').addEventListener('click', function() {
      self.navigate('battle', { difficulty: difficulty, gameType: gameType, playerCount: playerCount });
    });
  },

  // ===== Battle =====
  _renderBattle: function(main, opts) {
    var self = this;
    opts = opts || {};
    var initialPlayerCount = opts.playerCount === 3 ? 3 : 4;
    Battle.init({ difficulty: opts.difficulty || 'easy', gameType: opts.gameType || 'tonpu', playerCount: initialPlayerCount });

    var selectedIdx = -1;
    var eventLog = [];
    var log = function(msg, cls) { eventLog.unshift('<p class="'+(cls||'ev-discard')+'">'+esc(msg)+'</p>'); if(eventLog.length>12) eventLog.pop(); };
    var resetLocalRound = function() {
      selectedIdx = -1;
      eventLog = [];
      battleAdvice = null;
      battleAdviceLoading = false;
      battleAdviceError = '';
      battleAdviceTileId = '';
    };

    // ── ダブルタップ / ドラッグ捨て 操作状態 ──
    var DOUBLE_TAP_MS   = 300;   // ダブルタップ判定時間 (ms)
    var DRAG_THRESHOLD  = 50;    // 上ドラッグ捨て閾値 (px)
    var lastTap  = { idx: -1, time: 0 };
    var dragInfo = { active: false, idx: -1, startY: 0, el: null };
    var battleAdvice = null;
    var battleAdviceLoading = false;
    var battleAdviceError = '';
    var battleAdviceTileId = '';

    var serializeMeldsForAdvice = function(melds) {
      return (melds || []).map(function(m) {
        return {
          type: m.type || '',
          tiles: adviceSeatTiles(m.tiles || []),
          calledTile: tileToAdviceId(m.calledTile),
          fromPlayer: m.fromPlayer,
        };
      });
    };

    var buildBattleAdvicePayload = function(s) {
      var right = 1;
      var top = 2;
      var left = s.playerCount === 4 ? 3 : -1;
      var drawnTile = null;
      (s.hands[0] || []).forEach(function(t) {
        if (t.id === s.drewTile) drawnTile = t;
      });

      return {
        round: Battle.getRoundLabel(),
        honba: 0,
        kyotaku: 0,
        roundWind: Battle.WIND_NAMES[s.roundWind] || '東',
        playerWind: Battle.WIND_NAMES[0] || '東',
        doraIndicators: adviceSeatTiles([s.doraIndicator].concat(s.kanDoraIndicators || [])),
        hand: adviceSeatTiles(s.hands[0] || []),
        drawnTile: tileToAdviceId(drawnTile),
        discards: {
          self: adviceSeatTiles(s.discards[0] || []),
          left: left >= 0 ? adviceSeatTiles(s.discards[left] || []) : [],
          top: adviceSeatTiles(s.discards[top] || []),
          right: adviceSeatTiles(s.discards[right] || []),
        },
        calls: {
          self: serializeMeldsForAdvice(s.melds && s.melds[0]),
          left: left >= 0 ? serializeMeldsForAdvice(s.melds && s.melds[left]) : [],
          top: serializeMeldsForAdvice(s.melds && s.melds[top]),
          right: serializeMeldsForAdvice(s.melds && s.melds[right]),
        },
        riichi: {
          self: !!(s.riichi && s.riichi[0]),
          left: left >= 0 ? !!(s.riichi && s.riichi[left]) : false,
          top: !!(s.riichi && s.riichi[top]),
          right: !!(s.riichi && s.riichi[right]),
        },
        remainTiles: (s.wall || []).length,
        mode: 'beginner',
        gameMode: s.playerCount === 3 ? 'sanma' : 'yonma',
        playerCount: s.playerCount,
      };
    };

    var renderBattleAdvicePanel = function() {
      if (battleAdviceLoading) {
        return '<div class="ai-panel battle-ai-card">' +
          '<div class="ai-panel-title"><span>AI</span> AIアドバイス</div>' +
          '<div class="ai-loading">考えています...</div></div>';
      }
      if (battleAdviceError) {
        return '<div class="ai-panel battle-ai-card">' +
          '<div class="ai-panel-title"><span>AI</span> AIアドバイス</div>' +
          '<div class="ai-response ai-error">' + esc(battleAdviceError) + '</div></div>';
      }
      if (!battleAdvice) return '';
      var oneLine = (battleAdvice.tileName || battleAdvice.discard) + '切り。' + (battleAdvice.reason || '形がいちばん残るから');
      return '<div class="ai-panel battle-ai-card">' +
        '<div class="battle-ai-recommend ai-one-line">' + esc(oneLine) + '</div>' +
      '</div>';
    };

    var clearBattleAdvice = function() {
      battleAdvice = null;
      battleAdviceLoading = false;
      battleAdviceError = '';
      battleAdviceTileId = '';
    };

    var requestBattleAdvice = function() {
      var current = Battle.getState();
      if (!current || (current.phase !== 'player_turn' && current.phase !== 'naki_discard')) return;
      battleAdviceLoading = true;
      battleAdviceError = '';
      battleAdvice = null;
      battleAdviceTileId = '';
      renderGame();

      fetch('/api/mahjong/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBattleAdvicePayload(current)),
      }).then(function(r) {
        return r.json().then(function(d) { return { ok: r.ok, data: d }; });
      }).then(function(res) {
        battleAdviceLoading = false;
        var d = res.data || {};
        if (!res.ok || d.error || !d.discard) {
          battleAdviceError = d.message || 'アドバイスを取得できませんでした。';
          renderGame();
          return;
        }
        battleAdvice = d;
        battleAdviceTileId = d.discard;
        renderGame();
      }).catch(function() {
        battleAdviceLoading = false;
        battleAdviceError = 'アドバイスを取得できませんでした。';
        renderGame();
      });
    };

    var renderGame = function() {
      var s = Battle.getState();
      if (!s) return;
      var playerCount = s.playerCount || 4;
      var isSanma = playerCount === 3;
      var nukiCount = function(i) {
        return s.nuki && s.nuki[i] ? s.nuki[i].length : 0;
      };

      // ── Sort player hand; drew tile on far right ──
      var drewId = s.drewTile;
      var drewTile = null;
      var sortedHand = [];
      s.hands[0].forEach(function(t) {
        if (t.id === drewId) drewTile = t;
        else sortedHand.push(t);
      });
      sortedHand = Tiles.sortTiles(sortedHand);
      var displayOrder = sortedHand.concat(drewTile ? [drewTile] : []);
      var sortedLen = sortedHand.length;

      // Map display index → actual index in s.hands[0]
      var getActualIdx = function(di) {
        if (di < 0 || di >= displayOrder.length) return -1;
        var id = displayOrder[di].id;
        for (var k = 0; k < s.hands[0].length; k++) {
          if (s.hands[0][k].id === id) return k;
        }
        return -1;
      };

      var dora = Battle.getDoraTile();
      var isRiichi = s.riichi[0];
      var canTsumo = Battle.canTsumo();
      var canRiichi = Battle.canRiichi();
      var canNuki = Battle.canNuki();

      // ── テンパイ候補牌を計算（表示インデックス→actual index のマップ） ──
      var riichiActualIdxs = canRiichi ? Battle.getRiichiCandidates() : [];
      // display index → is riichi candidate?
      var isRiichiCandDisplay = function(si) {
        var ai = getActualIdx(si);
        return riichiActualIdxs.indexOf(ai) >= 0;
      };
      // 選択中の牌がリーチ候補かどうか
      var selectedIsRiichiCand = selectedIdx >= 0 && selectedIdx < sortedLen && isRiichiCandDisplay(selectedIdx);

      // ── 待ち牌HTML（リーチ後） ──
      var waitsHtml = '';
      if (isRiichi && s.riichiWaits && s.riichiWaits.length > 0) {
        waitsHtml = '<div class="mj-waits-area">' +
          '<span class="mj-waits-label">🎯 待ち：</span>' +
          s.riichiWaits.map(function(w) {
            return Tiles.renderTile(Tiles.make(w.suit, w.num), {noHover: true, extraClass: 'xs'});
          }).join('') +
        '</div>';
      }

      // ── DiscardRiver: Jantama風河コンポーネント ──
      // props: discards (tile配列), seat ('self'|'opposite'|'left'|'right')
      // 各捨て牌は {tile, isRiichiDiscard, calledBy} を持てる構造
      //
      // 全プレイヤー共通定数（CSSの .disc-river と必ず一致させること）
      //   zoom 0.50 → tile 26×35px → grid-cell 26×36px + gap 3px
      //   RIVER_W = 26×6 + 3×5 = 171px
      //   RIVER_H = 36×4 + 3×3 = 153px
      var RIVER_COLS = 6;
      var RIVER_ROWS = 4;

      var renderDiscardRiver = function(discards, seat, riichiIdx) {
        var tiles = discards.slice(0, RIVER_COLS * RIVER_ROWS).map(function(d, i) {
          var tile = (d && d.tile) ? d.tile : d;
          var isRiichi = (d && d.isRiichiDiscard) || (riichiIdx != null && i === riichiIdx);
          var cls = 'river-tile' + (isRiichi ? ' river-riichi' : '');
          var tileHtml = Tiles.renderTile(tile, {noHover: true, extraClass: cls});

          // 全員共通: explicit grid-column / grid-row 指定
          // 空白セル・placeholder は一切描画しない（実在する牌だけ）
          var _col    = i % RIVER_COLS;                 // 0-indexed: 0=1枚目の列
          var _rowIdx = Math.floor(i / RIVER_COLS);     // 0-indexed行
          // gridColumn:
          //   opposite → 対面視点の左端＝こちらから見て右端から: RIVER_COLS - _col = 6,5,4,3,2,1
          //   self/left/right → 左→右: _col + 1 = 1,2,3,4,5,6
          var gridColumn = (seat === 'opposite')
            ? (RIVER_COLS - _col)
            : (_col + 1);
          // gridRow:
          //   opposite → 下段(4)=中央寄りから上（対面側）へ: RIVER_ROWS - _rowIdx = 4,3,2,1
          //   self/left/right → 上段(1)から下へ: _rowIdx + 1 = 1,2,3,4
          var gridRow = (seat === 'opposite')
            ? (RIVER_ROWS - _rowIdx)
            : (_rowIdx + 1);

          return '<div class="rtile-wrap" style="grid-column:' + gridColumn
               + ';grid-row:' + gridRow + '">' + tileHtml + '</div>';
        }).join('');
        return '<div class="disc-river disc-river-' + seat + '">' + tiles + '</div>';
      };

      // ── Helper: render kawa tiles (後方互換) ──
      var kawa = function(discards, max, size) {
        return discards.slice(-max).map(function(t) {
          return Tiles.renderTile(t, {noHover:true, extraClass: size || 'xxs'});
        }).join('');
      };
      var hiddenTiles = function(prefix, count, max) {
        var total = Math.min(count || 0, max || 13);
        var html = '';
        for (var i = 0; i < total; i++) {
          html += Tiles.renderTile({suit:'back', num:0, id:prefix + i}, {faceDown:true, noHover:true, extraClass:'xxs'});
        }
        return html;
      };

      // Seating: T=対面(2), L=上家(3), R=下家(1)
      var T = 2, L = isSanma ? -1 : 3, R = 1;

      // ── スコアバー ──
      var scoresBar = '<div class="jt-scores '+(isSanma ? 'sanma' : '')+'">' +
        Battle.PLAYER_NAMES.map(function(nm,i){
          return '<div class="jt-score-item '+(i===0?'me':'')+'">'+
            '<div class="sname"><span class="swind">'+Battle.WIND_NAMES[i]+'</span> '+nm+
              (s.riichi[i]?' <span style="color:#e74c3c;font-size:0.6rem">R</span>':'')+'</div>'+
            '<div class="spts">'+s.scores[i].toLocaleString()+'点</div>'+
            (isSanma && nukiCount(i) > 0 ? '<div class="smeta">抜き北 '+nukiCount(i)+'</div>' : '')+
          '</div>';
        }).join('')+'</div>';

      // ── CPU チップ（小） ──
      function cpuChip(idx, inline) {
        return '<div class="jt-cpu-chip'+(inline?'':' vert')+'">' +
          '<span class="wind">'+Battle.WIND_NAMES[idx]+'</span>' +
          '<span>'+esc(Battle.PLAYER_NAMES[idx])+'</span>' +
          '<span style="font-size:0.62rem">'+s.scores[idx].toLocaleString()+'</span>' +
          (isSanma && nukiCount(idx) > 0 ? '<span class="nuki">北x'+nukiCount(idx)+'</span>' : '') +
          (s.riichi[idx]?'<span class="rm">R</span>':'') +
        '</div>';
      }
      function seatBadge(idx, pos) {
        if (idx < 0 || idx >= Battle.PLAYER_NAMES.length) return '';
        var marks = ['私','姫','雀','月'];
        return '<div class="jt-seat jt-seat-'+pos+' seat-'+idx+'">' +
          '<div class="jt-seat-avatar"><span>'+marks[idx]+'</span></div>' +
          '<div class="jt-seat-caption">' +
            '<div class="jt-seat-name">'+esc(Battle.PLAYER_NAMES[idx])+'</div>' +
            '<div class="jt-seat-points">'+s.scores[idx].toLocaleString()+'</div>' +
          '</div>' +
        '</div>';
      }

      // ── 中央ダイアモンド ──
      var doraHtml = '<div class="jt-table-dora">ドラ：' +
        (dora ? Tiles.renderTile(dora,{noHover:true,extraClass:'xxs'}) : '─') +
      '</div>';
      var centerScoresHtml = '<div class="jt-center-score-list">' +
        Battle.PLAYER_NAMES.map(function(nm, i) {
          return '<div class="jt-center-score-item seat-'+i+' '+(i===0?'me':'')+'">' +
            '<span class="wind">'+Battle.WIND_NAMES[i]+'</span>' +
            '<span class="name">'+esc(nm)+'</span>' +
            '<span class="pts">'+s.scores[i].toLocaleString()+'</span>' +
            (s.riichi[i] ? '<span class="riichi">R</span>' : '') +
            (isSanma && nukiCount(i) > 0 ? '<span class="nuki">北'+nukiCount(i)+'</span>' : '') +
          '</div>';
        }).join('') +
      '</div>';
      var centerHtml = '<div class="jt-center">' +
        '<div class="jt-center-panel">' +
          '<div class="jt-center-roundline">'+Battle.getRoundLabel()+'<span>山'+s.wall.length+'枚</span></div>' +
          centerScoresHtml +
        '</div>' +
      '</div>';

      // ── 手牌HTML（tableHtml より先に定義） ──
      // ── 暗カン候補 ──
      var ankanCands = (s.phase === 'player_turn') ? Battle.checkAnkan() : [];

      // ─────────────────────────────────────────────────────────
      // callFloatHtml: 手牌右上に固定表示する鳴き選択 / 北抜き / 暗カン
      // ─────────────────────────────────────────────────────────
      var callFloatHtml = '';
      if (s.phase === 'pending_call') {
        var cp = s.callPending;
        var callBtns = '';
        (cp ? cp.options : []).forEach(function(opt, idx) {
          if (opt.type === 'pon') {
            callBtns += '<button class="btn-battle btn-call btn-pon" data-call-idx="'+idx+'">ポン</button>';
          } else if (opt.type === 'kan') {
            callBtns += '<button class="btn-battle btn-call btn-kan" data-call-idx="'+idx+'">カン</button>';
          } else if (opt.type === 'chi' && !isSanma) {
            var setLabel = opt.tiles.map(function(t){ return Tiles.label(t); }).join('') + '+' + Tiles.label(opt.calledTile);
            callBtns += '<button class="btn-battle btn-call btn-chi" data-call-idx="'+idx+'">チー ('+setLabel+')</button>';
          }
        });
        var fromName = cp ? Battle.PLAYER_NAMES[cp.fromPlayer] : '';
        var tileLabel = cp ? Tiles.label(cp.tile) : '';
        callFloatHtml =
          '<div class="hand-action-float">' +
            '<div class="naki-banner-float">'+esc(fromName)+' が <strong>'+esc(tileLabel)+'</strong> を捨てました</div>' +
            callBtns +
            '<button class="btn-battle btn-skip-call" id="btnSkipCall">スキップ</button>' +
          '</div>';
      } else if (s.phase === 'player_turn' || s.phase === 'naki_discard') {
        var floatBtns = '';
        var selectedIsNuki0 = isSanma && selectedIdx >= 0 && displayOrder[selectedIdx] && Battle.isNukiTile && Battle.isNukiTile(displayOrder[selectedIdx]);
        if (isSanma && canNuki) {
          floatBtns += '<button class="btn-battle btn-nuki" id="btnNuki">'+(selectedIsNuki0 ? '北を抜く' : '北抜き')+'</button>';
        }
        ankanCands.forEach(function(ak) {
          floatBtns += '<button class="btn-battle btn-ankan" data-tile="'+esc(JSON.stringify(ak.tiles[0]))+'">暗カン('+Tiles.label(ak.tiles[0])+')</button>';
        });
        if (floatBtns) {
          callFloatHtml = '<div class="hand-action-float">'+floatBtns+'</div>';
        }
      }

      // ─────────────────────────────────────────────────────────
      // perPlayerMeldsHtml: 各プレイヤー専用副露パネル（それぞれの右下に配置）
      // ─────────────────────────────────────────────────────────
      var allMeldsHtml = '';  // 旧グローバルパネルは使用しない
      var perPlayerMeldsHtml = '';
      (function() {
        if (!s.melds) return;
        // プレイヤーインデックス → seat クラス名
        var seatCls = {};
        seatCls[0] = 'seat-self';
        seatCls[T] = 'seat-opposite';
        if (L >= 0) seatCls[L] = 'seat-left';
        seatCls[R] = 'seat-right';

        // 副露パネルHTML生成ヘルパー
        var buildMeldSets = function(pi) {
          return s.melds[pi].map(function(meld) {
            var typeLabel = meld.type==='pon'?'ポン':meld.type==='chi'?'チー':meld.type==='kan'?'カン':'暗カン';
            var meldTiles = meld.tiles.map(function(t, ti) {
              var isCalled = meld.calledTile && Tiles.isSame(t, meld.calledTile) && ti === meld.tiles.length - 1;
              var isHidden = meld.type === 'ankan' && (ti === 0 || ti === 3);
              if (isHidden) return Tiles.renderTile({suit:'back',num:0,id:'ah'+pi+'_'+ti}, {faceDown:true, noHover:true, extraClass:'meld-tile'});
              return Tiles.renderTile(t, {noHover:true, extraClass:'meld-tile'+(isCalled?' meld-called':'')});
            }).join('');
            return '<div class="meld-set meld-'+meld.type+'"><span class="meld-type-label">'+typeLabel+'</span>'+meldTiles+'</div>';
          }).join('');
        };

        for (var pi = 0; pi < s.playerCount; pi++) {
          if (!s.melds[pi] || s.melds[pi].length === 0) continue;
          var cls = seatCls[pi];
          if (!cls) continue;
          perPlayerMeldsHtml +=
            '<div class="player-meld-area '+cls+'">' +
              buildMeldSets(pi) +
            '</div>';
        }
      })();

      // ─────────────────────────────────────────────────────────
      // actionHtml: 手牌エリア内のボタン（ツモ/リーチ/ヒント/AI のみ）
      // ─────────────────────────────────────────────────────────
      var actionHtml = '';
      if (s.phase==='player_turn' || s.phase==='naki_discard') {
        var showRiichiBtn0 = canRiichi && !isRiichi && selectedIsRiichiCand;
        actionHtml = '<div class="jt-battle-actions">' +
          (s.phase==='player_turn' && canTsumo ? '<button class="btn-battle btn-tsumo" id="btnTsumo">ツモ！</button>' : '') +
          (showRiichiBtn0 ? '<button class="btn-battle btn-riichi" id="btnRiichi">🎯 リーチ</button>' : '') +
          '<span style="color:#8ab89c;font-size:0.85rem">' +
            (canRiichi ? '🔴印の牌をダブルタップで切る' :
             isRiichi  ? 'ツモ切り：引いた牌をダブルタップ' :
                         '牌をダブルタップ or 上スワイプで切る') +
          '</span>' +
          '<button class="btn-battle btn-ai-intable" id="btnAiGame" '+(battleAdviceLoading ? 'disabled' : '')+'>' +
            (battleAdviceLoading ? 'AI考え中' : 'AIに聞く') +
          '</button>' +
        '</div>';
      } else if (s.phase==='pending_call') {
        // 鳴き選択中はヒントのみ（ボタンは callFloatHtml に移動済み）
        actionHtml = '<div class="jt-battle-actions"><span style="color:#f0c060;font-size:0.82rem">鳴けます！右上で選択してください</span></div>';
      } else if (s.phase==='pending_ron') {
        var pr0 = s.pendingRon;
        actionHtml =
          '<div class="mj-ron-banner">'+esc(Battle.PLAYER_NAMES[pr0.from])+
          ' が <strong>'+esc(Tiles.label(pr0.tile))+'</strong> を捨てた！ロンできます</div>' +
          '<div class="jt-battle-actions">'+
            '<button class="btn-battle btn-ron" id="btnRon">ロン！</button>'+
            '<button class="btn-battle btn-skip" id="btnSkip">スルー</button>'+
          '</div>';
      }

      var lockCls = isRiichi ? ' t-lock' : '';
      var sortedHtml = sortedHand.map(function(t,si){
        var sel  = selectedIdx===si ? ' selected' : '';
        var cand = (!isRiichi && isRiichiCandDisplay(si)) ? ' riichi-cand' : '';
        var nuki = (!isRiichi && isSanma && Battle.isNukiTile && Battle.isNukiTile(t)) ? ' nuki-cand' : '';
        var aiRec = battleAdviceTileId && tileToAdviceId(t) === battleAdviceTileId ? ' ai-recommended' : '';
        return Tiles.renderTile(t, {extraClass: sel+lockCls+cand+nuki+aiRec});
      }).join('');
      var drewHtml = drewTile
        ? '<div class="mj-drew-area" id="mjDrew">'+
            Tiles.renderTile(drewTile, {extraClass: (selectedIdx===sortedLen ? 'selected' : '') + (!isRiichi && isSanma && Battle.isNukiTile && Battle.isNukiTile(drewTile) ? ' nuki-cand' : '') + (battleAdviceTileId && tileToAdviceId(drewTile) === battleAdviceTileId ? ' ai-recommended' : '')})+
          '</div>'
        : '';

      // ── 雀卓（全河込み） ──
      var tableHtml =
        '<div class="jt-game-topbar">' +
          '<button class="jt-game-nav" id="jtBattleBack">退出</button>' +
          '<button class="jt-game-nav" id="jtBattleProgress">設定</button>' +
        '</div>' +
        // 上段：CPU対面の情報
        '<div class="jt-top-cpu">'+cpuChip(T,true)+'</div>' +
        // 横並び：左サイド情報 | テーブル本体 | 右サイド情報
        '<div class="jt-row '+(isSanma ? 'sanma' : '')+'">' +
          // 左サイド情報（CPU上家）
          (L >= 0 ? '<div class="jt-side">'+cpuChip(L,false)+'</div>' : '<div class="jt-side jt-side-empty"></div>') +

          // テーブル本体
          '<div class="jt-table '+(isSanma ? 'sanma' : '')+'">' +
            '<div class="jt-table-perspective" aria-hidden="true"></div>' +
            seatBadge(T, 'top') +
            (L >= 0 ? seatBadge(L, 'left') : '') +
            seatBadge(R, 'right') +
            seatBadge(0, 'self') +
            doraHtml +
            '<div class="jt-hidden-hand jt-hidden-top">' + hiddenTiles('top-wall-', s.hands[T].length, 13) + '</div>' +
            (L >= 0 ? '<div class="jt-hidden-hand jt-hidden-left">' + hiddenTiles('left-wall-', s.hands[L].length, 13) + '</div>' : '') +
            '<div class="jt-hidden-hand jt-hidden-right">' + hiddenTiles('right-wall-', s.hands[R].length, 13) + '</div>' +
            // 上河：CPU対面（18枚まで3行×6列）
            renderDiscardRiver(s.discards[T], 'opposite', null) +

            // 中段
            '<div class="jt-table-mid">' +
              // 左河：CPU上家（15枚まで）
              (L >= 0 ? renderDiscardRiver(s.discards[L], 'left', null) : '') +

              // 中央ダイアモンド
              centerHtml +

              // 右河：CPU下家（15枚まで）
              renderDiscardRiver(s.discards[R], 'right', null) +
            '</div>' +

            // 下河：プレイヤー（18枚まで）
            renderDiscardRiver(s.discards[0], 'self', s.riichiDiscardIdx != null ? s.riichiDiscardIdx : null) +

            // ── 手牌エリア（テーブル上に表示） ──
            '<div class="jt-hand-in-table">' +
              '<div class="jt-hand-infobar">' +
                '<span><span class="wind">'+Battle.WIND_NAMES[0]+'</span> あなた</span>' +
                '<span class="score">'+s.scores[0].toLocaleString()+'点</span>' +
                (isSanma ? '<span class="mj-nuki-count">抜き北 '+nukiCount(0)+'</span>' : '') +
                (isRiichi ? '<span class="mj-riichi-badge">リーチ中</span>' : '') +
                (!isRiichi && canRiichi ? '<span class="mj-tenpai-notice">🀄 テンパイ！</span>' : '') +
                (canTsumo ? '<span class="mj-tsumo-flag">▲ツモ可</span>' : '') +
              '</div>' +
              waitsHtml +
              '<div class="jt-hand-tiles-row">' +
                '<div class="mj-sorted-tiles" id="mjSorted">'+sortedHtml+'</div>' +
                (drewTile ? '<div class="mj-hand-sep"></div>'+drewHtml : '') +
              '</div>' +
              // 副露は allMeldsHtml（右下固定）に移動、ここには表示しない
              actionHtml +
            '</div>' +

            // ── 鳴き選択フロート（手牌右上固定） ──
            callFloatHtml +

            // ── 各プレイヤー専用副露パネル（seat ごとに配置） ──
            perPlayerMeldsHtml +

          '</div>' +

          // 右サイド情報（CPU下家）
          '<div class="jt-side">'+cpuChip(R,false)+'</div>' +
        '</div>';

      // handPanelHtml / playerBar は不要（テーブル内に統合済み）
      var playerBar = '';
      var handPanelHtml = '';

      // ── イベントログ ──
      var logHtml = '<div class="battle-event-log">'+eventLog.join('')+'</div>';

      // ── 組み立て（手牌・ボタンはテーブル内に統合済み） ──
      main.innerHTML = '<div class="jt-outer">' +
        scoresBar + tableHtml +
        logHtml + '<div id="aiAdvArea">' + renderBattleAdvicePanel() + '</div>' +
      '</div>';
      // innerHTML 更新直後に同期配置（初回描画でも正しい位置に表示）
      positionDiscardRivers();
      if (window.scrollY) window.scrollTo(0, 0);
      var battleBack = document.getElementById('jtBattleBack');
      if (battleBack) battleBack.addEventListener('click', function() { self.goBack(); });
      var battleProgress = document.getElementById('jtBattleProgress');
      if (battleProgress) battleProgress.addEventListener('click', function() { self.goBack(); });

      // ── 捨て牌実行ヘルパー ──
      var afterDiscard = function() {
        var ns = Battle.getState();
        selectedIdx = -1; lastTap = { idx:-1, time:0 }; dragInfo = { active:false, idx:-1, startY:0, el:null };
        if (ns.phase === 'end')           { log(Battle.PLAYER_NAMES[ns.winner]+'がロン！', 'ev-win'); renderEnd(); }
        else if (ns.phase === 'pending_ron')  renderGame();
        else if (ns.phase === 'pending_call') renderGame();
        else if (ns.phase === 'ryukyoku')     renderRyukyoku();
        else                                  renderGame();
      };

      var doDiscardByDI = function(di) {
        var ai = getActualIdx(di);
        if (ai < 0) return;
        var tile = s.hands[0][ai];
        log('あなた: '+Tiles.label(tile)+'を切った', 'ev-discard');
        battleAdvice = null;
        battleAdviceTileId = '';
        battleAdviceError = '';
        if (s.phase === 'naki_discard') {
          Battle.playerDiscardNaki(ai);
        } else {
          Battle.playerDiscard(ai);
        }
        afterDiscard();
      };

      // ── 手牌タイル汎用ポインタイベントバインド ──
      // allowDiscard: 捨て可能かどうかの関数（リーチ中かどうかで分岐）
      var bindTilePointer = function(el, di, allowDiscard) {
        // pointerdown: ドラッグ開始
        el.addEventListener('pointerdown', function(e) {
          if (!allowDiscard()) return;
          e.preventDefault();
          dragInfo = { active: true, idx: di, startY: e.clientY, el: el };
          try { el.setPointerCapture(e.pointerId); } catch(ex) {}
        });

        // pointermove: ドラッグ視覚フィードバック（上方向のみ）
        el.addEventListener('pointermove', function(e) {
          if (!dragInfo.active || dragInfo.idx !== di) return;
          var dy = e.clientY - dragInfo.startY;
          if (dy < -8) {
            var lifted = Math.max(dy, -80);
            el.style.transform = 'translateY('+lifted+'px)';
            el.style.opacity   = dy < -(DRAG_THRESHOLD * 0.6) ? '0.65' : '0.85';
          } else {
            el.style.transform = '';
            el.style.opacity   = '';
          }
        });

        // pointerup: ドラッグ捨て or ダブルタップ捨て or 選択
        el.addEventListener('pointerup', function(e) {
          if (!dragInfo.active || dragInfo.idx !== di) return;
          var dy = e.clientY - dragInfo.startY;

          // 視覚状態をリセット
          el.style.transform = '';
          el.style.opacity   = '';
          dragInfo.active = false;

          if (!allowDiscard()) {
            // 操作不可時は選択のみ（リーチ中の手牌など）
            return;
          }

          // ① ドラッグ上捨て（閾値以上に上移動）
          if (dy < -DRAG_THRESHOLD) {
            doDiscardByDI(di);
            return;
          }

          // ② ダブルタップ判定
          var now = Date.now();
          if (lastTap.idx === di && (now - lastTap.time) < DOUBLE_TAP_MS) {
            lastTap = { idx: -1, time: 0 };
            doDiscardByDI(di);
            return;
          }

          // ③ シングルタップ: 選択表示のみ更新
          lastTap = { idx: di, time: now };
          selectedIdx = (selectedIdx === di) ? -1 : di;
          renderGame();
        });

        // pointercancel: 視覚状態リセット
        el.addEventListener('pointercancel', function(e) {
          if (!dragInfo.active || dragInfo.idx !== di) return;
          el.style.transform = '';
          el.style.opacity   = '';
          dragInfo.active = false;
        });

        // PC ダブルクリック（安全網）
        el.addEventListener('dblclick', function(e) {
          if (!allowDiscard()) return;
          e.preventDefault();
          doDiscardByDI(di);
        });
      };

      // ── ソート済み手牌にバインド ──
      document.querySelectorAll('#mjSorted .tile').forEach(function(el, si) {
        bindTilePointer(el, si, function() {
          return (s.phase === 'player_turn' && !isRiichi) || s.phase === 'naki_discard';
        });
      });

      // ── ツモ牌にバインド ──
      var drewEl = document.querySelector('#mjDrew .tile');
      if (drewEl) {
        bindTilePointer(drewEl, sortedLen, function() {
          return s.phase === 'player_turn';
        });
      }

      // ── 鳴き選択ボタン ──
      document.querySelectorAll('[data-call-idx]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(btn.dataset.callIdx, 10);
          var cp = s.callPending;
          if (!cp || isNaN(idx)) return;
          var opt = cp.options[idx];
          if (!opt) return;
          var tile = cp.tile, from = cp.fromPlayer;
          if (opt.type === 'pon') {
            clearBattleAdvice();
            Battle.playerPon(tile, from);
            log('ポン！', 'ev-discard');
          } else if (opt.type === 'kan') {
            clearBattleAdvice();
            Battle.playerKan(tile, from);
            log('カン！', 'ev-discard');
          } else if (opt.type === 'chi') {
            clearBattleAdvice();
            Battle.playerChi(tile, from, opt.tiles);
            log('チー！', 'ev-discard');
          }
          afterDiscard();
        });
      });

      // スキップ（鳴かない）
      var btnSkipCall = document.getElementById('btnSkipCall');
      if (btnSkipCall) btnSkipCall.addEventListener('click', function() {
        clearBattleAdvice();
        Battle.skipCall();
        renderGame();
      });

      // 暗カンボタン
      document.querySelectorAll('.btn-ankan[data-tile]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          try {
            var tile = JSON.parse(btn.dataset.tile);
            var ok = Battle.playerAnkan(tile);
            if (ok) clearBattleAdvice();
            if (ok) { log('暗カン！', 'ev-discard'); afterDiscard(); }
          } catch(e) {}
        });
      });

      // ── Bind buttons ──
      var btnTsumo = document.getElementById('btnTsumo');
      if (btnTsumo) btnTsumo.addEventListener('click', function() {
        Battle.playerTsumo(); log('ツモ！ あなたのアガリ！', 'ev-win'); renderEnd();
      });

      var btnNuki = document.getElementById('btnNuki');
      if (btnNuki) btnNuki.addEventListener('click', function() {
        var ai = -1;
        if (selectedIdx >= 0 && displayOrder[selectedIdx] && Battle.isNukiTile(displayOrder[selectedIdx])) {
          ai = getActualIdx(selectedIdx);
        }
        var res = Battle.playerNuki(ai);
        if (res) clearBattleAdvice();
        selectedIdx = -1;
        if (res) log('北抜き！ 抜き北 '+nukiCount(0)+'枚', 'ev-nuki');
        var ns = Battle.getState();
        if (ns.phase === 'ryukyoku') renderRyukyoku();
        else renderGame();
      });

      var btnRiichi = document.getElementById('btnRiichi');
      if (btnRiichi) btnRiichi.addEventListener('click', function() {
        var di = selectedIdx;
        if (di < 0) return;
        var ai = getActualIdx(di);
        if (ai < 0) return;
        log('リーチ宣言！', 'ev-riichi');
        clearBattleAdvice();
        Battle.playerRiichi(ai);
        selectedIdx = -1;
        var ns = Battle.getState();
        if (ns.phase === 'end') renderEnd();
        else if (ns.phase === 'pending_ron') renderGame();
        else renderGame();
      });

      var btnRon = document.getElementById('btnRon');
      if (btnRon) btnRon.addEventListener('click', function() {
        clearBattleAdvice();
        Battle.playerRonAccept(); log('ロン！ あなたのアガリ！', 'ev-win'); renderEnd();
      });

      var btnSkip = document.getElementById('btnSkip');
      if (btnSkip) btnSkip.addEventListener('click', function() {
        clearBattleAdvice();
        Battle.playerRonSkip();
        var ns = Battle.getState();
        if (ns.phase === 'ryukyoku') renderRyukyoku(); else renderGame();
      });

      var btnAi = document.getElementById('btnAiGame');
      if (btnAi) btnAi.addEventListener('click', requestBattleAdvice);

      // 対面・左家の河を点数板 bounding box 基準で正確に配置
      requestAnimationFrame(positionDiscardRivers);
    };

    // ── 役一覧を組み立てる ──────────────────────────────────────
    var buildYakuList = function(s, sc) {
      if (!sc) return [];
      // calcScore が返す内訳を唯一の正とする（合計翻＝表示役の合計）
      return sc.yaku ? sc.yaku.slice() : [];
    };

    // ── ドラ牌を表示牌から導出 ──────────────────────────────────
    var getDoraFromIndicator = function(ind) {
      if (!ind) return null;
      var nextMap = { man: 9, pin: 9, sou: 9, wind: 4, dragon: 3 };
      var next = ind.num % (nextMap[ind.suit] || 9) + 1;
      return { suit: ind.suit, num: next, id: 'dora_' + ind.suit + next };
    };

    // ── 満貫以上のラベル ─────────────────────────────────────────
    var getScaleName = function(han) {
      if (han >= 13) return '役満';
      if (han >= 11) return '三倍満';
      if (han >= 8)  return '倍満';
      if (han >= 6)  return '跳満';
      if (han >= 5)  return '満貫';
      return '';
    };

    // ── 和了結果画面 ─────────────────────────────────────────────
    var renderEnd = function() {
      var s  = Battle.getState();
      var sc = Battle.settleScore();
      var winner    = s.winner;
      var matchOver = Battle.isMatchOver();
      var isPlayer  = winner === 0;

      // プレイヤー名
      var winnerName = Battle.PLAYER_NAMES[winner] || '不明';
      var loserName  = (s.loser >= 0 && s.loser !== winner)
                       ? Battle.PLAYER_NAMES[s.loser] : null;

      // 役一覧
      var yakuList = buildYakuList(s, sc);

      // 和了形式タイトル
      var winTypeLabel = s.winType === 'tsumo' ? 'ツモ' : 'ロン';
      var loserLine = '';
      if (s.winType === 'ron' && loserName) {
        loserLine = '<div class="agr-loser">← '+esc(loserName)+' の捨て牌</div>';
      }

      // 手牌 HTML (14枚、和了牌を区別)
      var hand = (s.hands[winner] || []).slice();
      var handHtml = '';
      if (hand.length > 0) {
        var winningTile = s.winTile || hand[hand.length - 1];
        var winRemoved = false;
        var mainTiles = hand.filter(function(t) {
          if (!winRemoved && winningTile && t.id === winningTile.id) {
            winRemoved = true;
            return false;
          }
          return true;
        });
        if (!winRemoved && winningTile) {
          mainTiles = hand.filter(function(t) {
            if (!winRemoved && Tiles.isSame(t, winningTile)) {
              winRemoved = true;
              return false;
            }
            return true;
          });
        }
        mainTiles = Tiles.sortTiles(mainTiles);
        handHtml =
          '<div class="agr-hand">' +
            '<div class="agr-tiles">' +
              mainTiles.map(function(t) {
                return Tiles.renderTile(t, { noHover: true, extraClass: 'agr-tile' });
              }).join('') +
            '</div>' +
            '<div class="agr-sep">＋</div>' +
            '<div class="agr-win-tile">' +
              Tiles.renderTile(winningTile, { noHover: true, extraClass: 'agr-tile agr-tile-win' }) +
            '</div>' +
          '</div>';
      }

      // ドラ表示牌
      var doraInd    = s.doraIndicator;
      var doraActual = doraInd ? getDoraFromIndicator(doraInd) : null;
      var doraHtml = '';
      if (doraInd) {
        doraHtml =
          '<div class="agr-dora-row">' +
            '<span class="agr-dora-label">ドラ表示牌</span>' +
            Tiles.renderTile(doraInd, { noHover: true, extraClass: 'agr-tile agr-tile-dora-ind' }) +
            '<span class="agr-dora-arrow">→</span>' +
            (doraActual ? Tiles.renderTile(doraActual, { noHover: true, extraClass: 'agr-tile agr-tile-dora' }) : '') +
          '</div>';
      }
      // 裏ドラ表示牌（リーチしてアガったときだけめくって見せる）
      var uraInd = s.uraDoraIndicator;
      if (uraInd && s.riichi && s.riichi[winner]) {
        var uraActual = getDoraFromIndicator(uraInd);
        doraHtml +=
          '<div class="agr-dora-row">' +
            '<span class="agr-dora-label">裏ドラ表示牌</span>' +
            Tiles.renderTile(uraInd, { noHover: true, extraClass: 'agr-tile agr-tile-dora-ind' }) +
            '<span class="agr-dora-arrow">→</span>' +
            (uraActual ? Tiles.renderTile(uraActual, { noHover: true, extraClass: 'agr-tile agr-tile-dora' }) : '') +
          '</div>';
      }

      // 役一覧 HTML
      var totalHanFromYaku = yakuList.reduce(function(acc, y){ return acc + y.han; }, 0);
      var yakuHtml = yakuList.map(function(y) {
        return '<div class="agr-yaku-row">' +
          '<span class="agr-yaku-name">'+esc(y.name)+'</span>' +
          '<span class="agr-yaku-han">'+y.han+'翻</span>' +
        '</div>';
      }).join('');

      // 点数ラベル
      var scaleName = sc ? getScaleName(sc.han) : '';
      var ptsText   = sc ? sc.pts.toLocaleString() + '点' : '—';
      var hanText   = sc ? sc.han + '翻' : '—';

      // 点数移動
      var deltaHtml = '';
      if (sc && sc.deltas) {
        deltaHtml =
          '<div class="agr-deltas">' +
            Battle.PLAYER_NAMES.map(function(nm, i) {
              var d    = sc.deltas[i];
              var sign = d > 0 ? '+' : '';
              var cls  = i === winner ? 'agr-delta-winner' : (d < 0 ? 'agr-delta-minus' : 'agr-delta-zero');
              return '<div class="agr-delta-row '+cls+'">' +
                '<span class="agr-delta-name">'+esc(nm)+'</span>' +
                '<span class="agr-delta-pts">'+(d === 0 ? '±0' : sign+d.toLocaleString())+'</span>' +
              '</div>';
            }).join('') +
          '</div>';
      }

      // 最終スコア
      var finalHtml =
        '<div class="agr-final-scores">' +
          Battle.PLAYER_NAMES.map(function(nm, i) {
            return '<div class="agr-final-row '+(i===winner?'agr-final-winner':'')+'">' +
              '<span class="agr-final-wind">'+Battle.WIND_NAMES[i]+'</span>' +
              '<span class="agr-final-name">'+esc(nm)+'</span>' +
              '<span class="agr-final-pts">'+s.scores[i].toLocaleString()+'点</span>' +
            '</div>';
          }).join('') +
        '</div>';

      // 組み立て
      main.innerHTML =
        '<div class="agari-result-wrap">' +
          '<div class="agari-result-card">' +

            // ── ヘッダー ──
            '<div class="agr-header agr-header-'+(isPlayer?'self':'cpu')+'">' +
              '<div class="agr-win-type">'+winTypeLabel+'</div>' +
              '<div class="agr-winner-name">'+esc(winnerName)+'</div>' +
              loserLine +
              '<div class="agr-round-label">'+Battle.getRoundLabel()+'</div>' +
            '</div>' +

            // ── 手牌 ──
            '<div class="agr-section">' +
              '<div class="agr-section-title">和了手牌</div>' +
              handHtml +
            '</div>' +

            // ── ドラ表示牌 ──
            (doraHtml ? '<div class="agr-section">'+doraHtml+'</div>' : '') +

            // ── 役一覧 ──
            '<div class="agr-section agr-yaku-section">' +
              '<div class="agr-section-title">役</div>' +
              '<div class="agr-yaku-list">'+yakuHtml+'</div>' +
            '</div>' +

            // ── 翻・点数 ──
            '<div class="agr-score-section">' +
              '<div class="agr-han-pts">' +
                '<span class="agr-han-val">'+hanText+'</span>' +
                '<span class="agr-pts-val">'+ptsText+'</span>' +
              '</div>' +
              (scaleName ? '<div class="agr-scale-name">'+scaleName+'</div>' : '') +
            '</div>' +

            // ── 点数移動 ──
            '<div class="agr-section">' +
              '<div class="agr-section-title">点数移動</div>' +
              deltaHtml +
            '</div>' +

            // ── 現在点数 ──
            '<div class="agr-section">' +
              '<div class="agr-section-title">現在点数'+(matchOver?' ／ 対局終了':'')+'</div>' +
              finalHtml +
            '</div>' +

            // ── ボタン ──
            '<div class="agr-btn-row">' +
              (matchOver
                ? '<button class="btn btn-primary" id="btnPlayAgain">再戦</button>'
                : '<button class="btn btn-primary" id="btnNextRound">次の局へ →</button>') +
              '<button class="btn btn-secondary" id="btnBHome">ホームへ</button>' +
            '</div>' +

          '</div>' +
        '</div>';

      var btnNextRound = document.getElementById('btnNextRound');
      if (btnNextRound) btnNextRound.addEventListener('click', function() {
        Battle.nextRound(); resetLocalRound(); renderGame();
      });
      var btnPlayAgain = document.getElementById('btnPlayAgain');
      if (btnPlayAgain) btnPlayAgain.addEventListener('click', function() {
        Battle.init({ difficulty: opts.difficulty || 'easy', gameType: opts.gameType || 'tonpu', playerCount: initialPlayerCount });
        resetLocalRound(); renderGame();
      });
      document.getElementById('btnBHome').addEventListener('click', function() {
        self.navigate('home');
      });
    };

    var renderRyukyoku = function() {
      var matchOver = Battle.isMatchOver();
      main.innerHTML = '<div class="battle-end-card"><div class="battle-end-icon">🌊</div>' +
        '<div class="battle-end-title">流局'+(matchOver?' ／ 対局終了':'')+'</div>' +
        '<div class="battle-end-detail">'+Battle.getRoundLabel()+'<br>山がなくなりました。引き分けです。</div>' +
        '<div class="battle-final-scores">'+
        Battle.PLAYER_NAMES.map(function(name,i){var s=Battle.getState();return '<div class="battle-final-score-row"><div class="name">'+Battle.WIND_NAMES[i]+' '+Battle.WIND_READINGS[i]+' '+name+'</div><div class="pts">'+s.scores[i].toLocaleString()+'点</div></div>';}).join('')+
        '</div>' +
        '<div class="btn-row">'+(matchOver?'<button class="btn btn-primary" id="btnPA2">再戦</button>':'<button class="btn btn-primary" id="btnNR2">次の局へ</button>')+'<button class="btn btn-secondary" id="btnBH2">ホームへ</button></div></div>';
      var btnNR2 = document.getElementById('btnNR2');
      if (btnNR2) btnNR2.addEventListener('click', function(){Battle.nextRound(); resetLocalRound(); renderGame();});
      var btnPA2 = document.getElementById('btnPA2');
      if (btnPA2) btnPA2.addEventListener('click', function(){Battle.init({ difficulty: opts.difficulty || 'easy', gameType: opts.gameType || 'tonpu', playerCount: initialPlayerCount }); resetLocalRound(); renderGame();});
      document.getElementById('btnBH2').addEventListener('click', function(){self.navigate('home');});
    };

    renderGame();
  },
};

// ===== Chapter helpers =====
function chHeader(chTitle, mgTitle, pct, correct, passNeeded) {
  return '<div class="game-wrap"><div class="game-header">' +
    '<div class="game-chapter-title">'+esc(chTitle)+'</div>' +
    '<div class="game-mg-title">'+esc(mgTitle)+'</div></div>' +
    '<div class="game-progress-bar-wrap"><div class="game-progress-bar" style="width:'+pct+'%"></div></div>' +
    '<div class="game-score-text">正解 '+correct+' / '+passNeeded+' 問正解でクリア</div>';
}

function showMgClear(completedIdx, nextRender) {
  var msgs = ['最初のミニゲームクリア！','2つ目のミニゲームクリア！','3つ目のミニゲームクリア！','4つ目のミニゲームクリア！'];
  showOverlay('<div style="text-align:center"><div style="font-size:2.5rem;margin-bottom:10px">🎉</div>' +
    '<h2>'+(msgs[completedIdx]||'ミニゲームクリア！')+'</h2>' +
    '<p style="color:#a8d8b0;margin:10px 0 20px">次のミニゲームへ進もう！</p>' +
    '<button class="btn btn-primary btn-large" id="btnNextMg">次へ →</button></div>');
  document.getElementById('btnNextMg').addEventListener('click', function() { hideOverlay(); nextRender(); });
}

function showClear(chId, stars) {
  var msgs = {1:'はじめてのアガリ！麻雀は「セット」と「頭」を作るゲームだよ。',2:'色の違いを理解したね！',3:'本物の麻雀牌を使いこなせるようになってきた！',4:'字牌をすべて覚えたかな？',5:'役牌をマスターした！',6:'ポンとチーを使いこなせるようになった！',7:'道場チャレンジ完了！',8:'立直・タンヤオ・平和を覚えた！',9:'翻と点数が読めるようになった！',10:'中級役（七対子・対々和など）をマスター！',11:'清一色などの上級役まで到達！すごい！',12:'三人麻雀のルールもバッチリ！'};
  var titleMap = {1:'はじめてのアガリ',5:'役牌マスター',6:'鳴きデビュー',8:'役デビュー',9:'点数計算入門',10:'中級役マスター',11:'上級役マスター',12:'三麻デビュー'};
  Progress.setStars(chId, stars);
  if (titleMap[chId]) Progress.addTitle(titleMap[chId]);
  showOverlay('<div style="text-align:center"><div style="font-size:3rem;margin-bottom:12px">🏆</div>' +
    '<h2>第'+chId+'章クリア！</h2><div style="font-size:1.8rem;margin:10px 0">'+starsHtml(stars)+'</div>' +
    '<p style="color:#a8d8b0;line-height:1.7;margin-bottom:20px">'+(msgs[chId]||'よくできました！')+'</p>' +
    '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
    (chId<12?'<button class="btn btn-primary" id="btnNextCh">次の章へ →</button>':'')+
    '<button class="btn btn-secondary" id="btnGoChapters">章選択へ</button></div></div>');
  if (chId<12) document.getElementById('btnNextCh').addEventListener('click', function(){hideOverlay();App.navigate('chapter',{id:chId+1});});
  document.getElementById('btnGoChapters').addEventListener('click', function(){hideOverlay();App.navigate('chapters');});
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', function() { App.init(); });
