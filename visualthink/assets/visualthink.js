/*!
 * visualthink v0.1.0 - declarative JSON -> hand-drawn visual-thinking SVG
 * MIT License. No runtime dependencies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.VT = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';


/* ------------------------------------------------------------------ *
 * util
 * ------------------------------------------------------------------ */

var VERSION = '0.1.0';

/** Deterministic PRNG so the same spec always renders the same jitter. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  return mulberry32(hashCode(String(seed == null ? 'visualthink' : seed)));
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** Serialize an attribute map; null/undefined/false entries are dropped. */
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
  if (inner == null || inner === '') return '<' + tag + attrStr(attrs) + '/>';
  return '<' + tag + attrStr(attrs) + '>' + inner + '</' + tag + '>';
}

function g(attrs, inner) { return el('g', attrs, inner || ''); }

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

function num(v, dflt) { return typeof v === 'number' && isFinite(v) ? v : dflt; }

function arr(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }

/** Round to 2dp to keep path data compact. */
function r2(n) { return Math.round(n * 100) / 100; }

function assign(target) {
  for (var i = 1; i < arguments.length; i++) {
    var src = arguments[i];
    if (!src) continue;
    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
  }
  return target;
}


/* ------------------------------------------------------------------ *
 * text metrics
 *
 * SVG has no auto-wrapping, and we must work identically in Node (no
 * canvas.measureText). So widths are estimated from codepoint classes.
 * Values are tuned against Gaegu / Pretendard / system-ui at 16px and
 * run ~4% wide, which errs on the safe side (text never overflows).
 * ------------------------------------------------------------------ */

var NARROW_RE = /[iIl|.,;:'`!\[\](){}\-]/;
var WIDE_RE = /[mwMW@%]/;
var UPPER_RE = /[A-Z]/;
var DIGIT_RE = /[0-9]/;

/** Relative advance width of one codepoint, in em units. */
function charEm(ch) {
  var c = ch.codePointAt(0);
  // Fullwidth CJK, Hangul syllables/jamo, kana, CJK punctuation.
  if ((c >= 0x1100 && c <= 0x11FF) || (c >= 0x2E80 && c <= 0xA4CF) ||
      (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0xF900 && c <= 0xFAFF) ||
      (c >= 0xFE30 && c <= 0xFE4F) || (c >= 0xFF00 && c <= 0xFF60) ||
      (c >= 0xFFE0 && c <= 0xFFE6)) return 1.0;
  // Emoji and other astral-plane symbols render roughly square.
  if (c > 0xFFFF) return 1.15;
  if (c >= 0x2190 && c <= 0x2BFF) return 1.0; // arrows, geometric shapes
  if (ch === ' ') return 0.28;
  if (ch === '\t') return 1.12;
  if (NARROW_RE.test(ch)) return 0.30;
  if (WIDE_RE.test(ch)) return 0.86;
  if (UPPER_RE.test(ch)) return 0.63;
  if (DIGIT_RE.test(ch)) return 0.55;
  return 0.52;
}

/**
 * Estimated rendered width of `str` at `size` px.
 * `tracking` is letter-spacing in em; it must be included here or typographic
 * themes that tighten headlines would wrap at the wrong column.
 */
function measure(str, size, weight, tracking) {
  var s = String(str == null ? '' : str);
  var sum = 0;
  var chars = Array.from(s);
  for (var i = 0; i < chars.length; i++) sum += charEm(chars[i]);
  // Bold text is measurably wider at the same nominal size.
  var bold = (weight === 'bold' || weight === 700 || weight === '700' ||
    weight === 800 || weight === '800' || weight === 900 || weight === '900') ? 1.06 : 1;
  var track = (tracking || 0) * size * Math.max(0, chars.length - 1);
  return sum * size * bold + track;
}

/**
 * Break a token that is itself wider than maxW into character-level chunks.
 * Needed for long URLs and unspaced CJK runs.
 */
function breakToken(token, maxW, size) {
  var out = [];
  var chars = Array.from(token);
  var cur = '', curW = 0;
  for (var i = 0; i < chars.length; i++) {
    var w = charEm(chars[i]) * size;
    if (cur && curW + w > maxW) { out.push(cur); cur = ''; curW = 0; }
    cur += chars[i]; curW += w;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Word-wrap to `maxW`. Honours explicit \n. Korean wraps on eojeol
 * (space-delimited) boundaries, which reads far better than char-level.
 */
function wrap(str, maxW, size, weight, tracking) {
  var text = String(str == null ? '' : str);
  if (!text) return [''];
  var lines = [];
  var paras = text.split('\n');

  for (var p = 0; p < paras.length; p++) {
    var words = paras[p].split(/(\s+)/).filter(function (t) { return t !== ''; });
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      var isSpace = /^\s+$/.test(word);
      var cand = cur + word;
      if (measure(cand, size, weight, tracking) <= maxW || !cur) {
        // A single token too wide even on a fresh line must be hard-broken.
        if (!cur && !isSpace && measure(word, size, weight, tracking) > maxW) {
          var chunks = breakToken(word, maxW, size);
          for (var k = 0; k < chunks.length - 1; k++) lines.push(chunks[k]);
          cur = chunks[chunks.length - 1];
          continue;
        }
        cur = cand;
      } else {
        lines.push(cur.replace(/\s+$/, ''));
        cur = isSpace ? '' : word;
      }
    }
    lines.push(cur.replace(/\s+$/, ''));
  }
  return lines.length ? lines : [''];
}

function truncateLine(line, maxW, size, weight, tracking) {
  if (measure(line, size, weight, tracking) <= maxW) return line;
  var chars = Array.from(line);
  var ell = '…';
  var ellW = measure(ell, size, weight, tracking);
  var out = '', w = 0;
  for (var i = 0; i < chars.length; i++) {
    var cw = charEm(chars[i]) * size;
    if (w + cw + ellW > maxW) break;
    out += chars[i]; w += cw;
  }
  return out.replace(/\s+$/, '') + ell;
}

/**
 * Fit text into a box, shrinking the font before resorting to ellipsis.
 * Returns the chosen size plus the laid-out lines.
 *
 *   opts: { maxLines, minSize, lineHeight, weight }
 */
function fit(str, maxW, size, opts) {
  opts = opts || {};
  var lh = num(opts.lineHeight, 1.32);
  var minSize = num(opts.minSize, Math.max(9, size * 0.62));
  var maxLines = num(opts.maxLines, Infinity);
  var weight = opts.weight;
  var tracking = opts.tracking || 0;
  var s = size;

  while (true) {
    var lines = wrap(str, maxW, s, weight, tracking);
    if (lines.length <= maxLines || s <= minSize) {
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[lines.length - 1] = truncateLine(lines[lines.length - 1] + '…', maxW, s, weight, tracking);
      }
      return {
        lines: lines, size: s, tracking: tracking,
        lineHeight: s * lh, height: lines.length * s * lh
      };
    }
    s = Math.max(minSize, s - 0.5);
  }
}

/** Widest line width across a laid-out block. */
function widestLine(lines, size, weight, tracking) {
  var w = 0;
  for (var i = 0; i < lines.length; i++) w = Math.max(w, measure(lines[i], size, weight, tracking));
  return w;
}


/* ------------------------------------------------------------------ *
 * hand-drawn primitives
 *
 * Each shape is emitted as SVG path data with seeded jitter. Passing
 * roughness = 0 collapses every routine to exact geometry, which is how
 * the `flat` theme reuses the same drawing code.
 * ------------------------------------------------------------------ */

/** Drawing options carrier. */
function ctxOf(t, rng) {
  return { rough: t.roughness, bow: t.bowing, rng: rng, passes: t.passes };
}

/**
 * Exact-geometry options, used to build a *fill* layer.
 *
 * Hand-drawn rects and polygons are emitted as independent line subpaths, so
 * SVG cannot fill them - each stroke closes onto itself and the interior stays
 * empty. The fix is Rough.js's: fill with clean geometry, then draw the wobbly
 * outline on top. The stub rng returns a constant so building the fill layer
 * consumes no randomness and the outline's jitter stays reproducible.
 */
function exactOpts() {
  return { rough: 0, bow: 0, rng: constHalf, passes: 1 };
}
function constHalf() { return 0.5; }

function jit(o, amp) { return (o.rng() * 2 - 1) * amp; }

/** Jitter amplitude scales with segment length but is capped, like a real pen. */
function amp(o, len) {
  if (!o.rough) return 0;
  return Math.min(o.rough * 1.4, len / 14 + o.rough * 0.5);
}

/** One stroke of a line, as a cubic that bows slightly off-axis. */
function strokeLine(x1, y1, x2, y2, o, scale) {
  var len = Math.hypot(x2 - x1, y2 - y1);
  var a = amp(o, len) * (scale == null ? 1 : scale);
  if (!a) return 'M' + r2(x1) + ' ' + r2(y1) + 'L' + r2(x2) + ' ' + r2(y2);

  // Bow perpendicular to the segment so long lines curve like a drawn stroke.
  var nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1);
  var bow = (o.rng() * 2 - 1) * o.bow * Math.min(len / 100, 1.4);

  var c1x = x1 + (x2 - x1) * 0.33 + nx * bow + jit(o, a);
  var c1y = y1 + (y2 - y1) * 0.33 + ny * bow + jit(o, a);
  var c2x = x1 + (x2 - x1) * 0.68 + nx * bow + jit(o, a);
  var c2y = y1 + (y2 - y1) * 0.68 + ny * bow + jit(o, a);

  return 'M' + r2(x1 + jit(o, a * 0.6)) + ' ' + r2(y1 + jit(o, a * 0.6)) +
    'C' + r2(c1x) + ' ' + r2(c1y) + ',' + r2(c2x) + ' ' + r2(c2y) +
    ',' + r2(x2 + jit(o, a * 0.6)) + ' ' + r2(y2 + jit(o, a * 0.6));
}

/** A line drawn with `passes` overlapping strokes (2 reads as hand-drawn). */
function rLine(x1, y1, x2, y2, o) {
  var d = strokeLine(x1, y1, x2, y2, o);
  if (o.rough && o.passes > 1) d += strokeLine(x1, y1, x2, y2, o, 0.7);
  return d;
}

/**
 * Rectangle drawn as four independent strokes. Corners overshoot slightly,
 * which is the single strongest cue that a box was drawn by hand.
 */
function rRect(x, y, w, h, o) {
  if (!o.rough) {
    return 'M' + r2(x) + ' ' + r2(y) + 'h' + r2(w) + 'v' + r2(h) + 'h' + r2(-w) + 'z';
  }
  var ov = function () { return o.rough * (0.5 + o.rng() * 1.6); };
  var d = '';
  d += rLine(x - ov() * 0.4, y, x + w + ov(), y, o);
  d += rLine(x + w, y - ov() * 0.4, x + w, y + h + ov(), o);
  d += rLine(x + w + ov() * 0.4, y + h, x - ov(), y + h, o);
  d += rLine(x, y + h + ov() * 0.4, x, y - ov(), o);
  return d;
}

function rRoundRect(x, y, w, h, radius, o) {
  var rr = Math.min(radius, w / 2, h / 2);
  if (!o.rough) {
    return 'M' + r2(x + rr) + ' ' + r2(y) +
      'h' + r2(w - 2 * rr) + 'a' + r2(rr) + ' ' + r2(rr) + ' 0 0 1 ' + r2(rr) + ' ' + r2(rr) +
      'v' + r2(h - 2 * rr) + 'a' + r2(rr) + ' ' + r2(rr) + ' 0 0 1 ' + r2(-rr) + ' ' + r2(rr) +
      'h' + r2(-(w - 2 * rr)) + 'a' + r2(rr) + ' ' + r2(rr) + ' 0 0 1 ' + r2(-rr) + ' ' + r2(-rr) +
      'v' + r2(-(h - 2 * rr)) + 'a' + r2(rr) + ' ' + r2(rr) + ' 0 0 1 ' + r2(rr) + ' ' + r2(-rr) + 'z';
  }
  // Hand-drawn rounded corners: straight runs plus quadratic elbows.
  var a = o.rough * 0.9;
  var j = function () { return jit(o, a); };
  var d = 'M' + r2(x + rr + j()) + ' ' + r2(y + j());
  d += 'L' + r2(x + w - rr + j()) + ' ' + r2(y + j());
  d += 'Q' + r2(x + w + j()) + ' ' + r2(y + j()) + ' ' + r2(x + w + j()) + ' ' + r2(y + rr + j());
  d += 'L' + r2(x + w + j()) + ' ' + r2(y + h - rr + j());
  d += 'Q' + r2(x + w + j()) + ' ' + r2(y + h + j()) + ' ' + r2(x + w - rr + j()) + ' ' + r2(y + h + j());
  d += 'L' + r2(x + rr + j()) + ' ' + r2(y + h + j());
  d += 'Q' + r2(x + j()) + ' ' + r2(y + h + j()) + ' ' + r2(x + j()) + ' ' + r2(y + h - rr + j());
  d += 'L' + r2(x + j()) + ' ' + r2(y + rr + j());
  d += 'Q' + r2(x + j()) + ' ' + r2(y + j()) + ' ' + r2(x + rr + j()) + ' ' + r2(y + j());
  d += 'Z';
  return d;
}

/** Closed ellipse sampled at 14 points with per-point radius noise. */
function rEllipse(cx, cy, rx, ry, o) {
  if (!o.rough) {
    return 'M' + r2(cx - rx) + ' ' + r2(cy) +
      'a' + r2(rx) + ' ' + r2(ry) + ' 0 1 0 ' + r2(rx * 2) + ' 0' +
      'a' + r2(rx) + ' ' + r2(ry) + ' 0 1 0 ' + r2(-rx * 2) + ' 0z';
  }
  var steps = 14;
  var a = Math.min(o.rough * 1.5, Math.max(rx, ry) / 12 + o.rough);
  var pts = [];
  // Overshoot past a full turn so the stroke closes with a visible overlap.
  for (var i = 0; i <= steps + 1; i++) {
    var th = (i / steps) * Math.PI * 2;
    pts.push([
      cx + Math.cos(th) * (rx + jit(o, a)),
      cy + Math.sin(th) * (ry + jit(o, a))
    ]);
  }
  return catmull(pts, false);
}

/** Catmull-Rom through points, converted to cubic beziers. */
function catmull(pts, closed) {
  if (pts.length < 2) return '';
  var p = pts.slice();
  if (closed) p = [pts[pts.length - 1]].concat(pts, [pts[0], pts[1]]);
  else p = [pts[0]].concat(pts, [pts[pts.length - 1]]);

  var d = 'M' + r2(p[1][0]) + ' ' + r2(p[1][1]);
  for (var i = 1; i < p.length - 2; i++) {
    var p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    d += 'C' + r2(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + r2(p1[1] + (p2[1] - p0[1]) / 6) +
      ',' + r2(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + r2(p2[1] - (p3[1] - p1[1]) / 6) +
      ',' + r2(p2[0]) + ' ' + r2(p2[1]);
  }
  return d;
}

/** Polyline / polygon with jitter applied to every vertex. */
function rPoly(points, closed, o) {
  if (!o.rough) {
    // One continuous subpath, so the result is fillable. Emitting a separate
    // line per edge (as the jittered branch must) leaves the interior empty.
    var p = 'M' + r2(points[0][0]) + ' ' + r2(points[0][1]);
    for (var k = 1; k < points.length; k++) p += 'L' + r2(points[k][0]) + ' ' + r2(points[k][1]);
    return closed ? p + 'Z' : p;
  }
  var d = '';
  for (var i = 0; i < points.length - 1; i++) {
    d += rLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], o);
  }
  if (closed && points.length > 2) {
    d += rLine(points[points.length - 1][0], points[points.length - 1][1], points[0][0], points[0][1], o);
  }
  return d;
}

/** Two short strokes forming an open arrow head pointing along `angle`. */
function arrowHead(x, y, angle, size, o) {
  var spread = 0.44;
  var a1 = angle + Math.PI - spread, a2 = angle + Math.PI + spread;
  return rLine(x, y, x + Math.cos(a1) * size, y + Math.sin(a1) * size, o) +
    rLine(x, y, x + Math.cos(a2) * size, y + Math.sin(a2) * size, o);
}

/** Straight arrow from (x1,y1) to (x2,y2). */
function rArrow(x1, y1, x2, y2, o, headSize) {
  var ang = Math.atan2(y2 - y1, x2 - x1);
  var hs = num(headSize, 10);
  return rLine(x1, y1, x2, y2, o) + arrowHead(x2, y2, ang, hs, o);
}

/**
 * Curved arrow bulging perpendicular to the chord by `bend` px.
 * Used for cycle diagrams and mindmap branches.
 */
function rCurveArrow(x1, y1, x2, y2, bend, o, headSize) {
  var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  var dx = x2 - x1, dy = y2 - y1;
  var len = Math.hypot(dx, dy) || 1;
  var cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
  var a = o.rough ? o.rough * 0.8 : 0;

  var d = 'M' + r2(x1 + jit(o, a)) + ' ' + r2(y1 + jit(o, a)) +
    'Q' + r2(cx + jit(o, a)) + ' ' + r2(cy + jit(o, a)) + ' ' + r2(x2 + jit(o, a)) + ' ' + r2(y2 + jit(o, a));
  // Tangent at t=1 of the quadratic gives the head angle.
  var ang = Math.atan2(y2 - cy, x2 - cx);
  return d + arrowHead(x2, y2, ang, num(headSize, 10), o);
}

/** Diagonal hachure fill, clipped to a rect. Cheap "shaded" look. */
function hachure(x, y, w, h, gap, angleDeg, o) {
  var d = '';
  var rad = (angleDeg == null ? -45 : angleDeg) * Math.PI / 180;
  var tan = Math.tan(rad);
  var step = gap || 8;
  // Sweep the intercept range that can possibly cross the rect.
  var start = y - Math.abs(w * tan);
  var end = y + h + Math.abs(w * tan);
  for (var b = start; b <= end; b += step) {
    var p1 = null, p2 = null;
    var yAtLeft = b + (x - x) * tan;
    var yAtRight = b + w * tan;
    var pts = [];
    if (yAtLeft >= y && yAtLeft <= y + h) pts.push([x, yAtLeft]);
    if (yAtRight >= y && yAtRight <= y + h) pts.push([x + w, yAtRight]);
    var xAtTop = x + (y - b) / (tan || 1e-6);
    var xAtBottom = x + (y + h - b) / (tan || 1e-6);
    if (xAtTop >= x && xAtTop <= x + w) pts.push([xAtTop, y]);
    if (xAtBottom >= x && xAtBottom <= x + w) pts.push([xAtBottom, y + h]);
    if (pts.length >= 2) {
      p1 = pts[0]; p2 = pts[1];
      d += rLine(p1[0], p1[1], p2[0], p2[1], { rough: o.rough * 0.6, bow: 0.4, rng: o.rng, passes: 1 });
    }
  }
  return d;
}

/* ------------------------------------------------------------------ *
 * decorative container shapes
 *
 * Shape carries meaning in a sketchnote: a cloud is an idea, a burst is
 * an alarm, a banner is a heading. These all fill the same (x, y, w, h)
 * box so any block can swap one in without touching its layout.
 * ------------------------------------------------------------------ */

/**
 * Cloud built from circular lobes. Smoothing points with a spline gives a
 * lumpy ellipse instead; the bulges have to be actual arcs to read as cloud.
 */
function rCloud(x, y, w, h, o) {
  var cx = x + w / 2, cy = y + h / 2;
  var rx = w / 2, ry = h / 2;
  var n = Math.max(9, Math.round(w / 38));
  var pts = [];
  for (var i = 0; i < n; i++) {
    var th = (i / n) * Math.PI * 2 - Math.PI / 2;
    var k = o.rough ? 1 + (o.rng() - 0.5) * 0.07 : 1;
    pts.push([cx + Math.cos(th) * rx * 0.84 * k, cy + Math.sin(th) * ry * 0.84 * k]);
  }
  // Lobe radius must exceed half the chord or the arc silently flattens.
  var chord = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
  var lobe = chord * 0.62;
  var d = 'M' + r2(pts[0][0]) + ' ' + r2(pts[0][1]);
  for (var j = 1; j <= n; j++) {
    var p = pts[j % n];
    d += 'A' + r2(lobe) + ' ' + r2(lobe) + ' 0 0 1 ' + r2(p[0]) + ' ' + r2(p[1]);
  }
  return d + 'Z';
}

/** Comic starburst: alternating outer spikes and inner valleys. */
function rBurst(x, y, w, h, o) {
  var cx = x + w / 2, cy = y + h / 2;
  var spikes = Math.max(9, Math.round(w / 34));
  var pts = [];
  for (var i = 0; i < spikes * 2; i++) {
    var th = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    var out = i % 2 === 0;
    var k = out ? 1 : 0.76;
    if (o.rough) k += (o.rng() - 0.5) * 0.08;
    pts.push([cx + Math.cos(th) * (w / 2) * k, cy + Math.sin(th) * (h / 2) * k]);
  }
  return rPoly(pts, true, o);
}

/** Ribbon banner: a bar with swallow-tail notches cut into both ends. */
function rBanner(x, y, w, h, o) {
  var notch = Math.min(h * 0.5, w * 0.09);
  return rPoly([
    [x, y], [x + w, y],
    [x + w - notch, y + h / 2], [x + w, y + h],
    [x, y + h], [x + notch, y + h / 2]
  ], true, o);
}

/** Luggage tag: one corner cut off, with a punched hole. */
function rTag(x, y, w, h, o) {
  var cut = Math.min(h * 0.42, w * 0.16);
  return rPoly([
    [x + cut, y], [x + w, y], [x + w, y + h], [x + cut, y + h], [x, y + h / 2]
  ], true, o);
}

