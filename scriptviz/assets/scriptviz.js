/*!
 * scriptviz v0.1.0 — 영상 대본(beats) -> 진행에 맞춰 넘어가는 시각화 단일 HTML
 * Standalone. No runtime dependencies.
 * MIT License.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.SV = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

var VERSION = '0.1.0';

/* ------------------------------------------------------------------ *
 * util
 * ------------------------------------------------------------------ */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
function arr(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function r1(n) { return Math.round(n * 10) / 10; }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function tc(sec) {
  var s = Math.max(0, Math.round(sec));
  return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
}

/* ------------------------------------------------------------------ *
 * timing
 *
 * 낭독 시간은 대본 글자 수에서 나온다. 한국어 유튜브 내레이션은 대체로
 * 초당 5자 안팎(분당 300자)이고, 문장 끝마다 숨이 들어간다. 기본값은
 * 그 관측치이고, spec.cps / beat.sec 로 언제든 덮어쓸 수 있다.
 * ------------------------------------------------------------------ */

var DEFAULT_CPS = 5.0;        // 초당 글자 수 (공백 제외)
var SENTENCE_PAUSE = 0.35;    // 문장 끝 쉼
var MIN_BEAT = 2.2;           // 아무리 짧아도 이만큼은 화면에 머문다

function estimateSeconds(say, cps) {
  var t = String(say || '').replace(/\s+/g, '');
  if (!t) return 0;
  var chars = Array.from(t).length;
  var sentences = (String(say).match(/[.!?…。]|\n/g) || []).length;
  return chars / (cps || DEFAULT_CPS) + sentences * SENTENCE_PAUSE;
}

/**
 * 낭독문을 어절로 쪼개고, 각 어절이 비트 안에서 차지하는 구간을 0~1 로 매긴다.
 * 무게는 낭독 시간 추정과 같은 모형(글자 수 + 문장 끝 쉼)이라, 마지막 어절이
 * 비트 끝에 정확히 떨어진다.
 *
 * 어디까지나 추정이다 — 실제 목소리를 듣고 맞추는 것이 아니다.
 */
function splitSay(say, cps) {
  var text = String(say || '');
  if (!text.trim()) return [];
  var tokens = text.split(/(\s+)/).filter(function (x) { return x !== ''; });
  var out = [], weights = [], total = 0;
  for (var i = 0; i < tokens.length; i++) {
    var tk = tokens[i];
    if (/^\s+$/.test(tk)) { out.push({ w: tk, sp: 1 }); weights.push(0); continue; }
    var chars = Array.from(tk.replace(/\s+/g, '')).length;
    var pause = /[.!?…。,·]$/.test(tk) ? SENTENCE_PAUSE : 0;
    var wt = chars / (cps || DEFAULT_CPS) + pause;
    out.push({ w: tk });
    weights.push(wt);
    total += wt;
  }
  if (!total) return [];
  var run = 0;
  for (var j = 0; j < out.length; j++) {
    out[j].a = Math.round(run / total * 1000) / 1000;
    run += weights[j];
    out[j].b = Math.round(run / total * 1000) / 1000;
  }
  return out;
}


/* ------------------------------------------------------------------ *
 * scenes — 각 타입이 몇 개의 빌드 스텝을 갖는지, 어떤 필드가 필수인지
 * ------------------------------------------------------------------ */

var SCENES = {
  title:    { req: ['text'],            steps: function (s) { return 1 + (s.sub ? 1 : 0); } },
  hero:     { req: ['text'],            steps: function (s) { return 1 + (s.sub ? 1 : 0); } },
  stat:     { req: ['items'],           steps: function (s) { return arr(s.items).length + (s.caption ? 1 : 0); } },
  list:     { req: ['items'],           steps: function (s) { return arr(s.items).length; } },
  compare:  { req: ['columns'],         steps: function (s) { return arr(s.columns).length + (s.verdict ? 1 : 0); } },
  flow:     { req: ['steps'],           steps: function (s) { return arr(s.steps).length; } },
  timeline: { req: ['items'],           steps: function (s) { return arr(s.items).length; } },
  quote:    { req: ['text'],            steps: function (s) { return 1 + (s.by ? 1 : 0); } },
  bars:     { req: ['items'],           steps: function (s) { return (s.together ? 1 : arr(s.items).length) + (s.caption ? 1 : 0); } },
  image:    { req: ['src'],             steps: function (s) { return 1 + (s.caption ? 1 : 0); } },
  split:    { req: ['left', 'right'],   steps: function (s) { return 2; } },
  lower:    { req: ['text'],            steps: function (s) { return 1; } },
  raw:      { req: ['html'],            steps: function (s) { return num(s.steps, 1); } },

  /* 그래픽 장면 — 글자보다 그림이 먼저 읽히는 것들 */
  cards:      { req: ['items'],           steps: function (s) { return arr(s.items).length + (s.caption ? 1 : 0); } },
  donut:      { req: ['items'],           steps: function (s) { return arr(s.items).length + (s.caption ? 1 : 0); } },
  line:       { req: ['series|values'],   steps: function (s) { return (s.series ? arr(s.series).length : 1) + (s.caption ? 1 : 0); } },
  pictograph: { req: ['filled|groups|rows'], steps: function (s) {
                  var n = s.rows ? arr(s.rows).length : (s.groups ? arr(s.groups).length : 1);
                  return Math.min(4, n) + (s.caption ? 1 : 0); } },
  funnel:     { req: ['items'],           steps: function (s) { return arr(s.items).length + (s.caption ? 1 : 0); } },
  matrix:     { req: ['quadrants'],       steps: function (s) { return 4; } }
};

function sceneSteps(scene) {
  var def = SCENES[scene && scene.type];
  if (!def) return 1;
  if (Array.isArray(scene.stepAt) && scene.stepAt.length) return scene.stepAt.length;
  return Math.max(1, def.steps(scene) | 0);
}

/* ------------------------------------------------------------------ *
 * normalise — 비트 배열에 id·시간·스텝 수를 채운다
 * ------------------------------------------------------------------ */

function normalize(spec) {
  var cps = num(spec.cps, DEFAULT_CPS);
  var beats = arr(spec.beats).map(function (b, i) {
    var beat = typeof b === 'string' ? { say: b } : (b || {});
    var scene = beat.scene || { type: 'hero', text: firstSentence(beat.say) };
    var steps = sceneSteps(scene);
    var sec = num(beat.sec, null);
    if (sec == null) sec = Math.max(MIN_BEAT, estimateSeconds(beat.say, cps));
    return {
      i: i,
      id: beat.id || ('b' + (i + 1)),
      chapter: beat.chapter || null,
      say: beat.say || '',
      note: beat.note || '',
      sec: r1(sec),
      estimated: num(beat.sec, null) == null,
      at: num(beat.at, null),
      transition: beat.transition || spec.transition || 'fade',
      steps: steps,
      stepAt: normStepAt(scene, steps, sec),
      /* 자막으로 실측한 words 가 있으면 추정하지 않는다 (applySubtitles) */
      words: Array.isArray(beat.words) && beat.words.length ? beat.words : splitSay(beat.say, cps),
      fx: normFx(beat),
      scene: scene
    };
  });
  // 대본에 타임코드가 박혀 있으면 그 값이 추정치를 이긴다.
  var t = beats.length && beats[0].at != null ? beats[0].at : 0;
  beats.forEach(function (b, i) {
    b.start = r1(b.at != null ? b.at : t);
    var next = beats[i + 1];
    if (next && next.at != null && next.at > b.start) b.sec = r1(next.at - b.start);
    b.end = r1(b.start + b.sec);
    t = b.end;
  });
  return { beats: beats, total: beats.length ? beats[beats.length - 1].end : 0 };
}

/** 스텝이 비트 안에서 몇 초에 등장하는지. 기본은 앞쪽 62%에 고르게. */
function normStepAt(scene, steps, sec) {
  if (Array.isArray(scene.stepAt) && scene.stepAt.length === steps) {
    return scene.stepAt.map(function (v) { return r1(v <= 1 ? v * sec : v); });
  }
  if (steps <= 1) return [0];
  var span = sec * 0.62;
  var out = [];
  for (var i = 0; i < steps; i++) out.push(r1((span / (steps - 1)) * i * 0.92));
  return out;
}

function firstSentence(say) {
  var s = String(say || '').trim().split(/(?<=[.!?…])\s+/)[0] || '';
  return s.length > 60 ? s.slice(0, 58) + '…' : s;
}


/* ------------------------------------------------------------------ *
 * 픽토그램 이름 색인
 *
 * 그림(path)은 런타임 안에 있다. 검증에서 이름만 알면 되므로 런타임 소스에서
 * 키를 뽑아 쓴다 — 목록을 따로 관리하면 반드시 어긋난다.
 * ------------------------------------------------------------------ */
var _iconIdx = null;
function iconIndex() {
  if (_iconIdx) return _iconIdx;
  var src = SVRuntime.toString();
  var names = {}, alias = {};
  ['var ICONS = {', 'var ICONS2 = {'].forEach(function (head) {
    var i = src.indexOf(head);
    if (i < 0) return;
    var seg = src.slice(i, src.indexOf('\n  };', i));
    (seg.match(/([a-z0-9]+):\s*'M/g) || []).forEach(function (m) {
      names[m.split(':')[0].trim()] = 1;
    });
  });
  var ai = src.indexOf('var ALIAS = {');
  if (ai >= 0) {
    var aseg = src.slice(ai, src.indexOf('\n  };', ai));
    var re = /([\uAC00-\uD7A3A-Za-z0-9]+)\s*:\s*'([a-z0-9]+)'/g, m2;
    while ((m2 = re.exec(aseg))) alias[m2[1]] = m2[2];
  }
  /* 이 파싱은 런타임 소스의 생김새에 기댄다. 포맷이 바뀌어 0개가 나오면
     아이콘 191종이 통째로 "없음" 경고로 뒤집히는데 아무도 눈치채지 못한다. */
  if (!Object.keys(names).length) {
    throw new Error('scriptviz: 픽토그램 목록을 읽지 못했다 — ' +
      'SVRuntime 안의 "var ICONS = {" 블록 형식이 바뀌었는지 본다 (iconIndex)');
  }
  _iconIdx = { names: names, alias: alias };
  return _iconIdx;
}
function knownIcon(name) {
  var ix = iconIndex();
  var k = ix.alias[name] || name;
  return !!ix.names[k];
}
/** 오타났을 때 뭘 쓰라고 알려준다 */
function iconSuggest(name) {
  var ix = iconIndex(), n = String(name || '').toLowerCase();
  var pool = Object.keys(ix.names).concat(Object.keys(ix.alias));
  var hit = pool.filter(function (k) {
    var lk = k.toLowerCase();
    return lk.indexOf(n) >= 0 || (n.length > 1 && n.indexOf(lk) >= 0);
  });
  return hit.slice(0, 6);
}

/* ------------------------------------------------------------------ *
 * 강조 이펙트 (fx)
 *
 * 비트가 화면에 올라오는 순간 한 번 터지는 연출이다. 낭독 시계·장면 렌더링은
 * 건드리지 않는다 — 이펙트는 그 위에 얹히기만 한다. mo.js 는 스펙에 fx 가
 * 하나라도 있을 때만 산출물에 실린다(116KB).
 *
 * 정지컷(PNG) 캡처에서는 발사하지 않는다. 반쯤 터진 파티클이 찍히면
 * 그 컷은 못 쓴다 — 이펙트는 재생과 WebM 녹화에서만 보인다.
 * ------------------------------------------------------------------ */

var FX_KINDS = {
  burst:   { desc: '한 점에서 방사로 터진다 — 수치 확정, 결론' },
  ripple:  { desc: '링 두 겹이 퍼진다 — 여기를 보라' },
  impact:  { desc: '링 + 방사 라인 — 큰 숫자가 꽂힐 때' },
  pop:     { desc: '작은 링 + 점 — 항목 하나를 짚을 때' },
  sparkle: { desc: '별가루가 사방으로 — 좋은 소식' },
  confetti:{ desc: '위에서 색종이 — 축하, 마무리' },
  rise:    { desc: '아래에서 입자가 떠오른다 — 비트 내내 깔리는 앰비언트' },
  picto:   { desc: '픽토그램이 터진다 — icon 으로 그림을 고른다' }
};

/* 장면 타입별 '주인공' 요소. fx.at 을 안 주면 여기에 터진다. */
var FX_FOCUS = {
  title: '.big', hero: '.big', stat: '.num', quote: '.q',
  pictograph: '.pgrid', donut: '.seg', funnel: '.fst', bars: '.track',
  line: '.ser', matrix: '.qt', cards: '.ct', compare: '.vs',
  flow: '.fnode', timeline: '.tlitem', list: '.n', image: '.imgcap',
  split: '.pane', lower: '.lowerbar', raw: '.raw'
};

/** 비트의 fx 를 배열로 펴서 표준형으로 만든다 */
function normFx(beat) {
  var raw = beat && beat.fx;
  if (!raw) return [];
  return arr(raw).map(function (f) {
    if (typeof f === 'string') f = { kind: f };
    return {
      kind: f.kind || f.type || 'burst',
      at: f.at || null,
      step: num(f.step, 0),
      icon: f.icon || null,
      count: f.count, radius: f.radius, size: f.size,
      colors: f.colors ? arr(f.colors) : null,
      duration: f.duration
    };
  });
}

function specUsesFx(spec) {
  return arr(spec.beats).some(function (b) { return normFx(b).length > 0; });
}

/* ------------------------------------------------------------------ *
 * themes
 *
 * 영상용이라 값이 화면 기준으로 정해져 있다. 어두운 테마 셋에 밝은 테마
 * 하나 — 대부분의 유튜브 화면은 어두운 쪽이 눈이 덜 아프고, 자료 화면이
 * 섞이는 다큐형은 밝은 쪽이 낫다.
 * ------------------------------------------------------------------ */

var SANS = "'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
var SERIF = "'Nanum Myeongjo','Noto Serif KR',Georgia,serif";
var PRETENDARD_CDN = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css';
var MYEONGJO_CDN = 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap';

var THEMES = {
  /* 기본. 짙은 남색 위 시안 — 정보형 유튜브의 표준 톤 */
  midnight: {
    mood: 'dark', bg: '#0A1024', bg2: '#151E3F', ink: '#EEF2FF', muted: '#8E9AC0',
    accent: '#5BE1F0', accent2: '#FF6B9A', panel: 'rgba(255,255,255,.055)',
    line: 'rgba(255,255,255,.14)', font: SANS, display: SANS, imports: [PRETENDARD_CDN]
  },
  /* 다큐·역사·에세이. 종이 위 먹색, 표제는 명조 */
  paper: {
    mood: 'light', bg: '#F7F4ED', bg2: '#EFEAE0', ink: '#16181C', muted: '#6A6862',
    accent: '#B4451F', accent2: '#1D6B5F', panel: 'rgba(0,0,0,.045)',
    line: 'rgba(0,0,0,.14)', font: SANS, display: SERIF, imports: [PRETENDARD_CDN, MYEONGJO_CDN]
  },
  /* 하이에너지. 검정 위 형광 — 짧고 빠른 컷, 쇼츠 */
  neon: {
    mood: 'dark', bg: '#060607', bg2: '#101014', ink: '#FAFAFA', muted: '#8A8A93',
    accent: '#D3F81C', accent2: '#FF2E88', panel: 'rgba(255,255,255,.06)',
    line: 'rgba(255,255,255,.16)', font: SANS, display: SANS, imports: [PRETENDARD_CDN]
  },
  /* 따뜻한 어둠. 인터뷰·회고·브랜드 */
  warm: {
    mood: 'dark', bg: '#1C1512', bg2: '#2E1F17', ink: '#FFF3E6', muted: '#C2A894',
    accent: '#FF9B3D', accent2: '#78D9C3', panel: 'rgba(255,255,255,.06)',
    line: 'rgba(255,255,255,.15)', font: SANS, display: SANS, imports: [PRETENDARD_CDN]
  }
};

function getTheme(name) { return THEMES[name] || THEMES.midnight; }

/* ------------------------------------------------------------------ *
 * art direction · composition
 *
 * theme 는 하위 호환용 색상 스킨이다. artDirection 은 색뿐 아니라 표면·밀도·
 * 기하·이미지 처리·모션·모티프까지 한 번에 고정한다. scene.type 은 정보의
 * 의미만, scene.composition 은 배치만 결정한다.
 * ------------------------------------------------------------------ */
var ART_DIRECTIONS = {
  'editorial-documentary': {
    theme: 'paper', motion: 'plain', density: 'airy', geometry: 'sharp', surface: 'open',
    imageTreatment: 'editorial', motif: 'thread', align: 'left'
  },
  'broadcast-data': {
    theme: 'midnight', motion: 'apple', density: 'balanced', geometry: 'sharp', surface: 'line',
    imageTreatment: 'contrast', motif: 'axis', align: 'left'
  },
  'kinetic-brutalist': {
    theme: 'neon', motion: 'plain', density: 'bold', geometry: 'square', surface: 'open',
    imageTreatment: 'duotone', motif: 'block', align: 'left'
  },
  'cinematic-minimal': {
    theme: 'warm', motion: 'apple', density: 'airy', geometry: 'soft', surface: 'open',
    imageTreatment: 'cinematic', motif: 'orb', align: 'left'
  },
  'soft-explainer': {
    theme: 'paper', motion: 'apple', density: 'balanced', geometry: 'round', surface: 'soft',
    imageTreatment: 'natural', motif: 'dots', align: 'left'
  },
  'tech-interface': {
    theme: 'midnight', motion: 'plain', density: 'dense', geometry: 'sharp', surface: 'line',
    imageTreatment: 'contrast', motif: 'gridline', align: 'left'
  }
};

var COMPOSITIONS = {
  title: ['standard', 'edge-crop', 'split-line'],
  hero: ['standard', 'offset', 'edge-crop', 'center'],
  stat: ['standard', 'center-monument', 'offset-monument', 'edge-crop', 'split-context'],
  list: ['standard', 'rail', 'staggered'],
  compare: ['standard', 'axis', 'stacked'],
  flow: ['standard', 'stepped', 'vertical'], timeline: ['standard', 'editorial'],
  quote: ['standard', 'margin-note', 'center'], bars: ['standard', 'poster'],
  image: ['standard', 'full-bleed', 'editorial-frame'],
  split: ['standard', 'visual-first', 'overlap'], lower: ['standard'], raw: ['standard'],
  cards: ['standard', 'open', 'rail', 'masonry'], donut: ['standard', 'monument'],
  line: ['standard', 'poster'], pictograph: ['standard', 'field'],
  funnel: ['standard', 'editorial'], matrix: ['standard', 'open']
};

function artDirection(spec, opts) {
  var name = (opts && opts.artDirection) || spec.artDirection;
  return { name: name || null, pack: ART_DIRECTIONS[name] || null };
}
function compositionAllowed(type, name) {
  return !name || (COMPOSITIONS[type] || ['standard']).indexOf(name) >= 0;
}


function direct(spec, opts) {
  opts = opts || {};
  var out = JSON.parse(JSON.stringify(spec || {}));
  var beats = arr(out.beats);
  var name = opts.artDirection || out.artDirection;
  if (!name) {
    if (out.aspect === '9:16') name = 'kinetic-brutalist';
    else if (beats.some(function (b) { return b && b.scene && b.scene.type === 'image'; })) name = 'editorial-documentary';
    else name = 'broadcast-data';
  }
  var pack = ART_DIRECTIONS[name] || ART_DIRECTIONS['broadcast-data'];
  out.artDirection = name;
  if (!out.theme || opts.keepTheme !== true) out.theme = pack.theme;
  if (!out.motion || opts.keepMotion !== true) out.motion = pack.motion;
  if (!out.motif) out.motif = { type: pack.motif, intensity: 0.28 };
  var report = { artDirection: name, compositions: [], arc: [] };
  beats.forEach(function (b, i) {
    if (!b || typeof b === 'string' || !b.scene) return;
    var sc = b.scene, choices = COMPOSITIONS[sc.type] || ['standard'];
    if (!sc.composition) sc.composition = choices[(i % Math.max(1, choices.length - 1)) + (choices.length > 1 ? 1 : 0)];
    if ((sc.type === 'image' || (sc.type === 'split' && sc.right && sc.right.src)) && !sc.imageTreatment)
      sc.imageTreatment = pack.imageTreatment;
    var p = beats.length <= 1 ? 1 : i / (beats.length - 1);
    sc.arc = sc.arc || (p < .2 ? 'setup' : p < .48 ? 'tension' : p < .72 ? 'evidence' : p < .9 ? 'turn' : 'resolution');
    if (!sc.motif) sc.motif = { state: sc.arc };
    report.compositions.push({ beat: i + 1, type: sc.type, composition: sc.composition });
    report.arc.push(sc.arc);
  });
  out.beats = beats;
  return { spec: out, report: report };
}

/* ------------------------------------------------------------------ *
 * validate
 * ------------------------------------------------------------------ */

var LIMITS = {
  '16:9': { title: 30, hero: 40, listItem: 34, statItems: 3, listItems: 6, cols: 3, flow: 5, tl: 6, bars: 7,
            quote: 120, cards: 4, donut: 5, series: 3, points: 12, pic: 120, funnel: 5, cardText: 18 },
  '9:16': { title: 18, hero: 26, listItem: 22, statItems: 2, listItems: 5, cols: 2, flow: 4, tl: 5, bars: 6,
            quote: 80, cards: 2, donut: 4, series: 2, points: 8, pic: 60, funnel: 4, cardText: 12 }
};

function validate(spec) {
  var errors = [], warnings = [];
  if (typeof spec !== 'object' || spec == null) return { ok: false, errors: ['spec must be an object'], warnings: [] };
  var beats = arr(spec.beats);
  if (!beats.length) errors.push('spec.beats 가 비어 있다');
  if (spec.theme && !THEMES[spec.theme]) warnings.push('모르는 theme "' + spec.theme + '" — midnight 로 대체된다');
  if (spec.artDirection && !ART_DIRECTIONS[spec.artDirection])
    errors.push('artDirection "' + spec.artDirection + '" 없음 — ' + Object.keys(ART_DIRECTIONS).join(' · '));
  if (spec.motif && typeof spec.motif !== 'object') errors.push('motif 는 객체다 — { type, intensity }');

  var aspect = spec.aspect === '9:16' ? '9:16' : '16:9';
  if (spec.aspect && ['16:9', '9:16'].indexOf(spec.aspect) < 0) warnings.push('aspect 는 16:9 또는 9:16');
  var L = LIMITS[aspect];

  if (spec.audio && !audioSpec(spec)) errors.push('audio 에 src 가 없다 — "audio": "voice.mp3" 처럼 준다');

  if (spec.motion && !MOTIONS[spec.motion])
    errors.push('motion "' + spec.motion + '" 없음 — ' + Object.keys(MOTIONS).join(' · '));

  var cap = spec.caption;
  if (cap != null) {
    if (typeof cap !== 'object') errors.push('caption 은 객체다 — { size, color, bg, opacity }');
    else {
      if (cap.size != null && (num(cap.size, 0) < 12 || num(cap.size, 0) > 120))
        errors.push('caption.size 는 12~120px');
      if (cap.opacity != null && (num(cap.opacity, -1) < 0 || num(cap.opacity, -1) > 1))
        errors.push('caption.opacity 는 0~1');
      ['color', 'bg'].forEach(function (k) {
        if (cap[k] != null && typeof cap[k] !== 'string') errors.push('caption.' + k + ' 은 CSS 색 문자열');
      });
      if (!arr(spec.captions).length && !spec.audio)
        warnings.push('caption 스타일을 줬는데 자막이 없다 — --subs 로 자막을 넣어야 화면에 나온다');
    }
  }

  var run = { type: null, n: 0 }, raws = 0, noSay = 0;
  beats.forEach(function (b0, i) {
    var b = typeof b0 === 'string' ? { say: b0 } : (b0 || {});
    var where = '#' + (i + 1) + (b.id ? ' (' + b.id + ')' : '');
    /* split 오른쪽에 손으로 짠 SVG — 크기·선굵기를 스킬이 보증할 수 없는 자리다 */
    if (b.scene && b.scene.type === 'split') {
      var rr = b.scene.right || {};
      if (rr.svg) {
        var vb = /viewBox\s*=\s*["']([^"']+)["']/.exec(rr.svg);
        if (!vb) {
          warnings.push(where + ': right.svg 에 viewBox 가 없다 — 크기가 제멋대로 커진다');
        } else {
          var nums = vb[1].trim().split(/[\s,]+/).map(Number);
          var big = Math.max(nums[2] || 0, nums[3] || 0);
          if (big > 0 && big <= 64) {
            warnings.push(where + ': right.svg 의 viewBox 가 ' + nums[2] + 'x' + nums[3] +
              ' — 아이콘 크기다. 이걸 패널만큼 키우면 선이 수십 px 로 뭉개진다. ' +
              'right.flow(아이콘+글자 도해) 나 right.picto 를 쓰거나, viewBox 를 실제 도해 크기로 잡고 stroke-width 를 2~3 으로 둔다');
          }
        }
        if (!/stroke-width/.test(rr.svg) && /stroke\s*=/.test(rr.svg))
          warnings.push(where + ': right.svg 에 stroke-width 가 없다 — 기본 1 로 나와 흐릿하다');
      }
      if (rr.html) {
        warnings.push(where + ': right.html 은 스킬이 크기·글꼴·색을 보증하지 못한다 — ' +
          'right.flow · right.picto · right.stat · right.items · right.quote 로 되는 일인지 먼저 본다');
        if (/<script|onclick=|onerror=/i.test(rr.html))
          errors.push(where + ': right.html 에 스크립트가 있다 — 화면 장면에 넣을 것이 아니다');
        if (/style\s*=\s*["'][^"']*font-size/i.test(rr.html))
          warnings.push(where + ': right.html 이 font-size 를 직접 정한다 — ' +
            '화면비(16:9·9:16)가 바뀌면 어긋난다. var(--fs-h3) 같은 변수를 쓴다');
      }
      var picked = ['flow', 'picto', 'icon', 'stat', 'items', 'quote', 'svg', 'html', 'src']
        .filter(function (k) { return rr[k] != null; });
      if (picked.length > 1)
        warnings.push(where + ': right 에 ' + picked.join(' · ') + ' 가 함께 있다 — ' +
          '앞선 하나만 그려진다 (src > flow > picto > stat > items > quote > svg > html)');
      arr(rr.flow).forEach(function (it) {
        if (it && typeof it === 'object' && it.icon && !knownIcon(it.icon))
          warnings.push(where + ': right.flow 의 픽토그램 "' + it.icon + '" 없음' + sugg(it.icon));
      });
      if (rr.picto && !knownIcon(rr.picto))
        warnings.push(where + ': right.picto "' + rr.picto + '" 없음' + sugg(rr.picto));
      if (arr(rr.flow).length > 3)
        warnings.push(where + ': right.flow 가 ' + arr(rr.flow).length + '단계 — 3단계까지가 읽힌다');
    }

    /* 아이콘 이름이 틀리면 화면에 그림 대신 이름이 찍힌다 — 미리 잡는다 */
    (function () {
      var seen = [];
      function chk(v) {
        if (!v || typeof v !== 'string' || seen.indexOf(v) >= 0) return;
        seen.push(v);
        if (knownIcon(v)) return;
        var hint = iconSuggest(v);
        warnings.push(where + ': 픽토그램 "' + v + '" 없음 — 그림 없이 넘어간다' +
          (hint.length ? ' (혹시 ' + hint.join(' · ') + '?)' : ' · node assets/sv.js icons 로 찾는다'));
      }
      var sc0 = b.scene || {};
      chk(sc0.icon);
      arr(sc0.items).forEach(function (it) { if (it && typeof it === 'object') chk(it.icon); });
      arr(sc0.steps).forEach(function (it) { if (it && typeof it === 'object') chk(it.icon); });
      arr(sc0.cards).forEach(function (it) { if (it && typeof it === 'object') chk(it.icon); });
      normFx(b).forEach(function (f) { if (f.kind === 'picto') chk(f.icon); });
    })();
    normFx(b).forEach(function (f) {
      if (!FX_KINDS[f.kind])
        errors.push(where + ': 모르는 fx "' + f.kind + '" — ' + Object.keys(FX_KINDS).join(' · '));
      if (f.kind === 'picto' && !f.icon)
        errors.push(where + ': fx picto 는 icon 이 있어야 한다 (예: "icon": "하트")');
      if (f.step != null && b.scene && f.step >= sceneSteps(b.scene))
        warnings.push(where + ': fx.step ' + f.step + ' 이 스텝 수를 넘는다 — 안 터진다');
    });
    var sc = b.scene;
    if (!sc && !b.say) { errors.push(where + ': scene 도 say 도 없다'); return; }
    if (sc) {
      if (!SCENES[sc.type]) { errors.push(where + ': 모르는 scene.type "' + sc.type + '" — ' + Object.keys(SCENES).join(' · ')); return; }
      SCENES[sc.type].req.forEach(function (f) {
        var ok = f.split('|').some(function (k) {
          var v = sc[k];
          return !(v == null || (Array.isArray(v) && !v.length));
        });
        if (!ok) errors.push(where + ': ' + sc.type + ' 에 ' + f.split('|').join(' 또는 ') + ' 가 필요하다');
      });
      if (!compositionAllowed(sc.type, sc.composition))
        errors.push(where + ': ' + sc.type + '.composition "' + sc.composition + '" 없음 — ' +
          (COMPOSITIONS[sc.type] || ['standard']).join(' · '));
      if (sc.imageTreatment && ['natural', 'editorial', 'contrast', 'duotone', 'cinematic'].indexOf(sc.imageTreatment) < 0)
        errors.push(where + ': imageTreatment "' + sc.imageTreatment + '" 없음');
      if (sc.arc && ['setup', 'tension', 'evidence', 'turn', 'resolution'].indexOf(sc.arc) < 0)
        errors.push(where + ': arc "' + sc.arc + '" 없음');
      arr(sc.wordEvents).forEach(function (ev) {
        if (!ev || (!ev.word && ev.at == null)) errors.push(where + ': wordEvents 는 word 또는 at 이 필요하다');
        if (ev && !ev.target) errors.push(where + ': wordEvents.target 이 필요하다 (data-role 또는 share 이름)');
      });
      if (sc.type === 'raw') raws++;
      if (run.type === sc.type) run.n++; else { run.type = sc.type; run.n = 1; }
      if (run.n === 3) warnings.push(where + ': 같은 장면 타입(' + sc.type + ')이 3연속 — 가운데 비트를 다른 장면으로');
      lenWarn(sc, where, L, warnings);
    }
    if (!b.say && b.sec == null) { noSay++; warnings.push(where + ': say 도 sec 도 없어 낭독 시간을 추정할 수 없다 (' + MIN_BEAT + '초로 잡힌다)'); }
    if (b.sec != null && b.sec > 25) warnings.push(where + ': 한 장면이 ' + b.sec + '초 — 25초가 넘으면 화면이 죽는다. 비트를 쪼갠다');
  });
  /* --- 문서(direction.md)에 적어둔 규칙을 기계로도 잡는다 --------------
   * 사람이 워크플로를 건너뛰어도 품질이 새어나가지 않게 하려는 것이다.
   * ------------------------------------------------------------------- */
  var nz = normalize(spec);
  (function () {
    var nb = nz.beats;
    /* 1) 글자만 있는 장면이 3연속 — 아이콘이 하나라도 있으면 그림이 있는 셈 */
    var TEXTONLY = { title: 1, hero: 1, quote: 1, list: 1, raw: 1 };
    var run = 0, from = 0;
    nb.forEach(function (b, i) {
      var sc = b.scene || {};
      var hasPic = !!sc.icon || arr(sc.items).some(function (it) { return it && it.icon; });
      var bare = TEXTONLY[sc.type] && !hasPic;
      if (bare) { if (run === 0) from = i; run++; }
      if (!bare || i === nb.length - 1) {
        if (run >= 3) {
          warnings.push('#' + (from + 1) + '~#' + (from + run) +
            ': 글자만 있는 장면이 ' + run + '연속 — 가운데 하나를 그림 장면으로 ' +
            '(pictograph · donut · line · bars · funnel · matrix · cards)');
        }
        run = bare ? 1 : 0;
        if (bare) from = i;
      }
    });
    /* 2) 화면에 올린 정보량에 비해 머무는 시간이 짧다 */
    nb.forEach(function (b, i) {
      var steps = b.steps || 1;
      /* 스텝은 비트 안에서 순차로 뜨니 하나당 온전한 체류가 필요하진 않다.
         빽빽해서 못 읽는 선만 잡는다 — 기존 예제로 오탐을 맞춰 정한 값이다. */
      var need = 0.8 + steps * 0.45;
      if (steps >= 4 && b.sec < need) {
        warnings.push('#' + (i + 1) + ': ' + b.sec + '초에 정보 ' + steps +
          '개 — 읽을 시간이 없다 (' + need.toFixed(1) + '초 이상이거나 장면을 나눈다)');
      }
    });
  })();
  /* 디자인 린터 — 예쁨을 점수화하지 않고 단조로움·불균형·연결 실패만 잡는다. */
  (function () {
    var nb = nz.beats, compRun = 0, lastComp = '', centered = 0, surfaced = 0, shares = {};
    nb.forEach(function (b, i) {
      var sc = b.scene || {}, comp = sc.composition || 'standard';
      if (comp === lastComp) compRun++; else { lastComp = comp; compRun = 1; }
      if (compRun === 3) warnings.push('#' + (i - 1) + '~#' + (i + 1) + ': 같은 composition(' + comp + ') 3연속 — 구도 리듬을 바꾼다');
      if (sc.align === 'center' || /center|monument/.test(comp)) centered++;
      if (sc.type === 'cards' || sc.type === 'compare' || sc.type === 'matrix') surfaced++;
      function take(v) { if (v) shares[v] = (shares[v] || 0) + 1; }
      if (typeof sc.share === 'string') take(sc.share);
      else if (sc.share && typeof sc.share === 'object') Object.keys(sc.share).forEach(function (k) { take(sc.share[k]); });
      arr(sc.items).concat(arr(sc.columns)).concat(arr(sc.steps)).forEach(function (it) { if (it && typeof it === 'object') take(it.share); });
      if (spec.motif && sc.motif === false && i > 0 && i < nb.length - 1)
        warnings.push('#' + (i + 1) + ': 덱 모티프가 중간에서 끊긴다 — 의도한 단절이 아니면 motif:false 를 뺀다');
    });
    if (nb.length >= 5 && centered / nb.length > .72)
      warnings.push('가운데 정렬 장면이 ' + Math.round(centered / nb.length * 100) + '% — 화면의 시각 중심이 움직이지 않는다');
    if (nb.length >= 5 && surfaced / nb.length > .45)
      warnings.push('카드형 장면이 ' + Math.round(surfaced / nb.length * 100) + '% — open 구도나 hero·image 로 표면을 덜어낸다');
    Object.keys(shares).forEach(function (k) {
      if (shares[k] === 1) warnings.push('share "' + k + '" 가 한 장면에만 있다 — 공유 전환은 같은 이름이 다음 장면에도 있어야 한다');
    });
    if (spec.artDirection && !nb.some(function (b) { return b.scene && b.scene.arc; }))
      warnings.push('artDirection 은 있지만 arc 가 없다 — SV.direct()로 setup→resolution 변화를 배정한다');
  })();

  if (errors.length) return { ok: false, errors: errors, warnings: warnings };

  var n = nz;
  if (raws > Math.max(2, beats.length * 0.25)) {
    warnings.push('raw 장면이 ' + raws + '개 — 장면 타입으로 옮길 수 있는지 다시 본다 (raw 는 탈출구지 기본값이 아니다)');
  }
  if (spec.targetSec) {
    var diff = (n.total - spec.targetSec) / spec.targetSec;
    if (Math.abs(diff) > 0.2) {
      warnings.push('추정 ' + tc(n.total) + ' vs 목표 ' + tc(spec.targetSec) +
        ' (' + (diff > 0 ? '+' : '') + Math.round(diff * 100) + '%) — 대본을 줄이거나 비트를 합친다');
    }
  }
  var longest = n.beats.reduce(function (a, b) { return b.sec > a.sec ? b : a; }, n.beats[0]);
  if (longest.sec > 25) warnings.push(longest.id + ': ' + longest.sec + '초 — 비트를 쪼갠다');

  /* 음성을 붙였는데 타이밍이 추정이면 화면이 목소리와 어긋난다 — 자막이 있어야 맞는다. */
  var au = audioSpec(spec);
  if (au) {
    /* 실측인가 — 자막을 태우면 at 과 어절 타임코드(words)가 박힌다. */
    var measured = beats.some(function (b0) {
      var b = typeof b0 === 'string' ? {} : (b0 || {});
      return b.at != null || (Array.isArray(b.words) && b.words.length);
    });
    if (!measured) warnings.push('음성을 붙였는데 타이밍이 전부 추정이다 — 자막(--subs)으로 실측을 박아야 화면이 목소리와 맞는다');
    if (!au.master) warnings.push('audio.master:false — 소리와 화면이 따로 흐른다. 붙이려면 master 를 켠다');
    if (au.duration != null && Math.abs((au.duration - au.offset) - n.total) > Math.max(2, n.total * 0.05)) {
      warnings.push('음성 ' + tc(au.duration - au.offset) + ' vs 화면 ' + tc(n.total) + ' — 길이가 다르다. 자막으로 타이밍을 맞춘다');
    }
    if (spec.__audioMissing) warnings.push('음성 파일을 찾지 못했다: ' + spec.__audioMissing);
  }
  return {
    ok: true, errors: errors, warnings: warnings,
    stats: { beats: n.beats.length, steps: n.beats.reduce(function (a, b) { return a + b.steps; }, 0), total: n.total, totalTc: tc(n.total) }
  };
}

function lenWarn(sc, where, L, warnings) {
  function chk(text, max, what) {
    if (!text) return;
    var len = Array.from(String(text).replace(/\*\*/g, '')).length;
    if (len > max) warnings.push(where + ': ' + what + ' ' + len + '자 (' + max + '자 이하) — "' + String(text).slice(0, 20) + '…"');
  }
  if (sc.type === 'title') { chk(sc.text, L.title, '제목'); }
  if (sc.type === 'hero') { chk(sc.text, L.hero, '한 줄 메시지'); }
  if (sc.type === 'quote') { chk(sc.text, L.quote, '인용'); }
  if (sc.type === 'stat' && arr(sc.items).length > L.statItems) warnings.push(where + ': 숫자 ' + arr(sc.items).length + '개 (' + L.statItems + '개 이하) — 하나만 크게 보여준다');
  if (sc.type === 'list') {
    if (arr(sc.items).length > L.listItems) warnings.push(where + ': 항목 ' + arr(sc.items).length + '개 (' + L.listItems + '개 이하) — 비트를 나눈다');
    arr(sc.items).forEach(function (it) { chk(typeof it === 'string' ? it : it.text, L.listItem, '항목'); });
  }
  if (sc.type === 'compare' && arr(sc.columns).length > L.cols) warnings.push(where + ': 열 ' + arr(sc.columns).length + '개 (' + L.cols + '개 이하)');
  if (sc.type === 'flow' && arr(sc.steps).length > L.flow) warnings.push(where + ': 단계 ' + arr(sc.steps).length + '개 (' + L.flow + '개 이하) — 나눈다');
  if (sc.type === 'timeline' && arr(sc.items).length > L.tl) warnings.push(where + ': 시점 ' + arr(sc.items).length + '개 (' + L.tl + '개 이하)');
  if (sc.type === 'bars' && arr(sc.items).length > L.bars) warnings.push(where + ': 막대 ' + arr(sc.items).length + '개 (' + L.bars + '개 이하)');
  if (sc.type === 'cards') {
    if (arr(sc.items).length > L.cards) warnings.push(where + ': 카드 ' + arr(sc.items).length + '개 (' + L.cards + '개 이하) — 나눈다');
    arr(sc.items).forEach(function (it) { chk(typeof it === 'string' ? it : it.text, L.cardText, '카드 제목'); });
    if (!arr(sc.items).some(function (it) { return it && it.icon; })) {
      warnings.push(where + ': cards 에 아이콘이 하나도 없다 — 아이콘이 없으면 list 가 더 낫다');
    }
  }
  if (sc.type === 'donut' && arr(sc.items).length > L.donut) warnings.push(where + ': 조각 ' + arr(sc.items).length + '개 (' + L.donut + '개 이하) — 나머지는 "기타"로 묶는다');
  if (sc.type === 'line') {
    var ser = arr(sc.series);
    if (ser.length > L.series) warnings.push(where + ': 계열 ' + ser.length + '개 (' + L.series + '개 이하)');
    ser.concat(sc.values ? [{ values: sc.values }] : []).forEach(function (x) {
      if (arr(x.values).length > L.points) warnings.push(where + ': 점 ' + arr(x.values).length + '개 (' + L.points + '개 이하) — 구간을 묶는다');
    });
  }
  if (sc.type === 'pictograph') {
    var rows = arr(sc.rows), grps = arr(sc.groups);
    if (rows.length) {
      if (rows.length > 4) warnings.push(where + ': 줄 ' + rows.length + '개 (4줄 이하) — 비교는 둘셋이 가장 잘 읽힌다');
      rows.forEach(function (r) {
        var t = r.total || sc.total || 100;
        if (t > L.pic) warnings.push(where + ': 한 줄에 아이콘 ' + t + '개 (' + L.pic + '개 이하)');
        if (r.filled > t) warnings.push(where + ': filled 가 total 보다 크다');
      });
    } else if (grps.length) {
      if (grps.length > 4) warnings.push(where + ': 그룹 ' + grps.length + '개 (4개 이하) — 색이 넷을 넘으면 못 센다');
      var sum = grps.reduce(function (a, g2) { return a + (+g2.value || 0); }, 0);
      if ((sc.total || sum) > L.pic) warnings.push(where + ': 아이콘 ' + (sc.total || sum) + '개 (' + L.pic + '개 이하)');
      if (sc.total && sum > sc.total) warnings.push(where + ': 그룹 합(' + sum + ')이 total(' + sc.total + ')보다 크다');
    } else {
      if ((sc.total || 100) > L.pic) warnings.push(where + ': 아이콘 ' + (sc.total || 100) + '개 (' + L.pic + '개 이하) — 100개면 100%가 바로 읽힌다');
      if (sc.filled > (sc.total || 100)) warnings.push(where + ': filled 가 total 보다 크다');
    }
    if (sc.chunk && (sc.chunk < 2 || sc.chunk > 25)) warnings.push(where + ': chunk 는 5~10 사이가 세기 좋다');
  }
  if (sc.type === 'funnel' && arr(sc.items).length > L.funnel) warnings.push(where + ': 단계 ' + arr(sc.items).length + '개 (' + L.funnel + '개 이하)');
  if (sc.type === 'matrix' && arr(sc.quadrants).length !== 4) warnings.push(where + ': matrix 는 사분면 4개를 다 줘야 한다 (좌상 → 우상 → 좌하 → 우하)');
}


/* ------------------------------------------------------------------ *
 * 타이밍 시트
 * ------------------------------------------------------------------ */

function toTimingCSV(spec) {
  var n = normalize(spec);
  var rows = ['beat,id,start,end,sec,scene,say'];
  n.beats.forEach(function (b, i) {
    rows.push([i + 1, b.id, tc(b.start), tc(b.end), b.sec, (b.scene && b.scene.type) || '',
      '"' + String(b.say || '').replace(/"/g, '""').replace(/\n/g, ' ') + '"'].join(','));
  });
  rows.push(',,,,' + n.total + ',총 ' + tc(n.total) + ',');
  return rows.join('\n') + '\n';
}


/* ------------------------------------------------------------------ *
 * 대본 -> 초안 스펙
 *
 * 여기서 나오는 것은 **초안**이다. 문단을 비트로 끊고 낭독 시간을 계산해
 * 뼈대를 만들어줄 뿐, 어떤 장면이 맞는지는 내용을 읽은 쪽이 정한다.
 * 자동으로 고른 타입은 출발점이지 결론이 아니다.
 *
 *   # 제목                     spec.title
 *   ## 챕터 이름               다음 비트부터 이 챕터
 *   [01:24] 낭독문…            절대 타임코드 (있으면 추정치보다 우선)
 *   @stat 낭독문…              장면 타입 지정
 *   ((카메라 줌))              연출 메모 (화면에 안 나온다)
 *   ---                        비트 강제 분리
 * ------------------------------------------------------------------ */

function guessType(text) {
  var t = String(text || '');
  if (/^["“'']/.test(t.trim()) || /["”]\s*(라고|라며|고 말)/.test(t)) return 'quote';
  if (/\d+\s*(%|퍼센트|배|억|만|천|명|원|건|위)/.test(t) && t.length < 160) return 'stat';
  if (/(첫째|둘째|셋째|세 가지|네 가지|이유는|조건은)/.test(t)) return 'list';
  if (/(반면|반대로|대신에|와 달리|vs\.?|차이는)/.test(t)) return 'compare';
  if (/(→|그다음|그러고 나서|먼저.*그리고|단계)/.test(t)) return 'flow';
  if ((t.match(/(19|20)\d\d년/g) || []).length >= 2) return 'timeline';
  return 'hero';
}

function draftScene(type, text) {
  var head = firstSentence(text);
  switch (type) {
    case 'stat': {
      var m = String(text).match(/([\d.,]+)\s*(%|퍼센트|배|억|만|천|명|원|건|위)/);
      return { type: 'stat', items: [{ value: m ? m[1] : '00', unit: m ? m[2] : '', label: head }] };
    }
    case 'list': {
      var parts = String(text).split(/[,·]|첫째|둘째|셋째/).map(function (x) { return x.trim(); })
        .filter(function (x) { return x.length > 1; }).slice(0, 4);
      return { type: 'list', items: parts.length > 1 ? parts : [head] };
    }
    case 'compare':
      return { type: 'compare', columns: [{ title: 'A', items: [head] }, { title: 'B', items: [''] }] };
    case 'flow':
      return { type: 'flow', steps: [{ text: head }, { text: '' }, { text: '' }] };
    case 'timeline': {
      var years = String(text).match(/(19|20)\d\d년/g) || [];
      return { type: 'timeline', items: years.slice(0, 4).map(function (y) { return { when: y, text: '' }; }) };
    }
    case 'quote':
      return { type: 'quote', text: head.replace(/^["“'']|["”'']$/g, '') };
    default:
      return { type: 'hero', text: head };
  }
}

function fromScript(text, opts) {
  opts = opts || {};
  var src = String(text || '').replace(/\r\n?/g, '\n');
  var spec = { beats: [] };
  var fm = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    fm[1].split('\n').forEach(function (line) {
      var m = line.match(/^\s*([A-Za-z_]+)\s*:\s*(.+?)\s*$/);
      if (!m) return;
      var v = m[2].replace(/^["']|["']$/g, '');
      if (v === 'true') v = true; else if (v === 'false') v = false;
      else if (/^-?\d+(\.\d+)?$/.test(v)) v = parseFloat(v);
      spec[m[1]] = v;
    });
    src = src.slice(fm[0].length);
  }

  var blocks = src.split(/\n\s*\n|\n---+\n/);
  var chapter = null;
  blocks.forEach(function (raw) {
    var block = raw.trim();
    if (!block) return;
    var lines = block.split('\n');
    var notes = [];
    var kept = [];
    var forced = null, at = null, img = null;

    lines.forEach(function (line) {
      var l = line.trim();
      if (!l) return;
      var h1 = l.match(/^#\s+(.*)$/);
      if (h1) { if (!spec.title) spec.title = h1[1].trim(); return; }
      var h2 = l.match(/^#{2,6}\s+(.*)$/);
      if (h2) { chapter = h2[1].trim(); return; }
      l = l.replace(/\(\(([^)]*)\)\)/g, function (_, n) { notes.push(n.trim()); return ''; }).trim();
      if (!l) return;
      /* ![캡션](경로) — 대본 안에서 "여기에 이 사진"을 표시하는 자리.
         캡션은 alt 자리에 쓴다. 낭독문과 같은 줄에 있어도 뽑아낸다. */
      l = l.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (_, cap, path) {
        img = { src: path.trim(), caption: cap.trim() };
        return '';
      }).trim();
      if (!l) return;
      if (/^>\s*/.test(l)) { notes.push(l.replace(/^>\s*/, '')); return; }
      var tcm = l.match(/^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*/);
      if (tcm) {
        at = tcm[3] ? (+tcm[1] * 3600 + +tcm[2] * 60 + +tcm[3]) : (+tcm[1] * 60 + +tcm[2]);
        l = l.slice(tcm[0].length).trim();
        if (!l) return;
      }
      var tm = l.match(/^@([a-z]+)\s*/);
      if (tm && SCENES[tm[1]]) { forced = tm[1]; l = l.slice(tm[0].length).trim(); if (!l) return; }
      kept.push(l);
    });

    var say = kept.join('\n').trim();
    if (!say && !img) {
      // 연출 메모만 있는 문단은 새 비트가 아니라 앞 비트에 붙는 메모다.
      if (notes.length && spec.beats.length) {
        var prev = spec.beats[spec.beats.length - 1];
        prev.note = prev.note ? prev.note + ' / ' + notes.join(' / ') : notes.join(' / ');
      }
      return;
    }
    var type, scene;
    if (img) {
      /* @split 과 함께면 왼쪽은 말, 오른쪽은 사진. 아니면 화면 전체 사진. */
      if (forced === 'split') {
        type = 'split';
        var head = say.split(/[.!?]\s|\n/)[0].trim();
        scene = { type: 'split',
          left: { title: head.slice(0, 30), items: [] },
          right: { src: img.src } };
      } else {
        type = 'image';
        scene = { type: 'image', src: img.src };
        if (img.caption) scene.caption = img.caption;
      }
    } else {
      type = forced || guessType(say);
      scene = draftScene(type, say);
    }
    var beat = { say: say, scene: scene };
    if (chapter) { beat.chapter = chapter; chapter = null; }
    if (notes.length) beat.note = notes.join(' / ');
    if (at != null) beat.at = at;
    spec.beats.push(beat);
  });

  if (!spec.beats.length) throw new Error('scriptviz: 대본에서 비트를 찾지 못했다 (빈 줄로 문단을 나눈다)');
  if (spec.title) {
    spec.beats.unshift({ say: '', sec: 3, scene: { type: 'title', text: spec.title, sub: spec.subtitle || '' } });
  }
  return spec;
}

/* ------------------------------------------------------------------ *
 * subtitles — 자막 파일로 타이밍을 실측으로 갈아끼운다
 *
 * 글자 수 추정은 대본만 있을 때의 방편이다. 녹음이 끝나고 자막(SRT·VTT)이
 * 나오면 진짜 시각을 알 수 있다. 자막 한 장은 2~4초라 비트(8~15초)보다
 * 작으므로, 자막을 비트에 나눠 붙이고 그 안에서 어절 위치를 실측으로 깐다.
 *
 * 그러면 프롬프터의 노래방 표시가 추정이 아니라 목소리에 맞는다. 재생·프롬프터
 * 코드는 그대로다 — words 의 a/b(비트 안 0~1 위치)를 실측으로 채우기만 한다.
 * ------------------------------------------------------------------ */

/** 자막 텍스트를 비교용으로 눌러놓는다. 표기 차이를 지우고 글자만 남긴다. */
function subKey(s) {
  return String(s || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function parseTimecode(s) {
  var m = String(s).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
  if (!m) return null;
  var ms = m[4].length === 1 ? +m[4] * 100 : (m[4].length === 2 ? +m[4] * 10 : +m[4]);
  return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + ms / 1000;
}

/**
 * SRT · VTT → [{ start, end, text }]
 *
 * 두 형식의 차이는 밀리초 구분자(,/.)와 헤더뿐이라 한 파서로 받는다. 순번 줄,
 * VTT 의 cue 설정(align·position), NOTE 블록은 버린다.
 */
function parseSubtitles(text) {
  var src = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  var cues = [];
  src.split(/\n{2,}/).forEach(function (block) {
    var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return;
    if (/^WEBVTT/i.test(lines[0])) lines.shift();
    if (/^(NOTE|STYLE|REGION)\b/i.test(lines[0] || '')) return;
    var ti = -1, tm = null;
    for (var i = 0; i < lines.length; i++) {
      tm = lines[i].match(/^(\S+)\s*-->\s*(\S+)/);
      if (tm) { ti = i; break; }
    }
    if (ti < 0) return;
    var start = parseTimecode(tm[1]), end = parseTimecode(tm[2]);
    if (start == null || end == null) return;
    var body = lines.slice(ti + 1).join(' ')
      .replace(/<[^>]*>/g, '')                       // <i> · <c.colorE5E5E5> 같은 태그
      .replace(/\{\\[^}]*\}/g, '')                   // ASS 잔재
      .replace(/\s+/g, ' ').trim();
    if (!body) return;
    cues.push({ start: start, end: Math.max(end, start), text: body });
  });
  cues.sort(function (a, b) { return a.start - b.start; });
  return cues;
}

/**
 * 자막을 비트로 묶는다. 자막만 갖고 초안을 만들 때 쓴다.
 *
 * 끊는 자리를 고르는 순서가 있다. 자막 사이의 큰 쉼(문단 경계)이 가장 세고,
 * 그다음이 문장 끝, 마지막이 목표 길이다. 목표만 보고 자르면 문장 중간에서
 * 화면이 넘어간다.
 */
function groupCues(cues, opts) {
  opts = opts || {};
  var target = num(opts.target, 11);          // 비트 목표 길이(초)
  var maxSec = num(opts.max, 22);             // 이 이상은 무조건 끊는다
  var gapBreak = num(opts.gap, 0.9);          // 이만큼 쉬면 문단이 갈린 것으로 본다
  var out = [], cur = [];

  function flush() {
    if (!cur.length) return;
    out.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map(function (c) { return c.text; }).join(' '),
      cues: cur.slice()
    });
    cur = [];
  }

  for (var i = 0; i < cues.length; i++) {
    cur.push(cues[i]);
    var next = cues[i + 1];
    if (!next) break;
    var span = next.end - cur[0].start;
    var gap = next.start - cues[i].end;
    var ended = /[.!?…。]$/.test(cues[i].text);
    var elapsed = cues[i].end - cur[0].start;

    if (gap >= gapBreak && elapsed >= target * 0.45) { flush(); continue; }
    if (ended && elapsed >= target) { flush(); continue; }
    if (span > maxSec) { flush(); continue; }
  }
  flush();
  return out;
}

/**
 * 비트의 낭독문에 자막 시각을 입힌다.
 *
 * 낭독문과 자막은 같은 대본에서 나왔으므로 글자가 거의 같다. 자막 한 장의
 * 글자를 낭독문에서 앞으로 찾아가며 소비해, 그 자막이 덮는 어절 범위를 잡는다.
 * 범위의 양 끝을 자막 실측 시각으로 못 박고 사이는 글자 수로 나눈다.
 *
 * 돌려주는 것: { words, start, end, matched } — words 의 a/b 는 비트 안 0~1.
 * matched 는 자막으로 시각을 잡은 어절의 비율이다.
 */
function alignSayToCues(say, cues, cps) {
  var text = String(say || '');
  if (!text.trim() || !cues || !cues.length) return null;

  // 낭독문을 어절로 쪼개고(공백도 토큰으로 남긴다) 각 어절의 정규화 글자를 센다.
  var tokens = text.split(/(\s+)/).filter(function (x) { return x !== ''; });
  var words = [], stream = '', owner = [];
  for (var i = 0; i < tokens.length; i++) {
    if (/^\s+$/.test(tokens[i])) { words.push({ w: tokens[i], sp: 1 }); continue; }
    var wi = words.length;
    words.push({ w: tokens[i] });
    var k = subKey(tokens[i]);
    for (var c = 0; c < k.length; c++) { stream += k[c]; owner.push(wi); }
  }
  if (!stream) return null;

  // 자막을 순서대로 낭독문 위에서 소비한다. 앞으로만 간다 — 되돌아가면 시각이 뒤집힌다.
  var pos = 0, anchors = [];
  for (var q = 0; q < cues.length; q++) {
    var key = subKey(cues[q].text);
    if (!key) continue;
    var at = stream.indexOf(key, pos);
    if (at < 0) {
      // 자막과 대본이 조금 다른 경우. 앞부분만이라도 걸리는지 본다.
      var head = key.slice(0, Math.max(4, Math.floor(key.length * 0.5)));
      at = head.length >= 3 ? stream.indexOf(head, pos) : -1;
      if (at < 0) continue;
      anchors.push({ from: at, to: at + head.length, cue: cues[q] });
      pos = at + head.length;
      continue;
    }
    anchors.push({ from: at, to: at + key.length, cue: cues[q] });
    pos = at + key.length;
  }
  if (!anchors.length) return null;

  var start = anchors[0].cue.start;
  var end = anchors[anchors.length - 1].cue.end;
  var span = end - start;
  if (!(span > 0)) return null;

  // 문자마다 절대 시각을 깐다. 자막이 덮은 구간은 그 자막 안에서 글자 수 비례,
  // 자막이 비운 구간(대본에만 있는 말)은 앞뒤 자막 사이를 선형으로 잇는다.
  var n = stream.length;
  var tAt = new Array(n + 1);
  for (var a = 0; a < anchors.length; a++) {
    var an = anchors[a], len = an.to - an.from;
    var cs = an.cue.start, ce = an.cue.end;
    for (var j = 0; j <= len; j++) tAt[an.from + j] = cs + (ce - cs) * (j / len);
  }
  if (tAt[0] == null) tAt[0] = start;
  if (tAt[n] == null) tAt[n] = end;
  var known = [];
  for (var p = 0; p <= n; p++) if (tAt[p] != null) known.push(p);
  for (var g = 0; g < known.length - 1; g++) {
    var lo = known[g], hi = known[g + 1];
    if (hi - lo < 2) continue;
    for (var s = lo + 1; s < hi; s++) {
      tAt[s] = tAt[lo] + (tAt[hi] - tAt[lo]) * ((s - lo) / (hi - lo));
    }
  }
  for (var m2 = 1; m2 <= n; m2++) if (tAt[m2] < tAt[m2 - 1]) tAt[m2] = tAt[m2 - 1];

  // 어절 경계를 0~1 로 환산한다. 프롬프터가 그대로 먹는 형식이다.
  var bounds = [];
  for (var w2 = 0; w2 < words.length; w2++) bounds.push(null);
  var seen = {};
  for (var ci = 0; ci < n; ci++) {
    var ow = owner[ci];
    if (seen[ow] == null) { seen[ow] = { a: ci, b: ci + 1 }; }
    else { seen[ow].b = ci + 1; }
  }
  var anchoredChars = 0;
  anchors.forEach(function (an) { anchoredChars += an.to - an.from; });
  for (var wi2 = 0; wi2 < words.length; wi2++) {
    if (words[wi2].sp) continue;
    var rng = seen[wi2];
    if (!rng) { words[wi2].a = 0; words[wi2].b = 0; continue; }
    words[wi2].a = Math.round((tAt[rng.a] - start) / span * 1000) / 1000;
    words[wi2].b = Math.round((tAt[rng.b] - start) / span * 1000) / 1000;
  }
  return {
    words: words,
    start: Math.round(start * 100) / 100,
    end: Math.round(end * 100) / 100,
    matched: Math.round(anchoredChars / n * 1000) / 1000
  };
}

/**
 * 이미 만든 덱에 자막 타이밍을 입힌다. 대본으로 화면을 짜고, 녹음이 끝난 뒤
 * 이 함수로 시각을 확정하는 것이 제 순서다.
 *
 * 비트의 say 를 자막 위에서 순서대로 찾아 at·sec·words 를 실측으로 바꾼다.
 * 못 찾은 비트는 추정을 그대로 두고 report 에 남긴다 — 조용히 틀린 시각을
 * 넣는 것보다 어디가 안 맞는지 말해주는 편이 낫다.
 */
function applySubtitles(spec, subtitles, opts) {
  opts = opts || {};
  var cues = typeof subtitles === 'string' ? parseSubtitles(subtitles) : (subtitles || []);
  if (!cues.length) throw new Error('scriptviz: 자막에서 cue 를 찾지 못했다 (SRT · VTT 형식인지 확인한다)');

  var out = JSON.parse(JSON.stringify(spec || {}));
  var beats = arr(out.beats).map(function (b) { return typeof b === 'string' ? { say: b } : (b || {}); });
  var floor = num(opts.minMatch, 0.5);
  var report = { applied: [], skipped: [], cueCount: cues.length, duration: cues[cues.length - 1].end };

  // 자막을 앞에서부터 소비한다. 비트 순서와 자막 순서는 같다는 전제다.
  var cursor = 0;
  beats.forEach(function (beat, bi) {
    var label = beat.id || ('b' + (bi + 1));
    if (!String(beat.say || '').trim()) {
      report.skipped.push({ beat: label, why: '낭독문이 없다 (타이틀 비트 등)' });
      return;
    }
    var key = subKey(beat.say);
    if (!key) { report.skipped.push({ beat: label, why: '비교할 글자가 없다' }); return; }

    // 이 비트의 낭독문을 덮는 자막 구간을 찾는다. 남은 자막을 이어 만든 스트림에서
    // 낭독문 글자를 앞으로 소비해, 마지막 글자가 걸린 자막까지가 이 비트다.
    var take = [], acc = '', hit = 0;
    for (var i = cursor; i < cues.length; i++) {
      take.push(cues[i]);
      acc += subKey(cues[i].text);
      hit = commonPrefixish(key, acc);
      if (hit >= key.length * 0.92) break;
      if (acc.length > key.length * 1.6) break;
    }
    if (!take.length) { report.skipped.push({ beat: label, why: '남은 자막이 없다' }); return; }

    var res = alignSayToCues(beat.say, take, num(out.cps, DEFAULT_CPS));
    if (!res || res.matched < floor) {
      report.skipped.push({
        beat: label,
        why: '자막과 낭독문이 맞지 않는다 (일치 ' +
             Math.round((res ? res.matched : 0) * 100) + '%)'
      });
      return;
    }
    beat.at = res.start;
    beat.sec = Math.round((res.end - res.start) * 100) / 100;
    beat.words = res.words;
    report.applied.push({ beat: label, at: beat.at, sec: beat.sec, matched: res.matched });
    cursor += take.length;
  });

  out.beats = beats;
  out.timedBy = 'subtitles';
  /* 화면 자막용으로 원본 큐를 남긴다. 타이밍을 이 자막에 맞춰 갈아끼웠으니
     두 시계가 정렬돼 있다 — 재생 시계로 그대로 띄우면 맞는다. */
  out.captions = cues.map(function (c) {
    return { start: c.start, end: c.end, text: c.text };
  });
  return { spec: out, report: report };
}

/** 두 문자열이 앞에서부터 얼마나 겹치는지. 한쪽에 글자가 끼어도 계속 센다. */
function commonPrefixish(a, b) {
  var i = 0, j = 0, hit = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { hit++; i++; j++; continue; }
    // 한 글자 밀어보고 다시 맞춘다 — 오인식·표기 차이를 넘기기 위해서다.
    if (a[i + 1] === b[j]) { i++; continue; }
    if (a[i] === b[j + 1]) { j++; continue; }
    i++; j++;
  }
  return hit;
}

/**
 * 자막만으로 초안 스펙을 만든다. 대본 파일이 없고 자막만 있을 때의 입구다.
 *
 * 장면 타입은 문장 모양을 보고 고른 초안이다 — direction.md 로 다시 고른다.
 */
function fromSubtitles(subtitles, opts) {
  opts = opts || {};
  var cues = typeof subtitles === 'string' ? parseSubtitles(subtitles) : (subtitles || []);
  if (!cues.length) throw new Error('scriptviz: 자막에서 cue 를 찾지 못했다 (SRT · VTT 형식인지 확인한다)');

  var groups = groupCues(cues, opts);
  var spec = { beats: [], timedBy: 'subtitles' };
  if (opts.title) spec.title = opts.title;

  groups.forEach(function (g) {
    var type = guessType(g.text);
    var beat = { say: g.text, scene: draftScene(type, g.text) };
    var res = alignSayToCues(g.text, g.cues, DEFAULT_CPS);
    if (res) {
      beat.at = res.start;
      beat.sec = Math.round((res.end - res.start) * 100) / 100;
      beat.words = res.words;
    } else {
      beat.at = Math.round(g.start * 100) / 100;
      beat.sec = Math.round((g.end - g.start) * 100) / 100;
    }
    spec.beats.push(beat);
  });

  /* 화면 자막용 원본 큐 */
  spec.captions = cues.map(function (c) {
    return { start: c.start, end: c.end, text: c.text };
  });
  if (spec.title) {
    // 타이틀은 첫 발화 앞의 여백에만 넣는다. 여백이 없으면 화면을 밀지 않는다.
    var head = spec.beats.length ? spec.beats[0].at : 0;
    if (head >= 1.2) {
      spec.beats.unshift({
        say: '', at: 0, sec: Math.round(head * 100) / 100,
        scene: { type: 'title', text: spec.title, sub: opts.subtitle || '' }
      });
    }
  }
  return spec;
}


/* ------------------------------------------------------------------ *
 * 이미지 재료 훑기
 *
 * 덱을 짜기 전에 "무엇이 있는지"를 알아야 배치를 정할 수 있다. 파일명만으로
 * 캡션을 지어내면 없는 사실을 쓰게 되므로, 이 목록은 **어디에 놓을지**만
 * 정해주고 무엇이 찍혔는지는 사람·모델이 직접 열어 보게 한다.
 * ------------------------------------------------------------------ */

/** 이미지 헤더에서 픽셀 크기를 읽는다. 못 읽으면 null. */
function imageSize(buf, ext) {
  try {
    if (ext === 'png' && buf.length > 24 && buf.readUInt32BE(12) === 0x49484452)
      return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    if (ext === 'gif' && buf.length > 10)
      return [buf.readUInt16LE(6), buf.readUInt16LE(8)];
    if ((ext === 'jpg' || ext === 'jpeg') && buf[0] === 0xff && buf[1] === 0xd8) {
      var i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        var m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
          return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (ext === 'webp' && buf.length > 30 && buf.toString('ascii', 8, 12) === 'WEBP') {
      var f = buf.toString('ascii', 12, 16);
      if (f === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
      if (f === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
      if (f === 'VP8L') {
        var b = buf.readUInt32LE(21);
        return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
      }
    }
  } catch (e) {}
  return null;
}

/** 비율을 보고 어디에 놓을지 권한다 */
function placeHint(w, h) {
  if (!w || !h) return { where: '?', why: '크기를 못 읽었다 — 직접 열어 본다' };
  var r = w / h;
  if (r >= 1.5) return { where: 'image', why: '가로로 넓다 — 화면 전체로 쓴다' };
  if (r <= 0.8) return { where: 'split.right', why: '세로가 길다 — 반쪽에 넣는다' };
  return { where: 'split.right', why: '정사각에 가깝다 — 반쪽에 넣는다' };
}

/**
 * 폴더(또는 파일 목록)를 훑어 재료 표를 만든다.
 * 반환: [{ file, kb, w, h, ratio, where, why, warn }]
 */
function scanImages(dir) {
  var fs = require('fs'), path = require('path');
  var IMG = { png: 1, jpg: 1, jpeg: 1, gif: 1, webp: 1, svg: 1 };
  var out = [];
  function walk(d, rel) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      if (e.name.charAt(0) === '.') return;
      var full = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) return walk(full, r);
      var ext = (e.name.split('.').pop() || '').toLowerCase();
      if (!IMG[ext]) return;
      var st = fs.statSync(full);
      var size = ext === 'svg' ? null : imageSize(fs.readFileSync(full), ext);
      var w = size ? size[0] : 0, h = size ? size[1] : 0;
      var hint = ext === 'svg'
        ? { where: 'split.right(svg)', why: 'SVG — right.svg 로 넣는다' }
        : placeHint(w, h);
      var warn = [];
      if (st.size > 900 * 1024) warn.push('큰 파일 — 줄여서 넣는다');
      if (w && w < 1200 && hint.where === 'image') warn.push('가로 ' + w + 'px — 전체 화면엔 흐리다');
      out.push({
        file: r, kb: Math.round(st.size / 1024), w: w, h: h,
        ratio: w && h ? +(w / h).toFixed(2) : null,
        where: hint.where, why: hint.why, warn: warn
      });
    });
  }
  walk(dir, '');
  return out.sort(function (a, b) { return a.file < b.file ? -1 : 1; });
}

/* ------------------------------------------------------------------ *
 * 로컬 이미지 -> data URI (단일 파일 원칙)
 * ------------------------------------------------------------------ */

var MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
  ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', weba: 'audio/webm'
};

function inlineAssets(spec, baseDir) {
  var fs, path;
  try { fs = require('fs'); path = require('path'); } catch (e) { return spec; }
  var seen = 0;
  var missing = [], remote = [], heavy = [];
  function conv(src) {
    if (!src) return src;
    if (/^data:/i.test(src)) return src;
    if (/^https?:/i.test(src)) { remote.push(src); return src; }
    var file = path.resolve(baseDir || '.', src);
    if (!fs.existsSync(file)) { missing.push(src); return src; }
    var ext = (file.split('.').pop() || '').toLowerCase();
    if (!MIME[ext]) { missing.push(src + ' (모르는 확장자 .' + ext + ')'); return src; }
    var bytes = fs.statSync(file).size;
    if (bytes > 900 * 1024) heavy.push(src + ' (' + Math.round(bytes / 1024) + 'KB)');
    seen++;
    return 'data:' + MIME[ext] + ';base64,' + fs.readFileSync(file).toString('base64');
  }
  arr(spec.beats).forEach(function (b) {
    var sc = b && b.scene;
    if (!sc) return;
    if (sc.src) sc.src = conv(sc.src);
    if (sc.right && sc.right.src) sc.right.src = conv(sc.right.src);
    if (sc.left && sc.left.src) sc.left.src = conv(sc.left.src);
  });
  spec.__inlined = seen;
  if (missing.length) spec.__imgMissing = missing;
  if (remote.length) spec.__imgRemote = remote;
  if (heavy.length) spec.__imgHeavy = heavy;

  /* 음성(mp3)도 같은 원칙으로 안에 넣는다 — 단일 파일이면 어디에 던져도 소리가 난다.
   * 파일이 크므로 audio.inline:false 를 주면 경로 참조로 남긴다(그때는 HTML 옆에 mp3 를 둬야 한다). */
  var au = spec.audio;
  if (typeof au === 'string') au = spec.audio = { src: au };
  if (au && au.src && !/^(data:|https?:)/i.test(au.src)) {
    var af = path.resolve(baseDir || '.', au.src);
    if (!fs.existsSync(af)) { spec.__audioMissing = au.src; }
    else if (au.inline === false) { spec.__audioBytes = 0; }
    else {
      var ext2 = (af.split('.').pop() || '').toLowerCase();
      spec.__audioBytes = fs.statSync(af).size;
      au.src = 'data:' + (MIME[ext2] || 'audio/mpeg') + ';base64,' + fs.readFileSync(af).toString('base64');
    }
  }
  return spec;
}

/** spec.audio 를 한 모양으로 편다. 문자열이면 경로 하나로 본다. */
function audioSpec(spec) {
  var a = spec && spec.audio;
  if (!a) return null;
  if (typeof a === 'string') a = { src: a };
  if (!a.src) return null;
  return {
    src: String(a.src),
    offset: num(a.offset, 0),      // 음성 안에서 첫 비트가 시작하는 시각(초)
    volume: clamp(num(a.volume, 1), 0, 1),
    master: a.master !== false,    // 기본: 음성이 시계를 잡는다
    duration: num(a.duration, null)
  };
}


/* ------------------------------------------------------------------ *
 * runtime CSS
 *
 * 무대는 1920x1080(세로는 1080x1920) 고정 캔버스이고, 뷰포트에는
 * transform: scale 로 맞춘다. 창 크기가 달라져도 자간·줄바꿈·여백이
 * 그대로라 어떤 화면에서 녹화해도 같은 그림이 나온다.
 * ------------------------------------------------------------------ */

var RUNTIME_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;background:#000;font-family:var(--font);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
#app{position:fixed;inset:0;display:flex;flex-direction:column}
#board{position:relative;flex:1;overflow:hidden;background:#000}
#stage{position:absolute;top:50%;left:50%;width:var(--W);height:var(--H);
  transform-origin:50% 50%;background:var(--bg);overflow:hidden;color:var(--ink);
  font-size:var(--fs-body);line-height:1.3}
#fxl{position:absolute;inset:0;pointer-events:none;z-index:7}
/* 화면 자막 — 무대 아래 안전영역 안쪽. 크로마키에서도 그대로 남는다. */
#cc{position:absolute;left:50%;bottom:6.2%;transform:translateX(-50%);z-index:8;
  max-width:78%;text-align:center;pointer-events:none;display:none}
#cc.on{display:block}
#cc span{position:relative;display:inline-block;padding:.34em .72em;
  color:var(--cc-color);font-family:var(--font);
  font-size:var(--cc-size);font-weight:650;line-height:1.34;
  letter-spacing:-.01em;white-space:pre-wrap;
  /* 한국어는 어절 단위로 끊어야 읽힌다 — 안 그러면 '퍼센/트가' 처럼 잘린다 */
  word-break:keep-all;overflow-wrap:break-word;
  text-shadow:0 2px 10px rgba(0,0,0,.55)}
