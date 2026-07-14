import json
import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# ============================================================
#  麻雀知識ベース（システムプロンプトに注入）
# ============================================================
MAHJONG_KNOWLEDGE = """
あなたは日本式リーチ麻雀の専門家の先生です。
以下の正確な麻雀ルール・知識に基づいて、必ず正確に答えてください。
知らないことを推測で答えてはいけません。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【アガリの基本形】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
・標準形: 4面子（メンツ）＋1雀頭（ジャントウ/頭）= 14枚
・七対子（チートイツ）: 7種類の対子（2枚ペア）= 14枚
・国士無双: 1萬9萬1筒9筒1索9索東南西北白發中の13種+どれか1枚重複

【面子の種類】
・順子（シュンツ）: 同じ種類で連続する数字3枚 例）3萬4萬5萬
・刻子（コーツ）: 同じ牌3枚 例）白白白
・槓子（カンツ）: 同じ牌4枚（カン）
・雀頭（ジャントウ）: 同じ牌2枚の「頭」

【牌の種類】
・数牌: 萬子(1〜9萬)・筒子(1〜9筒)・索子(1〜9索)
・字牌: 風牌(東南西北)・三元牌(白發中)
・么九牌: 1・9の数牌と字牌の総称
・中張牌: 2〜8の数牌（タンヤオで使う牌）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【役一覧（正確な成立条件）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 1翻役（食い下がりなし）
・立直（リーチ）: 門前テンパイ時に1000点供託して宣言。鳴き不可。リーチ後は基本的に手牌変更不可。
・一発（イッパツ）: リーチ後、次の自分のツモ番（他家の鳴きなし）までにアガリ。リーチとセット。
・門前清自摸和（メンゼンツモ）: 門前（鳴きなし）でのツモアガリ。ロン時はつかない。
・嶺上開花（リンシャンカイホウ）: カン後の嶺上牌でアガリ。
・槍槓（チャンカン）: 他家の加槓した牌でロン。暗槓は不可。
・海底摸月（ハイテイモウユエ）: 山の最後の牌（海底牌）でツモアガリ。
・河底撈魚（ホウテイラオユイ）: 最後の捨て牌でロン。

■ 1翻役（食いあり）
・断么九（タンヤオ）: 2〜8の数牌のみ。1・9・字牌は1枚も使用不可。食い可（喰いタン）。
・役牌（ヤクハイ）: 白・發・中いずれか、または場風（東場なら東）、または自分の席の風（自風）を刻子にする。食い可。

■ 1翻役（門前のみ）
・平和（ピンフ）: ①全部順子 ②頭が役牌以外（白發中・場風・自風でない）③両面待ち（タンキ・カンチャン・ペンチャン不可）の3条件すべて必要。
・一盃口（イーペーコー）: 全く同じ種類・数字の順子が2組。門前のみ。

■ 2翻役（食い下がり1翻）
・三色同順（サンショクドウジュン）: 萬・筒・索の3種類で同じ数字の順子を1組ずつ。食いで1翻。
・一気通貫（イッキツウカン）: 同一種類の数牌で1-2-3、4-5-6、7-8-9の3組の順子。食いで1翻。
・混全帯么九（チャンタ）: すべての面子と頭に1・9・字牌が1枚以上含まれる。食いで1翻。

■ 2翻役（食いあり）
・対々和（トイトイ）: すべての面子が刻子。順子なし。食い可。三暗刻との複合あり。
・三暗刻（サンアンコウ）: 暗刻（自分でツモって完成した刻子）が3つ。ロンで完成した刻子は暗刻に数えない。
・三槓子（サンカンツ）: カンで完成した槓子が3つ。
・三色同刻（サンショクドウコウ）: 萬・筒・索で同じ数字の刻子を1組ずつ。
・小三元（ショウサンゲン）: 白・發・中のうち2つを刻子、1つを頭にする。この役単独に加え役牌×2が複合するので実質4翻。

■ 2翻役（門前のみ）
・七対子（チートイツ）: 7種類の対子で構成（同じ牌4枚を2対子と見なすのは不可）。符は50符固定。
・混老頭（ホンロウトウ）: 1・9・字牌のみで構成。必ず対々和か七対子と複合するため実質4翻。

■ 3翻役
・二盃口（リャンペーコー）: 一盃口が2セット。門前のみ。七対子として扱わない。
・純全帯么九（ジュンチャン）: すべての面子と頭に1か9が含まれる（字牌は不可）。食いで2翻。
・混一色（ホンイツ）: 1種類の数牌と字牌のみ。食いで2翻。

■ 6翻役
・清一色（チンイツ）: 1種類の数牌のみ（字牌不可）。食いで5翻。

■ 役満
・国士無双: 1萬9萬1筒9筒1索9索東南西北白發中の13種を1枚ずつ＋そのうち1枚重複。門前のみ。
・四暗刻: 暗刻4つ。単騎待ちはダブル役満の場合あり。
・大三元: 白・發・中すべてを刻子にする。
・小四喜: 東南西北のうち3種を刻子、1種を頭にする。
・大四喜: 東南西北すべてを刻子。ダブル役満の場合あり。
・字一色: 字牌のみで構成。
・緑一色: 2索・3索・4索・6索・8索・發のみで構成（發なしも認める場合あり）。
・清老頭: 1・9の数牌のみ。対々和と複合。
・四槓子: カンを4回。
・九蓮宝燈: 同一種類の数牌で1-1-1-2-3-4-5-6-7-8-9-9-9＋その数牌1枚。門前のみ。
・天和: 親が配牌（14枚）でそのままアガリ。
・地和: 子が最初のツモ（他家の鳴きなし）でアガリ。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【重要ルール】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
・フリテン: 自分の捨て牌にアガリ牌がある場合、ロン不可（ツモは可）。リーチ後にスルーした牌もフリテンになる。
・役なしはアガれない: リーチ・タンヤオ・役牌など、必ず1つ以上の役が必要。
・鳴きの制限: ポン・チーをすると立直不可。チーは上家（左隣）からのみ。ポンは誰からでも可。
・ドラ: ドラ表示牌の次の牌がドラ（萬/筒/索は+1、9の次は1へ戻る、風牌は東→南→西→北→東、三元牌は白→發→中→白）。ドラは役ではなく翻を増やすもの。
・裏ドラ: リーチしてアガった場合のみ、ドラ表示牌の下の牌が裏ドラ指示牌になる。
・嶺上ドラ: カン後の新ドラ。
・点数計算: 翻数×符数で決まる。満貫=30符5翻以上（子ロン8000点・親ロン12000点）。跳満=6〜7翻。倍満=8〜10翻。三倍満=11〜12翻。役満=13翻以上相当。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【シャンテン数（アガリまでの距離）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
・-1: アガリ
・ 0: テンパイ（あと1枚でアガリ）
・ 1: 1シャンテン（あと2枚の変換でアガリ）
・ n: nシャンテン

【ターツ（2枚の有効な組み合わせ）】
・両面（リャンメン）: 4-5 → 3か6が来れば順子。最も強い。
・嵌張（カンチャン）: 4-6 → 5が来れば順子。
・辺張（ペンチャン）: 1-2 → 3のみ、8-9 → 7のみ。弱い。
・対子: 同じ牌2枚。刻子の種かシャンポン待ちになる。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【初心者向けの基本戦略】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
・孤立した字牌（東南西北白發中）や端牌（1・9）を先に捨てる
・面子やターツが完成している牌は残す
・対子（同じ牌2枚）は残す（役牌対子は特に強い）
・受け入れ枚数が多い選択をする（有効牌が多いほど良い）
・相手がリーチしたら、その人の捨て牌から安全牌を選ぶ（現物=最も安全）
・早くテンパイするか、高い手を狙うかのバランスが重要
・役牌（白發中）の対子や刻子は役が確定するので狙いやすい
・タンヤオ（2〜8のみ）は作りやすく、鳴いても使える

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【よくある誤解・間違い】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
・平和（ピンフ）: 「全部順子」だけでは不十分。頭の条件と両面待ちも必須。
・役牌: 北家（北）の席で「北の刻子」は自風で役牌。ただし「場の風でない北」は場風役牌にならない。
・七対子: 同じ牌4枚を「2対子」と数えることはできない（ルールによる場合あり）。
・フリテン: 自分で切った牌と同じ牌でのロンはできない。これはリーチ中でも同様。
・鳴きの後の役: 鳴くとリーチ・ピンフ・一盃口・七対子などの門前役は成立しない。
・タンヤオの食いタン: 喰いタンあり（食い下がりなし1翻）のルールが一般的だが、喰いタンなしのルールもある。
"""