/** Scroll: straight sides, curled top and bottom edges. */
function rScroll(x, y, w, h, o) {
  var curl = Math.min(h * 0.10, 7);
  var a = o.rough ? o.rough * 0.7 : 0;
  var j = function () { return jit(o, a); };
  return 'M' + r2(x + j()) + ' ' + r2(y + curl) +
    'Q' + r2(x + w * 0.25) + ' ' + r2(y - curl) + ' ' + r2(x + w * 0.5) + ' ' + r2(y + curl * 0.35) +
    'Q' + r2(x + w * 0.75) + ' ' + r2(y + curl * 1.5) + ' ' + r2(x + w + j()) + ' ' + r2(y + curl * 0.2) +
    'L' + r2(x + w + j()) + ' ' + r2(y + h - curl * 0.2) +
    'Q' + r2(x + w * 0.75) + ' ' + r2(y + h - curl * 1.5) + ' ' + r2(x + w * 0.5) + ' ' + r2(y + h - curl * 0.35) +
    'Q' + r2(x + w * 0.25) + ' ' + r2(y + h + curl) + ' ' + r2(x + j()) + ' ' + r2(y + h - curl) + 'Z';
}

/** Regular hexagon inscribed in the box. */
function rHex(x, y, w, h, o) {
  var i = w * 0.18;
  return rPoly([
    [x + i, y], [x + w - i, y], [x + w, y + h / 2],
    [x + w - i, y + h], [x + i, y + h], [x, y + h / 2]
  ], true, o);
}

/**
 * Highlighter swipe: a slightly tilted translucent band with ragged ends,
 * drawn *behind* text. The signature visual-thinking emphasis mark.
 */
function highlightBand(x, y, w, h, o) {
  // Exact themes get a clean band; the ragged sweep only reads as a
  // highlighter next to hand-drawn strokes, and looks like a smudge otherwise.
  if (!o.rough) {
    return 'M' + r2(x) + ' ' + r2(y) + 'h' + r2(w) + 'v' + r2(h) + 'h' + r2(-w) + 'z';
  }
  var wob = o.rough * 1.2;
  var tilt = (o.rng() * 2 - 1) * 1.6;
  var pts = [
    [x - wob, y + jit(o, wob)],
    [x + w * 0.5, y + tilt * 0.4 + jit(o, wob)],
    [x + w + wob, y + tilt + jit(o, wob)],
    [x + w + wob * 1.4, y + h + tilt + jit(o, wob)],
    [x + w * 0.5, y + h + tilt * 0.4 + jit(o, wob)],
    [x - wob * 1.2, y + h + jit(o, wob)]
  ];
  return catmull(pts, true) + 'Z';
}


/* ------------------------------------------------------------------ *
 * themes
 *
 * A theme is the only place style lives. Block renderers never hardcode
 * a colour or a stroke width; they ask the theme. `roughness: 0` turns
 * the same drawing code into clean vector output.
 * ------------------------------------------------------------------ */

/*
 * Hand-drawn body text has to stay *legible* in Korean. Gaegu is charming but
 * its strokes are thin and its jamo collapse at note sizes, so body copy uses
 * Gamja Flower (clearer counters, still handwritten) while headings use Jua
 * (round, genuinely bold, unambiguous). Both fall back to system-ui, which
 * degrades to a plain sans rather than to something unreadable.
 */
var HAND_BODY_FONTS = "'Gamja Flower','Gaegu','Segoe Print',system-ui,sans-serif";
var HAND_TITLE_FONTS = "'Jua','Gaegu','Segoe Print',system-ui,sans-serif";
var CLEAN_FONTS = "'Pretendard','Pretendard Variable',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
var SERIF_FONTS = "'Nanum Myeongjo','Noto Serif KR',Georgia,'Times New Roman','Apple SD Gothic Neo',serif";

/**
 * "Chrome" is everything a theme decides about the *containers* rather than
 * the colours: whether cards are drawn as boxes at all, what replaces the box
 * when they are not, and how headings are ruled. Typographic themes switch the
 * boxes off entirely and let type carry the hierarchy.
 */
var BASE_CHROME = {
  cardStroke: true,      // draw the card outline
  cardFill: true,        // fill the card with the accent tint
  cardRule: null,        // 'top' | 'left' — rule drawn instead of a box
  headRule: 'thin',      // block heading underline: 'thin' | 'full' | 'thick' | 'none'
  headScale: 1,          // block heading size multiplier
  titleScale: 1,         // title-block size multiplier
  bodyScale: 1,          // card text size multiplier
  tracking: 0,           // letter-spacing (em) for headings
  bodyTracking: 0,       // letter-spacing (em) for card text
  cardTitleFamily: 'body', // card headings: 'body' | 'title' font family
  numeral: 'circle',     // steps/list marker: 'circle' | 'plain'
  emphasis: 'marker'     // 'marker' (highlighter) | 'underline' | 'none'
};

var THEMES = {

  /* Hand-drawn sketchnote on warm paper. The default. */
  sketch: {
    name: 'sketch',
    roughness: 1.5,
    bowing: 1.2,
    passes: 2,
    strokeWidth: 2.1,
    strokeWidthThin: 1.5,
    radius: 10,
    bg: '#FCFAF3',
    ink: '#22262B',
    inkSoft: '#5C636B',
    font: HAND_BODY_FONTS,
    fontTitle: HAND_TITLE_FONTS,
    fontScale: 1.28,          // Gamja Flower renders small at a given px size
    titleFontScale: 1.02,     // Jua does not; headings need their own scale
    titleWeight: 'bold',
    shadow: false,
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
    highlight: '#FFE889',
    highlightOpacity: 0.72,
    chrome: { headRule: 'thin', cardTitleFamily: 'title' }
  },

  /* Clean flat infographic. Same layout, exact geometry. */
  flat: {
    name: 'flat',
    roughness: 0,
    bowing: 0,
    passes: 1,
    strokeWidth: 1.7,
    strokeWidthThin: 1.2,
    radius: 12,
    bg: '#FFFFFF',
    ink: '#111827',
    inkSoft: '#6B7280',
    font: CLEAN_FONTS,
    fontTitle: CLEAN_FONTS,
    fontScale: 1.0,
    titleWeight: '700',
    shadow: true,
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
    highlight: '#FDE68A',
    highlightOpacity: 0.6,
    chrome: { headRule: 'thin' }
  },

  /* ---------------------------------------------------------------- *
   * editorial — type-led. No boxes; a hairline rule and a serif
   * headline do the work a border used to do. Colour is a single
   * accent per item, applied to rules and icons, never to fills.
   * ---------------------------------------------------------------- */
  editorial: {
    name: 'editorial',
    roughness: 0,
    bowing: 0,
    passes: 1,
    strokeWidth: 1.1,
    strokeWidthThin: 0.8,
    radius: 0,
    bg: '#FBFAF7',
    ink: '#16161A',
    inkSoft: '#6E6A63',
    font: SERIF_FONTS,
    fontTitle: SERIF_FONTS,
    fontScale: 1.0,
    titleWeight: '700',
    shadow: false,
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
    highlight: '#E8E2D4',
    highlightOpacity: 0.85,
    chrome: {
      cardStroke: false, cardFill: false, cardRule: 'top',
      headRule: 'full', headScale: 1.15, titleScale: 1.3,
      tracking: -0.015, numeral: 'plain', emphasis: 'underline'
    }
  },

  /* ---------------------------------------------------------------- *
   * bold — poster. Oversized weight-800 headlines, square corners,
   * thick strokes, saturated blocks. Built to be read across a room.
   * ---------------------------------------------------------------- */
  bold: {
    name: 'bold',
    roughness: 0,
    bowing: 0,
    passes: 1,
    strokeWidth: 2.8,
    strokeWidthThin: 1.8,
    radius: 0,
    bg: '#FAFAF8',
    ink: '#09090B',
    inkSoft: '#52525B',
    font: CLEAN_FONTS,
    fontTitle: CLEAN_FONTS,
    fontScale: 1.0,
    titleWeight: '800',
    shadow: false,
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
    highlight: '#FFE000',
    highlightOpacity: 1,
    chrome: {
      cardStroke: true, cardFill: true, cardRule: null,
      headRule: 'thick', headScale: 1.35, titleScale: 1.6,
      bodyScale: 1.1, tracking: -0.03, bodyTracking: -0.01, numeral: 'plain', emphasis: 'marker'
    }
  }
};

/** Order used when a block auto-assigns accents to its items. */
var ACCENT_ORDER = ['coral', 'teal', 'yellow', 'purple', 'green', 'blue', 'pink', 'gray'];

/**
 * Resolve a colour reference to a palette entry.
 * Accepts a palette name ('coral'), an index (0..n), or a raw hex string.
 */
function resolveColor(theme, ref, fallbackIndex) {
  if (ref == null) {
    var key = ACCENT_ORDER[(fallbackIndex || 0) % ACCENT_ORDER.length];
    return theme.palette[key];
  }
  if (typeof ref === 'number') {
    return theme.palette[ACCENT_ORDER[ref % ACCENT_ORDER.length]];
  }
  if (typeof ref === 'string') {
    if (theme.palette[ref]) return theme.palette[ref];
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(ref)) {
      // Raw hex: derive a tint for fills and keep ink readable.
      return { s: ref, f: tint(ref, 0.86), i: shade(ref, 0.45) };
    }
  }
  var k = ACCENT_ORDER[(fallbackIndex || 0) % ACCENT_ORDER.length];
  return theme.palette[k];
}

