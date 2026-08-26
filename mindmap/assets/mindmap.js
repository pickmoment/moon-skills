/*!
 * mindmap v0.1.0 — declarative JSON -> mind map (SVG + interactive HTML)
 * Standalone. No runtime dependencies. Themes match the `visualthink` skill.
 * MIT License.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.MM = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

var VERSION = '0.1.0';

/* ------------------------------------------------------------------ *
 * util
 * ------------------------------------------------------------------ */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashCode(str) {
  var h = 2166136261, s = String(str);
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeRng(seed) { return mulberry32(hashCode(seed == null ? 'mindmap' : seed)); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function attrStr(attrs) {
  var out = '';
  for (var k in attrs) {
    if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
    var v = attrs[k];
    if (v == null || v === false) continue;
    out += ' ' + k + '="' + esc(v) + '"';
  }
  return out;
}
function el(tag, attrs, inner) {
  var open = '<' + tag + attrStr(attrs);
  return inner == null || inner === '' ? open + '/>' : open + '>' + inner + '</' + tag + '>';
}
function g(attrs, inner) { return el('g', attrs, inner || ''); }
function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function r2(n) { return Math.round(n * 100) / 100; }
function arr(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
function assign(t) {
  for (var i = 1; i < arguments.length; i++) {
    var s = arguments[i]; if (!s) continue;
    for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k];
  }
  return t;
}

/* ---- text metrics (same model as visualthink, so labels wrap alike) ---- */

var NARROW_RE = /[iIl|.,;:'`!\[\](){}\-]/;
var WIDE_RE = /[mwMW@%]/;
var UPPER_RE = /[A-Z]/;
var DIGIT_RE = /[0-9]/;

function charEm(ch) {
  var c = ch.codePointAt(0);
  if ((c >= 0x1100 && c <= 0x11FF) || (c >= 0x2E80 && c <= 0xA4CF) ||
      (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0xF900 && c <= 0xFAFF) ||
      (c >= 0xFE30 && c <= 0xFE4F) || (c >= 0xFF00 && c <= 0xFF60) ||
      (c >= 0xFFE0 && c <= 0xFFE6)) return 1.0;
  if (c > 0xFFFF) return 1.15;
  if (c >= 0x2190 && c <= 0x2BFF) return 1.0;
  if (ch === ' ') return 0.28;
  if (ch === '\t') return 1.12;
  if (NARROW_RE.test(ch)) return 0.30;
  if (WIDE_RE.test(ch)) return 0.86;
  if (UPPER_RE.test(ch)) return 0.63;
  if (DIGIT_RE.test(ch)) return 0.55;
  return 0.52;
}
function measure(str, size, weight, tracking) {
  var s = String(str == null ? '' : str), sum = 0;
  var chars = Array.from(s);
  for (var i = 0; i < chars.length; i++) sum += charEm(chars[i]);
  var bold = (weight === 'bold' || weight === 700 || weight === '700' ||
    weight === 800 || weight === '800' || weight === 900 || weight === '900') ? 1.06 : 1;
  var track = (tracking || 0) * size * Math.max(0, chars.length - 1);
  return sum * size * bold + track;
}
function breakToken(token, maxW, size) {
  var out = [], chars = Array.from(token), cur = '', curW = 0;
  for (var i = 0; i < chars.length; i++) {
    var w = charEm(chars[i]) * size;
    if (cur && curW + w > maxW) { out.push(cur); cur = ''; curW = 0; }
    cur += chars[i]; curW += w;
  }
  if (cur) out.push(cur);
  return out;
}
function wrap(str, maxW, size, weight, tracking) {
  var text = String(str == null ? '' : str);
  if (!text) return [''];
  var lines = [], paras = text.split('\n');
  for (var p = 0; p < paras.length; p++) {
    var words = paras[p].split(/(\s+)/).filter(function (t) { return t !== ''; });
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var word = words[i], isSpace = /^\s+$/.test(word), cand = cur + word;
      if (measure(cand, size, weight, tracking) <= maxW || !cur) {
        if (!cur && !isSpace && measure(word, size, weight, tracking) > maxW) {
          var chunks = breakToken(word, maxW, size);
          for (var k = 0; k < chunks.length - 1; k++) lines.push(chunks[k]);
          cur = chunks[chunks.length - 1];
          continue;
        }
        cur = cand;
      } else { lines.push(cur.replace(/\s+$/, '')); cur = isSpace ? '' : word; }
    }
    lines.push(cur.replace(/\s+$/, ''));
  }
  return lines.length ? lines : [''];
}
function truncateLine(line, maxW, size, weight, tracking) {
  if (measure(line, size, weight, tracking) <= maxW) return line;
  var chars = Array.from(line), ell = '…';
  var ellW = measure(ell, size, weight, tracking), out = '', w = 0;
  for (var i = 0; i < chars.length; i++) {
    var cw = charEm(chars[i]) * size;
    if (w + cw + ellW > maxW) break;
    out += chars[i]; w += cw;
  }
  return out.replace(/\s+$/, '') + ell;
}
function fit(str, maxW, size, opts) {
  opts = opts || {};
  var lh = num(opts.lineHeight, 1.3);
  var minSize = num(opts.minSize, Math.max(9, size * 0.62));
  var maxLines = num(opts.maxLines, Infinity);
  var weight = opts.weight, tracking = opts.tracking || 0, s = size;
  while (true) {
    var lines = wrap(str, maxW, s, weight, tracking);
    if (lines.length <= maxLines || s <= minSize) {
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[lines.length - 1] = truncateLine(lines[lines.length - 1] + '…', maxW, s, weight, tracking);
      }
      return { lines: lines, size: s, tracking: tracking, lineHeight: s * lh, height: lines.length * s * lh };
    }
    s = Math.max(minSize, s - 0.5);
  }
}
function widestLine(lines, size, weight, tracking) {
  var w = 0;
  for (var i = 0; i < lines.length; i++) w = Math.max(w, measure(lines[i], size, weight, tracking));
  return w;
}


/* ------------------------------------------------------------------ *
 * hand-drawn primitives
 *
 * Every shape takes a draw context `o` = { rng, rough, bowing }.
 * `rough: 0` collapses each routine to exact geometry — that is how the
 * flat / editorial / bold themes reuse the same drawing code.
 * ------------------------------------------------------------------ */

function ctxOf(theme, rng) {
  return { rng: rng, rough: theme.roughness, bowing: theme.bowing, sw: theme.strokeWidth };
}
function jit(o, a) { return (o.rng() * 2 - 1) * a; }

function catmull(pts, closed) {
  var p = pts.slice();
  if (closed) p = [pts[pts.length - 1]].concat(pts, [pts[0], pts[1]]);
  else p = [pts[0]].concat(pts, [pts[pts.length - 1]]);
  var d = 'M' + r2(p[1][0]) + ' ' + r2(p[1][1]);
  for (var i = 1; i < p.length - 2; i++) {
    var p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    d += 'C' + r2(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + r2(p1[1] + (p2[1] - p0[1]) / 6) +
         ' ' + r2(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + r2(p2[1] - (p3[1] - p1[1]) / 6) +
         ' ' + r2(p2[0]) + ' ' + r2(p2[1]);
  }
  return d;
}

/** Rounded rectangle, jittered when rough. */
function rRoundRect(x, y, w, h, rad, o) {
  var r = Math.min(rad, w / 2, h / 2);
  if (!o.rough) {
    return 'M' + r2(x + r) + ' ' + r2(y) +
      'h' + r2(w - 2 * r) + 'a' + r2(r) + ' ' + r2(r) + ' 0 0 1 ' + r2(r) + ' ' + r2(r) +
      'v' + r2(h - 2 * r) + 'a' + r2(r) + ' ' + r2(r) + ' 0 0 1 ' + r2(-r) + ' ' + r2(r) +
      'h' + r2(-(w - 2 * r)) + 'a' + r2(r) + ' ' + r2(r) + ' 0 0 1 ' + r2(-r) + ' ' + r2(-r) +
      'v' + r2(-(h - 2 * r)) + 'a' + r2(r) + ' ' + r2(r) + ' 0 0 1 ' + r2(r) + ' ' + r2(-r) + 'z';
  }
  var wob = o.rough * 0.9;
  var pts = [
    [x + r + jit(o, wob), y + jit(o, wob)],
    [x + w * 0.55, y + jit(o, wob)],
    [x + w - r + jit(o, wob), y + jit(o, wob * 0.7)],
    [x + w + jit(o, wob * 0.7), y + r],
    [x + w + jit(o, wob), y + h * 0.55],
    [x + w + jit(o, wob * 0.7), y + h - r],
    [x + w - r, y + h + jit(o, wob)],
    [x + w * 0.45, y + h + jit(o, wob)],
    [x + r, y + h + jit(o, wob * 0.8)],
    [x + jit(o, wob * 0.8), y + h - r],
    [x + jit(o, wob), y + h * 0.45],
    [x + jit(o, wob * 0.8), y + r]
  ];
  return catmull(pts, true) + 'Z';
}

/** Ellipse / blob for the root node. */
function rEllipse(cx, cy, rx, ry, o) {
  if (!o.rough) {
    return 'M' + r2(cx - rx) + ' ' + r2(cy) +
      'a' + r2(rx) + ' ' + r2(ry) + ' 0 1 0 ' + r2(rx * 2) + ' 0' +
      'a' + r2(rx) + ' ' + r2(ry) + ' 0 1 0 ' + r2(-rx * 2) + ' 0z';
  }
  var n = 11, pts = [], wob = o.rough * 1.1;
  for (var i = 0; i < n; i++) {
    var a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * (rx + jit(o, wob)), cy + Math.sin(a) * (ry + jit(o, wob))]);
  }
  return catmull(pts, true) + 'Z';
}

/** A straight-ish line. */
function rLine(x1, y1, x2, y2, o) {
  if (!o.rough) return 'M' + r2(x1) + ' ' + r2(y1) + 'L' + r2(x2) + ' ' + r2(y2);
  var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  var b = Math.min(o.bowing * len * 0.02, 5);
  var mx = (x1 + x2) / 2 + jit(o, b), my = (y1 + y2) / 2 + jit(o, b);
  return 'M' + r2(x1 + jit(o, o.rough * 0.6)) + ' ' + r2(y1 + jit(o, o.rough * 0.6)) +
    'Q' + r2(mx) + ' ' + r2(my) + ' ' + r2(x2 + jit(o, o.rough * 0.6)) + ' ' + r2(y2 + jit(o, o.rough * 0.6));
}

/**
 * Cubic bezier between two anchors. `axis` is the direction the tree grows
 * ('h' or 'v'); control points are pulled along it so branches leave a node
 * perpendicular to its edge instead of cutting a diagonal.
 */
function bezier(x1, y1, x2, y2, axis, o) {
  var c1x, c1y, c2x, c2y;
  if (axis === 'v') {
    var dy = (y2 - y1) * 0.5;
    c1x = x1; c1y = y1 + dy; c2x = x2; c2y = y2 - dy;
  } else {
    var dx = (x2 - x1) * 0.5;
    c1x = x1 + dx; c1y = y1; c2x = x2 - dx; c2y = y2;
  }
  if (o && o.rough) {
    var w = o.rough * 1.2;
    c1x += jit(o, w); c1y += jit(o, w); c2x += jit(o, w); c2y += jit(o, w);
  }
  return 'M' + r2(x1) + ' ' + r2(y1) + 'C' + r2(c1x) + ' ' + r2(c1y) + ' ' +
    r2(c2x) + ' ' + r2(c2y) + ' ' + r2(x2) + ' ' + r2(y2);
}

/**
 * A branch that starts thick and ends thin — the shape a marker pen makes.
 * Emitted as a *filled* path (two offset cubics) rather than a stroke.
 */
function taper(x1, y1, x2, y2, w1, w2, axis, o) {
  var ox = axis === 'v' ? 1 : 0, oy = axis === 'v' ? 0 : 1;
  var j = o && o.rough ? o.rough * 0.9 : 0;
  var c1x, c1y, c2x, c2y;
  if (axis === 'v') {
    var dy = (y2 - y1) * 0.55;
    c1x = x1; c1y = y1 + dy; c2x = x2; c2y = y2 - dy;
  } else {
    var dx = (x2 - x1) * 0.55;
    c1x = x1 + dx; c1y = y1; c2x = x2 - dx; c2y = y2;
  }
  if (j) { c1x += jit(o, j); c1y += jit(o, j); c2x += jit(o, j); c2y += jit(o, j); }
  var h1 = w1 / 2, h2 = w2 / 2;
  function side(sign) {
    return r2(x1 + ox * h1 * sign) + ' ' + r2(y1 + oy * h1 * sign) + 'C' +
      r2(c1x + ox * h1 * sign) + ' ' + r2(c1y + oy * h1 * sign) + ' ' +
      r2(c2x + ox * h2 * sign) + ' ' + r2(c2y + oy * h2 * sign) + ' ' +
      r2(x2 + ox * h2 * sign) + ' ' + r2(y2 + oy * h2 * sign);
  }
  var back = 'C' + r2(c2x - ox * h2) + ' ' + r2(c2y - oy * h2) + ' ' +
    r2(c1x - ox * h1) + ' ' + r2(c1y - oy * h1) + ' ' +
    r2(x1 - ox * h1) + ' ' + r2(y1 - oy * h1);
  return 'M' + side(1) + 'L' + r2(x2 - ox * h2) + ' ' + r2(y2 - oy * h2) + back + 'Z';
}


/* ------------------------------------------------------------------ *
 * themes
 *
 * Palettes and fonts are kept identical to the `visualthink` skill so a
 * mind map and a sketchnote sit on the same page without clashing. What
 * a theme adds here is `mm`: how the three node roles are drawn.
 *
 *   node.root   — the centre
 *   node.branch — depth 1
 *   node.sub    — depth 2+
 *   edge        — 'taper' (marker pen) | 'curve' (stroked bezier)
 * ------------------------------------------------------------------ */

var HAND_BODY_FONTS = "'Gamja Flower','Gaegu','Segoe Print',system-ui,sans-serif";
var HAND_TITLE_FONTS = "'Jua','Gaegu','Segoe Print',system-ui,sans-serif";
var CLEAN_FONTS = "'Pretendard','Pretendard Variable',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
var SERIF_FONTS = "'Nanum Myeongjo','Noto Serif KR',Georgia,'Times New Roman','Apple SD Gothic Neo',serif";

var THEMES = {

  /* Hand-drawn on warm paper. The default. */
  sketch: {
    name: 'sketch', mood: 'light',
    roughness: 1.4, bowing: 1.2, strokeWidth: 2.1, strokeWidthThin: 1.4, radius: 12,
    bg: '#FCFAF3', ink: '#22262B', inkSoft: '#5C636B',
    font: HAND_BODY_FONTS, fontTitle: HAND_TITLE_FONTS,
    fontScale: 1.26, titleFontScale: 1.02, titleWeight: 'bold',
    fontImport: 'https://fonts.googleapis.com/css2?family=Gamja+Flower&family=Jua&display=swap',
    palette: {
      coral:  { s: '#D9482B', f: '#FBE3DC', i: '#7A2313' },
      teal:   { s: '#0E8C8C', f: '#D6EFEF', i: '#08514F' },
      yellow: { s: '#D18700', f: '#FDF0CC', i: '#6B4400' },
      purple: { s: '#6F42A8', f: '#EBE2F7', i: '#3E2264' },
      green:  { s: '#3E8B26', f: '#E0F0D8', i: '#225014' },
      blue:   { s: '#2360C4', f: '#DDE7FA', i: '#143869' },
      pink:   { s: '#C42A63', f: '#FADDE7', i: '#701537' },
      gray:   { s: '#5C636B', f: '#E8EAEC', i: '#33383D' }
    },
    highlight: '#FFE889', highlightOpacity: 0.72,
    mm: { root: 'blob', branch: 'round', sub: 'underline', edge: 'taper',
          rootInk: 'paper', branchInk: 'accent', tracking: 0 }
  },

  /* Clean flat vector. Same geometry, no jitter. */
  flat: {
    name: 'flat', mood: 'light',
    roughness: 0, bowing: 0, strokeWidth: 1.7, strokeWidthThin: 1.2, radius: 14,
    bg: '#FFFFFF', ink: '#111827', inkSoft: '#6B7280',
    font: CLEAN_FONTS, fontTitle: CLEAN_FONTS,
    fontScale: 1.0, titleFontScale: 1.0, titleWeight: '700',
    fontImport: null,
    palette: {
      coral:  { s: '#DC5A3C', f: '#FCEAE4', i: '#7C2D12' },
      teal:   { s: '#0D9488', f: '#CCFBF1', i: '#134E4A' },
      yellow: { s: '#CA8A04', f: '#FEF3C7', i: '#713F12' },
      purple: { s: '#7C3AED', f: '#EDE9FE', i: '#4C1D95' },
      green:  { s: '#16A34A', f: '#DCFCE7', i: '#14532D' },
      blue:   { s: '#2563EB', f: '#DBEAFE', i: '#1E3A8A' },
      pink:   { s: '#DB2777', f: '#FCE7F3', i: '#831843' },
      gray:   { s: '#6B7280', f: '#F3F4F6', i: '#1F2937' }
    },
    highlight: '#FDE68A', highlightOpacity: 0.6,
    mm: { root: 'pill', branch: 'round', sub: 'underline', edge: 'curve',
          rootInk: 'paper', branchInk: 'accent', tracking: -0.005 }
  },

  /* Type-led. No boxes; rules and a serif face carry the hierarchy. */
  editorial: {
    name: 'editorial', mood: 'light',
    roughness: 0, bowing: 0, strokeWidth: 1.1, strokeWidthThin: 0.8, radius: 0,
    bg: '#FBFAF7', ink: '#16161A', inkSoft: '#6E6A63',
    font: SERIF_FONTS, fontTitle: SERIF_FONTS,
    fontScale: 1.0, titleFontScale: 1.0, titleWeight: '700',
    fontImport: 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap',
    palette: {
      coral:  { s: '#A63A28', f: '#F5EAE6', i: '#5E1F14' },
      teal:   { s: '#2F6E68', f: '#E6EFEE', i: '#1A403C' },
      yellow: { s: '#96700A', f: '#F5EFDF', i: '#543E00' },
      purple: { s: '#5A4A78', f: '#EBE8F1', i: '#332A46' },
      green:  { s: '#4A6B3A', f: '#EAEFE6', i: '#2A3D21' },
      blue:   { s: '#2C4F7C', f: '#E6EBF2', i: '#182C46' },
      pink:   { s: '#8E4266', f: '#F2E8ED', i: '#52253A' },
      gray:   { s: '#4A4A4A', f: '#EDECEA', i: '#2A2A2A' }
    },
    highlight: '#E8E2D4', highlightOpacity: 0.85,
    mm: { root: 'rule', branch: 'rule', sub: 'plain', edge: 'curve',
          rootInk: 'ink', branchInk: 'ink', tracking: -0.015 }
  },

  /* Poster. Heavy weight, square corners, saturated blocks. */
  bold: {
    name: 'bold', mood: 'light',
    roughness: 0, bowing: 0, strokeWidth: 2.8, strokeWidthThin: 1.8, radius: 0,
    bg: '#FAFAF8', ink: '#09090B', inkSoft: '#52525B',
    font: CLEAN_FONTS, fontTitle: CLEAN_FONTS,
    fontScale: 1.0, titleFontScale: 1.0, titleWeight: '800',
    fontImport: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css',
    palette: {
      coral:  { s: '#FF4433', f: '#FFDFDB', i: '#5E1007' },
      teal:   { s: '#00A9A0', f: '#CCF0EE', i: '#00423E' },
      yellow: { s: '#FFB800', f: '#FFF0CC', i: '#5C4200' },
      purple: { s: '#7C3AED', f: '#E7DDFC', i: '#2E1065' },
      green:  { s: '#16A34A', f: '#D5F5E1', i: '#0A3D1C' },
      blue:   { s: '#2563EB', f: '#DAE5FD', i: '#132E6B' },
      pink:   { s: '#EC4899', f: '#FCDCEC', i: '#6B1139' },
      gray:   { s: '#18181B', f: '#E7E7E9', i: '#09090B' }
    },
    highlight: '#FFE000', highlightOpacity: 1,
    mm: { root: 'slab', branch: 'slab', sub: 'thickline', edge: 'curve',
          rootInk: 'paper', branchInk: 'paper', tracking: -0.03 }
  }
};

var ACCENT_ORDER = ['coral', 'teal', 'yellow', 'purple', 'green', 'blue', 'pink', 'gray'];

/* ------------------------------------------------------------------ *
 * 픽토그램
 *
 * scriptviz 스킬과 같은 세트 — 두 스킬의 산출물을 한 문서에 섞어도
 * 그림 톤이 어긋나지 않는다. 24x24 stroke, 색은 노드의 악센트를 따른다.
 * ------------------------------------------------------------------ */

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
  person: 'user', people: 'users', money: 'won', time: 'clock', warning: 'warn',
  growth: 'trendup', decline: 'trenddown', idea: 'bulb', location: 'pin', settings: 'gear',
  ai: 'sparkle', chip: 'cpu', image: 'picture', photo: 'picture', school: 'graduation'
};

