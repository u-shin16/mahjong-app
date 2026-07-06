'use strict';

const Chapters = (() => {
  // ===== Chapter 1: Number tiles only =====
  const ch1 = {
    mg1: {
      title: 'ミニゲーム①　3枚セットを見つけよう',
      instruction: '<strong>3枚でセット</strong>になる牌を選ぼう！<br>同じ数字3枚、または数字が続く3枚がセット。',
      questions: [
        { nums: [1,2,3,5,7], answer: [0,1,2], fb: '1・2・3は数字が続いているから順子（セット）だよ！' },
        { nums: [4,4,4,2,8], answer: [0,1,2], fb: '同じ数字3枚は刻子（セット）！' },
        { nums: [6,7,8,2,4], answer: [0,1,2], fb: '6・7・8も順番に続いているのでセット！' },
        { nums: [3,3,3,5,9], answer: [0,1,2], fb: 'コツ：3が3枚で刻子。完璧！' },
        { nums: [2,3,4,6,9], answer: [0,1,2], fb: '2・3・4も数字が続くから順子！' },
      ],
      passNeeded: 5,
    },
    mg2: {
      title: 'ミニゲーム②　頭を作ろう',
      instruction: '<strong>同じ数字2枚</strong>を選ぼう！アガリには「頭（2枚ペア）」が必要。',
      questions: [
        { nums: [2,2,4,5,8], answer: [0,1], fb: '2が2枚で頭の完成！' },
        { nums: [1,3,6,6,9], answer: [2,3], fb: '6が2枚あるから頭になれる！' },
        { nums: [4,4,7,8,9], answer: [0,1], fb: '4が2枚で頭！' },
      ],
      passNeeded: 3,
    },
    mg3: {
      title: 'ミニゲーム③　あと1枚でアガリ！',
      instruction: 'あと<strong>1枚</strong>引けばアガリ！どの数字を引けばいい？',
      questions: [
        { hand: [1,1,1,4,5,6,7,8,9,9,9,2,4], answer: 3, choices: [3,2,5,9], fb: '3を引くと2・3・4の順子ができてアガリ！9・9が頭だよ。' },
        { hand: [2,2,3,4,5,6,6,6,7,8,9,7,9], answer: 8, choices: [8,7,9,6], fb: '8を引くと7・8・9の順子がもう1つできてアガリ！2・2が頭だよ。' },
        { hand: [1,2,3,4,5,6,7,8,9,5,5,8,8], answer: 8, choices: [8,6,7,9], fb: '8を引くと8・8・8の刻子ができてアガリ！5・5が頭だよ。' },
      ],
      passNeeded: 3,
    },
  };

  // ===== Chapter 2: Colored tiles =====
  const COLOR_NAMES = { red: '赤', blue: '青', green: '緑' };
  const ch2 = {
    mg1: {
      title: 'ミニゲーム①　これはセット？',
      instruction: '<strong>同じ色</strong>の数字が続くか、<strong>同じ色・同じ数字</strong>3枚ならセット！',
      questions: [
        { tiles: [{c:'red',n:1},{c:'red',n:2},{c:'red',n:3}], answer: true, fb: '赤1・赤2・赤3は同じ色で数字が続くからセット！' },
        { tiles: [{c:'red',n:1},{c:'blue',n:2},{c:'red',n:3}], answer: false, fb: '色がバラバラ！同じ色でないと順子にならないよ。' },
        { tiles: [{c:'blue',n:5},{c:'blue',n:5},{c:'blue',n:5}], answer: true, fb: '同じ色・同じ数字3枚は刻子！' },
        { tiles: [{c:'red',n:3},{c:'blue',n:3},{c:'green',n:3}], answer: false, fb: '色が全部違う！同じ色にならないとセットにならないよ。' },
        { tiles: [{c:'green',n:7},{c:'green',n:8},{c:'green',n:9}], answer: true, fb: '緑7・緑8・緑9は順子！' },
        { tiles: [{c:'red',n:2},{c:'red',n:4},{c:'red',n:5}], answer: false, fb: '2・4・5は数字が続いていない！2と4の間に3がないからNG。' },
        { tiles: [{c:'blue',n:1},{c:'blue',n:1},{c:'blue',n:1}], answer: true, fb: '青1が3枚で刻子！' },
        { tiles: [{c:'red',n:6},{c:'green',n:7},{c:'blue',n:8}], answer: false, fb: '色が全部違う！順子は同じ色でないとNG。' },
        { tiles: [{c:'red',n:4},{c:'red',n:5},{c:'red',n:6}], answer: true, fb: '赤4・赤5・赤6で順子！完璧！' },
        { tiles: [{c:'blue',n:3},{c:'blue',n:3},{c:'blue',n:4}], answer: false, fb: '3・3・4は刻子でも順子でもないね。同じ数字3枚か、連続3枚が必要。' },
      ],
      passNeeded: 8,
    },
    mg2: {
      title: 'ミニゲーム②　アガリ形を完成させよう',
      instruction: 'あと<strong>1枚</strong>あればアガリ！何色の何の牌が必要？',
      questions: [
        {
          hand: [{c:'red',n:1},{c:'red',n:2},{c:'red',n:3},{c:'blue',n:5},{c:'blue',n:6},{c:'blue',n:7},{c:'green',n:3},{c:'green',n:4},{c:'green',n:5},{c:'green',n:9},{c:'green',n:9},{c:'red',n:7},{c:'red',n:9}],
          answer: {c:'red',n:8},
          choices: [{c:'red',n:8},{c:'red',n:6},{c:'blue',n:8},{c:'green',n:8}],
          fb: '赤8を引くと赤7・赤8・赤9の順子ができてアガリ！緑9・緑9が頭だよ。',
        },
        {
          hand: [{c:'red',n:4},{c:'red',n:5},{c:'red',n:6},{c:'green',n:7},{c:'green',n:8},{c:'green',n:9},{c:'blue',n:3},{c:'blue',n:4},{c:'blue',n:5},{c:'blue',n:2},{c:'blue',n:2},{c:'green',n:1},{c:'green',n:2}],
          answer: {c:'green',n:3},
          choices: [{c:'green',n:3},{c:'red',n:3},{c:'blue',n:3},{c:'green',n:4}],
          fb: '緑3を引くと緑1・緑2・緑3の順子ができてアガリ！青2・青2が頭だよ。',
        },
        {
          hand: [{c:'blue',n:1},{c:'blue',n:2},{c:'blue',n:3},{c:'green',n:4},{c:'green',n:5},{c:'green',n:6},{c:'red',n:2},{c:'red',n:3},{c:'red',n:4},{c:'red',n:8},{c:'red',n:8},{c:'blue',n:6},{c:'blue',n:6}],
          answer: {c:'blue',n:6},
          choices: [{c:'blue',n:6},{c:'red',n:6},{c:'green',n:6},{c:'blue',n:5}],
          fb: '青6を引くと青6・青6・青6の刻子ができてアガリ！赤8・赤8が頭だよ。',
        },
      ],
      passNeeded: 3,
    },
  };

  // ===== Chapter 3: Real suit tiles =====
  const SUITS = ['man','pin','sou'];
  const SUIT_LABELS = { man: '萬子', pin: '筒子', sou: '索子' };
  const ch3 = {
    mg1: {
      title: 'ミニゲーム①　牌の種類を当てよう',
      instruction: 'この牌は<strong>萬子・筒子・索子</strong>どれ？',
      questions: [
        { suit: 'man', num: 3, fb: '「萬」という漢字がついているのが萬子！' },
        { suit: 'pin', num: 5, fb: '丸（筒）の模様がついているのが筒子！' },
        { suit: 'sou', num: 7, fb: '竹（索）の模様がついているのが索子！' },
        { suit: 'man', num: 1, fb: '1萬は萬子！漢字の「一」と「萬」が書いてある。' },
        { suit: 'pin', num: 9, fb: '9筒は筒子！' },
        { suit: 'sou', num: 2, fb: '2索は索子！' },
        { suit: 'man', num: 6, fb: '6萬は萬子！' },
        { suit: 'pin', num: 1, fb: '1筒は筒子！' },
        { suit: 'sou', num: 4, fb: '4索は索子！' },
        { suit: 'man', num: 9, fb: '9萬は萬子！' },
      ],
      passNeeded: 8,
    },
    mg2: {
      title: 'ミニゲーム②　アガリ牌を選ぼう',
      instruction: 'テンパイの手牌を見て、<strong>アガリ牌</strong>を選ぼう！',
      questions: [
        {
          hand: [{suit:'pin',num:1},{suit:'pin',num:2},{suit:'pin',num:3},{suit:'sou',num:5},{suit:'sou',num:6},{suit:'sou',num:7},{suit:'man',num:4},{suit:'man',num:5},{suit:'man',num:6},{suit:'man',num:9},{suit:'man',num:9},{suit:'pin',num:7},{suit:'pin',num:9}],
          answer: {suit:'pin',num:8},
          choices: [{suit:'pin',num:8},{suit:'pin',num:6},{suit:'pin',num:9},{suit:'sou',num:8}],
          fb: '8筒を引くと7・8・9筒の順子ができてアガリ！9萬・9萬が頭だよ。',
        },
        {
          hand: [{suit:'man',num:3},{suit:'man',num:4},{suit:'man',num:5},{suit:'pin',num:6},{suit:'pin',num:7},{suit:'pin',num:8},{suit:'sou',num:4},{suit:'sou',num:5},{suit:'sou',num:6},{suit:'sou',num:2},{suit:'sou',num:2},{suit:'man',num:7},{suit:'man',num:9}],
          answer: {suit:'man',num:8},
          choices: [{suit:'man',num:8},{suit:'man',num:6},{suit:'man',num:9},{suit:'pin',num:8}],
          fb: '8萬を引くと7・8・9萬の順子ができてアガリ！2索・2索が頭だよ。',
        },
        {
          hand: [{suit:'man',num:1},{suit:'man',num:2},{suit:'man',num:3},{suit:'pin',num:7},{suit:'pin',num:8},{suit:'pin',num:9},{suit:'sou',num:3},{suit:'sou',num:4},{suit:'sou',num:5},{suit:'pin',num:5},{suit:'pin',num:5},{suit:'sou',num:8},{suit:'sou',num:8}],
          answer: {suit:'sou',num:8},
          choices: [{suit:'sou',num:8},{suit:'sou',num:7},{suit:'sou',num:9},{suit:'man',num:8}],
          fb: '8索を引くと8索の刻子ができてアガリ！5筒・5筒が頭だよ。',
        },
      ],
      passNeeded: 3,
    },
  };

  // ===== Chapter 4: Honor tiles =====
  const HONOR_TILES_LIST = [
    {suit:'wind',num:1},{suit:'wind',num:2},{suit:'wind',num:3},{suit:'wind',num:4},
    {suit:'dragon',num:1},{suit:'dragon',num:2},{suit:'dragon',num:3},
  ];
  const HONOR_NAMES = ['東','南','西','北','白','發','中'];
  const ch4 = {
    mg1: {
      title: 'ミニゲーム①　字牌の見た目を覚えよう',
      instruction: '裏向きの牌をめくって<strong>同じ字牌2枚</strong>を揃えよう！',
    },
    mg2: {
      title: 'ミニゲーム②　字牌は順子になる？',
      instruction: 'この3枚は<strong>順子（セット）</strong>になる？',
      questions: [
        { tiles: [{suit:'wind',num:1},{suit:'wind',num:2},{suit:'wind',num:3}], answer: false, fb: '東・南・西は字牌！字牌は順子にならないよ。' },
        { tiles: [{suit:'man',num:1},{suit:'man',num:2},{suit:'man',num:3}], answer: true, fb: '1萬・2萬・3萬は数牌で順子になる！' },
        { tiles: [{suit:'dragon',num:1},{suit:'dragon',num:2},{suit:'dragon',num:3}], answer: false, fb: '白・發・中は字牌。字牌には順序がないから順子にならない！' },
        { tiles: [{suit:'pin',num:5},{suit:'pin',num:6},{suit:'pin',num:7}], answer: true, fb: '5筒・6筒・7筒は数牌で順子になる！' },
        { tiles: [{suit:'wind',num:2},{suit:'wind',num:3},{suit:'wind',num:4}], answer: false, fb: '南・西・北も字牌。字牌は絶対に順子にならない！' },
      ],
      passNeeded: 4,
    },
    mg3: {
      title: 'ミニゲーム③　刻子を作ろう',
      instruction: '散らばった牌から<strong>同じ字牌3枚</strong>を選んで刻子を作ろう！',
      questions: [
        { pool: [{suit:'wind',num:1},{suit:'dragon',num:3},{suit:'wind',num:1},{suit:'wind',num:2},{suit:'wind',num:1},{suit:'dragon',num:1}], target: {suit:'wind',num:1}, fb: '東を3枚選んで刻子！' },
        { pool: [{suit:'dragon',num:2},{suit:'wind',num:3},{suit:'dragon',num:2},{suit:'wind',num:1},{suit:'dragon',num:2},{suit:'dragon',num:3}], target: {suit:'dragon',num:2}, fb: '發を3枚選んで刻子！' },
        { pool: [{suit:'dragon',num:3},{suit:'wind',num:4},{suit:'dragon',num:1},{suit:'dragon',num:3},{suit:'wind',num:2},{suit:'dragon',num:3}], target: {suit:'dragon',num:3}, fb: '中を3枚選んで刻子！' },
      ],
      passNeeded: 3,
    },
  };

  // ===== Chapter 5: Yakuhai =====
  const ch5 = {
    mg2: {
      title: 'ミニゲーム①　これは役牌？',
      instruction: 'この3枚の刻子は<strong>役牌</strong>になる？（場風:東、自風:南）',
      questions: [
        { tiles: [{suit:'dragon',num:1},{suit:'dragon',num:1},{suit:'dragon',num:1}], answer: true, fb: '白の刻子は役牌！白・發・中はいつでも役牌になるよ。' },
        { tiles: [{suit:'dragon',num:2},{suit:'dragon',num:2},{suit:'dragon',num:2}], answer: true, fb: '發の刻子は役牌！三元牌（白・發・中）はいつでも役牌。' },
        { tiles: [{suit:'wind',num:3},{suit:'wind',num:3},{suit:'wind',num:3}], answer: false, fb: '西（3番目の風）は今回の場風・自風じゃないから役牌にならない。' },
        { tiles: [{suit:'wind',num:1},{suit:'wind',num:1},{suit:'wind',num:1}], answer: true, fb: '東の刻子！東は場風なので役牌になるよ。' },
        { tiles: [{suit:'wind',num:2},{suit:'wind',num:2},{suit:'wind',num:2}], answer: true, fb: '南の刻子！南は自風なので役牌になるよ。' },
        { tiles: [{suit:'dragon',num:3},{suit:'dragon',num:3},{suit:'dragon',num:3}], answer: true, fb: '中の刻子は役牌！三元牌は必ず役牌。' },
        { tiles: [{suit:'wind',num:4},{suit:'wind',num:4},{suit:'wind',num:4}], answer: false, fb: '北（4番目の風）は今回の場風・自風じゃないから役牌にならない。' },
      ],
      passNeeded: 5,
    },
    mg3: {
      title: 'ミニゲーム②　役牌でアガろう',
      instruction: 'あと1枚引けばアガリ！役牌を含む形でアガリ牌を選ぼう。',
      questions: [
        {
          hand: [{suit:'dragon',num:3},{suit:'dragon',num:3},{suit:'dragon',num:3},{suit:'man',num:2},{suit:'man',num:3},{suit:'man',num:4},{suit:'pin',num:6},{suit:'pin',num:7},{suit:'pin',num:8},{suit:'sou',num:5},{suit:'sou',num:5},{suit:'man',num:6},{suit:'man',num:8}],
          answer: {suit:'man',num:7}, choices: [{suit:'man',num:7},{suit:'man',num:6},{suit:'man',num:8},{suit:'sou',num:5}],
          fb: '7萬を引くと6・7・8萬の順子ができる！中の刻子と5索の頭でアガリ。',
        },
        {
          hand: [{suit:'dragon',num:1},{suit:'dragon',num:1},{suit:'dragon',num:1},{suit:'pin',num:3},{suit:'pin',num:4},{suit:'pin',num:5},{suit:'sou',num:7},{suit:'sou',num:8},{suit:'sou',num:9},{suit:'man',num:4},{suit:'man',num:4},{suit:'pin',num:7},{suit:'pin',num:9}],
          answer: {suit:'pin',num:8}, choices: [{suit:'pin',num:8},{suit:'pin',num:7},{suit:'pin',num:9},{suit:'man',num:4}],
          fb: '8筒を引くと7・8・9筒の順子ができる！白の刻子と4萬の頭でアガリ。',
        },
      ],
      passNeeded: 2,
    },
  };

  // ===== Chapter 6: Naki (Pon/Chi) =====
  const ch6 = {
    mg1: {
      title: 'ミニゲーム①　ポン？チー？鳴けない？',
      instruction: '捨て牌を見て正しい行動を選ぼう！<br>' +
        '🔴 <strong>ポン</strong>＝同じ牌2枚持ち、誰の捨て牌でもOK<br>' +
        '🔵 <strong>チー</strong>＝上家（左）からのみ、順子が作れる場合<br>' +
        '⚪ <strong>鳴けない</strong>＝どちらも条件を満たさない',
      questions: [
        // --- ポン ---
        {
          hand: [{suit:'man',num:5},{suit:'man',num:5},{suit:'pin',num:3},{suit:'pin',num:7}],
          discard: {suit:'man',num:5}, from: 'right',
          correct: 'pon',
          fb: '5萬が2枚ある→「ポン」！ポンは右（下家）からでも誰からでもできる。刻子完成！',
        },
        {
          hand: [{suit:'dragon',num:3},{suit:'dragon',num:3},{suit:'man',num:2},{suit:'sou',num:6}],
          discard: {suit:'dragon',num:3}, from: 'opposite',
          correct: 'pon',
          fb: '中が2枚ある→「ポン」！対面（向かい）からでもポンは可能。役牌の刻子完成！',
        },
        {
          hand: [{suit:'sou',num:4},{suit:'sou',num:4},{suit:'pin',num:2},{suit:'man',num:7}],
          discard: {suit:'sou',num:4}, from: 'left',
          correct: 'pon',
          fb: '4索が2枚ある→「ポン」！上家（左）からの捨て牌でもポンを選べる。',
        },
        {
          hand: [{suit:'wind',num:2},{suit:'wind',num:2},{suit:'man',num:6},{suit:'pin',num:3}],
          discard: {suit:'wind',num:2}, from: 'right',
          correct: 'pon',
          fb: '南が2枚ある→「ポン」！自分が南家なら役牌にもなるよ。',
        },
        // --- チー（上家/左のみ） ---
        {
          hand: [{suit:'man',num:3},{suit:'man',num:4},{suit:'pin',num:7},{suit:'sou',num:2}],
          discard: {suit:'man',num:5}, from: 'left',
          correct: 'chi',
          fb: '3萬・4萬があって上家の5萬→「チー」！3-4-5萬の順子完成。チーは上家（左）からのみ。',
        },
        {
          hand: [{suit:'pin',num:7},{suit:'pin',num:8},{suit:'man',num:2},{suit:'sou',num:9}],
          discard: {suit:'pin',num:6}, from: 'left',
          correct: 'chi',
          fb: '7筒・8筒があって上家の6筒→「チー」！6-7-8筒の順子完成。',
        },
        {
          hand: [{suit:'sou',num:1},{suit:'sou',num:3},{suit:'man',num:6},{suit:'pin',num:4}],
          discard: {suit:'sou',num:2}, from: 'left',
          correct: 'chi',
          fb: '1索・3索があって上家の2索→「チー」！1-2-3索の嵌張（カンチャン）チー！',
        },
        // --- 鳴けない ---
        {
          hand: [{suit:'pin',num:2},{suit:'pin',num:4},{suit:'sou',num:6},{suit:'man',num:8}],
          discard: {suit:'pin',num:2}, from: 'right',
          correct: 'none',
          fb: '手牌に2筒がない→ポン不可。右（下家）からはチーもできない→「鳴けない」！',
        },
        {
          hand: [{suit:'man',num:3},{suit:'man',num:4},{suit:'pin',num:7},{suit:'sou',num:2}],
          discard: {suit:'man',num:5}, from: 'right',
          correct: 'none',
          fb: '3萬・4萬で5萬をチーしたいが、チーは上家（左）からのみ！右（下家）からはチーできない→「鳴けない」！',
        },
        {
          hand: [{suit:'wind',num:1},{suit:'man',num:3},{suit:'pin',num:6},{suit:'sou',num:8}],
          discard: {suit:'wind',num:1}, from: 'opposite',
          correct: 'none',
          fb: '東が1枚しかない→ポン不可。字牌は順子を作れない→チー不可→「鳴けない」！',
        },
        {
          hand: [{suit:'man',num:2},{suit:'man',num:6},{suit:'pin',num:5},{suit:'sou',num:3}],
          discard: {suit:'man',num:4}, from: 'left',
          correct: 'none',
          fb: '上家から4萬だが、2萬と6萬では4萬と順子にならない（3萬5萬なら可）→チー不可。ポンもできない→「鳴けない」！',
        },
        {
          hand: [{suit:'pin',num:5},{suit:'pin',num:5},{suit:'man',num:3},{suit:'sou',num:7}],
          discard: {suit:'pin',num:5}, from: 'left',
          correct: 'pon',
          fb: '5筒が2枚あって上家の5筒→「ポン」！同じ牌でチーは作れないのでポンが正解。',
        },
      ],
      passNeeded: 8,
    },
    mg2: null,
    mg3: {
      title: 'ミニゲーム③　ポン？チー？スルー？',
      instruction: '捨て牌に対してどう行動する？',
      questions: [
        { hand: [{suit:'dragon',num:3},{suit:'dragon',num:3},{suit:'man',num:2},{suit:'man',num:3}], discard: {suit:'dragon',num:3}, from: 'right', correctAction: 'pon', fb: '中が2枚あるからポンしよう！役牌の刻子完成。', choices: ['pon','chi','skip'] },
        { hand: [{suit:'man',num:4},{suit:'man',num:5},{suit:'pin',num:7},{suit:'sou',num:3}], discard: {suit:'man',num:6}, from: 'left', correctAction: 'chi', fb: '4萬・5萬があるから左の人の6萬でチー！4-5-6萬の順子完成。', choices: ['pon','chi','skip'] },
        { hand: [{suit:'pin',num:2},{suit:'sou',num:8},{suit:'man',num:1},{suit:'wind',num:3}], discard: {suit:'man',num:5}, from: 'right', correctAction: 'skip', fb: '手牌に5萬と関連する牌がないからスルーが正解。チーは左の人からのみ可能。', choices: ['pon','chi','skip'] },
        { hand: [{suit:'sou',num:6},{suit:'sou',num:6},{suit:'pin',num:3},{suit:'man',num:8}], discard: {suit:'sou',num:6}, from: 'left', correctAction: 'pon', fb: '6索が2枚あるからポンしよう！刻子完成。', choices: ['pon','chi','skip'] },
      ],
      passNeeded: 3,
    },
    mg4: {
      title: 'ミニゲーム④　鳴いてアガろう',
      instruction: '鳴きを使って手を完成させよう！アガリ牌を選んでね。',
      questions: [
        {
          calledMelds: [[{suit:'dragon',num:3},{suit:'dragon',num:3},{suit:'dragon',num:3}]],
          hand: [{suit:'man',num:2},{suit:'man',num:3},{suit:'man',num:4},{suit:'pin',num:5},{suit:'pin',num:6},{suit:'pin',num:7},{suit:'sou',num:8},{suit:'sou',num:8},{suit:'man',num:6},{suit:'man',num:8}],
          answer: {suit:'man',num:7}, choices: [{suit:'man',num:7},{suit:'man',num:6},{suit:'man',num:8},{suit:'sou',num:8}],
          fb: '7萬を引くと6・7・8萬の順子が完成！中の役牌ポンと8索の頭でアガリ。',
        },
        {
          calledMelds: [[{suit:'man',num:7},{suit:'man',num:8},{suit:'man',num:9}]],
          hand: [{suit:'dragon',num:2},{suit:'dragon',num:2},{suit:'pin',num:1},{suit:'pin',num:2},{suit:'pin',num:3},{suit:'sou',num:4},{suit:'sou',num:5},{suit:'sou',num:6},{suit:'pin',num:7},{suit:'pin',num:9}],
          answer: {suit:'pin',num:8}, choices: [{suit:'pin',num:8},{suit:'pin',num:7},{suit:'pin',num:9},{suit:'sou',num:8}],
          fb: '8筒を引くと7・8・9筒の順子が完成！發の頭と7-8-9萬の副露でアガリ。',
        },
      ],
      passNeeded: 2,
    },
  };

  // ===== Chapter 7: Review test =====
  const ch7 = {
    title: '道場チャレンジ　初級試験',
    instruction: '10問に答えて段位を目指そう！',
    questions: [
      { type: 'find_set', nums: [1,2,3,5,8], answer: [0,1,2], q: 'セット（3枚）を選ぼう！', fb: '1・2・3で順子！' },
      { type: 'is_set_yn', tiles: [{suit:'man',num:4},{suit:'man',num:4},{suit:'man',num:4}], answer: true, q: 'この3枚はセット？', fb: '4萬が3枚で刻子！' },
      { type: 'is_set_yn', tiles: [{suit:'man',num:1},{suit:'pin',num:2},{suit:'sou',num:3}], answer: false, q: 'この3枚はセット？', fb: '種類が違う！同じ種類でないと順子にならない。' },
      { type: 'is_honor_yn', tiles: [{suit:'wind',num:1},{suit:'wind',num:2},{suit:'wind',num:3}], answer: false, q: '東・南・西は順子になる？', fb: '字牌は順子にならない！' },
      { type: 'suit_id', tile: {suit:'pin',num:5}, answer: 'pin', q: 'この牌の種類は？', fb: '5筒は筒子！' },
      { type: 'is_yakuhai', tiles: [{suit:'dragon',num:3},{suit:'dragon',num:3},{suit:'dragon',num:3}], answer: true, q: '中の刻子は役牌？', fb: '中は三元牌でいつでも役牌！' },
      { type: 'can_pon', hand: [{suit:'sou',num:7},{suit:'sou',num:7}], discard: {suit:'sou',num:7}, answer: true, q: 'ポンできる？', fb: '7索が2枚あるからポンできる！' },
      { type: 'can_chi', hand: [{suit:'man',num:2},{suit:'man',num:3}], discard: {suit:'man',num:4}, from: 'left', answer: true, q: '左の人が4萬を捨てた。チーできる？', fb: '2萬・3萬があるから4萬でチーして2-3-4萬！' },
      { type: 'find_pair', nums: [3,3,5,7,9], answer: [0,1], q: '頭（2枚ペア）を選ぼう！', fb: '3が2枚で頭！' },
      { type: 'agari_tile', hand: [{suit:'pin',num:1},{suit:'pin',num:2},{suit:'pin',num:3},{suit:'sou',num:5},{suit:'sou',num:6},{suit:'sou',num:7},{suit:'man',num:9},{suit:'man',num:9},{suit:'man',num:9},{suit:'dragon',num:2},{suit:'dragon',num:2},{suit:'pin',num:6},{suit:'pin',num:8}], answer: {suit:'pin',num:7}, choices: [{suit:'pin',num:7},{suit:'pin',num:6},{suit:'pin',num:8},{suit:'sou',num:7}], q: 'アガリ牌はどれ？', fb: '7筒を引くと6・7・8筒の順子が完成！發の頭と9萬の刻子でアガリ！' },
    ],
  };

  // ===== Chapter 8: 初心者向けの役（立直・タンヤオ・平和） =====
  const ch8 = {
    mgs: [
      {
        type: 'yn',
        title: 'ミニゲーム①　タンヤオに使える？',
        instruction: '表示の3枚は<strong>タンヤオ</strong>に使える？（2〜8の数牌だけならOK。1・9・字牌が混じるとNG）',
        yesLabel: '○ 使える', noLabel: '✕ 使えない',
        passNeeded: 6,
        questions: [
          { tiles: [{suit:'man',num:2},{suit:'man',num:3},{suit:'man',num:4}], answer: true,  fb: '2・3・4萬は全部2〜8。タンヤオに使えるよ！' },
          { tiles: [{suit:'pin',num:1},{suit:'pin',num:2},{suit:'pin',num:3}], answer: false, fb: '1筒が入っている！1や9が混じるとタンヤオにできない。' },
          { tiles: [{suit:'sou',num:6},{suit:'sou',num:7},{suit:'sou',num:8}], answer: true,  fb: '6・7・8索は全部2〜8。タンヤオOK！' },
          { tiles: [{suit:'man',num:7},{suit:'man',num:8},{suit:'man',num:9}], answer: false, fb: '9萬が入っている！9はタンヤオNG。' },
          { tiles: [{suit:'dragon',num:1},{suit:'dragon',num:1},{suit:'dragon',num:1}], answer: false, fb: '白は字牌。字牌が入るとタンヤオにはできない。' },
          { tiles: [{suit:'pin',num:4},{suit:'pin',num:5},{suit:'pin',num:6}], answer: true,  fb: '4・5・6筒は中張牌（2〜8）だけ。タンヤオOK！' },
          { tiles: [{suit:'sou',num:1},{suit:'sou',num:1},{suit:'sou',num:1}], answer: false, fb: '1索は端の牌。1が入るとタンヤオにできない。' },
          { tiles: [{suit:'man',num:3},{suit:'man',num:4},{suit:'man',num:5}], answer: true,  fb: '3・4・5萬はすべて2〜8。タンヤオに使える！' },
        ],
      },
      {
        type: 'choice',
        title: 'ミニゲーム②　役を当てよう',
        instruction: '説明に合う役を選ぼう！',
        passNeeded: 3,
        questions: [
          { text: '門前（鳴きなし）でテンパイし、1000点を出して宣言する役は？', choices: ['立直','タンヤオ','平和','役牌'], answer: '立直', fb: '門前でテンパイしたら立直（リーチ）！1000点を供託して宣言するよ。' },
          { text: '2〜8の数牌だけ（1・9・字牌なし）で作る役は？', choices: ['立直','タンヤオ','平和','役牌'], answer: 'タンヤオ', fb: '断么九（タンヤオ）！中張牌だけで作るよ。' },
          { text: '全部順子・頭が役牌以外・両面待ち、の3条件で成立する役は？', choices: ['立直','タンヤオ','平和','役牌'], answer: '平和', fb: 'ピンフ（平和）！3つの条件すべてが必要だよ。' },
          { text: '白・發・中などの同じ牌3枚（刻子）で成立する役は？', choices: ['立直','タンヤオ','平和','役牌'], answer: '役牌', fb: '役牌（ヤクハイ）！三元牌や場風・自風の刻子で成立。' },
        ],
      },
      {
        type: 'agari',
        title: 'ミニゲーム③　タンヤオでアガろう',
        instruction: 'あと1枚でタンヤオが完成！全部2〜8のままアガれる牌を選ぼう。',
        passNeeded: 2,
        questions: [
          {
            hand: [{suit:'man',num:2},{suit:'man',num:3},{suit:'man',num:4},{suit:'pin',num:3},{suit:'pin',num:4},{suit:'pin',num:5},{suit:'sou',num:6},{suit:'sou',num:7},{suit:'sou',num:8},{suit:'man',num:5},{suit:'man',num:5},{suit:'pin',num:7},{suit:'pin',num:8}],
            answer: {suit:'pin',num:6},
            choices: [{suit:'pin',num:6},{suit:'pin',num:9},{suit:'sou',num:1},{suit:'man',num:8}],
            fb: '6筒を引くと6・7・8筒が完成！全部2〜8でタンヤオ。9筒だと9が入ってタンヤオが消えちゃう。',
          },
          {
            hand: [{suit:'sou',num:2},{suit:'sou',num:3},{suit:'sou',num:4},{suit:'man',num:3},{suit:'man',num:4},{suit:'man',num:5},{suit:'pin',num:5},{suit:'pin',num:6},{suit:'pin',num:7},{suit:'sou',num:7},{suit:'sou',num:7},{suit:'man',num:6},{suit:'man',num:8}],
            answer: {suit:'man',num:7},
            choices: [{suit:'man',num:7},{suit:'man',num:1},{suit:'sou',num:9},{suit:'pin',num:3}],
            fb: '7萬を引くと6・7・8萬が完成！全部2〜8でタンヤオ。',
          },
        ],
      },
    ],
  };

  // ===== Chapter 9: 翻を数えてみよう（翻数・ドラ・点数） =====
  const ch9 = {
    mgs: [
      {
        type: 'choice',
        title: 'ミニゲーム①　翻を数えよう',
        instruction: '役とドラを合計して何翻になるか選ぼう！（ドラ1枚＝1翻）',
        passNeeded: 4,
        questions: [
          { text: '立直（1翻）＋タンヤオ（1翻）＝ 何翻？', choices: ['1翻','2翻','3翻','4翻'], answer: '2翻', fb: '1＋1で2翻！' },
          { text: '立直（1翻）＋タンヤオ（1翻）＋ドラ1 ＝ 何翻？', choices: ['2翻','3翻','4翻','5翻'], answer: '3翻', fb: 'ドラも1翻分。1＋1＋1で3翻！' },
          { text: 'リーチ（1翻）＋一発（1翻）＋ツモ（1翻）＝ 何翻？', choices: ['2翻','3翻','4翻','5翻'], answer: '3翻', fb: '1＋1＋1で3翻！' },
          { text: '混一色（鳴きで2翻）＋役牌（1翻）＝ 何翻？', choices: ['2翻','3翻','4翻','5翻'], answer: '3翻', fb: '2＋1で3翻！' },
          { text: 'タンヤオ（1翻）＋ドラ3 ＝ 何翻？', choices: ['3翻','4翻','5翻','6翻'], answer: '4翻', fb: '1＋3で4翻！ドラはたくさん乗ると一気に増える。' },
        ],
      },
      {
        type: 'agari',
        title: 'ミニゲーム②　ドラはどれ？',
        instruction: 'ドラ表示牌の<strong>次の牌</strong>がドラ！正しいドラを選ぼう。',
        handLabel: 'ドラ表示牌（この次がドラ）',
        passNeeded: 3,
        questions: [
          { hand: [{suit:'man',num:3}], answer: {suit:'man',num:4}, choices: [{suit:'man',num:4},{suit:'man',num:3},{suit:'man',num:2},{suit:'pin',num:4}], fb: '表示牌の次がドラ。3萬の次は4萬！' },
          { hand: [{suit:'pin',num:9}], answer: {suit:'pin',num:1}, choices: [{suit:'pin',num:1},{suit:'pin',num:9},{suit:'pin',num:8},{suit:'sou',num:1}], fb: '9の次は1に戻る。9筒の次は1筒！' },
          { hand: [{suit:'dragon',num:1}], answer: {suit:'dragon',num:2}, choices: [{suit:'dragon',num:2},{suit:'dragon',num:1},{suit:'dragon',num:3},{suit:'wind',num:1}], fb: '三元牌は白→發→中→白の順。白の次は發！' },
          { hand: [{suit:'wind',num:4}], answer: {suit:'wind',num:1}, choices: [{suit:'wind',num:1},{suit:'wind',num:4},{suit:'wind',num:3},{suit:'dragon',num:1}], fb: '風牌は東→南→西→北→東。北の次は東に戻る！' },
          { hand: [{suit:'sou',num:5}], answer: {suit:'sou',num:6}, choices: [{suit:'sou',num:6},{suit:'sou',num:5},{suit:'sou',num:4},{suit:'man',num:6}], fb: '5索の次は6索！' },
        ],
      },
      {
        type: 'choice',
        title: 'ミニゲーム③　点数のランク',
        instruction: '翻数からおおよその点数ランクを選ぼう！（満貫＝子8000/親12000点）',
        passNeeded: 4,
        questions: [
          { text: '5翻は何という？', choices: ['満貫','跳満','倍満','三倍満'], answer: '満貫', fb: '5翻は満貫（マンガン）！子ロン8000点・親ロン12000点。' },
          { text: '6〜7翻は何という？', choices: ['満貫','跳満','倍満','三倍満'], answer: '跳満', fb: '6〜7翻は跳満（ハネマン）！' },
          { text: '8〜10翻は何という？', choices: ['満貫','跳満','倍満','三倍満'], answer: '倍満', fb: '8〜10翻は倍満（バイマン）！' },
          { text: '11〜12翻は何という？', choices: ['満貫','跳満','倍満','三倍満'], answer: '三倍満', fb: '11〜12翻は三倍満（サンバイマン）！' },
          { text: '13翻以上（役満相当）は何という？', choices: ['倍満','三倍満','役満','満貫'], answer: '役満', fb: '13翻以上は役満！子32000点・親48000点。' },
        ],
      },
    ],
  };

  // ===== Chapter 10: 中級者向けの役（一盃口・七対子・対々和） =====
  const ch10 = {
    mgs: [
      {
        type: 'yn',
        title: 'ミニゲーム①　七対子になる？',
        instruction: '表示の手牌は<strong>七対子</strong>（7種類すべて違う牌のペア）になっている？',
        yesLabel: '○ 七対子', noLabel: '✕ ちがう',
        passNeeded: 3,
        questions: [
          { tiles: [{suit:'man',num:1},{suit:'man',num:1},{suit:'man',num:6},{suit:'man',num:6},{suit:'pin',num:3},{suit:'pin',num:3},{suit:'pin',num:8},{suit:'pin',num:8},{suit:'sou',num:2},{suit:'sou',num:2},{suit:'sou',num:7},{suit:'sou',num:7},{suit:'dragon',num:3},{suit:'dragon',num:3}], answer: true, fb: '7種類すべて違うペア！正しい七対子だよ。' },
          { tiles: [{suit:'man',num:5},{suit:'man',num:5},{suit:'man',num:5},{suit:'man',num:5},{suit:'pin',num:2},{suit:'pin',num:2},{suit:'pin',num:7},{suit:'pin',num:7},{suit:'sou',num:3},{suit:'sou',num:3},{suit:'sou',num:9},{suit:'sou',num:9},{suit:'wind',num:1},{suit:'wind',num:1}], answer: false, fb: '同じ牌4枚を2ペアと数えるのはNG。7種類すべて違う牌のペアが必要。' },
          { tiles: [{suit:'man',num:2},{suit:'man',num:2},{suit:'man',num:9},{suit:'man',num:9},{suit:'pin',num:4},{suit:'pin',num:4},{suit:'pin',num:5},{suit:'pin',num:5},{suit:'sou',num:1},{suit:'sou',num:1},{suit:'sou',num:8},{suit:'sou',num:8},{suit:'wind',num:2},{suit:'wind',num:2}], answer: true, fb: '7種類すべて違うペア！七対子の完成形。' },
          { tiles: [{suit:'sou',num:4},{suit:'sou',num:4},{suit:'sou',num:4},{suit:'sou',num:4},{suit:'man',num:3},{suit:'man',num:3},{suit:'man',num:8},{suit:'man',num:8},{suit:'pin',num:6},{suit:'pin',num:6},{suit:'pin',num:9},{suit:'pin',num:9},{suit:'dragon',num:1},{suit:'dragon',num:1}], answer: false, fb: '4索が4枚。これは2ペアにできず6種類しかない→七対子ではない。' },
        ],
      },
      {
        type: 'choice',
        title: 'ミニゲーム②　中級役を当てよう',
        instruction: '説明に合う役を選ぼう！',
        passNeeded: 3,
        questions: [
          { text: '同じ種類・同じ数字の順子が2組ある門前役は？', choices: ['一盃口','七対子','対々和','三色同順'], answer: '一盃口', fb: '一盃口（イーペーコー）！例：2・3・4萬を2組。門前のみ。' },
          { text: '7種類の対子（2枚ペア）だけで作る役は？', choices: ['一盃口','七対子','対々和','三色同順'], answer: '七対子', fb: '七対子（チートイツ）！2翻・門前のみ。' },
          { text: 'すべての面子が刻子（同じ3枚）で順子がない役は？', choices: ['一盃口','七対子','対々和','三色同順'], answer: '対々和', fb: '対々和（トイトイ）！鳴いてもOK。' },
          { text: '萬・筒・索で同じ数字の順子を1組ずつ作る役は？', choices: ['一盃口','七対子','対々和','三色同順'], answer: '三色同順', fb: '三色同順（サンショク）！例：3・4・5を3種類で。' },
        ],
      },
      {
        type: 'yn',
        title: 'ミニゲーム③　対々和になる？',
        instruction: '表示の手牌は<strong>対々和</strong>（全部が刻子＋頭・順子なし）の形？',
        yesLabel: '○ 対々和', noLabel: '✕ ちがう',
        passNeeded: 3,
        questions: [
          { tiles: [{suit:'man',num:3},{suit:'man',num:3},{suit:'man',num:3},{suit:'pin',num:5},{suit:'pin',num:5},{suit:'pin',num:5},{suit:'sou',num:7},{suit:'sou',num:7},{suit:'sou',num:7},{suit:'dragon',num:3},{suit:'dragon',num:3},{suit:'dragon',num:3},{suit:'man',num:9},{suit:'man',num:9}], answer: true, fb: '全部刻子＋頭！対々和の形だよ。' },
          { tiles: [{suit:'man',num:2},{suit:'man',num:3},{suit:'man',num:4},{suit:'pin',num:5},{suit:'pin',num:5},{suit:'pin',num:5},{suit:'sou',num:7},{suit:'sou',num:7},{suit:'sou',num:7},{suit:'dragon',num:1},{suit:'dragon',num:1},{suit:'dragon',num:1},{suit:'man',num:9},{suit:'man',num:9}], answer: false, fb: '2・3・4萬は順子！順子があると対々和にはならない。' },
          { tiles: [{suit:'pin',num:1},{suit:'pin',num:1},{suit:'pin',num:1},{suit:'sou',num:4},{suit:'sou',num:4},{suit:'sou',num:4},{suit:'man',num:6},{suit:'man',num:6},{suit:'man',num:6},{suit:'wind',num:1},{suit:'wind',num:1},{suit:'wind',num:1},{suit:'sou',num:9},{suit:'sou',num:9}], answer: true, fb: '刻子4つ＋頭1つ。きれいな対々和！' },
          { tiles: [{suit:'sou',num:4},{suit:'sou',num:5},{suit:'sou',num:6},{suit:'man',num:2},{suit:'man',num:2},{suit:'man',num:2},{suit:'pin',num:8},{suit:'pin',num:8},{suit:'pin',num:8},{suit:'dragon',num:2},{suit:'dragon',num:2},{suit:'dragon',num:2},{suit:'sou',num:1},{suit:'sou',num:1}], answer: false, fb: '4・5・6索は順子！対々和は順子があるとダメ。' },
        ],
      },
    ],
  };

  // ===== Chapter 11: 上級者向けの役（清一色・二盃口・三槓子） =====
  const ch11 = {
    mgs: [
      {
        type: 'yn',
        title: 'ミニゲーム①　清一色になる？',
        instruction: '手牌が<strong>清一色</strong>（1種類の数牌だけ・字牌もなし）になっている？',
        yesLabel: '○ 清一色', noLabel: '✕ ちがう',
        passNeeded: 3,
        questions: [
          { tiles: [{suit:'man',num:1},{suit:'man',num:2},{suit:'man',num:3},{suit:'man',num:4},{suit:'man',num:5},{suit:'man',num:6},{suit:'man',num:7},{suit:'man',num:8},{suit:'man',num:9},{suit:'man',num:1},{suit:'man',num:1},{suit:'man',num:9},{suit:'man',num:9},{suit:'man',num:9}], answer: true, fb: '全部萬子だけ！清一色（チンイツ）だよ。' },
          { tiles: [{suit:'man',num:1},{suit:'man',num:2},{suit:'man',num:3},{suit:'man',num:4},{suit:'man',num:5},{suit:'man',num:6},{suit:'man',num:7},{suit:'man',num:8},{suit:'man',num:9},{suit:'pin',num:1},{suit:'pin',num:1},{suit:'man',num:9},{suit:'man',num:9},{suit:'man',num:9}], answer: false, fb: '筒子が混じっている！清一色は1種類の数牌だけ。' },
          { tiles: [{suit:'pin',num:1},{suit:'pin',num:2},{suit:'pin',num:3},{suit:'pin',num:4},{suit:'pin',num:5},{suit:'pin',num:6},{suit:'pin',num:7},{suit:'pin',num:8},{suit:'pin',num:9},{suit:'pin',num:5},{suit:'pin',num:5},{suit:'pin',num:1},{suit:'pin',num:1},{suit:'pin',num:1}], answer: true, fb: '全部筒子だけ！これも清一色。' },
          { tiles: [{suit:'sou',num:1},{suit:'sou',num:2},{suit:'sou',num:3},{suit:'sou',num:4},{suit:'sou',num:5},{suit:'sou',num:6},{suit:'sou',num:7},{suit:'sou',num:8},{suit:'sou',num:9},{suit:'sou',num:5},{suit:'sou',num:5},{suit:'dragon',num:1},{suit:'dragon',num:1},{suit:'dragon',num:1}], answer: false, fb: '字牌（白）が混じると清一色じゃない（それは混一色）。' },
        ],
      },
      {
        type: 'choice',
        title: 'ミニゲーム②　上級役を当てよう',
        instruction: '説明に合う役を選ぼう！',
        passNeeded: 3,
        questions: [
          { text: '1種類の数牌だけ（字牌も無し）で作る6翻の役は？', choices: ['清一色','混一色','二盃口','三槓子'], answer: '清一色', fb: '清一色（チンイツ）！門前6翻・鳴き5翻。' },
          { text: '1種類の数牌＋字牌で作る役（鳴き2翻）は？', choices: ['清一色','混一色','二盃口','三槓子'], answer: '混一色', fb: '混一色（ホンイツ）！清一色との違いは字牌を使う点。' },
          { text: '一盃口（同じ順子2組）が2セットある門前役は？', choices: ['清一色','混一色','二盃口','三槓子'], answer: '二盃口', fb: '二盃口（リャンペーコー）！3翻・門前のみ。' },
          { text: 'カン（槓子）を3回作る役は？', choices: ['清一色','混一色','二盃口','三槓子'], answer: '三槓子', fb: '三槓子（サンカンツ）！カンを3つ作る役。' },
        ],
      },
      {
        type: 'choice',
        title: 'ミニゲーム③　翻数を当てよう',
        instruction: '役の翻数を答えよう！（門前のとき）',
        passNeeded: 3,
        questions: [
          { text: '清一色は門前で何翻？', choices: ['3翻','5翻','6翻','役満'], answer: '6翻', fb: '門前の清一色は6翻！鳴くと5翻。' },
          { text: '混一色は門前で何翻？', choices: ['2翻','3翻','6翻','役満'], answer: '3翻', fb: '門前の混一色は3翻！鳴くと2翻。' },
          { text: '二盃口は何翻？', choices: ['2翻','3翻','6翻','役満'], answer: '3翻', fb: '二盃口は3翻・門前のみ。' },
          { text: '国士無双は何翻相当？', choices: ['6翻','三倍満','役満','跳満'], answer: '役満', fb: '国士無双は役満！13種の么九牌を集める。' },
        ],
      },
    ],
  };

  // ===== Chapter 12: 三人麻雀入門（北抜き・3人対局・三麻ルール） =====
  const ch12 = {
    mgs: [
      {
        type: 'yn',
        title: 'ミニゲーム①　三麻ルール○✕',
        instruction: '三人麻雀（三麻）のルール、合っている？',
        yesLabel: '○ 正しい', noLabel: '✕ まちがい',
        passNeeded: 4,
        questions: [
          { text: '三麻では萬子の2〜8を使わない（1萬と9萬は使う）。', answer: true, fb: '正しい！三麻は萬子の2〜8を抜く。1萬・9萬と筒子・索子・字牌は全部使うよ。' },
          { text: '三麻は4人で対局する。', answer: false, fb: 'まちがい！三麻は3人で対局するよ。' },
          { text: '三麻では「北」を抜きドラとして使えるルールが多い。', answer: true, fb: '正しい！抜いた北はドラ扱い（北抜き）になるルールが一般的。' },
          { text: '三麻ではチー（順子の鳴き）が基本できない。', answer: true, fb: '正しい！三麻はチーなし、ポン・カンはOKというルールが多い。' },
          { text: '三麻には親がいない。', answer: false, fb: 'まちがい！三麻にも親（東家）はいるよ。' },
        ],
      },
      {
        type: 'choice',
        title: 'ミニゲーム②　三麻の知識',
        instruction: '三麻について正しいものを選ぼう！',
        passNeeded: 3,
        questions: [
          { text: '三麻で使わない牌はどれ？', choices: ['萬子の2〜8','筒子全部','索子全部','字牌全部'], answer: '萬子の2〜8', fb: '三麻は萬子の2〜8を抜く。1萬と9萬は残るよ。' },
          { text: '抜いた「北」は何になる？', choices: ['ドラ（北抜き）','役満','罰符','使えない'], answer: 'ドラ（北抜き）', fb: '北抜き＝抜いた北がドラになるルールが一般的。' },
          { text: '三麻で基本できない鳴きは？', choices: ['チー','ポン','カン','リーチ'], answer: 'チー', fb: 'チーは基本なし。ポン・カンはできるよ。' },
          { text: '三麻の対局人数は？', choices: ['2人','3人','4人','5人'], answer: '3人', fb: '三人麻雀だから3人！' },
        ],
      },
    ],
  };

  return { ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9, ch10, ch11, ch12, HONOR_NAMES, COLOR_NAMES, SUIT_LABELS };
})();