function hexToRgb(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r, g, b) {
  var f = function (n) { return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0'); };
  return '#' + f(r) + f(g) + f(b);
}

/** Mix toward white by `t`. */
function tint(hex, t) {
  var c = hexToRgb(hex);
  return rgbToHex(c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t);
}

/** Mix toward black by `t`. */
function shade(hex, t) {
  var c = hexToRgb(hex);
  return rgbToHex(c[0] * (1 - t), c[1] * (1 - t), c[2] * (1 - t));
}

/** Relative luminance, for picking readable text over an arbitrary fill. */
function luminance(hex) {
  var c = hexToRgb(hex).map(function (v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Pick whichever of the theme ink / white contrasts better with `bg`. */
function readableInk(theme, bg) {
  var lum = luminance(bg);
  return lum > 0.5 ? theme.ink : '#FFFFFF';
}

function getTheme(name) {
  var base, out;
  if (name && typeof name === 'object') {
    // Allow inline theme overrides: { theme: { base:'sketch', bg:'#fff' } }
    base = THEMES[name.base] || THEMES.sketch;
    out = assign({}, base, name);
    out.palette = assign({}, base.palette, name.palette || {});
    out.chrome = assign({}, BASE_CHROME, base.chrome, name.chrome || {});
    // An inline override that changes fontScale alone should move both,
    // unless it names titleFontScale explicitly.
    if (name.titleFontScale == null && name.fontScale != null) out.titleFontScale = name.fontScale;
    return withTitleScale(out);
  }
  base = THEMES[name] || THEMES.sketch;
  out = assign({}, base);
  // Copy so a caller mutating theme.chrome cannot corrupt the shared table.
  out.chrome = assign({}, BASE_CHROME, base.chrome);
  return withTitleScale(out);
}

/**
 * Body and heading families can need different optical sizes. When a theme
 * uses one family for both, the heading scale simply mirrors the body scale.
 */
function withTitleScale(t) {
  if (t.titleFontScale == null) t.titleFontScale = t.fontScale;
  return t;
}


/* ------------------------------------------------------------------ *
 * icons
 *
 * Stroke-only paths on a 24x24 grid, drawn with round caps so they sit
 * naturally next to hand-drawn shapes. Referenced by name from a spec:
 *   { text: 'Idea', icon: 'bulb' }
 * ------------------------------------------------------------------ */

var ICONS = {
  bulb: 'M12 3a6 6 0 0 0-3.6 10.8V16h7.2v-2.2A6 6 0 0 0 12 3z M9.4 19h5.2 M10.3 21.4h3.4',
  check: 'M4 12.6l5.2 5.2L20 6.6',
  cross: 'M5.2 5.2l13.6 13.6 M18.8 5.2L5.2 18.8',
  warn: 'M12 3.2L1.8 20.8h20.4z M12 9.4v5.4 M12 17.9v.1',
  star: 'M12 2.6l2.9 6.1 6.7.9-4.9 4.6 1.2 6.7L12 17.7l-5.9 3.2 1.2-6.7L2.4 9.6l6.7-.9z',
  person: 'M12 3.2a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4z M3.6 21.2c0-4.6 3.8-8.4 8.4-8.4s8.4 3.8 8.4 8.4',
  people: 'M9 4.4a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z M2 20.6c0-3.9 3.1-7 7-7s7 3.1 7 7 M16.4 5.2a3 3 0 0 1 0 5.8 M17.6 13.9c2.6.7 4.4 3 4.4 5.8',
  doc: 'M6 2.6h8l4.6 4.6v14.2H6z M14 2.6v4.8h4.6 M9 12.4h6 M9 15.8h6 M9 19.2h4',
  clock: 'M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8z M12 6.6V12l3.8 2.4',
  money: 'M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8z M12 5.8v12.4 M15 9.2c0-1.5-1.3-2.3-3-2.3s-3 .8-3 2.3 1.4 2 3 2.5 3 1 3 2.6-1.3 2.3-3 2.3-3-.9-3-2.4',
  target: 'M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8z M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6z M12 11.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z',
  question: 'M8.4 8.6a3.6 3.6 0 1 1 5.2 3.3c-1.1.6-1.6 1.4-1.6 2.6v.7 M12 19.2v.2',
  heart: 'M12 20.6S3 14.6 3 8.9a4.9 4.9 0 0 1 9-2.4 4.9 4.9 0 0 1 9 2.4c0 5.7-9 11.7-9 11.7z',
  chart: 'M3.2 20.8h17.6 M6.6 20.8v-8.4 M11.4 20.8V5.6 M16.2 20.8v-6.2',
  trend: 'M3 18.4l5.6-6 4 3.6L21 6.4 M21 6.4h-5.2 M21 6.4v5.2',
  flag: 'M5.6 21.2V3 M5.6 4.2h11.2l-2.3 4.1 2.3 4.1H5.6',
  lock: 'M7.2 10.6V8.2a4.8 4.8 0 0 1 9.6 0v2.4 M5.2 10.6h13.6v10H5.2z',
  search: 'M10.6 3.2a7.4 7.4 0 1 0 0 14.8 7.4 7.4 0 0 0 0-14.8z M16 16.2l4.8 4.8',
  fire: 'M12 21c3.9 0 6.6-2.5 6.6-6 0-4.6-4.6-6.6-4-12.2-3 2-5.6 5.1-5.6 8.2 0 1.5-1 2-1.5 1.2-.4-.6-.5-1.5-.5-2.2-1.3 1.4-2 3.3-2 5C5 18.5 8.1 21 12 21z',
  rocket: 'M12 2.6c3.4 2.6 5.2 6.2 5.2 10.2L12 17.8l-5.2-5c0-4 1.8-7.6 5.2-10.2z M12 9.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z M8.6 17.4L6 21.4l4.4-1.4 M15.4 17.4l2.6 4-4.4-1.4',
  eye: 'M1.8 12S5.6 5.6 12 5.6 22.2 12 22.2 12 18.4 18.4 12 18.4 1.8 12 1.8 12z M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z',
  shield: 'M12 2.6l8 3v6.2c0 4.6-3.2 8.6-8 9.6-4.8-1-8-5-8-9.6V5.6z M8.6 12l2.4 2.4 4.4-4.6',
  bolt: 'M13.6 2.4L5.2 13.4h5.6l-.4 8.2 8.4-11h-5.6z',
  link: 'M9.6 14.4a4.6 4.6 0 0 0 6.6 0l3-3a4.6 4.6 0 1 0-6.6-6.6L11 6.4 M14.4 9.6a4.6 4.6 0 0 0-6.6 0l-3 3a4.6 4.6 0 1 0 6.6 6.6L13 17.6',
  gear: 'M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z M12 1.8v3 M12 19.2v3 M4.8 12h-3 M22.2 12h-3 M6.9 6.9L4.8 4.8 M19.2 19.2l-2.1-2.1 M6.9 17.1l-2.1 2.1 M19.2 4.8l-2.1 2.1',
  brain: 'M9.4 3.6a3 3 0 0 0-2.9 3.7 3.2 3.2 0 0 0-1.3 5.3A3.2 3.2 0 0 0 7 18.2a3 3 0 0 0 5.2 2V4.9a3 3 0 0 0-2.8-1.3z M14.6 3.6a3 3 0 0 1 2.9 3.7 3.2 3.2 0 0 1 1.3 5.3 3.2 3.2 0 0 1-1.8 5.6 3 3 0 0 1-5.2 2',
  chat: 'M4 4.6h16v11.2H9.4L4.8 20v-4.2H4z M8.4 10.2h.1 M12 10.2h.1 M15.6 10.2h.1',
  calendar: 'M4 5.8h16v15.4H4z M4 10.2h16 M8.4 2.8v5 M15.6 2.8v5',
  book: 'M4 4.2h6a3 3 0 0 1 2 2.8v13a2.6 2.6 0 0 0-2-1.8H4z M20 4.2h-6a3 3 0 0 0-2 2.8v13a2.6 2.6 0 0 1 2-1.8h6z',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  arrowUp: 'M12 20V4.6 M5.6 11L12 4.6 18.4 11',
  arrowDown: 'M12 4v15.4 M5.6 13l6.4 6.4L18.4 13',
  globe: 'M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8z M2.6 12h18.8 M12 2.6c2.4 2.6 3.7 5.9 3.7 9.4s-1.3 6.8-3.7 9.4c-2.4-2.6-3.7-5.9-3.7-9.4S9.6 5.2 12 2.6z',
  pin: 'M12 2.8a6.4 6.4 0 0 0-6.4 6.4c0 4.8 6.4 12 6.4 12s6.4-7.2 6.4-12A6.4 6.4 0 0 0 12 2.8z M12 6.8a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z'
};

/** Alias table so agents can use natural names without lookups failing. */
var ICON_ALIASES = {
  idea: 'bulb', light: 'bulb', tip: 'bulb',
  ok: 'check', done: 'check', yes: 'check',
  no: 'cross', close: 'cross', fail: 'cross',
  alert: 'warn', danger: 'warn', caution: 'warn', risk: 'warn',
  user: 'person', team: 'people', group: 'people',
  file: 'doc', document: 'doc', note: 'doc',
  time: 'clock', schedule: 'clock', deadline: 'clock',
  cost: 'money', price: 'money', budget: 'money', revenue: 'money',
  goal: 'target', objective: 'target', focus: 'target',
  ask: 'question', why: 'question',
  bar: 'chart', data: 'chart', metric: 'chart',
  growth: 'trend', up: 'trend', increase: 'trend',
  milestone: 'flag', start: 'flag',
  security: 'shield', safe: 'shield', protect: 'shield',
  fast: 'bolt', energy: 'bolt', power: 'bolt',
  launch: 'rocket', ship: 'rocket',
  watch: 'eye', view: 'eye', observe: 'eye',
  think: 'brain', mind: 'brain', ai: 'brain',
  talk: 'chat', message: 'chat', feedback: 'chat',
  date: 'calendar', learn: 'book', study: 'book',
  hot: 'fire', urgent: 'fire',
  place: 'pin', location: 'pin', world: 'globe'
};

function resolveIcon(name) {
  if (!name) return null;
  var key = String(name).trim();
  if (ICONS[key]) return ICONS[key];
  var lower = key.toLowerCase();
  if (ICONS[lower]) return ICONS[lower];
  if (ICON_ALIASES[lower] && ICONS[ICON_ALIASES[lower]]) return ICONS[ICON_ALIASES[lower]];
  return null;
}

/**
 * Emit an icon centred at (cx, cy) scaled to `size` px.
 * Returns '' for unknown names so a typo degrades quietly instead of
 * throwing mid-render (validate() reports it separately).
 */
function drawIcon(name, cx, cy, size, color, theme) {
  var d = resolveIcon(name);
  if (!d) return '';
  var k = size / 24;
  return el('path', {
    d: d,
    transform: 'translate(' + r2(cx - size / 2) + ',' + r2(cy - size / 2) + ') scale(' + r2(k) + ')',
    fill: 'none',
    stroke: color,
    'stroke-width': r2(theme.strokeWidth / k * 0.85),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  });
}


/* ------------------------------------------------------------------ *
 * doodle figures
 *
 * Not anatomical stick figures - the sketchnote/emoji-doodle idiom:
 * a big head (~35% of total height, roughly 2.5 heads tall), an outlined
 * garment for a body, thin limbs, and a face large enough to carry real
 * expression. Effects (sparkles, sweat, hearts) orbit the head.
 *
 * Everything is expressed in units of total height so a figure reads the
 * same at 60px or 200px.
 *
 * Vertical anatomy, with the head-top at 0:
 *   head   0.00 - 0.35      body   0.36 - 0.68      legs   0.68 - 1.00
 * ------------------------------------------------------------------ */

var A = {
  headR: 0.175,      // head radius
  bodyTop: 0.365,
  bodyBot: 0.68,
  shoulderW: 0.15,   // shoulder width (full)
  hemShirt: 0.22,
  hemSkirt: 0.32,
  legGap: 0.045,
  handR: 0.019
};

/** Arms are [elbow, hand] offsets from the shoulder; legs from the hem. */
var POSES = {
  stand: {
    arm: [[[-0.09, 0.09], [-0.15, 0.20]], [[0.09, 0.09], [0.15, 0.20]]],
    leg: [[[-0.02, 0.16], [-0.04, 0.32]], [[0.02, 0.16], [0.04, 0.32]]]
  },
  point: {
    arm: [[[-0.09, 0.09], [-0.15, 0.20]], [[0.14, 0.04], [0.29, 0.00]]],
    leg: 'stand'
  },
  raise: {
    arm: [[[-0.10, -0.01], [-0.16, -0.14]], [[0.10, -0.01], [0.16, -0.14]]],
    leg: 'stand'
  },
  wave: {
    arm: [[[-0.09, 0.09], [-0.15, 0.20]], [[0.13, -0.01], [0.20, -0.15]]],
    leg: 'stand'
  },
  think: {
    // Hand to the chin; the elbow stays low or it reads as a wave.
    arm: [[[-0.09, 0.09], [-0.15, 0.20]], [[0.15, 0.13], [0.04, -0.01]]],
    leg: 'stand'
  },
  shrug: {
    // Elbows in, forearms turned out - palms up.
    arm: [[[-0.12, 0.06], [-0.21, -0.02]], [[0.12, 0.06], [0.21, -0.02]]],
    leg: 'stand'
  },
  hold: {
    arm: [[[-0.10, 0.08], [-0.04, 0.16]], [[0.10, 0.08], [0.04, 0.16]]],
    leg: 'stand'
  },
  strong: {
    // Flexed biceps, both sides.
    arm: [[[-0.14, 0.03], [-0.08, -0.09]], [[0.14, 0.03], [0.08, -0.09]]],
    leg: 'stand'
  },
  cheer: {
    arm: [[[-0.12, -0.02], [-0.19, -0.15]], [[0.12, -0.02], [0.19, -0.15]]],
    leg: [[[-0.05, 0.15], [-0.10, 0.31]], [[0.04, 0.14], [0.10, 0.28]]]
  },
  jump: {
    arm: [[[-0.12, -0.03], [-0.20, -0.14]], [[0.12, -0.03], [0.20, -0.14]]],
    leg: [[[-0.09, 0.13], [-0.16, 0.26]], [[0.09, 0.13], [0.16, 0.26]]]
  },
  walk: {
    arm: [[[-0.08, 0.07], [-0.14, 0.16]], [[0.07, 0.10], [0.11, 0.20]]],
    leg: [[[-0.06, 0.15], [-0.13, 0.31]], [[0.05, 0.16], [0.09, 0.32]]]
  },
  run: {
    arm: [[[-0.12, 0.03], [-0.20, 0.08]], [[0.10, 0.09], [0.19, 0.18]]],
    leg: [[[-0.12, 0.12], [-0.22, 0.24]], [[0.08, 0.18], [0.19, 0.30]]],
    tilt: 7
  },
  fall: {
    // Losing balance only reads if the whole figure tips over.
    arm: [[[-0.13, -0.02], [-0.21, -0.10]], [[0.13, 0.02], [0.22, -0.04]]],
    leg: [[[-0.10, 0.14], [-0.20, 0.20]], [[0.09, 0.16], [0.20, 0.28]]],
    tilt: -17
  },
  sit: {
    arm: [[[-0.09, 0.08], [-0.04, 0.17]], [[0.09, 0.08], [0.04, 0.17]]],
    leg: [[[-0.11, 0.06], [-0.13, 0.20]], [[0.11, 0.06], [0.13, 0.20]]]
  }
};

var POSE_ALIASES = {
  idle: 'stand', neutral: 'stand', 'default': 'stand',
  present: 'point', explain: 'point', show: 'point',
  win: 'raise', celebrate: 'raise', yay: 'raise',
  hello: 'wave', hi: 'wave', greet: 'wave',
  ponder: 'think', wonder: 'think', consider: 'think',
  confused: 'shrug', unsure: 'shrug', dunno: 'shrug',
  carry: 'hold', offer: 'hold',
  flex: 'strong', power: 'strong',
  move: 'walk', go: 'walk', rush: 'run', hurry: 'run',
  trip: 'fall', oops: 'fall', hop: 'jump'
};

/* --- faces -------------------------------------------------------- */

var FACES = {
  neutral:   { eye: 'dot',    mouth: 'line' },
  happy:     { eye: 'arc',    mouth: 'smile' },
  laugh:     { eye: 'arc',    mouth: 'open', tongue: false },
  sad:       { eye: 'sad',    mouth: 'frown' },
  cry:       { eye: 'closed', mouth: 'frown', tears: true },
  surprised: { eye: 'wide',   mouth: 'o' },
  shock:     { eye: 'wide',   mouth: 'open', brow: 'raised' },
  angry:     { eye: 'dot',    mouth: 'flat', brow: 'angry' },
  think:     { eye: 'squint', mouth: 'small', brow: 'raised' },
  love:      { eye: 'heart',  mouth: 'smile' },
  starry:    { eye: 'star',   mouth: 'open' },
  sleep:     { eye: 'closed', mouth: 'small' },
  wink:      { eye: 'wink',   mouth: 'smile' },
  worried:   { eye: 'dot',    mouth: 'wavy', brow: 'sad' },
  dead:      { eye: 'x',      mouth: 'wavy' },
  blank:     null
};

var FACE_ALIASES = {
  ok: 'happy', smile: 'happy', good: 'happy', yay: 'happy',
  haha: 'laugh', lol: 'laugh', joy: 'laugh',
  bad: 'sad', down: 'sad', boohoo: 'cry', tears: 'cry',
  wow: 'surprised', oh: 'surprised', omg: 'shock', panic: 'shock',
  hmm: 'think', ponder: 'think', curious: 'think',
  mad: 'angry', upset: 'angry', grr: 'angry',
  heart: 'love', like: 'love',
  amazed: 'starry', excited: 'starry',
  zzz: 'sleep', tired: 'sleep',
  nervous: 'worried', anxious: 'worried', ugh: 'worried',
  none: 'blank', plain: 'neutral'
};

function resolvePose(name) {
  var k = String(name || 'stand').toLowerCase();
  if (POSES[k]) return POSES[k];
  if (POSE_ALIASES[k]) return POSES[POSE_ALIASES[k]];
  return POSES.stand;
}

function resolveFaceSpec(name) {
  var k = String(name == null ? 'neutral' : name).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(FACES, k)) return FACES[k];
  if (FACE_ALIASES[k]) return FACES[FACE_ALIASES[k]];
  return FACES.neutral;
}

/** Tiny heart, centred, sized to `s`. */
function heartPath(cx, cy, s) {
  return 'M' + r2(cx) + ' ' + r2(cy + s * 0.62) +
    'C' + r2(cx - s * 1.25) + ' ' + r2(cy - s * 0.2) + ',' + r2(cx - s * 0.55) + ' ' + r2(cy - s * 1.05) + ',' + r2(cx) + ' ' + r2(cy - s * 0.3) +
    'C' + r2(cx + s * 0.55) + ' ' + r2(cy - s * 1.05) + ',' + r2(cx + s * 1.25) + ' ' + r2(cy - s * 0.2) + ',' + r2(cx) + ' ' + r2(cy + s * 0.62) + 'Z';
}

/** Five-pointed star, centred. */
function starPath(cx, cy, s) {
  var pts = [];
  for (var i = 0; i < 10; i++) {
    var a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    var rr = i % 2 === 0 ? s : s * 0.44;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return rPoly(pts, true, exactOpts());
}

/** Draw the face inside a head of radius `r` centred at (cx, cy). */
function drawFace(spec, cx, cy, r, color, ctx) {
  var t = ctx.theme, o = ctx.o;
  if (!spec) return '';
  var sw = r2(Math.max(1.1, t.strokeWidth * 0.6));
  var s = '';
  var ex = r * 0.38, ey = -r * 0.08;

  function stroke(d, w) {
    return el('path', {
      d: d, fill: 'none', stroke: color, 'stroke-width': r2(w || sw),
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });
  }

  /* eyes */
  function eye(sx) {
    var x = cx + sx * ex, y = cy + ey;
    switch (spec.eye) {
      case 'arc':
        // Upward arc = a smiling, closed eye.
        return stroke('M' + r2(x - r * 0.17) + ' ' + r2(y + r * 0.06) +
          'Q' + r2(x) + ' ' + r2(y - r * 0.19) + ' ' + r2(x + r * 0.17) + ' ' + r2(y + r * 0.06), sw * 1.15);
      case 'closed':
        return stroke('M' + r2(x - r * 0.17) + ' ' + r2(y - r * 0.04) +
          'Q' + r2(x) + ' ' + r2(y + r * 0.14) + ' ' + r2(x + r * 0.17) + ' ' + r2(y - r * 0.04), sw * 1.15);
      case 'wide':
        return el('ellipse', { cx: r2(x), cy: r2(y), rx: r2(r * 0.17), ry: r2(r * 0.21), fill: t.bg, stroke: color, 'stroke-width': sw }) +
          el('circle', { cx: r2(x), cy: r2(y + r * 0.03), r: r2(r * 0.085), fill: color });
      case 'squint':
        return stroke(rLine(x - r * 0.16, y, x + r * 0.16, y - r * 0.03, o), sw * 1.1);
      case 'sad':
        return el('circle', { cx: r2(x), cy: r2(y + r * 0.04), r: r2(r * 0.1), fill: color });
      case 'star':
        return el('path', { d: starPath(x, y, r * 0.24), fill: color, stroke: color, 'stroke-width': 0.8, 'stroke-linejoin': 'round' });
      case 'heart':
        return el('path', { d: heartPath(x, y, r * 0.2), fill: color, stroke: 'none' });
      case 'x':
        return stroke(rLine(x - r * 0.14, y - r * 0.14, x + r * 0.14, y + r * 0.14, o), sw * 1.1) +
          stroke(rLine(x + r * 0.14, y - r * 0.14, x - r * 0.14, y + r * 0.14, o), sw * 1.1);
      case 'wink':
        return sx < 0
          ? stroke('M' + r2(x - r * 0.17) + ' ' + r2(y + r * 0.05) + 'Q' + r2(x) + ' ' + r2(y - r * 0.18) + ' ' + r2(x + r * 0.17) + ' ' + r2(y + r * 0.05), sw * 1.15)
          : el('circle', { cx: r2(x), cy: r2(y), r: r2(r * 0.11), fill: color });
      default:
        return el('circle', { cx: r2(x), cy: r2(y), r: r2(r * 0.11), fill: color });
    }
  }
  s += eye(-1) + eye(1);

  /* brows */
  if (spec.brow === 'angry') {
    s += stroke(rLine(cx - ex - r * 0.19, cy + ey - r * 0.38, cx - ex + r * 0.13, cy + ey - r * 0.22, o), sw * 1.1);
    s += stroke(rLine(cx + ex + r * 0.19, cy + ey - r * 0.38, cx + ex - r * 0.13, cy + ey - r * 0.22, o), sw * 1.1);
  } else if (spec.brow === 'sad') {
    s += stroke(rLine(cx - ex - r * 0.19, cy + ey - r * 0.24, cx - ex + r * 0.13, cy + ey - r * 0.38, o), sw * 1.1);
    s += stroke(rLine(cx + ex + r * 0.19, cy + ey - r * 0.24, cx + ex - r * 0.13, cy + ey - r * 0.38, o), sw * 1.1);
  } else if (spec.brow === 'raised') {
    s += stroke('M' + r2(cx - ex - r * 0.16) + ' ' + r2(cy + ey - r * 0.30) + 'Q' + r2(cx - ex) + ' ' + r2(cy + ey - r * 0.42) + ' ' + r2(cx - ex + r * 0.16) + ' ' + r2(cy + ey - r * 0.30));
    s += stroke('M' + r2(cx + ex - r * 0.16) + ' ' + r2(cy + ey - r * 0.30) + 'Q' + r2(cx + ex) + ' ' + r2(cy + ey - r * 0.42) + ' ' + r2(cx + ex + r * 0.16) + ' ' + r2(cy + ey - r * 0.30));
  }

  /* mouth */
  var my = cy + r * 0.35, mw = r * 0.40;
  switch (spec.mouth) {
    case 'smile':
      s += stroke('M' + r2(cx - mw) + ' ' + r2(my - r * 0.06) +
        'Q' + r2(cx) + ' ' + r2(my + r * 0.26) + ' ' + r2(cx + mw) + ' ' + r2(my - r * 0.06), sw * 1.15);
      break;
    case 'open':
      // Wide open mouth, filled - the "laughing / shouting" shape.
      s += el('path', {
        d: 'M' + r2(cx - mw * 1.15) + ' ' + r2(my - r * 0.06) +
           'Q' + r2(cx) + ' ' + r2(my + r * 0.56) + ' ' + r2(cx + mw * 1.12) + ' ' + r2(my - r * 0.07) + 'Z',
        fill: color, stroke: color, 'stroke-width': sw, 'stroke-linejoin': 'round'
      });
      break;
    case 'frown':
      s += stroke('M' + r2(cx - mw) + ' ' + r2(my + r * 0.14) +
        'Q' + r2(cx) + ' ' + r2(my - r * 0.2) + ' ' + r2(cx + mw) + ' ' + r2(my + r * 0.14), sw * 1.15);
      break;
    case 'o':
      s += el('ellipse', { cx: r2(cx), cy: r2(my + r * 0.05), rx: r2(r * 0.16), ry: r2(r * 0.22), fill: color, stroke: 'none' });
      break;
    case 'wavy':
      s += stroke('M' + r2(cx - mw) + ' ' + r2(my) + 'q' + r2(mw * 0.5) + ' ' + r2(-r * 0.13) + ' ' + r2(mw) + ' 0' +
        'q' + r2(mw * 0.5) + ' ' + r2(r * 0.13) + ' ' + r2(mw) + ' 0');
      break;
    case 'small':
      s += stroke(rLine(cx - mw * 0.45, my, cx + mw * 0.45, my - r * 0.04, o));
      break;
    case 'flat':
      s += stroke(rLine(cx - mw, my, cx + mw, my, o), sw * 1.15);
      break;
    default:
      s += stroke(rLine(cx - mw * 0.8, my, cx + mw * 0.8, my, o));
  }

  /* tears */
  if (spec.tears) {
    [-1, 1].forEach(function (sx) {
      var x = cx + sx * ex, y = cy + ey + r * 0.2;
      s += el('path', {
        d: 'M' + r2(x) + ' ' + r2(y) + 'q' + r2(r * 0.17) + ' ' + r2(r * 0.3) + ' 0 ' + r2(r * 0.52) +
           'q' + r2(-r * 0.17) + ' ' + r2(-r * 0.2) + ' 0 ' + r2(-r * 0.52) + 'Z',
        fill: color, opacity: 0.72, stroke: 'none'
      });
    });
  }
  return s;
}

/* --- ambient effects --------------------------------------------- */

var FX_ALIASES = {
  shine: 'sparkle', wow: 'sparkle', idea: 'sparkle',
  hearts: 'heart', love: 'heart',
  music: 'note', song: 'note',
  '?': 'question', huh: 'question',
  '!': 'exclaim', alert: 'exclaim',
  sleep: 'zzz', tired: 'zzz',
  party: 'confetti', celebrate: 'confetti',
  speed: 'motion', fast: 'motion',
  drop: 'sweat', nervous: 'sweat'
};

/**
 * Doodle marks orbiting the head - the sticker-sheet vocabulary that makes
 * these figures read as reactions rather than diagrams.
 */
function drawFx(kind, cx, headCy, r, color, ctx) {
  var t = ctx.theme, o = ctx.o;
  var k = String(kind || '').toLowerCase();
  if (FX_ALIASES[k]) k = FX_ALIASES[k];
  var sw = r2(Math.max(1.2, t.strokeWidth * 0.7));
  var s = '';
  function stroke(d, op) {
    return el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round', opacity: op == null ? 1 : op });
  }

  switch (k) {
    case 'sparkle':
      [[-1.38, -0.78, 0.34], [1.34, -0.98, 0.26], [1.20, -0.18, 0.18]].forEach(function (p) {
        var x = cx + r * p[0], y = headCy + r * p[1], sz = r * p[2];
        s += stroke(rLine(x - sz, y, x + sz, y, o)) + stroke(rLine(x, y - sz, x, y + sz, o));
      });
      return s;
    case 'star':
      s += el('path', { d: starPath(cx + r * 1.38, headCy - r * 0.85, r * 0.34), fill: 'none', stroke: color, 'stroke-width': sw, 'stroke-linejoin': 'round' });
      s += el('path', { d: starPath(cx - r * 1.3, headCy - r * 0.5, r * 0.18), fill: 'none', stroke: color, 'stroke-width': sw, 'stroke-linejoin': 'round' });
      return s;
    case 'heart':
      s += el('path', { d: heartPath(cx + r * 1.28, headCy - r * 0.88, r * 0.28), fill: color, stroke: 'none', opacity: 0.85 });
      s += el('path', { d: heartPath(cx - r * 1.25, headCy - r * 0.6, r * 0.17), fill: color, stroke: 'none', opacity: 0.6 });
      return s;
    case 'note':
      var nx = cx + r * 1.42, ny = headCy - r * 0.95;
      s += stroke(rLine(nx, ny, nx, ny + r * 0.42, o));
      s += el('ellipse', { cx: r2(nx - r * 0.11), cy: r2(ny + r * 0.44), rx: r2(r * 0.12), ry: r2(r * 0.09), fill: color, stroke: 'none' });
      s += stroke(rLine(nx, ny, nx + r * 0.2, ny - r * 0.08, o));
      return s;
    case 'question':
      return el('text', {
        x: r2(cx + r * 1.3), y: r2(headCy - r * 0.45), 'font-family': t.fontTitle,
        'font-size': r2(r * 0.9), fill: color, 'text-anchor': 'middle', 'font-weight': t.titleWeight
      }, '?');
    case 'exclaim':
      return el('text', {
        x: r2(cx + r * 1.3), y: r2(headCy - r * 0.45), 'font-family': t.fontTitle,
        'font-size': r2(r * 0.9), fill: color, 'text-anchor': 'middle', 'font-weight': t.titleWeight
      }, '!');
    case 'zzz':
      [[1.15, -1.05, 0.42], [1.62, -0.62, 0.30], [1.95, -0.28, 0.22]].forEach(function (p) {
        s += el('text', {
          x: r2(cx + r * p[0]), y: r2(headCy + r * p[1]), 'font-family': t.fontTitle,
          'font-size': r2(r * p[2] * 2), fill: color, 'text-anchor': 'middle', opacity: 0.85
        }, 'z');
      });
      return s;
    case 'sweat':
      var wx = cx + r * 0.95, wy = headCy - r * 0.55;
      return el('path', {
        d: 'M' + r2(wx) + ' ' + r2(wy) + 'q' + r2(r * 0.16) + ' ' + r2(r * 0.3) + ' 0 ' + r2(r * 0.44) +
           'q' + r2(-r * 0.16) + ' ' + r2(-r * 0.14) + ' 0 ' + r2(-r * 0.44) + 'Z',
        fill: color, opacity: 0.6, stroke: 'none'
      });
    case 'confetti':
      for (var i = 0; i < 9; i++) {
        var a = (i / 9) * Math.PI * 2;
        var dx = cx + Math.cos(a) * r * (1.4 + (i % 3) * 0.22);
        var dy = headCy + Math.sin(a) * r * (1.2 + (i % 2) * 0.25);
        s += el('rect', {
          x: r2(dx), y: r2(dy), width: r2(r * 0.16), height: r2(r * 0.1),
          fill: color, opacity: 0.5 + (i % 3) * 0.16,
          transform: 'rotate(' + (i * 37) + ' ' + r2(dx) + ' ' + r2(dy) + ')'
        });
      }
      return s;
    case 'motion':
      for (var j = 0; j < 3; j++) {
        var my2 = headCy + r * (-0.3 + j * 0.5);
        s += stroke(rLine(cx - r * (1.5 + j * 0.1), my2, cx - r * (1.0 + j * 0.1), my2, o), 0.55);
      }
      return s;
    default:
      return '';
  }
}

/* --- the figure --------------------------------------------------- */

/**
 * Draw a figure with its head-top at `top` and feet at `top + h`,
 * centred on `cx`.
 *
 *   opt: { pose, face, color, fill, body, fx }
 */
function drawActor(cx, top, h, opt, ctx) {
  var t = ctx.theme, o = ctx.o;
  var color = opt.color || t.ink;
  var skin = opt.fill || t.bg;
  var pose = resolvePose(opt.pose);
  var legs = pose.leg === 'stand' ? POSES.stand.leg : pose.leg;

  var headR = h * A.headR;
  var headCy = top + headR * 1.02;
  var bodyTop = top + h * A.bodyTop;
  var bodyBot = top + h * A.bodyBot;
  var shW = h * A.shoulderW;
  var skirt = opt.body === 'skirt';
  var hemW = h * (skirt ? A.hemSkirt : A.hemShirt);
  var sw = r2(Math.max(1.5, t.strokeWidth * 0.85));

  function limb(pts, ox, oy) {
    var d = '', px = ox, py = oy, hx = ox, hy = oy;
    for (var i = 0; i < pts.length; i++) {
      hx = ox + pts[i][0] * h; hy = oy + pts[i][1] * h;
      d += rLine(px, py, hx, hy, o);
      px = hx; py = hy;
    }
    return {
      path: el('path', {
        d: d, fill: 'none', stroke: color, 'stroke-width': sw,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }),
      x: hx, y: hy
    };
  }

  var s = '';

  /* body: an outlined garment, not a spine line */
  var bodyPts = [
    [cx - shW / 2, bodyTop], [cx + shW / 2, bodyTop],
    [cx + hemW / 2, bodyBot], [cx - hemW / 2, bodyBot]
  ];
  s += el('path', { d: rPoly(bodyPts, true, exactOpts()), fill: skin, stroke: 'none' });
  s += el('path', {
    d: rPoly(bodyPts, true, o), fill: 'none', stroke: color,
    'stroke-width': sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
  });

  /* limbs, anchored just inside the garment outline */
  var shoulderY = bodyTop + h * 0.028;
  var arms = [
    limb(pose.arm[0], cx - shW / 2 + h * 0.006, shoulderY),
    limb(pose.arm[1], cx + shW / 2 - h * 0.006, shoulderY)
  ];
  var feet = [
    limb(legs[0], cx - h * A.legGap, bodyBot),
    limb(legs[1], cx + h * A.legGap, bodyBot)
  ];
  arms.concat(feet).forEach(function (l) { s += l.path; });

  /* feet as short flats; hands are just the rounded stroke ends, since a
     disc at the wrist reads as a hoop rather than a hand */
  var hr = h * A.handR;
  feet.forEach(function (l, i) {
    var dir = i === 0 ? -1 : 1;
    s += el('path', {
      d: rLine(l.x, l.y, l.x + dir * hr * 1.9, l.y, o), fill: 'none',
      stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round'
    });
  });

  /* head last, so limbs never cross the face */
  s += el('path', {
    d: rEllipse(cx, headCy, headR, headR, exactOpts()), fill: skin, stroke: 'none'
  });
  s += el('path', {
    d: rEllipse(cx, headCy, headR, headR, o), fill: 'none', stroke: color, 'stroke-width': sw
  });
  s += drawFace(resolveFaceSpec(opt.face), cx, headCy, headR, color, ctx);

  arr(opt.fx).forEach(function (f) { s += drawFx(f, cx, headCy, headR, color, ctx); });

  var tilt = opt.tilt != null ? opt.tilt : pose.tilt;
  if (tilt) s = g({ transform: 'rotate(' + r2(tilt) + ' ' + r2(cx) + ' ' + r2(top + h * 0.6) + ')' }, s);
  return s;
}


/* ------------------------------------------------------------------ *
 * shared primitives
 *
 * Every block builds from these. The key pattern is layoutCard(), which
 * returns { h, draw(x, y) }: the caller learns the height first, packs
 * the layout, and only then commits to coordinates.
 * ------------------------------------------------------------------ */

/**
 * Normalise a spec item. Agents write these by hand, so we accept the
 * obvious synonyms rather than failing on `label` vs `text`.
 */
function normItem(x) {
  if (x == null) return { text: '' };
  if (typeof x === 'string' || typeof x === 'number') return { text: String(x) };
  var text = x.text != null ? x.text
    : x.label != null ? x.label
    : x.title != null ? x.title
    : x.name != null ? x.name : '';
  var note = x.note != null ? x.note
    : x.desc != null ? x.desc
    : x.description != null ? x.description
    : x.sub != null ? x.sub
    : x.detail != null ? x.detail : null;
  return {
    text: String(text),
    note: note == null ? null : String(note),
    icon: x.icon || null,
    color: x.color != null ? x.color : (x.accent != null ? x.accent : null),
    emphasis: !!(x.emphasis || x.highlight || x.strong),
    badge: x.badge != null ? x.badge : null,
    shape: x.shape || null,
    mark: x.mark || null,
    pin: x.pin || null,
    tilt: x.tilt,
    value: x.value != null ? x.value : null
  };
}

function normItems(list) {
  return arr(list).map(normItem);
}

/**
 * Multi-line <text>. `y` is the baseline of the first line.
 * opts: { size, fill, anchor, weight, lineHeight, font, opacity }
 */
function textLines(lines, x, y, opts) {
  var o = opts || {};
  var size = num(o.size, 16);
  var lh = num(o.lineHeight, size * 1.32);
  var inner = '';
  for (var i = 0; i < lines.length; i++) {
    inner += el('tspan', { x: r2(x), y: r2(y + i * lh) }, esc(lines[i]));
  }
  return el('text', {
    'font-family': o.font,
    'font-size': r2(size),
    'font-weight': o.weight || null,
    'letter-spacing': o.tracking ? r2(o.tracking * size) : null,
    fill: o.fill,
    'text-anchor': o.anchor || 'start',
    opacity: o.opacity == null ? null : o.opacity,
    'dominant-baseline': 'auto'
  }, inner);
}

/**
 * Emphasis mark behind/under a run of text. Marker themes get a highlighter
 * swipe; typographic themes get a rule, because a highlighter reads as noise
 * next to a serif headline.
 */
function drawHighlight(x, y, w, h, ctx, color) {
  var t = ctx.theme;
  var mode = (t.chrome && t.chrome.emphasis) || 'marker';
  if (mode === 'none') return '';
  if (mode === 'underline') {
    return el('path', {
      d: rLine(x + 2, y + h + 1, x + w - 2, y + h + 1, ctx.o),
      stroke: color || t.ink, 'stroke-width': r2(Math.max(1.6, t.strokeWidth * 1.6)),
      fill: 'none', opacity: 0.55, 'stroke-linecap': 'butt'
    });
  }
  return el('path', {
    d: highlightBand(x, y, w, h, ctx.o),
    fill: t.highlight,
    opacity: t.highlightOpacity,
    stroke: 'none'
  });
}

/**
 * Fraction of width lost to the silhouette on each side. Shapes that pinch
 * toward their edges need their text pulled in or it overhangs the outline.
 */
var SHAPE_INSET = {
  ellipse: 0.16, diamond: 0.22, cloud: 0.14, burst: 0.20,
  banner: 0.10, tag: 0.10, hex: 0.16, scroll: 0.04
};

/** Extra vertical room a shape needs beyond its content. */
var SHAPE_PAD_Y = { cloud: 1.22, burst: 1.34, ellipse: 1.18, hex: 1.1, scroll: 1.16 };

/** Clean silhouette of a shape, for use as the fill layer beneath the outline. */
function shapeFill(variant, x, y, w, h, ctx) {
  return shapeOutline(variant, x, y, w, h, { theme: ctx.theme, o: exactOpts() });
}

/** Shape outline used by cards. `variant` selects the silhouette. */
function shapeOutline(variant, x, y, w, h, ctx) {
  var t = ctx.theme, o = ctx.o;
  switch (variant) {
    case 'cloud':  return rCloud(x, y, w, h, o);
    case 'burst':  return rBurst(x, y, w, h, o);
    case 'banner': return rBanner(x, y, w, h, o);
    case 'tag':    return rTag(x, y, w, h, o);
    case 'scroll': return rScroll(x, y, w, h, o);
    case 'hex':    return rHex(x, y, w, h, o);
    case 'ellipse':
      return rEllipse(x + w / 2, y + h / 2, w / 2, h / 2, o);
    case 'round':
      return rRoundRect(x, y, w, h, t.radius, o);
    case 'diamond':
      return rPoly([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]], true, o);
    case 'sticky':
      // Square-ish with one clipped corner, like a folded note.
      var f = Math.min(w, h) * 0.22;
      return rPoly([[x, y], [x + w, y], [x + w, y + h - f], [x + w - f, y + h], [x, y + h]], true, o);
    case 'pill':
      return rRoundRect(x, y, w, h, h / 2, o);
    case 'rect':
    default:
      return rRect(x, y, w, h, o);
  }
}

/** Masking tape, a pushpin or a paperclip fastening a card to the page. */
function drawFastener(kind, x, y, w, ctx, col) {
  var t = ctx.theme, o = ctx.o;
  var cx = x + w / 2;
  if (kind === 'pin') {
    return el('path', { d: rEllipse(cx, y, 7, 7, o), fill: col.s, stroke: shade(col.s, 0.25), 'stroke-width': 1 }) +
      el('path', { d: rEllipse(cx - 2, y - 2, 2.4, 2.4, o), fill: 'rgba(255,255,255,0.55)', stroke: 'none' });
  }
  if (kind === 'clip') {
    return el('path', {
      d: 'M' + r2(cx - 5) + ' ' + r2(y + 16) + 'L' + r2(cx - 5) + ' ' + r2(y - 6) +
         'a5 5 0 0 1 10 0L' + r2(cx + 5) + ' ' + r2(y + 12) + 'a3.4 3.4 0 0 1-6.8 0L' + r2(cx - 1.8) + ' ' + r2(y - 3),
      fill: 'none', stroke: t.inkSoft, 'stroke-width': r2(Math.max(1.6, t.strokeWidth * 0.85)),
      'stroke-linecap': 'round'
    });
  }
  // Default: a strip of tape across the top edge, slightly askew.
  var tw = Math.min(74, w * 0.42), th = 19;
  var rot = (o.rng() * 2 - 1) * 7;
  return el('g', { transform: 'rotate(' + r2(rot) + ' ' + r2(cx) + ' ' + r2(y) + ')' },
    el('path', {
      d: rPoly([[cx - tw / 2, y - th / 2], [cx + tw / 2, y - th / 2 - 1.5],
                [cx + tw / 2, y + th / 2], [cx - tw / 2, y + th / 2 + 1.5]], true, exactOpts()),
      fill: t.ink, opacity: 0.13, stroke: t.ink, 'stroke-opacity': 0.2, 'stroke-width': 1
    }));
}

/**
 * Annotation marks drawn *around* a card - the pen strokes someone adds
 * after the fact. `mark` is deliberately separate from `emphasis`, which
 * sits behind the text; these sit outside the shape.
 */
function drawMark(kind, x, y, w, h, ctx, col) {
  var t = ctx.theme, o = ctx.o;
  var c = col.s;
  var sw = r2(Math.max(1.6, t.strokeWidth * 1.1));
  function stroke(d, extra) {
    return el('path', assign({
      d: d, fill: 'none', stroke: c, 'stroke-width': sw,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }, extra || {}));
  }

  switch (kind) {
    case 'circle':
      // Lassoed by hand. On a wide card a true ellipse turns into a pointed
      // lens, so past ~3:1 it becomes a rounded loop - which is what someone
      // circling a long line of text actually draws.
      if (w / h > 3.2) {
        return stroke(rRoundRect(x - 7, y - 6, w + 14, h + 12, (h + 12) / 2, o), { opacity: 0.9 });
      }
      return stroke(rEllipse(x + w / 2, y + h / 2, w / 2 + 6, h / 2 + 6, o), { opacity: 0.9 });
    case 'box':
      return stroke(rRect(x - 6, y - 5, w + 12, h + 10, o), { opacity: 0.9 });
    case 'burst': {
      // Radiating speed lines, densest at the corners.
      var d = '', cx = x + w / 2, cy = y + h / 2;
      for (var i = 0; i < 14; i++) {
        var th = (i / 14) * Math.PI * 2 + 0.2;
        var rx = w / 2 + 7, ry = h / 2 + 6;
        var len = 6 + (i % 3) * 3;
        d += rLine(cx + Math.cos(th) * rx, cy + Math.sin(th) * ry,
                   cx + Math.cos(th) * (rx + len), cy + Math.sin(th) * (ry + len), o);
      }
      return stroke(d, { opacity: 0.75 });
    }
    case 'star': {
      var sx = x + w + 4, sy = y - 2, sr = 11, pts = [];
      for (var k = 0; k < 10; k++) {
        var a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        var rr = k % 2 === 0 ? sr : sr * 0.45;
        pts.push([sx + Math.cos(a) * rr, sy + Math.sin(a) * rr]);
      }
      return el('path', { d: rPoly(pts, true, exactOpts()), fill: c, stroke: c, 'stroke-width': 1, 'stroke-linejoin': 'round' });
    }
    case 'squiggle': {
      var wd = '', n = Math.max(6, Math.round(w / 13)), pts2 = [];
      for (var j = 0; j <= n; j++) {
        pts2.push([x + (j / n) * w, y + h + 7 + (j % 2 === 0 ? -3.2 : 3.2)]);
      }
      wd = rPoly(pts2, false, o);
      return stroke(wd, { opacity: 0.9 });
    }
    case 'bang': {
      // Sits inside the top-right corner so it cannot collide with a neighbour.
      var bx = x + w - 13, by = y + 9;
      return stroke(rLine(bx, by, bx, by + 14, o)) +
        el('circle', { cx: r2(bx), cy: r2(by + 21), r: 2.6, fill: c });
    }
    case 'arrow':
      // Drops in from directly above rather than diagonally across the gutter.
      return stroke(rArrow(x + w * 0.18, y - 26, x + w * 0.28, y - 5, o, 9), { opacity: 0.9 });
    default:
      return '';
  }
}

/**
 * Lay out one card: optional icon, bold title, optional note.
 * Returns its measured height plus a draw(x, y) closure.
 *
 * opts: { variant, minH, pad, titleSize, noteSize, align, iconSize,
 *         filled, index, maxTitleLines, fixedH }
 */
function layoutCard(item, w, ctx, opts) {
  var o = opts || {};
  var t = ctx.theme;
  var col = resolveColor(t, item.color, num(o.index, 0));
  var variant = item.shape || o.variant || 'rect';
  var chrome = t.chrome || BASE_CHROME;
  var boxed = chrome.cardStroke !== false || chrome.cardFill !== false;
  // Without a box the padding is what separates cards, so it grows.
  var pad = num(o.pad, 14) * (boxed ? 1 : 1.15);
  var align = o.align || 'center';
  var filled = o.filled !== false && chrome.cardFill !== false;

  var iconSize = item.icon ? num(o.iconSize, 26) : 0;
  // Centred cards stack the icon above the text; left-aligned cards read
  // better with it beside the text, the way a bulleted note does.
  var iconInline = o.iconPlacement ? (o.iconPlacement === 'inline') : (align === 'left');
  var iconGap = iconSize ? (iconInline ? 12 : 8) : 0;

  // Hand themes set card headings in the (bolder, clearer) title family so
  // they separate from the note beneath, which stays handwritten.
  var useTitleFamily = chrome.cardTitleFamily === 'title';
  var titleFont = useTitleFamily ? t.fontTitle : t.font;
  var titleScaleFor = useTitleFamily ? t.titleFontScale : t.fontScale;
  var bodyScale = chrome.bodyScale || 1;
  var titleSize = num(o.titleSize, 17) * titleScaleFor * bodyScale;
  var noteSize = num(o.noteSize, 13) * t.fontScale;

  // Shapes that pinch toward their edges lose usable width.
  var inset = w * (SHAPE_INSET[variant] || 0);
  var innerW = w - pad * 2 - inset;
  var textW = innerW - (iconInline ? iconSize + iconGap : 0);

  var bodyTrack = chrome.bodyTracking || 0;
  var title = fit(item.text, textW, titleSize, {
    weight: 'bold', maxLines: num(o.maxTitleLines, 4), lineHeight: 1.28, tracking: bodyTrack
  });
  var note = item.note ? fit(item.note, textW, noteSize, { maxLines: 4, lineHeight: 1.35 }) : null;

  var textH = title.height + (note ? note.height + 6 : 0);
  var contentH = iconInline ? Math.max(iconSize, textH) : (iconSize + iconGap + textH);
  var ruleGap = chrome.cardRule === 'top' ? 10 : 0;
  var h = num(o.fixedH, Math.max(num(o.minH, 56), contentH + pad * 2 + ruleGap));
  var padY = SHAPE_PAD_Y[variant];
  if (padY && o.fixedH == null) h = Math.max(h, contentH * padY + pad);

  function draw(x, y) {
    var s = '';
    var fillCol = filled ? col.f : 'none';
    var mark = item.mark || o.mark;
    // Tilt is applied as a transform on the finished card, so layout is
    // unaffected; a degree or two is enough to break the grid's rigidity.
    var tiltAmt = item.tilt != null ? item.tilt : o.tilt;
    var tilt = tiltAmt === true ? (ctx.o.rng() * 2 - 1) * 1.6
      : (typeof tiltAmt === 'number' ? tiltAmt : 0);
    var markOnTop = mark === 'star' || mark === 'bang';
    if (mark && !markOnTop) s += drawMark(mark, x, y, w, h, ctx, col);

    if (chrome.cardRule && chrome.cardStroke === false) {
      // Type-led card: a single accent rule stands in for the whole box.
      if (chrome.cardRule === 'top') {
        s += el('path', {
          d: rLine(x, y, x + w, y, ctx.o), stroke: col.s,
          'stroke-width': r2(Math.max(1.6, t.strokeWidth * 2)), fill: 'none'
        });
      } else {
        s += el('path', {
          d: rLine(x, y + 1, x, y + h - 1, ctx.o), stroke: col.s,
          'stroke-width': r2(Math.max(2, t.strokeWidth * 2.4)), fill: 'none'
        });
      }
      if (filled) {
        s += el('path', { d: shapeFill(variant, x, y, w, h, ctx), fill: fillCol, stroke: 'none' });
      }
    } else {
      var outline = shapeOutline(variant, x, y, w, h, ctx);
      if (t.shadow && filled) {
        s += el('path', { d: shapeFill(variant, x + 1.5, y + 2.5, w, h, ctx), fill: 'rgba(17,24,39,0.07)', stroke: 'none' });
      }
      // Fill and outline are separate layers - see exactOpts().
      if (filled) s += el('path', { d: shapeFill(variant, x, y, w, h, ctx), fill: fillCol, stroke: 'none' });
      s += el('path', {
        d: outline, fill: 'none',
        stroke: chrome.cardStroke === false ? 'none' : col.s,
        'stroke-width': r2(t.strokeWidth), 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      });
      if (variant === 'tag') {
        var hr = Math.min(5.5, h * 0.09);
        s += el('path', {
          d: rEllipse(x + Math.min(h * 0.42, w * 0.16) * 0.55 + hr, y + h / 2, hr, hr, ctx.o),
          fill: t.bg, stroke: col.s, 'stroke-width': r2(t.strokeWidthThin)
        });
      }
    }

    var textFill = filled ? col.i : t.ink;
    var left = x + pad + inset / 2;
    var cx = align === 'center' ? x + w / 2 : left + (iconInline ? iconSize + iconGap : 0);
    var anchor = align === 'center' ? 'middle' : 'start';

    // Vertically centre the whole content stack inside the shape.
    var cursorY = y + ruleGap + (h - ruleGap - contentH) / 2;

    if (iconSize) {
      if (iconInline) {
        s += drawIcon(item.icon, left + iconSize / 2, y + ruleGap + (h - ruleGap) / 2, iconSize, col.s, t);
        cursorY = y + ruleGap + (h - ruleGap - textH) / 2;
      } else {
        s += drawIcon(item.icon, cx, cursorY + iconSize / 2, iconSize, col.s, t);
        cursorY += iconSize + iconGap;
      }
    }

    if (item.emphasis) {
      var tw = widestLine(title.lines, title.size, 'bold', bodyTrack);
      var hx = anchor === 'middle' ? cx - tw / 2 : cx;
      s += drawHighlight(hx - 4, cursorY + title.size * 0.12, tw + 8, title.size * 1.02, ctx, col.s);
    }

    s += textLines(title.lines, cx, cursorY + title.size * 0.82, {
      size: title.size, lineHeight: title.lineHeight, fill: textFill,
      anchor: anchor, weight: t.titleWeight, font: titleFont, tracking: bodyTrack
    });
    cursorY += title.height;

    if (note) {
      s += textLines(note.lines, cx, cursorY + 6 + note.size * 0.82, {
        size: note.size, lineHeight: note.lineHeight, fill: t.inkSoft,
        anchor: anchor, font: t.font
      });
    }

    if (mark && markOnTop) s += drawMark(mark, x, y, w, h, ctx, col);
    var pin = item.pin || o.pin;
    if (pin) s += drawFastener(pin, x, y, w, ctx, col);
    if (item.badge != null) s += drawBadge(item.badge, x + w - 6, y + 6, ctx, col);
    if (tilt) s = g({ transform: 'rotate(' + r2(tilt) + ' ' + r2(x + w / 2) + ' ' + r2(y + h / 2) + ')' }, s);
    return s;
  }

  return { h: h, w: w, draw: draw, color: col };
}

/** Small circled label pinned to a card corner. */
function drawBadge(label, cx, cy, ctx, col) {
  var t = ctx.theme;
  if (t.radius === 0 && !t.roughness) {
    var sz = 12 * t.fontScale;
    var bw = measure(String(label), sz, 'bold') + 14;
    return el('rect', { x: r2(cx - bw / 2), y: r2(cy - 11), width: r2(bw), height: 22, fill: col.s }) +
      textLines([String(label)], cx, cy + sz * 0.35, {
        size: sz, fill: readableInk(t, col.s), anchor: 'middle', weight: t.titleWeight, font: t.font
      });
  }
  var size = 12 * t.fontScale;
  var rad = Math.max(13, measure(String(label), size, 'bold') / 2 + 7);
  return el('path', {
    d: rEllipse(cx, cy, rad, 13, ctx.o), fill: col.s, stroke: col.s, 'stroke-width': r2(t.strokeWidthThin)
  }) + textLines([String(label)], cx, cy + size * 0.35, {
    size: size, fill: readableInk(t, col.s), anchor: 'middle', weight: t.titleWeight, font: t.font
  });
}

/** Section heading shared by blocks that carry a `title`. */
function layoutBlockTitle(text, w, ctx, opts) {
  var o = opts || {};
  var t = ctx.theme;
  if (!text) return { h: 0, draw: function () { return ''; } };
  var chrome = t.chrome || BASE_CHROME;
  var track = chrome.tracking || 0;
  var size = num(o.size, 20) * t.titleFontScale * (chrome.headScale || 1);
  var res = fit(text, w, size, { weight: 'bold', maxLines: 2, lineHeight: 1.25, tracking: track });
  var rule = chrome.headRule || 'thin';
  var ruleGap = rule === 'none' ? 0 : (rule === 'thick' ? 10 : 6);
  var gap = num(o.gap, 12) + ruleGap;

  return {
    h: res.height + gap,
    draw: function (x, y) {
      var s = textLines(res.lines, x, y + res.size * 0.85, {
        size: res.size, lineHeight: res.lineHeight, fill: t.ink,
        weight: t.titleWeight, font: t.fontTitle, tracking: track
      });
      if (rule === 'none') return s;

      // 'full' spans the column; the others sit under the first line only.
      var uw = rule === 'full' ? w : Math.min(measure(res.lines[0], res.size, 'bold', track), w);
      var ry = y + res.height + (rule === 'thick' ? 8 : 4);
      s += el('path', {
        d: rLine(x, ry, x + uw, ry, ctx.o),
        stroke: rule === 'thick' ? t.ink : t.inkSoft,
        'stroke-width': r2(rule === 'thick' ? Math.max(4, t.strokeWidth * 1.8) : t.strokeWidthThin),
        fill: 'none', 'stroke-linecap': rule === 'thick' ? 'butt' : 'round',
        opacity: rule === 'full' ? 0.35 : 1
      });
      return s;
    }
  };
}

/** Arrow between two card rects, snapped to their facing edges. */
function connect(from, to, ctx, opts) {
  var o = opts || {};
  var t = ctx.theme;
  var col = o.color || t.inkSoft;
  var d;
  if (o.bend) {
    d = rCurveArrow(from.x, from.y, to.x, to.y, o.bend, ctx.o, num(o.head, 10));
  } else {
    d = rArrow(from.x, from.y, to.x, to.y, ctx.o, num(o.head, 10));
  }
  var s = el('path', {
    d: d, fill: 'none', stroke: col,
    'stroke-width': r2(num(o.width, t.strokeWidth)),
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'stroke-dasharray': o.dashed ? '6 5' : null
  });
  if (o.label) {
    var size = 12 * t.fontScale;
    var mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
    var lw = measure(o.label, size);
    s += el('path', {
      d: rRoundRect(mx - lw / 2 - 5, my - size * 0.85, lw + 10, size * 1.6, 5, { rough: 0, bow: 0, rng: ctx.o.rng, passes: 1 }),
      fill: t.bg, stroke: 'none'
    });
    s += textLines([o.label], mx, my + size * 0.3, {
      size: size, fill: t.inkSoft, anchor: 'middle', font: t.font
    });
  }
  return s;
}


/* ------------------------------------------------------------------ *
 * block registry
 *
 * A block renderer receives (block, ctx) and returns { h, s } where `s`
 * is SVG drawn in local coordinates with (0,0) at the block's top-left.
 * The stack engine translates it into place, so no renderer ever needs
 * to know its absolute position.
 * ------------------------------------------------------------------ */

var BLOCKS = {};

/* --- title ------------------------------------------------------- */
BLOCKS.title = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var col = resolveColor(t, b.color, 0);
  var align = b.align || 'center';
  var iconSize = b.icon ? 40 : 0;

  var chrome = t.chrome || BASE_CHROME;
  var track = chrome.tracking || 0;
  var size = num(b.size, 34) * t.titleFontScale * (chrome.titleScale || 1);
  var main = fit(b.text || b.title || '', w - iconSize - (iconSize ? 14 : 0), size, {
    weight: 'bold', maxLines: 3, lineHeight: 1.18, tracking: track
  });
  var subSize = 16 * t.fontScale;
  var sub = b.sub || b.subtitle ? fit(b.sub || b.subtitle, w * 0.9, subSize, { maxLines: 3, lineHeight: 1.4 }) : null;

  var h = Math.max(main.height, iconSize) + (sub ? sub.height + 10 : 0) + 16;

  return {
    h: h,
    s: (function () {
      var s = '';
      var cx = align === 'center' ? w / 2 : 0;
      var anchor = align === 'center' ? 'middle' : 'start';
      var y = 0;

      if (iconSize) {
        var iw = widestLine(main.lines, main.size, 'bold', track);
        var ix = align === 'center' ? cx - iw / 2 - iconSize * 0.75 : 0;
        s += drawIcon(b.icon, ix + iconSize / 2, y + main.height / 2, iconSize, col.s, t);
        if (align !== 'center') cx = iconSize + 14;
      }

      // Highlighter swipe under the first line is the title's emphasis mark.
      if (b.highlight !== false) {
        var lw = Math.min(widestLine(main.lines, main.size, 'bold', track), w);
        var hx = anchor === 'middle' ? cx - lw / 2 : cx;
        var lastTop = y + (main.lines.length - 1) * main.lineHeight;
        s += drawHighlight(hx - 6, lastTop + main.size * 0.52, lw + 12, main.size * 0.5, ctx, col.s);
      }

      s += textLines(main.lines, cx, y + main.size * 0.85, {
        size: main.size, lineHeight: main.lineHeight, fill: t.ink,
        anchor: anchor, weight: t.titleWeight, font: t.fontTitle, tracking: track
      });
      y += main.height;

      if (sub) {
        s += textLines(sub.lines, cx, y + 10 + sub.size * 0.85, {
          size: sub.size, lineHeight: sub.lineHeight, fill: t.inkSoft,
          anchor: anchor, font: t.font
        });
      }
      return s;
    })()
  };
};

/* --- callout ----------------------------------------------------- */
BLOCKS.callout = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var col = resolveColor(t, b.color, 0);
  var chrome = t.chrome || BASE_CHROME;
  var variant = b.variant || 'box';
  // Type-led themes have no boxes to put a callout in, so box/bubble
  // collapse to a ruled aside rather than fighting the page.
  if (chrome.cardStroke === false && (variant === 'box' || variant === 'bubble')) variant = 'bar';
  var radius = t.radius ? t.radius + 6 : 0;
  var pad = 18;
  var iconSize = b.icon ? 30 : 0;
  var iconGap = iconSize ? 14 : 0;
  var tailH = variant === 'bubble' ? 16 : 0;

  var textW = w - pad * 2 - iconSize - iconGap;
  var size = num(b.size, 17) * t.fontScale;
  var body = fit(b.text || '', textW, size, { maxLines: 12, lineHeight: 1.42 });
  var label = b.label ? fit(b.label, textW, 14 * t.fontScale, { maxLines: 1 }) : null;

  var innerH = body.height + (label ? label.height + 6 : 0);
  var boxH = Math.max(58, innerH + pad * 2);
  var h = boxH + tailH;

  return {
    h: h,
    s: (function () {
      var s = '';
      if (variant === 'sticky') {
        s += el('path', {
          d: shapeOutline('sticky', 0, 0, w, boxH, ctx),
          fill: col.f, stroke: col.s, 'stroke-width': r2(t.strokeWidth), 'stroke-linejoin': 'round'
        });
      } else if (variant === 'bubble') {
        s += el('path', {
          d: rRoundRect(0, 0, w, boxH, radius, ctx.o),
          fill: col.f, stroke: col.s, 'stroke-width': r2(t.strokeWidth), 'stroke-linejoin': 'round'
        });
        var tri = [[w * 0.16, boxH - 2], [w * 0.24, boxH + tailH], [w * 0.30, boxH - 2]];
        s += el('path', { d: rPoly(tri, true, exactOpts()), fill: col.f, stroke: 'none' });
        s += el('path', {
          d: rPoly(tri, false, ctx.o), fill: 'none',
          stroke: col.s, 'stroke-width': r2(t.strokeWidth), 'stroke-linejoin': 'round'
        });
        // Mask the segment of the box outline the tail grows out of. It must
        // sit exactly on the edge, or thick-stroke themes show a double line.
        s += el('path', {
          d: 'M' + r2(w * 0.175) + ' ' + r2(boxH) + 'L' + r2(w * 0.288) + ' ' + r2(boxH),
          stroke: col.f, 'stroke-width': r2(t.strokeWidth * 2), fill: 'none'
        });
      } else if (variant === 'bar') {
        // Left rule only: quiet aside.
        s += el('path', {
          d: rLine(2, 2, 2, boxH - 2, ctx.o),
          stroke: col.s, 'stroke-width': r2(Math.max(3, t.strokeWidth * 2)),
          fill: 'none', 'stroke-linecap': t.radius ? 'round' : 'butt'
        });
      } else {
        s += el('path', {
          d: rRoundRect(0, 0, w, boxH, t.radius, ctx.o),
          fill: col.f, stroke: col.s, 'stroke-width': r2(t.strokeWidth), 'stroke-linejoin': 'round'
        });
      }

      // The bar variant has no box, so its left inset is the rule, not padding.
      var lead = variant === 'bar' ? 18 : pad;
      var tx = lead + iconSize + iconGap;
      if (iconSize) s += drawIcon(b.icon, lead + iconSize / 2, boxH / 2, iconSize, col.s, t);

      var y = (boxH - innerH) / 2;
      if (label) {
        s += textLines(label.lines, tx, y + label.size * 0.85, {
          size: label.size, fill: col.s, weight: t.titleWeight, font: t.font
        });
        y += label.height + 6;
      }
      s += textLines(body.lines, tx, y + body.size * 0.85, {
        size: body.size, lineHeight: body.lineHeight,
        fill: variant === 'bar' ? t.ink : col.i, font: t.font
      });
      return s;
    })()
  };
};

/* --- list -------------------------------------------------------- */
BLOCKS.list = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var items = normItems(b.items);
  var head = layoutBlockTitle(b.title, w, ctx, {});
  var marker = b.marker || (b.numbered ? 'number' : 'icon');
  var gutter = 40;
  var rowGap = num(b.gap, 14);
  var size = num(b.size, 17) * t.fontScale;
  var noteSize = 13.5 * t.fontScale;

  var rows = items.map(function (it, i) {
    var text = fit(it.text, w - gutter, size, { weight: 'bold', maxLines: 4, lineHeight: 1.32 });
    var note = it.note ? fit(it.note, w - gutter, noteSize, { maxLines: 4, lineHeight: 1.4 }) : null;
    var h = Math.max(26, text.height + (note ? note.height + 4 : 0));
    return { it: it, text: text, note: note, h: h, col: resolveColor(t, it.color, i) };
  });

  var bodyH = rows.reduce(function (a, r) { return a + r.h; }, 0) + rowGap * Math.max(0, rows.length - 1);

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      var y = head.h;
      rows.forEach(function (row, i) {
        var midY = y + row.text.size * 0.6;
        if (marker === 'number' && (t.chrome && t.chrome.numeral) === 'plain') {
          s += textLines([String(i + 1).padStart(2, '0')], 26, midY + row.text.size * 0.34, {
            size: row.text.size * 1.05, fill: row.col.s, anchor: 'end',
            weight: t.titleWeight, font: t.fontTitle
          });
        } else if (marker === 'number') {
          s += el('path', {
            d: rEllipse(14, midY + 2, 13, 13, ctx.o),
            fill: row.col.f, stroke: row.col.s, 'stroke-width': r2(t.strokeWidthThin)
          });
          s += textLines([String(i + 1)], 14, midY + 6, {
            size: 14 * t.fontScale, fill: row.col.i, anchor: 'middle', weight: t.titleWeight, font: t.font
          });
        } else if (row.it.icon || marker === 'icon') {
          var drawn = row.it.icon ? drawIcon(row.it.icon, 14, midY + 2, 24, row.col.s, t) : '';
          if (!drawn) {
            // Fall back to a drawn tick when no icon was supplied.
            drawn = el('path', {
              d: rPoly([[7, midY + 2], [12, midY + 7], [21, midY - 4]], false, ctx.o),
              fill: 'none', stroke: row.col.s, 'stroke-width': r2(t.strokeWidth),
              'stroke-linecap': 'round', 'stroke-linejoin': 'round'
            });
          }
          s += drawn;
        } else {
          s += el('path', { d: rEllipse(14, midY + 2, 5, 5, ctx.o), fill: row.col.s, stroke: 'none' });
        }

        if (row.it.emphasis) {
          var tw = widestLine(row.text.lines, row.text.size, 'bold');
          s += drawHighlight(gutter - 4, y + row.text.size * 0.15, Math.min(tw, w - gutter) + 8, row.text.size, ctx, row.col.s);
        }
        s += textLines(row.text.lines, gutter, y + row.text.size * 0.85, {
          size: row.text.size, lineHeight: row.text.lineHeight, fill: t.ink,
          weight: t.titleWeight, font: t.font
        });
        if (row.note) {
          s += textLines(row.note.lines, gutter, y + row.text.height + 4 + row.note.size * 0.85, {
            size: row.note.size, lineHeight: row.note.lineHeight, fill: t.inkSoft, font: t.font
          });
        }
        y += row.h + rowGap;
      });
      return s;
    })()
  };
};