/** 아이콘 이름(별칭 포함)을 path 로. 못 찾으면 null — 그때는 글자로 찍는다. */
function iconPath(name) {
  if (!name) return null;
  var k = ALIAS[name] || name;
  return ICONS[k] || null;
}

/** size 는 아이콘 한 변의 px. (x, y) 는 왼쪽 위 모서리. */
function drawIcon(name, x, y, size, color, sw) {
  var d = iconPath(name);
  if (!d) return '';
  var s = size / 24;
  return g({ transform: 'translate(' + r2(x) + ',' + r2(y) + ') scale(' + r2(s) + ')' },
    el('path', {
      d: d, fill: 'none', stroke: color, 'stroke-width': r2(num(sw, 1.9)),
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
}

/** 노드 상태 — 색과 기본 아이콘이 함께 붙는다. */
var STATUS = {
  done:    { color: 'green',  icon: 'check' },
  doing:   { color: 'blue',   icon: 'clock' },
  todo:    { color: 'gray',   icon: 'minus' },
  risk:    { color: 'coral',  icon: 'warn' },
  blocked: { color: 'coral',  icon: 'ban' },
  idea:    { color: 'yellow', icon: 'bulb' },
  new:     { color: 'purple', icon: 'star' }
};


function hexToRgb(hex) {
  var h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r, gg, b) {
  function h(v) { var s = clamp(Math.round(v), 0, 255).toString(16); return s.length === 1 ? '0' + s : s; }
  return '#' + h(r) + h(gg) + h(b);
}
function tint(hex, t) {
  var c = hexToRgb(hex);
  return rgbToHex(c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t);
}
function shade(hex, t) {
  var c = hexToRgb(hex);
  return rgbToHex(c[0] * (1 - t), c[1] * (1 - t), c[2] * (1 - t));
}
function resolveColor(theme, ref, fallbackIndex) {
  if (ref == null) return theme.palette[ACCENT_ORDER[(fallbackIndex || 0) % ACCENT_ORDER.length]];
  if (typeof ref === 'number') return theme.palette[ACCENT_ORDER[ref % ACCENT_ORDER.length]];
  if (typeof ref === 'string') {
    if (theme.palette[ref]) return theme.palette[ref];
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(ref)) return { s: ref, f: tint(ref, 0.86), i: shade(ref, 0.45) };
  }
  return theme.palette[ACCENT_ORDER[(fallbackIndex || 0) % ACCENT_ORDER.length]];
}
function getTheme(name) {
  var t = THEMES[name] || THEMES.sketch;
  return t;
}


/* ------------------------------------------------------------------ *
 * normalise
 *
 * The spec is a plain tree. Everything downstream works on the
 * normalised copy, which carries ids ("r", "r.0", "r.0.2"), an inherited
 * accent colour, and the resolved collapse state.
 * ------------------------------------------------------------------ */

function normNode(src, id, depth, inherited, accentIdx, collapsedSet) {
  var n = (typeof src === 'string' || typeof src === 'number') ? { text: String(src) } : (src || {});
  var color = n.color != null ? n.color
    : (depth === 0 ? null : (depth === 1 ? ACCENT_ORDER[accentIdx % ACCENT_ORDER.length] : inherited));
  var kids = arr(n.children);
  var out = {
    id: id,
    text: n.text == null ? '' : String(n.text),
    note: n.note == null ? '' : String(n.note),
    icon: n.icon == null ? '' : String(n.icon),
    badge: n.badge == null ? '' : String(n.badge),
    mark: !!n.mark,
    status: n.status && STATUS[n.status] ? n.status : null,
    progress: typeof n.progress === 'number' ? clamp(n.progress, 0, 1) : null,
    tags: arr(n.tags).map(String).slice(0, 4),
    image: n.image || null,
    imageSize: n.imageSize || null,
    emphasis: n.emphasis || null,
    link: n.link || null,
    side: n.side === 'left' || n.side === 'right' ? n.side : null,
    color: color,
    depth: depth,
    collapsed: collapsedSet ? collapsedSet.indexOf(id) >= 0 : !!n.collapsed,
    children: []
  };
  for (var i = 0; i < kids.length; i++) {
    out.children.push(normNode(kids[i], id + '.' + i, depth + 1,
      depth === 0 ? ACCENT_ORDER[i % ACCENT_ORDER.length] : color,
      depth === 0 ? i : accentIdx, collapsedSet));
  }
  return out;
}

function normalize(spec, opts) {
  opts = opts || {};
  var rootSrc = spec.root != null ? spec.root : { text: spec.title || '', children: arr(spec.branches) };
  var collapsedSet = opts.collapsed ? opts.collapsed.slice() : null;
  var root = normNode(rootSrc, 'r', 0, null, 0, collapsedSet);
  if (!root.text && spec.title) root.text = spec.title;
  return root;
}

/** Ids the spec itself asks to start folded — the interactive viewer's seed. */
function initialCollapsed(spec) {
  var out = [];
  walk(normalize(spec, {}), function (n) { if (n.collapsed) out.push(n.id); });
  return out;
}

function walk(node, fn, parent) {
  fn(node, parent);
  for (var i = 0; i < node.children.length; i++) walk(node.children[i], fn, node);
}
function visibleChildren(n) { return n.collapsed ? [] : n.children; }
function countDescendants(n) {
  var c = 0;
  for (var i = 0; i < n.children.length; i++) c += 1 + countDescendants(n.children[i]);
  return c;
}


/* ------------------------------------------------------------------ *
 * measure — box size for one node
 * ------------------------------------------------------------------ */

var ROLE_SIZE = {
  root:   { size: 29, maxW: 300, padX: 24, padY: 15, maxLines: 3, weight: 'bold' },
  branch: { size: 19, maxW: 230, padX: 15, padY: 9,  maxLines: 3, weight: 'bold' },
  sub:    { size: 15, maxW: 210, padX: 10, padY: 6,  maxLines: 3, weight: 'normal' }
};

function roleOf(depth) { return depth === 0 ? 'root' : (depth === 1 ? 'branch' : 'sub'); }

function measureNode(n, theme, scale) {
  var role = roleOf(n.depth);
  var cfg = ROLE_SIZE[role];
  var style = theme.mm[role];
  var deep = n.depth >= 3 ? Math.pow(0.94, Math.min(n.depth - 2, 4)) : 1;
  var fscale = (role === 'sub' ? theme.fontScale : (theme.titleFontScale || theme.fontScale)) * scale;
  var size = cfg.size * deep * fscale;
  var weight = role === 'sub' ? 'normal' : theme.titleWeight;
  var tracking = theme.mm.tracking || 0;
  /* 아이콘: 세트에 있으면 그림으로, 없으면 글자(이모지)로 라벨 앞에 붙는다 */
  var st = STATUS[n.status] || null;
  var iconName = n.icon || (st ? st.icon : '');
  var hasIcon = !!iconPath(iconName);
  n.iconName = hasIcon ? iconName : '';
  n.iconTone = st ? st.color : null;
  var label = (!hasIcon && n.icon ? n.icon + ' ' : '') + n.text;
  var t = fit(label, cfg.maxW * scale, size, { maxLines: cfg.maxLines, weight: weight, tracking: tracking, lineHeight: 1.24 });
  var w = widestLine(t.lines, t.size, weight, tracking);
  n.textW = w;
  var noteT = null;
  if (n.note) {
    var ns = Math.max(11, t.size * 0.72);
    noteT = fit(n.note, Math.max(cfg.maxW * scale, w), ns, { maxLines: 2, lineHeight: 1.28 });
    w = Math.max(w, widestLine(noteT.lines, noteT.size));
  }
  var boxless = style === 'underline' || style === 'plain' || style === 'thickline' || style === 'rule';
  var padX = boxless ? Math.min(cfg.padX, 6) * scale : cfg.padX * scale;
  var padY = (boxless ? Math.max(3, cfg.padY - 4) : cfg.padY) * scale;
  var textH = t.height + (noteT ? noteT.height + 3 : 0);
  var extra = style === 'rule' ? 10 : ((style === 'underline' || style === 'thickline') ? 6 : 0);

  /* 선행 그래픽(썸네일 · 아이콘)과 후행 그래픽(태그 · 진행률)이 자리를 차지한다 */
  n.iconSize = hasIcon ? t.size * 1.18 : 0;
  n.iconW = hasIcon ? n.iconSize + t.size * 0.34 : 0;
  n.imgSize = n.image ? t.size * (n.imageSize === 'lg' ? 3.6 : n.imageSize === 'sm' ? 1.9 : 2.6) : 0;
  n.imgW = n.image ? n.imgSize + t.size * 0.36 : 0;
  n.lead = n.iconW + n.imgW;

  n.tagSize = Math.max(10, t.size * 0.6);
  n.tagH = n.tags.length ? n.tagSize * 2.1 : 0;
  var tagsW = 0;
  for (var ti = 0; ti < n.tags.length; ti++) {
    tagsW += measure(n.tags[ti], n.tagSize, 'bold') + n.tagSize * 1.5 + (ti ? n.tagSize * 0.45 : 0);
  }
  n.progH = n.progress != null ? Math.max(7, t.size * 0.5) : 0;
  /* 퍼센트 글자가 노드 밖으로 삐져나가지 않도록 자리를 미리 잡아둔다 */
  n.progLabelW = n.progress != null ? measure('100%', n.tagSize, 'bold') + 8 * scale : 0;

  n.text_ = t; n.note_ = noteT; n.role = role; n.style = style;
  n.padX = padX; n.padY = padY; n.weight = weight; n.tracking = tracking;
  n.w = Math.max(Math.max(w + n.progLabelW, tagsW) + n.lead + padX * 2, 34 * scale);
  n.h = textH + n.tagH + n.progH + padY * 2 + extra;
  if (n.image) n.h = Math.max(n.h, n.imgSize + padY * 2);
  if (style === 'blob' || style === 'pill') { n.w += 10 * scale; n.h += 6 * scale; }
  return n;
}


/* ------------------------------------------------------------------ *
 * layout
 *
 * Two passes. `spanOf` gives every subtree the cross-axis room it needs;
 * `place` then hands out coordinates. A parent is centred on the band its
 * children occupy, and a parent taller than that band widens it, so
 * nothing can overlap regardless of depth.
 * ------------------------------------------------------------------ */

function gapsFor(scale) {
  return {
    h: function (depth) { return (depth === 0 ? 62 : depth === 1 ? 40 : 30) * scale; },
    v: function (depth) { return (depth === 0 ? 26 : depth === 1 ? 16 : 9) * scale; }
  };
}

function spanOf(node, axis, gaps) {
  var cross = axis === 'h' ? node.h : node.w;
  var kids = visibleChildren(node);
  if (!kids.length) { node.span = cross; return node.span; }
  var sum = 0;
  for (var i = 0; i < kids.length; i++) {
    sum += spanOf(kids[i], axis, gaps);
    if (i) sum += gaps.v(node.depth);
  }
  node.span = Math.max(cross, sum);
  return node.span;
}

function place(node, main, crossTop, axis, gaps, dir) {
  node.dir = dir;
  var cross = axis === 'h' ? node.h : node.w;
  var mainSize = axis === 'h' ? node.w : node.h;
  var crossPos = crossTop + (node.span - cross) / 2;
  if (axis === 'h') { node.x = dir > 0 ? main : main - node.w; node.y = crossPos; }
  else { node.y = dir > 0 ? main : main - node.h; node.x = crossPos; }

  var kids = visibleChildren(node);
  if (!kids.length) return;
  var sum = 0;
  for (var i = 0; i < kids.length; i++) sum += kids[i].span + (i ? gaps.v(node.depth) : 0);
  var c = crossTop + (node.span - sum) / 2;
  var nextMain = main + dir * (mainSize + gaps.h(node.depth));
  for (var j = 0; j < kids.length; j++) {
    place(kids[j], nextMain, c, axis, gaps, dir);
    c += kids[j].span + gaps.v(node.depth);
  }
}

/** Split the root's branches into two balanced sides, keeping source order. */
function splitSides(kids, axis, gaps) {
  var left = [], right = [], lw = 0, rw = 0;
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i], s = spanOf(k, axis, gaps);
    if (k.side === 'left') { left.push(k); lw += s; }
    else if (k.side === 'right') { right.push(k); rw += s; }
    else if (rw <= lw) { right.push(k); rw += s; }
    else { left.push(k); lw += s; }
  }
  return { left: left, right: right };
}