/* 배경은 뒤에 깔린 별도 레이어다 — 투명도를 낮춰도 글자는 그대로 진하다 */
#cc span::before{content:'';position:absolute;inset:0;z-index:-1;
  border-radius:.28em;background:var(--cc-bg);opacity:var(--cc-opacity)}
#cc.plain span::before{opacity:0}
#cc.plain span{text-shadow:0 2px 6px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.9)}
#stage.p916 #cc{bottom:11%;max-width:86%}
#stage.chroma{background:var(--chroma)!important}
#stage.chroma .bg,#stage.chroma .vig{display:none}

.bg{position:absolute;inset:0;background:
  radial-gradient(120% 100% at 12% 0%, var(--bg2) 0%, transparent 60%),
  radial-gradient(90% 80% at 100% 100%, color-mix(in srgb,var(--accent) 12%,transparent) 0%, transparent 55%),
  var(--bg)}
.vig{position:absolute;inset:0;pointer-events:none;
  box-shadow:inset 0 0 260px 60px color-mix(in srgb,#000 34%,transparent)}
.light .vig{box-shadow:inset 0 0 220px 50px color-mix(in srgb,#000 8%,transparent)}

/* ---- 장면 공통 ---- */
.scene{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;
  padding:var(--pad);gap:var(--gap)}
.scene.mid{align-items:center;text-align:center}
.scene.leave{animation:sceneOut var(--d-out) var(--ez) forwards}
.scene.enter-fade{animation:sceneFade var(--d-scene) var(--ez) both}
.scene.enter-up{animation:sceneUp var(--d-scene) var(--ez) both}
.scene.enter-wipe{animation:sceneWipe var(--d-scene) var(--ez-wipe) both}
.scene.enter-cut{animation:none}
.scene.enter-morph{animation:sceneFade var(--d-scene) var(--ez) both}
@keyframes sceneFade{from{opacity:0}to{opacity:1}}
@keyframes sceneUp{from{opacity:0;transform:translateY(var(--scene-rise)) scale(var(--rv-scale))}
  to{opacity:1;transform:none}}
@keyframes sceneWipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes sceneOut{to{opacity:0}}

/* 아트디렉션은 장면 데이터와 무관한 시각 문법이다. */
#stage.density-airy{--pad:150px;--gap:42px}
#stage.density-dense{--pad:78px;--gap:24px}
#stage.density-bold{--pad:88px;--gap:30px}
#stage.geometry-square :is(.card,.col,.fnode,.qd,.visual){border-radius:0}
#stage.geometry-sharp :is(.card,.col,.fnode,.qd,.visual){border-radius:8px}
#stage.geometry-soft :is(.card,.col,.fnode,.qd,.visual){border-radius:34px}
#stage.surface-open :is(.card,.col,.fnode,.qd,.visual){background:transparent;border-color:transparent}
#stage.surface-open :is(.card,.col,.fnode,.qd){border-top:3px solid var(--line)}
#stage.surface-line :is(.card,.col,.fnode,.qd,.visual){background:transparent}
#stage.surface-soft :is(.card,.col,.fnode,.qd,.visual){border-color:transparent;box-shadow:0 22px 70px color-mix(in srgb,#000 12%,transparent)}

/* type(의미)와 composition(배치)을 분리한다. */
.comp-center,.comp-center-monument,.comp-monument{align-items:center;text-align:center}
.comp-offset,.comp-offset-monument{padding-left:34%;align-items:flex-start}
.comp-edge-crop{padding-left:7%}
.comp-edge-crop :is(.hero,.stats,.big){font-size:calc(var(--fs-stat) * 1.25);max-width:12em;transform:translateX(-.12em)}
.comp-split-line::before{content:"";position:absolute;top:12%;bottom:12%;left:48%;width:2px;background:var(--line)}
.comp-rail :is(.list,.cards){border-left:5px solid var(--accent);padding-left:calc(var(--gap) * 1.2)}
.comp-staggered .li:nth-child(even),.comp-masonry .card:nth-child(even){transform:translateY(calc(var(--gap) * .7))}
.comp-open :is(.card,.qd){background:transparent;border:0;border-top:3px solid var(--line);border-radius:0}
.comp-axis .cols{position:relative}.comp-axis .cols::before{content:"";position:absolute;left:50%;top:-8%;bottom:-8%;width:2px;background:var(--accent)}
.comp-stacked .cols{grid-auto-flow:row;grid-template-columns:1fr}.comp-stacked .vs{display:none}
.comp-stepped .fnode:nth-of-type(even){transform:translateY(calc(var(--gap) * .7))}
.comp-vertical .flow{flex-direction:column}.comp-vertical .farrow{transform:rotate(90deg)}
.comp-editorial :is(.tl,.funnel,.matrix){width:78%;margin-left:18%}
.comp-margin-note .q{margin-left:22%;max-width:14em}.comp-margin-note .by{margin-left:22%}
.comp-poster :is(.bars,.linewrap){transform:scale(1.08);transform-origin:left center}
.comp-visual-first .split{grid-template-columns:1.2fr .8fr}.comp-visual-first .pane{order:2}.comp-visual-first .visual{order:1}
.comp-overlap .split{display:block}.comp-overlap .visual{position:absolute;inset:8% 5% 8% 38%;opacity:.68}.comp-overlap .pane{position:relative;width:54%;z-index:2;height:100%}
.comp-field .picwrap{justify-content:center}.comp-field .pgrid{transform:scale(1.12)}

/* 감정 곡선: 내용은 유지하고 밀도·대비·방향만 변화시킨다. */
.arc-setup{--arc-opacity:.55}.arc-tension{--arc-opacity:.9}.arc-evidence{--arc-opacity:.72}
.arc-turn{--arc-opacity:1}.arc-resolution{--arc-opacity:.42}
.arc-tension .bg::after{opacity:.82}.arc-turn .stitle,.arc-turn .hero{color:var(--accent)}
.arc-resolution{padding-left:calc(var(--pad) * 1.35);padding-right:calc(var(--pad) * 1.35)}

/* 덱 전체 모티프. 장면의 arc/state 에 따라 같은 형태가 변한다. */
.motif{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:var(--motif-opacity,.28);transition:all var(--d-scene) var(--ez)}
.scene{z-index:2}.vig,.corner,.pbar{z-index:5}
.motif-thread::before{content:"";position:absolute;left:7%;right:7%;top:52%;height:3px;background:linear-gradient(90deg,transparent,var(--accent),var(--accent2),transparent);transform:rotate(-7deg)}
.motif-axis::before{content:"";position:absolute;left:9%;right:9%;top:51%;height:1px;background:var(--line)}
.motif-axis::after{content:"";position:absolute;left:50%;top:9%;bottom:9%;width:1px;background:var(--line)}
.motif-block::before{content:"";position:absolute;width:38%;height:58%;right:-8%;top:20%;background:var(--accent);opacity:.13;transform:skewX(-9deg)}
.motif-orb::before{content:"";position:absolute;width:52%;aspect-ratio:1;border-radius:50%;right:-13%;top:-14%;background:radial-gradient(circle at 35% 35%,var(--accent),transparent 68%);filter:blur(18px)}
.motif-dots::before{content:"";position:absolute;inset:8%;background:radial-gradient(var(--accent) 2px,transparent 2px);background-size:48px 48px;mask-image:linear-gradient(90deg,#000,transparent 74%)}
.motif-gridline::before{content:"";position:absolute;inset:7%;border:1px solid var(--line);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:12.5% 12.5%}
.motif.state-tension{transform:scale(1.08) rotate(-2deg);opacity:calc(var(--motif-opacity) * 1.6)}
.motif.state-turn{transform:rotate(8deg);filter:hue-rotate(55deg);opacity:calc(var(--motif-opacity) * 1.8)}
.motif.state-resolution{transform:scale(.82);opacity:calc(var(--motif-opacity) * .65)}
.word-hit{animation:wordHit .72s var(--ez-pop) both}@keyframes wordHit{0%{filter:brightness(1);transform:scale(1)}35%{filter:brightness(1.7);transform:scale(1.06)}100%{filter:none;transform:none}}

.rv{opacity:0;transform:translateY(var(--rise)) scale(var(--rv-scale));
  transition:opacity var(--d-fade) var(--ez),transform var(--d-rv) var(--ez),
    filter var(--d-rv) var(--ez),clip-path var(--d-scene) var(--ez-wipe)}
.rv.in{opacity:1;transform:none}
.rv.dim{opacity:.34}

.kicker{font-size:var(--fs-kicker);font-weight:800;letter-spacing:.14em;color:var(--accent);
  text-transform:uppercase}
.chapter{position:absolute;top:calc(var(--pad) * .58);left:var(--pad);font-size:var(--fs-cap);
  font-weight:700;letter-spacing:.1em;color:var(--muted)}
.chapter::before{content:"";display:inline-block;width:var(--fs-cap);height:3px;
  background:var(--accent);vertical-align:middle;margin-right:.6em;transform:translateY(-.15em)}
.stitle{font-size:var(--fs-h2);font-weight:800;line-height:1.15;letter-spacing:-.02em}
.stitle .hl,.hero .hl,.q .hl{color:var(--accent)}
.sub{font-size:var(--fs-body);color:var(--muted);line-height:1.5;font-weight:500}
.hl{color:var(--accent)}
.mark{background:linear-gradient(transparent 58%,color-mix(in srgb,var(--accent) 38%,transparent) 58%)}

/* ---- title ---- */
.s-title{align-items:flex-start;justify-content:center}
.s-title .big{font-family:var(--display);font-size:var(--fs-title);font-weight:800;
  line-height:1.08;letter-spacing:-.035em;max-width:15em}
.s-title .rule{width:var(--fs-title);height:8px;background:var(--accent);border-radius:4px}

/* ---- hero ---- */
.hero{font-family:var(--display);font-size:var(--fs-hero);font-weight:800;line-height:1.22;
  letter-spacing:-.03em;max-width:17em}
.hero.sm{font-size:calc(var(--fs-hero) * .72)}

/* ---- stat ---- */
.stats{display:flex;gap:calc(var(--gap) * 2);align-items:flex-end;flex-wrap:wrap}
.stat{display:flex;flex-direction:column;gap:.18em;min-width:6em}
.stat .val{font-size:var(--fs-stat);font-weight:800;line-height:.92;letter-spacing:-.045em;
  font-variant-numeric:tabular-nums;color:var(--ink)}
.stat.a1 .val{color:var(--accent)}
.stat.a2 .val{color:var(--accent2)}
.stat .unit{font-size:.42em;font-weight:700;margin-left:.12em;letter-spacing:-.02em}
.stat .label{font-size:var(--fs-body);font-weight:700;color:var(--ink)}
.stat .note{font-size:var(--fs-cap);color:var(--muted)}
.caption{font-size:var(--fs-cap);color:var(--muted)}

/* ---- list ---- */
.list{display:flex;flex-direction:column;gap:calc(var(--gap) * .72);width:100%}
.li{display:flex;gap:.8em;align-items:flex-start}
.li .n{flex:none;width:1.7em;height:1.7em;border-radius:50%;display:grid;place-items:center;
  background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent);
  font-size:var(--fs-body);font-weight:800;line-height:1}
.li .n.plain{background:none;width:auto;height:auto;color:var(--accent)}
.li .t{font-size:var(--fs-item);font-weight:700;line-height:1.3;letter-spacing:-.02em}
.li .d{font-size:var(--fs-cap);color:var(--muted);margin-top:.25em;line-height:1.45}

/* ---- compare ---- */
.cols{display:grid;gap:var(--gap);grid-auto-flow:column;grid-auto-columns:1fr;align-items:stretch;
  position:relative;width:100%}
.cols.two{gap:calc(var(--gap) * 2.9)}
.col{background:var(--panel);border:2px solid var(--line);border-radius:24px;
  padding:calc(var(--gap) * .9);display:flex;flex-direction:column;gap:.7em}
.col.a{border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
.col.b{border-color:color-mix(in srgb,var(--accent2) 55%,transparent)}
.col h3{font-size:var(--fs-h3);font-weight:800;letter-spacing:-.02em}
.col.a h3{color:var(--accent)} .col.b h3{color:var(--accent2)}
.col li{list-style:none;font-size:var(--fs-item2);line-height:1.4;display:flex;gap:.5em;font-weight:600}
.col li::before{content:"—";color:var(--muted);flex:none}
/* .vs 는 .rv 이기도 하다 — 가운데 맞춤을 transform 으로 하면 등장 애니메이션이
   그 transform 을 덮어써 버리므로 margin 으로 맞춘다. */
.vs{position:absolute;left:50%;top:50%;margin:-1.2em 0 0 -1.2em;z-index:2;
  width:2.4em;height:2.4em;border-radius:50%;display:grid;place-items:center;
  background:var(--bg);border:3px solid var(--line);font-size:var(--fs-body);font-weight:800;
  letter-spacing:-.02em}
.verdict{font-size:var(--fs-h3);font-weight:800;color:var(--accent);letter-spacing:-.02em}

/* ---- flow ---- */
.flow{display:flex;align-items:stretch;gap:.5em;width:100%}
.fnode{flex:1;background:var(--panel);border:2px solid var(--line);border-radius:20px;
  padding:calc(var(--gap) * .8);display:flex;flex-direction:column;gap:.3em;justify-content:center}
.fnode .t{font-size:var(--fs-item2);font-weight:800;letter-spacing:-.02em;line-height:1.25}
.fnode .d{font-size:var(--fs-cap);color:var(--muted);line-height:1.4}
.fnode.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.farrow{flex:none;align-self:center;color:var(--accent);font-size:var(--fs-h3);font-weight:800}

/* ---- timeline ---- */
.tl{position:relative;width:100%;padding-top:calc(var(--gap) * 2)}
.tl .axis{position:absolute;left:0;right:0;top:calc(var(--gap) * 2);height:3px;background:var(--line)}
.tl .row{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:var(--gap)}
.tlitem{position:relative;padding-top:calc(var(--gap) * .9);display:flex;flex-direction:column;gap:.25em}
.tlitem::before{content:"";position:absolute;top:1.5px;left:0;
  width:1.1em;height:1.1em;border-radius:50%;background:var(--accent);
  transform:translateY(-50%);box-shadow:0 0 0 8px var(--bg)}
.tlitem .when{font-size:var(--fs-h3);font-weight:800;color:var(--accent);letter-spacing:-.02em}
.tlitem .t{font-size:var(--fs-item2);font-weight:700;line-height:1.3}
.tlitem .d{font-size:var(--fs-cap);color:var(--muted);line-height:1.4}

/* ---- quote ---- */
.q{font-family:var(--display);font-size:var(--fs-quote);font-weight:700;line-height:1.34;
  letter-spacing:-.025em;max-width:19em;position:relative}
.q .mk{position:absolute;left:-.34em;top:-.34em;font-size:2.1em;color:var(--accent);opacity:.5;
  line-height:1}
.by{font-size:var(--fs-body);color:var(--muted);font-weight:700}
.by b{color:var(--ink)}

/* ---- bars ---- */
.bars{display:flex;flex-direction:column;gap:calc(var(--gap) * .62);width:100%}
.bar{display:grid;grid-template-columns:var(--barlabel) 1fr auto;gap:1em;align-items:center}
.bar .bl{font-size:var(--fs-item2);font-weight:700;text-align:right;line-height:1.2}
.bar .track{height:var(--barh);background:var(--panel);border-radius:calc(var(--barh) / 2);overflow:hidden}
.bar .fill{height:100%;width:0;border-radius:inherit;background:var(--accent);
  transition:width var(--d-data) var(--ez)}
.bar.b2 .fill{background:var(--accent2)}
.bar.mute .fill{background:var(--muted)}
.bar .bv{font-size:var(--fs-item2);font-weight:800;font-variant-numeric:tabular-nums;
  min-width:3.4em}

/* ---- image / split ---- */
.imgwrap{position:absolute;inset:0}
.imgwrap img{width:100%;height:100%;object-fit:cover;display:block}
.imgwrap.contain img{object-fit:contain;background:var(--bg)}
.imgwrap.kb img{animation:kb 14s ease-out both}
@keyframes kb{from{transform:scale(1.02)}to{transform:scale(1.14)}}
.treat-editorial img{filter:grayscale(1) contrast(1.1);clip-path:polygon(0 0,94% 0,100% 88%,8% 100%)}
.treat-contrast img{filter:contrast(1.22) saturate(.82)}
.treat-duotone{background:var(--accent)!important;isolation:isolate}
.treat-duotone img{filter:grayscale(1) contrast(1.28);mix-blend-mode:multiply;opacity:.84}
.treat-cinematic img{filter:saturate(.72) contrast(1.12) brightness(.84)}
.treat-cinematic::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--bg) 0,transparent 34%,transparent 74%,color-mix(in srgb,var(--bg) 60%,transparent));pointer-events:none}
.comp-editorial-frame .imgwrap{inset:8% 12%;box-shadow:32px 32px 0 color-mix(in srgb,var(--accent) 28%,transparent)}
.comp-full-bleed{padding:0}
.imgcap{position:absolute;left:var(--pad);right:var(--pad);bottom:calc(var(--pad) * .8);
  font-size:var(--fs-cap);color:#fff;text-shadow:0 2px 18px rgba(0,0,0,.8)}
.imgshade{position:absolute;inset:0;background:linear-gradient(transparent 45%,rgba(0,0,0,.72))}
.split{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--gap) * 1.4);align-items:center;
  width:100%;height:100%}
.split .pane{display:flex;flex-direction:column;gap:var(--gap);justify-content:center;min-width:0}
.split .visual{position:relative;width:100%;height:100%;display:grid;place-items:center;
  overflow:hidden;border-radius:24px;background:var(--panel);padding:calc(var(--gap) * 1.4)}
/* 사진은 패널을 꽉 채운다 — 패딩은 도해·글자에만 준다 */
.split .visual img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
/* 인라인 SVG 에 object-fit 은 듣지 않는다 — 상한을 걸어야 패널을 잡아먹지 않는다.
   (24x24 아이콘 viewBox 를 여기 넣으면 선이 수십 px 로 뭉개진다. validate 가 경고한다) */
.split .visual svg{width:100%;height:auto;
  max-width:min(100%,var(--splitvis,440px));max-height:100%}
.split .visual .diagram{display:flex;align-items:center;justify-content:center;
  gap:calc(var(--gap) * 1.2);width:100%}
.split .visual .dnode{display:flex;flex-direction:column;align-items:center;gap:12px;min-width:0}
.split .visual .dnode .ico{width:var(--dico,132px);height:var(--dico,132px);color:var(--accent)}
.split .visual .dnode .dt{font-size:var(--fs-cap);font-weight:700;color:var(--ink);
  text-align:center;word-break:keep-all;line-height:1.35}
.split .visual .darrow{flex:none;width:56px;height:20px;color:var(--muted)}
.split .visual .solo{display:flex;flex-direction:column;align-items:center;gap:18px}
.split .visual .solo .ico{width:var(--solico,216px);height:var(--solico,216px);color:var(--accent)}
.split .visual .solo .dt{font-size:var(--fs-h3);font-weight:800;color:var(--ink);text-align:center}
/* 패널 안에서는 본문 장면보다 한 급 작게 — 안 그러면 패널을 넘친다 */
.split .visual .stat{align-items:center;text-align:center;min-width:0}
.split .visual .stat .val{font-size:calc(var(--fs-stat) * .6)}
.split .visual .stat .label{text-align:center}
.split .visual .list{width:auto;max-width:86%}
.split .visual .q{font-size:calc(var(--fs-quote) * .74);max-width:86%}

/* ---- lower third (오버레이용) ---- */
.s-lower{justify-content:flex-end;align-items:flex-start}
.lowerbar{background:color-mix(in srgb,var(--bg) 88%,transparent);border-left:10px solid var(--accent);
  padding:.7em 1.1em;border-radius:0 16px 16px 0;display:flex;flex-direction:column;gap:.18em;
  max-width:70%}
.lowerbar .t{font-size:var(--fs-h3);font-weight:800;letter-spacing:-.02em;line-height:1.2}
.lowerbar .s{font-size:var(--fs-cap);color:var(--muted);font-weight:600}

.raw{width:100%;height:100%}

/* ---- icons ---- */
.ico{width:1em;height:1em;display:block;flex:none}
.ico-txt{font-size:.92em;line-height:1}
.ico-none{opacity:.45}
.li .n.ico-chip{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent)}
.li .n.ico-chip .ico{width:.95em;height:.95em}
.fnode .fico{color:var(--accent);font-size:calc(var(--fs-h3) * 1.05);margin-bottom:.12em}
.fnode.on .fico{color:var(--accent)}
.stat .sico{font-size:calc(var(--fs-body) * 1.15);opacity:.95;margin-bottom:.08em;color:var(--muted)}
.stat.a1 .sico{color:var(--accent)} .stat.a2 .sico{color:var(--accent2)}
.lowerbar{flex-direction:row;align-items:center;gap:.7em}
.lowerbar .lico{color:var(--accent);font-size:calc(var(--fs-h3) * 1.15)}

/* ---- cards ---- */
.cards{display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:var(--gap);width:100%}
.card{background:var(--panel);border:2px solid var(--line);border-radius:26px;
  padding:calc(var(--gap) * .95);display:flex;flex-direction:column;gap:.3em}
.card .cico{font-size:calc(var(--fs-hero) * .78);color:var(--accent);margin-bottom:.12em}
.card.b .cico{color:var(--accent2)}
.card.b{border-color:color-mix(in srgb,var(--accent2) 42%,transparent)}
.card:not(.b):not(.c){border-color:color-mix(in srgb,var(--accent) 38%,transparent)}
.card.c .cico{color:var(--ink)}
.card .ct{font-size:var(--fs-item);font-weight:800;letter-spacing:-.025em;line-height:1.2}
.card .cd{font-size:var(--fs-cap);color:var(--muted);line-height:1.45}

/* ---- donut ---- */
.donutwrap{display:flex;align-items:center;gap:calc(var(--gap) * 2)}
.donut{position:relative;width:var(--donut);height:var(--donut);flex:none}
.donut svg{width:100%;height:100%;transform:rotate(-90deg)}
.donut circle{fill:none;stroke-width:13}
.donut .ring{stroke:var(--panel)}
.donut .seg{transition:stroke-dasharray var(--d-data) var(--ez)}
.dcenter{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
.dv{font-size:calc(var(--fs-stat) * .4);font-weight:800;letter-spacing:-.045em;line-height:1}
.dl{font-size:var(--fs-cap);color:var(--muted);margin-top:.25em;max-width:7em}
.legend{display:flex;flex-direction:column;gap:.5em;min-width:0}
.lg{display:flex;align-items:center;gap:.6em;font-size:var(--fs-item2)}
.lg i{width:.7em;height:.7em;border-radius:4px;flex:none}
.lg .ll{font-weight:700}
.lg .lv{color:var(--muted);font-variant-numeric:tabular-nums;font-weight:700}

/* ---- line ---- */
.linewrap{width:100%}
.linewrap svg{width:100%;height:auto;display:block;overflow:visible}
.linewrap .gl{stroke:var(--line);stroke-width:1.4}
.linewrap .ar{opacity:.13}
.linewrap .lp{fill:none;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}
.linewrap .dot{opacity:0;transition:opacity .4s var(--ez) .55s}
.ser.in .dot{opacity:1}
.linewrap .sl{font-size:30px;font-weight:800;font-family:var(--font)}
.xlab{display:flex;justify-content:space-between;margin-top:.45em;font-size:var(--fs-cap);color:var(--muted)}

/* ---- pictograph ---- */
.picscene{width:100%;display:flex;flex-direction:column;gap:calc(var(--gap) * .9)}
.picwrap{display:flex;align-items:center;gap:calc(var(--gap) * 1.6);width:100%}
.pgrid{display:grid;grid-template-columns:repeat(var(--pcols),1fr);gap:.26em;flex:1}
.pgrid.chunked{display:flex;flex-wrap:wrap;gap:.85em;flex:1}
.pchunk{display:grid;grid-template-columns:repeat(var(--pcols),auto);gap:.26em}
.pc{position:relative;color:var(--muted);opacity:.24;line-height:0;
  font-size:calc(var(--picsize) * var(--picscale,1));
  transition:color var(--d-pc) var(--ez),opacity var(--d-pc) var(--ez),
    transform var(--d-pc) var(--ez-pop);
  transition-delay:var(--d)}
.pc.lit{color:var(--pcol,var(--accent));opacity:1;transform:scale(1.06)}
/* 반 칸: 바탕은 흐린 채로 두고 위에 덧칠한 만큼만 색이 든다 */
.pc.part .over{position:absolute;inset:0;color:var(--pcol,var(--accent));opacity:0;
  clip-path:inset(0 var(--cut) 0 0);transition:opacity var(--d-pc) var(--ez);transition-delay:var(--d)}
.pc.part.lit{color:var(--muted);opacity:.24;transform:none}
.pc.part.lit .over{opacity:1}
.pside{flex:none;text-align:right}
.pv{font-size:calc(var(--fs-stat) * .5);font-weight:800;letter-spacing:-.045em;color:var(--accent);line-height:1}
.pu{font-size:.36em;color:var(--muted);font-weight:700;letter-spacing:-.01em}
.pl{font-size:var(--fs-body);font-weight:700;margin-top:.25em}
.prows{display:flex;flex-direction:column;gap:calc(var(--gap) * .95);width:100%}
.prow{display:grid;grid-template-columns:var(--prlab) 1fr auto;align-items:center;gap:1em}
.prl{font-size:var(--fs-item2);font-weight:800;text-align:right;line-height:1.2}
.prv{font-size:var(--fs-item2);font-weight:800;color:var(--accent);
  font-variant-numeric:tabular-nums;min-width:3.2em;text-align:right}
.plegend{display:flex;gap:calc(var(--gap) * 1.5);flex-wrap:wrap}

/* ---- funnel ---- */
.funnel{width:100%}
.funnel svg{width:100%;height:auto;display:block}
.funnel .fl{font-size:36px;font-weight:800;fill:var(--ink);font-family:var(--font)}
.funnel .fv{font-size:26px;font-weight:700;fill:var(--muted);font-family:var(--font)}
.funnel .fd{font-size:26px;font-weight:800;fill:var(--accent2);font-family:var(--font);opacity:.9}

/* ---- matrix ---- */
.matrix{position:relative;width:100%;padding:calc(var(--gap) * 1.4) calc(var(--gap) * 2.4)}
.qgrid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:calc(var(--gap) * .7)}
.qd{background:var(--panel);border:2px solid var(--line);border-radius:22px;
  padding:calc(var(--gap) * .8);display:flex;flex-direction:column;justify-content:center;gap:.18em;
  min-height:calc(var(--gap) * 5)}
.qd .qico{font-size:var(--fs-h3);color:var(--accent);margin-bottom:.1em}
.qd .qt{font-size:var(--fs-item2);font-weight:800;letter-spacing:-.02em}
.qd .qn{font-size:var(--fs-cap);color:var(--muted);line-height:1.4}
.qd.b{border-color:color-mix(in srgb,var(--accent2) 45%,transparent)}
.qd.b .qico{color:var(--accent2)}
.qd.mute{opacity:.66}
.ylab,.xlabm{position:absolute;font-size:var(--fs-cap);color:var(--muted);font-weight:700;letter-spacing:.08em}
/* y축은 왼쪽에 세로쓰기(글자는 바로 선 채 위에서 아래로), x축은 아래에 가로로.
   rotate 로 눕히면 한글 글자가 뒤집힌다 — writing-mode 만 쓴다. */
.ylab{left:0;writing-mode:vertical-rl}
.yt{top:calc(var(--gap) * 1.4)}
.yb{bottom:calc(var(--gap) * 1.4)}
.xlabm{bottom:0}
.xl{left:calc(var(--gap) * 2.4)}
.xr{right:calc(var(--gap) * 2.4)}

/* ---- 배경 레이어 ----
 * 장면(scene.bg)·비트(beat.bg)·덱(spec.bg) 순으로 정해진다. 정보가 아니라 공기다 —
 * 글자를 방해하기 시작하면 이미 과한 것이다.
 */
.bg-grid::after{content:"";position:absolute;inset:0;opacity:.5;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:96px 96px;mask-image:radial-gradient(120% 100% at 30% 20%,#000 30%,transparent 78%)}
.bg-dots::after{content:"";position:absolute;inset:0;opacity:.65;
  background-image:radial-gradient(var(--line) 2.2px,transparent 2.2px);background-size:54px 54px;
  mask-image:radial-gradient(120% 100% at 25% 15%,#000 25%,transparent 75%)}
.bg-scan::after{content:"";position:absolute;inset:0;opacity:.5;
  background-image:repeating-linear-gradient(0deg,var(--line) 0 1px,transparent 1px 7px)}
.bg-rays::after{content:"";position:absolute;inset:-20%;opacity:.6;
  background:conic-gradient(from 196deg at 18% -6%,transparent 0deg,color-mix(in srgb,var(--accent) 34%,transparent) 16deg,
    transparent 34deg,transparent 50deg,color-mix(in srgb,var(--accent2) 26%,transparent) 66deg,transparent 92deg,
    color-mix(in srgb,var(--accent) 18%,transparent) 108deg,transparent 130deg)}
.bg-blob::after,.bg-mesh::after{content:"";position:absolute;inset:-25%;filter:blur(90px);opacity:.5;
  animation:drift 34s ease-in-out infinite alternate}
.bg-blob::after{background:
  radial-gradient(38% 44% at 22% 30%,color-mix(in srgb,var(--accent) 55%,transparent),transparent 70%),
  radial-gradient(34% 40% at 78% 72%,color-mix(in srgb,var(--accent2) 45%,transparent),transparent 70%)}
.bg-mesh::after{background:
  radial-gradient(30% 36% at 12% 18%,color-mix(in srgb,var(--accent) 60%,transparent),transparent 70%),
  radial-gradient(28% 34% at 82% 20%,color-mix(in srgb,var(--accent2) 45%,transparent),transparent 70%),
  radial-gradient(34% 40% at 60% 88%,color-mix(in srgb,var(--accent) 34%,transparent),transparent 70%)}
@keyframes drift{from{transform:translate3d(-2.5%,-1.5%,0) scale(1)}to{transform:translate3d(2.5%,2%,0) scale(1.08)}}
.bg-noise::after{content:"";position:absolute;inset:0;opacity:.5;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E")}

/* 큰 배경 글자. 챕터 번호나 한 단어를 무대 뒤에 깔아 두는 용도. */
.wm{position:absolute;right:-.04em;bottom:-.28em;font-size:calc(var(--fs-stat) * 2.6);font-weight:800;
  letter-spacing:-.06em;line-height:.8;color:transparent;-webkit-text-stroke:2px var(--line);
  pointer-events:none;user-select:none;font-family:var(--display)}

/* 코너 브래킷 · 진행 바 */
.corner{position:absolute;width:56px;height:56px;border:4px solid var(--accent);opacity:.55}
.corner.tl{top:calc(var(--pad) * .5);left:calc(var(--pad) * .5);border-right:0;border-bottom:0}
.corner.tr{top:calc(var(--pad) * .5);right:calc(var(--pad) * .5);border-left:0;border-bottom:0}
.corner.bl{bottom:calc(var(--pad) * .5);left:calc(var(--pad) * .5);border-right:0;border-top:0}
.corner.br{bottom:calc(var(--pad) * .5);right:calc(var(--pad) * .5);border-left:0;border-top:0}
.pbar{position:absolute;left:0;right:0;bottom:0;height:6px;background:var(--panel)}
.pbar i{display:block;height:100%;width:0;background:var(--accent);transition:width .2s linear}

/* ---- 등장 연출 프리셋 (scene.reveal) ---- */
.rv-fade .rv{transform:scale(var(--rv-scale))}
.rv-pop .rv{transform:scale(.9);transform-origin:left center}
.rv-pop .rv.in{transform:none}
.rv-left .rv{transform:translateX(-34px) scale(var(--rv-scale))}
.rv-blur .rv{filter:blur(16px)}
.rv-blur .rv.in{filter:none}
.rv-wipe .rv{clip-path:inset(0 100% 0 0);transform:none}
.rv-wipe .rv.in{clip-path:inset(0 0 0 0)}

/* ---- 아이콘 스타일 (scene.iconStyle) ---- */
.is-chip .cico,.is-chip .fico,.is-chip .qico,.is-chip .colico{
  background:color-mix(in srgb,currentColor 16%,transparent);border-radius:50%;
  width:1.72em;height:1.72em;display:grid;place-items:center}
.is-solid .cico,.is-solid .fico,.is-solid .qico,.is-solid .colico{
  border-radius:50%;width:1.72em;height:1.72em;display:grid;place-items:center;
  background:var(--accent);color:var(--bg)}
.is-solid .card.b .cico,.is-solid .qd.b .qico,.is-solid .col.b .colico{background:var(--accent2)}
.is-solid .card.c .cico{background:var(--ink)}
/* .card.b .cico 쪽이 클래스 셋이라 더 세다 — 글자색은 같은 세기로 되받아야 한다 */
.is-solid .card.b .cico,.is-solid .card.c .cico,.is-solid .qd.b .qico,
.is-solid .col.b .colico,.is-solid .stat.a2 .sico{color:var(--bg)}
.is-chip .cico>.ico,.is-chip .fico>.ico,.is-chip .qico>.ico,.is-chip .colico>.ico,
.is-solid .cico>.ico,.is-solid .fico>.ico,.is-solid .qico>.ico,.is-solid .colico>.ico{
  width:.88em;height:.88em}

/* bars · timeline · compare 의 아이콘 자리 */
.bar .bl{display:flex;align-items:center;justify-content:flex-end;gap:.42em}
.bar .bico{color:var(--accent);width:1.05em;height:1.05em;flex:none}
.tlitem .tico{color:var(--accent);font-size:calc(var(--fs-h3) * .95);margin-bottom:.1em}
.col .colico{color:var(--accent);font-size:calc(var(--fs-h3) * 1.05);margin-bottom:.05em}
.col.b .colico{color:var(--accent2)}
#stage.p916 .bar .bl{justify-content:flex-start}

/* 글자 단위 스태거 (scene.stagger) */
.wd{display:inline-block;opacity:0;transform:translateY(var(--wd-rise));
  transition:opacity var(--d-fade) var(--ez) var(--wd),transform var(--d-rv) var(--ez) var(--wd)}
.rv.in .wd{opacity:1;transform:none}
`;

/* 화면 밖 UI — 녹화에는 잡히지 않는다(clean 모드에서 사라진다) */
var CHROME_CSS = `
#hud{flex:none;height:58px;display:flex;align-items:center;gap:12px;padding:0 14px;
  background:#0c0c10;color:#cfd3e0;font-size:13px;border-top:1px solid #22232c;user-select:none}
#hud button{font:inherit;font-size:12.5px;color:#cfd3e0;background:#1a1b22;border:1px solid #2c2e38;
  border-radius:7px;padding:6px 10px;cursor:pointer;white-space:nowrap}
#hud button:hover{background:#242630}
#hud button.on{background:#2f3140;color:#fff;font-weight:700}
#hud .t{font-variant-numeric:tabular-nums;letter-spacing:.02em}
#hud .sp{flex:1}
#seek{flex:2;height:8px;background:#1e1f27;border-radius:4px;position:relative;cursor:pointer;
  min-width:160px}
#seek i{position:absolute;left:0;top:0;bottom:0;background:#4c8dff;border-radius:4px;width:0}
#seek u{position:absolute;top:-3px;bottom:-3px;width:2px;background:#3a3d4a}
#prompter{flex:none;height:216px;display:flex;gap:16px;padding:14px 18px;background:#101117;
  border-top:1px solid #22232c;color:#e8ecf7;overflow:hidden}
#prompter .now{flex:2;font-size:var(--psize,26px);line-height:1.55;font-weight:600;overflow:auto;
  word-break:keep-all}
/* 노래방식 진행 표시 — 지나간 어절은 밝게, 지금 읽는 어절은 왼쪽부터 차오른다.
   글자 수로 추정한 위치라 실제 낭독과 어긋날 수 있다. */
#prompter .kw{color:#575d70;transition:color .15s linear}
#prompter .kw.done{color:#e8ecf7}
#prompter .kw.cur{
  background-image:linear-gradient(90deg,#8fe9ff 0,#8fe9ff var(--p,0%),#575d70 var(--p,0%));
  -webkit-background-clip:text;background-clip:text;color:transparent;
  text-shadow:0 0 18px rgba(143,233,255,.25)}
#hud button.pace.on{background:#1d3a4a;color:#8fe9ff;border-color:#2b5c73}
#prompter .side{flex:1;border-left:1px solid #23252f;padding-left:16px;font-size:14px;
  color:#8e94a8;line-height:1.6;overflow:auto}
#prompter .side b{color:#cfd3e0;display:block;margin-bottom:4px;font-size:12px;letter-spacing:.08em}
#prompter .note{color:#ffb86b}
#prompter .cd{font-variant-numeric:tabular-nums;font-size:34px;font-weight:800;color:#fff}
body.clean #hud,body.clean #prompter{display:none}
body.clean #board{background:var(--outside,#000)}
#toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:#000c;color:#fff;
  padding:8px 14px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .25s;pointer-events:none;z-index:9}
#toast.on{opacity:1}
#help{position:fixed;right:14px;bottom:78px;background:#0c0c10ee;border:1px solid #2c2e38;color:#cfd3e0;
  border-radius:10px;padding:12px 14px;font-size:12.5px;line-height:1.8;white-space:pre;display:none;z-index:9}
#help.on{display:block}
/* 자막 설정판 — 화면에서 값을 맞추고 그대로 스펙에 옮겨 적는다.
   클린 모드·캡처에서는 #hud 와 함께 사라진다. */
#ccpanel{position:fixed;right:14px;bottom:78px;width:264px;background:#0c0c10f2;
  border:1px solid #2c2e38;border-radius:12px;padding:14px;z-index:10;display:none;
  color:#cfd3e0;font-size:12.5px;box-shadow:0 18px 48px #0009}
#ccpanel.on{display:block}
#ccpanel h4{margin:0 0 10px;font-size:12.5px;font-weight:700;color:#fff;
  display:flex;justify-content:space-between;align-items:center}