/* --- quote ------------------------------------------------------- */
BLOCKS.quote = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var col = resolveColor(t, b.color, 7);
  var markSize = 54 * t.titleFontScale;
  var padL = 52;
  var size = num(b.size, 21) * t.fontScale;
  var body = fit(b.text || '', w - padL - 20, size, { maxLines: 8, lineHeight: 1.45 });
  var by = b.by || b.author;
  var bySize = 14 * t.fontScale;
  var byH = by ? bySize * 1.4 + 8 : 0;

  return {
    h: body.height + byH + 16,
    s: (function () {
      // Display faces often lack a proper U+201C; pin the mark to a serif
      // so it renders as a quote rather than a fallback tofu or a bar.
      var s = textLines(['“'], 8, markSize * 0.72, {
        size: markSize, fill: col.s, weight: t.titleWeight,
        font: "Georgia,'Times New Roman','Nanum Myeongjo',serif", opacity: 0.55
      });
      s += textLines(body.lines, padL, body.size * 0.9, {
        size: body.size, lineHeight: body.lineHeight, fill: t.ink, font: t.font
      });
      if (by) {
        s += textLines(['— ' + by], padL, body.height + 8 + bySize * 0.9, {
          size: bySize, fill: t.inkSoft, font: t.font
        });
      }
      return s;
    })()
  };
};