function layoutTree(root, layout, theme, scale) {
  var gaps = gapsFor(scale);
  var axis = layout === 'down' ? 'v' : 'h';
  walk(root, function (n) { measureNode(n, theme, scale); });

  if (layout === 'map') {
    var kids = visibleChildren(root);
    var sides = splitSides(kids, axis, gaps);
    function stack(list) {
      var s = 0;
      for (var i = 0; i < list.length; i++) s += list[i].span + (i ? gaps.v(0) : 0);
      return s;
    }
    var rs = stack(sides.right), ls = stack(sides.left);
    var total = Math.max(rs, ls, root.h);
    root.x = 0; root.y = (total - root.h) / 2; root.dir = 1;
    var cr = (total - rs) / 2, cl = (total - ls) / 2;
    var i2;
    for (i2 = 0; i2 < sides.right.length; i2++) {
      place(sides.right[i2], root.w + gaps.h(0), cr, axis, gaps, 1);
      cr += sides.right[i2].span + gaps.v(0);
    }
    for (i2 = 0; i2 < sides.left.length; i2++) {
      place(sides.left[i2], -gaps.h(0), cl, axis, gaps, -1);
      cl += sides.left[i2].span + gaps.v(0);
    }
  } else {
    spanOf(root, axis, gaps);
    place(root, 0, 0, axis, gaps, 1);
  }

  // Normalise to a positive origin and report the content box.
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  walk(root, function (n) {
    if (n.x == null) return;
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
  });
  walk(root, function (n) { if (n.x != null) { n.x -= minX; n.y -= minY; } });
  return { w: maxX - minX, h: maxY - minY, axis: axis };
}


/* ------------------------------------------------------------------ *
 * render
 * ------------------------------------------------------------------ */

function textLines(lines, x, y, size, fill, anchor, weight, family, tracking, cls) {
  var out = '';
  for (var i = 0; i < lines.length; i++) {
    if (lines[i] === '') continue;
    out += el('text', {
      x: r2(x), y: r2(y + i * size * 1.24), fill: fill, 'font-size': r2(size),
      'font-family': family, 'font-weight': weight, 'text-anchor': anchor,
      'letter-spacing': tracking ? r2(tracking * size) : null,
      'dominant-baseline': 'middle', class: cls || null
    }, esc(lines[i]));
  }
  return out;
}

function nodeColor(theme, n) {
  if (n.depth === 0 && n.color == null) return { s: theme.ink, f: tint(theme.ink, 0.88), i: theme.ink };
  return resolveColor(theme, n.color, 0);
}