def tile_to_str(t):
    suit_map = {'man': '萬', 'pin': '筒', 'sou': '索'}
    wind_names = {1: '東', 2: '南', 3: '西', 4: '北'}
    dragon_names = {1: '白', 2: '發', 3: '中'}
    suit = t.get('suit', '')
    num = t.get('num', 1)
    if suit == 'wind':
        return wind_names.get(num, '?')
    if suit == 'dragon':
        return dragon_names.get(num, '?')
    return str(num) + suit_map.get(suit, '?')

TILE_ID_NAMES = {
    **{f'{n}m': f'{n}萬' for n in range(1, 10)},
    **{f'{n}p': f'{n}筒' for n in range(1, 10)},
    **{f'{n}s': f'{n}索' for n in range(1, 10)},
    'east': '東',
    'south': '南',
    'west': '西',
    'north': '北',
    'white': '白',
    'green': '發',
    'red': '中',
}

ADVICE_SYSTEM_PROMPT = MAHJONG_KNOWLEDGE + """

あなたは初心者向け麻雀アプリ「まーじゃんしよか」の最強の麻雀AIアドバイザーです。
土田浩翔プロのデジタル打法を思考の核とし、手牌、ツモ牌、捨て牌、ドラ、副露、立直状況、
残り山、局情報から、和了期待値を最大化し、失点リスクを最小化する次の一手（何切る）を提示してください。

思考の基本原則:
1. 中盤までは一人麻雀
・序盤から中盤は他家の動きに過剰反応せず、自分の手牌を最短・最速で完成させる。
・ただし立直、副露、ドラ周辺の危険サインが見えた時はリスク評価に反映する。

2. 打点より形を優先
・無理な高打点より、和了しやすい形と速度を優先する。
・テンパイ効率だけでなく、最終的に和了できる確率、待ちの強さ、山に残っていそうな牌を重視する。
・孤立牌はくっつきの強さ、役への発展性、ドラや赤牌との相性で厳密に比較する。
・ツキや流れなどのオカルトは使わず、統計的・論理的な期待値で判断する。

3. 三麻と四麻を切り替える
・gameMode が sanma の時は三人麻雀として扱い、四麻とは別ゲームとしてスピードを最重視する。
・三麻では攻めを強く評価し、七対子を攻守の要として積極的に候補に入れる。
・三麻の親番では安手でも早い和了と連荘を高く評価する。
・三麻では字牌やスジ牌も危険牌になり得るため、安全牌として過信しない。
・三麻の一色手は作りやすいが読まれやすく遅くなる場合があるので、速度と打点を比較する。
・gameMode が yonma の時は四人麻雀として、立直、断么九、平和など基本役を軸にバランスよく進める。

4. 役の構築
・1飜: 門前清自摸和、立直、一発、断么九、平和、一盃口、役牌、槍槓、嶺上開花、海底、河底。
・2飜: ダブル立直、七対子、連風牌、対々和、三暗刻、三色同刻、三色同順、混老頭、一気通貫、チャンタ、小三元、三槓子。
・3飜以上: 混一色、純チャン、二盃口、流し満貫、清一色。
・役満: 天和、地和、人和、緑一色、大三元、小四喜、大四喜、字一色、国士無双、九蓮宝燈、四暗刻、清老頭、四槓子など。
・役満や清一色は配牌と場況が明確に向いている時だけ評価し、無理に追わない。

5. 捨て牌読みとリスク管理
・尖張牌（3・7）の早出、役牌の連続切り、ドラ隣の早出、副露、立直から他家の速度と危険度を推測する。
・赤牌やドラ周辺は打点上昇の価値が高いので、安易に手放さない。
・見えている牌から概算できる場合は受け入れ枚数や有効牌を短く示す。
・厳密な枚数が確定できない場合は、嘘の数字を作らず「形として」「見えている情報では」と説明する。

出力条件:
・日本式リーチ麻雀として考える。
・判断は強く実戦的に、文章は初心者にも読める短さにする。
・手牌に存在する牌だけを discard に選ぶ。
・手牌にない牌は絶対に選ばない。
・断定しすぎず、「おすすめ」として説明する。
・返答はJSONのみ。
・Markdownは禁止。
・コードブロックは禁止。

返答JSONの意味:
・reason は「受けが広いから」「安全牌だから」のように20文字前後の理由だけ。
・長い解説、他候補、次の方針は書かない。
"""