/* --- stats ------------------------------------------------------- */
BLOCKS.stats = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var items = normItems(b.items);
  var head = layoutBlockTitle(b.title, w, ctx, {});
  var n = Math.max(1, items.length);
  var gap = 16;
  var colW = (w - gap * (n - 1)) / n;
  var valueSize = num(b.size, 40) * t.titleFontScale * ((t.chrome && t.chrome.titleScale) || 1);
  var labelSize = 14 * t.fontScale;

  var cells = items.map(function (it, i) {
    var raw = it.value != null ? it.value : it.text;
    var v = fit(String(raw), colW - 16, valueSize, {
      weight: 'bold', maxLines: 1, minSize: 18, tracking: (t.chrome && t.chrome.tracking) || 0
    });
    var lbl = fit(it.value != null ? it.text : (it.note || ''), colW - 12, labelSize, { maxLines: 3, lineHeight: 1.35 });
    return { v: v, lbl: lbl, col: resolveColor(t, it.color, i), it: it };
  });
  var bodyH = Math.max.apply(null, cells.map(function (c) { return c.v.height + c.lbl.height + 14; })) + 8;

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      cells.forEach(function (c, i) {
        var x = i * (colW + gap);
        var cx = x + colW / 2;
        var y = head.h;
        s += textLines(c.v.lines, cx, y + c.v.size * 0.85, {
          size: c.v.size, fill: c.col.s, anchor: 'middle', weight: t.titleWeight,
          font: t.fontTitle, tracking: (t.chrome && t.chrome.tracking) || 0
        });
        s += textLines(c.lbl.lines, cx, y + c.v.height + 10 + c.lbl.size * 0.85, {
          size: c.lbl.size, lineHeight: c.lbl.lineHeight, fill: t.inkSoft, anchor: 'middle', font: t.font
        });
        if (i < cells.length - 1) {
          s += el('path', {
            d: rLine(x + colW + gap / 2, y + 6, x + colW + gap / 2, y + bodyH - 10, ctx.o),
            stroke: t.inkSoft, 'stroke-width': r2(t.strokeWidthThin), opacity: 0.35, fill: 'none'
          });
        }
      });
      return s;
    })()
  };
};

/* --- divider ----------------------------------------------------- */
BLOCKS.divider = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var col = resolveColor(t, b.color, 7);
  var style = b.style || 'wave';
  var h = 26;
  return {
    h: h,
    s: (function () {
      if (style === 'dots') {
        var s = '';
        for (var i = 0; i < 5; i++) {
          s += el('path', { d: rEllipse(w / 2 + (i - 2) * 18, h / 2, 3.5, 3.5, ctx.o), fill: col.s, stroke: 'none' });
        }
        return s;
      }
      if (style === 'line') {
        return el('path', {
          d: rLine(0, h / 2, w, h / 2, ctx.o), stroke: col.s, 'stroke-width': r2(t.strokeWidthThin),
          fill: 'none', opacity: 0.5, 'stroke-linecap': 'round'
        });
      }
      // Wave: a sine sampled into a smooth curve.
      var pts = [];
      for (var k = 0; k <= 24; k++) {
        var px = (k / 24) * w;
        pts.push([px, h / 2 + Math.sin(k * 0.85) * 4]);
      }
      return el('path', {
        d: catmull(pts, false), stroke: col.s, 'stroke-width': r2(t.strokeWidthThin),
        fill: 'none', opacity: 0.55, 'stroke-linecap': 'round'
      });
    })()
  };
};

/* --- spacer ------------------------------------------------------ */
BLOCKS.spacer = function (b, ctx) {
  return { h: num(b.size, 24), s: '' };
};


/* ------------------------------------------------------------------ *
 * flow-shaped blocks
 * ------------------------------------------------------------------ */

/**
 * Choose a column count that avoids a lonely trailing item.
 * 5 items in a 4-wide space packs as 3+2, not 4+1.
 */
function balancedCols(n, maxCols) {
  var cols = Math.max(1, Math.min(n, maxCols));
  var rows = Math.ceil(n / cols);
  return Math.max(1, Math.ceil(n / rows));
}

/* --- flow: left-to-right chain, wrapping to new rows -------------- */
BLOCKS.flow = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var items = normItems(b.items);
  if (!items.length) return { h: 0, s: '' };

  var head = layoutBlockTitle(b.title, w, ctx, {});
  var hasMark = items.some(function (it) { return !!it.mark; }) || !!b.mark;
  var arrowGap = num(b.arrowGap, hasMark ? 52 : 38);
  var rowGap = 52;
  var minCard = num(b.minCardWidth, 150);

  var fitCols = Math.floor((w + arrowGap) / (minCard + arrowGap));
  var cols = balancedCols(items.length, num(b.perRow, Math.max(1, fitCols)));
  var cardW = (w - arrowGap * (cols - 1)) / cols;

  var cards = items.map(function (it, i) {
    return layoutCard(it, cardW, ctx, {
      variant: b.shape || 'round', index: i, minH: 66, titleSize: 16, noteSize: 12.5
    });
  });

  // Uniform height per row keeps the connecting arrows horizontal.
  var rows = [];
  for (var i = 0; i < cards.length; i += cols) rows.push(cards.slice(i, i + cols));
  var rowH = rows.map(function (row) {
    return Math.max.apply(null, row.map(function (c) { return c.h; }));
  });

  var bodyH = rowH.reduce(function (a, x) { return a + x; }, 0) + rowGap * (rows.length - 1);

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      var y = head.h;
      rows.forEach(function (row, ri) {
        var rh = rowH[ri];
        row.forEach(function (c, ci) {
          var x = ci * (cardW + arrowGap);
          s += c.draw(x, y + (rh - c.h) / 2);
          if (ci < row.length - 1) {
            s += connect(
              { x: x + cardW + 7, y: y + rh / 2 },
              { x: x + cardW + arrowGap - 7, y: y + rh / 2 },
              ctx, { color: t.inkSoft, label: b.arrowLabels ? b.arrowLabels[ri * cols + ci] : null }
            );
          }
        });
        // Wrap arrow: last card of this row down to the first of the next.
        if (ri < rows.length - 1) {
          var lastX = (row.length - 1) * (cardW + arrowGap) + cardW / 2;
          s += connect(
            { x: lastX, y: y + rh + 6 },
            { x: cardW / 2, y: y + rh + rowGap - 8 },
            ctx, { color: t.inkSoft, bend: -26, dashed: true }
          );
        }
        y += rh + rowGap;
      });
      return s;
    })()
  };
};

/* --- steps: numbered vertical sequence ---------------------------- */
BLOCKS.steps = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var items = normItems(b.items);
  if (!items.length) return { h: 0, s: '' };

  var head = layoutBlockTitle(b.title, w, ctx, {});
  var railX = 24;
  var gutter = 68;
  var rowGap = num(b.gap, 22);

  var rows = items.map(function (it, i) {
    var card = layoutCard(it, w - gutter, ctx, {
      variant: b.shape || 'round', index: i, align: 'left', minH: 58,
      titleSize: 16.5, noteSize: 13, pad: 14
    });
    return { card: card, it: it, col: resolveColor(t, it.color, i) };
  });

  var bodyH = rows.reduce(function (a, r) { return a + r.card.h; }, 0) + rowGap * (rows.length - 1);

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      var y = head.h;
      var first = null, last = null;

      rows.forEach(function (row, i) {
        var cy = y + Math.min(row.card.h / 2, 30);
        if (first === null) first = cy;
        last = cy;
        y += row.card.h + rowGap;
      });

      // Rail behind the markers, drawn first so circles sit on top.
      if (rows.length > 1 && (t.chrome && t.chrome.numeral) !== 'plain') {
        s += el('path', {
          d: rLine(railX, first, railX, last, ctx.o),
          stroke: t.inkSoft, 'stroke-width': r2(t.strokeWidthThin),
          fill: 'none', opacity: 0.4, 'stroke-dasharray': '5 6', 'stroke-linecap': 'round'
        });
      }

      y = head.h;
      var plain = (t.chrome && t.chrome.numeral) === 'plain';
      rows.forEach(function (row, i) {
        var cy = y + Math.min(row.card.h / 2, 30);
        var label = String(row.it.badge != null ? row.it.badge : i + 1);
        s += row.card.draw(gutter, y);

        if (plain) {
          // Typographic themes set the number in type rather than in a disc.
          var nsize = 30 * t.titleFontScale;
          s += textLines([label.length < 2 ? '0' + label : label], railX + 14, cy + nsize * 0.36, {
            size: nsize, fill: row.col.s, anchor: 'end',
            weight: t.titleWeight, font: t.fontTitle,
            tracking: (t.chrome.tracking || 0)
          });
        } else {
          s += el('path', {
            d: rEllipse(railX, cy, 17, 17, ctx.o),
            fill: row.col.s, stroke: row.col.s, 'stroke-width': r2(t.strokeWidthThin)
          });
          s += textLines([label], railX, cy + 6, {
            size: 16 * t.fontScale, fill: readableInk(t, row.col.s),
            anchor: 'middle', weight: t.titleWeight, font: t.font
          });
        }
        y += row.card.h + rowGap;
      });
      return s;
    })()
  };
};