#ccpanel h4 button{font:inherit;font-size:16px;line-height:1;color:#8b8f9e;background:none;
  border:0;cursor:pointer;padding:0 2px}
#ccpanel label{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center;
  margin-bottom:9px}
#ccpanel label>span{grid-column:1}
#ccpanel label>b{grid-column:2;font-variant-numeric:tabular-nums;font-weight:600;color:#fff;
  font-size:12px}
#ccpanel input[type=range]{grid-column:1/3;width:100%;accent-color:#4c8dff;height:18px}
#ccpanel input[type=color]{grid-column:2;width:38px;height:24px;padding:0;border:1px solid #2c2e38;
  border-radius:6px;background:#1a1b22;cursor:pointer}
#ccpanel .row{display:flex;gap:6px;margin-top:11px}
#ccpanel .row button{flex:1;font:inherit;font-size:11.5px;color:#cfd3e0;background:#1a1b22;
  border:1px solid #2c2e38;border-radius:7px;padding:6px 4px;cursor:pointer}
#ccpanel .row button:hover{background:#242630}
#ccpanel .pre{display:flex;gap:6px;margin:2px 0 10px}
#ccpanel .pre button{flex:1;font:inherit;font-size:11px;color:#aab0c0;background:#16171d;
  border:1px solid #262832;border-radius:6px;padding:5px 2px;cursor:pointer}