function drawNode(n, theme, o, scale) {
  var c = nodeColor(theme, n);
  var style = n.style;
  var boxless = style === 'underline' || style === 'plain' || style === 'thickline' || style === 'rule';
  var shapes = '', body = '';
  var sw = theme.strokeWidth;
  var ink;

  if (style === 'blob' || style === 'pill' || style === 'slab' || style === 'round') {
    var filled = (n.role === 'root' && theme.mm.rootInk === 'paper') ||
                 (n.role !== 'root' && theme.mm.branchInk === 'paper');
    var fill = filled ? c.s : c.f;
    ink = filled ? theme.bg : c.i;
    if (style === 'blob') {
      shapes += el('path', { d: rEllipse(n.w / 2, n.h / 2, n.w / 2, n.h / 2, o), fill: fill, stroke: c.s, 'stroke-width': r2(sw * 1.1), 'stroke-linejoin': 'round' });
    } else if (style === 'slab') {
      shapes += el('rect', { x: 5, y: 5, width: r2(n.w), height: r2(n.h), fill: theme.ink, opacity: 0.9 });
      shapes += el('rect', { x: 0, y: 0, width: r2(n.w), height: r2(n.h), fill: fill, stroke: theme.ink, 'stroke-width': r2(sw) });
    } else {
      var rad = style === 'pill' ? n.h / 2 : theme.radius * scale;
      shapes += el('path', { d: rRoundRect(0, 0, n.w, n.h, rad, o), fill: fill, stroke: c.s, 'stroke-width': r2(n.role === 'root' ? sw * 1.1 : sw), 'stroke-linejoin': 'round' });
    }
  } else {
    ink = (style === 'plain' || style === 'rule') ? theme.ink : theme.ink;
  }

  var t = n.text_;
  var mir = boxless && n.dir < 0;
  var textW = n.textW;
  /* 선행 그래픽(썸네일·아이콘)이 있으면 [그래픽 + 글자]를 한 덩어리로 놓는다.
     상자형은 그 덩어리를 가운데 맞추고, 상자 없는 노드는 가지 방향에 붙인다. */
  var contentW = n.lead + Math.max(textW, n.tags.length ? textW : 0);
  var startX = boxless ? (mir ? n.w - n.padX - contentW : n.padX) : (n.w - contentW) / 2;
  var anchor = (boxless || n.lead) ? (mir ? 'end' : 'start') : 'middle';
  var tx = n.lead
    ? (mir ? startX + contentW - n.lead : startX + n.lead)
    : (boxless ? (mir ? n.w - n.padX : n.padX) : n.w / 2);
  var textTop = n.padY + t.size * 0.62;
  var imgX, iconX;
  if (mir) {
    imgX = n.w - n.padX - n.imgSize;
    iconX = n.w - n.padX - n.imgW - n.iconSize;
  } else {
    imgX = startX;
    iconX = startX + n.imgW;
  }

  /* emphasis: 노드를 통째로 감싸는 강조 (손그림 테마에서 가장 잘 산다) */
  if (n.emphasis === 'circle' || n.emphasis === 'ring') {
    shapes = el('path', {
      d: rEllipse(n.w / 2, n.h / 2, n.w / 2 + 13 * scale, n.h / 2 + 10 * scale, o),
      fill: 'none', stroke: c.s, 'stroke-width': r2(theme.strokeWidthThin * 1.6),
      opacity: 0.85, 'stroke-linecap': 'round'
    }) + shapes;
  }

  if (n.mark) {
    var solid = !boxless && ((n.role === 'root' && theme.mm.rootInk === 'paper') ||
                             (n.role !== 'root' && theme.mm.branchInk === 'paper'));
    if (solid) {
      // A highlighter band over a solid fill kills the text — ring the node instead.
      shapes = el('path', {
        d: rRoundRect(-5, -5, n.w + 10, n.h + 10, (style === 'slab' ? 0 : theme.radius * scale) + 4, o),
        fill: 'none', stroke: theme.highlight, 'stroke-width': r2(3.4)
      }) + shapes;
    } else {
      var mw = textW + 8;
      var mx = anchor === 'middle' ? n.w / 2 - mw / 2 : (anchor === 'end' ? tx - mw : tx - 4);
      shapes += el('rect', {
        x: r2(mx), y: r2(n.padY + t.size * 0.05), width: r2(mw), height: r2(t.height * 0.92),
        fill: theme.highlight, opacity: theme.highlightOpacity, rx: 2
      });
    }
  }

  /* 썸네일 — 모서리를 둥글게 자른다 */
  if (n.image) {
    var cid = 'clip-' + n.id.replace(/\./g, '-');
    var iy = n.padY + (t.height - n.imgSize) / 2;
    if (iy < n.padY * 0.6) iy = n.padY * 0.6;
    shapes += el('clipPath', { id: cid },
      el('rect', { x: r2(imgX), y: r2(iy), width: r2(n.imgSize), height: r2(n.imgSize), rx: r2(n.imgSize * 0.22) }));
    shapes += el('image', {
      href: n.image, x: r2(imgX), y: r2(iy), width: r2(n.imgSize), height: r2(n.imgSize),
      preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#' + cid + ')'
    });
    shapes += el('rect', {
      x: r2(imgX), y: r2(iy), width: r2(n.imgSize), height: r2(n.imgSize), rx: r2(n.imgSize * 0.22),
      fill: 'none', stroke: c.s, 'stroke-width': r2(theme.strokeWidthThin), opacity: 0.7
    });
  }

  /* 아이콘 */
  if (n.iconName) {
    var iconColor = n.iconTone ? resolveColor(theme, n.iconTone, 0).s
      : (!boxless && ((n.role === 'root' && theme.mm.rootInk === 'paper') ||
                      (n.role !== 'root' && theme.mm.branchInk === 'paper')) ? theme.bg : c.s);
    shapes += drawIcon(n.iconName, iconX, n.padY + (t.size * 1.24 - n.iconSize) / 2,
      n.iconSize, iconColor, theme.name === 'sketch' ? 2.1 : 1.9);
  }

  body += textLines(t.lines, tx, textTop, t.size, ink, anchor, n.weight,
    n.role === 'sub' ? theme.font : theme.fontTitle, n.tracking);

  var by = n.padY + t.height;
  if (n.note_) {
    body += textLines(n.note_.lines, tx, by + n.note_.size * 0.7, n.note_.size,
      boxless ? theme.inkSoft : ((style === 'slab' || (n.role === 'root' && theme.mm.rootInk === 'paper')) ? tint(theme.bg, 0) : theme.inkSoft),
      anchor, 'normal', theme.font, 0);
    by += n.note_.height + 3;
  }

  /* 진행률 — 글자 폭만큼의 얇은 막대 */
  if (n.progress != null) {
    var pw = Math.max(textW, 46 * scale);
    var px = anchor === 'end' ? tx - pw : tx;
    var ph = Math.max(4, n.progH * 0.5);
    var py = by + 2;
    shapes += el('rect', { x: r2(px), y: r2(py), width: r2(pw), height: r2(ph), rx: r2(ph / 2), fill: c.s, opacity: 0.16 });
    shapes += el('rect', { x: r2(px), y: r2(py), width: r2(pw * n.progress), height: r2(ph), rx: r2(ph / 2), fill: c.s });
    body += el('text', {
      x: r2(anchor === 'end' ? px - 6 : px + pw + 6), y: r2(py + ph / 2),
      fill: theme.inkSoft, 'font-size': r2(n.tagSize), 'font-family': theme.font, 'font-weight': 'bold',
      'text-anchor': anchor === 'end' ? 'end' : 'start', 'dominant-baseline': 'middle'
    }, Math.round(n.progress * 100) + '%');
    by += n.progH;
  }

  /* 태그 칩 */
  if (n.tags.length) {
    var chipH = n.tagSize * 1.7, cx0 = anchor === 'end' ? tx : tx, run = 0;
    var widths = n.tags.map(function (tg) { return measure(tg, n.tagSize, 'bold') + n.tagSize * 1.5; });
    var totalW = widths.reduce(function (a, b2) { return a + b2; }, 0) + n.tagSize * 0.45 * (n.tags.length - 1);
    var startTag = anchor === 'end' ? tx - totalW : tx;
    for (var k2 = 0; k2 < n.tags.length; k2++) {
      var cw = widths[k2];
      shapes += el('rect', {
        x: r2(startTag + run), y: r2(by + 3), width: r2(cw), height: r2(chipH), rx: r2(chipH / 2),
        fill: c.f, stroke: c.s, 'stroke-width': r2(theme.strokeWidthThin * 0.8), opacity: theme.mood === 'light' ? 1 : 0.92
      });
      body += el('text', {
        x: r2(startTag + run + cw / 2), y: r2(by + 3 + chipH / 2), fill: c.i,
        'font-size': r2(n.tagSize), 'font-family': theme.font, 'font-weight': 'bold',
        'text-anchor': 'middle', 'dominant-baseline': 'middle'
      }, esc(n.tags[k2]));
      run += cw + n.tagSize * 0.45;
    }
    by += n.tagH;
  }

  /* boxless roles: a rule instead of a border */
  if (style === 'underline' || style === 'thickline' || style === 'rule') {
    var uw = Math.max(textW, n.note_ ? widestLine(n.note_.lines, n.note_.size) : 0);
    var ux1 = anchor === 'end' ? tx - uw : tx;
    var ux2 = anchor === 'end' ? tx : tx + uw;
    var uy = n.h - 3;
    var lw = style === 'thickline' ? 4.5 : (style === 'rule' ? 1.6 : theme.strokeWidthThin * 1.3);
    shapes += el('path', { d: rLine(ux1, uy, ux2, uy, o), stroke: c.s, 'stroke-width': r2(lw), fill: 'none', 'stroke-linecap': 'round' });
    if (n.role === 'root' && style === 'rule') {
      shapes += el('path', { d: rLine(ux1, uy + 4.5, ux2, uy + 4.5, o), stroke: c.s, 'stroke-width': 0.9, fill: 'none' });
    }
  }
  if (style === 'plain') {
    var dy = n.padY + t.size * 0.62;
    var dx = anchor === 'end' ? n.w - n.padX + 5 : n.padX - 5;
    shapes += el('circle', { cx: r2(dx), cy: r2(dy), r: 2, fill: c.s });
  }

  /* fold indicator */
  var extra = '';
  if (n.children.length && n.collapsed) {
    var cx = n.dir < 0 ? -11 * scale : n.w + 11 * scale;
    var cy = n.role === 'sub' ? n.h - 3 : n.h / 2;
    extra += g({ class: 'mm-fold' },
      el('circle', { cx: r2(cx), cy: r2(cy), r: r2(9.5 * scale), fill: theme.bg, stroke: c.s, 'stroke-width': r2(theme.strokeWidthThin) }) +
      el('text', {
        x: r2(cx), y: r2(cy + 0.5), fill: c.s, 'font-size': r2(10.5 * scale), 'font-family': theme.font,
        'font-weight': 'bold', 'text-anchor': 'middle', 'dominant-baseline': 'middle'
      }, esc(String(countDescendants(n)))));
  }
  if (n.badge) {
    var bw = measure(n.badge, 11 * scale) + 12;
    extra += g({ class: 'mm-badge', transform: 'translate(' + r2(n.w - bw / 2 - 2) + ',' + r2(-7) + ')' },
      el('rect', { x: r2(-bw / 2), y: -8, width: r2(bw), height: 16, rx: 8, fill: c.s }) +
      el('text', { x: 0, y: 1, fill: theme.bg, 'font-size': r2(11 * scale), 'font-family': theme.font, 'font-weight': 'bold', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, esc(n.badge)));
  }
  return shapes + body + extra;
}

function anchorOf(n, side, axis) {
  var boxless = n.style === 'underline' || n.style === 'plain' || n.style === 'thickline' || n.style === 'rule';
  if (axis === 'v') {
    return side === 'out' ? { x: n.x + n.w / 2, y: n.y + n.h } : { x: n.x + n.w / 2, y: n.y };
  }
  var y = boxless ? n.y + n.h - 3 : n.y + n.h / 2;
  var right = side === 'out' ? (n.dir >= 0) : (n.dir < 0);
  return { x: right ? n.x + n.w : n.x, y: y };
}

function drawEdges(root, theme, o, axis, scale, query) {
  var out = '';
  walk(root, function (p) {
    if (p.x == null) return;
    var kids = visibleChildren(p);
    for (var i = 0; i < kids.length; i++) {
      var ch = kids[i];
      if (ch.x == null) continue;
      var c = nodeColor(theme, ch);
      var a = axis === 'v'
        ? { x: p.x + p.w / 2, y: p.y + p.h }
        : anchorOf({ x: p.x, y: p.y, w: p.w, h: p.h, dir: ch.dir, style: p.depth === 0 ? 'box' : p.style }, 'out', axis);
      var b = axis === 'v'
        ? { x: ch.x + ch.w / 2, y: ch.y }
        : anchorOf(ch, 'in', axis);
      var d = p.depth;
      var dim = query && matchNode(ch, query) === false ? 0.18 : null;
      if (theme.mm.edge === 'taper' && d <= 1) {
        var w1 = (d === 0 ? 9 : 5) * scale, w2 = (d === 0 ? 4.6 : 2.6) * scale;
        out += el('path', { d: taper(a.x, a.y, b.x, b.y, w1, w2, axis, o), fill: c.s, opacity: dim, class: 'mm-edge', 'data-id': ch.id });
      } else {
        var sw = (d === 0 ? 3.4 : d === 1 ? 2.2 : 1.5) * scale;
        out += el('path', {
          d: bezier(a.x, a.y, b.x, b.y, axis, o), fill: 'none', stroke: c.s,
          'stroke-width': r2(sw), 'stroke-linecap': 'round',
          opacity: dim != null ? dim : (theme.name === 'editorial' ? 0.75 : 0.92),
          class: 'mm-edge', 'data-id': ch.id
        });
      }
    }
  });
  return out;
}

function paperDefs(kind, theme) {
  if (!kind) return { defs: '', rect: '' };
  var stroke = theme.inkSoft, pat;
  if (kind === 'dot') {
    pat = el('pattern', { id: 'mmpaper', width: 22, height: 22, patternUnits: 'userSpaceOnUse' },
      el('circle', { cx: 1.5, cy: 1.5, r: 1.1, fill: stroke, opacity: 0.22 }));
  } else if (kind === 'ruled') {
    pat = el('pattern', { id: 'mmpaper', width: 100, height: 28, patternUnits: 'userSpaceOnUse' },
      el('path', { d: 'M0 27.5H100', stroke: stroke, 'stroke-width': 1, opacity: 0.16 }));
  } else {
    pat = el('pattern', { id: 'mmpaper', width: 24, height: 24, patternUnits: 'userSpaceOnUse' },
      el('path', { d: 'M24 0H0V24', stroke: stroke, 'stroke-width': 1, fill: 'none', opacity: 0.14 }));
  }
  return { defs: pat, rect: true };
}

/* ------------------------------------------------------------------ *
 * 분위기 레이어 — 배경 · 범례 · 교차 연결선
 *
 * 배경은 정보가 아니라 공기다. 글자를 방해하기 시작하면 이미 과한 것이다.
 * ------------------------------------------------------------------ */

function backdropDefs(kind, theme, W, H) {
  var a = theme.palette[ACCENT_ORDER[0]].s, b = theme.palette[ACCENT_ORDER[1]].s;
  if (kind === 'gradient') {
    return {
      defs: el('linearGradient', { id: 'mmbd', x1: '0', y1: '0', x2: '1', y2: '1' },
        el('stop', { offset: '0', 'stop-color': tint(a, 0.9) }) +
        el('stop', { offset: '0.55', 'stop-color': theme.bg }) +
        el('stop', { offset: '1', 'stop-color': tint(b, 0.92) })),
      body: el('rect', { x: 0, y: 0, width: r2(W), height: r2(H), fill: 'url(#mmbd)' })
    };
  }
  if (kind === 'blob') {
    return {
      defs: el('filter', { id: 'mmblur', x: '-30%', y: '-30%', width: '160%', height: '160%' },
        el('feGaussianBlur', { stdDeviation: r2(Math.max(40, W * 0.05)) })),
      body: g({ filter: 'url(#mmblur)', opacity: theme.mood === 'light' ? 0.35 : 0.45 },
        el('ellipse', { cx: r2(W * 0.22), cy: r2(H * 0.24), rx: r2(W * 0.26), ry: r2(H * 0.3), fill: a }) +
        el('ellipse', { cx: r2(W * 0.8), cy: r2(H * 0.78), rx: r2(W * 0.24), ry: r2(H * 0.28), fill: b }))
    };
  }
  if (kind === 'vignette') {
    return {
      defs: el('radialGradient', { id: 'mmbd', cx: '0.5', cy: '0.5', r: '0.75' },
        el('stop', { offset: '0.45', 'stop-color': shade(theme.bg, 0.02), 'stop-opacity': '0' }) +
        el('stop', { offset: '1', 'stop-color': shade(theme.bg, theme.mood === 'light' ? 0.14 : 0.45) })),
      body: el('rect', { x: 0, y: 0, width: r2(W), height: r2(H), fill: 'url(#mmbd)' })
    };
  }
  if (kind === 'glow') {
    return {
      defs: el('radialGradient', { id: 'mmbd', cx: '0.5', cy: '0.5', r: '0.5' },
        el('stop', { offset: '0', 'stop-color': a, 'stop-opacity': '0.28' }) +
        el('stop', { offset: '1', 'stop-color': a, 'stop-opacity': '0' })),
      body: null   // 루트 위치를 알아야 그린다
    };
  }
  return { defs: '', body: '' };
}

/** 노드 상자 가장자리에서 (tx,ty) 쪽으로 나가는 점 */
function edgePoint(n, tx, ty, pad) {
  var cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  var dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  var hw = n.w / 2 + (pad || 0), hh = n.h / 2 + (pad || 0);
  var sx = dx ? hw / Math.abs(dx) : Infinity;
  var sy = dy ? hh / Math.abs(dy) : Infinity;
  var k = Math.min(sx, sy);
  return { x: cx + dx * k, y: cy + dy * k };
}

/**
 * 트리에 없는 관계를 잇는 선. 가지가 아니라 "이것과 저것이 얽혀 있다"는 표시라
 * 기본이 점선이고, 굵기도 가지보다 얇다.
 */
function drawLinks(links, byId, theme, o, scale) {
  var out = '';
  for (var i = 0; i < links.length; i++) {
    var L = links[i] || {};
    var a = byId[L.from], b = byId[L.to];
    if (!a || !b || a.x == null || b.x == null) continue;
    var ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    var bx = b.x + b.w / 2, by = b.y + b.h / 2;
    var dx = bx - ax, dy = by - ay;
    var bend = num(L.bend, 0.2);
    var qx = (ax + bx) / 2 - dy * bend, qy = (ay + by) / 2 + dx * bend;
    var p1 = edgePoint(a, qx, qy, 4 * scale);
    var p2 = edgePoint(b, qx, qy, 8 * scale);
    var col = resolveColor(theme, L.color != null ? L.color : 'gray', 7).s;
    var sw = num(L.width, 1.9) * scale;
    out += el('path', {
      d: 'M' + r2(p1.x) + ' ' + r2(p1.y) + 'Q' + r2(qx) + ' ' + r2(qy) + ' ' + r2(p2.x) + ' ' + r2(p2.y),
      fill: 'none', stroke: col, 'stroke-width': r2(sw), 'stroke-linecap': 'round',
      'stroke-dasharray': L.style === 'solid' ? null : r2(7 * scale) + ' ' + r2(6 * scale),
      opacity: 0.85, class: 'mm-link'
    });
    if (L.arrow !== false) {
      var ang = Math.atan2(p2.y - qy, p2.x - qx);
      var hs = 7 * scale;
      out += el('path', {
        d: 'M' + r2(p2.x) + ' ' + r2(p2.y) +
           'L' + r2(p2.x - hs * Math.cos(ang - 0.42)) + ' ' + r2(p2.y - hs * Math.sin(ang - 0.42)) +
           'L' + r2(p2.x - hs * Math.cos(ang + 0.42)) + ' ' + r2(p2.y - hs * Math.sin(ang + 0.42)) + 'Z',
        fill: col, opacity: 0.9
      });
    }
    if (L.label) {
      var ls = 13 * scale;
      var lw = measure(L.label, ls, 'bold') + 12 * scale;
      var mx = (p1.x + 2 * qx + p2.x) / 4, my = (p1.y + 2 * qy + p2.y) / 4;
      out += el('rect', {
        x: r2(mx - lw / 2), y: r2(my - ls * 0.9), width: r2(lw), height: r2(ls * 1.8),
        rx: r2(ls * 0.9), fill: theme.bg, stroke: col, 'stroke-width': r2(theme.strokeWidthThin * 0.8)
      });
      out += el('text', {
        x: r2(mx), y: r2(my), fill: theme.inkSoft, 'font-size': r2(ls), 'font-family': theme.font,
        'font-weight': 'bold', 'text-anchor': 'middle', 'dominant-baseline': 'middle'
      }, esc(L.label));
    }
  }
  return out;
}

/** 색이 무엇을 뜻하는지 알려주는 줄. 색을 의미로 쓴 맵에만 붙인다. */
function drawLegend(items, theme, x, y, scale) {
  var out = '', run = 0, fs = 15 * scale;
  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var col = resolveColor(theme, it.color, i).s;
    var lw = measure(it.label || '', fs, 'bold');
    if (it.icon && iconPath(it.icon)) {
      out += drawIcon(it.icon, x + run, y - fs * 0.62, fs * 1.15, col, 2);
      run += fs * 1.5;
    } else {
      out += el('circle', { cx: r2(x + run + fs * 0.4), cy: r2(y), r: r2(fs * 0.4), fill: col });
      run += fs * 1.2;
    }
    out += el('text', {
      x: r2(x + run), y: r2(y), fill: theme.inkSoft, 'font-size': r2(fs), 'font-family': theme.font,
      'font-weight': 'bold', 'text-anchor': 'start', 'dominant-baseline': 'middle'
    }, esc(it.label || ''));
    run += lw + fs * 1.5;
  }
  return out;
}