/* --- cycle: items around a ring with curved arrows ---------------- */
BLOCKS.cycle = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var items = normItems(b.items);
  if (!items.length) return { h: 0, s: '' };

  var head = layoutBlockTitle(b.title, w, ctx, {});
  var n = items.length;
  var cardW = clamp(w / 3.4, 120, 190);
  var cardH = num(b.cardHeight, 74);
  var R = Math.min((w - cardW) / 2, 210);
  // Ellipse is squashed vertically so tall stacks stay compact; the block
  // height must follow ry, not R, or it leaves dead space above and below.
  var ry = R * 0.78;
  var cx = w / 2;
  var cy = ry + cardH / 2;
  var bodyH = ry * 2 + cardH;

  var cards = items.map(function (it, i) {
    return layoutCard(it, cardW, ctx, {
      variant: b.shape || 'round', index: i, fixedH: cardH,
      titleSize: 15, noteSize: 12, pad: 10, maxTitleLines: 3
    });
  });

  var pos = items.map(function (_, i) {
    var th = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(th) * R, y: cy + Math.sin(th) * ry, th: th };
  });

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      var oy = head.h;

      // Arrows first, so cards mask their endpoints.
      // Inset must scale with the angular step, or with few items the two
      // endpoints cross over and the arrow points backwards round the ring.
      var step = Math.PI * 2 / n;
      var inset = step * 0.28;
      pos.forEach(function (p, i) {
        if (n < 2) return;
        var q = pos[(i + 1) % n];
        var a1 = p.th + inset;
        var a2 = p.th + step - inset;
        var from = { x: cx + Math.cos(a1) * R * 0.72, y: oy + cy + Math.sin(a1) * ry * 0.72 };
        var to = { x: cx + Math.cos(a2) * R * 0.72, y: oy + cy + Math.sin(a2) * ry * 0.72 };
        // Positive bend bows away from the hub, tracing the ring.
        s += connect(from, to, ctx, { color: t.inkSoft, bend: 18, width: t.strokeWidth * 0.9 });
      });

      if (b.center) {
        var cItem = normItem(b.center);
        var cW = R * 0.95;
        var cCol = resolveColor(t, cItem.color, 7);
        var cSize = 17 * t.fontScale;
        var cTxt = fit(cItem.text, cW - 20, cSize, { weight: 'bold', maxLines: 3, lineHeight: 1.3 });
        s += el('path', {
          d: rEllipse(cx, oy + cy, cW / 2, cW / 2 * 0.62, ctx.o),
          fill: cCol.f, stroke: cCol.s, 'stroke-width': r2(t.strokeWidth)
        });
        s += textLines(cTxt.lines, cx, oy + cy - cTxt.height / 2 + cTxt.size * 0.85, {
          size: cTxt.size, lineHeight: cTxt.lineHeight, fill: cCol.i,
          anchor: 'middle', weight: t.titleWeight, font: t.font
        });
      }

      cards.forEach(function (c, i) {
        s += c.draw(pos[i].x - cardW / 2, oy + pos[i].y - cardH / 2);
      });
      return s;
    })()
  };
};

/* --- timeline: horizontal axis, labels alternating above/below ---- */
BLOCKS.timeline = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var items = normItems(b.items);
  if (!items.length) return { h: 0, s: '' };

  var head = layoutBlockTitle(b.title, w, ctx, {});
  var n = items.length;
  var pad = Math.min(60, w / (n * 2));
  var span = w - pad * 2;
  var slot = n > 1 ? span / (n - 1) : 0;
  var labelW = Math.max(90, Math.min(slot * 1.5, 190));
  var alternate = b.alternate !== false && n > 2;

  var titleSize = 15 * t.fontScale;
  var noteSize = 12.5 * t.fontScale;

  var cells = items.map(function (it, i) {
    var ttl = fit(it.text, labelW, titleSize, { weight: 'bold', maxLines: 3, lineHeight: 1.28 });
    var note = it.note ? fit(it.note, labelW, noteSize, { maxLines: 3, lineHeight: 1.35 }) : null;
    var vlabel = it.value != null ? fit(String(it.value), labelW, noteSize, { maxLines: 1 }) : null;
    var h = ttl.height + (note ? note.height + 4 : 0) + (vlabel ? vlabel.height + 4 : 0);
    return {
      it: it, ttl: ttl, note: note, vlabel: vlabel, h: h,
      col: resolveColor(t, it.color, i),
      above: alternate ? (i % 2 === 0) : true
    };
  });

  var aboveH = Math.max.apply(null, [0].concat(cells.filter(function (c) { return c.above; }).map(function (c) { return c.h; })));
  var belowH = Math.max.apply(null, [0].concat(cells.filter(function (c) { return !c.above; }).map(function (c) { return c.h; })));
  var stem = 20;
  var axisY = aboveH + stem + 12;
  var bodyH = axisY + stem + belowH + 12;

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      var oy = head.h;

      s += el('path', {
        d: rArrow(0, oy + axisY, w, oy + axisY, ctx.o, 11),
        stroke: t.ink, 'stroke-width': r2(t.strokeWidth), fill: 'none', 'stroke-linecap': 'round'
      });

      cells.forEach(function (c, i) {
        var x = pad + slot * i;
        var dir = c.above ? -1 : 1;
        s += el('path', {
          d: rLine(x, oy + axisY, x, oy + axisY + dir * stem, ctx.o),
          stroke: c.col.s, 'stroke-width': r2(t.strokeWidthThin), fill: 'none', 'stroke-linecap': 'round'
        });
        s += el('path', {
          d: rEllipse(x, oy + axisY, 7, 7, ctx.o),
          fill: c.col.s, stroke: t.bg, 'stroke-width': 2
        });

        var ty = c.above ? oy + axisY - stem - c.h : oy + axisY + stem;
        var cur = ty;
        if (c.vlabel) {
          s += textLines(c.vlabel.lines, x, cur + c.vlabel.size * 0.85, {
            size: c.vlabel.size, fill: c.col.s, anchor: 'middle', weight: t.titleWeight, font: t.font
          });
          cur += c.vlabel.height + 4;
        }
        s += textLines(c.ttl.lines, x, cur + c.ttl.size * 0.85, {
          size: c.ttl.size, lineHeight: c.ttl.lineHeight, fill: t.ink,
          anchor: 'middle', weight: t.titleWeight, font: t.font
        });
        cur += c.ttl.height;
        if (c.note) {
          s += textLines(c.note.lines, x, cur + 4 + c.note.size * 0.85, {
            size: c.note.size, lineHeight: c.note.lineHeight, fill: t.inkSoft,
            anchor: 'middle', font: t.font
          });
        }
      });
      return s;
    })()
  };
};


/* ------------------------------------------------------------------ *
 * structural blocks
 * ------------------------------------------------------------------ */

/* --- mindmap: centre node with branches left and right ------------ */
BLOCKS.mindmap = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var branches = arr(b.branches || b.items).map(function (x, i) {
    var it = normItem(x);
    it.children = arr(x && x.children).map(function (c) { return normItem(c).text; });
    return it;
  });
  if (!branches.length) return { h: 0, s: '' };

  var head = layoutBlockTitle(b.title, w, ctx, {});
  var centerW = clamp(w * 0.26, 130, 230);
  var gap = 46;
  var sideW = (w - centerW) / 2 - gap;
  var branchGap = 20;
  var childSize = 13 * t.fontScale;

  // Split branches evenly; the left column takes the smaller half.
  var half = Math.ceil(branches.length / 2);
  var right = branches.slice(0, half);
  var left = branches.slice(half);

  function buildSide(list, startIndex) {
    return list.map(function (it, i) {
      var card = layoutCard(it, sideW, ctx, {
        variant: b.shape || 'pill', index: startIndex + i, minH: 46,
        titleSize: 15.5, pad: 12, maxTitleLines: 3
      });
      var kids = it.children.map(function (c) {
        return fit(c, sideW - 26, childSize, { maxLines: 2, lineHeight: 1.32 });
      });
      var kidsH = kids.reduce(function (a, k) { return a + k.height + 5; }, 0);
      return { it: it, card: card, kids: kids, h: card.h + (kidsH ? kidsH + 6 : 0) };
    });
  }

  var R = buildSide(right, 0);
  var L = buildSide(left, right.length);

  function sideH(side) {
    return side.reduce(function (a, x) { return a + x.h; }, 0) + branchGap * Math.max(0, side.length - 1);
  }
  var bodyH = Math.max(sideH(R), sideH(L), 110);
  var cy = bodyH / 2;

  var centerItem = normItem(b.center || b.text || '');
  var centerCol = resolveColor(t, centerItem.color != null ? centerItem.color : b.color, 7);
  var centerSize = 20 * t.titleFontScale;
  var cTxt = fit(centerItem.text, centerW - 34, centerSize, { weight: 'bold', maxLines: 4, lineHeight: 1.26 });
  var centerH = Math.max(84, cTxt.height + 44);

  return {
    h: head.h + Math.max(bodyH, centerH),
    s: (function () {
      var s = head.draw(0, 0);
      var oy = head.h;
      var totalH = Math.max(bodyH, centerH);
      var midY = oy + totalH / 2;
      var cxL = (w - centerW) / 2, cxR = cxL + centerW;

      function drawSide(side, isRight) {
        var out = '';
        var y = oy + (totalH - sideH(side)) / 2;
        side.forEach(function (row) {
          var x = isRight ? cxR + gap : 0;
          var anchorX = isRight ? x : x + sideW;
          var rowMid = y + row.card.h / 2;

          // Branch curve from the centre node to the card's inner edge.
          out += el('path', {
            d: (function () {
              var sx = isRight ? cxR - 4 : cxL + 4;
              var ex = isRight ? anchorX - 6 : anchorX + 6;
              var mx = (sx + ex) / 2;
              return 'M' + r2(sx) + ' ' + r2(midY) +
                'C' + r2(mx) + ' ' + r2(midY) + ',' + r2(mx) + ' ' + r2(rowMid) + ',' + r2(ex) + ' ' + r2(rowMid);
            })(),
            fill: 'none', stroke: row.card.color.s,
            'stroke-width': r2(t.strokeWidth), 'stroke-linecap': 'round', opacity: 0.85
          });

          out += row.card.draw(x, y);

          var ky = y + row.card.h + 6;
          row.kids.forEach(function (k) {
            var kx = isRight ? x + 16 : x + sideW - 16;
            var anchor = isRight ? 'start' : 'end';
            out += el('path', {
              d: rEllipse(isRight ? x + 7 : x + sideW - 7, ky + k.size * 0.5, 2.6, 2.6, ctx.o),
              fill: row.card.color.s, stroke: 'none'
            });
            out += textLines(k.lines, kx, ky + k.size * 0.85, {
              size: k.size, lineHeight: k.lineHeight, fill: t.inkSoft, anchor: anchor, font: t.font
            });
            ky += k.height + 5;
          });
          y += row.h + branchGap;
        });
        return out;
      }

      s += drawSide(R, true);
      s += drawSide(L, false);

      s += el('path', {
        d: rEllipse(w / 2, midY, centerW / 2, centerH / 2, ctx.o),
        fill: centerCol.f, stroke: centerCol.s, 'stroke-width': r2(t.strokeWidth + 0.6)
      });
      s += textLines(cTxt.lines, w / 2, midY - cTxt.height / 2 + cTxt.size * 0.85, {
        size: cTxt.size, lineHeight: cTxt.lineHeight, fill: centerCol.i,
        anchor: 'middle', weight: t.titleWeight, font: t.fontTitle
      });
      return s;
    })()
  };
};

/* --- compare: side-by-side columns -------------------------------- */
BLOCKS.compare = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var cols = arr(b.columns || b.items);
  if (!cols.length) return { h: 0, s: '' };

  var head = layoutBlockTitle(b.title, w, ctx, {});
  var chrome = t.chrome || BASE_CHROME;
  var n = cols.length;
  var vs = b.vs !== false && n === 2;
  var gap = vs ? 54 : 22;
  var colW = (w - gap * (n - 1)) / n;
  var pad = 16;
  var headSize = 18 * t.fontScale;
  var itemSize = 14.5 * t.fontScale;

  var built = cols.map(function (c, i) {
    var head0 = normItem(c);
    var col = resolveColor(t, head0.color, i);
    var ttl = fit(head0.text, colW - pad * 2 - (head0.icon ? 30 : 0), headSize, {
      weight: 'bold', maxLines: 2, lineHeight: 1.25
    });
    var rows = normItems(c && c.items).map(function (it) {
      var body = fit(it.text, colW - pad * 2 - 20, itemSize, { maxLines: 5, lineHeight: 1.4 });
      return { it: it, body: body, h: body.height + 10 };
    });
    var headH = Math.max(ttl.height, head0.icon ? 30 : 0) + 20;
    var bodyH = rows.reduce(function (a, r) { return a + r.h; }, 0) + 8;
    return { head: head0, col: col, ttl: ttl, rows: rows, headH: headH, h: headH + bodyH + pad };
  });

  var bodyH = Math.max.apply(null, built.map(function (c) { return c.h; }));

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      var oy = head.h;

      var boxless = chrome.cardStroke === false;

      built.forEach(function (c, i) {
        var x = i * (colW + gap);
        if (boxless) {
          // A heavy accent rule over the heading replaces the column box.
          s += el('path', {
            d: rLine(x, oy, x + colW, oy, ctx.o), stroke: c.col.s,
            'stroke-width': r2(Math.max(2.5, t.strokeWidth * 2.4)), fill: 'none'
          });
          s += el('path', {
            d: rLine(x, oy + c.headH, x + colW, oy + c.headH, ctx.o), stroke: t.inkSoft,
            'stroke-width': r2(t.strokeWidthThin), fill: 'none', opacity: 0.3
          });
        } else {
          s += el('path', {
            d: rRoundRect(x, oy, colW, bodyH, t.radius, ctx.o),
            fill: 'none', stroke: c.col.s, 'stroke-width': r2(t.strokeWidth), 'stroke-linejoin': 'round'
          });
          // Header band, clipped to the rounded top by overdrawing the body edge.
          s += el('path', {
            d: rRoundRect(x, oy, colW, c.headH, t.radius, ctx.o),
            fill: c.col.f, stroke: c.col.s, 'stroke-width': r2(t.strokeWidthThin), 'stroke-linejoin': 'round'
          });
        }

        var tx = x + pad + (c.head.icon ? 32 : 0);
        if (c.head.icon) s += drawIcon(c.head.icon, x + pad + 13, oy + c.headH / 2, 26, c.col.s, t);
        s += textLines(c.ttl.lines, tx, oy + (c.headH - c.ttl.height) / 2 + c.ttl.size * 0.85, {
          size: c.ttl.size, lineHeight: c.ttl.lineHeight, fill: boxless ? t.ink : c.col.i,
          weight: t.titleWeight, font: t.fontTitle, tracking: chrome.tracking || 0
        });

        var y = oy + c.headH + 12;
        c.rows.forEach(function (row) {
          var marker = row.it.icon;
          var my = y + row.body.size * 0.55;
          if (marker) {
            s += drawIcon(marker, x + pad + 8, my, 17, c.col.s, t);
          } else {
            s += el('path', { d: rEllipse(x + pad + 6, my, 3, 3, ctx.o), fill: c.col.s, stroke: 'none' });
          }
          if (row.it.emphasis) {
            var tw = Math.min(widestLine(row.body.lines, row.body.size), colW - pad * 2 - 20);
            s += drawHighlight(x + pad + 18, y + row.body.size * 0.1, tw + 6, row.body.size, ctx);
          }
          s += textLines(row.body.lines, x + pad + 20, y + row.body.size * 0.85, {
            size: row.body.size, lineHeight: row.body.lineHeight, fill: t.ink, font: t.font
          });
          y += row.h;
        });
      });

      if (vs) {
        var mx = colW + gap / 2;
        var vsSize = 20 * t.titleFontScale;
        if (!boxless) {
          s += el('path', { d: rEllipse(mx, oy + bodyH / 2, 21, 21, ctx.o), fill: t.bg, stroke: t.inkSoft, 'stroke-width': r2(t.strokeWidthThin) });
        }
        s += textLines(['VS'], mx, oy + bodyH / 2 + vsSize * 0.34, {
          size: vsSize, fill: t.inkSoft, anchor: 'middle', weight: t.titleWeight, font: t.fontTitle
        });
      }
      return s;
    })()
  };
};

/* --- grid: uniform card grid -------------------------------------- */
BLOCKS.grid = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var items = normItems(b.items);
  if (!items.length) return { h: 0, s: '' };

  var head = layoutBlockTitle(b.title, w, ctx, {});
  // Marks are drawn outside the card, so they need gutter to live in.
  var hasMark = items.some(function (it) { return !!it.mark; }) || !!b.mark;
  var gap = num(b.gap, hasMark ? 34 : 18);
  var minCard = num(b.minCardWidth, 170);
  var fitCols = Math.floor((w + gap) / (minCard + gap));
  var cols = balancedCols(items.length, num(b.cols || b.perRow, Math.max(1, fitCols)));
  var cardW = (w - gap * (cols - 1)) / cols;

  var cards = items.map(function (it, i) {
    return layoutCard(it, cardW, ctx, {
      variant: b.shape || 'round', index: i, minH: num(b.minHeight, 92),
      align: b.align || 'center', titleSize: 16, noteSize: 12.5,
      iconSize: 28, pad: 14
    });
  });

  var rows = [];
  for (var i = 0; i < cards.length; i += cols) rows.push(cards.slice(i, i + cols));
  var rowH = rows.map(function (row) { return Math.max.apply(null, row.map(function (c) { return c.h; })); });
  var bodyH = rowH.reduce(function (a, x) { return a + x; }, 0) + gap * (rows.length - 1);

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      var y = head.h;
      rows.forEach(function (row, ri) {
        row.forEach(function (c, ci) {
          // Uniform row height: cards stretch rather than float.
          var stretched = layoutCard(items[ri * cols + ci], cardW, ctx, {
            variant: b.shape || 'round', index: ri * cols + ci, fixedH: rowH[ri],
            align: b.align || 'center', titleSize: 16, noteSize: 12.5, iconSize: 28, pad: 14
          });
          s += stretched.draw(ci * (cardW + gap), y);
        });
        y += rowH[ri] + gap;
      });
      return s;
    })()
  };
};

/* --- matrix: 2x2 quadrants with labelled axes --------------------- */
BLOCKS.matrix = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var quads = normItems(b.quadrants || b.items).slice(0, 4);
  while (quads.length < 4) quads.push(normItem(''));

  var head = layoutBlockTitle(b.title, w, ctx, {});
  var axisPad = 40;
  var gap = 14;
  var gridW = w - axisPad;
  var cellW = (gridW - gap) / 2;
  // Size cells to their content; a fixed aspect ratio leaves huge empty boxes.
  var probe = quads.map(function (q, i) {
    return layoutCard(q, cellW, ctx, {
      variant: 'round', index: i, minH: 112, align: 'center',
      titleSize: 17, noteSize: 12.5, iconSize: 26, pad: 14
    });
  });
  var cellH = num(b.cellHeight, Math.max.apply(null, probe.map(function (c) { return c.h; })));
  var gridH = cellH * 2 + gap;
  var bodyH = gridH + axisPad;

  var xAxis = arr(b.xAxis || b.x);
  var yAxis = arr(b.yAxis || b.y);
  var axisSize = 13 * t.fontScale;

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      var oy = head.h;
      var gx = axisPad, gy = oy;

      quads.forEach(function (q, i) {
        var cx = gx + (i % 2) * (cellW + gap);
        var cy = gy + Math.floor(i / 2) * (cellH + gap);
        var card = layoutCard(q, cellW, ctx, {
          variant: 'round', index: i, fixedH: cellH, align: 'center',
          titleSize: 17, noteSize: 12.5, iconSize: 26, pad: 14
        });
        s += card.draw(cx, cy);
      });

      // Axis arrows framing the grid.
      s += el('path', {
        d: rArrow(axisPad - 12, gy + gridH + 12, gx + gridW, gy + gridH + 12, ctx.o, 9),
        stroke: t.inkSoft, 'stroke-width': r2(t.strokeWidthThin), fill: 'none', 'stroke-linecap': 'round'
      });
      s += el('path', {
        d: rArrow(axisPad - 12, gy + gridH + 12, axisPad - 12, gy - 2, ctx.o, 9),
        stroke: t.inkSoft, 'stroke-width': r2(t.strokeWidthThin), fill: 'none', 'stroke-linecap': 'round'
      });

      if (xAxis[0]) s += textLines([String(xAxis[0])], gx + 4, gy + gridH + 12 + axisSize * 1.5, { size: axisSize, fill: t.inkSoft, font: t.font });
      if (xAxis[1]) s += textLines([String(xAxis[1])], gx + gridW, gy + gridH + 12 + axisSize * 1.5, { size: axisSize, fill: t.inkSoft, anchor: 'end', font: t.font });

      // Y labels are rotated -90, so the anchor controls which way they grow:
      // 'start' runs upward from the point, 'end' runs downward.
      function yLabel(text, y, anchor) {
        return el('text', {
          transform: 'rotate(-90 4 ' + r2(y) + ')', x: 4, y: r2(y),
          'font-family': t.font, 'font-size': r2(axisSize),
          fill: t.inkSoft, 'text-anchor': anchor
        }, esc(text));
      }
      if (yAxis[0]) s += yLabel(String(yAxis[0]), gy + gridH, 'start');
      if (yAxis[1]) s += yLabel(String(yAxis[1]), gy + 2, 'end');
      return s;
    })()
  };
};

