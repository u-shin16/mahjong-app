'use strict';

// Helper for compact tile notation in example hands
var _m = function(n) { return {suit:'man',num:n}; };
var _p = function(n) { return {suit:'pin',num:n}; };
var _s = function(n) { return {suit:'sou',num:n}; };
var _w = function(n) { return {suit:'wind',num:n}; };  // 1=東2=南3=西4=北
var _d = function(n) { return {suit:'dragon',num:n}; }; // 1=白2=發3=中

var GameData = (function() {
  var CHAPTERS = [
    { id:1, title:'一種類の数字だけで\nアガってみよう', short:'数字セット入門', diff:1, min:5, topics:['3枚セット','頭（2枚）','アガリ形'] },
    { id:2, title:'3種類の色の数字で\nアガってみよう', short:'色付き牌', diff:1, min:7, topics:['色が違うと別の牌','同じ色のみ順子OK','アガリ形完成'] },
    { id:3, title:'筒子・索子・萬子で\nアガってみよう', short:'本物の麻雀牌', diff:2, min:8, topics:['筒子・索子・萬子の見た目','牌の種類判定','本物風アガリ'] },
    { id:4, title:'字牌を覚えよう', short:'字牌', diff:2, min:8, topics:['字牌は順子にならない','神経衰弱','刻子を作る'] },
    { id:5, title:'役牌を作ってみよう', short:'役牌', diff:2, min:8, topics:['三元牌（白・發・中）','風牌','役牌でアガリ'] },
    { id:6, title:'鳴きを使ってみよう', short:'ポン・チー', diff:3, min:10, topics:['ポンの判定','チーの判定','鳴きありアガリ'] },
    { id:7, title:'復習テスト\n道場チャレンジ', short:'道場チャレンジ', diff:2, min:10, topics:['全章復習','10問テスト','段位評価'] },
    { id:8, title:'初心者向けの役', short:'役を覚えよう', diff:3, min:15, topics:['立直','タンヤオ','平和'] },
    { id:9, title:'翻を数えてみよう', short:'翻計算', diff:3, min:10, topics:['翻数','ドラ','点数'] },
    { id:10, title:'中級者向けの役', short:'中級役', diff:3, min:15, topics:['一盃口','七対子','対々和'] },
    { id:11, title:'上級者向けの役', short:'上級役', diff:3, min:15, topics:['清一色','二盃口','三槓子'] },
    { id:12, title:'三人麻雀入門', short:'三麻', diff:3, min:12, topics:['北抜き','3人対局','三麻ルール'] },
  ];

  var YAKU = [
    // 1翻
    {
      id:'riichi', name:'立直', reading:'リーチ', han:1, hanOpen:null,
      condition:'テンパイ状態で宣言する役。門前（鳴いていない）が必要。1000点を供託する。',
      mistake:'リーチ後は基本的に手を変えられない（カン以外）。テンパイでないと宣言できない。',
      chapter:8,
      example:[_m(1),_m(2),_m(3),_p(4),_p(5),_p(6),_s(7),_s(8),_s(9),_m(5),_m(6),_m(7),_p(2),_p(2)],
      winTile:_p(2), winNote:'2筒でアガリ（頭完成）'
    },
    {
      id:'ippatsu', name:'一発', reading:'イッパツ', han:1, hanOpen:null,
      condition:'リーチ後、最初のツモ番（相手の鳴きがない状態）でアガると付く。',
      mistake:'相手が鳴くと消える。カン後は消える。',
      chapter:8,
      example:[_m(1),_m(2),_m(3),_p(4),_p(5),_p(6),_s(7),_s(8),_s(9),_m(5),_m(6),_m(7),_p(2),_p(2)],
      winTile:_p(2), winNote:'リーチ後1巡目でツモ/ロン'
    },
    {
      id:'menzen_tsumo', name:'門前清自摸和', reading:'メンゼンツモ', han:1, hanOpen:null,
      condition:'鳴かない状態でツモアガリする役。',
      mistake:'鳴いているとつかない。',
      chapter:8,
      example:[_m(2),_m(3),_m(4),_p(5),_p(6),_p(7),_s(3),_s(4),_s(5),_m(7),_m(8),_m(9),_s(8),_s(8)],
      winTile:_s(8), winNote:'自分でツモってアガリ'
    },
    {
      id:'tanyao', name:'断么九', reading:'タンヤオ', han:1, hanOpen:1,
      condition:'1・9・字牌を一切使わないで作る役。2〜8だけで手を完成させる。',
      mistake:'1や9が1枚でも入るとつかない。',
      chapter:8,
      example:[_m(2),_m(3),_m(4),_m(5),_m(6),_m(7),_p(3),_p(4),_p(5),_s(6),_s(7),_s(8),_p(8),_p(8)],
      winTile:_p(8), winNote:'すべて2〜8の牌のみ'
    },
    {
      id:'pinfu', name:'平和', reading:'ピンフ', han:1, hanOpen:null,
      condition:'全部順子で、頭が役牌でなく、両面待ちでアガる役。',
      mistake:'刻子があるとつかない。単騎・カンチャン待ちはNG。',
      chapter:8,
      example:[_m(1),_m(2),_m(3),_m(4),_m(5),_m(6),_p(7),_p(8),_p(9),_s(3),_s(4),_s(5),_p(2),_p(2)],
      winTile:_s(5), winNote:'両面待ち（4索-7索待ち）でアガリ'
    },
    {
      id:'iipeiko', name:'一盃口', reading:'イーペーコー', han:1, hanOpen:null,
      condition:'同じ種類・同じ数字並びの順子を2つ作る役。門前必須。',
      mistake:'鳴いているとつかない。',
      chapter:10,
      example:[_m(2),_m(3),_m(4),_m(2),_m(3),_m(4),_p(5),_p(6),_p(7),_s(1),_s(2),_s(3),_p(9),_p(9)],
      winTile:_p(9), winNote:'2-3-4萬が2セット＝一盃口'
    },
    {
      id:'yakuhai', name:'役牌', reading:'ヤクハイ', han:1, hanOpen:1,
      condition:'白・發・中、または場の風・自分の風の牌を3枚揃える役。',
      mistake:'自風でも場風でもない風牌の刻子は役にならない。',
      chapter:5,
      example:[_m(1),_m(2),_m(3),_p(4),_p(5),_p(6),_s(7),_s(8),_s(9),_d(3),_d(3),_d(3),_m(5),_m(5)],
      winTile:_m(5), winNote:'中（中）の刻子で役牌成立'
    },
    {
      id:'rinshan', name:'嶺上開花', reading:'リンシャンカイホウ', han:1, hanOpen:1,
      condition:'カンをしたあと、嶺上牌でアガること。',
      mistake:'カン後のツモのみ。通常のツモはNG。',
      chapter:null,
      example:[_m(1),_m(2),_m(3),_p(4),_p(5),_p(6),_s(7),_s(8),_s(9),_m(5),_m(5),_m(5),_m(5),_p(2)],
      winTile:_p(2), winNote:'カン後の嶺上牌でアガリ'
    },
    {
      id:'chankan', name:'槍槓', reading:'チャンカン', han:1, hanOpen:1,
      condition:'相手が加槓した牌でロンすること。',
      mistake:'暗槓ではロンできない。',
      chapter:null,
      example:[_m(1),_m(2),_m(3),_p(4),_p(5),_p(6),_s(3),_s(4),_s(5),_m(7),_m(8),_m(9),_p(9),_p(9)],
      winTile:_p(9), winNote:'相手の加槓牌でロン'
    },
    {
      id:'haitei', name:'海底摸月', reading:'ハイテイモウユエ', han:1, hanOpen:1,
      condition:'最後の牌（海底牌）でツモアガリすること。',
      mistake:'河底（最後の捨て牌）でのロンは河底撈魚になる。',
      chapter:null,
      example:[_m(2),_m(3),_m(4),_p(5),_p(6),_p(7),_s(2),_s(3),_s(4),_m(7),_m(8),_m(9),_s(7),_s(7)],
      winTile:_s(7), winNote:'山の最後の牌でツモ'
    },
    {
      id:'houtei', name:'河底撈魚', reading:'ホウテイラオユイ', han:1, hanOpen:1,
      condition:'最後の捨て牌でロンすること。',
      mistake:'最後以外の捨て牌ではつかない。',
      chapter:null,
      example:[_m(2),_m(3),_m(4),_p(5),_p(6),_p(7),_s(2),_s(3),_s(4),_m(7),_m(8),_m(9),_s(7),_s(7)],
      winTile:_s(7), winNote:'最後の捨て牌でロン'
    },
    // 2翻
    {
      id:'double_riichi', name:'ダブル立直', reading:'ダブルリーチ', han:2, hanOpen:null,
      condition:'配牌後の最初の捨て牌の前（1巡目）に立直を宣言してアガる役。門前必須。',
      mistake:'1巡目を過ぎると通常の立直（1翻）になる。自分の捨て牌より前に他家が鳴くと成立しない。',
      chapter:8,
      example:[_m(1),_m(2),_m(3),_p(4),_p(5),_p(6),_s(7),_s(8),_s(9),_m(5),_m(6),_m(7),_p(2),_p(2)],
      winTile:_p(2), winNote:'1巡目に立直を宣言してアガリ'
    },
    {
      id:'renpuhai', name:'連風牌', reading:'レンプウハイ', han:2, hanOpen:2,
      condition:'場風と自風が同じとき（例：東場の東家のダブ東）、その風牌の刻子は役牌が2つ重なり2翻になる。',
      mistake:'場風か自風どちらか一方だけなら通常の役牌で1翻。',
      chapter:5,
      example:[_w(1),_w(1),_w(1),_m(2),_m(3),_m(4),_p(5),_p(6),_p(7),_s(3),_s(4),_s(5),_p(9),_p(9)],
      winTile:_s(5), winNote:'東場の東家で東の刻子（ダブ東）'
    },
    {
      id:'sanshoku', name:'三色同順', reading:'サンショクドウジュン', han:2, hanOpen:1,
      condition:'萬子・筒子・索子の3種類で、同じ数字の順子を1つずつ作る。',
      mistake:'3種類すべてに同じ順子が必要。1種類でも違うとNG。',
      chapter:10,
      example:[_m(2),_m(3),_m(4),_p(2),_p(3),_p(4),_s(2),_s(3),_s(4),_m(7),_m(8),_m(9),_p(6),_p(6)],
      winTile:_p(6), winNote:'2-3-4が萬・筒・索すべてに'
    },
    {
      id:'ittsu', name:'一気通貫', reading:'イッキツウカン', han:2, hanOpen:1,
      condition:'同じ種類で1-2-3・4-5-6・7-8-9の3つの順子を作る役。',
      mistake:'全部同じ種類の牌でないとNG。',
      chapter:10,
      example:[_m(1),_m(2),_m(3),_m(4),_m(5),_m(6),_m(7),_m(8),_m(9),_p(3),_p(4),_p(5),_s(6),_s(6)],
      winTile:_s(6), winNote:'萬子で1-2-3、4-5-6、7-8-9'
    },
    {
      id:'chanta', name:'混全帯么九', reading:'チャンタ', han:2, hanOpen:1,
      condition:'全ての面子と雀頭に1・9・字牌が絡む役。',
      mistake:'どれか1つでも1・9・字牌が入っていないとNG。',
      chapter:10,
      example:[_m(1),_m(2),_m(3),_p(7),_p(8),_p(9),_s(1),_s(2),_s(3),_w(1),_w(1),_w(1),_m(9),_m(9)],
      winTile:_m(9), winNote:'すべての面子・頭に1/9/字牌'
    },
    {
      id:'chiitoi', name:'七対子', reading:'チートイツ', han:2, hanOpen:null,
      condition:'7種類の対子（2枚ペア）だけで手を作る役。同じ牌を4枚使うのはNG。',
      mistake:'同じ種類の対子を2つ使うのは認められない場合が多い。',
      chapter:10,
      example:[_m(1),_m(1),_m(3),_m(3),_p(5),_p(5),_p(7),_p(7),_s(2),_s(2),_s(4),_s(4),_w(1),_w(1)],
      winTile:_w(1), winNote:'7種類の対子のみで構成'
    },
    {
      id:'toitoi', name:'対々和', reading:'トイトイ', han:2, hanOpen:2,
      condition:'全部刻子（同じ牌3枚）で揃える役。順子なし。',
      mistake:'順子が1つでもあるとつかない。',
      chapter:10,
      example:[_m(3),_m(3),_m(3),_p(5),_p(5),_p(5),_s(7),_s(7),_s(7),_w(2),_w(2),_w(2),_d(1),_d(1)],
      winTile:_d(1), winNote:'すべて刻子のみ'
    },
    {
      id:'sananko', name:'三暗刻', reading:'サンアンコウ', han:2, hanOpen:2,
      condition:'暗刻（自分でツモって作った刻子）を3つ作る。',
      mistake:'ロンで完成した刻子は暗刻に数えない。',
      chapter:10,
      example:[_m(3),_m(3),_m(3),_p(5),_p(5),_p(5),_s(7),_s(7),_s(7),_m(1),_m(2),_m(3),_p(8),_p(8)],
      winTile:_p(8), winNote:'3つの刻子をすべて自分でツモって作る'
    },
    {
      id:'sankantsu', name:'三槓子', reading:'サンカンツ', han:2, hanOpen:2,
      condition:'カンを3回行い、槓子を3つ作る役。',
      mistake:'3回カンしないとつかない。難しい役。',
      chapter:11,
      example:[_m(5),_m(5),_m(5),_m(5),_p(3),_p(3),_p(3),_p(3),_s(9),_s(9),_s(9),_s(9),_m(7),_m(7)],
      winTile:_m(7), winNote:'3種の槓子（カン3回）で構成'
    },
    {
      id:'sanshoku_doko', name:'三色同刻', reading:'サンショクドウコウ', han:2, hanOpen:2,
      condition:'萬子・筒子・索子の3種類で同じ数字の刻子を作る役。',
      mistake:'3種類すべてに同じ数字の刻子が必要。',
      chapter:null,
      example:[_m(5),_m(5),_m(5),_p(5),_p(5),_p(5),_s(5),_s(5),_s(5),_m(1),_m(2),_m(3),_p(8),_p(8)],
      winTile:_p(8), winNote:'5萬・5筒・5索の刻子が揃う'
    },
    {
      id:'shosangen', name:'小三元', reading:'ショウサンゲン', han:2, hanOpen:2,
      condition:'白・發・中のうち2つを刻子にし、残り1つを雀頭にする役。',
      mistake:'3つすべて刻子にすると大三元（役満）になる。',
      chapter:10,
      example:[_m(1),_m(2),_m(3),_d(1),_d(1),_d(1),_d(2),_d(2),_d(2),_p(4),_p(5),_p(6),_d(3),_d(3)],
      winTile:_d(3), winNote:'白・發が刻子、中が頭'
    },
    {
      id:'honroto', name:'混老頭', reading:'ホンロウトウ', han:2, hanOpen:2,
      condition:'1・9・字牌だけで手を作る役。対々和または七対子との複合。',
      mistake:'2〜8の牌が入るとつかない。',
      chapter:11,
      example:[_m(1),_m(1),_m(1),_m(9),_m(9),_m(9),_p(1),_p(1),_p(1),_w(1),_w(1),_w(1),_s(9),_s(9)],
      winTile:_s(9), winNote:'すべて1・9・字牌のみ'
    },
    // 3翻
    {
      id:'ryanpeiko', name:'二盃口', reading:'リャンペーコー', han:3, hanOpen:null,
      condition:'一盃口（同じ順子2つ）を2セット作る役。門前必須。',
      mistake:'鳴いているとつかない。',
      chapter:11,
      example:[_m(1),_m(2),_m(3),_m(1),_m(2),_m(3),_p(4),_p(5),_p(6),_p(4),_p(5),_p(6),_s(8),_s(8)],
      winTile:_s(8), winNote:'一盃口が2セット＝二盃口'
    },
    {
      id:'junchan', name:'純全帯么九', reading:'ジュンチャン', han:3, hanOpen:2,
      condition:'全ての面子と雀頭に1・9が絡む役。字牌は使わない。',
      mistake:'字牌が入るとチャンタになる。',
      chapter:11,
      example:[_m(1),_m(2),_m(3),_p(7),_p(8),_p(9),_s(1),_s(2),_s(3),_m(7),_m(8),_m(9),_p(1),_p(1)],
      winTile:_p(1), winNote:'すべての面子・頭に1か9が入る'
    },
    {
      id:'honitsu', name:'混一色', reading:'ホンイツ', han:3, hanOpen:2,
      condition:'1種類の数牌（萬・筒・索のいずれか）と字牌だけで手を作る役。',
      mistake:'2種類以上の数牌を使うとつかない。',
      chapter:8,
      example:[_m(1),_m(2),_m(3),_m(4),_m(5),_m(6),_m(7),_m(8),_m(9),_w(1),_w(1),_w(1),_m(5),_m(5)],
      winTile:_m(5), winNote:'萬子と字牌（東）のみで構成'
    },
    // 5翻（満貫）
    {
      id:'nagashi_mangan', name:'流し満貫', reading:'ナガシマンガン', han:5, hanOpen:5,
      condition:'自分の捨て牌がすべて1・9・字牌（么九牌）のまま流局すると成立する満貫扱いの特殊役。',
      mistake:'捨て牌を1枚でも他家に鳴かれると不成立。2〜8の数牌を1枚でも捨てるとダメ。',
      chapter:9,
      example:[_m(1),_m(9),_p(1),_p(9),_s(1),_s(9),_w(1),_w(2),_w(3),_w(4),_d(1),_d(2),_d(3),_m(1)],
      winTile:_m(1), winNote:'捨て牌がすべて1・9・字牌（流局時に成立）'
    },
    // 6翻
    {
      id:'chinitsu', name:'清一色', reading:'チンイツ', han:6, hanOpen:5,
      condition:'1種類の数牌だけで手を作る役。字牌も使えない。',
      mistake:'字牌が1枚でも入るとホンイツになる。',
      chapter:11,
      example:[_m(1),_m(2),_m(3),_m(4),_m(5),_m(6),_m(7),_m(8),_m(9),_m(3),_m(4),_m(5),_m(7),_m(7)],
      winTile:_m(7), winNote:'萬子のみ14枚で構成'
    },
    // 役満
    {
      id:'renho', name:'人和', reading:'レンホー', han:'yakuman', hanOpen:null,
      condition:'子が、自分の最初のツモ番より前（1巡目）に他家の捨て牌でロンする役。門前必須。',
      mistake:'ルールにより倍満・満貫扱いのこともある。1巡目までに誰かが鳴くと無効。',
      chapter:8,
      example:[_m(2),_m(3),_m(4),_p(5),_p(6),_p(7),_s(3),_s(4),_s(5),_m(7),_m(8),_m(9),_s(8),_s(8)],
      winTile:_s(8), winNote:'1巡目に他家の捨て牌でロン'
    },
    {
      id:'kokushi', name:'国士無双', reading:'コクシムソウ', han:'yakuman', hanOpen:null,
      condition:'1萬・9萬・1筒・9筒・1索・9索・東・南・西・北・白・發・中の13種類を1枚ずつ揃え、そのうちどれか1枚を重ねる。',
      mistake:'13種類が揃っているとき、その13種すべてで当たれる（十三面待ち）場合も。',
      chapter:null,
      example:[_m(1),_m(9),_p(1),_p(9),_s(1),_s(9),_w(1),_w(2),_w(3),_w(4),_d(1),_d(2),_d(3),_m(1)],
      winTile:_m(1), winNote:'13種の么九牌+1枚重複'
    },
    {
      id:'suanko', name:'四暗刻', reading:'スーアンコウ', han:'yakuman', hanOpen:null,
      condition:'暗刻を4つ作る役。単騎待ちだとダブル役満になるルールも。',
      mistake:'ロンで完成した刻子は暗刻でないため注意。',
      chapter:null,
      example:[_m(3),_m(3),_m(3),_p(5),_p(5),_p(5),_s(7),_s(7),_s(7),_w(2),_w(2),_w(2),_m(1),_m(1)],
      winTile:_m(1), winNote:'4つの刻子すべて暗刻（自力）'
    },
    {
      id:'daisangen', name:'大三元', reading:'ダイサンゲン', han:'yakuman', hanOpen:'yakuman',
      condition:'白・發・中の3種類すべてを刻子にする役。',
      mistake:'1つでも対子（2枚）のままだと大三元にならない。',
      chapter:null,
      example:[_m(1),_m(2),_m(3),_d(1),_d(1),_d(1),_d(2),_d(2),_d(2),_d(3),_d(3),_d(3),_p(5),_p(5)],
      winTile:_p(5), winNote:'白・發・中すべて刻子'
    },
    {
      id:'shosushi', name:'小四喜', reading:'ショウスーシー', han:'yakuman', hanOpen:'yakuman',
      condition:'東・南・西・北のうち3種類を刻子にし、残り1つを雀頭にする役。',
      mistake:'4種類すべて刻子にすると大四喜（ダブル役満）。',
      chapter:null,
      example:[_m(1),_m(2),_m(3),_w(1),_w(1),_w(1),_w(2),_w(2),_w(2),_w(3),_w(3),_w(3),_w(4),_w(4)],
      winTile:_w(4), winNote:'東南西が刻子、北が頭'
    },
    {
      id:'daisushi', name:'大四喜', reading:'ダイスーシー', han:'yakuman', hanOpen:'yakuman',
      condition:'東・南・西・北の4種類すべてを刻子にする役。ダブル役満扱いのルールが多い。',
      mistake:'最も難しい役満の一つ。',
      chapter:null,
      example:[_w(1),_w(1),_w(1),_w(2),_w(2),_w(2),_w(3),_w(3),_w(3),_w(4),_w(4),_w(4),_m(5),_m(5)],
      winTile:_m(5), winNote:'東南西北すべて刻子'
    },
    {
      id:'tsuiso', name:'字一色', reading:'ツーイーソー', han:'yakuman', hanOpen:'yakuman',
      condition:'字牌（東南西北白發中）だけで手を作る役。',
      mistake:'数牌が1枚でも入るとつかない。',
      chapter:null,
      example:[_w(1),_w(1),_w(1),_w(2),_w(2),_w(2),_w(3),_w(3),_w(3),_d(1),_d(1),_d(1),_w(4),_w(4)],
      winTile:_w(4), winNote:'字牌のみ14枚で構成'
    },
    {
      id:'ryuiso', name:'緑一色', reading:'リューイーソー', han:'yakuman', hanOpen:'yakuman',
      condition:'2索・3索・4索・6索・8索・發だけで手を作る役。すべて緑色の牌。',
      mistake:'發なしで作れるかはルールによって異なる。',
      chapter:null,
      example:[_s(2),_s(2),_s(2),_s(3),_s(3),_s(3),_s(4),_s(4),_s(4),_s(6),_s(6),_s(6),_d(2),_d(2)],
      winTile:_d(2), winNote:'すべて緑の牌のみで構成'
    },
    {
      id:'chinroto', name:'清老頭', reading:'チンロウトウ', han:'yakuman', hanOpen:'yakuman',
      condition:'1萬・9萬・1筒・9筒・1索・9索だけで手を作る役。対々和との複合。',
      mistake:'字牌は使えない。',
      chapter:null,
      example:[_m(1),_m(1),_m(1),_m(9),_m(9),_m(9),_p(1),_p(1),_p(1),_p(9),_p(9),_p(9),_s(9),_s(9)],
      winTile:_s(9), winNote:'1・9のみで構成（字牌なし）'
    },
    {
      id:'sukantsu', name:'四槓子', reading:'スーカンツ', han:'yakuman', hanOpen:'yakuman',
      condition:'カンを4回して槓子を4つ作る役。最後の嶺上牌でアガる必要がある。',
      mistake:'最も珍しい役満の一つ。',
      chapter:null,
      example:[_m(5),_m(5),_m(5),_m(5),_p(3),_p(3),_p(3),_p(3),_s(9),_s(9),_s(9),_s(9),_m(7),_m(7)],
      winTile:_m(7), winNote:'4種の槓子（カン4回）で構成'
    },
    {
      id:'churenp', name:'九蓮宝燈', reading:'チューレンポウトウ', han:'yakuman', hanOpen:null,
      condition:'1種類の数牌で1-1-1-2-3-4-5-6-7-8-9-9-9と9種揃え、どれか1枚を加えた形。',
      mistake:'門前必須。とても難しい役満。',
      chapter:null,
      example:[_m(1),_m(1),_m(1),_m(2),_m(3),_m(4),_m(5),_m(6),_m(7),_m(8),_m(9),_m(9),_m(9),_m(5)],
      winTile:_m(5), winNote:'萬子で1112345678999+1枚'
    },
    {
      id:'tenho', name:'天和', reading:'テンホウ', han:'yakuman', hanOpen:null,
      condition:'親が配牌の14枚でアガる役。ゲーム開始直後のアガリ。',
      mistake:'親専用。子は地和になる。',
      chapter:null,
      example:[_m(1),_m(2),_m(3),_p(4),_p(5),_p(6),_s(7),_s(8),_s(9),_m(5),_m(6),_m(7),_p(2),_p(2)],
      winTile:_p(2), winNote:'親の配牌時点でアガリ'
    },
    {
      id:'chiho', name:'地和', reading:'チーホウ', han:'yakuman', hanOpen:null,
      condition:'子が最初のツモでアガる役（相手の鳴きがない場合）。',
      mistake:'子専用。最初のツモ以外はNG。',
      chapter:null,
      example:[_m(1),_m(2),_m(3),_p(4),_p(5),_p(6),_s(7),_s(8),_s(9),_m(5),_m(6),_m(7),_p(2),_p(2)],
      winTile:_p(2), winNote:'子の最初のツモでアガリ'
    },
  ];

  var TERMS = [
    { kanji:'和了', reading:'アガリ', desc:'手牌が完成して点数をもらうこと。麻雀の目標。' },
    { kanji:'聴牌', reading:'テンパイ', desc:'あと1枚でアガれる状態のこと。テンパイ中は特定の牌で上がれる。' },
    { kanji:'向聴', reading:'シャンテン', desc:'アガリまでに必要な牌の枚数。テンパイが0シャンテン、アガリが-1シャンテン。' },
    { kanji:'面子', reading:'メンツ', desc:'3枚で完成する1セット。順子・刻子・槓子の総称。' },
    { kanji:'雀頭', reading:'ジャントウ', desc:'アガリ形に必要な同じ牌2枚の「頭」。' },
    { kanji:'順子', reading:'シュンツ', desc:'同じ種類で連続した数字3枚（例：3筒・4筒・5筒）。字牌では作れない。' },
    { kanji:'刻子', reading:'コーツ', desc:'同じ牌3枚のセット（例：発・発・発）。' },
    { kanji:'槓子', reading:'カンツ', desc:'同じ牌4枚を揃えること（カン）。3枚より強力で翻数に影響する場合も。' },
    { kanji:'自摸', reading:'ツモ', desc:'自分で山から牌を引いて手牌に加えること。ツモアガリはボーナスの役がつく。' },
    { kanji:'栄和', reading:'ロン', desc:'他人の捨て牌でアガること。「ロン！」と宣言して上がる。' },
    { kanji:'立直', reading:'リーチ', desc:'テンパイ時に1000点を払って宣言する役。追加でドラが期待できる。' },
    { kanji:'鳴き', reading:'ナキ', desc:'他人の捨て牌を使って面子を完成させること。ポン・チー・カンの総称。' },
    { kanji:'ポン', reading:'ポン', desc:'誰かの捨て牌と自分の手牌2枚を合わせて刻子を作る鳴き。誰からでも鳴ける。' },
    { kanji:'チー', reading:'チー', desc:'左の人（上家）の捨て牌と手牌2枚を合わせて順子を作る鳴き。左隣からのみ。' },
    { kanji:'カン', reading:'カン', desc:'同じ牌4枚を揃えること。槓子が完成し、嶺上牌を1枚引ける。' },
    { kanji:'ドラ', reading:'ドラ', desc:'持っていると翻が増えるボーナス牌。ドラ表示牌の次の牌がドラ。' },
    { kanji:'裏ドラ', reading:'ウラドラ', desc:'リーチしてアガったとき、ドラ表示牌の下に隠れていたドラ表示牌から判明するドラ。' },
    { kanji:'場風', reading:'バカゼ', desc:'その局全体の風。東場は東が場風、南場は南が場風。' },
    { kanji:'自風', reading:'ジカゼ', desc:'自分の席の風。東家は東、南家は南、西家は西、北家は北。' },
    { kanji:'親', reading:'オヤ', desc:'東家（起家）のプレイヤー。アガリ時の点数が高い。流局しても流れない。' },
    { kanji:'子', reading:'コ', desc:'親以外のプレイヤー（南・西・北家）。親よりも受け取り点数が少ない。' },
    { kanji:'河', reading:'ホー', desc:'捨て牌を置く場所。自分の手前に並べていく。' },
    { kanji:'山', reading:'ヤマ', desc:'これから引く牌の山。通常は壁のように並べる。' },
    { kanji:'手牌', reading:'テハイ', desc:'自分が持っている牌。通常13枚（ツモしたとき14枚）。' },
    { kanji:'配牌', reading:'ハイパイ', desc:'局の最初に各プレイヤーに配られる13枚の牌。' },
    { kanji:'フリテン', reading:'フリテン', desc:'自分が捨てた牌がアガリ牌になっているとき、ロンができない状態。' },
    { kanji:'放銃', reading:'ホウジュウ', desc:'自分の捨て牌で相手にロンされること。振り込みとも言う。' },
    { kanji:'翻', reading:'ハン', desc:'役の強さを表す単位。翻数が高いほど点数が高くなる。' },
    { kanji:'符', reading:'フ', desc:'点数計算に使う単位。手の形によって変わる。' },
    { kanji:'満貫', reading:'マンガン', desc:'5翻以上（または特定条件）で支払われる点数上限の一つ。子のロンで8000点。' },
    { kanji:'跳満', reading:'ハネマン', desc:'満貫の1.5倍。子のロンで12000点。' },
    { kanji:'倍満', reading:'バイマン', desc:'満貫の2倍。子のロンで16000点。' },
    { kanji:'役満', reading:'ヤクマン', desc:'特別に難しい最高位の役。子のロンで32000点。' },
    { kanji:'本場', reading:'ホンバ', desc:'流局や親のアガリで積まれるカウンター。1本場ごとに点数が増える。' },
    { kanji:'供託', reading:'キョウタク', desc:'リーチや罰則で場に置かれた点棒。次のアガリ者が受け取る。' },
    { kanji:'点棒', reading:'テンボウ', desc:'麻雀で使う点数を表す棒。1本・5本・10本・50本・100本などがある。' },
    { kanji:'東場', reading:'トンバ', desc:'東1局〜東4局の4局ひとまとめ。東風戦はこれだけで終了。' },
    { kanji:'半荘', reading:'ハンチャン', desc:'東場と南場の合計8局。一般的な麻雀の1ゲーム単位。' },
    { kanji:'流局', reading:'リュウキョク', desc:'誰もアガれないまま山がなくなること。テンパイの人は罰則なし、ノーテンは点数を払う。' },
    { kanji:'北抜き', reading:'キタヌキ', desc:'三人麻雀のルール。北牌を手牌から抜いてドラとして扱う。' },
  ];

  return { CHAPTERS: CHAPTERS, YAKU: YAKU, TERMS: TERMS };
})();