function render(spec, opts) {
  opts = opts || {};
  if (typeof spec !== 'object' || spec == null) throw new Error('mindmap: spec must be an object');
  var theme = getTheme(opts.theme || spec.theme);
  var layout = opts.layout || spec.layout || 'map';
  if (['map', 'right', 'down'].indexOf(layout) < 0) layout = 'map';
  var scale = num(opts.scale, num(spec.scale, 1));
  var pad = num(opts.padding, num(spec.padding, 48)) * scale;
  var seed = opts.seed || spec.seed || spec.title || 'mindmap';
  var o = ctxOf(theme, makeRng(seed));

  var root = normalize(spec, opts);
  var box = layoutTree(root, layout, theme, scale);

  var headText = opts.heading === false ? null
    : (opts.heading || spec.heading ||
      ((spec.title && spec.title !== root.text) ? spec.title : null));
  var subText = spec.subtitle || null;
  var headH = 0, head = '';
  if (headText) {
    var hs = 26 * scale * (theme.titleFontScale || 1);
    var ht = fit(headText, Math.max(box.w, 420), hs, { maxLines: 2, weight: theme.titleWeight, tracking: theme.mm.tracking });
    headH = ht.height + (subText ? 22 * scale : 0) + 26 * scale;
    head += textLines(ht.lines, 0, ht.size * 0.62, ht.size, theme.ink, 'start', theme.titleWeight, theme.fontTitle, theme.mm.tracking);
    if (subText) {
      head += textLines([subText], 0, ht.height + 13 * scale, 14 * scale, theme.inkSoft, 'start', 'normal', theme.font, 0);
    }
    head = g({ transform: 'translate(' + r2(pad) + ',' + r2(pad) + ')' }, head);
  }

  var legend = arr(opts.legend || spec.legend);
  var legendH = legend.length ? 42 * scale : 0;
  var W = Math.max(box.w + pad * 2, 320);
  var H = box.h + pad * 2 + headH + legendH;

  var nodes = '';
  walk(root, function (n) {
    if (n.x == null) return;
    var hit = opts.query ? matchNode(n, opts.query) : null;
    nodes += g({
      class: 'mm-node' + (n.role === 'root' ? ' mm-root' : '') + (hit === false ? ' mm-dim' : '') + (hit === true ? ' mm-hit' : ''),
      'data-id': n.id, 'data-depth': n.depth,
      'data-w': r2(n.w), 'data-h': r2(n.h),
      'data-kids': n.children.length || null,
      'data-collapsed': n.collapsed ? '1' : null,
      transform: 'translate(' + r2(n.x) + ',' + r2(n.y) + ')',
      opacity: hit === false ? 0.22 : null
    }, drawNode(n, theme, o, scale));
  });

  var paper = paperDefs(spec.paper === true ? 'grid' : spec.paper, theme);
  var bdKind = opts.backdrop || spec.backdrop || 'none';
  var bd = backdropDefs(bdKind, theme, W, H);

  /* 교차 연결선 — 트리 밖의 관계 */
  var byId = {};
  walk(root, function (n) { byId[n.id] = n; });
  var links = arr(opts.links || spec.links);
  var linkSvg = links.length ? drawLinks(links, byId, theme, o, scale) : '';

  var glow = '';
  if (bdKind === 'glow') {
    glow = el('ellipse', {
      cx: r2(root.x + root.w / 2), cy: r2(root.y + root.h / 2),
      rx: r2(Math.max(root.w, 260 * scale) * 1.9), ry: r2(Math.max(root.h, 160 * scale) * 2.1),
      fill: 'url(#mmbd)'
    });
  }

  var svg = '';
  svg += el('rect', { x: 0, y: 0, width: r2(W), height: r2(H), fill: opts.background === false ? 'none' : theme.bg });
  if (bd.body) svg += bd.body;
  if (paper.rect) svg += el('rect', { x: 0, y: 0, width: r2(W), height: r2(H), fill: 'url(#mmpaper)' });
  svg += head;
  svg += g({ class: 'mm-canvas', transform: 'translate(' + r2(pad) + ',' + r2(pad + headH) + ')' },
    glow +
    g({ class: 'mm-edges' }, drawEdges(root, theme, o, box.axis, scale, opts.query)) +
    (linkSvg ? g({ class: 'mm-links' }, linkSvg) : '') +
    g({ class: 'mm-nodes' }, nodes));
  if (legend.length) {
    svg += g({ class: 'mm-legend' }, drawLegend(legend, theme, pad, H - pad * 0.5, scale));
  }

  var defsInner = (paper.defs || '') + (bd.defs || '');
  var defs = defsInner ? el('defs', {}, defsInner) : '';
  return el('svg', {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 ' + r2(W) + ' ' + r2(H),
    width: r2(W), height: r2(H), 'font-family': theme.font, class: 'mm mm-' + theme.name,
    role: 'img', 'aria-label': esc(headText || root.text || 'mind map')
  }, defs + svg);
}

function matchNode(n, q) {
  var s = String(q || '').trim().toLowerCase();
  if (!s) return null;
  return (n.text + ' ' + n.note).toLowerCase().indexOf(s) >= 0;
}


/* ------------------------------------------------------------------ *
 * 로컬 이미지 -> data URI (단일 파일 원칙)
 * ------------------------------------------------------------------ */

var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