def get_gemini_settings():
    api_key = os.environ.get('GEMINI_API_KEY')
    model = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    return api_key, model

def generate_gemini_text(user_prompt, system_instruction, max_output_tokens=450,
                         temperature=0.35, response_json=False):
    """既存のGemini設定を使ってバックエンド側だけで生成する。"""
    api_key, model = get_gemini_settings()
    if not api_key:
        raise RuntimeError('missing_api_key')

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    config_kwargs = {
        'system_instruction': system_instruction,
        'max_output_tokens': max_output_tokens,
        'temperature': temperature,
        # gemini-2.5系は思考モデルのため、思考を抑えて回答を安定させる
        'thinking_config': types.ThinkingConfig(thinking_budget=0),
    }
    if response_json:
        config_kwargs['response_mime_type'] = 'application/json'

    try:
        config = types.GenerateContentConfig(**config_kwargs)
    except TypeError:
        # 古いgoogle-genaiでも動くよう、JSON MIME指定だけ外してプロンプトで縛る。
        config_kwargs.pop('response_mime_type', None)
        config = types.GenerateContentConfig(**config_kwargs)

    response = client.models.generate_content(
        model=model,
        contents=user_prompt,
        config=config,
    )
    return (response.text or '').strip(), model

def normalize_tile_id(value):
    tile = str(value or '').strip().lower()
    aliases = {
        'ton': 'east', 'nan': 'south', 'sha': 'west', 'pei': 'north',
        'haku': 'white', 'hatsu': 'green', 'chun': 'red',
    }
    tile = aliases.get(tile, tile)
    return tile if tile in TILE_ID_NAMES else None