/* --- pyramid: stacked trapezoid layers ---------------------------- */
BLOCKS.pyramid = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var items = normItems(b.items);
  if (!items.length) return { h: 0, s: '' };

  var head = layoutBlockTitle(b.title, w, ctx, {});
  var n = items.length;
  var invert = !!(b.invert || b.funnel);
  var layerH = num(b.layerHeight, 68);
  var gap = 8;
  var narrow = 0.28;
  // Full-bleed layers stop looking like a pyramid on wide canvases.
  var pw = Math.min(w, num(b.maxWidth, 680));
  var bodyH = n * layerH + gap * (n - 1);

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      var oy = head.h;
      var cx = w / 2;

      items.forEach(function (it, i) {
        var idx = invert ? n - 1 - i : i;
        var topRatio = narrow + (1 - narrow) * (idx / n);
        var botRatio = narrow + (1 - narrow) * ((idx + 1) / n);
        var tw = pw * topRatio, bw = pw * botRatio;
        var y = oy + i * (layerH + gap);
        var col = resolveColor(t, it.color, i);

        var quad = [
          [cx - tw / 2, y], [cx + tw / 2, y],
          [cx + bw / 2, y + layerH], [cx - bw / 2, y + layerH]
        ];
        s += el('path', { d: rPoly(quad, true, exactOpts()), fill: col.f, stroke: 'none' });
        s += el('path', {
          d: rPoly(quad, true, ctx.o), fill: 'none',
          stroke: col.s, 'stroke-width': r2(t.strokeWidth), 'stroke-linejoin': 'round'
        });

        var innerW = Math.min(tw, bw) - 24;
        var ttl = fit(it.text, Math.max(60, innerW), 16.5 * t.fontScale, {
          weight: 'bold', maxLines: 2, lineHeight: 1.24
        });
        var note = it.note ? fit(it.note, Math.max(60, innerW), 12 * t.fontScale, { maxLines: 1 }) : null;
        var stackH = ttl.height + (note ? note.height + 2 : 0);
        var ty = y + (layerH - stackH) / 2;

        s += textLines(ttl.lines, cx, ty + ttl.size * 0.85, {
          size: ttl.size, lineHeight: ttl.lineHeight, fill: col.i,
          anchor: 'middle', weight: t.titleWeight, font: t.font
        });
        if (note) {
          s += textLines(note.lines, cx, ty + ttl.height + 2 + note.size * 0.85, {
            size: note.size, fill: t.inkSoft, anchor: 'middle', font: t.font
          });
        }
      });
      return s;
    })()
  };
};


/* ------------------------------------------------------------------ *
 * actor blocks
 * ------------------------------------------------------------------ */

/** Speech bubble sized to its text, with the tail pointing down. */
function layoutBubble(text, maxW, ctx, opts) {
  var o = opts || {};
  var t = ctx.theme;
  var col = o.color || resolveColor(t, null, 0);
  var size = num(o.size, 13.5) * t.fontScale;
  var pad = 11;
  var body = fit(text, maxW - pad * 2, size, { maxLines: 4, lineHeight: 1.36 });
  var w = Math.min(maxW, Math.max(56, widestLine(body.lines, body.size) + pad * 2));
  var boxH = body.height + pad * 2;
  var tail = 12;
  // An ellipse inscribing a text box has to be ~1.3x its width to clear the
  // corners, or the first and last words spill outside the outline.
  if (o.thought) {
    w = Math.min(maxW * 1.2, w * 1.28);
    // Keep a minimum aspect so a one-liner does not become a flat sliver.
    boxH = Math.max(boxH * 1.35, w * 0.34);
  }

  var sideTail = o.tail === 'left' || o.tail === 'right';
  return {
    w: w, h: boxH + (sideTail ? 0 : tail),
    /** `cx` is the horizontal centre; `y` the top of the bubble. */
    draw: function (cx, y) {
      var x = cx - w / 2;
      var thought = o.thought;
      var s = '';
      if (thought) {
        // Thought bubbles trail dots instead of a tail.
        s += el('path', {
          d: rEllipse(cx, y + boxH / 2, w / 2, boxH / 2, ctx.o),
          fill: t.bg, stroke: col.s, 'stroke-width': r2(t.strokeWidthThin)
        });
        s += el('path', { d: rEllipse(cx - w * 0.1, y + boxH + 5, 4, 3.4, ctx.o), fill: t.bg, stroke: col.s, 'stroke-width': r2(t.strokeWidthThin) });
        s += el('path', { d: rEllipse(cx - w * 0.16, y + boxH + 12, 2.6, 2.2, ctx.o), fill: t.bg, stroke: col.s, 'stroke-width': r2(t.strokeWidthThin) });
      } else {
        s += el('path', {
          d: rRoundRect(x, y, w, boxH, t.radius ? t.radius + 4 : 0, ctx.o),
          fill: t.bg, stroke: col.s, 'stroke-width': r2(t.strokeWidthThin), 'stroke-linejoin': 'round'
        });
        var tri, seam;
        if (o.tail === 'left' || o.tail === 'right') {
          // Side tail: points across at a speaker standing beside the bubble.
          var ty = y + boxH * 0.62;
          var ex = o.tail === 'left' ? x - tail : x + w + tail;
          var ix = o.tail === 'left' ? x + 1 : x + w - 1;
          tri = [[ix, ty - 9], [ex, ty + 2], [ix, ty + 9]];
          seam = 'M' + r2(ix) + ' ' + r2(ty - 8) + 'L' + r2(ix) + ' ' + r2(ty + 8);
        } else {
          tri = [[cx - 7, y + boxH - 1], [cx - 1, y + boxH + tail], [cx + 8, y + boxH - 1]];
          seam = 'M' + r2(cx - 6) + ' ' + r2(y + boxH) + 'L' + r2(cx + 7) + ' ' + r2(y + boxH);
        }
        s += el('path', { d: rPoly(tri, true, exactOpts()), fill: t.bg, stroke: 'none' });
        s += el('path', {
          d: rPoly(tri, false, ctx.o), fill: 'none',
          stroke: col.s, 'stroke-width': r2(t.strokeWidthThin), 'stroke-linejoin': 'round'
        });
        s += el('path', { d: seam, stroke: t.bg, 'stroke-width': r2(t.strokeWidthThin * 2.4), fill: 'none' });
      }
      s += textLines(body.lines, cx, y + pad + body.size * 0.82, {
        size: body.size, lineHeight: body.lineHeight, fill: t.ink,
        anchor: 'middle', font: t.font
      });
      return s;
    }
  };
}

/* --- actors: a row of figures, optionally speaking ---------------- */
BLOCKS.actors = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var items = arr(b.items).map(function (x) {
    var it = normItem(x);
    it.pose = (x && x.pose) || null;
    it.face = (x && x.face) != null ? x.face : null;
    it.says = (x && (x.says || x.say || x.speech)) || null;
    it.thinks = (x && (x.thinks || x.think)) || null;
    it.body = (x && x.body) || null;
    it.fx = (x && (x.fx || x.effect)) || null;
    it.shout = (x && (x.shout || x.exclaim)) || null;
    return it;
  });
  if (!items.length) return { h: 0, s: '' };

  var head = layoutBlockTitle(b.title, w, ctx, {});
  var n = items.length;
  var gap = num(b.gap, 20);
  var slotW = (w - gap * (n - 1)) / n;
  var actorH = num(b.size, 112);
  var labelSize = 14.5 * t.fontScale;
  var noteSize = 12 * t.fontScale;

  var cells = items.map(function (it, i) {
    var col = resolveColor(t, it.color, i);
    var speech = it.says || it.thinks;
    var bubble = speech
      ? layoutBubble(speech, Math.min(slotW + gap * 0.6, 230), ctx, { color: col, thought: !!it.thinks })
      : null;
    // A shout is set large and un-bubbled above the head, sticker-sheet style.
    var shout = it.shout
      ? fit(String(it.shout), slotW + gap * 0.5, 25 * t.titleFontScale, { weight: 'bold', maxLines: 1, minSize: 13 })
      : null;
    var label = it.text ? fit(it.text, slotW, labelSize, { weight: 'bold', maxLines: 2, lineHeight: 1.25 }) : null;
    var note = it.note ? fit(it.note, slotW, noteSize, { maxLines: 2, lineHeight: 1.3 }) : null;
    return { it: it, col: col, bubble: bubble, shout: shout, label: label, note: note };
  });

  var bubbleH = Math.max.apply(null, [0].concat(cells.map(function (c) {
    return Math.max(c.bubble ? c.bubble.h : 0, c.shout ? c.shout.height + 8 : 0);
  })));
  var labelH = Math.max.apply(null, [0].concat(cells.map(function (c) {
    return (c.label ? c.label.height : 0) + (c.note ? c.note.height + 3 : 0);
  })));
  var bubbleGap = bubbleH ? 8 : 0;
  var bodyH = bubbleH + bubbleGap + actorH + (labelH ? labelH + 10 : 0);

  return {
    h: head.h + bodyH,
    s: (function () {
      var s = head.draw(0, 0);
      var oy = head.h;
      cells.forEach(function (c, i) {
        var cx = i * (slotW + gap) + slotW / 2;
        // Bubbles are bottom-aligned to the tallest one so the figures line up.
        if (c.bubble) s += c.bubble.draw(cx, oy + bubbleH - c.bubble.h);
        if (c.shout) {
          s += textLines(c.shout.lines, cx, oy + bubbleH - 4, {
            size: c.shout.size, fill: c.col.s, anchor: 'middle',
            weight: t.titleWeight, font: t.fontTitle, tracking: (t.chrome.tracking || 0)
          });
        }
        var top = oy + bubbleH + bubbleGap;
        s += drawActor(cx, top, actorH, {
          pose: c.it.pose, face: c.it.face, color: c.col.s,
          body: c.it.body || b.body, fx: c.it.fx,
          fill: b.filled ? c.col.f : t.bg
        }, ctx);

        var ly = top + actorH + 10;
        if (c.label) {
          s += textLines(c.label.lines, cx, ly + c.label.size * 0.85, {
            size: c.label.size, lineHeight: c.label.lineHeight, fill: t.ink,
            anchor: 'middle', weight: t.titleWeight, font: t.fontTitle
          });
          ly += c.label.height + 3;
        }
        if (c.note) {
          s += textLines(c.note.lines, cx, ly + c.note.size * 0.85, {
            size: c.note.size, lineHeight: c.note.lineHeight, fill: t.inkSoft,
            anchor: 'middle', font: t.font
          });
        }
      });
      return s;
    })()
  };
};

/* --- scene: one figure beside a statement ------------------------- */
BLOCKS.scene = function (b, ctx) {
  var t = ctx.theme, w = ctx.w;
  var actor = normItem(b.actor || b.who || {});
  var col = resolveColor(t, actor.color != null ? actor.color : b.color, 0);
  var side = b.side === 'right' ? 'right' : 'left';
  var actorH = num(b.size, 118);
  var actorW = actorH * 0.7;
  var gap = 22;

  var textW = w - actorW - gap;
  var bubble = layoutBubble(b.text || b.says || '', textW, ctx, {
    color: col, size: num(b.textSize, 16), thought: !!b.thinks,
    tail: b.thinks ? null : (side === 'left' ? 'left' : 'right')
  });
  // Let the bubble use the full column rather than shrink-wrapping.
  var bodyH = Math.max(actorH + 26, bubble.h + 20);

  return {
    h: bodyH,
    s: (function () {
      var s = '';
      var ax = side === 'left' ? actorW / 2 : w - actorW / 2;
      var bx = side === 'left' ? actorW + gap + textW / 2 : textW / 2;
      s += drawActor(ax, (bodyH - actorH) / 2, actorH, {
        pose: actor.pose || b.pose, face: actor.face != null ? actor.face : b.face,
        body: (b.actor && b.actor.body) || b.body,
        fx: (b.actor && (b.actor.fx || b.actor.effect)) || b.fx,
        color: col.s, fill: b.filled ? col.f : t.bg
      }, ctx);
      s += bubble.draw(bx, (bodyH - bubble.h) / 2);
      if (actor.text) {
        s += textLines([actor.text], ax, (bodyH + actorH) / 2 + 16, {
          size: 13.5 * t.fontScale, fill: t.inkSoft, anchor: 'middle', font: t.font
        });
      }
      return s;
    })()
  };
};


/* ------------------------------------------------------------------ *
 * layout engine
 *
 * Blocks are stacked vertically. Each renderer reports its own height,
 * so the agent never supplies a coordinate and blocks can never overlap.
 * ------------------------------------------------------------------ */

/** Blocks that carry no content of their own, so the camera skips them. */
var NON_STOP = { divider: 1, spacer: 1 };

var DEFAULTS = {
  width: 1100,
  padding: 44,
  gap: 34,
  theme: 'sketch',
  seed: 'visualthink',
  background: true,
  paper: false
};

/** Placeholder drawn when a block type is unknown or throws. */
function errorBlock(message, w, ctx) {
  var t = ctx.theme;
  var size = 14 * t.fontScale;
  var lines = fit(message, w - 28, size, { maxLines: 4, lineHeight: 1.35 });
  var h = lines.height + 28;
  var s = el('path', {
    d: rRoundRect(0, 0, w, h, 8, ctx.o),
    fill: '#FEECEC', stroke: '#C0392B', 'stroke-width': 1.5, 'stroke-dasharray': '6 4'
  });
  s += textLines(lines.lines, 14, 18 + size * 0.6, {
    size: size, lineHeight: lines.lineHeight, fill: '#8B2A1F', font: t.font
  });
  return { h: h, s: s };
}

/** Normalise loose spec shapes into a canonical block list. */
function normalizeSpec(spec) {
  if (Array.isArray(spec)) spec = { blocks: spec };
  spec = spec || {};
  var blocks = arr(spec.blocks || spec.items).slice();

  // `title` / `subtitle` at the top level are sugar for a leading title block.
  if (spec.title) {
    blocks.unshift({
      type: 'title', text: spec.title, sub: spec.subtitle || spec.sub || null,
      icon: spec.icon || null, color: spec.color || null
    });
  }
  return assign({}, spec, { blocks: blocks });
}

/**
 * Render the block stack into positioned SVG plus the total height.
 * Returns { body, height, warnings }.
 */
function layoutBlocks(spec, opt, ctx) {
  var pad = opt.padding;
  var contentW = opt.width - pad * 2;
  var warnings = [];
  var parts = [];
  var y = pad;
  var blocks = spec.blocks;

  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i] || {};
    var type = b.type || 'callout';
    var blockCtx = assign({}, ctx, { w: contentW, index: i });
    var res;

    if (!BLOCKS[type]) {
      warnings.push('block[' + i + ']: unknown type "' + type + '"');
      res = errorBlock('Unknown block type: "' + type + '". Known types: ' + Object.keys(BLOCKS).sort().join(', '), contentW, blockCtx);
    } else {
      try {
        res = BLOCKS[type](b, blockCtx);
      } catch (err) {
        warnings.push('block[' + i + '] (' + type + ') failed: ' + (err && err.message));
        res = errorBlock('Failed to render "' + type + '": ' + (err && err.message), contentW, blockCtx);
      }
    }

    if (!res || !res.s) { if (res && !res.h) continue; }
    // `step` groups blocks the presenter should visit together; without it each
    // block is its own camera stop. Pure spacing blocks are never a stop.
    var stepId = NON_STOP[type] ? null : num(b.step, i);
    parts.push(g({
      transform: 'translate(' + r2(pad) + ',' + r2(y) + ')',
      'data-vt-step': stepId
    }, res.s));
    y += res.h;
    if (i < blocks.length - 1) y += num(b.gapAfter, opt.gap);
  }

  return { body: parts.join(''), height: Math.round(y + pad), warnings: warnings };
}

/**
 * Notebook surfaces. Rendered as an SVG <pattern> so the cost is constant
 * no matter how tall the page gets.
 */
function paperPattern(kind, id, theme) {
  var line = theme.inkSoft;
  if (kind === 'dot') {
    return el('pattern', { id: id, width: 22, height: 22, patternUnits: 'userSpaceOnUse' },
      el('circle', { cx: 2, cy: 2, r: 1.25, fill: line, opacity: 0.28 }));
  }
  if (kind === 'grid') {
    return el('pattern', { id: id, width: 26, height: 26, patternUnits: 'userSpaceOnUse' },
      el('path', { d: 'M26 0H0V26', fill: 'none', stroke: line, 'stroke-width': 1, opacity: 0.16 }));
  }
  if (kind === 'ruled') {
    return el('pattern', { id: id, width: 100, height: 30, patternUnits: 'userSpaceOnUse' },
      el('path', { d: 'M0 29.5H100', fill: 'none', stroke: line, 'stroke-width': 1, opacity: 0.2 }));
  }
  return '';
}

/** Subtle paper grain, only worth the filter cost on the sketch theme. */
function paperFilter(id) {
  return el('filter', { id: id, x: '0', y: '0', width: '100%', height: '100%' },
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '3', result: 'noise' }) +
    el('feColorMatrix', { type: 'saturate', values: '0', 'in': 'noise', result: 'mono' }) +
    el('feComponentTransfer', { 'in': 'mono', result: 'faded' }, el('feFuncA', { type: 'linear', slope: '0.045' })) +
    el('feComposite', { operator: 'over', 'in': 'faded', in2: 'SourceGraphic' })
  );
}


/* ------------------------------------------------------------------ *
 * public API
 * ------------------------------------------------------------------ */

/**
 * Density presets. These bound how much goes on one page and how long a label
 * may be. They are advisory - validate() reports them as warnings and rendering
 * is unaffected, because an over-long label shrinks rather than breaking.
 */
var DENSITY = {
  brief:    { blocks: [3, 5],  text: 14, note: 24, body: 60,  label: '간결' },
  standard: { blocks: [4, 8],  text: 20, note: 40, body: 110, label: '표준' },
  detailed: { blocks: [8, 14], text: 26, note: 56, body: 180, label: '상세' }
};

/** Absolute ceiling applied even when no density was chosen. */
var HARD_BLOCK_MAX = 16;

/** Codepoint length - Korean and emoji must not be counted as UTF-16 units. */
function glyphLen(str) {
  return Array.from(String(str == null ? '' : str)).length;
}

/**
 * Check page volume against the chosen density. Too *few* blocks is only worth
 * mentioning when a density was explicitly requested; too many is always worth
 * mentioning, because it is the failure that turns a summary into a wall.
 */
function checkDensity(spec, warnings) {
  var d = DENSITY[spec.density];
  var n = spec.blocks.length;

  if (d) {
    if (n < d.blocks[0]) {
      warnings.push('density "' + spec.density + '" (' + d.label + '): ' + n +
        ' blocks is thin; aim for ' + d.blocks[0] + '-' + d.blocks[1]);
    } else if (n > d.blocks[1]) {
      warnings.push('density "' + spec.density + '" (' + d.label + '): ' + n +
        ' blocks exceeds ' + d.blocks[1] + '; split the page or cut a block');
    }
  } else if (n > HARD_BLOCK_MAX) {
    warnings.push(n + ' blocks on one page; past ~' + HARD_BLOCK_MAX +
      ' it stops reading as a summary. Set `density` or split the page.');
  }
  if (!d) return;

  // Label budgets. Long text does not overflow - it shrinks - so this is a
  // legibility warning, not a correctness one.
  var overText = 0, overNote = 0, overBody = 0, worst = '';
  // Prose blocks get a sentence-scale budget; everything else is a label.
  var PROSE = { callout: 1, quote: 1, scene: 1 };

  spec.blocks.forEach(function (b) {
    if (PROSE[b.type] && glyphLen(b.text) > d.body) overBody++;

    var pool = arr(b.items).concat(arr(b.columns), arr(b.branches), arr(b.quadrants));
    arr(b.columns).forEach(function (c) { pool = pool.concat(arr(c && c.items)); });
    arr(b.branches).forEach(function (c) { pool = pool.concat(arr(c && c.children)); });
    if (b.center) pool.push(b.center);

    pool.forEach(function (raw) {
      var it = normItem(raw);
      if (glyphLen(it.text) > d.text) {
        overText++;
        if (glyphLen(it.text) > glyphLen(worst)) worst = it.text;
      }
      if (it.note && glyphLen(it.note) > d.note) overNote++;
    });
  });
  if (overBody) {
    warnings.push(overBody + ' callout/quote text longer than ' + d.body +
      ' chars for density "' + spec.density + '"; tighten it or split the point');
  }
  if (overText) {
    warnings.push(overText + ' label(s) longer than ' + d.text + ' chars for density "' +
      spec.density + '" (longest: "' + String(worst).slice(0, 24) + '…"); they will render small');
  }
  if (overNote) {
    warnings.push(overNote + ' note(s) longer than ' + d.note + ' chars for density "' + spec.density + '"');
  }
}

/**
 * Static check of a spec before rendering. Agents should call this and
 * surface `errors` rather than shipping a broken diagram.
 * Returns { ok, errors, warnings }.
 */