function inlineImages(spec, baseDir) {
  var fs, path;
  try { fs = require('fs'); path = require('path'); } catch (e) { return spec; }
  var n = 0;
  function conv(src) {
    if (!src || /^(data:|https?:)/i.test(src)) return src;
    var file = path.resolve(baseDir || '.', src);
    if (!fs.existsSync(file)) return src;
    var ext = (file.split('.').pop() || '').toLowerCase();
    n++;
    return 'data:' + (MIME[ext] || 'application/octet-stream') + ';base64,' + fs.readFileSync(file).toString('base64');
  }
  (function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.image) node.image = conv(node.image);
    arr(node.children).forEach(visit);
  })(spec.root || { children: arr(spec.branches) });
  spec.__inlined = n;
  return spec;
}


/* ------------------------------------------------------------------ *
 * validate
 * ------------------------------------------------------------------ */

/* 깊이는 예산에 넣지 않는다 — 층위는 내용이 정하는 것이고, 상한을 두면 라벨을
 * 줄이는 대신 층을 합쳐 요약을 밀어넣게 된다. 필요한 만큼 깊이 들어간다. */
var DENSITY = {
  brief:    { label: 14, note: 24, branches: 5, nodes: 18 },
  standard: { label: 20, note: 40, branches: 7, nodes: 45 },
  detailed: { label: 28, note: 56, branches: 9, nodes: 90 }
};

function validate(spec, opts) {
  opts = opts || {};
  var errors = [], warnings = [];
  if (typeof spec !== 'object' || spec == null) return { ok: false, errors: ['spec must be an object'], warnings: [] };
  if (spec.root == null && !spec.branches) errors.push('spec.root is required (or spec.branches with spec.title)');
  if (spec.theme && !THEMES[spec.theme]) warnings.push('unknown theme "' + spec.theme + '" — falling back to sketch');
  if (spec.layout && ['map', 'right', 'down'].indexOf(spec.layout) < 0) {
    warnings.push('unknown layout "' + spec.layout + '" — falling back to map');
  }
  if (spec.density && !DENSITY[spec.density]) warnings.push('unknown density "' + spec.density + '"');
  if (spec.backdrop && ['none', 'gradient', 'blob', 'vignette', 'glow'].indexOf(spec.backdrop) < 0) {
    warnings.push('모르는 backdrop "' + spec.backdrop + '" — none · gradient · blob · vignette · glow');
  }
  if (errors.length) return { ok: false, errors: errors, warnings: warnings };

  var root;
  try { root = normalize(spec, {}); }
  catch (e) { return { ok: false, errors: ['could not read the tree: ' + e.message], warnings: warnings }; }

  var d = DENSITY[spec.density] || null;
  var total = 0, maxDepth = 0, empties = 0;
  walk(root, function (n) {
    total++;
    maxDepth = Math.max(maxDepth, n.depth);
    if (!n.text) empties++;
    if (d) {
      if (Array.from(n.text).length > d.label) {
        warnings.push('label too long (' + Array.from(n.text).length + '자 > ' + d.label + '자, ' + spec.density + '): "' + n.text.slice(0, 24) + '"');
      }
      if (n.note && Array.from(n.note).length > d.note) {
        warnings.push('note too long (' + Array.from(n.note).length + '자 > ' + d.note + '자): "' + n.note.slice(0, 24) + '"');
      }
    }
  });
  /* 그래픽 요소 점검 */
  var ids = {};
  walk(root, function (n) { ids[n.id] = 1; });
  arr(spec.links).forEach(function (L, i) {
    if (!L || !ids[L.from] || !ids[L.to]) {
      warnings.push('links[' + i + ']: 없는 노드를 가리킨다 (' + (L && L.from) + ' → ' + (L && L.to) + ') — id 는 r · r.0 · r.0.2 꼴이다');
    }
  });
  var deco = 0, marked = 0;
  walk(root, function (n) {
    if (n.icon || n.status) deco++;
    if (n.mark || n.emphasis) marked++;
    if (n.icon && !iconPath(n.icon) && Array.from(n.icon).length > 2) {
      warnings.push('"' + n.text.slice(0, 12) + '": 아이콘 "' + n.icon + '" 는 세트에 없다 — 그대로 글자로 찍힌다');
    }
    if (n.progress != null && n.depth === 0) warnings.push('루트에 progress 는 어울리지 않는다');
    if (n.tags && n.tags.length > 3) warnings.push('"' + n.text.slice(0, 12) + '": 태그 ' + n.tags.length + '개 (3개 이하)');
  });
  if (marked > 3) warnings.push('강조(mark·emphasis)가 ' + marked + '개 — 한 장에 한둘이어야 강조로 읽힌다');
  if (!root.text) errors.push('the root node needs text');
  if (empties) warnings.push(empties + ' node(s) have no text');
  if (root.children.length === 0) warnings.push('the root has no branches — this is a label, not a map');
  var maxBranch = d ? d.branches : 9;
  if (root.children.length > maxBranch) {
    warnings.push('branches: ' + root.children.length + ' (권장 ' + maxBranch + ' 이하) — 형제를 상위 갈래로 묶거나 장을 나눈다');
  }
  if (d && total > d.nodes) warnings.push('nodes: ' + total + ' (권장 ' + d.nodes + ' 이하, ' + spec.density + ')');
  if (total > 60 && !opts.interactive && !spec.__interactive) {
    warnings.push('nodes: ' + total + ' — 정적 SVG로는 빽빽하다. toInteractive() 로 접기/펼치기를 주거나 collapsed 로 접어둔다');
  }
  return { ok: errors.length === 0, errors: errors, warnings: warnings, stats: { nodes: total, depth: maxDepth, branches: root.children.length } };
}

/** Flat listing of the tree — used by the interactive viewer and by callers. */
function outline(spec) {
  var out = [];
  walk(normalize(spec, {}), function (n, p) {
    out.push({ id: n.id, depth: n.depth, text: n.text, kids: n.children.length, parent: p ? p.id : null });
  });
  return out;
}


/* ------------------------------------------------------------------ *
 * markdown outline -> spec
 *
 *   # 제목            root
 *   ## 갈래           depth 1        (headings nest by level)
 *   - 항목            depth +1       (bullets nest by indent, 2 spaces)
 *     - 하위 항목
 *   - 항목 :: 노트    note after ::
 *   - **항목**        mark
 *   - {blue} 항목     accent colour
 *   - [+] 항목        starts folded
 *
 * An optional `---` front matter block sets spec-level options.
 * ------------------------------------------------------------------ */

var MD_STATUS = { x: 'done', '~': 'doing', '!': 'risk', '?': 'idea', '-': 'todo', '*': 'new' };