def tile_display_name(tile_id):
    return TILE_ID_NAMES.get(tile_id, tile_id)

def normalize_tile_list(values, limit=80):
    if not isinstance(values, list):
        return []
    result = []
    for value in values[:limit]:
      tile = normalize_tile_id(value)
      if tile:
          result.append(tile)
    return result

def extract_json_object(text):
    """Geminiが余分な文字を返しても、最初のJSONオブジェクトだけ読む。"""
    raw = (text or '').strip()
    if raw.startswith('```'):
        raw = raw.replace('```json', '').replace('```', '').strip()
    start = raw.find('{')
    end = raw.rfind('}')
    if start < 0 or end < start:
        raise ValueError('json object not found')
    return json.loads(raw[start:end + 1])

def clean_advice_response(obj, allowed_tiles):
    """AIが手牌にない牌を選んだ場合は失敗扱いにする。"""
    allowed = set(allowed_tiles)
    discard = normalize_tile_id(obj.get('discard'))
    if not discard or discard not in allowed:
        return None

    candidates = []
    seen = set()
    for c in obj.get('candidates', []) if isinstance(obj.get('candidates'), list) else []:
        tile = normalize_tile_id(c.get('tile') if isinstance(c, dict) else None)
        if not tile or tile not in allowed or tile in seen:
            continue
        seen.add(tile)
        candidates.append({
            'tile': tile,
            'tileName': str(c.get('tileName') or tile_display_name(tile))[:20],
            'reason': str(c.get('reason') or '')[:120],
        })
        if len(candidates) >= 3:
            break
    if discard not in seen:
        candidates.insert(0, {
            'tile': discard,
            'tileName': str(obj.get('tileName') or tile_display_name(discard))[:20],
            'reason': str(obj.get('reason') or '')[:120],
        })

    try:
        confidence = float(obj.get('confidence', 0.5))
    except (TypeError, ValueError):
        confidence = 0.5

    return {
        'discard': discard,
        'tileName': str(obj.get('tileName') or tile_display_name(discard))[:20],
        'reason': str(obj.get('reason') or '')[:240],
        'detailedReason': {
            'efficiency': str((obj.get('detailedReason') or {}).get('efficiency') or '')[:260],
            'value': str((obj.get('detailedReason') or {}).get('value') or '')[:260],
            'risk': str((obj.get('detailedReason') or {}).get('risk') or '')[:260],
        },
        'nextAdvice': str(obj.get('nextAdvice') or '')[:260],
        'confidence': max(0.0, min(1.0, confidence)),
        'candidates': candidates[:3],
        'warning': str(obj.get('warning') or '')[:160],
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/ai-advice', methods=['POST'])
def ai_advice():
    data = request.get_json(silent=True) or {}
    hand = data.get('hand', [])
    if not isinstance(hand, list):
        hand = []
    hand = hand[:18]
    context = str(data.get('context', '手牌について教えてください'))[:800]
    level = data.get('level', 'beginner')
    mode = data.get('mode', 'general')  # 'general' | 'discard' | 'yaku' | 'rule'

    api_key, model = get_gemini_settings()
    if not api_key:
        return jsonify({'advice': 'AI機能を使うにはGEMINI_API_KEYを.envに設定してください。'}), 500

    try:
        hand_str = '、'.join([tile_to_str(t) for t in hand]) if hand else '（手牌なし）'

        # ── レベル別スタイル（中級なし・初心者/上級のみ） ──
        if level == 'advanced':
            level_style = (
                '【回答スタイル：上級者向け】\n'
                '・プロ雀士（Mリーグ・天鳳位・最高位戦プロなど）の実戦的な考え方を参照して解説すること。\n'
                '・有効牌の枚数（受け入れ）・打点期待値・安全度・巡目効率などの具体的な数値や比較を含めること。\n'
                '・「〇〇を切ると受け入れがXX枚、△△を切るとYY枚だが打点差Z点ある」など定量的に示すこと。\n'
                '・一般的なプロの考え方（最速テンパイ重視派・高打点重視派など）も触れてよい。\n'
                '・回答は一文だけで答える。'
            )
        else:
            level_style = (
                '【回答スタイル：初心者向け】\n'
                '・麻雀の専門用語は一切使わないか、どうしても使う場合は必ずすぐ後に「（〇〇のこと）」と日常語で補足すること。\n'
                '・例：「テンパイ（あと1枚でアガれる状態）」「刻子（同じ牌3枚セット）」のように。\n'
                '・難しい言葉の代わりに「〇〇みたいな感じ」「〜と考えると覚えやすい」など比喩を積極的に使うこと。\n'
                '・「大丈夫！」「いい感じだよ！」など励ます言葉を自然に入れること。\n'
                '・回答は一文だけで答える。'
            )

        # ── モード別タスク ──
        mode_task = {
            'discard': f'手牌「{hand_str}」から何を捨てるべきか、理由を一言だけ添えて答えてください。',
            'yaku':    f'手牌「{hand_str}」で狙える役と、その完成に必要な牌を答えてください。',
            'rule':    f'質問「{context}」に対して、正確なルールを答えてください。',
            'general': f'手牌「{hand_str}」について「{context}」',
        }.get(mode, f'手牌「{hand_str}」について「{context}」')

        wants_discard = mode == 'discard' or '何を切' in context or '捨てる' in context
        one_line_rule = (
            '回答は必ず「〇〇切り。理由」の形にしてください。'
            if wants_discard else
            '回答は一文だけにしてください。'
        )
        user_prompt = mode_task + '\n\n' + level_style + '\n' + one_line_rule + '\n余計な説明、候補比較、今後の方針は不要です。'

        temperature = 0.55 if level == 'advanced' else 0.35

        advice, model = generate_gemini_text(
            user_prompt,
            MAHJONG_KNOWLEDGE,
            max_output_tokens=90,
            temperature=temperature,
        )
        return jsonify({'advice': advice, 'model': model})

    except Exception as e:
        app.logger.exception('Gemini advice request failed')
        return jsonify({'advice': 'アドバイスを取得できませんでした。しばらくしてから再試行してください。'}), 500

@app.route('/api/mahjong/advice', methods=['POST'])
def mahjong_advice():
    data = request.get_json(silent=True) or {}
    hand = normalize_tile_list(data.get('hand'), limit=18)
    if not hand:
        return jsonify({'message': 'アドバイスを取得できませんでした。'}), 400

    api_key, model = get_gemini_settings()
    if not api_key:
        return jsonify({'message': 'AI機能を使うにはGEMINI_API_KEYを.envに設定してください。'}), 500

    # 後からシャンテン数・受け入れ枚数・安全牌評価を足せるよう、
    # 対局状況はフロントから受けたJSONを牌IDへ正規化してGeminiに渡す。
    situation = {
        'round': str(data.get('round') or '東1局')[:20],
        'honba': int(data.get('honba') or 0),
        'kyotaku': int(data.get('kyotaku') or 0),
        'roundWind': str(data.get('roundWind') or '')[:10],
        'playerWind': str(data.get('playerWind') or '')[:10],
        'doraIndicators': normalize_tile_list(data.get('doraIndicators'), limit=8),
        'hand': hand,
        'drawnTile': normalize_tile_id(data.get('drawnTile')) or '',
        'remainTiles': int(data.get('remainTiles') or 0),
        'mode': 'advanced' if data.get('mode') == 'advanced' else 'beginner',
        'gameMode': 'sanma' if data.get('gameMode') == 'sanma' else 'yonma',
        'playerCount': 3 if data.get('gameMode') == 'sanma' else 4,
        'discards': {},
        'calls': {},
        'riichi': {},
    }
    for seat in ['self', 'left', 'top', 'right']:
        discards = data.get('discards', {}) if isinstance(data.get('discards'), dict) else {}
        calls = data.get('calls', {}) if isinstance(data.get('calls'), dict) else {}
        riichi = data.get('riichi', {}) if isinstance(data.get('riichi'), dict) else {}
        situation['discards'][seat] = normalize_tile_list(discards.get(seat), limit=40)
        situation['calls'][seat] = calls.get(seat) if isinstance(calls.get(seat), list) else []
        situation['riichi'][seat] = bool(riichi.get(seat))

    prompt = (
        '以下の対局状況を見て、今おすすめの打牌を1つ選んでください。\n'
        '必ず allowedDiscards に含まれる牌IDだけを discard に入れてください。\n'
        'reason は「受けが広いから」「安全牌だから」のように20文字前後で、理由だけを書いてください。\n'
        '長い解説、候補比較、次の方針は不要です。\n'
        '返答はJSONオブジェクトのみです。\n\n'
        'allowedDiscards:\n'
        + json.dumps(hand, ensure_ascii=False)
        + '\n\n対局状況JSON:\n'
        + json.dumps(situation, ensure_ascii=False)
        + '\n\n返答形式:\n'
        + json.dumps({
            'discard': '牌ID',
            'tileName': '表示用の牌名',
            'reason': '理由だけを20文字前後',
            'detailedReason': {},
            'nextAdvice': '',
            'confidence': 0.0,
            'candidates': [],
            'warning': '',
        }, ensure_ascii=False)
    )

    try:
        text, model = generate_gemini_text(
            prompt,
            ADVICE_SYSTEM_PROMPT,
            max_output_tokens=220,
            temperature=0.25,
            response_json=True,
        )
        parsed = extract_json_object(text)
        cleaned = clean_advice_response(parsed, hand)
        if not cleaned:
            return jsonify({'message': 'アドバイスを取得できませんでした。'}), 200
        cleaned['model'] = model
        return jsonify(cleaned)
    except Exception:
        app.logger.exception('Mahjong advice request failed')
        return jsonify({'message': 'アドバイスを取得できませんでした。'}), 500

@app.route('/api/ai-models', methods=['GET'])
def list_models():
    """利用可能なGeminiモデル一覧を返す"""
    api_key = os.environ.get('GEMINI_API_KEY')
    current = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    if not api_key:
        return jsonify({'models': [], 'current': None})
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        models_resp = client.models.list()
        models = [m.name.replace('models/', '') for m in models_resp if 'gemini' in m.name.lower()]
        return jsonify({'models': sorted(models), 'current': current})
    except Exception:
        return jsonify({'models': [], 'current': current})

if __name__ == '__main__':
    app.run(debug=True, port=8080)