function validate(spec) {
  var errors = [], warnings = [];
  var s = normalizeSpec(spec);

  if (!Array.isArray(s.blocks) || !s.blocks.length) {
    errors.push('spec.blocks must be a non-empty array');
    return { ok: false, errors: errors, warnings: warnings };
  }
  if (s.theme && typeof s.theme === 'string' && !THEMES[s.theme]) {
    warnings.push('unknown theme "' + s.theme + '", falling back to sketch. Known: ' + Object.keys(THEMES).join(', '));
  }
  if (s.density != null && !DENSITY[s.density]) {
    warnings.push('unknown density "' + s.density + '" (ignored). Known: ' + Object.keys(DENSITY).join(', '));
  }
  checkDensity(s, warnings);

  var known = Object.keys(BLOCKS);
  s.blocks.forEach(function (b, i) {
    var at = 'blocks[' + i + ']';
    if (!b || typeof b !== 'object') { errors.push(at + ' must be an object'); return; }
    var type = b.type || 'callout';
    if (known.indexOf(type) === -1) {
      errors.push(at + ': unknown type "' + type + '". Known: ' + known.sort().join(', '));
      return;
    }

    var needsItems = ['flow', 'steps', 'cycle', 'timeline', 'grid', 'list', 'stats'];
    if (needsItems.indexOf(type) !== -1 && !arr(b.items).length) {
      errors.push(at + ' (' + type + '): requires a non-empty `items` array');
    }
    if (type === 'compare' && !arr(b.columns || b.items).length) {
      errors.push(at + ' (compare): requires a non-empty `columns` array');
    }
    if (type === 'mindmap' && !arr(b.branches || b.items).length) {
      errors.push(at + ' (mindmap): requires a non-empty `branches` array');
    }
    if (type === 'mindmap' && !(b.center || b.text)) {
      warnings.push(at + ' (mindmap): no `center` given; the hub will be blank');
    }
    if ((type === 'title' || type === 'callout' || type === 'quote') && !(b.text || b.title)) {
      warnings.push(at + ' (' + type + '): empty `text`');
    }

    // Icon and colour names are forgiving at render time; warn here instead.
    var scan = arr(b.items).concat(arr(b.columns), arr(b.branches), arr(b.quadrants), b.center ? [b.center] : []);
    scan.forEach(function (raw, j) {
      if (!raw || typeof raw !== 'object') return;
      if (raw.icon && !resolveIcon(raw.icon)) {
        warnings.push(at + '.items[' + j + ']: unknown icon "' + raw.icon + '" (ignored). See VT.icons');
      }
      var c = raw.color != null ? raw.color : raw.accent;
      if (typeof c === 'string' && !THEMES.sketch.palette[c] && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) {
        warnings.push(at + '.items[' + j + ']: unknown color "' + c + '" (auto-assigned). See VT.colors');
      }
      arr(raw.items).forEach(function (sub, k) {
        if (sub && typeof sub === 'object' && sub.icon && !resolveIcon(sub.icon)) {
          warnings.push(at + '.items[' + j + '].items[' + k + ']: unknown icon "' + sub.icon + '"');
        }
      });
    });
    if (b.icon && !resolveIcon(b.icon)) {
      warnings.push(at + ': unknown icon "' + b.icon + '" (ignored)');
    }
  });

  return { ok: errors.length === 0, errors: errors, warnings: warnings };
}

/** Render a spec to an SVG string. */
function render(spec, options) {
  var s = normalizeSpec(spec);
  var opt = assign({}, DEFAULTS, s, options || {});
  var theme = getTheme(opt.theme);
  var rng = makeRng(opt.seed);
  var ctx = { theme: theme, rng: rng, o: ctxOf(theme, rng), opt: opt };

  var laid = layoutBlocks(s, opt, ctx);
  var W = opt.width, H = laid.height;
  var body = laid.body;

  // `aspect` pins the canvas (16/9 for slides). Content shorter than the frame
  // is centred; taller content is scaled down so a slide never crops.
  if (opt.aspect) {
    var frameH = Math.round(W / opt.aspect);
    var k = Math.min(1, frameH / H);
    var tx = (W - W * k) / 2, ty = (frameH - H * k) / 2;
    body = g({ transform: 'translate(' + r2(tx) + ',' + r2(ty) + ') scale(' + r2(k) + ')' }, body);
    H = frameH;
  }

  var defs = '';
  // `paper` accepts true (grain) or a surface name: grid | dot | ruled.
  var paperKind = opt.paper === true ? 'grain' : opt.paper;
  var useGrain = paperKind === 'grain' && theme.roughness > 0;
  var patternKind = ['grid', 'dot', 'ruled'].indexOf(paperKind) !== -1 ? paperKind : null;
  if (useGrain) defs += paperFilter('vt-paper');
  if (patternKind) defs += paperPattern(patternKind, 'vt-surface', theme);
  if (theme.fontImport && opt.embedFonts !== false) {
    defs += el('style', { type: 'text/css' }, '@import url(' + theme.fontImport + ');');
  }

  var bg = '';
  if (opt.background !== false) {
    var bgColor = typeof opt.background === 'string' ? opt.background : theme.bg;
    bg = el('rect', { x: 0, y: 0, width: W, height: H, fill: bgColor });
  }
  // The surface sits above the flat fill but below every block.
  if (patternKind) bg += el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#vt-surface)' });

  var content = bg + body;
  if (useGrain) content = g({ filter: 'url(#vt-paper)' }, content);

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' +
    ' width="100%" style="max-width:' + W + 'px;height:auto;display:block"' +
    ' role="img" aria-label="' + esc(opt.alt || s.title || 'visual summary') + '"' +
    ' data-vt-theme="' + esc(theme.name) + '">' +
    (defs ? el('defs', {}, defs) : '') +
    content +
    '</svg>';

  if (laid.warnings.length && typeof console !== 'undefined' && opt.quiet !== true) {
    laid.warnings.forEach(function (m) { console.warn('[visualthink] ' + m); });
  }
  return svg;
}

/** Render into a DOM element. Returns the inserted <svg>. */
function mount(target, spec, options) {
  var node = typeof target === 'string' ? document.querySelector(target) : target;
  if (!node) throw new Error('[visualthink] mount target not found: ' + target);
  node.innerHTML = render(spec, options);
  return node.firstChild;
}

/** Wrap the SVG in a complete, self-contained HTML document. */
function toHTML(spec, options) {
  var s = normalizeSpec(spec);
  var opt = assign({}, DEFAULTS, s, options || {});
  var theme = getTheme(opt.theme);
  var svg = render(spec, assign({}, options, { embedFonts: false }));
  var title = s.title || opt.alt || 'visualthink';

  return '<!doctype html>\n<html lang="' + (opt.lang || 'ko') + '">\n<head>\n' +
    '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n' +
    (theme.fontImport ? '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="' + esc(theme.fontImport) + '">\n' : '') +
    '<style>\n' +
    '  body{margin:0;padding:24px;background:' + theme.bg + ';display:flex;justify-content:center}\n' +
    '  main{width:100%;max-width:' + opt.width + 'px}\n' +
    '  @media print{body{padding:0;background:#fff}}\n' +
    '</style>\n</head>\n<body>\n<main>' + svg + '</main>\n</body>\n</html>\n';
}

/** Escape an SVG string for use in a data: URI (e.g. an <img src>). */
function toDataURI(spec, options) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(render(spec, options));
}

/** Register a custom block type: VT.defineBlock('mine', fn). */
function defineBlock(name, fn) {
  if (typeof fn !== 'function') throw new Error('[visualthink] block renderer must be a function');
  BLOCKS[name] = fn;
  return BLOCKS;
}


/* ------------------------------------------------------------------ *
 * presentation mode
 *
 * Not a slide deck. The page stays one continuous canvas and the camera
 * flies to each block in turn, zooming it to fill the screen. Zooming out
 * to the whole page between sections is what makes the structure legible -
 * the audience keeps seeing where a part sits inside the whole.
 *
 * Stop geometry is measured at runtime with getBBox() rather than being
 * precomputed here, so it stays correct after web fonts load and reflow.
 * ------------------------------------------------------------------ */

var PRESENT_CSS = [
  '*{box-sizing:border-box}',
  'html,body{margin:0;height:100%;overflow:hidden;background:%SHELL%;',
  '  font-family:%FONT%;-webkit-font-smoothing:antialiased}',
  '#stage{position:fixed;inset:0;overflow:hidden}',
  '#canvas{position:absolute;top:0;left:0;transform-origin:0 0;',
  '  transition:transform %MS%ms cubic-bezier(.32,.72,.24,1)}',
  '#canvas svg{display:block;width:100%;height:100%}',
  '[data-vt-step]{transition:opacity 420ms ease}',
  '#canvas.dim [data-vt-step]{opacity:.15}',
  '#canvas.dim [data-vt-step].on{opacity:1}',
  '#hud{position:fixed;left:0;right:0;bottom:0;padding:14px 20px;display:flex;',
  '  align-items:center;gap:14px;pointer-events:none;',
  '  background:linear-gradient(transparent,rgba(0,0,0,.13))}',
  '#bar{flex:1;height:3px;background:rgba(0,0,0,.13);border-radius:2px;overflow:hidden}',
  '#bar i{display:block;height:100%;width:0;background:%ACCENT%;',
  '  transition:width %MS%ms cubic-bezier(.32,.72,.24,1)}',
  '#count{font:600 12px/1 ui-monospace,SFMono-Regular,monospace;color:%MUTED%;',
  '  letter-spacing:.08em;min-width:58px;text-align:right}',
  '#label{font:600 12px/1 %FONT%;color:%MUTED%;max-width:40vw;overflow:hidden;',
  '  text-overflow:ellipsis;white-space:nowrap}',
  '#help{position:fixed;top:14px;right:18px;font:500 11px/1.75 %FONT%;color:%MUTED%;',
  '  text-align:right;opacity:0;transition:opacity .3s;pointer-events:none;white-space:pre}',
  '#help.show{opacity:.7}',
  '#hint{position:fixed;top:15px;left:18px;font:600 11px/1 %FONT%;color:%MUTED%;',
  '  letter-spacing:.08em;opacity:.45}',
  '#grid{position:fixed;inset:0;background:%GRIDBG%;overflow:auto;padding:26px;',
  '  display:none;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;align-content:start}',
  '#grid.on{display:grid}',
  '#grid button{all:unset;cursor:pointer;border:2px solid transparent;border-radius:10px;',
  '  overflow:hidden;background:%PAPER%;box-shadow:0 1px 5px rgba(0,0,0,.11);position:relative}',
  '#grid button:hover,#grid button:focus-visible{border-color:%ACCENT%}',
  '#grid b{position:absolute;left:7px;top:6px;font:700 10px/1 ui-monospace,monospace;',
  '  color:%MUTED%;background:%PAPER%;padding:3px 5px;border-radius:4px}',
  '#grid .thumb{width:100%;aspect-ratio:16/10;overflow:hidden;position:relative}',
  '#grid .thumb>div{position:absolute;top:0;left:0;transform-origin:0 0}',
  '@media print{#hud,#help,#hint,#grid{display:none}',
  '  html,body{overflow:visible;height:auto;background:#fff}',
  '  #stage{position:static;overflow:visible}',
  '  #canvas{position:static;transform:none!important;width:100%!important;height:auto!important}',
  '  #canvas.dim [data-vt-step]{opacity:1}}'
].join('\n');

var PRESENT_JS = [
  '(function(){',
  'var stage=document.getElementById("stage"),canvas=document.getElementById("canvas");',
  'var svg=canvas.querySelector("svg"),grid=document.getElementById("grid");',
  'var barI=document.querySelector("#bar i"),countEl=document.getElementById("count");',
  'var labelEl=document.getElementById("label"),helpEl=document.getElementById("help");',
  'var CFG=window.__VT_PRESENT__,PAD=CFG.pad,MAXZ=CFG.maxZoom,DIM=CFG.dim;',
  'var vb=svg.getAttribute("viewBox").split(/[\\s,]+/).map(Number),W=vb[2],H=vb[3];',
  'canvas.style.width=W+"px";canvas.style.height=H+"px";',
  'var stops=[],cur=0;',
  '',
  '/* getBBox() reports a box in the element\'s OWN coordinate system, before its',
  '   transform. Every block here is inside a translate(), so the raw box would',
  '   put them all at the same place. Map the corners through the element-to-root',
  '   matrix to get true canvas coordinates. */',
  'function absBox(el){',
  '  var b=el.getBBox();',
  '  var rootCTM=svg.getScreenCTM(),elCTM=el.getScreenCTM();',
  '  if(!rootCTM||!elCTM)return b;',
  '  var m=rootCTM.inverse().multiply(elCTM);',
  '  var xs=[],ys=[],pt=svg.createSVGPoint();',
  '  [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]]',
  '    .forEach(function(p){pt.x=p[0];pt.y=p[1];var q=pt.matrixTransform(m);xs.push(q.x);ys.push(q.y)});',
  '  var x0=Math.min.apply(null,xs),y0=Math.min.apply(null,ys);',
  '  return {x:x0,y:y0,width:Math.max.apply(null,xs)-x0,height:Math.max.apply(null,ys)-y0};',
  '}',
  '',
  'function measure(){',
  '  var groups={},order=[];',
  '  Array.prototype.forEach.call(svg.querySelectorAll("[data-vt-step]"),function(el){',
  '    var k=el.getAttribute("data-vt-step"),b;',
  '    try{b=absBox(el)}catch(e){return}',
  '    if(!b||b.width<2||b.height<2)return;',
  '    if(!groups[k]){groups[k]={x:b.x,y:b.y,r:b.x+b.width,b:b.y+b.height,els:[]};order.push(k)}',
  '    var q=groups[k];',
  '    q.x=Math.min(q.x,b.x);q.y=Math.min(q.y,b.y);',
  '    q.r=Math.max(q.r,b.x+b.width);q.b=Math.max(q.b,b.y+b.height);',
  '    q.els.push(el);',
  '  });',
  '  stops=[{x:0,y:0,w:W,h:H,els:[],all:true,label:""}];',
  '  order.sort(function(a,c){return (+a)-(+c)}).forEach(function(k){',
  '    var q=groups[k];',
  '    stops.push({x:q.x,y:q.y,w:q.r-q.x,h:q.b-q.y,els:q.els,label:labelOf(q.els)});',
  '  });',
  '  if(CFG.endOverview&&stops.length>2)stops.push({x:0,y:0,w:W,h:H,els:[],all:true,label:""});',
  '}',
  '',
  'function labelOf(els){',
  '  for(var i=0;i<els.length;i++){var t=els[i].querySelector("text");',
  '    if(t&&t.textContent.trim())return t.textContent.trim().slice(0,60)}',
  '  return "";',
  '}',
  '',
  'function camera(s,SW,SH){',
  '  var k=Math.min(SW/(s.w+PAD*2),SH/(s.h+PAD*2));',
  '  if(!s.all)k=Math.min(k,MAXZ);',
  '  return {k:k,x:SW/2-(s.x+s.w/2)*k,y:SH/2-(s.y+s.h/2)*k};',
  '}',
  '',
  'function apply(i,instant){',
  '  cur=Math.max(0,Math.min(stops.length-1,i));',
  '  var s=stops[cur],c=camera(s,stage.clientWidth,stage.clientHeight);',
  '  if(instant)canvas.style.transition="none";',
  '  canvas.style.transform="translate("+c.x.toFixed(2)+"px,"+c.y.toFixed(2)+"px) scale("+c.k.toFixed(4)+")";',
  '  if(instant)requestAnimationFrame(function(){canvas.style.transition=""});',
  '  if(DIM){',
  '    canvas.classList.toggle("dim",!s.all);',
  '    Array.prototype.forEach.call(svg.querySelectorAll("[data-vt-step].on"),function(e){e.classList.remove("on")});',
  '    s.els.forEach(function(e){e.classList.add("on")});',
  '  }',
  '  barI.style.width=(stops.length<2?100:(cur/(stops.length-1))*100)+"%";',
  '  countEl.textContent=cur+" / "+(stops.length-1);',
  '  labelEl.textContent=(s.all||s.label===CFG.title)?"":s.label;',
  '  if(location.hash!=="#"+cur)history.replaceState(null,"","#"+cur);',
  '}',
  'function go(d){apply(cur+d)}',
  '',
  'function buildGrid(){',
  '  grid.innerHTML="";',
  '  stops.forEach(function(s,i){',
  '    if(i&&i===stops.length-1&&s.all)return;',
  '    var btn=document.createElement("button");btn.title=s.label||"전체";',
  '    var th=document.createElement("div");th.className="thumb";',
  '    var inner=document.createElement("div");inner.innerHTML=svg.outerHTML;',
  '    inner.style.width=W+"px";inner.style.height=H+"px";',
  '    th.appendChild(inner);btn.appendChild(th);',
  '    var tag=document.createElement("b");tag.textContent=s.all?"ALL":i;btn.appendChild(tag);',
  '    btn.onclick=function(){closeGrid();apply(i,true)};',
  '    grid.appendChild(btn);',
  '    requestAnimationFrame(function(){',
  '      var c=camera(s,th.clientWidth,th.clientHeight);',
  '      inner.style.transform="translate("+c.x+"px,"+c.y+"px) scale("+c.k+")";',
  '    });',
  '  });',
  '}',
  'function openGrid(){buildGrid();grid.classList.add("on")}',
  'function closeGrid(){grid.classList.remove("on")}',
  '',
  'document.addEventListener("keydown",function(e){',
  '  if(e.metaKey||e.ctrlKey||e.altKey)return;',
  '  var k=e.key;',
  '  if(k==="ArrowRight"||k==="ArrowDown"||k===" "||k==="PageDown"||k==="Enter"){go(1);e.preventDefault()}',
  '  else if(k==="ArrowLeft"||k==="ArrowUp"||k==="PageUp"||k==="Backspace"){go(-1);e.preventDefault()}',
  '  else if(k==="Home"){apply(0)}',
  '  else if(k==="End"){apply(stops.length-1)}',
  '  else if(k==="o"||k==="O"){grid.classList.contains("on")?closeGrid():openGrid()}',
  '  else if(k==="Escape"){grid.classList.contains("on")?closeGrid():apply(0)}',
  '  else if(k==="f"||k==="F"){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}',
  '  else if(k==="?"||k==="h"||k==="H"){helpEl.classList.toggle("show")}',
  '  else if(/^[0-9]$/.test(k)){apply(+k)}',
  '});',
  'stage.addEventListener("click",function(e){go(e.clientX<stage.clientWidth*0.22?-1:1)});',
  'stage.addEventListener("contextmenu",function(e){e.preventDefault();go(-1)});',
  'var tx0=null;',
  'stage.addEventListener("touchstart",function(e){tx0=e.touches[0].clientX},{passive:true});',
  'stage.addEventListener("touchend",function(e){',
  '  if(tx0===null)return;var dx=e.changedTouches[0].clientX-tx0;',
  '  if(Math.abs(dx)>44)go(dx<0?1:-1);tx0=null;},{passive:true});',
  'addEventListener("resize",function(){apply(cur,true);if(grid.classList.contains("on"))buildGrid()});',
  'addEventListener("hashchange",function(){var n=+location.hash.slice(1);if(!isNaN(n)&&n!==cur)apply(n)});',
  '',
  'function start(){measure();var n=+location.hash.slice(1);apply(!isNaN(n)&&n>0?n:0,true)}',
  '/* Web fonts change text metrics, so measure only once they have settled. */',
  'if(document.fonts&&document.fonts.ready)document.fonts.ready.then(start);else addEventListener("load",start);',
  '})();'
].join('\n');

/**
 * Render a spec as a self-contained presentation: one canvas, a camera that
 * flies from block to block.
 *
 *   opts: { theme, width, dim, maxZoom, pad, transition, endOverview, hint }
 */
function toPresentation(spec, options) {
  var s = normalizeSpec(spec);
  var opt = assign({}, DEFAULTS, s, options || {});
  var theme = getTheme(opt.theme);
  var svg = render(spec, assign({}, options, { embedFonts: false }));
  var title = s.title || opt.alt || 'visualthink';

  var css = PRESENT_CSS
    .replace(/%SHELL%/g, opt.shell || theme.bg)
    .replace(/%PAPER%/g, theme.bg)
    .replace(/%ACCENT%/g, opt.accent || theme.palette[ACCENT_ORDER[0]].s)
    .replace(/%GRIDBG%/g, shade(theme.bg, 0.07))
    .replace(/%MUTED%/g, theme.inkSoft)
    .replace(/%FONT%/g, theme.font.replace(/"/g, "'"))
    .replace(/%MS%/g, String(num(opt.transition, 760)));

  var cfg = {
    title: title,
    pad: num(opt.pad, 46),
    maxZoom: num(opt.maxZoom, 2.4),
    dim: opt.dim !== false,
    endOverview: opt.endOverview !== false
  };
  var help = ['← →   이동', 'O     전체 보기', 'F     전체화면', '0-9   바로가기'].join('\n');

  return '<!doctype html>\n<html lang="' + (opt.lang || 'ko') + '">\n<head>\n' +
    '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n' +
    (theme.fontImport ? '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="' + esc(theme.fontImport) + '">\n' : '') +
    '<style>\n' + css + '\n</style>\n</head>\n<body>\n' +
    '<div id="stage"><div id="canvas">' + svg + '</div></div>\n' +
    '<div id="grid"></div>\n' +
    (opt.hint === false ? '' : '<div id="hint">' + esc(title) + '</div>\n') +
    '<div id="help">' + esc(help) + '</div>\n' +
    '<div id="hud"><span id="label"></span><span id="bar"><i></i></span><span id="count"></span></div>\n' +
    '<script>window.__VT_PRESENT__=' + JSON.stringify(cfg) + ';</' + 'script>\n' +
    '<script>\n' + PRESENT_JS + '\n</' + 'script>\n' +
    '</body>\n</html>\n';
}


  return {
    version: VERSION,
    render: render,
    mount: mount,
    toHTML: toHTML,
    toPresentation: toPresentation,
    toDataURI: toDataURI,
    validate: validate,
    defineBlock: defineBlock,
    get blocks() { return Object.keys(BLOCKS).sort(); },
    get icons() { return Object.keys(ICONS).sort(); },
    get iconAliases() { return assign({}, ICON_ALIASES); },
    get themes() { return Object.keys(THEMES); },
    get densities() { return Object.keys(DENSITY); },
    get colors() { return ACCENT_ORDER.slice(); },
    defaults: DEFAULTS,
    // Exposed for tests and for custom block authors.
    _internal: {
      fit: fit, measure: measure, wrap: wrap, layoutCard: layoutCard,
      rRect: rRect, rEllipse: rEllipse, rArrow: rArrow, rLine: rLine,
      textLines: textLines, resolveColor: resolveColor, getTheme: getTheme,
      normItem: normItem, normItems: normItems, connect: connect,
      layoutBlockTitle: layoutBlockTitle, drawIcon: drawIcon, el: el, g: g
    }
  };
}));