function parseItem(raw) {
  var s = String(raw).trim();
  var node = {};
  var m = s.match(/^\[\+\]\s*/);
  if (m) { node.collapsed = true; s = s.slice(m[0].length); }
  m = s.match(/^\[([x~!?\-*])\]\s*/i);
  if (m) { node.status = MD_STATUS[m[1].toLowerCase()]; s = s.slice(m[0].length); }
  m = s.match(/^@([^\s]+)\s+/);
  if (m) { node.icon = m[1]; s = s.slice(m[0].length); }
  m = s.match(/^\{([#a-z0-9]+)\}\s*/i);
  if (m) { node.color = m[1]; s = s.slice(m[0].length); }
  s = s.replace(/\s%(\d{1,3})\b/, function (_, pct) { node.progress = clamp(+pct / 100, 0, 1); return ''; });
  s = s.replace(/\s#([^\s#]+)/g, function (_, tg) { (node.tags = node.tags || []).push(tg); return ''; });
  var parts = s.split('::');
  if (parts.length > 1) { node.note = parts.slice(1).join('::').trim(); s = parts[0].trim(); }
  if (/^\*\*(.+)\*\*$/.test(s)) { node.mark = true; s = s.replace(/^\*\*(.+)\*\*$/, '$1'); }
  node.text = s.replace(/\*\*/g, '').trim();
  return node;
}

function fromMarkdown(md, opts) {
  opts = opts || {};
  var text = String(md || '').replace(/\r\n?/g, '\n');
  var spec = {};
  var fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    fm[1].split('\n').forEach(function (line) {
      var m = line.match(/^\s*([A-Za-z_]+)\s*:\s*(.+?)\s*$/);
      if (!m) return;
      var v = m[2].replace(/^["']|["']$/g, '');
      if (v === 'true') v = true; else if (v === 'false') v = false;
      else if (/^-?\d+(\.\d+)?$/.test(v)) v = parseFloat(v);
      spec[m[1]] = v;
    });
    text = text.slice(fm[0].length);
  }
  var lines = text.split('\n');
  var root = null;
  var stack = [];        // [{ depth, node }]

  function attach(node, depth) {
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    if (!stack.length) {
      if (!root) { root = node; root.children = root.children || []; stack = [{ depth: 0, node: root }]; return; }
      stack = [{ depth: 0, node: root }];
    }
    var parent = stack[stack.length - 1].node;
    parent.children = parent.children || [];
    parent.children.push(node);
    stack.push({ depth: depth, node: node });
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    // NB: this file carries no literal comment-open or script-tag text —
    // an inlined copy of it lives inside a script element in toInteractive(),
    // and either sequence would confuse the HTML tokenizer there.
    if (!line.trim() || /^\s*```/.test(line) || line.trim().slice(0, 4) === '<' + '!--') continue;
    var h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      var node = parseItem(h[2]);
      var depth = h[1].length - 1;
      if (depth === 0 && !root) { root = node; root.children = []; stack = [{ depth: 0, node: root }]; }
      else attach(node, depth || 1);
      continue;
    }
    var b = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (b) {
      var indent = b[1].replace(/\t/g, '  ').length;
      var base = stack.length ? stack[stack.length - 1] : null;
      var headDepth = 0;
      for (var k = stack.length - 1; k >= 0; k--) {
        if (!stack[k].bullet) { headDepth = stack[k].depth; break; }
      }
      var bdepth = headDepth + 1 + Math.floor(indent / 2);
      var bn = parseItem(b[2]);
      while (stack.length && stack[stack.length - 1].depth >= bdepth) stack.pop();
      if (!stack.length) {
        if (!root) { root = { text: opts.title || 'untitled', children: [] }; }
        stack = [{ depth: 0, node: root }];
      }
      var par = stack[stack.length - 1].node;
      par.children = par.children || [];
      par.children.push(bn);
      stack.push({ depth: bdepth, node: bn, bullet: true });
      continue;
    }
    // A bare paragraph right under a node becomes that node's note.
    var cur = stack.length ? stack[stack.length - 1].node : null;
    if (cur && !cur.note) cur.note = line.trim();
  }

  if (!root) throw new Error('mindmap: the markdown has no headings or bullets to build a map from');
  spec.root = root;
  if (!spec.title) spec.title = root.text;
  return spec;
}


/* ------------------------------------------------------------------ *
 * output — static page, interactive page, data URI, DOM mount
 * ------------------------------------------------------------------ */

function docShell(theme, title, headExtra, body) {
  return '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n' +
    (theme.fontImport ? '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link rel="stylesheet" href="' + esc(theme.fontImport) + '">\n' : '') +
    headExtra + '</head>\n<body>\n' + body + '</body>\n</html>\n';
}

function toHTML(spec, opts) {
  opts = opts || {};
  var theme = getTheme(opts.theme || spec.theme);
  var svg = render(spec, opts);
  var title = spec.title || 'mindmap';
  var css = 'html,body{margin:0;padding:0;background:' + theme.bg + ';}' +
    'body{display:flex;justify-content:center;align-items:flex-start;}' +
    'svg{max-width:100%;height:auto;display:block;}' +
    '@media print{@page{margin:8mm;}body{display:block;}svg{width:100%;}}';
  return docShell(theme, title, '<style>' + css + '</style>\n', svg + '\n');
}

function toDataURI(spec, opts) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(render(spec, opts));
}

function mount(target, spec, opts) {
  var node = typeof target === 'string' ? document.querySelector(target) : target;
  if (!node) throw new Error('mindmap: mount target not found');
  node.innerHTML = render(spec, opts);
  return node;
}

/** The library's own source, so an interactive page can be one file. */
function selfSource() {
  try {
    if (typeof __filename === 'string' && typeof require === 'function') {
      return require('fs').readFileSync(__filename, 'utf8');
    }
  } catch (e) { /* browser */ }
  return null;
}

var VIEW_CSS = [
  ':root{--bg:%BG%;--ink:%INK%;--soft:%SOFT%;--line:%LINE%;--font:%FONT%;}',
  '*{box-sizing:border-box}',
  'html,body{margin:0;height:100%;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--font)}',
  '#bar{position:fixed;z-index:5;top:0;left:0;right:0;height:48px;display:flex;align-items:center;gap:8px;',
  'padding:0 12px;background:color-mix(in srgb,var(--bg) 84%,transparent);backdrop-filter:blur(8px);',
  'border-bottom:1px solid var(--line);font-size:13px}',
  '#bar b{font-weight:700;font-size:14px;margin-right:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:28vw}',
  '.sp{flex:1}',
  'button,select,input{font:inherit;font-size:12.5px;color:var(--ink);background:transparent;border:1px solid var(--line);',
  'border-radius:7px;padding:5px 9px;cursor:pointer}',
  'button:hover,select:hover{background:color-mix(in srgb,var(--ink) 7%,transparent)}',
  'button.on{background:color-mix(in srgb,var(--ink) 12%,transparent);font-weight:700}',
  'input#q{cursor:text;min-width:150px}',
  '.grp{display:flex;gap:2px;border:1px solid var(--line);border-radius:7px;overflow:hidden}',
  '.grp button{border:0;border-radius:0;padding:5px 8px}',
  '#stage{position:fixed;inset:48px 0 0 0;overflow:hidden;cursor:grab;touch-action:none}',
  '#stage.drag{cursor:grabbing}',
  '#wrap{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform}',
  '#wrap svg{display:block}',
  'g.mm-node{cursor:pointer}',
  'g.mm-node:hover{filter:brightness(1.04) drop-shadow(0 1px 3px rgba(0,0,0,.16))}',
  'g.mm-node.mm-hit{filter:drop-shadow(0 0 0 rgba(0,0,0,0))}',
  '#hint{position:fixed;left:14px;bottom:12px;font-size:11.5px;color:var(--soft);pointer-events:none;line-height:1.6}',
  '#zoom{position:fixed;right:14px;bottom:12px;font-size:11.5px;color:var(--soft)}',
  '@media (max-width:720px){#bar b,#hint{display:none}#bar{gap:6px;padding:0 8px}}'
].join('');

var VIEW_JS = [
  '(function(){',
  'var C=window.__MM__,SPEC=C.spec;',
  'var st={theme:C.theme,layout:C.layout,collapsed:C.collapsed.slice(),q:""};',
  'var v={k:1,x:0,y:0},base={w:1,h:1};',
  'var wrap=document.getElementById("wrap"),stage=document.getElementById("stage");',
  'var flat=MM.outline(SPEC);',
  'function snap(){var m={};wrap.querySelectorAll("g.mm-node").forEach(function(n){',
  ' var t=(n.getAttribute("transform")||"").match(/translate\\(([-0-9.]+),([-0-9.]+)\\)/);',
  ' if(t)m[n.getAttribute("data-id")]=[parseFloat(t[1]),parseFloat(t[2])];});return m;}',
  'function flip(prev){wrap.querySelectorAll("g.mm-node").forEach(function(n){',
  ' var id=n.getAttribute("data-id"),t=(n.getAttribute("transform")||"").match(/translate\\(([-0-9.]+),([-0-9.]+)\\)/);',
  ' if(!t)return;var nx=parseFloat(t[1]),ny=parseFloat(t[2]);var p=prev[id];',
  ' if(p){if(Math.abs(p[0]-nx)<0.5&&Math.abs(p[1]-ny)<0.5)return;',
  '  n.animate([{transform:"translate("+p[0]+"px,"+p[1]+"px)"},{transform:"translate("+nx+"px,"+ny+"px)"}],',
  '   {duration:320,easing:"cubic-bezier(.4,.9,.3,1)"});}',
  ' else{n.animate([{opacity:0},{opacity:1}],{duration:260,easing:"ease-out"});}});',
  ' wrap.querySelectorAll("path.mm-edge").forEach(function(e){e.animate([{opacity:0},{opacity:e.getAttribute("opacity")||1}],{duration:280});});}',
  'function draw(anim){var prev=anim?snap():null;',
  ' wrap.innerHTML=MM.render(SPEC,{theme:st.theme,layout:st.layout,collapsed:st.q?[]:st.collapsed,query:st.q,background:false,heading:false});',
  ' var s=wrap.querySelector("svg");base.w=s.viewBox.baseVal.width;base.h=s.viewBox.baseVal.height;',
  ' s.removeAttribute("width");s.removeAttribute("height");s.style.width=base.w+"px";s.style.height=base.h+"px";',
   ' if(prev)flip(prev);apply();}',
  'function apply(){wrap.style.transform="translate("+v.x+"px,"+v.y+"px) scale("+v.k+")";',
  ' document.getElementById("zoom").textContent=Math.round(v.k*100)+"%";}',
  'function fit(){var r=stage.getBoundingClientRect();',
  ' v.k=Math.min((r.width-40)/base.w,(r.height-40)/base.h,1.5);',
  ' v.x=(r.width-base.w*v.k)/2;v.y=(r.height-base.h*v.k)/2;apply();}',
  'function zoomAt(cx,cy,f){var k2=Math.max(0.12,Math.min(4,v.k*f));',
  ' v.x=cx-(cx-v.x)*(k2/v.k);v.y=cy-(cy-v.y)*(k2/v.k);v.k=k2;apply();}',
  'stage.addEventListener("wheel",function(e){e.preventDefault();var r=stage.getBoundingClientRect();',
  ' if(e.ctrlKey||e.metaKey||Math.abs(e.deltaY)>Math.abs(e.deltaX)*2){',
  '  zoomAt(e.clientX-r.left,e.clientY-r.top,Math.pow(0.9986,e.deltaY));}',
  ' else{v.x-=e.deltaX;v.y-=e.deltaY;apply();}},{passive:false});',
  'var down=null,moved=0;',
  '/* 누른 대상을 기억해 둔다 — setPointerCapture 를 걸면 pointerup 의 target 이',
  '   stage 로 바뀌어 버려서, 그걸로는 어느 노드를 눌렀는지 알 수 없다. */',
  'stage.addEventListener("pointerdown",function(e){down={x:e.clientX,y:e.clientY,vx:v.x,vy:v.y,t:e.target};moved=0;',
  ' stage.classList.add("drag");stage.setPointerCapture(e.pointerId);});',
  'stage.addEventListener("pointermove",function(e){if(!down)return;',
  ' var dx=e.clientX-down.x,dy=e.clientY-down.y;moved=Math.max(moved,Math.abs(dx)+Math.abs(dy));',
  ' v.x=down.vx+dx;v.y=down.vy+dy;apply();});',
  'stage.addEventListener("pointerup",function(e){stage.classList.remove("drag");',
  ' var wasDrag=moved>4;var hit=down&&down.t?down.t:e.target;down=null;if(wasDrag)return;',
  ' var n=hit&&hit.closest?hit.closest("g.mm-node"):null;if(!n)return;',
  ' var id=n.getAttribute("data-id");if(!n.getAttribute("data-kids"))return;',
  ' var i=st.collapsed.indexOf(id);if(i>=0)st.collapsed.splice(i,1);else st.collapsed.push(id);',
  ' st.q="";document.getElementById("q").value="";draw(true);});',
  'stage.addEventListener("dblclick",function(e){var n=e.target.closest?e.target.closest("g.mm-node"):null;if(!n)return;',
  ' var t=(n.getAttribute("transform")||"").match(/translate\\(([-0-9.]+),([-0-9.]+)\\)/);if(!t)return;',
  ' var g=n.ownerSVGElement.querySelector("g.mm-canvas");',
  ' var off=(g.getAttribute("transform")||"").match(/translate\\(([-0-9.]+),([-0-9.]+)\\)/)||[0,0,0];',
  ' var r=stage.getBoundingClientRect();var b=n.getBBox();',
  ' var cx=(parseFloat(off[1])+parseFloat(t[1])+b.width/2),cy=(parseFloat(off[2])+parseFloat(t[2])+b.height/2);',
  ' v.k=Math.min(1.6,Math.max(v.k,0.9));v.x=r.width/2-cx*v.k;v.y=r.height/2-cy*v.k;apply();});',
  'function foldTo(d){st.collapsed=flat.filter(function(n){return n.kids&&n.depth>=d;}).map(function(n){return n.id;});draw(true);}',
  'function bind(id,fn){var e=document.getElementById(id);if(e)e.addEventListener("click",fn);}',
  'bind("fit",fit);bind("zin",function(){var r=stage.getBoundingClientRect();zoomAt(r.width/2,r.height/2,1.2);});',
  'bind("zout",function(){var r=stage.getBoundingClientRect();zoomAt(r.width/2,r.height/2,1/1.2);});',
  'bind("l1",function(){foldTo(1);});bind("l2",function(){foldTo(2);});bind("l3",function(){foldTo(3);});',
  'bind("lall",function(){st.collapsed=[];draw(true);});',
  'bind("full",function(){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen();});',
  'document.getElementById("theme").addEventListener("change",function(e){st.theme=e.target.value;draw(false);',
  ' var t=MM.themeInfo(st.theme);document.documentElement.style.setProperty("--bg",t.bg);',
  ' document.documentElement.style.setProperty("--ink",t.ink);document.documentElement.style.setProperty("--soft",t.inkSoft);',
  ' document.documentElement.style.setProperty("--line",t.line);document.documentElement.style.setProperty("--font",t.font);});',
  'document.getElementById("layout").addEventListener("change",function(e){st.layout=e.target.value;draw(false);fit();});',
  'var qt=null;document.getElementById("q").addEventListener("input",function(e){clearTimeout(qt);var val=e.target.value;',
  ' qt=setTimeout(function(){st.q=val;draw(true);},140);});',
  'bind("svg",function(){dl(new Blob([MM.render(SPEC,{theme:st.theme,layout:st.layout,collapsed:st.collapsed})],',
  ' {type:"image/svg+xml"}),(SPEC.title||"mindmap")+".svg");});',
  'bind("png",function(){var s=MM.render(SPEC,{theme:st.theme,layout:st.layout,collapsed:st.collapsed});',
  ' var img=new Image();img.onload=function(){var c=document.createElement("canvas");',
  '  c.width=img.width*2;c.height=img.height*2;var x=c.getContext("2d");x.scale(2,2);x.drawImage(img,0,0);',
  '  c.toBlob(function(b){dl(b,(SPEC.title||"mindmap")+".png");});};',
  ' img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s);});',
  'function dl(blob,name){var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();',
  ' setTimeout(function(){URL.revokeObjectURL(a.href);},2000);}',
  'document.addEventListener("keydown",function(e){var q=document.getElementById("q");',
  ' if(e.target===q){if(e.key==="Escape"){q.value="";st.q="";draw(true);q.blur();}return;}',
  ' if(e.key==="/"){e.preventDefault();q.focus();return;}',
  ' if(e.key==="0"){fit();}else if(e.key==="+"||e.key==="="){var r=stage.getBoundingClientRect();zoomAt(r.width/2,r.height/2,1.2);}',
  ' else if(e.key==="-"){var r2=stage.getBoundingClientRect();zoomAt(r2.width/2,r2.height/2,1/1.2);}',
  ' else if(e.key>="1"&&e.key<="9"){foldTo(+e.key);}',
  ' else if(e.key==="e"){st.collapsed=[];draw(true);}',
  ' else if(e.key==="f"){document.getElementById("full").click();}});',
    'draw(false);fit();',
  '})();'
].join('\n');

function toInteractive(spec, opts) {
  opts = opts || {};
  var src = opts.source || selfSource();
  if (!src) throw new Error('mindmap: toInteractive() needs the library source — call it from Node, or pass { source }');
  var theme = getTheme(opts.theme || spec.theme);
  var layout = opts.layout || spec.layout || 'map';
  var title = spec.title || 'mindmap';
  var css = VIEW_CSS
    .replace(/%BG%/g, theme.bg).replace(/%INK%/g, theme.ink)
    .replace(/%SOFT%/g, theme.inkSoft).replace(/%LINE%/g, tint(theme.ink, 0.78))
    .replace(/%FONT%/g, theme.font.replace(/"/g, "'"));
  var imports = Object.keys(THEMES).map(function (k) { return THEMES[k].fontImport; })
    .filter(function (u, i, a) { return u && a.indexOf(u) === i; })
    .map(function (u) { return '<link rel="stylesheet" href="' + esc(u) + '">'; }).join('\n');
  function opt(v, cur, label) {
    return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>';
  }
  var bar =
    '<div id="bar"><b>' + esc(title) + '</b>' +
    '<input id="q" type="search" placeholder="검색 (/)" autocomplete="off">' +
    '<span class="sp"></span>' +
    '<span class="grp"><button id="l1" title="1단계까지">1</button><button id="l2" title="2단계까지">2</button>' +
    '<button id="l3" title="3단계까지">3</button><button id="lall" title="모두 펼치기">전체</button></span>' +
    '<select id="layout" title="배치">' + opt('map', layout, '양쪽') + opt('right', layout, '오른쪽') + opt('down', layout, '위→아래') + '</select>' +
    '<select id="theme" title="테마">' + Object.keys(THEMES).map(function (k) { return opt(k, theme.name, k); }).join('') + '</select>' +
    '<span class="grp"><button id="zout">−</button><button id="fit" title="화면 맞춤 (0)">맞춤</button><button id="zin">+</button></span>' +
    '<button id="svg">SVG</button><button id="png">PNG</button><button id="full" title="전체화면 (f)">⛶</button></div>';
  var cfg = {
    spec: spec, theme: theme.name, layout: layout,
    collapsed: opts.collapsed ? opts.collapsed.slice() : initialCollapsed(spec)
  };
  var body =
    bar +
    '<div id="stage"><div id="wrap"></div></div>' +
    '<div id="hint">클릭 = 접기/펼치기 · 더블클릭 = 가운데로 · 드래그 = 이동 · 휠 = 확대 · 1~9 = 단계 접기 · / = 검색</div>' +
    '<div id="zoom"></div>\n' +
    '<scr' + 'ipt>' + src + '</' + 'script>\n' +
    '<scr' + 'ipt>window.__MM__=' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ';</' + 'script>\n' +
    '<scr' + 'ipt>' + VIEW_JS + '</' + 'script>\n';
  return docShell(theme, title, imports + '\n<style>' + css + '</style>\n', body);
}

/* ------------------------------------------------------------------ *
 * 발표 모드
 *
 * 슬라이드가 아니다 — 한 장의 맵을 그대로 두고 카메라가 갈래를 하나씩
 * 찾아간다. 보는 사람은 그 갈래가 전체 어디에 붙어 있는지를 계속 본다.
 * ------------------------------------------------------------------ */

var PRESENT_CSS = [
  ':root{--bg:%BG%;--ink:%INK%;--soft:%SOFT%;--line:%LINE%;--font:%FONT%;--accent:%ACCENT%}',
  '*{box-sizing:border-box}',
  'html,body{margin:0;height:100%;overflow:hidden;background:var(--shell,#0b0b0f);font-family:var(--font)}',
  '#stage{position:fixed;inset:0;overflow:hidden;background:var(--bg);cursor:pointer}',
  '#wrap{position:absolute;top:0;left:0;transform-origin:0 0;',
  ' transition:transform %MS%ms cubic-bezier(.4,.08,.2,1);will-change:transform}',
  '#wrap svg{display:block}',
  'g.mm-node,path.mm-edge,g.mm-links{transition:opacity .45s ease}',
  'g.mm-node.off,path.mm-edge.off{opacity:.12}',
  '#hint{position:fixed;left:22px;top:18px;font-size:14px;font-weight:700;color:var(--soft);',
  ' letter-spacing:.01em;pointer-events:none;max-width:52vw;overflow:hidden;text-overflow:ellipsis;',
  ' white-space:nowrap;z-index:4}',
  '#hud{position:fixed;left:0;right:0;bottom:0;height:44px;display:flex;align-items:center;gap:14px;',
  ' padding:0 20px;color:var(--soft);font-size:12.5px;z-index:4;pointer-events:none;',
  ' background:linear-gradient(transparent,color-mix(in srgb,var(--bg) 82%,transparent))}',
  '#label{font-weight:800;color:var(--ink);font-size:14px;white-space:nowrap;overflow:hidden;',
  ' text-overflow:ellipsis;max-width:40vw}',
  '#bar{flex:1;height:3px;background:var(--line);border-radius:2px;overflow:hidden}',
  '#bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .4s ease}',
  '#count{font-variant-numeric:tabular-nums}',
  '#help{position:fixed;right:20px;bottom:56px;background:color-mix(in srgb,var(--bg) 92%,transparent);',
  ' border:1px solid var(--line);color:var(--soft);border-radius:10px;padding:12px 14px;font-size:12.5px;',
  ' line-height:1.75;white-space:pre;display:none;z-index:5}',
  '#help.on{display:block}',
  '@media print{#hud,#hint,#help{display:none}}'
].join('');

function PresentRuntime() {
  'use strict';
  var C = window.__MMP__;
  var stage = document.getElementById('stage');
  var wrap = document.getElementById('wrap');
  var svg = wrap.querySelector('svg');
  var vb = svg.viewBox.baseVal;
  var W = vb.width, H = vb.height;
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.style.width = W + 'px'; svg.style.height = H + 'px';

  function tr(el) {
    var m = (el && el.getAttribute('transform') || '').match(/translate\(([-0-9.]+),([-0-9.]+)\)/);
    return m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 };
  }
  var canvas = svg.querySelector('g.mm-canvas');
  var off = tr(canvas);
  var nodes = [].slice.call(svg.querySelectorAll('g.mm-node')).map(function (el) {
    var t = tr(el);
    return {
      el: el, id: el.getAttribute('data-id'), depth: +el.getAttribute('data-depth'),
      x: off.x + t.x, y: off.y + t.y,
      w: +el.getAttribute('data-w') || 0, h: +el.getAttribute('data-h') || 0
    };
  });
  var edges = [].slice.call(svg.querySelectorAll('path.mm-edge'));
  var byId = {};
  nodes.forEach(function (n) { byId[n.id] = n; });
  var root = byId['r'] || nodes[0];

  /* 정차 지점: 전체 → 갈래(또는 갈래+그 아래) → … → 전체 */
  function subtree(id) {
    return nodes.filter(function (n) { return n.id === id || n.id.indexOf(id + '.') === 0; });
  }
  function boxOf(list) {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    list.forEach(function (n) {
      x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y);
      x2 = Math.max(x2, n.x + n.w); y2 = Math.max(y2, n.y + n.h);
    });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  var stops = [{ label: C.title || '전체', box: { x: 0, y: 0, w: W, h: H }, ids: null }];
  var seeds = nodes.filter(function (n) { return n.depth === 1; });
  if (C.stops === 'node') {
    seeds = nodes.filter(function (n) { return n.depth === 1 || n.depth === 2; })
      .sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  }
  seeds.forEach(function (n) {
    var list = subtree(n.id);
    var ids = {};
    list.forEach(function (m) { ids[m.id] = 1; });
    /* 맥락으로 함께 담을 노드: 갈래는 중심 노드, 더 깊은 노드는 바로 위 부모.
       깊은 노드까지 매번 루트를 담으면 구도가 너무 넓어진다. */
    var ctx = null;
    if (C.context !== false) {
      ctx = n.depth <= 1 ? root : byId[n.id.split('.').slice(0, -1).join('.')] || root;
    }
    var boxList = ctx ? list.concat([ctx]) : list;
    /* 노드 안의 text 조각들이 붙어 버리므로 사이를 띄워 잇는다 */
    var parts = [].slice.call(n.el.querySelectorAll('text')).map(function (t2) {
      return (t2.textContent || '').trim();
    }).filter(function (x) { return x; });
    var label = parts.join(' ').replace(/\s+/g, ' ').trim();
    stops.push({ label: label.length > 44 ? label.slice(0, 42) + '…' : label, box: boxOf(boxList), ids: ids, seed: n.id });
  });
  if (C.endOverview !== false && stops.length > 1) {
    stops.push({ label: C.title || '전체', box: { x: 0, y: 0, w: W, h: H }, ids: null });
  }

  var i = 0;
  function apply(k, x, y) { wrap.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')'; }
  function show(idx, quick) {
    i = Math.max(0, Math.min(stops.length - 1, idx));
    var st = stops[i];
    var r = stage.getBoundingClientRect();
    var pad = C.pad == null ? 60 : C.pad;
    var k = Math.min((r.width - pad * 2) / st.box.w, (r.height - pad * 2) / st.box.h, C.maxZoom || 2.2);
    var x = (r.width - st.box.w * k) / 2 - st.box.x * k;
    var y = (r.height - st.box.h * k) / 2 - st.box.y * k;
    if (quick) wrap.style.transition = 'none';
    apply(k, x, y);
    if (quick) requestAnimationFrame(function () { wrap.style.transition = ''; });

    var dim = C.dim !== false && st.ids;
    nodes.forEach(function (n) {
      var on = !dim || st.ids[n.id] || n.id === 'r';
      n.el.classList.toggle('off', !on);
    });
    edges.forEach(function (e) {
      var id = e.getAttribute('data-id');
      e.classList.toggle('off', !!dim && !(st.ids[id] || false));
    });
    var links = svg.querySelector('g.mm-links');
    if (links) links.style.opacity = dim ? 0.15 : 1;

    document.getElementById('label').textContent = st.label || '';
    document.getElementById('count').textContent = (i + 1) + ' / ' + stops.length;
    document.querySelector('#bar i').style.width = (stops.length < 2 ? 100 : i / (stops.length - 1) * 100) + '%';
    location.replace('#' + (i + 1));
  }

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowRight' || k === ' ' || k === 'PageDown') { e.preventDefault(); show(i + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); show(i - 1); }
    else if (k === 'Home') show(0);
    else if (k === 'End') show(stops.length - 1);
    else if (k === 'o' || k === 'O') show(0);
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }
    else if (k === '?' || k === '/') document.getElementById('help').classList.toggle('on');
    else if (/^[0-9]$/.test(k)) show(k === '0' ? 9 : +k - 1);
  });
  stage.addEventListener('click', function (e) {
    var r = stage.getBoundingClientRect();
    if ((e.clientX - r.left) / r.width < 0.2) show(i - 1); else show(i + 1);
  });
  stage.addEventListener('contextmenu', function (e) { e.preventDefault(); show(i - 1); });
  var sx = null;
  stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (sx == null) return;
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
    sx = null;
  }, { passive: true });
  window.addEventListener('resize', function () { show(i, true); });

  var m = (location.hash || '').match(/^#(\d+)/);
  show(m ? +m[1] - 1 : 0, true);
  window.MMP = { go: show, stops: stops.length };
}

function toPresentation(spec, opts) {
  opts = opts || {};
  var theme = getTheme(opts.theme || spec.theme);
  var title = spec.title || (spec.root && spec.root.text) || 'mindmap';
  var svg = render(spec, assign({}, opts, {
    collapsed: opts.respectCollapsed ? opts.collapsed : [],
    heading: false
  }));
  var css = PRESENT_CSS
    .replace(/%BG%/g, theme.bg).replace(/%INK%/g, theme.ink)
    .replace(/%SOFT%/g, theme.inkSoft).replace(/%LINE%/g, tint(theme.ink, 0.78))
    .replace(/%ACCENT%/g, theme.palette[ACCENT_ORDER[0]].s)
    .replace(/%FONT%/g, theme.font.replace(/"/g, "'"))
    .replace(/%MS%/g, String(num(opts.transition, 780)));
  var cfg = {
    title: title,
    stops: opts.stops === 'node' ? 'node' : 'branch',
    context: opts.context !== false,
    dim: opts.dim !== false,
    pad: num(opts.pad, 60),
    maxZoom: num(opts.maxZoom, 2.2),
    endOverview: opts.endOverview !== false
  };
  var help = ['← →  이동', 'O    전체 보기', 'F    전체화면', '0-9  바로가기'].join('\n');
  return docShell(theme, title,
    '<style>' + css + '</style>\n',
    '<div id="stage"><div id="wrap">' + svg + '</div></div>\n' +
    (opts.hint === false ? '' : '<div id="hint">' + esc(title) + '</div>\n') +
    '<div id="hud"><span id="label"></span><span id="bar"><i></i></span><span id="count"></span></div>\n' +
    '<div id="help">' + esc(help) + '</div>\n' +
    '<scr' + 'ipt>window.__MMP__=' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ';</' + 'script>\n' +
    '<scr' + 'ipt>(' + PresentRuntime.toString() + ')();</' + 'script>\n');
}


/** Theme colours for chrome outside the SVG (used by the interactive page). */
function themeInfo(name) {
  var t = getTheme(name);
  return { bg: t.bg, ink: t.ink, inkSoft: t.inkSoft, line: tint(t.ink, 0.78), font: t.font };
}


  return {
    version: VERSION,
    render: render,
    validate: validate,
    toHTML: toHTML,
    toInteractive: toInteractive,
    toPresentation: toPresentation,
    toDataURI: toDataURI,
    mount: mount,
    fromMarkdown: fromMarkdown,
    outline: outline,
    initialCollapsed: initialCollapsed,
    inlineImages: inlineImages,
    icons: function () { return Object.keys(ICONS).sort(); },
    themeInfo: themeInfo,
    get themes() { return Object.keys(THEMES); },
    get layouts() { return ['map', 'right', 'down']; },
    get colors() { return ACCENT_ORDER.slice(); },
    get densities() { return Object.keys(DENSITY); },
    _internal: {
      normalize: normalize, layoutTree: layoutTree, measureNode: measureNode,
      fit: fit, measure: measure, getTheme: getTheme, resolveColor: resolveColor
    }
  };
}));