#ccpanel .pre button:hover{color:#fff;background:#242630}
body.clean #ccpanel{display:none!important}

/* ---- 발표 모드 --------------------------------------------------- *
 * 영상용 화면 그대로를 발표에 쓴다. 프롬프터·낭독 시계를 걷어내고, 화면을
 * 꽉 채우고, 손을 떼면 UI 가 사라진다. 장면·픽토그램은 하나도 다시 만들지 않는다.
 * ------------------------------------------------------------------- */
/* 발표용에는 HUD·프롬프터·도움말·자막이 애초에 안 실린다(빌드에서 뺀다).
   여기 남는 건 무대를 화면에 꽉 채우는 것과, 손을 떼면 커서를 감추는 것뿐이다. */
body.present #board{background:#000}
body.present.idle{cursor:none}

/* ---- 슬라이드 오버뷰 ---------------------------------------------- */
#ov{position:fixed;inset:0;z-index:14;background:#07070bfc;backdrop-filter:blur(8px);
  display:none;overflow:auto;padding:26px}
#ov.on{display:block}
#ov h3{margin:0 0 16px;color:#cfd3e0;font:700 13px/1 var(--font);letter-spacing:.04em}
#ov .grid{display:grid;justify-content:start;gap:16px}
#ov figure{margin:0;cursor:pointer;border-radius:10px;overflow:hidden;border:2px solid #23242e;
  background:#0c0c10;transition:border-color .15s}
#ov figure:hover{border-color:#4c8dff}
#ov figure.cur{border-color:#4c8dff}
#ov .shot{position:relative;overflow:hidden;background:var(--bg)}
#ov figcaption{padding:7px 10px;color:#aab0c0;font:600 11.5px/1.4 var(--font);
  display:flex;gap:8px;align-items:baseline}
#ov figcaption b{color:#fff;font-size:12px}
#ov figcaption span{opacity:.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mini{position:absolute;left:0;top:0;width:var(--W);height:var(--H);transform-origin:0 0;
  background:var(--bg);color:var(--ink);font-size:var(--fs-body);line-height:1.3;overflow:hidden}
/* 음성(mp3)을 붙였을 때 — 소리 버튼과, 브라우저 자동재생 차단을 뚫는 시작 판. */
#hud button.mute.off{background:#3a2430;color:#ffb3c0;border-color:#5c2b38}
#hud .au{color:#8fe9ff;opacity:.85;font-size:12px}
#sv-gate{position:fixed;inset:0;background:#08080ce6;display:flex;align-items:center;justify-content:center;
  z-index:20;cursor:pointer}
#sv-gate b{display:block;color:#fff;background:#4c8dff;padding:16px 28px;border-radius:12px;
  font:700 17px/1.5 system-ui,sans-serif;text-align:center;box-shadow:0 14px 44px #0009}
#sv-gate small{display:block;font-weight:400;font-size:12.5px;opacity:.88;margin-top:5px}
/* 버튼 안의 키 힌트 — 키보드가 없는 화면에서는 감춘다. */
#hud button i{font-style:normal;opacity:.5;margin-left:5px;font-size:11px}

/* 좁은 화면(폰 세로) — HUD 를 두 줄로 흘리고, 제작용 버튼은 접는다.
   무대는 transform:scale 로 알아서 맞으므로 크롬만 손보면 된다. */
@media (max-width:720px){
  #hud{flex-wrap:wrap;height:auto;gap:8px;padding:9px 10px}
  #hud button{padding:9px 11px;font-size:12px}
  #hud button i,#hud .sp,#hud #cnt,#hud button.prod{display:none}
  #seek{flex:1 0 100%;order:9;min-width:0;height:10px}
  #prompter{height:150px}
  #prompter .side{display:none}
  #help{left:14px;right:14px;bottom:auto;top:14px;white-space:pre-wrap}
  #sv-gate b{font-size:15px;padding:14px 20px;margin:0 18px}
}
/* 눕힌 폰 — 세로가 모자라다. 크롬을 얇게 하고 대본은 런타임이 접는다. */
@media (max-height:480px){
  #hud{height:auto;padding:6px 10px;gap:7px}
  #hud button{padding:7px 10px}
  #hud button i,#hud #cnt,#hud button.prod{display:none}
  #hud .t{white-space:nowrap}
  #prompter{height:120px}
}
`;

/* 16:9 와 9:16 의 타입 스케일. 값은 무대 캔버스 픽셀 기준이다. */
var SCALE_CSS = `
#stage,.mini{--W:1920px;--H:1080px;--pad:118px;--gap:34px;
  --fs-title:112px;--fs-hero:88px;--fs-h2:60px;--fs-h3:44px;--fs-body:36px;--fs-item:44px;
  --fs-item2:34px;--fs-cap:26px;--fs-kicker:26px;--fs-stat:190px;--fs-quote:64px;
  --barlabel:300px;--barh:46px;--donut:400px;--picsize:44px;--prlab:200px}
#stage.p916,.mini.p916{--W:1080px;--H:1920px;--pad:84px;--gap:30px;
  --fs-title:92px;--fs-hero:76px;--fs-h2:54px;--fs-h3:40px;--fs-body:34px;--fs-item:42px;
  --fs-item2:32px;--fs-cap:26px;--fs-kicker:24px;--fs-stat:168px;--fs-quote:56px;
  --barlabel:210px;--barh:40px;--donut:660px;--picsize:52px;--prlab:150px}
#stage.p916 .stats{flex-direction:column;align-items:flex-start;gap:calc(var(--gap) * 1.1)}
#stage.p916 .cols{grid-auto-flow:row}
#stage.p916 .vs{display:none}
#stage.p916 .flow{flex-direction:column}
#stage.p916 .farrow{transform:rotate(90deg)}
#stage.p916 .tl .axis{display:none}
#stage.p916 .tl .row{grid-auto-flow:row;gap:calc(var(--gap) * .8)}
#stage.p916 .tlitem{padding-top:0;padding-left:2em;border-left:3px solid var(--line)}
#stage.p916 .tlitem::before{top:.6em;left:-.62em}
#stage.p916 .split{grid-template-columns:1fr;grid-template-rows:1fr 1fr}
#stage.p916 .bar{grid-template-columns:1fr;gap:.3em}
#stage.p916 .cards{grid-template-columns:1fr}
#stage.p916 .donutwrap{flex-direction:column;align-items:flex-start;gap:var(--gap)}
#stage.p916 .picwrap{flex-direction:column;align-items:flex-start}
#stage.p916 .pside{text-align:left}
#stage.p916 .qgrid{gap:calc(var(--gap) * .5)}
#stage.p916 .matrix{padding:calc(var(--gap) * 1.4) calc(var(--gap) * 1.8)}
#stage.p916 .funnel .fl{font-size:44px}
#stage.p916 .funnel .fv{font-size:32px}
#stage.p916 .linewrap .sl{font-size:38px}
#stage.p916 .bar .bl{text-align:left}
`;


/* ------------------------------------------------------------------ *
 * runtime
 *
 * 브라우저에서 도는 플레이어. 빌더가 이미 정규화한 비트 배열을 받으므로
 * 여기서는 시간 계산을 다시 하지 않는다. 함수 하나를 통째로 문자열로
 * 굽어 HTML에 넣기 때문에, 이 안의 코드는 바깥 스코프를 참조하면 안 된다.
 * ------------------------------------------------------------------ */

function SVRuntime() {
  'use strict';
  var D = window.__SV__;
  var B = D.beats, OPT = D.opt || {};
  var stage = document.getElementById('stage');
  var board = document.getElementById('board');
  var st = { bi: -1, si: 0, playing: false, clock: 0, last: 0, guides: false, pace: false, cc: false, wds: [], events: {} };
  var Q = new URLSearchParams(location.search);
  var CAPTURE = Q.get('clean') === '1';        // shots.js 가 여는 방식 — 토스트·시작판을 띄우지 않는다

  /* ---------- 음성(mp3) ----------
   * 붙어 있으면 오디오가 시계를 잡는다. 화면은 audio.currentTime 을 읽어 따라가므로
   * 목소리가 끊기거나 버퍼링해도 어긋나지 않는다. 브라우저가 재생을 막으면
   * 자체 시계로 조용히 굴러간다(캡처 도구가 그 경로로 지나간다). */
  var AU = OPT.audio || null;
  var aud = document.getElementById('sv-audio');
  if (!aud) AU = null;
  var audioLead = false;                        // 지금 시계를 오디오가 잡고 있는가
  if (AU) {
    aud.volume = AU.volume == null ? 1 : AU.volume;
    if (Q.get('mute') === '1') aud.muted = true;
    aud.addEventListener('ended', function () { play(false); });
    aud.addEventListener('loadedmetadata', checkAudioLength);
    if (aud.readyState >= 1) checkAudioLength();
  }
  function syncAudio() {
    if (!AU) return;
    var want = Math.max(0, st.clock + (AU.offset || 0));
    if (isFinite(aud.duration) && want > aud.duration) want = aud.duration;
    if (Math.abs(aud.currentTime - want) > 0.12) { try { aud.currentTime = want; } catch (e) { } }
  }
  function muteBtn() {
    var b = document.getElementById('btn-mute');
    if (b) { b.classList.toggle('off', !!aud.muted); b.innerHTML = (aud.muted ? '음소거' : '소리') + '<i>M</i>'; }
  }
  function checkAudioLength() {
    if (!AU || !isFinite(aud.duration) || !aud.duration) return;
    var total = B[B.length - 1].end, span = aud.duration - (AU.offset || 0);
    if (Math.abs(span - total) > Math.max(2, total * 0.05)) {
      setTimeout(function () {
        toast('음성 ' + fmtT(span) + ' vs 화면 ' + fmtT(total) + ' — 자막(--subs)으로 타이밍을 맞춘다');
      }, 800);
    }
  }
  /* iOS 사파리는 data: URI 미디어의 시킹·duration 을 제대로 못 다루는 일이 있다.
   * 재생을 걸었는데 시각이 흐르지 않으면 오디오 시계를 버리고 자체 시계로 간다 —
   * 소리는 그대로 나되 화면이 0초에 붙박이는 것만 막는다. */
  var watchdog = null;
  function watchAudioClock() {
    clearTimeout(watchdog);
    var from = aud.currentTime;
    watchdog = setTimeout(function () {
      if (!st.playing || !audioLead) return;
      if (aud.currentTime - from < 0.05) {
        audioLead = false;
        toast('음성 시각을 읽지 못한다 — 화면은 자체 시계로 간다 (--no-inline-audio 로 다시 뽑아본다)');
      }
    }, 1800);
  }
  function killGate() {
    var g = document.getElementById('sv-gate');
    if (g && g.parentNode) g.parentNode.removeChild(g);
  }

  /* ---------- text helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<b class="hl">$1</b>')
      .replace(/==([^=]+)==/g, '<span class="mark">$1</span>')
      .replace(/\n/g, '<br>');
  }
  function txt(it) { return typeof it === 'string' ? it : (it && it.text) || ''; }
  var SPLIT_WS = / (?![^<]*>)/;      /* 태그 밖의 공백에서만 자른다 */

  /** 단어마다 지연을 준다. off 는 앞 줄에서 이미 쓴 단어 수. 반환값의 n 은 쓴 개수. */
  function words(html, off) {
    var st = D.opt.stagger || 70, n = off || 0;
    var out = html.split(SPLIT_WS).map(function (w) {
      if (!w) return '';                 /* 빈 조각은 스팬도 지연도 쓰지 않는다 */
      return '<span class="wd" style="--wd:' + (n++ * st) + 'ms">' + w + '</span>';
    }).join(' ');
    return { html: out, n: n };
  }

  /**
   * 줄바꿈이 있는 텍스트를 스태거한다.
   *
   * fmt() 가 \n 을 <br> 로 바꿔버리면 그 <br> 이 inline-block 인 .wd 스팬 **안에**
   * 갇힌다. 그러면 그 스팬 하나가 두 줄 높이 박스가 되고, baseline 정렬 때문에
   * 앞 단어가 아래로 밀려 줄이 어긋난다. 그래서 줄을 먼저 쪼개 각 줄을 따로
   * 스태거하고 <br> 로 잇는다. 지연은 줄을 넘어 이어진다.
   */
  /**
   * 줄을 가로지르는 강조를 줄마다 닫고 열어준다.
   * `**A\nB**` -> `**A**\n**B**` — 줄을 먼저 쪼개도 각 줄이 완결된 마크업을 갖는다.
   * 안 하면 `**` 가 화면에 글자로 노출된다.
   */
  function splitMarks(text) {
    return String(text).replace(/(\*\*|==)([^*=]+)\1/g, function (m, mk, inner) {
      if (inner.indexOf('\n') < 0) return m;
      return inner.split('\n').map(function (x) {
        return x ? mk + x + mk : '';      /* 빈 줄에 **** 를 만들지 않는다 */
      }).join('\n');
    });
  }

  function staggerText(text, stagger) {
    var ls = splitMarks(text == null ? '' : text).split('\n');
    if (stagger === false) return ls.map(fmt).join('<br>');
    var off = 0;
    return ls.map(function (ln) {
      var r = words(fmt(ln), off);
      off = r.n;
      return r.html;
    }).join('<br>');
  }
  function rv(at, cls, inner) {
    return '<div class="rv ' + (cls || '') + '" data-at="' + at + '">' + inner + '</div>';
  }

  /* ---------- scene renderers ---------- */
  function shareAttr(sc, role, item) {
    var v = item && item.share;
    if (!v && typeof sc.share === 'string' && role === 'primary') v = sc.share;
    if (!v && sc.share && typeof sc.share === 'object') v = sc.share[role];
    return v ? ' data-share="' + esc(v) + '"' : '';
  }
  function roleAttr(role) { return ' data-role="' + role + '"'; }
  function head(sc) { return sc.title ? '<div class="stitle rv" data-at="0"' + roleAttr('title') + shareAttr(sc, 'title') + '>' + fmt(sc.title) + '</div>' : ''; }
  function kick(sc) { return sc.kicker ? '<div class="kicker rv" data-at="0">' + fmt(sc.kicker) + '</div>' : ''; }


  /* ---------- icon set ----------
   * 24x24 stroke 아이콘. currentColor 를 따르므로 장면의 악센트 색을 그대로 입는다.
   * 목록에 없는 이름을 주면 그 문자열을 그대로 글자로 찍는다(이모지가 그렇게 쓰인다).
   */
  var ICONS = {
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18M6 6l12 12',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    right: 'M5 12h14M13 6l6 6-6 6',
    up: 'M12 19V5M6 11l6-6 6 6',
    down: 'M12 5v14M18 13l-6 6-6-6',
    trendup: 'M3 17l6-6 4 4 8-8M17 7h4v4',
    trenddown: 'M3 7l6 6 4-4 8 8M17 17h4v-4',
    user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8',
    users: 'M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9.5 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
    heart: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 000-7.8z',
    star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
    fire: 'M12 22c4 0 7-2.7 7-6.5 0-4-3-6.5-4-9.5-2 2-2.5 3.5-2.5 5 0 0-1.5-1-1.5-3.5C8 10 5 12 5 15.5 5 19.3 8 22 12 22z',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
    calendar: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18',
    hourglass: 'M6 2h12M6 22h12M6 2c0 5 6 6 6 10 0-4 6-5 6-10M6 22c0-5 6-6 6-10 0 4 6 5 6 10',
    won: 'M12 22a10 10 0 100-20 10 10 0 000 20zM8 8l2 8 2-5 2 5 2-8M7 12h10',
    wallet: 'M20 12V8H6a2 2 0 010-4h12v4M4 6v12a2 2 0 002 2h14v-4M18 12a2 2 0 000 4h4v-4z',
    cart: 'M9 21a1 1 0 100-2 1 1 0 000 2zM20 21a1 1 0 100-2 1 1 0 000 2zM1 2h3l2.7 12.4a2 2 0 002 1.6h9.6a2 2 0 002-1.6L23 6H6',
    tag: 'M20.6 13.4L12 22l-9-9V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01',
    chart: 'M18 20V10M12 20V4M6 20v-6',
    pie: 'M21.2 15.9A10 10 0 118.1 2.8M22 12A10 10 0 0012 2v10z',
    target: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
    rocket: 'M5 13c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8.8-2.2 0-3s-2.2-.8-3 0zM12 15l-3-3a12 12 0 016-8c2-1 5-1 5-1s0 3-1 5a12 12 0 01-8 6z',
    bulb: 'M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z',
    search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
    lock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
    unlock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 019.9-1',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    warn: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
    info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
    question: 'M12 22a10 10 0 100-20 10 10 0 000 20zM9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01',
    doc: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6',
    folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
    mail: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6',
    phone: 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z',
    laptop: 'M4 4h16a2 2 0 012 2v9H2V6a2 2 0 012-2zM1 19h22',
    server: 'M20 2H4a2 2 0 00-2 2v4a2 2 0 002 2h16a2 2 0 002-2V4a2 2 0 00-2-2zM20 14H4a2 2 0 00-2 2v4a2 2 0 002 2h16a2 2 0 002-2v-4a2 2 0 00-2-2zM6 6h.01M6 18h.01',
    cloud: 'M17.5 19a4.5 4.5 0 00.5-9 6.5 6.5 0 00-12.6 1.6A4 4 0 006 19z',
    database: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM20 12c0 1.7-3.6 3-8 3s-8-1.3-8-3M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5',
    gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1A1.7 1.7 0 007 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 002.9-1.2V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
    key: 'M21 2l-9.6 9.6M15.5 7.5l3 3M6.5 20.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z',
    link: 'M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7L12 19',
    globe: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10 15 15 0 014-10z',
    pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
    camera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
    video: 'M23 7l-7 5 7 5zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z',
    mic: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8',
    book: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
    bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
    gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z',
    box: 'M21 16V8l-9-5-9 5v8l9 5 9-5zM3.3 7L12 12l8.7-5M12 22V12',
    truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 3M17 6h3a3 3 0 01-3 3',
    flag: 'M4 22V4s1-1 4-1 5 2 8 2 4-1 4-1v11s-1 1-4 1-5-2-8-2-4 1-4 1',
    leaf: 'M11 20A7 7 0 019.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10zM2 21c0-3 1.9-5.5 4.5-7',
    speech: 'M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8z',
    filter: 'M22 3H2l8 9.5V19l4 2v-8.5z',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15',
    play: 'M5 3l14 9-14 9z',
    home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10',
    building: 'M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01'
  };

  /* 2차 세트 — 주제별. 1차 세트와 같은 규격(24x24, stroke 1.9, round). */
  var ICONS2 = {
    /* 사람 · 감정 */
    userplus: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M19 8v6M22 11h-6',
    usercheck: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M16 11l2 2 4-4',
    crowd: 'M6 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM12 9a3 3 0 100-6 3 3 0 000 6zM2 19a4 4 0 018 0M14 19a4 4 0 018 0M7 20a5 5 0 0110 0',
    smile: 'M12 22a10 10 0 100-20 10 10 0 000 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
    frown: 'M12 22a10 10 0 100-20 10 10 0 000 20zM16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01',
    thumbup: 'M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3M7 11l4-9a3 3 0 013 3v4h5a2 2 0 012 2.3l-1.4 7A2 2 0 0117.6 22H7z',
    thumbdown: 'M17 2h3a2 2 0 012 2v7a2 2 0 01-2 2h-3M17 13l-4 9a3 3 0 01-3-3v-4H5a2 2 0 01-2-2.3l1.4-7A2 2 0 016.4 2H17z',
    id: 'M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zM9 12a2 2 0 100-4 2 2 0 000 4zM6 17a3 3 0 016 0M15 9h4M15 13h4',
    hierarchy: 'M9 3h6v4H9zM3 17h6v4H3zM15 17h6v4h-6zM12 7v4M6 17v-3h12v3',

    /* 돈 · 거래 */
    creditcard: 'M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22M5 15h4',
    bank: 'M12 2L2 8h20zM3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M2 21h20',
    moneybag: 'M9 3h6l-1.5 3h-3zM7.5 6h9C19 8 21 12 21 15a6 6 0 01-6 6H9a6 6 0 01-6-6c0-3 2-7 4.5-9zM12 10v8M14.5 12.5a2 2 0 00-2-1.5h-1a2 2 0 000 4h1a2 2 0 010 4h-1a2 2 0 01-2-1.5',
    receipt: 'M6 2h12v20l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 22zM9 7h6M9 11h6M9 15h4',
    percent: 'M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    exchange: 'M7 4L3 8l4 4M3 8h13a4 4 0 014 4M17 20l4-4-4-4M21 16H8a4 4 0 01-4-4',
    coins: 'M9 11a5 5 0 100-10 5 5 0 000 10zM15 23a5 5 0 100-10 5 5 0 000 10zM9 11v2a5 5 0 003 4.6',

    /* 시간 */
    alarm: 'M12 22a9 9 0 100-18 9 9 0 000 18zM12 9v4l2.5 2M5 3L2 6M19 3l3 3M6 20l-2 2M18 20l2 2',
    stopwatch: 'M12 22a8 8 0 100-16 8 8 0 000 16zM12 11v4M9 2h6M12 6V2M18 7l1.5-1.5',

    /* 기기 · IT */
    mobile: 'M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2zM12 18h.01',
    desktop: 'M20 3H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V5a2 2 0 00-2-2zM8 21h8M12 17v4',
    wifi: 'M1.5 9a15 15 0 0121 0M5 12.5a10 10 0 0114 0M8.5 16a5.5 5.5 0 017 0M12 20h.01',
    code: 'M16 18l6-6-6-6M8 6l-6 6 6 6M14 4l-4 16',
    terminal: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM7 9l3 3-3 3M13 15h4',
    bug: 'M8 6a4 4 0 018 0M6 10h12v4a6 6 0 01-12 0zM2 12h4M18 12h4M4 6l2.5 2M20 6l-2.5 2M4 18l2.5-2M20 18l-2.5-2',
    cpu: 'M6 6h12v12H6zM10 10h4v4h-4zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',
    robot: 'M7 8h10a3 3 0 013 3v6a3 3 0 01-3 3H7a3 3 0 01-3-3v-6a3 3 0 013-3zM12 5v3M12 2a1.5 1.5 0 100 3 1.5 1.5 0 000-3M9 14h.01M15 14h.01M9.5 17h5',
    sparkle: 'M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 15l.9 2.6L22 18.5l-2.1.9L19 22l-.9-2.6L16 18.5l2.1-.9z',
    plug: 'M9 2v6M15 2v6M7 8h10v3a5 5 0 01-10 0zM12 16v6',

    /* 이동 · 물류 */
    car: 'M5 17a2 2 0 100-4 2 2 0 000 4zM19 17a2 2 0 100-4 2 2 0 000 4zM3 15v-4l2-5h14l2 5v4M3 11h18M7 15h10',
    bus: 'M4 4h16a1 1 0 011 1v11a2 2 0 01-2 2H5a2 2 0 01-2-2V5a1 1 0 011-1zM3 10h18M7 22v-4M17 22v-4M7 14h.01M17 14h.01',
    train: 'M6 3h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zM4 10h16M8 21l-2 2M16 21l2 2M8 14h.01M16 14h.01',
    plane: 'M2 13l20-8-6 17-4-6-6-1z',
    ship: 'M3 18l2-7h14l2 7a10 10 0 01-18 0zM12 11V4M8 4h8M12 18v3',
    bike: 'M6 20a4 4 0 100-8 4 4 0 000 8zM18 20a4 4 0 100-8 4 4 0 000 8zM6 16l4-8h5l3 8M9 8h4M15 8l-2-3',
    walk: 'M13 4a2 2 0 100-4 2 2 0 000 4zM9 22l3-7-2-4 1-4 3 2 3 1M10 11l-3 2M13 15l3 3 1 4',
    route: 'M6 5a2 2 0 100-4 2 2 0 000 4zM18 23a2 2 0 100-4 2 2 0 000 4zM6 5v6a5 5 0 005 5h2a5 5 0 015 5',

    /* 미디어 */
    picture: 'M21 3H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',
    music: 'M9 18a3 3 0 100-6 3 3 0 000 6zM20 16a3 3 0 11-6 0 3 3 0 016 0M12 15V3l8 2v11M12 7l8 2',
    headphone: 'M3 18v-6a9 9 0 0118 0v6M3 18a3 3 0 003 3h1v-8H6a3 3 0 00-3 3M21 18a3 3 0 01-3 3h-1v-8h1a3 3 0 013 3',
    broadcast: 'M4.9 19.1a10 10 0 010-14.2M19.1 4.9a10 10 0 010 14.2M7.8 16.2a6 6 0 010-8.4M16.2 7.8a6 6 0 010 8.4M12 14a2 2 0 100-4 2 2 0 000 4',
    newspaper: 'M4 4h13a1 1 0 011 1v14a2 2 0 002 2H5a2 2 0 01-2-2V5a1 1 0 011-1zM18 8h2a2 2 0 012 2v9M7 8h7M7 12h7M7 16h4',
    share: 'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',

    /* 건강 · 과학 */
    hospital: 'M4 21V8l8-5 8 5v13M2 21h20M12 9v6M9 12h6',
    pill: 'M4.5 13.5l9-9a4.95 4.95 0 017 7l-9 9a4.95 4.95 0 01-7-7zM8 8l7 7',
    virus: 'M12 18a6 6 0 100-12 6 6 0 000 12zM12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3',
    dna: 'M6 2c0 6 12 6 12 10s-12 4-12 10M18 2c0 6-12 6-12 10s12 4 12 10M8 6h8M6.5 10h11M6.5 14h11M8 18h8',
    fitness: 'M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11',

    /* 자연 */
    sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
    moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
    rain: 'M17.5 15a4.5 4.5 0 00.5-9 6.5 6.5 0 00-12.6 1.6A4 4 0 006 15M8 19l-1 3M12 19l-1 3M16 19l-1 3',
    droplet: 'M12 2.7l5.7 5.7a8 8 0 11-11.4 0z',
    tree: 'M12 2l5 7h-3l4 6h-4l3 4H7l3-4H6l4-6H7zM12 19v3',

    /* 교육 · 사무 */
    graduation: 'M2 8l10-5 10 5-10 5zM6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 8v6',
    pencil: 'M17 3l4 4L8 20l-5 1 1-5zM14 6l4 4',
    ruler: 'M16 2l6 6L8 22l-6-6zM7 11l2 2M10 8l2 2M13 5l2 2M4 14l2 2',
    briefcase: 'M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M2 12h20',
    presentation: 'M2 3h20M4 3v11h16V3M12 14v4M9 21l3-3 3 3',
    stamp: 'M9 3h6a3 3 0 013 3c0 2-2 3-2 5H8c0-2-2-3-2-5a3 3 0 013-3zM4 15h16v3H4zM4 21h16',
    factory: 'M2 20V9l6 4V9l6 4V4h6v16zM6 20v-3M11 20v-3M17 20v-3',
    store: 'M3 9l1.5-5h15L21 9M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1zM3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M9 21v-6h6v6',
    clipboard: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6v4H9z',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6z',

    /* 음식 · 생활 */
    coffee: 'M4 8h13v6a5 5 0 01-10 0zM17 9h2a3 3 0 010 6h-2M3 21h16M8 2v3M12 2v3',
    food: 'M4 2v7a3 3 0 003 3v10M7 2v7M10 2v7M17 2c-1.5 2-2 4-2 7 0 2 1 3 2 3v10',
    bottle: 'M10 2h4v3l2 3v13a1 1 0 01-1 1H9a1 1 0 01-1-1V8l2-3zM8 12h8',

    /* 스포츠 */
    ball: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 7l4 3-1.5 5h-5L8 10zM12 2v5M20.5 8.5L16 10M18 19l-3.5-4M6 19l3.5-4M3.5 8.5L8 10',
    medal: 'M12 22a6 6 0 100-12 6 6 0 000 12zM8.5 8.5L6 2h12l-2.5 6.5M12 14l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9 16.1l2-.3z',
    run: 'M14 4a2 2 0 100-4 2 2 0 000 4zM5 22l4-6-2-5 2-4 4 2 2 3M11 11l-4 1M13 14l4 1 2 6',

    /* 도구 · 기호 */
    hammer: 'M14 3l7 7-3 3-7-7zM11 6L2 15l4 4 9-9',
    scissors: 'M6 7a3 3 0 100-6 3 3 0 000 6zM6 23a3 3 0 100-6 3 3 0 000 6zM8.1 5.9L20 20M8.1 18.1L20 4',
    paint: 'M3 3h18v8H3zM12 11v3a2 2 0 002 2h1v6h-4v-6',
    magnet: 'M6 3H3v9a9 9 0 0018 0V3h-3v9a6 6 0 01-12 0zM3 9h3M18 9h3',
    layers: 'M12 2l10 6-10 6L2 8zM2 14l10 6 10-6M2 11l10 6 10-6',
    branch: 'M6 3v12M18 6a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 6v3a6 6 0 01-6 6H9',
    loop: 'M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3',
    sort: 'M3 6h18M6 12h12M9 18h6',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    crown: 'M2 18h20M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5z',
    ban: 'M12 22a10 10 0 100-20 10 10 0 000 20zM5 5l14 14',
    expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
    collapse: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
    forward: 'M13 19l9-7-9-7zM2 19l9-7-9-7z',
    map: 'M9 3L2 6v15l7-3 6 3 7-3V3l-7 3zM9 3v15M15 6v15',
    compass: 'M12 22a10 10 0 100-20 10 10 0 000 20zM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z',

    /* 경제·금융 (2026-08 추가) */
    stock: 'M5 5v14M3 8.5h4v7H3zM12 3v18M10 7h4v9h-4zM19 6v12M17 9.5h4v6h-4z',
    safe: 'M3 4h18v16H3zM15 12a3 3 0 11-6 0 3 3 0 016 0M12 8V9.5M12 14.5V16M8 12h1.5M14.5 12H16M5.5 20v1.5M18.5 20v1.5',
    piggy: 'M19.5 13.5a6.5 5.5 0 11-13 0 6.5 5.5 0 0113 0M6.5 12.4H4.2a1.3 1.3 0 100 2.6h2.5M9.3 8.9 10.8 5.4l2.6 2.4M11.2 8.5h4.2M9.8 18.8v1.8M16.8 18.8v1.8M8.7 12.6h.01',
    gold: 'M3 20.5h18l-2.5-6H5.5zM7.5 14.5 9.2 9.5h5.6l1.7 5',
    oil: 'M7.5 3h9c1.5 3 1.5 15 0 18h-9c-1.5-3-1.5-15 0-18zM6.6 8.5h10.8M6.6 15.5h10.8',
    crypto: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0M9.5 8h4.2a2.2 2.2 0 010 4.4H9.5zM9.5 12.4h4.7a2.3 2.3 0 010 4.6H9.5zM9.5 8v9M11.3 6v2M13.7 6v2M11.3 17v2M13.7 17v2',
    bond: 'M6 2h9l3 3v8H6zM9 7h6M9 10h4M17 16.5a3 3 0 11-6 0 3 3 0 016 0M12.4 19l-.9 3.5 2.5-1.4 2.5 1.4-.9-3.5',
    tax: 'M6 2h12v20l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5zM15.5 7.5 8.5 16.5M11.2 8.3a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0M15.2 15.7a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0',
    loan: 'M5 2.5h9l4 4v8.2H5zM8 7.8h5M8 11.2h6M20.5 17.6c0 1.1-2 2-4.5 2s-4.5-.9-4.5-2 2-2 4.5-2 4.5.9 4.5 2zM11.5 17.6v3.1c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-3.1',
    calculator: 'M5 2h14v20H5zM8 5.5h8v3.5H8zM8.6 13h.01M12 13h.01M15.4 13h.01M8.6 16.5h.01M12 16.5h.01M15.4 16.5h.01M8.6 19.5h.01M12 19.5h.01M15.4 19.5h.01',
    scale: 'M12 3.2v17M8 20.2h8M5 7.8h14M5 7.8 2.2 13.6M5 7.8l2.8 5.8M2.2 13.6a2.8 2.8 0 005.6 0M19 7.8l-2.8 5.8M19 7.8l2.8 5.8M16.2 13.6a2.8 2.8 0 005.6 0',
    ledger: 'M5 4a2 2 0 012-2h12v18H7a2 2 0 00-2 2zM5 4v18M9 6.5h6M9 10h4M17.5 14.5a2 2 0 11-4 0 2 2 0 014 0',
    realestate: 'M3 10.6 12 3l9 7.6M5.5 9.6V21h13V9.6M9.4 13.4l1.4 4.6 1.2-3.1 1.2 3.1 1.4-4.6M9.2 15.7h5.6',
    merger: 'M15.5 12a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0M19.5 12a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0',
    salary: 'M3 6.5h18v11H3zM3 6.5l9 6 9-6M16.5 17.5a3 3 0 11-6 0 3 3 0 016 0M12.2 17h2.6M12.2 18.4h2.6',
    umbrella: 'M12 2.5a9.5 9.5 0 019.5 9.5H2.5A9.5 9.5 0 0112 2.5M12 12v6.5a2.8 2.8 0 005.6 0M12 2.5V1',
    container: 'M2.5 7h19v11h-19zM6.7 7v11M10.9 7v11M15.1 7v11M19.3 7v11',
    dividend: 'M16.8 6.2a4.8 4.8 0 11-9.6 0 4.8 4.8 0 019.6 0M9.6 4.2l1.2 4 1.2-2.8 1.2 2.8 1.2-4M9.5 6.4h5M5 14v5M3.2 17.4 5 19.2l1.8-1.8M12 14v5M10.2 17.4 12 19.2l1.8-1.8M19 14v5M17.2 17.4 19 19.2l1.8-1.8',
    bubble: 'M14.6 8.4a5 5 0 11-10 0 5 5 0 0110 0M7.2 6.4a1.7 1.7 0 00.9 1.2M20.8 14.8a3.2 3.2 0 11-6.4 0 3.2 3.2 0 016.4 0M16.2 13.6a1.1 1.1 0 00.6.8M11.4 18.6a2.4 2.4 0 11-4.8 0 2.4 2.4 0 014.8 0',
    interest: 'M15 6 5 16M8.6 8.4a2 2 0 11-4 0 2 2 0 014 0M15.4 17.6a2 2 0 11-4 0 2 2 0 014 0M19.5 21V9M17 11.5 19.5 9 22 11.5',

    /* IT·개발 (2026-08 추가) */
    api: 'M8 3C6 3 5 4 5 6v3c0 1.5-1 2.5-2 3 1 .5 2 1.5 2 3v3c0 2 1 3 3 3M16 3c2 0 3 1 3 3v3c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3v3c0 2-1 3-3 3M9.4 12h.01M12 12h.01M14.6 12h.01',
    browser: 'M3 4h18v16H3zM3 8.5h18M6 6.2h.01M8.6 6.2h.01M11.2 6.2h.01',
    commit: 'M2.5 12H9M15 12h6.5M15 12a3 3 0 11-6 0 3 3 0 016 0',
    merge: 'M8.5 6a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0M8.5 19.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0M6 8.5V17M20.5 6a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0M18 8.5v1.5a5.5 5.5 0 01-5.5 5.5H6',
    pullrequest: 'M8.5 6a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0M8.5 19.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0M6 8.5V17M20.5 19.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0M18 17V9a3 3 0 00-3-3h-3.5M14 3.5 11.5 6 14 8.5',
    pipeline: 'M2.5 8.5h4.5v7H2.5zM9.8 8.5h4.4v7H9.8zM17 8.5h4.5v7H17zM7 12h2.8M14.2 12H17',
    dashboard: 'M3.2 17a9 9 0 1117.6 0M12 17l4.4-5M5.6 13.2h.01M8.2 9.2h.01M12 7.8h.01M15.8 9.2h.01M18.4 13.2h.01',
    queue: 'M2.5 8h3.2v8H2.5zM7.2 8h3.2v8H7.2zM11.9 8h3.2v8h-3.2zM17.2 12h4.3M19.3 9.9l2.2 2.1-2.2 2.1',
    cache: 'M20 6.2c0 1.4-3.6 2.5-8 2.5s-8-1.1-8-2.5S7.6 3.7 12 3.7s8 1.1 8 2.5zM4 6.2v11.6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V6.2M13.8 10.2 10 14.6h3.9L10.1 19',
    loadbalancer: 'M6.2 12a2.2 2.2 0 11-4.4 0 2.2 2.2 0 014.4 0M22 6a2.2 2.2 0 11-4.4 0 2.2 2.2 0 014.4 0M22 12a2.2 2.2 0 11-4.4 0 2.2 2.2 0 014.4 0M22 18a2.2 2.2 0 11-4.4 0 2.2 2.2 0 014.4 0M6.2 12h4.8M11 12V6h6.6M11 12h6.6M11 12v6h6.6',
    firewall: 'M2.5 6.5h19v11h-19zM2.5 12h19M7.5 6.5v5.5M16.5 6.5v5.5M5 12v5.5M12 12v5.5M19 12v5.5',
    heartbeat: 'M2 12h4.2l2-5.2L11.8 17 15 9.4l1.6 2.6H22',
    gpu: 'M2.5 7h17a2 2 0 012 2v6a2 2 0 01-2 2h-17zM8.4 12a2.6 2.6 0 11-5.2 0 2.6 2.6 0 015.2 0M15.4 12a2.6 2.6 0 11-5.2 0 2.6 2.6 0 015.2 0M17.5 10.5h2.5M17.5 13.5h2.5M5 17v3M13 17v3',
    neural: 'M4.6 7.4a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4M4.6 14.6a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4M12 4a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4M12 11a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4M12 18a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4M19.4 10.9a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4M6.8 8.8l3-2.2M6.8 11.8l3 1.4M6.8 15.8l3-1.4M6.8 18.8l3-2.2M14.2 7.4l3.4 3M14.2 13.1h3M14.2 19.4l3.4-3',
    puzzle: 'M10.5 3.5h4.4v2.1a2.1 2.1 0 104.2 0V3.5h1.4v6.2h-2.1a2.1 2.1 0 100 4.2h2.1v6.6h-6.6v-2.1a2.1 2.1 0 10-4.2 0v2.1H3.5v-6.6h2.1a2.1 2.1 0 100-4.2H3.5V3.5h7z',
    kanban: 'M3 4.5h5.2v6H3zM3 12h5.2v7.5H3zM9.4 4.5h5.2v9.5H9.4zM15.8 4.5H21v5h-5.2z',
    ticket: 'M3 7.5a2 2 0 012-2h14a2 2 0 012 2v2a2.5 2.5 0 000 5v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2.5 2.5 0 000-5zM9 8.5v7',
    flask: 'M9 2.5h6M10 2.5v6.2L4.6 18a2 2 0 001.7 3h11.4a2 2 0 001.7-3L14 8.7V2.5M7.2 14.2h9.6',
    wireframe: 'M2.5 3.5h19v17h-19zM2.5 8h19M8.4 8v12.5M11 11h8.2M11 14h8.2M11 17h5.4M4.4 11h1.8M4.4 14h1.8',
    responsive: 'M2 4.5h14v9.5H2zM5.5 17.6h7M9 14v3.6M17.6 7.5h4.4v12h-4.4zM19.2 17.6h1.2',
    webhook: 'M17.5 17H12c-1 0-1.8.9-2.3 1.8A3.8 3.8 0 012.5 17c0-.7.2-1.3.5-1.9M6 17l3-5.5c.5-.9.1-2-.5-2.9a3.8 3.8 0 116.5-3.9M12 6l3 5.5c.5.9 1.7 1.2 2.7 1.2a3.8 3.8 0 010 7.6',
    cube: 'M12 2.5 21 7.5v9L12 21.5 3 16.5v-9zM3 7.5l9 5 9-5M12 12.5v9'
  };
  for (var _k in ICONS2) if (Object.prototype.hasOwnProperty.call(ICONS2, _k)) ICONS[_k] = ICONS2[_k];

  /* 한글·영어 별칭. "icon": "돈" 처럼 쓸 수 있다. */
  var ALIAS = {
    사람: 'user', 인물: 'user', 사람들: 'users', 팀: 'users', 군중: 'crowd', 조직: 'hierarchy',
    신규: 'userplus', 가입: 'userplus', 확인: 'check', 완료: 'check', 체크: 'check',
    취소: 'x', 금지: 'ban', 경고: 'warn', 위험: 'warn', 정보: 'info', 질문: 'question',
    돈: 'won', 비용: 'won', 매출: 'trendup', 성장: 'trendup', 하락: 'trenddown', 감소: 'trenddown',
    카드: 'creditcard', 은행: 'bank', 지갑: 'wallet', 영수증: 'receipt', 할인: 'percent',
    교환: 'exchange', 동전: 'coins', 돈주머니: 'moneybag', 장바구니: 'cart', 가격: 'tag',
    시간: 'clock', 시계: 'clock', 알람: 'alarm', 달력: 'calendar', 일정: 'calendar', 모래시계: 'hourglass',
    차트: 'chart', 그래프: 'chart', 원그래프: 'pie', 목표: 'target', 아이디어: 'bulb',
    검색: 'search', 눈: 'eye', 조회: 'eye', 잠금: 'lock', 보안: 'shield', 열쇠: 'key',
    문서: 'doc', 폴더: 'folder', 메일: 'mail', 전화: 'phone', 휴대폰: 'mobile', 모바일: 'mobile',
    노트북: 'laptop', 컴퓨터: 'desktop', 서버: 'server', 클라우드: 'cloud', 데이터: 'database',
    설정: 'gear', 링크: 'link', 지구: 'globe', 세계: 'globe', 위치: 'pin', 지도: 'map',
    카메라: 'camera', 영상: 'video', 마이크: 'mic', 책: 'book', 알림: 'bell', 선물: 'gift',
    상자: 'box', 배송: 'truck', 트로피: 'trophy', 우승: 'trophy', 깃발: 'flag', 자연: 'leaf',
    대화: 'speech', 말풍선: 'speech', 필터: 'filter', 반복: 'refresh', 재생: 'play',
    집: 'home', 건물: 'building', 회사: 'building', 공장: 'factory', 가게: 'store', 매장: 'store',
    코드: 'code', 개발: 'code', 터미널: 'terminal', 버그: 'bug', 칩: 'cpu', 로봇: 'robot',
    인공지능: 'sparkle', 반짝: 'sparkle', 전원: 'plug', 와이파이: 'wifi',
    자동차: 'car', 버스: 'bus', 기차: 'train', 비행기: 'plane', 배: 'ship', 자전거: 'bike',
    걷기: 'walk', 경로: 'route', 사진: 'picture', 이미지: 'picture', 음악: 'music',
    헤드폰: 'headphone', 방송: 'broadcast', 신문: 'newspaper', 공유: 'share',
    병원: 'hospital', 약: 'pill', 바이러스: 'virus', 유전자: 'dna', 운동: 'fitness',
    해: 'sun', 태양: 'sun', 달: 'moon', 비: 'rain', 물: 'droplet', 나무: 'tree',
    학교: 'graduation', 교육: 'graduation', 연필: 'pencil', 자: 'ruler', 가방: 'briefcase',
    발표: 'presentation', 도장: 'stamp', 클립보드: 'clipboard', 받은편지함: 'inbox',
    커피: 'coffee', 음식: 'food', 병: 'bottle', 공: 'ball', 메달: 'medal', 달리기: 'run',
    망치: 'hammer', 가위: 'scissors', 페인트: 'paint', 자석: 'magnet', 계층: 'layers',
    분기: 'branch', 순환: 'loop', 정렬: 'sort', 격자: 'grid', 왕관: 'crown', 나침반: 'compass',
    불: 'fire', 번개: 'bolt', 별: 'star', 하트: 'heart', 좋아요: 'thumbup', 싫어요: 'thumbdown',
    웃음: 'smile', 슬픔: 'frown', 로켓: 'rocket', 신분증: 'id',
    person: 'user', people: 'users', money: 'won', time: 'clock', warning: 'warn',
    종목: 'stock', 주식: 'stock', 증시: 'stock', 주가: 'stock', 코스피: 'stock', 코스닥: 'stock', 캔들: 'stock', 캔들차트: 'stock',
    금고: 'safe', 보관: 'safe', 자산: 'safe', 수탁: 'safe',
    저금통: 'piggy', 저축: 'piggy', 적금: 'piggy',
    금: 'gold', 금괴: 'gold', 귀금속: 'gold', 안전자산: 'gold',
    원유: 'oil', 유가: 'oil', 배럴: 'oil', 원자재: 'oil',
    암호화폐: 'crypto', 코인: 'crypto', 비트코인: 'crypto', 가상자산: 'crypto',
    채권: 'bond', 증권: 'bond', 증서: 'bond', 국채: 'bond',
    세금: 'tax', 과세: 'tax', 세율: 'tax', 관세: 'tax',
    대출: 'loan', 융자: 'loan', 빚: 'loan', 부채: 'loan', 신용: 'loan',
    계산기: 'calculator', 계산: 'calculator', 정산: 'calculator',
    저울: 'scale', 균형: 'scale', 규제: 'scale', 공정: 'scale', 형평: 'scale',
    장부: 'ledger', 재무제표: 'ledger', 결산: 'ledger', 회계: 'ledger',
    부동산: 'realestate', 집값: 'realestate', 분양: 'realestate', 아파트: 'realestate', 주택: 'realestate',
    인수합병: 'merger', 합병: 'merger', 통합: 'merger',
    급여: 'salary', 월급: 'salary', 소득: 'salary', 연봉: 'salary', 임금: 'salary',
    보험: 'umbrella', 보장: 'umbrella', 우산: 'umbrella', 대비: 'umbrella',
    컨테이너: 'container', 무역: 'container', 수출: 'container', 수입: 'container', 수출입: 'container',
    배당: 'dividend', 배당금: 'dividend', 분배: 'dividend',
    거품: 'bubble', 버블: 'bubble', 과열: 'bubble',
    금리: 'interest', 이자: 'interest', 이율: 'interest', 기준금리: 'interest',
    환율: 'exchange', 환전: 'exchange',
    물가: 'trendup', 인플레이션: 'trendup', 인플레: 'trendup', 상승장: 'trendup', 강세장: 'trendup', 수익: 'trendup', 이익: 'trendup', 흑자: 'trendup', 투자수익: 'trendup',
    디플레이션: 'trenddown', 경기침체: 'trenddown', 침체: 'trenddown', 하락장: 'trenddown', 약세장: 'trenddown', 손실: 'trenddown', 적자: 'trenddown', 역성장: 'trenddown',
    지수: 'chart', 거래량: 'chart', 실적: 'chart',
    시장: 'store', 마켓: 'store', 소상공인: 'store',
    중앙은행: 'bank', 한국은행: 'bank', 연준: 'bank', 금융: 'bank',
    화폐: 'won', 원화: 'won', 통화: 'won', 현금: 'won',
    예산: 'wallet', 가계부: 'wallet',
    자본: 'coins', 투자: 'coins', 펀드: 'coins', 자금: 'coins',
    소비: 'cart', 수요: 'cart', 장바구니소비: 'cart',
    공급: 'truck', 공급망: 'truck',
    유동성: 'droplet',
    기업: 'building', 회사: 'building', 상장사: 'building',
    고용: 'briefcase', 일자리: 'briefcase', 취업: 'briefcase',
    리스크: 'warn', 위험경고: 'warn',
    정책: 'stamp', 인가: 'stamp', 승인도장: 'stamp',
    API: 'api', 에이피아이: 'api', 인터페이스: 'api', 연동: 'api',
    브라우저: 'browser', 웹: 'browser', 웹사이트: 'browser', 프론트엔드: 'browser',
    커밋: 'commit', 변경이력: 'commit',
    머지: 'merge', 병합: 'merge',
    풀리퀘스트: 'pullrequest', 코드리뷰: 'pullrequest', 리뷰요청: 'pullrequest',
    파이프라인: 'pipeline', 빌드: 'pipeline', 배포과정: 'pipeline',
    대시보드: 'dashboard', 계기판: 'dashboard', 모니터링: 'dashboard',
    큐: 'queue', 대기열: 'queue', 메시지큐: 'queue',
    캐시: 'cache', 캐싱: 'cache', 임시저장: 'cache',
    도커: 'cube', 모듈: 'cube', 패키지: 'cube', 마이크로서비스: 'cube', 아티팩트: 'cube', 컨테이너이미지: 'cube',
    로드밸런서: 'loadbalancer', 부하분산: 'loadbalancer', 트래픽분산: 'loadbalancer',
    방화벽: 'firewall', 차단: 'firewall', 네트워크보안: 'firewall',
    헬스체크: 'heartbeat', 상태점검: 'heartbeat', 가동률: 'heartbeat', 업타임: 'heartbeat',
    GPU: 'gpu', 그래픽카드: 'gpu', 연산장치: 'gpu',
    신경망: 'neural', 딥러닝: 'neural', 머신러닝: 'neural', 모델: 'neural', 학습: 'neural',
    플러그인: 'puzzle', 확장: 'puzzle', 애드온: 'puzzle', 통합연동: 'puzzle',
    칸반: 'kanban', 보드: 'kanban', 업무보드: 'kanban', 스프린트: 'kanban',
    티켓: 'ticket', 이슈: 'ticket', 작업항목: 'ticket',
    실험: 'flask', 테스트: 'flask', 검증: 'flask', 실험실: 'flask',
    와이어프레임: 'wireframe', 화면설계: 'wireframe', UI설계: 'wireframe', 레이아웃: 'wireframe',
    반응형: 'responsive', 멀티디바이스: 'responsive', 크로스플랫폼: 'responsive',
    웹훅: 'webhook', 이벤트연동: 'webhook', 콜백: 'webhook',
    백엔드: 'server', 서버실: 'server', 호스팅: 'server',
    로그: 'terminal', 명령어: 'terminal', 콘솔: 'terminal', 프롬프트: 'terminal',
    버전: 'tag', 릴리스태그: 'tag',
    성능: 'bolt', 최적화: 'bolt', 응답속도: 'bolt',
    지연: 'stopwatch', 응답시간: 'stopwatch', 레이턴시: 'stopwatch',
    온콜: 'bell', 알람: 'bell',
    로그인: 'usercheck', 본인확인: 'usercheck',
    암호화: 'lock',
    취약점: 'shield', 방어체계: 'shield',
    개발환경: 'laptop', 작업환경: 'laptop',
    장애: 'bug', 오류: 'bug', 결함: 'bug',
    /* 보강 이름표 */
    배포: 'rocket', 출시: 'rocket', 릴리스: 'rocket', 런칭: 'rocket',
    롤백: 'refresh', 동기화: 'refresh', 재시도: 'refresh', 되돌리기: 'refresh',
    저장소: 'folder', 레포지토리: 'folder', 디렉터리: 'folder',
    오픈소스: 'branch', 포크: 'branch', 분기처리: 'branch',
    라이브러리: 'puzzle', 프레임워크: 'puzzle', 의존성: 'puzzle',
    인프라: 'server', 운영서버: 'server',
    데이터베이스: 'database', 백업: 'database', 복구: 'database', 저장공간: 'database', 용량: 'database',
    개발자: 'code', 스크립트: 'code', 리팩터링: 'code', 소스코드: 'code',
    협업: 'users', 팀작업: 'users', 사용자들: 'users',
    스펙: 'doc', 명세: 'doc', 설계문서: 'doc',
    권한: 'key', 인증키: 'key', 접근권한: 'key',
    인증: 'usercheck', 계정확인: 'usercheck',
    사용자: 'user',
    접속: 'plug', 연결: 'plug',
    챗봇: 'robot', 자동화봇: 'robot',
    자동화: 'loop', 배치: 'loop', 반복처리: 'loop',
    스케줄: 'calendar', 크론: 'calendar', 예약실행: 'calendar',
    아키텍처: 'hierarchy', 구조설계: 'hierarchy',
    마이그레이션: 'truck', 이전: 'truck',
    운영: 'gear', 설정관리: 'gear',
    비용절감: 'percent', 절감률: 'percent',
    학습데이터: 'chart', 데이터셋: 'chart',
    growth: 'trendup', decline: 'trenddown', idea: 'bulb', location: 'pin', settings: 'gear',
    ai: 'sparkle', chip: 'cpu', image: 'picture', photo: 'picture', school: 'graduation'
  };

  /** 세로(9:16) 무대인지. SVG 뷰박스 비율을 정할 때만 쓴다. */
  function PORT() { return stage.classList.contains('p916'); }

  /** 아이콘 하나. size 는 em 배수, 색은 부모의 currentColor. */
  function icon(name, cls) {
    if (!name) return '';
    var key = ALIAS[name] || name;
    var d = ICONS[key];
    if (!d) {
      /* 이름을 못 찾았다고 화면에 그 이름을 글자로 찍으면 볼품이 없다.
         중립 표식만 남기고 콘솔로 알린다 — 스펙 검증에서도 경고가 나간다. */
      if (!icon._warned) icon._warned = {};
      if (!icon._warned[name]) {
        icon._warned[name] = 1;
        if (window.console) console.warn('[scriptviz] 픽토그램 "' + name + '" 없음 — 중립 표식으로 그린다');
      }
      return '<svg class="ico ico-none ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true"><path d="M12 4.5 19.5 12 12 19.5 4.5 12z"/></svg>';
    }
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  /* ---- 화면 자막 ---------------------------------------------------- *
   * 자막 파일(SRT·VTT)을 함께 넣었을 때만 생긴다. 재생 시계로 지금 구간의
   * 자막을 띄운다 — 타이밍이 자막에 맞춰져 있으니 음성과도 맞는다.
   * 프롬프터(발표자용 대본)와는 다른 것이다. 이건 무대 위에 얹히고,
   * 녹화·컷 캡처에 그대로 담긴다.
   * ------------------------------------------------------------------- */
  var CUES = D.captions || [];
  var ccLast = -1, ccPlain = false;

  /* 무대는 비트마다 innerHTML 이 갈리므로 없으면 다시 만든다.
     무대 안에 있어야 무대와 같이 축소·확대되고 캡처에도 그대로 담긴다. */
  function ccLayer() {
    if (!CUES.length) return null;
    var el = stage.querySelector('#cc');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cc';
      stage.appendChild(el);
      ccLast = -1;
    }
    el.classList.toggle('on', st.cc);
    el.classList.toggle('plain', ccPlain);
    return el;
  }
  /* 자막 스타일 — 빌드 값이 기본, URL 로 덮어쓰고, 재생 중에도 바꿀 수 있다.
     녹화하다 "글자가 작다" 싶을 때 다시 빌드하지 않아도 된다. */
  var ccStyle = Object.assign({ size: 38, color: '#ffffff', bg: '#080a10', opacity: 0.72 },
    D.opt.cc || {});
  function ccApply(patch) {
    if (patch) {
      if (patch.size != null) ccStyle.size = Math.max(12, Math.min(120, +patch.size || ccStyle.size));
      if (patch.color) ccStyle.color = String(patch.color);
      if (patch.bg) ccStyle.bg = String(patch.bg);
      if (patch.opacity != null) ccStyle.opacity = Math.max(0, Math.min(1, +patch.opacity));
    }
    var r = document.documentElement.style;
    r.setProperty('--cc-size', ccStyle.size + 'px');
    r.setProperty('--cc-color', ccStyle.color);
    r.setProperty('--cc-bg', ccStyle.bg);
    r.setProperty('--cc-opacity', String(ccStyle.opacity));
    if (ccPanel && ccPanel.__sync) ccPanel.__sync();
    return Object.assign({}, ccStyle);
  }
  /* ---- 자막 설정판 ------------------------------------------------- *
   * 화면에서 값을 맞추고 "스펙 복사"로 그대로 옮겨 적는다. 콘솔이나 URL 을
   * 쓰지 않아도 되고, 맞춘 값이 다음에 열 때도 남는다(캡처 모드는 제외 —
   * 컷마다 스타일이 달라지면 안 되니까).
   * ------------------------------------------------------------------- */
  var CCKEY = 'sv-cc-style';
  var ccPanel = null;

  function ccPresets() {
    return [
      { name: '기본', v: { color: '#ffffff', bg: '#080a10', opacity: 0.72 } },
      { name: '옅게', v: { color: '#ffffff', bg: '#080a10', opacity: 0.22 } },
      { name: '없이', v: { color: '#ffffff', bg: '#080a10', opacity: 0 } }
    ];
  }
  function ccHex(c) { return /^#[0-9a-f]{6}$/i.test(c) ? c : (/^#[0-9a-f]{3}$/i.test(c)
    ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : '#000000'); }

  function ccBuildPanel() {
    if (ccPanel || !CUES.length) return ccPanel;
    var d = document.createElement('div');
    d.id = 'ccpanel';
    d.innerHTML =
      '<h4>자막 스타일<button type="button" data-x="1" title="닫기">×</button></h4>' +
      '<div class="pre">' + ccPresets().map(function (p, i) {
        return '<button type="button" data-pre="' + i + '">' + p.name + '</button>';
      }).join('') + '</div>' +
      '<label><span>글자 크기</span><b id="cc-v-size"></b>' +
        '<input type="range" id="cc-i-size" min="16" max="96" step="1"></label>' +
      '<label><span>글자 색</span><input type="color" id="cc-i-color"></label>' +
      '<label><span>배경 색</span><input type="color" id="cc-i-bg"></label>' +
      '<label><span>배경 투명도</span><b id="cc-v-op"></b>' +
        '<input type="range" id="cc-i-op" min="0" max="1" step="0.01"></label>' +
      '<div class="row"><button type="button" data-copy="1">스펙 복사</button>' +
        '<button type="button" data-reset="1">되돌리기</button></div>';
    document.body.appendChild(d);
    ccPanel = d;

    var iS = d.querySelector('#cc-i-size'), iC = d.querySelector('#cc-i-color');
    var iB = d.querySelector('#cc-i-bg'), iO = d.querySelector('#cc-i-op');
    function sync() {
      iS.value = ccStyle.size; d.querySelector('#cc-v-size').textContent = ccStyle.size + 'px';
      iC.value = ccHex(ccStyle.color); iB.value = ccHex(ccStyle.bg);
      iO.value = ccStyle.opacity; d.querySelector('#cc-v-op').textContent = ccStyle.opacity.toFixed(2);
    }
    function change(patch) { ccApply(patch); ccSave(); sync(); }
    iS.addEventListener('input', function () { change({ size: +iS.value }); });
    iC.addEventListener('input', function () { change({ color: iC.value }); });
    iB.addEventListener('input', function () { change({ bg: iB.value }); });
    iO.addEventListener('input', function () { change({ opacity: +iO.value }); });
    d.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.x) return ccPanelShow(false);
      if (t.dataset.pre != null) return change(ccPresets()[+t.dataset.pre].v);
      if (t.dataset.reset) {
        try { localStorage.removeItem(CCKEY); } catch (err) {}
        return change(Object.assign({}, D.opt.cc || {}));
      }
      if (t.dataset.copy) {
        var json = '"caption": ' + JSON.stringify({
          size: ccStyle.size, color: ccStyle.color, bg: ccStyle.bg, opacity: ccStyle.opacity
        });
        navigator.clipboard.writeText(json).then(function () {
          toast('스펙에 붙여 넣을 값을 복사했다 — ' + json);
        }, function () { toast(json); });
      }
    });
    d.__sync = sync;
    sync();
    return d;
  }
  function ccPanelShow(on) {
    var d = ccBuildPanel();
    if (!d) return toast('이 덱에는 자막이 붙어 있지 않다 (--subs 로 넣는다)');
    var want = on == null ? !d.classList.contains('on') : !!on;
    d.classList.toggle('on', want);
    if (want) d.__sync();
    var b = document.getElementById('btn-ccset');
    if (b) b.classList.toggle('on', want);
  }
  function ccSave() {
    if (CAPTURE) return;
    try { localStorage.setItem(CCKEY, JSON.stringify(ccStyle)); } catch (e) {}
  }
  function ccLoad() {
    if (CAPTURE) return null;              /* 캡처는 빌드 값 그대로 간다 */
    try { return JSON.parse(localStorage.getItem(CCKEY) || 'null'); } catch (e) { return null; }
  }

  function ccInit() {
    if (!CUES.length) return;
    var q = Q.get('cc');
    ccPlain = Q.get('ccplain') === '1';
    /* 빌드 값 <- 지난번에 화면에서 맞춘 값 <- URL 순으로 덮는다 */
    ccApply(ccLoad());
    /* ?ccsize=44&cccolor=%23ffe066&ccbg=%23000&ccopacity=.4 */
    ccApply({
      size: Q.get('ccsize'), color: Q.get('cccolor'),
      bg: Q.get('ccbg'), opacity: Q.get('ccopacity')
    });
    ccSet(q != null ? (q === '1' || q === 'on') : (D.opt.captions !== false), true);
  }
  function ccSet(on, quiet) {
    st.cc = !!on;
    var b = document.getElementById('btn-cc');
    if (b) b.classList.toggle('on', st.cc);
    if (!quiet) toast(st.cc ? '자막 켬' : '자막 끔');
    ccLast = -1;
    ccPaint();
  }
  /** 지금 시각에 걸린 자막을 찾아 띄운다 */
  function ccPaint() {
    var ccEl = ccLayer();
    if (!ccEl) return;
    if (!st.cc) { ccEl.innerHTML = ''; ccLast = -1; return; }
    var t = st.clock, hit = -1;
    for (var i = 0; i < CUES.length; i++) {
      if (t >= CUES[i].start && t < CUES[i].end) { hit = i; break; }
      if (CUES[i].start > t) break;
    }
    if (hit === ccLast) return;
    ccLast = hit;
    ccEl.innerHTML = hit < 0 ? '' : '<span>' + esc(CUES[hit].text) + '</span>';
  }

  /* ---- 강조 이펙트 ------------------------------------------------- *
   * mo.js 가 실려 있을 때만 돈다. 무대(#stage) 안에 붙어서 무대와 같이
   * 축소·확대되고 overflow 에 잘린다. 낭독 시계·장면 렌더링은 안 건드린다.
   *
   * 정지컷 캡처(?fx=0)와 동작 줄이기 환경에서는 아예 발사하지 않는다.
   * ------------------------------------------------------------------- */
  var FXON = !!window.mojs && Q.get('fx') !== '0' &&
    !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var FXFOCUS = D.fxFocus || {};
  var fxShapes = {};
  function fxn(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

  function fxLayer() {
    var l = stage.querySelector('#fxl');
    if (!l) {
      l = document.createElement('div');
      l.id = 'fxl';
      stage.appendChild(l);
    }
    return l;
  }
  function fxColors(list) {
    var cs = getComputedStyle(stage);
    var map = {
      accent: cs.getPropertyValue('--accent').trim(),
      accent2: cs.getPropertyValue('--accent2').trim(),
      ink: cs.getPropertyValue('--ink').trim(),
      muted: cs.getPropertyValue('--muted').trim()
    };
    if (!list || !list.length) return [map.accent, map.accent2];
    return list.map(function (c) { return map[c] || c; });
  }
  function fxPct(v, full) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && /%$/.test(v)) return parseFloat(v) / 100 * full;
    return full / 2;
  }
  /** 이펙트를 터뜨릴 무대 로컬 좌표 */
  function fxXY(at, b) {
    var W = stage.offsetWidth, H = stage.offsetHeight;
    if (at && typeof at === 'object') return [fxPct(at.x, W), fxPct(at.y, H)];
    if (at === 'top') return [W / 2, H * 0.28];
    if (at === 'bottom') return [W / 2, H * 0.74];
    if (at === 'left') return [W * 0.28, H / 2];
    if (at === 'right') return [W * 0.72, H / 2];
    var sel = null;
    if (at && (at.charAt(0) === '.' || at.charAt(0) === '#')) sel = at;
    else if (!at || at === 'focus') sel = FXFOCUS[(b && b.scene && b.scene.type) || ''] || null;
    var el = sel && stage.querySelector(sel);
    if (!el) return [W / 2, H / 2];
    var sr = stage.getBoundingClientRect(), k = (sr.width / W) || 1;
    var r = el.getBoundingClientRect();
    return [(r.left + r.width / 2 - sr.left) / k, (r.top + r.height / 2 - sr.top) / k];
  }
  /** 픽토그램을 mo.js 커스텀 도형으로 등록한다 (24x24 -> mo.js 100x100 좌표계) */
  function fxPicto(name) {
    var d = ICONS[ALIAS[name] || name];
    if (!d) return null;
    var key = 'svfx_' + (ALIAS[name] || name);
    if (!fxShapes[key]) {
      var C = class extends mojs.CustomShape {
        getShape() {
          return '<g transform="scale(' + (100 / 24) + ')"><path d="' + d +
            '" stroke-linecap="round" stroke-linejoin="round" /></g>';
        }
        getLength() { return 100; }
      };
      mojs.addShape(key, C);
      fxShapes[key] = 1;
    }
    return key;
  }

  function fire(f, b) {
    if (!FXON) return;
    var xy = fxXY(f.at, b), x = xy[0] + 'px', y = xy[1] + 'px';
    var P = fxLayer(), C = fxColors(f.colors);
    var W = stage.offsetWidth, H = stage.offsetHeight;
    var k = f.kind;

    if (k === 'burst' || k === 'picto') {
      var shp = k === 'picto' ? fxPicto(f.icon) : null;
      new mojs.Burst({
        parent: P, left: x, top: y, count: fxn(f.count, k === 'picto' ? 9 : 12),
        radius: { 0: fxn(f.radius, Math.min(W, H) * 0.34) },
        children: {
          shape: shp || 'circle',
          fill: shp ? 'none' : C, stroke: shp ? C : 'transparent', strokeWidth: shp ? 2 : 0,
          radius: fxn(f.size, shp ? 26 : 13), scale: { 1: 0 },
          duration: fxn(f.duration, 1000), easing: 'quint.out', degreeShift: 'rand(-14,14)'
        }
      }).play();
      return;
    }
    if (k === 'ripple') {
      [0, 150].forEach(function (dl) {
        new mojs.Shape({
          parent: P, left: x, top: y, shape: 'circle', fill: 'none',
          stroke: C[0], strokeWidth: { 8: 0 },
          radius: { 12: fxn(f.radius, Math.min(W, H) * 0.28) }, opacity: { 1: 0 },
          duration: fxn(f.duration, 1000), delay: dl, easing: 'quint.out'
        }).play();
      });
      return;
    }
    if (k === 'impact') {
      new mojs.Shape({
        parent: P, left: x, top: y, shape: 'circle', fill: 'none',
        stroke: C[0], strokeWidth: { 14: 0 }, opacity: { 0.9: 0 },
        radius: { 24: fxn(f.radius, Math.min(W, H) * 0.4) },
        duration: fxn(f.duration, 750), easing: 'expo.out'
      }).play();
      new mojs.Burst({
        parent: P, left: x, top: y, count: fxn(f.count, 12),
        radius: { 70: fxn(f.radius, Math.min(W, H) * 0.4) * 0.85 },
        children: {
          shape: 'line', stroke: C, strokeWidth: { 5: 0 }, radius: 28,
          scale: { 1: 0.4 }, duration: 640, easing: 'expo.out'
        }
      }).play();
      return;
    }
    if (k === 'pop') {
      new mojs.Shape({
        parent: P, left: x, top: y, shape: 'circle', fill: 'none',
        stroke: C[0], strokeWidth: { 6: 0 }, radius: { 8: fxn(f.radius, 90) },
        opacity: { 1: 0 }, duration: fxn(f.duration, 520), easing: 'cubic.out'
      }).play();
      new mojs.Burst({
        parent: P, left: x, top: y, count: 6, radius: { 14: fxn(f.radius, 90) * 1.1 },
        children: { shape: 'circle', fill: C[0], radius: 7, scale: { 1: 0 }, duration: 560, easing: 'cubic.out' }
      }).play();
      return;
    }
    if (k === 'sparkle') {
      for (var i = 0; i < fxn(f.count, 18); i++) {
        var a = Math.random() * 6.2832, r = fxn(f.radius, Math.min(W, H) * 0.3) * (0.4 + Math.random() * 0.6);
        new mojs.ShapeSwirl({
          parent: P, left: x, top: y, shape: 'cross', fill: C[i % C.length],
          radius: fxn(f.size, 7) * (0.7 + Math.random() * 0.8), angle: { 0: 180 },
          x: { 0: Math.cos(a) * r }, y: { 0: Math.sin(a) * r },
          scale: { 0: 1, 1: 0 }, duration: fxn(f.duration, 1200) * (0.7 + Math.random() * 0.5),
          delay: Math.random() * 250, easing: 'quint.out'
        }).play();
      }
      return;
    }
    if (k === 'confetti') {
      var shapes = ['rect', 'circle', 'polygon'];
      for (var j = 0; j < fxn(f.count, 34); j++) {
        new mojs.ShapeSwirl({
          parent: P, left: (W / 2) + 'px', top: '-4%',
          shape: shapes[j % 3], fill: C[j % C.length],
          radius: fxn(f.size, 11) * (0.6 + Math.random() * 0.9),
          x: { 0: (Math.random() - 0.5) * W * 0.9 },
          y: { 0: H * (0.85 + Math.random() * 0.35) },
          angle: { 0: (Math.random() - 0.5) * 900 }, scale: { 1: 0.7 },
          isSwirl: true, swirlSize: 8 + Math.random() * 20,
          duration: fxn(f.duration, 2600) * (0.75 + Math.random() * 0.5),
          delay: Math.random() * 500, easing: 'linear.none'
        }).play();
      }
      return;
    }
    if (k === 'rise') {
      for (var m = 0; m < fxn(f.count, 22); m++) {
        new mojs.ShapeSwirl({
          parent: P, left: (W / 2) + 'px', top: '104%',
          shape: 'circle', fill: C[m % C.length], opacity: { 0.85: 0 },
          radius: fxn(f.size, 5) * (0.6 + Math.random() * 0.9),
          x: { 0: (Math.random() - 0.5) * W * 0.8 },
          y: { 0: -H * (0.5 + Math.random() * 0.7) },
          scale: { 1: 0.6 }, isSwirl: true, swirlSize: 10 + Math.random() * 18,
          duration: fxn(f.duration, 4200) * (0.7 + Math.random() * 0.6),
          delay: Math.random() * 1800, easing: 'linear.none'
        }).play();
      }
      return;
    }
  }

  /** 이 비트·스텝에 걸린 큐를 발사한다 */
  function runFx(b, si) {
    if (!FXON || !b || !b.fx || !b.fx.length) return;
    for (var i = 0; i < b.fx.length; i++) {
      if (fxn(b.fx[i].step, 0) === si) fire(b.fx[i], b);
    }
  }

  var R = {
    title: function (sc) {
      var big = staggerText(sc.text, sc.stagger);
      return kick(sc) + rv(0, '', '<div class="rule"></div>') +
        '<div class="big rv" data-at="0"' + roleAttr('primary') + shareAttr(sc, 'primary') + '>' + big + '</div>' +
        (sc.sub ? '<div class="sub rv" data-at="1">' + fmt(sc.sub) + '</div>' : '');
    },
    hero: function (sc) {
      var long = String(sc.text || '').length > 30;
      var body = staggerText(sc.text, sc.stagger);
      return kick(sc) +
        '<div class="hero rv' + (long ? ' sm' : '') + '" data-at="0"' + roleAttr('primary') + shareAttr(sc, 'primary') + '>' + body + '</div>' +
        (sc.sub ? '<div class="sub rv" data-at="1">' + fmt(sc.sub) + '</div>' : '');
    },
    stat: function (sc) {
      var items = sc.items || [];
      var tone = ['a1', 'a2', ''];
      var cells = items.map(function (it, i) {
        var v = String(it.value == null ? '' : it.value);
        var n = parseFloat(String(v).replace(/,/g, ''));
        var val = isFinite(n) && /^[\d.,]+$/.test(v)
          ? '<span class="num" data-to="' + n + '" data-raw="' + esc(v) + '">0</span>'
          : esc(v);
        return '<div class="stat ' + (it.tone || tone[i % 3]) + ' rv" data-at="' + i + '">' +
          (it.icon ? '<div class="sico">' + icon(it.icon) + '</div>' : '') +
          '<div class="val"' + roleAttr(i ? 'value-' + (i + 1) : 'primary') + shareAttr(sc, i ? 'value-' + (i + 1) : 'primary', it) + '>' + val + (it.unit ? '<span class="unit">' + esc(it.unit) + '</span>' : '') + '</div>' +
          '<div class="label">' + fmt(it.label || '') + '</div>' +
          (it.note ? '<div class="note">' + fmt(it.note) + '</div>' : '') + '</div>';
      }).join('');
      return head(sc) + kick(sc) + '<div class="stats">' + cells + '</div>' +
        (sc.caption ? '<div class="caption rv" data-at="' + items.length + '">' + fmt(sc.caption) + '</div>' : '');
    },
    list: function (sc) {
      var rows = (sc.items || []).map(function (it, i) {
        var t = txt(it), d = it && it.note;
        var mark = it && it.icon
          ? '<div class="n ico-chip">' + icon(it.icon) + '</div>'
          : (sc.ordered === false ? '<div class="n plain">•</div>' : '<div class="n">' + (i + 1) + '</div>');
        return '<div class="li rv" data-at="' + i + '"' + roleAttr('item-' + (i + 1)) + shareAttr(sc, 'item-' + (i + 1), it) + '>' + mark +
          '<div><div class="t">' + fmt(t) + '</div>' +
          (d ? '<div class="d">' + fmt(d) + '</div>' : '') + '</div></div>';
      }).join('');
      return head(sc) + '<div class="list">' + rows + '</div>';
    },
    compare: function (sc) {
      var cols = sc.columns || [];
      var tone = ['a', 'b', ''];
      var body = cols.map(function (c, i) {
        var lis = (c.items || []).map(function (it) { return '<li>' + fmt(txt(it)) + '</li>'; }).join('');
        return '<div class="col ' + (c.tone || tone[i % 3]) + ' rv" data-at="' + i + '"' + roleAttr('item-' + (i + 1)) + shareAttr(sc, 'item-' + (i + 1), c) + '>' +
          (c.icon ? '<div class="colico">' + icon(c.icon) + '</div>' : '') +
          '<h3>' + fmt(c.title || '') + '</h3><ul>' + lis + '</ul></div>';
      }).join('');
      var two = cols.length === 2;
      var vs = two && sc.vs !== false
        ? '<div class="vs rv" data-at="1">' + esc(sc.vs || 'VS') + '</div>' : '';
      return head(sc) + '<div class="cols' + (two ? ' two' : '') + '">' + body + vs + '</div>' +
        (sc.verdict ? '<div class="verdict rv" data-at="' + cols.length + '">' + fmt(sc.verdict) + '</div>' : '');
    },
    flow: function (sc) {
      var steps = sc.steps || [];
      var parts = [];
      steps.forEach(function (s, i) {
        if (i) parts.push('<div class="farrow rv" data-at="' + i + '">→</div>');
        parts.push('<div class="fnode rv" data-at="' + i + '"' + roleAttr('item-' + (i + 1)) + shareAttr(sc, 'item-' + (i + 1), s) + '>' +
          (s && s.icon ? '<div class="fico">' + icon(s.icon) + '</div>' : '') +
          '<div class="t">' + fmt(txt(s)) + '</div>' +
          (s && s.note ? '<div class="d">' + fmt(s.note) + '</div>' : '') + '</div>');
      });
      return head(sc) + '<div class="flow">' + parts.join('') + '</div>';
    },
    timeline: function (sc) {
      var items = (sc.items || []).map(function (it, i) {
        return '<div class="tlitem rv" data-at="' + i + '"' + roleAttr('item-' + (i + 1)) + shareAttr(sc, 'item-' + (i + 1), it) + '>' +
          (it.icon ? '<div class="tico">' + icon(it.icon) + '</div>' : '') +
          '<div class="when">' + fmt(it.when || '') + '</div>' +
          '<div class="t">' + fmt(txt(it)) + '</div>' +
          (it.note ? '<div class="d">' + fmt(it.note) + '</div>' : '') + '</div>';
      }).join('');
      return head(sc) + '<div class="tl"><div class="axis"></div><div class="row">' + items + '</div></div>';
    },
    quote: function (sc) {
      return '<div class="q rv" data-at="0"' + roleAttr('primary') + shareAttr(sc, 'primary') + '><span class="mk">“</span>' + fmt(sc.text) + '</div>' +
        (sc.by ? '<div class="by rv" data-at="1"><b>' + esc(sc.by) + '</b>' +
          (sc.role ? ' · ' + esc(sc.role) : '') + '</div>' : '');
    },
    bars: function (sc) {
      var items = sc.items || [];
      var max = sc.max || Math.max.apply(null, items.map(function (it) { return +it.value || 0; })) || 1;
      var rows = items.map(function (it, i) {
        var pct = Math.max(0, Math.min(100, (+it.value || 0) / max * 100));
        return '<div class="bar ' + (it.tone || '') + ' rv" data-at="' + (sc.together ? 0 : i) + '">' +
          '<div class="bl">' + (it.icon ? icon(it.icon, 'bico') : '') + '<span>' + fmt(it.label || '') + '</span></div>' +
          '<div class="track"><div class="fill" data-w="' + pct + '"></div></div>' +
          '<div class="bv">' + esc(it.value) + (sc.unit ? esc(sc.unit) : '') + '</div></div>';
      }).join('');
      return head(sc) + '<div class="bars"' + roleAttr('primary') + shareAttr(sc, 'primary') + '>' + rows + '</div>' +
        (sc.caption ? '<div class="caption rv" data-at="' + items.length + '">' + fmt(sc.caption) + '</div>' : '');
    },
    image: function (sc) {
      return '<div class="imgwrap rv ' + (sc.fit === 'contain' ? 'contain ' : '') +
        (sc.kenburns === false ? '' : 'kb ') + 'treat-' + esc(sc.imageTreatment || OPT.imageTreatment || 'natural') + '" data-at="0"' + roleAttr('primary') + shareAttr(sc, 'primary') + '>' +
        '<img src="' + esc(sc.src) + '" alt="">' +
        (sc.caption ? '<div class="imgshade"></div>' : '') + '</div>' +
        (sc.caption ? '<div class="imgcap rv" data-at="1">' + fmt(sc.caption) + '</div>' : '');
    },
    split: function (sc) {
      var l = sc.left || {}, r = sc.right || {};
      var left = '<div class="pane rv" data-at="0">' +
        (l.kicker ? '<div class="kicker">' + fmt(l.kicker) + '</div>' : '') +
        (l.title ? '<div class="stitle">' + fmt(l.title) + '</div>' : '') +
        (l.text ? '<div class="sub">' + fmt(l.text) + '</div>' : '') +
        ((l.items || []).length ? '<div class="list">' + l.items.map(function (it) {
          return '<div class="li"><div class="n plain">—</div><div class="t">' + fmt(txt(it)) + '</div></div>';
        }).join('') + '</div>' : '') + '</div>';
      /* 오른쪽 시각물. 손으로 SVG 를 짜지 않아도 되는 길을 먼저 둔다 —
         raw svg 는 크기·선굵기·충돌을 스킬이 보증할 수 없다. */
      var vis;
      var rflow = Array.isArray(r.flow) ? r.flow : (r.flow ? [r.flow] : []);
      var rlist = Array.isArray(r.items) ? r.items : (r.items ? [r.items] : []);
      if (r.src) vis = '<img src="' + esc(r.src) + '" alt="">';
      else if (rflow.length) {
        vis = '<div class="diagram">' + rflow.map(function (it, i) {
          var o = typeof it === 'string' ? { text: it } : (it || {});
          return (i ? '<svg class="darrow" viewBox="0 0 56 20" fill="none" stroke="currentColor" ' +
              'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M2 10h48M43 4l7 6-7 6"/></svg>' : '') +
            '<div class="dnode">' + (o.icon ? icon(o.icon, 'ico') : '') +
            (o.text ? '<div class="dt">' + fmt(o.text) + '</div>' : '') + '</div>';
        }).join('') + '</div>';
      } else if (r.picto || r.icon) {
        vis = '<div class="solo">' + icon(r.picto || r.icon, 'ico') +
          (r.label ? '<div class="dt">' + fmt(r.label) + '</div>' : '') + '</div>';
      } else if (r.stat) {
        /* 큰 숫자 하나. stat 장면과 같은 마크업이라 카운트업이 그대로 붙는다. */
        var it = typeof r.stat === 'string' ? { value: r.stat } : r.stat;
        var v = String(it.value == null ? '' : it.value);
        var nn = parseFloat(v.replace(/,/g, ''));
        var val = (isFinite(nn) && /^[\d.,]+$/.test(v))
          ? '<span class="num" data-to="' + nn + '" data-raw="' + esc(v) + '">0</span>' : esc(v);
        vis = '<div class="stat ' + (it.tone || 'a1') + '">' +
          (it.icon ? '<div class="sico">' + icon(it.icon) + '</div>' : '') +
          '<div class="val">' + val +
          (it.unit ? '<span class="unit">' + esc(it.unit) + '</span>' : '') + '</div>' +
          (it.label ? '<div class="label">' + fmt(it.label) + '</div>' : '') +
          (it.note ? '<div class="note">' + fmt(it.note) + '</div>' : '') + '</div>';
      } else if (rlist.length) {
        vis = '<div class="list">' + rlist.map(function (it2) {
          var o = typeof it2 === 'string' ? { text: it2 } : (it2 || {});
          return '<div class="li">' +
            (o.icon ? '<div class="n ico-chip">' + icon(o.icon) + '</div>'
                    : '<div class="n plain">—</div>') +
            '<div class="t">' + fmt(txt(o)) + '</div></div>';
        }).join('') + '</div>';
      } else if (r.quote) {
        vis = '<div class="q"><span class="mk">"</span>' + fmt(r.quote) +
          (r.by ? '<div class="by">' + fmt(r.by) + '</div>' : '') + '</div>';
      } else vis = r.svg || r.html || '';
      var right = '<div class="visual rv treat-' + esc(sc.imageTreatment || OPT.imageTreatment || 'natural') + '" data-at="1"' + roleAttr('primary') + shareAttr(sc, 'primary') + '>' + vis + '</div>';
      return '<div class="split">' + left + right + '</div>';
    },
    lower: function (sc) {
      return '<div class="lowerbar rv" data-at="0">' +
        (sc.icon ? '<div class="lico">' + icon(sc.icon) + '</div>' : '') +
        '<div><div class="t">' + fmt(sc.text) + '</div>' +
        (sc.sub ? '<div class="s">' + fmt(sc.sub) + '</div>' : '') + '</div></div>';
    },
    cards: function (sc) {
      var items = sc.items || [];
      var cols = sc.cols || Math.min(items.length, items.length === 4 ? 2 : 3);
      var tone = ['', 'b', 'c'];
      var body = items.map(function (it, i) {
        return '<div class="card ' + (it.tone || tone[i % 3]) + ' rv" data-at="' + i + '"' + roleAttr('item-' + (i + 1)) + shareAttr(sc, 'item-' + (i + 1), it) + '>' +
          (it.icon ? '<div class="cico">' + icon(it.icon) + '</div>' : '') +
          '<div class="ct">' + fmt(txt(it)) + '</div>' +
          (it.note ? '<div class="cd">' + fmt(it.note) + '</div>' : '') + '</div>';
      }).join('');
      return head(sc) + '<div class="cards" style="--cols:' + cols + '">' + body + '</div>' +
        (sc.caption ? '<div class="caption rv" data-at="' + items.length + '">' + fmt(sc.caption) + '</div>' : '');
    },

    donut: function (sc) {
      var items = sc.items || [];
      var sum = sc.total || items.reduce(function (a, b) { return a + (+b.value || 0); }, 0) || 1;
      var R0 = 42, C = 2 * Math.PI * R0, off = 0;
      var tone = ['accent', 'accent2', 'muted', 'ink'];
      var segs = items.map(function (it, i) {
        var frac = (+it.value || 0) / sum;
        var len = C * frac;
        var seg = '<circle class="seg rv" data-at="' + i + '" data-len="' + len.toFixed(2) + '" ' +
          'cx="50" cy="50" r="' + R0 + '" stroke="var(--' + (it.tone || tone[i % 4]) + ')" ' +
          'stroke-dasharray="0 ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
        off += len;
        return seg;
      }).join('');
      var center = sc.center || (items.length ? { value: Math.round((+items[0].value || 0) / sum * 100) + '%', label: items[0].label } : null);
      var legend = items.map(function (it, i) {
        return '<div class="lg rv" data-at="' + i + '"><i style="background:var(--' + (it.tone || tone[i % 4]) + ')"></i>' +
          '<span class="ll">' + fmt(it.label || '') + '</span>' +
          '<span class="lv">' + esc(it.value) + (sc.unit ? esc(sc.unit) : '') + '</span></div>';
      }).join('');
      return head(sc) + '<div class="donutwrap"' + roleAttr('primary') + shareAttr(sc, 'primary') + '>' +
        '<div class="donut"><svg viewBox="0 0 100 100">' +
        '<circle class="ring" cx="50" cy="50" r="' + R0 + '"/>' + segs + '</svg>' +
        (center ? '<div class="dcenter"><div class="dv">' + esc(center.value) + '</div>' +
          (center.label ? '<div class="dl">' + fmt(center.label) + '</div>' : '') + '</div>' : '') +
        '</div><div class="legend">' + legend + '</div></div>' +
        (sc.caption ? '<div class="caption rv" data-at="' + items.length + '">' + fmt(sc.caption) + '</div>' : '');
    },

    line: function (sc) {
      var series = sc.series || [{ label: '', values: sc.values || [] }];
      var xs = sc.xLabels || [];
      var all = series.reduce(function (a, s2) { return a.concat(s2.values || []); }, []);
      var max = sc.max != null ? sc.max : Math.max.apply(null, all.concat([0]));
      var min = sc.min != null ? sc.min : Math.min.apply(null, all.concat([0]));
      var W = 1000, H = PORT() ? 560 : 380, P = 8;
      function X(i, n) { return P + (W - P * 2) * (n <= 1 ? 0.5 : i / (n - 1)); }
      function Y(v) { return H - ((v - min) / ((max - min) || 1)) * (H - 20) - 10; }
      var grid = [0, 0.25, 0.5, 0.75, 1].map(function (g) {
        var y = 10 + (H - 20) * g;
        return '<line class="gl" x1="0" y1="' + y.toFixed(1) + '" x2="' + W + '" y2="' + y.toFixed(1) + '"/>';
      }).join('');
      var tone = ['accent', 'accent2', 'muted'];
      var paths = series.map(function (s2, si) {
        var v = s2.values || [], n = v.length;
        var d = v.map(function (val, i) { return (i ? 'L' : 'M') + X(i, n).toFixed(1) + ' ' + Y(val).toFixed(1); }).join('');
        var area = d + 'L' + X(n - 1, n).toFixed(1) + ' ' + H + 'L' + X(0, n).toFixed(1) + ' ' + H + 'Z';
        var col = 'var(--' + (s2.tone || tone[si % 3]) + ')';
        var dots = v.map(function (val, i) {
          return '<circle class="dot" cx="' + X(i, n).toFixed(1) + '" cy="' + Y(val).toFixed(1) + '" r="7" fill="' + col + '"/>';
        }).join('');
        return '<g class="ser rv" data-at="' + si + '" style="color:' + col + '">' +
          (sc.area === false || si ? '' : '<path class="ar" d="' + area + '" fill="' + col + '"/>') +
          '<path class="lp" d="' + d + '" stroke="' + col + '"/>' + dots +
          (s2.label ? '<text class="sl" x="' + (X(n - 1, n) - 6).toFixed(1) + '" y="' + (Y(v[n - 1]) - 20).toFixed(1) +
            '" fill="' + col + '" text-anchor="end">' + esc(s2.label) + '</text>' : '') + '</g>';
      }).join('');
      var labels = xs.length ? '<div class="xlab">' + xs.map(function (l) {
        return '<span>' + esc(l) + '</span>';
      }).join('') + '</div>' : '';
      return head(sc) + '<div class="linewrap"' + roleAttr('primary') + shareAttr(sc, 'primary') + '><svg viewBox="0 0 ' + W + ' ' + H + '">' +
        grid + paths + '</svg>' + labels + '</div>' +
        (sc.caption ? '<div class="caption rv" data-at="' + series.length + '">' + fmt(sc.caption) + '</div>' : '');
    },

    pictograph: function (sc) {
      var PSIZE = { sm: .7, md: 1, lg: 1.45 };
      var scale = PSIZE[sc.size] || 1;
      var base = sc.icon || 'user';

      /* 칸 하나. frac 을 주면 그 비율만큼만 색이 찬다(반 사람 표현). */
      function cell(name, gi, idx, tone, frac) {
        var st = '--d:' + (idx * 16) + 'ms' + (tone ? ';--pcol:var(--' + tone + ')' : '') +
          (frac != null ? ';--cut:' + Math.round((1 - frac) * 100) + '%' : '');
        return '<span class="pc' + (frac != null ? ' part' : '') + '" data-g="' + gi + '" style="' + st + '">' +
          icon(name) + (frac != null ? '<span class="over">' + icon(name) + '</span>' : '') + '</span>';
      }
      /* chunk 를 주면 그 수마다 묶어 사이를 벌린다 — 10개 단위로 세기 쉬워진다. */
      function grid(cells, cols, chunk) {
        if (!chunk) return '<div class="pgrid" style="--pcols:' + cols + '">' + cells.join('') + '</div>';
        var out = [];
        for (var i = 0; i < cells.length; i += chunk) {
          out.push('<div class="pchunk" style="--pcols:' + Math.min(chunk, cols) + '">' +
            cells.slice(i, i + chunk).join('') + '</div>');
        }
        return '<div class="pgrid chunked">' + out.join('') + '</div>';
      }
      function colsFor(n) { return sc.cols || (n > 60 ? 20 : n > 24 ? 10 : Math.ceil(Math.sqrt(n))); }

      var body, legend = '', steps;

      if (sc.rows) {
        /* 여러 줄 비교 — 같은 척도로 두 시점·두 집단을 나란히 */
        var rows = sc.rows.slice(0, 4);
        body = '<div class="prows">' + rows.map(function (r, ri) {
          var total = Math.max(1, Math.min(200, r.total || sc.total || 100));
          var filled = Math.max(0, Math.min(total, r.filled || 0));
          var cells = [];
          for (var i = 0; i < total; i++) {
            var frac = (i === Math.floor(filled) && filled % 1) ? filled % 1 : null;
            var lit = i < Math.floor(filled) || frac != null;
            cells.push(cell(r.icon || base, lit ? ri : 99, i, lit ? (r.tone || 'accent') : null,
              i < Math.floor(filled) ? null : frac));
          }
          return '<div class="prow rv" data-at="' + ri + '">' +
            '<div class="prl">' + fmt(r.label || '') + '</div>' +
            grid(cells, colsFor(total), sc.chunk) +
            '<div class="prv" style="color:var(--' + (r.tone || 'accent') + ')">' +
            (r.value != null ? esc(r.value) : Math.round(filled / total * 100) + '%') + '</div></div>';
        }).join('') + '</div>';
        steps = rows.length;
      } else if (sc.groups) {
        /* 한 격자를 여러 색으로 나눠 채운다 — 구성비를 사람 수로 */
        var gs = sc.groups.slice(0, 4);
        var totalG = sc.total || gs.reduce(function (a, g2) { return a + (+g2.value || 0); }, 0) || 1;
        var cellsG = [], gi = 0, done = 0;
        gs.forEach(function (g2, k) {
          var n = Math.round((+g2.value || 0));
          for (var i = 0; i < n && done < totalG; i++, done++) {
            cellsG.push(cell(g2.icon || base, k, done, g2.tone || (k === 0 ? 'accent' : k === 1 ? 'accent2' : 'muted'), null));
          }
        });
        while (cellsG.length < totalG) { cellsG.push(cell(base, 99, cellsG.length, null, null)); }
        body = '<div class="picwrap rv" data-at="0">' + grid(cellsG, colsFor(totalG), sc.chunk) + '</div>';
        legend = '<div class="plegend">' + gs.map(function (g2, k) {
          return '<div class="lg rv" data-at="' + k + '"><i style="background:var(--' +
            (g2.tone || (k === 0 ? 'accent' : k === 1 ? 'accent2' : 'muted')) + ')"></i>' +
            '<span class="ll">' + fmt(g2.label || '') + '</span>' +
            '<span class="lv">' + esc(g2.value) + (sc.unit ? esc(sc.unit) : '') + '</span></div>';
        }).join('') + '</div>';
        steps = gs.length;
      } else {
        /* 기본 — 전체 중 채워진 만큼 */
        var total1 = Math.max(1, Math.min(200, sc.total || 100));
        var filled1 = Math.max(0, Math.min(total1, sc.filled || 0));
        var cells1 = [];
        for (var j = 0; j < total1; j++) {
          var fr = (j === Math.floor(filled1) && filled1 % 1) ? filled1 % 1 : null;
          var lit1 = j < Math.floor(filled1) || fr != null;
          cells1.push(cell(base, lit1 ? 0 : 99, j, lit1 ? (sc.tone || 'accent') : null,
            j < Math.floor(filled1) ? null : fr));
        }
        var ratio = Math.round(filled1 / total1 * 100);
        body = '<div class="picwrap rv" data-at="0">' + grid(cells1, colsFor(total1), sc.chunk) +
          '<div class="pside"><div class="pv">' + (Math.round(filled1 * 10) / 10) +
          '<span class="pu">/' + total1 + '</span></div>' +
          '<div class="pl">' + (sc.label ? fmt(sc.label) : ratio + '%') + '</div></div></div>';
        steps = 1;
      }

      return head(sc) + '<div class="picscene" style="--picscale:' + scale + '">' + body + legend + '</div>' +
        (sc.caption ? '<div class="caption rv" data-at="' + steps + '">' + fmt(sc.caption) + '</div>' : '');
    },

    funnel: function (sc) {
      var items = sc.items || [];
      var max = sc.max || Math.max.apply(null, items.map(function (it) { return +it.value || 0; }).concat([1]));
      var port = PORT();
      var W = 1000, SW = port ? 520 : 560, SH = port ? 190 : 88, GAP = port ? 16 : 10;
      var H = items.length * (SH + GAP);
      var tone = ['accent', 'accent2'];
      /* 폭을 값에 그대로 비례시키면 뒤 단계가 실오라기가 된다.
         모양은 흐름을 보여주는 것이고 정확한 값은 옆의 숫자가 말한다. */
      function w(v) {
        var r = (+v || 0) / max;
        return SW * (sc.scale === 'linear' ? r : 0.34 + 0.66 * r);
      }
      var stages = items.map(function (it, i) {
        var w0 = w(it.value), nx = items[i + 1] ? w(items[i + 1].value) : w0 * 0.86;
        var y = i * (SH + GAP), cx = SW / 2;
        var pts = [
          [cx - w0 / 2, y], [cx + w0 / 2, y], [cx + nx / 2, y + SH], [cx - nx / 2, y + SH]
        ].map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
        var col = 'var(--' + (it.tone || tone[i % 2]) + ')';
        var prev = items[i - 1];
        var drop = (prev && sc.drop !== false && +prev.value)
          ? Math.round((1 - (+it.value || 0) / (+prev.value)) * 100) : null;
        return '<g class="fst rv" data-at="' + i + '">' +
          '<polygon points="' + pts + '" fill="' + col + '" opacity="' + (0.95 - i * 0.12).toFixed(2) + '"/>' +
          '<text class="fl" x="' + (SW + 60) + '" y="' + (y + SH * 0.44) + '">' + esc(it.label || '') + '</text>' +
          '<text class="fv" x="' + (SW + 60) + '" y="' + (y + SH * 0.86) + '">' +
          esc(it.value) + (sc.unit ? esc(sc.unit) : '') + (it.note ? '   ' + esc(it.note) : '') + '</text>' +
          (drop != null ? '<text class="fd" x="' + (W - 4) + '" y="' + (y + SH * 0.62) + '" text-anchor="end">▼ ' + drop + '%</text>' : '') +
          '</g>';
      }).join('');
      return head(sc) + '<div class="funnel"><svg viewBox="0 0 ' + W + ' ' + H + '">' + stages + '</svg></div>' +
        (sc.caption ? '<div class="caption rv" data-at="' + items.length + '">' + fmt(sc.caption) + '</div>' : '');
    },

    matrix: function (sc) {
      var q = sc.quadrants || [];
      var x = sc.xAxis || ['', ''], y = sc.yAxis || ['', ''];
      var tone = ['', 'b', 'c', 'mute'];
      var cells = [0, 1, 2, 3].map(function (i) {
        var it = q[i] || {};
        return '<div class="qd ' + (it.tone || tone[i]) + ' rv" data-at="' + i + '">' +
          (it.icon ? '<div class="qico">' + icon(it.icon) + '</div>' : '') +
          '<div class="qt">' + fmt(txt(it)) + '</div>' +
          (it.note ? '<div class="qn">' + fmt(it.note) + '</div>' : '') + '</div>';
      }).join('');
      return head(sc) + '<div class="matrix">' +
        '<div class="ylab yt">' + esc(y[1] || '') + '</div>' +
        '<div class="ylab yb">' + esc(y[0] || '') + '</div>' +
        '<div class="qgrid">' + cells + '</div>' +
        '<div class="xlabm xl">' + esc(x[0] || '') + '</div>' +
        '<div class="xlabm xr">' + esc(x[1] || '') + '</div></div>';
    },

    raw: function (sc) { return '<div class="raw rv" data-at="0">' + (sc.html || '') + '</div>'; }
  };

  function sceneHTML(b) {
    var sc = b.scene || { type: 'hero', text: '' };
    var fn = R[sc.type] || R.hero;
    var cls = 'scene s-' + sc.type + ' enter-' + (b.transition || 'fade') +
      ' rv-' + (sc.reveal || 'up') + (sc.align === 'center' ? ' mid' : '') +
      (sc.iconStyle ? ' is-' + sc.iconStyle : '') +
      ' comp-' + (sc.composition || 'standard') + ' arc-' + (sc.arc || 'evidence');
    return '<div class="' + cls + '" data-type="' + sc.type + '">' +
      (b.chapter ? '<div class="chapter">' + esc(b.chapter) + '</div>' : '') +
      fn(sc) + '</div>';
  }

  function motifHTML(sc) {
    var base = OPT.motif || {}, local = sc.motif || {};
    if (local === false || !base.type) return '';
    var state = local.state || sc.arc || 'evidence';
    var intensity = local.intensity == null ? (base.intensity == null ? .28 : base.intensity) : local.intensity;
    return '<div class="motif motif-' + esc(local.type || base.type) + ' state-' + esc(state) +
      '" style="--motif-opacity:' + Math.max(0, Math.min(1, intensity)) + '"></div>';
  }

  function sharedRects() {
    var out = {};
    [].slice.call(stage.querySelectorAll('[data-share]')).forEach(function (el) {
      out[el.getAttribute('data-share')] = el.getBoundingClientRect();
    });
    return out;
  }
  function flipShared(old) {
    if (!old || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    [].slice.call(stage.querySelectorAll('[data-share]')).forEach(function (el) {
      var from = old[el.getAttribute('data-share')];
      if (!from || !el.animate) return;
      var to = el.getBoundingClientRect();
      var sx = from.width / Math.max(1, to.width), sy = from.height / Math.max(1, to.height);
      el.animate([
        { transform: 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' + sx + ',' + sy + ')', opacity: .72 },
        { transform: 'none', opacity: 1 }
      ], { duration: 720, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'both' });
    });
  }

  /* ---------- mount / reveal ---------- */
  function mount(bi) {
    var old = sharedRects();
    var b = B[bi], sc = b.scene || {};
    var bg = sc.bg || b.bg || OPT.bg || 'plain';
    var corners = OPT.frame === 'corners'
      ? '<div class="corner tl"></div><div class="corner tr"></div>' +
        '<div class="corner bl"></div><div class="corner br"></div>' : '';
    stage.innerHTML = '<div class="bg bg-' + bg + '"></div>' + motifHTML(sc) +
      (sc.watermark ? '<div class="wm">' + esc(sc.watermark) + '</div>' : '') +
      sceneHTML(b) + '<div class="vig"></div>' + corners +
      (OPT.progress ? '<div class="pbar"><i></i></div>' : '') +
      (st.guides ? guideHTML() : '');
    st.bi = bi; st.si = -1; st.events = {};
    buildPrompter(b);
    requestAnimationFrame(function () { flipShared(old); });
  }

  /* 낭독문을 어절 단위로 깔아둔다. 매 프레임 다시 그리지 않기 위해 한 번만 만든다. */
  function buildPrompter(b) {
    var now = document.querySelector('#prompter .now');
    st.wds = [];
    if (!now) return;
    var ws = b.words || [];
    if (!ws.length) {
      now.innerHTML = b.say ? fmt(b.say) : '<span style="opacity:.4">(낭독문 없음)</span>';
      return;
    }
    var html = '';
    for (var i = 0; i < ws.length; i++) {
      if (ws[i].sp) { html += ' '; continue; }
      html += '<span class="kw" data-a="' + ws[i].a + '" data-b="' + ws[i].b + '">' + esc(ws[i].w) + '</span>';
    }
    now.innerHTML = html;
    st.wds = [].slice.call(now.querySelectorAll('.kw'));
  }

  /** 지금 어디를 읽고 있는지 칠한다. 비트 안에서의 경과 비율만 본다. */
  function paintPrompter(b) {
    if (!st.wds.length) return;
    var frac = b.sec ? (st.clock - b.start) / b.sec : 0;
    if (frac < 0) frac = 0; else if (frac > 0.999) frac = 1;   /* 반올림 오차로 마지막 어절이 남지 않게 */
    for (var i = 0; i < st.wds.length; i++) {
      var e = st.wds[i];
      var a = +e.getAttribute('data-a'), b2 = +e.getAttribute('data-b');
      var cls = frac >= b2 ? 'kw done' : (frac >= a ? 'kw cur' : 'kw');
      if (e.className !== cls) e.className = cls;
      if (frac >= a && frac < b2) {
        e.style.setProperty('--p', ((frac - a) / Math.max(1e-6, b2 - a) * 100).toFixed(1) + '%');
      }
    }
  }
  function paintWordEvents(b) {
    var events = (b.scene && b.scene.wordEvents) || [];
    if (!events.length || !b.sec) return;
    var frac = Math.max(0, Math.min(1, (st.clock - b.start) / b.sec));
    events.forEach(function (ev, i) {
      if (st.events[i]) return;
      var at = ev.at == null ? null : (ev.at <= 1 ? ev.at : ev.at / b.sec);
      if (at == null && ev.word) {
        var needle = String(ev.word).replace(/\s+/g, '');
        for (var w = 0; w < (b.words || []).length; w++) {
          if (String(b.words[w].w || '').replace(/\s+/g, '').indexOf(needle) >= 0) { at = b.words[w].a; break; }
        }
      }
      if (at == null || frac < at) return;
      var target = stage.querySelector('[data-role="' + ev.target + '"]') ||
        stage.querySelector('[data-share="' + ev.target + '"]');
      if (!target) return;
      st.events[i] = 1;
      target.classList.remove('word-hit'); void target.offsetWidth; target.classList.add('word-hit');
      if (ev.hold !== true) setTimeout(function () { target.classList.remove('word-hit'); }, 760);
    });
  }
  function guideHTML() {
    return '<svg class="guides" viewBox="0 0 100 100" preserveAspectRatio="none" ' +
      'style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">' +
      '<rect x="5" y="5" width="90" height="90" fill="none" stroke="#4c8dff" stroke-width=".18" stroke-dasharray="1 1"/>' +
      '<rect x="10" y="10" width="80" height="80" fill="none" stroke="#ff6b9a" stroke-width=".18" stroke-dasharray="1 1"/>' +
      '<line x1="50" y1="0" x2="50" y2="100" stroke="#ffffff40" stroke-width=".1"/>' +
      '<line x1="0" y1="50" x2="100" y2="50" stroke="#ffffff40" stroke-width=".1"/></svg>';
  }
  function setStep(si) {
    if (si === st.si) return;
    st.si = si;
    runFx(B[st.bi], si);
    var els = stage.querySelectorAll('.rv');
    for (var i = 0; i < els.length; i++) {
      var at = +els[i].getAttribute('data-at');
      if (at <= si) {
        if (!els[i].classList.contains('in')) { els[i].classList.add('in'); animate(els[i]); }
      } else els[i].classList.remove('in');
    }
    var pcs = stage.querySelectorAll('.pc[data-g]');
    for (var p2 = 0; p2 < pcs.length; p2++) {
      var g2 = +pcs[p2].getAttribute('data-g');
      pcs[p2].classList.toggle('lit', g2 <= si && g2 !== 99);
    }
    var nodes = stage.querySelectorAll('.fnode');
    for (var j = 0; j < nodes.length; j++) nodes[j].classList.toggle('on', j === si);
    paint();
  }
  function animate(el) {
    /* 도넛 조각: 길이 0 -> 실제 길이 */
    if (el.classList && el.classList.contains('seg')) {
      var C = 2 * Math.PI * 42;
      var len = parseFloat(el.getAttribute('data-len')) || 0;
      setTimeout(function () { el.setAttribute('stroke-dasharray', len + ' ' + (C - len)); }, 30);
    }
    /* 꺾은선: 획을 왼쪽부터 그려 나간다 */
    var lps = el.querySelectorAll ? el.querySelectorAll('.lp') : [];
    for (var q = 0; q < lps.length; q++) {
      (function (lp) {
        var L = lp.getTotalLength ? lp.getTotalLength() : 0;
        if (!L) return;
        lp.style.transition = 'none';
        lp.style.strokeDasharray = L + ' ' + L;
        lp.style.strokeDashoffset = L;
        requestAnimationFrame(function () {
          lp.style.transition = 'stroke-dashoffset var(--d-data) var(--ez)';
          lp.style.strokeDashoffset = '0';
        });
      })(lps[q]);
    }
    var fills = el.querySelectorAll ? el.querySelectorAll('.fill') : [];
    for (var i = 0; i < fills.length; i++) {
      (function (f) { setTimeout(function () { f.style.width = f.getAttribute('data-w') + '%'; }, 40); })(fills[i]);
    }
    var nums = el.querySelectorAll ? el.querySelectorAll('.num') : [];
    for (var k = 0; k < nums.length; k++) countUp(nums[k]);
  }
  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-to'));
    var raw = el.getAttribute('data-raw') || String(to);
    var dec = (raw.split('.')[1] || '').length;
    var comma = raw.indexOf(',') >= 0;
    var t0 = performance.now(), dur = 900;
    function frame(t) {
      var p = Math.min(1, (t - t0) / dur);
      var v = to * (1 - Math.pow(1 - p, 3));
      var s = dec ? v.toFixed(dec) : String(Math.round(v));
      if (comma) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      el.textContent = s;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- clock ---------- */
  function stepFor(b, t) {
    var s = 0;
    for (var i = 0; i < b.stepAt.length; i++) if (t >= b.stepAt[i]) s = i;
    return s;
  }
  function beatAt(t) {
    for (var i = 0; i < B.length; i++) if (t < B[i].end) return i;
    return B.length - 1;
  }
  function goto(bi, si, keepClock) {
    bi = Math.max(0, Math.min(B.length - 1, bi));
    var b = B[bi];
    si = Math.max(0, Math.min(b.steps - 1, si));
    if (bi !== st.bi) mount(bi);
    setStep(si);
    if (!keepClock) { st.clock = b.start + (b.stepAt[si] || 0); syncAudio(); }
    paint();
  }
  function next() {
    var b = B[st.bi];
    if (st.si + 1 < b.steps) goto(st.bi, st.si + 1);
    else if (st.bi + 1 < B.length) goto(st.bi + 1, 0);
  }
  function prev() {
    if (st.si > 0) goto(st.bi, st.si - 1);
    else if (st.bi > 0) goto(st.bi - 1, B[st.bi - 1].steps - 1);
  }
  function tick(ts) {
    if (st.playing) {
      var total = B[B.length - 1].end;
      if (audioLead) {
        /* 음성이 시계다. 화면이 음성보다 짧으면 마지막 비트에 머무르고 소리는 끝까지 간다. */
        st.clock = Math.min(total, Math.max(0, aud.currentTime - (AU.offset || 0)));
        if (aud.ended || aud.paused) play(false);
      } else {
        var dt = st.last ? (ts - st.last) / 1000 : 0;
        st.clock += dt;
        if (st.clock >= total) { st.clock = total; play(false); }
      }
      var bi = beatAt(st.clock);
      if (bi !== st.bi) mount(bi);
      setStep(stepFor(B[bi], st.clock - B[bi].start));
      paint();
    }
    else if (st.pace) {
      var dtp = st.last ? (ts - st.last) / 1000 : 0;
      var bp = B[st.bi];
      st.clock = Math.min(bp.end, st.clock + dtp);
      setStep(stepFor(bp, st.clock - bp.start));
      paint();
    }
    st.last = ts;
    requestAnimationFrame(tick);
  }
  function play(on) {
    st.playing = on == null ? !st.playing : on;
    if (st.playing) st.pace = false;
    if (AU) {
      if (st.playing) {
        killGate();
        syncAudio();
        audioLead = AU.master !== false;
        var pr = aud.play();
        if (audioLead) watchAudioClock();
        if (pr && pr.catch) pr.catch(function () {
          audioLead = false;                 // 브라우저가 막았다 — 화면만 굴린다
          toast('브라우저가 소리를 막았다 — 화면을 한 번 누르고 P 를 다시');
        });
      } else { clearTimeout(watchdog); aud.pause(); audioLead = false; }
    }
    var pb3 = document.getElementById('btn-pace');
    if (pb3) pb3.classList.toggle('on', st.pace);
    var btn = document.getElementById('play');
    if (btn) { btn.textContent = st.playing ? '❚❚ 일시정지' : '▶ 재생'; btn.classList.toggle('on', st.playing); }
  }

  /* ---------- chrome ---------- */
  function fmtT(s) {
    s = Math.max(0, Math.round(s));
    return (s / 60 | 0) + ':' + ('0' + (s % 60)).slice(-2);
  }
  function paint() {
    var b = B[st.bi] || B[0], total = B[B.length - 1].end;
    var el = document.getElementById('time');
    if (el) el.textContent = fmtT(st.clock) + ' / ' + fmtT(total);
    var cnt = document.getElementById('cnt');
    if (cnt) cnt.textContent = '비트 ' + (st.bi + 1) + '/' + B.length + ' · 스텝 ' + (st.si + 1) + '/' + b.steps;
    var f = document.querySelector('#seek i');
    if (f) f.style.width = (st.clock / total * 100) + '%';
    var pb2 = stage.querySelector('.pbar i');
    if (pb2) pb2.style.width = (st.clock / total * 100) + '%';
    paintPrompter(b);
    paintWordEvents(b);
    ccPaint();
    var side = document.getElementById('side');
    if (side) {
      var nx = B[st.bi + 1];
      side.innerHTML = '<div class="cd">' + fmtT(Math.max(0, b.end - st.clock)) + '</div>' +
        '<b>이 비트</b>' + esc(b.scene.type) + ' · ' + b.sec + '초' + (b.estimated ? ' (추정)' : '') +
        (b.note ? '<div class="note">✎ ' + esc(b.note) + '</div>' : '') +
        '<b style="margin-top:10px">다음</b>' + (nx ? esc((nx.say || nx.scene.type).slice(0, 60)) : '— 끝 —');
    }
    if (!(window.frameElement && window.frameElement.hasAttribute('srcdoc')))
      location.replace('#b' + (st.bi + 1) + '.' + (st.si + 1));
  }
  function fitStage() {
    var r = board.getBoundingClientRect();
    var w = parseFloat(getComputedStyle(stage).width), h = parseFloat(getComputedStyle(stage).height);
    var k = Math.min(r.width / w, r.height / h);
    stage.style.transform = 'translate(-50%,-50%) scale(' + k + ')';
  }
  function toast(msg) {
    if (CAPTURE) return;
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t.__h); t.__h = setTimeout(function () { t.classList.remove('on'); }, 1400);
  }

  /* ---------- wiring ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey) return;
    var k = e.key;
    if (e.shiftKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
      e.preventDefault();
      var pp = document.getElementById('prompter');
      if (!pp) return;                       /* 발표용에는 프롬프터가 없다 */
      var cur = parseFloat(getComputedStyle(pp).getPropertyValue('--psize')) || 26;
      pp.style.setProperty('--psize', Math.max(16, Math.min(64, cur + (k === 'ArrowUp' ? 4 : -4))) + 'px');
      return;
    }
    if (k === ' ' || k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); play(false); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); play(false); prev(); }
    else if (k === 'ArrowDown') { e.preventDefault(); play(false); goto(st.bi + 1, 0); }
    else if (k === 'ArrowUp') { e.preventDefault(); play(false); goto(st.bi - 1, 0); }
    else if (k === 'p' || k === 'P') { play(); }
    else if (k === 'l' || k === 'L') {
      st.pace = !st.pace;
      if (st.pace) play(false);
      var pbtn = document.getElementById('btn-pace');
      if (pbtn) pbtn.classList.toggle('on', st.pace);
      toast(st.pace ? '낭독 페이스: 켜짐 — 장면은 그대로, 대본 위치만 흐른다' : '낭독 페이스: 꺼짐');
    }
    else if (k === 'r' || k === 'R') { st.clock = 0; goto(0, 0); }
    else if (k === 'Home') { goto(0, 0); }
    else if (k === 'End') { goto(B.length - 1, B[B.length - 1].steps - 1); }
    else if (k === 'c' || k === 'C') { document.body.classList.toggle('clean'); setTimeout(fitStage, 30); }
    else if (k === 't' || k === 'T') { togglePrompter(); }
    else if (k === 'f' || k === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }
    else if (k === 'g' || k === 'G') { st.guides = !st.guides; var keep = st.si; mount(st.bi); setStep(keep); }
    else if (k === 'x' || k === 'X') { stage.classList.toggle('chroma'); }
    else if (k === 'S' && e.shiftKey) { ccPanelShow(); }
    else if (k === 's' || k === 'S') {
      if (PRESENT) return;                   /* 발표용에는 자막이 없다 */
      if (!CUES.length) return toast('이 덱에는 자막이 붙어 있지 않다 (--subs 로 넣는다)');
      ccSet(!st.cc);
    }
    else if (k === 'm' || k === 'M') {
      if (!AU) return toast('이 덱에는 음성이 붙어 있지 않다');
      aud.muted = !aud.muted; muteBtn(); toast(aud.muted ? '소리 끔' : '소리 켬');
    }
    else if (k === 'k' || k === 'K') {
      navigator.clipboard.writeText(D.timing).then(function () { toast('타이밍 시트를 클립보드에 복사했다'); });
    }
    else if (k === 'o' || k === 'O') { ovShow(); }
    else if (k === 'Escape') { ovShow(false); }
    else if (k === '?' || k === '/') { document.getElementById('help').classList.toggle('on'); }
    else if (/^[0-9]$/.test(k)) { play(false); goto(k === '0' ? 9 : +k - 1, 0); }
  });
  board.addEventListener('click', function (e) {
    if (e.target.closest('#hud') || e.target.closest('#prompter')) return;
    play(false);
    var r = board.getBoundingClientRect();
    if ((e.clientX - r.left) / r.width < 0.2) prev(); else next();
  });
  var seek = document.getElementById('seek');
  if (seek) seek.addEventListener('click', function (e) {
    var r = seek.getBoundingClientRect();
    var t = (e.clientX - r.left) / r.width * B[B.length - 1].end;
    st.clock = t;
    syncAudio();
    var bi = beatAt(t);
    if (bi !== st.bi) mount(bi);
    setStep(stepFor(B[bi], t - B[bi].start));
    paint();
  });
  var pb = document.getElementById('play');
  if (pb) pb.addEventListener('click', function () { play(); });
  function togglePrompter() {
    var p2 = document.getElementById('prompter');
    if (!p2) return;
    var off = p2.style.display === 'none';
    p2.style.display = off ? '' : 'none';
    var b2 = document.getElementById('btn-prompt');
    if (b2) b2.classList.toggle('on', !off);
    setTimeout(fitStage, 30);
  }
  var promptEl = document.getElementById('btn-prompt');
  if (promptEl) promptEl.addEventListener('click', togglePrompter);
  var fullEl = document.getElementById('btn-full');
  if (fullEl) fullEl.addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else (document.documentElement.requestFullscreen || function () { })
      .call(document.documentElement);
  });
  var helpPanel = document.getElementById('help');
  if (helpPanel) helpPanel.addEventListener('click', function () { helpPanel.classList.remove('on'); });
  var helpEl = document.getElementById('btn-help');
  if (helpEl) helpEl.addEventListener('click', function () {
    document.getElementById('help').classList.toggle('on');
  });
  var muteEl = document.getElementById('btn-mute');
  if (muteEl && AU) muteEl.addEventListener('click', function () { aud.muted = !aud.muted; muteBtn(); });
  var gateEl = document.getElementById('sv-gate');
  if (gateEl) gateEl.addEventListener('click', function () { play(true); });
  var paceBtn = document.getElementById('btn-pace');
  if (paceBtn) paceBtn.addEventListener('click', function () {
    st.pace = !st.pace; if (st.pace) play(false);
    paceBtn.classList.toggle('on', st.pace);
  });
  var ccBtn = document.getElementById('btn-cc');
  if (ccBtn) ccBtn.addEventListener('click', function () { ccSet(!st.cc); });
  var ccSetBtn = document.getElementById('btn-ccset');
  if (ccSetBtn) ccSetBtn.addEventListener('click', function () { ccPanelShow(); });
  ['clean', 'guide', 'chroma'].forEach(function (id) {
    var el = document.getElementById('btn-' + id);
    if (!el) return;
    el.addEventListener('click', function () {
      if (id === 'clean') { document.body.classList.toggle('clean'); setTimeout(fitStage, 30); }
      if (id === 'guide') { st.guides = !st.guides; var keep = st.si; mount(st.bi); setStep(keep); }
      if (id === 'chroma') stage.classList.toggle('chroma');
      el.classList.toggle('on');
    });
  });
  window.addEventListener('resize', fitStage);

  /* ---- 발표 모드 --------------------------------------------------- *
   * 같은 덱을 발표에 쓴다. 낭독 시계 대신 사람이 넘긴다 — 자동재생을 끄고,
   * 프롬프터를 걷고, 손을 떼면 UI 가 사라진다.
   * ------------------------------------------------------------------- */
  var PRESENT = !!(D.opt && D.opt.present) || Q.get('present') === '1';
  var idleT = null;

  /** 손을 떼면 커서를 감춘다. 발표용에는 감출 UI 가 애초에 없다. */
  function uiWake() {
    document.body.classList.remove('idle');
    clearTimeout(idleT);
    idleT = setTimeout(function () {
      var o = document.getElementById('ov');
      if (o && o.classList.contains('on')) return;   /* 오버뷰는 처음 열 때 만들어진다 */
      document.body.classList.add('idle');
    }, 2200);
  }

  /* ---- 슬라이드 오버뷰 ---------------------------------------------- *
   * 썸네일은 실제 장면을 그대로 줄인 것이다 — 따로 그리지 않는다.
   * 처음 열 때 한 번 만들고 캐시한다.
   * ------------------------------------------------------------------- */
  var ovEl = null, ovBuilt = false;
  function ovNode() {
    if (ovEl) return ovEl;
    ovEl = document.createElement('div');
    ovEl.id = 'ov';
    ovEl.innerHTML = '<h3>슬라이드 — 눌러서 이동 · Esc 닫기' +
      (PRESENT ? ' · Space 다음 · PageUp/Down 슬라이드 단위 · F 전체화면' : '') +
      '</h3><div class="grid"></div>';
    document.body.appendChild(ovEl);
    ovEl.addEventListener('click', function (e) {
      var f = e.target.closest('figure');
      if (f) { ovShow(false); play(false); goto(+f.dataset.i, 0); }
      else if (e.target === ovEl) ovShow(false);
    });
    return ovEl;
  }
  function ovBuild() {
    if (ovBuilt) return;
    var grid = ovNode().querySelector('.grid');
    var W = parseFloat(getComputedStyle(stage).width);
    var H = parseFloat(getComputedStyle(stage).height);
    var port = stage.classList.contains('p916');
    var TW = port ? 150 : 248, k = TW / W;
    grid.style.gridTemplateColumns = 'repeat(auto-fill,' + TW + 'px)';
    var html = '';
    for (var i = 0; i < B.length; i++) {
      var b = B[i], sc = b.scene || {};
      var bg = sc.bg || b.bg || OPT.bg || 'plain';
      var label = (b.say || '').trim() || sc.text || sc.title || sc.type;
      html += '<figure data-i="' + i + '">' +
        '<div class="shot" style="height:' + Math.round(H * k) + 'px">' +
        '<div class="mini' + (port ? ' p916' : '') + '" style="transform:scale(' + k + ')">' +
        '<div class="bg bg-' + bg + '"></div>' + sceneHTML(b) + '<div class="vig"></div>' +
        '</div></div>' +
        '<figcaption><b>' + (i + 1) + '</b><span>' + esc(String(label).slice(0, 40)) + '</span></figcaption>' +
        '</figure>';
    }
    grid.innerHTML = html;
    /* 썸네일은 모든 스텝이 끝난 상태로 보여준다 */
    var rv = grid.querySelectorAll('.rv');
    for (var j = 0; j < rv.length; j++) rv[j].classList.add('in');
    var pcs = grid.querySelectorAll('.pc[data-g]');
    for (var q = 0; q < pcs.length; q++) {
      if (+pcs[q].getAttribute('data-g') !== 99) pcs[q].classList.add('lit');
    }
    ovBuilt = true;
  }
  function ovShow(on) {
    var el = ovNode();
    var want = on == null ? !el.classList.contains('on') : !!on;
    if (want) {
      ovBuild();
      var cur = el.querySelector('figure.cur');
      if (cur) cur.classList.remove('cur');
      var now = el.querySelector('figure[data-i="' + st.bi + '"]');
      if (now) { now.classList.add('cur'); now.scrollIntoView({ block: 'nearest' }); }
      play(false);
    }
    el.classList.toggle('on', want);
    if (PRESENT) uiWake();
  }

  /* 캡처 도구용 API — shots.js 가 이걸로 컷을 하나씩 세운다 */
  window.SVAPI = {
    stops: (function () {
      var out = [];
      B.forEach(function (b, i) { for (var s = 0; s < b.steps; s++) out.push([i, s]); });
      return out;
    })(),
    beats: B.length,
    total: B[B.length - 1].end,
    goto: function (bi, si) { killGate(); play(false); goto(bi, si); return B[bi].id + '.' + (si + 1); },
    clean: function (on) { killGate(); document.body.classList.toggle('clean', on !== false); fitStage(); },
    audio: AU ? { offset: AU.offset || 0, duration: function () { return aud.duration; } } : null,
    mute: function (on) { if (AU) { aud.muted = on !== false; muteBtn(); } },
    /** 화면 자막 켜기·끄기. 자막이 없으면 false 를 돌려준다 */
    captions: function (on) {
      if (!CUES.length) return false;
      ccSet(on !== false);
      return st.cc;
    },
    cueCount: CUES.length,
    /** 자막 스타일을 재생 중에 바꾼다 — SVAPI.captionStyle({size:46, opacity:.4}) */
    captionStyle: function (patch) { return CUES.length ? ccApply(patch) : false; },
    /** 이펙트 미리보기 — SVAPI.fx('burst') · SVAPI.fx({kind:'picto', icon:'하트'}) */
    fx: function (f) {
      if (!FXON) return 'fx off (mo.js 미탑재 · ?fx=0 · 동작 줄이기)';
      if (typeof f === 'string') f = { kind: f };
      fire(f || { kind: 'burst' }, B[st.bi]);
      return f.kind;
    },
    fxKinds: Object.keys({ burst: 1, ripple: 1, impact: 1, pop: 1, sparkle: 1, confetti: 1, rise: 1, picto: 1 })
  };

  /* 시작 */
  if (PRESENT) {
    document.body.classList.add('present');
    ['mousemove', 'keydown', 'click'].forEach(function (ev) {
      document.addEventListener(ev, uiWake, { passive: true });
    });
    uiWake();
  }
  var ovBtn = document.getElementById('btn-ov');
  if (ovBtn) ovBtn.addEventListener('click', function () { ovShow(); });
  ccInit();
  if (CAPTURE) { document.body.classList.add('clean'); killGate(); }
  if (Q.get('chroma') === '1') stage.classList.add('chroma');
  if (AU) muteBtn();
  /* 좁은 화면에서 대본을 접을지 — 화면 크기가 아니라 '접으면 무대가 실제로 커지는가'로 정한다.
   * 폰 세로에 16:9 를 넣으면 폭이 병목이라 접어봐야 여백만 늘고, 9:16 이나 눕힌 폰은
   * 높이가 병목이라 접는 만큼 무대가 커진다. 15% 넘게 커질 때만 접고 시작한다. */
  if (!CAPTURE && innerWidth <= 900) {
    var p0 = document.getElementById('prompter');
    var rb = board.getBoundingClientRect();
    var ph = p0 ? p0.getBoundingClientRect().height : 0;
    var sw = parseFloat(getComputedStyle(stage).width), sh = parseFloat(getComputedStyle(stage).height);
    var now = Math.min(rb.width / sw, rb.height / sh);
    var folded = Math.min(rb.width / sw, (rb.height + ph) / sh);
    if (p0 && ph && folded > now * 1.15) {
      p0.style.display = 'none';
      var pb0 = document.getElementById('btn-prompt');
      if (pb0) pb0.classList.add('on');
    }
  }
  var m = (location.hash || '').match(/^#b(\d+)(?:\.(\d+))?/);
  fitStage();
  goto(m ? +m[1] - 1 : 0, m && m[2] ? +m[2] - 1 : 0);
  requestAnimationFrame(tick);
  /* 음성이 붙어 있으면 브라우저가 소리 없는 자동 재생만 허용한다 —
   * 시작판을 눌러 시작한다. 캡처 도구(?clean=1)는 소리 없이 바로 굴린다. */
  if (OPT.autoplay && !document.getElementById('sv-gate')) play(true);
}


/* ------------------------------------------------------------------ *
 * build — 단일 HTML
 * ------------------------------------------------------------------ */

var HELP = [
  'Space / →   다음 스텝',
  '←           이전 스텝',
  '↓ ↑         다음 / 이전 비트',
  'P           자동 재생 토글',
  'L           낭독 페이스 (장면은 그대로, 대본 위치만 흐름)',
  'Shift+↑↓    프롬프터 글자 크기',
  'R           처음으로 · 0-9 비트 점프',
  'C           클린 모드 (UI 숨김)',
  'T           프롬프터 접기 · G 안전영역 · S 자막 · Shift+S 자막 설정',
  'O / Esc     슬라이드 오버뷰 열기 / 닫기 · PageUp·PageDown 슬라이드 단위 이동',
  'X           크로마키 배경 · F 전체화면',
  'M           소리 끄기 / 켜기 (음성을 붙였을 때)',
  'K           타이밍 시트 복사',
  '',
  '폰·태블릿에서는 키보드 대신 아래 버튼으로 — 무대를 누르면 다음,',
  '왼쪽 끝을 누르면 이전. 대본은 접힌 채로 시작한다.'
].join('\n');

/* ------------------------------------------------------------------ *
 * 모션 프리셋
 *
 * 값은 전부 CSS 변수로 나가고, CSS 는 하드코딩된 숫자를 갖지 않는다.
 *
 * apple — 초반에 빠르게 튀어나오고 끝을 길게 눌러 감속한다(0.32,0.72,0,1).
 *   애플 UI 의 그 "쫀득한" 느낌은 오버슈트가 아니라 **긴 감속**에서 나온다.
 *   그래서 이동거리는 오히려 줄이고(26px -> 16px), 시간은 늘리고(.46s -> .74s),
 *   대신 scale 을 살짝 얹어(.965 -> 1) 물체가 다가오는 느낌을 준다.
 *   튀는 건 픽토그램 칸처럼 작은 것에만, 아주 약하게.
 *
 * plain — 예전 값. 빠르고 담백하다.
 * ------------------------------------------------------------------ */
var MOTIONS = {
  apple: {
    ez: 'cubic-bezier(.32,.72,0,1)',       /* 주 감속 — 긴 꼬리 */
    ezPop: 'cubic-bezier(.34,1.4,.5,1)',   /* 약한 오버슈트 */
    ezWipe: 'cubic-bezier(.5,.05,.15,1)',
    dRv: '.74s',        /* 요소 등장 — 위치·크기가 자리잡는 시간 */
    dFade: '.42s',      /* 불투명도는 더 빨리 끝낸다. 먼저 나타나고 자리를 찾아가는
                           이 시차가 애플식 "쫀득함"의 실체다 — 오버슈트가 아니다.
                           (16px 이동에 오버슈트를 걸면 0.1px 밖에 안 넘어가 체감이 없다) */
    dScene: '.68s',     /* 씬 전환 */
    dOut: '.3s',        /* 씬 퇴장 */
    dData: '1.15s',     /* 막대·도넛·꺾은선 */
    dPc: '.5s',         /* 픽토그램 한 칸 */
    rise: '16px',       /* 요소가 올라오는 거리 */
    sceneRise: '30px',
    rvScale: '.965',
    wdRise: '.26em',    /* 글자 스태거 */
    stagger: 52         /* 글자 간 간격(ms) */
  },
  plain: {
    ez: 'cubic-bezier(.2,.85,.25,1)', ezPop: 'cubic-bezier(.2,1.4,.4,1)',
    ezWipe: 'cubic-bezier(.6,0,.2,1)',
    dRv: '.46s', dFade: '.46s', dScene: '.52s', dOut: '.28s', dData: '.95s', dPc: '.4s',
    rise: '26px', sceneRise: '46px', rvScale: '1', wdRise: '.38em', stagger: 70
  }
};
function getMotion(name) { return MOTIONS[name] || MOTIONS.apple; }
function motionVars(m) {
  return ['--ez:' + m.ez, '--ez-pop:' + m.ezPop, '--ez-wipe:' + m.ezWipe,
    '--d-rv:' + m.dRv, '--d-fade:' + m.dFade, '--d-scene:' + m.dScene, '--d-out:' + m.dOut,
    '--d-data:' + m.dData, '--d-pc:' + m.dPc,
    '--rise:' + m.rise, '--scene-rise:' + m.sceneRise,
    '--rv-scale:' + m.rvScale, '--wd-rise:' + m.wdRise].join(';');
}

/* 자막 기본값. 밝은 테마도 자막 박스는 어둡게 둔다 — 영상 위에 얹히는 물건이라
   화면이 밝든 어둡든 검은 박스에 흰 글자가 가장 안전하다. */
var CC_DEFAULTS = { size: null, color: '#ffffff', bg: '#080a10', opacity: 0.72 };

function capStyle(spec, opts, aspect) {
  var c = (spec && spec.caption) || {};
  var o = opts || {};
  function pick(a, b, d) { return a != null ? a : (b != null ? b : d); }
  return {
    size: num(pick(o.ccSize, c.size, o.captionSize), aspect === '9:16' ? 46 : 38),
    color: String(pick(o.ccColor, c.color, CC_DEFAULTS.color)),
    bg: String(pick(o.ccBg, c.bg, CC_DEFAULTS.bg)),
    opacity: clamp01(num(pick(o.ccOpacity, c.opacity, CC_DEFAULTS.opacity), CC_DEFAULTS.opacity))
  };
}
function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

function themeVars(theme, chroma) {
  return [
    '--font:' + theme.font, '--display:' + theme.display,
    '--bg:' + theme.bg, '--bg2:' + (theme.bg2 || theme.bg), '--ink:' + theme.ink,
    '--muted:' + theme.muted, '--accent:' + theme.accent, '--accent2:' + theme.accent2,
    '--panel:' + theme.panel, '--line:' + theme.line, '--chroma:' + (chroma || '#00B140')
  ].join(';');
}

/** fx 가 쓰였을 때만 mo.js 를 인라인한다 — 안 쓰면 산출물은 예전과 똑같다 */
function fxTag(spec, opts) {
  if (!specUsesFx(spec)) return '';
  if (opts && opts.fxCdn) {
    return '<scr' + 'ipt src="https://cdn.jsdelivr.net/npm/@mojs/core@1.7.1/dist/mo.umd.js"></' + 'script>\n';
  }
  var src = opts && opts.mojsSource;
  if (!src) {
    try {
      var fs = require('fs'), path = require('path');
      src = fs.readFileSync(path.join(__dirname, 'mojs.core.js'), 'utf8');
    } catch (e) {
      return '<scr' + 'ipt src="https://cdn.jsdelivr.net/npm/@mojs/core@1.7.1/dist/mo.umd.js"></' + 'script>\n';
    }
  }
  return '<scr' + 'ipt>' + src + '</' + 'script>\n';
}

function ccVars(cs) {
  return ['--cc-size:' + cs.size + 'px', '--cc-color:' + cs.color,
          '--cc-bg:' + cs.bg, '--cc-opacity:' + cs.opacity].join(';');
}

function toHTML(spec, opts) {
  opts = opts || {};
  if (typeof spec !== 'object' || spec == null) throw new Error('scriptviz: spec must be an object');
  var ad = artDirection(spec, opts), pack = ad.pack || {};
  var theme = getTheme(opts.theme || spec.theme || pack.theme);
  var aspect = opts.aspect || (spec.aspect === '9:16' ? '9:16' : '16:9');
  var n = normalize(spec);
  if (!n.beats.length) throw new Error('scriptviz: spec.beats 가 비어 있다');
  /* 발표용이면 영상용 장치(HUD·프롬프터·도움말·자막)를 아예 조립하지 않는다 */
  var PRES = !!(opts.present || spec.present);
  var mo = getMotion(opts.motion || spec.motion || pack.motion);
  var cs = capStyle(spec, opts, aspect);

  var title = spec.title || 'scriptviz';
  var imports = (theme.imports || []).map(function (u) {
    return '<link rel="stylesheet" href="' + esc(u) + '">';
  }).join('\n');

  var ticks = n.beats.map(function (b) {
    return '<u style="left:' + (b.start / n.total * 100) + '%"></u>';
  }).join('');

  var au = audioSpec(spec);

  var hud = PRES ? '' :
    '<div id="hud">' +
    '<button id="play">▶ 재생</button>' +
    '<span class="t" id="time">0:00 / 0:00</span>' +
    '<div id="seek"><i></i>' + ticks + '</div>' +
    '<span class="t" id="cnt"></span>' +
    '<span class="sp"></span>' +
    '<button id="btn-pace" class="pace prod" title="낭독 페이스">낭독<i>L</i></button>' +
    '<button id="btn-prompt" title="대본 접기">대본<i>T</i></button>' +
    '<button id="btn-clean">클린<i>C</i></button>' +
    '<button id="btn-ov" title="슬라이드 오버뷰">슬라이드<i>O</i></button>' +
    (arr(spec.captions).length
      ? '<button id="btn-cc" class="prod">자막<i>S</i></button>' +
        '<button id="btn-ccset" class="prod" title="자막 스타일 (Shift+S)">자막설정</button>' : '') +
    '<button id="btn-guide" class="prod">가이드<i>G</i></button>' +
    '<button id="btn-chroma" class="prod">크로마<i>X</i></button>' +
    (au ? '<button id="btn-mute" class="mute">소리<i>M</i></button>' : '') +
    '<button id="btn-full" title="전체화면">전체<i>F</i></button>' +
    '<button id="btn-help" title="도움말">?</button>' +
    '</div>';

  var prompter = (opts.prompter === false || PRES) ? '' :
    '<div id="prompter"><div class="now"></div><div class="side" id="side"></div></div>';

  var data = {
    beats: n.beats,
    fxFocus: specUsesFx(spec) ? FX_FOCUS : null,
    /* 발표에는 자막이 없다 — 큐를 아예 싣지 않으면 런타임의 자막 기능이 통째로 잠든다 */
    captions: (!PRES && arr(spec.captions).length) ? arr(spec.captions) : null,
    opt: {
      present: !!(opts.present || spec.present),
      /* 자막 파일을 함께 넣으면 화면 자막을 기본으로 켠다. 끄려면 captions:false */
      captions: PRES ? false
        : (opts.captions != null ? opts.captions !== false : spec.captions !== false),
      cc: cs,
      stagger: mo.stagger,
      /* 발표에서는 사람이 넘긴다 — 자동재생은 명시할 때만 */
      autoplay: (opts.present || spec.present) ? !!opts.autoplay : !!(opts.autoplay || spec.autoplay),
      bg: opts.bg || spec.bg || 'plain',
      frame: opts.frame || spec.frame || null,
      progress: !!(opts.progress || spec.progress),
      motif: spec.motif || (pack.motif ? { type: pack.motif, intensity: .28 } : null),
      imageTreatment: pack.imageTreatment || 'natural',
      audio: au ? { offset: au.offset, volume: au.volume, master: au.master } : null
    },
    timing: toTimingCSV(spec)
  };

  /* 음성은 <audio> 로 붙인다. 재생하면 이쪽이 시계를 잡는다.
   * 자동 재생은 브라우저가 소리를 막으므로 한 번 누를 시작판을 함께 낸다. */
  var audioEl = au ? '<audio id="sv-audio" preload="auto" src="' + esc(au.src) + '"></audio>' : '';
  var gate = (au && data.opt.autoplay)
    ? '<div id="sv-gate"><b>▶ 소리와 함께 재생<small>브라우저가 자동 재생 소리를 막는다 — 한 번 누르면 시작</small></b></div>'
    : '';

  var body =
    '<div id="app">' +
    '<div id="board"><div id="stage" class="' + (theme.mood === 'light' ? 'light' : 'dark') +
      (aspect === '9:16' ? ' p916' : '') + (ad.name ? ' ad-' + ad.name : '') +
      (pack.density ? ' density-' + pack.density : '') + (pack.geometry ? ' geometry-' + pack.geometry : '') +
      (pack.surface ? ' surface-' + pack.surface : '') + '"></div></div>' +
    prompter + hud + '</div>' +
    audioEl + gate +
    '<div id="toast"></div>' + (PRES ? '' : '<div id="help">' + esc(HELP) + '</div>') + '\n' +
    fxTag(spec, opts) +
    '<scr' + 'ipt>window.__SV__=' + JSON.stringify(data).replace(/</g, '\\u003c') + ';</' + 'script>\n' +
    '<scr' + 'ipt>(' + SVRuntime.toString() + ')();</' + 'script>\n';

  return '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n' + imports + '\n' +
    '<style>\n:root{' + themeVars(theme, opts.chroma || spec.chroma) +
    ';' + ccVars(cs) + ';' + motionVars(mo) + '}\n' +
    RUNTIME_CSS + SCALE_CSS + CHROME_CSS + (spec.css || '') + '\n</style>\n' +
    '</head>\n<body' + (opts.clean ? ' class="clean"' : '') + '>\n' + body + '</body>\n</html>\n';
}

function toStyleFramesHTML(spec, directions) {
  var dirs = directions && directions.length ? directions :
    ['editorial-documentary', 'broadcast-data', 'kinetic-brutalist'];
  var beats = arr(spec.beats), graphic = -1;
  for (var i = 0; i < beats.length; i++) {
    var t = beats[i] && beats[i].scene && beats[i].scene.type;
    if (['stat', 'bars', 'line', 'donut', 'pictograph', 'funnel', 'matrix'].indexOf(t) >= 0) { graphic = i; break; }
  }
  var picks = [0, graphic >= 0 ? graphic : Math.floor(beats.length / 2), Math.max(0, beats.length - 1)]
    .filter(function (v, i, a) { return v >= 0 && a.indexOf(v) === i; });
  function attr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
  var cells = '';
  dirs.forEach(function (name) {
    var directed = direct(spec, { artDirection: name }).spec;
    picks.forEach(function (bi) {
      var one = JSON.parse(JSON.stringify(directed));
      var beat = one.beats[bi];
      delete beat.at; delete beat.words; beat.sec = 4;
      one.beats = [beat]; one.audio = null; one.captions = null; one.autoplay = false;
      var frame = toHTML(one, { present: true, clean: true, artDirection: name });
      cells += '<figure><iframe loading="lazy" srcdoc="' + attr(frame) + '"></iframe>' +
        '<figcaption><b>' + esc(name) + '</b><span>비트 ' + (bi + 1) + ' · ' +
        esc((beat.scene && beat.scene.type) || 'hero') + '</span></figcaption></figure>';
    });
  });
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>scriptviz style frames</title><style>*{box-sizing:border-box}body{margin:0;background:#0a0b0f;color:#eef2ff;font:14px system-ui;padding:28px}' +
    'h1{font-size:18px;margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(3,minmax(280px,1fr));gap:18px}' +
    'figure{margin:0;background:#12141b;border:1px solid #2b2e3a;border-radius:12px;overflow:hidden}iframe{display:block;width:100%;aspect-ratio:16/9;border:0;background:#000}' +
    'figcaption{padding:10px 12px;display:flex;justify-content:space-between;gap:10px}figcaption span{color:#8e94a8}@media(max-width:900px){.grid{grid-template-columns:1fr}}</style></head>' +
    '<body><h1>아트디렉션 스타일 프레임</h1><div class="grid">' + cells + '</div></body></html>';
}


  return {
    version: VERSION,
    toHTML: toHTML,
    toStyleFramesHTML: toStyleFramesHTML,
    direct: direct,
    validate: validate,
    normalize: normalize,
    fromScript: fromScript,
    fromSubtitles: fromSubtitles,
    parseSubtitles: parseSubtitles,
    applySubtitles: applySubtitles,
    toTimingCSV: toTimingCSV,
    inlineAssets: inlineAssets,
    scanImages: scanImages,
    imageSize: imageSize,
    estimateSeconds: estimateSeconds,
    get themes() { return Object.keys(THEMES); },
    get artDirections() { return Object.keys(ART_DIRECTIONS); },
    compositions: function (type) { return (COMPOSITIONS[type] || []).slice(); },
    get scenes() { return Object.keys(SCENES); },
    get fx() { return Object.keys(FX_KINDS); },
    get motions() { return Object.keys(MOTIONS); },
    get icons() { return Object.keys(iconIndex().names).sort(); },
    iconAliases: function () {
      var a = iconIndex().alias, m = {};
      Object.keys(a).forEach(function (k) { (m[a[k]] = m[a[k]] || []).push(k); });
      return m;
    },
    findIcons: function (q) {
      var ix = iconIndex();
      if (!q) return Object.keys(ix.names).sort();
      var n = String(q).toLowerCase(), hit = {};
      Object.keys(ix.names).forEach(function (k) { if (k.toLowerCase().indexOf(n) >= 0) hit[k] = 1; });
      Object.keys(ix.alias).forEach(function (k) { if (k.toLowerCase().indexOf(n) >= 0) hit[ix.alias[k]] = 1; });
      return Object.keys(hit).sort();
    },
    fxKinds: FX_KINDS,
    _internal: { THEMES: THEMES, ART_DIRECTIONS: ART_DIRECTIONS, COMPOSITIONS: COMPOSITIONS, SCENES: SCENES, tc: tc, lenWarn: lenWarn }
  };
}));
