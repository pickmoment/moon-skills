#!/usr/bin/env node
/*!
 * selfcheck — 문서와 엔진이 어긋났는지 기계로 확인한다.
 *
 *   node <skill>/assets/selfcheck.js
 *
 * 스킬을 고친 뒤 한 번 돌린다. 여기서 잡는 것은 넷이다.
 *   1. 문서에 박아둔 숫자(장면 종수·픽토그램 종수·validate 검사 수)
 *   2. sv.js / shots.js 의 CLI 플래그가 api.md 에 빠졌는지
 *   3. 문서끼리 거는 앵커 링크(`scenes.md#...`)가 실제 헤딩을 가리키는지
 *   4. 문서에 실린 JSON 예제가 validate 를 통과하는지
 *
 * 숫자와 목록은 사람이 관리하면 반드시 어긋난다 — 실제로 세 번 어긋났다.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var BASE = path.join(__dirname, '..');
var SV = require(path.join(__dirname, 'scriptviz.js'));

var fail = 0;
function bad(msg) { console.log('  ✗ ' + msg); fail++; }
function head(t) { console.log('\n' + t); }
function read(rel) { return fs.readFileSync(path.join(BASE, rel), 'utf8'); }

var DOCS = ['SKILL.md', 'references/direction.md', 'references/scenes.md',
  'references/theming.md', 'references/api.md'];
var TEXT = {};
DOCS.forEach(function (f) { TEXT[f] = read(f); });
var ALL = DOCS.map(function (f) { return TEXT[f]; }).join('\n');

/* 1. 문서에 박힌 숫자 ------------------------------------------------- */
head('숫자');
var nScenes = SV.scenes.length, nIcons = SV.icons.length;
var vsrc = SV.validate.toString();
var nChecks = (vsrc.match(/(errors|warnings)\.push\(/g) || []).length +
  (SV._internal.lenWarn ? (SV._internal.lenWarn.toString().match(/warnings\.push\(/g) || []).length : 0);

[[/장면\s*(?:타입\s*)?(\d+)\s*종/g, nScenes, '장면 종수'],
 [/픽토그램\s*(\d+)\s*(?:종|개)/g, nIcons, '픽토그램 종수'],
 [/(\d+)\s*종\s*전체/g, nIcons, '픽토그램 종수(전체)']].forEach(function (r) {
  var re = r[0], want = r[1], what = r[2], m;
  while ((m = re.exec(ALL))) {
    if (+m[1] !== want) bad(what + ' 문서 ' + m[1] + ' vs 엔진 ' + want + ' — "' + m[0] + '"');
  }
});
var mc = /(\d+)\s*가지\s*넘게\s*기계로|(\d+)\s*가지를\s*기계로/.exec(ALL);
if (mc) {
  var claimed = +(mc[1] || mc[2]);
  if (claimed > nChecks) bad('validate 검사 수 문서 ' + claimed + ' > 실제 ' + nChecks);
  else if (nChecks - claimed > 15) bad('validate 검사 수 문서 ' + claimed + ' 이 실제 ' + nChecks + ' 보다 많이 낮다 — 올린다');
}
if (!fail) console.log('  ✓ 장면 ' + nScenes + '종 · 픽토그램 ' + nIcons + '종 · validate 검사 ' + nChecks + '개');

/* 2. CLI 플래그 ------------------------------------------------------- */
head('CLI 플래그');
var api = TEXT['references/api.md'];
[['sv.js', 'assets/sv.js'], ['shots.js', 'assets/shots.js']].forEach(function (p2) {
  var src = read(p2[1]);
  var header = src.split('*/')[0];
  var flags = {};
  (header.match(/--[a-z][a-z-]*/g) || []).forEach(function (f) { flags[f] = 1; });
  var missing = Object.keys(flags).filter(function (f) { return api.indexOf(f) < 0; });
  if (missing.length) bad(p2[0] + ' 의 ' + missing.join(' · ') + ' 가 api.md 에 없다');
  else console.log('  ✓ ' + p2[0] + ' 플래그 ' + Object.keys(flags).length + '개 모두 문서에 있다');
});

/* 3. 앵커 링크 -------------------------------------------------------- */
head('앵커 링크');
function slug(s) {
  return s.toLowerCase().replace(/[^A-Za-z0-9가-힣\s-]/g, '')
    .trim().replace(/\s/g, '-');
}
var heads = {};
DOCS.forEach(function (f) {
  heads[path.basename(f)] = TEXT[f].split('\n').filter(function (l) { return /^#{1,6}\s/.test(l); })
    .map(function (l) { return slug(l.replace(/^#+\s+/, '')); });
});
var anchors = 0;
DOCS.forEach(function (f) {
  TEXT[f].split('\n').forEach(function (l, i) {
    var re = /(?:references\/)?([a-z]+\.md)#([^\s)`]+)/g, m;
    while ((m = re.exec(l))) {
      anchors++;
      var target = heads[m[1]];
      if (!target) return bad(f + ':' + (i + 1) + ' 없는 파일 ' + m[1]);
      if (target.indexOf(m[2].toLowerCase()) < 0) {
        var near = target.filter(function (h) { return h.indexOf(m[2].toLowerCase().split('-')[0]) === 0; });
        bad(f + ':' + (i + 1) + ' 깨진 앵커 ' + m[1] + '#' + m[2] + (near.length ? '  → ' + near.join(' | ') : ''));
      }
    }
  });
});
/* SKILL.md 의 "`api.md` 의 절" 표는 파일명 없이 `#앵커` 만 적는다 */
TEXT['SKILL.md'].split('\n').forEach(function (l, i) {
  var m = /\|\s*`(#[^`]+)`\s*\|/.exec(l);
  if (!m) return;
  anchors++;
  if (heads['api.md'].indexOf(m[1].slice(1).toLowerCase()) < 0)
    bad('SKILL.md:' + (i + 1) + ' 깨진 절 앵커 api.md' + m[1]);
});
console.log('  ✓ 앵커 ' + anchors + '개 확인');

/* 4. 문서의 JSON 예제 ------------------------------------------------- */
head('문서 JSON 예제');
var blocks = 0;
DOCS.forEach(function (f) {
  var lines = TEXT[f].split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (!/^```(json|jsonc)?\s*$/.test(lines[i]) || !/^\s*[{[]/.test(lines[i + 1] || '')) continue;
    var j = i + 1;
    while (j < lines.length && !/^```/.test(lines[j])) j++;
    var body = lines.slice(i + 1, j).join('\n');
    i = j;
    if (/[…]|\/\*|\/\//.test(body)) continue;      /* 생략 기호가 든 설명용 스니펫 */
    blocks++;
    var o;
    try { o = JSON.parse(body); }
    catch (e) { bad(f + ':' + (i + 1) + ' JSON 파싱 실패 — ' + e.message); continue; }
    var scs = o.beats ? o.beats.map(function (b) { return b && b.scene; })
      : (o.type ? [o] : (o.scene ? [o.scene] : []));
    scs.forEach(function (sc) {
      if (sc && sc.type && SV.scenes.indexOf(sc.type) < 0) bad(f + ':' + (i + 1) + ' 모르는 scene.type "' + sc.type + '"');
    });
    if (o.beats) {
      var v = SV.validate(o);
      if (!v.ok) bad(f + ':' + (i + 1) + ' validate 실패 — ' + v.errors.join(' | '));
    }
    if (o.theme && SV.themes.indexOf(o.theme) < 0) bad(f + ':' + (i + 1) + ' 모르는 theme "' + o.theme + '"');
  }
});
console.log('  ✓ JSON 블록 ' + blocks + '개 검사');

/* 5. 예제 파일이 실제로 빌드되는가 ------------------------------------ */
head('예제 빌드');
fs.readdirSync(path.join(BASE, 'assets/examples')).filter(function (f) { return /\.json$/.test(f); })
  .forEach(function (f) {
    var spec = JSON.parse(read('assets/examples/' + f));
    var v = SV.validate(spec);
    if (!v.ok) return bad(f + ' validate 실패 — ' + v.errors.join(' | '));
    try { SV.toHTML(spec); } catch (e) { return bad(f + ' toHTML 실패 — ' + e.message); }
    console.log('  ✓ ' + f + ' (' + v.stats.beats + '비트 ' + v.stats.totalTc + (v.warnings.length ? ' · 경고 ' + v.warnings.length : '') + ')');
  });

console.log('\n' + (fail ? '✗ ' + fail + '건 어긋남' : '✓ 모두 맞다'));
process.exit(fail ? 1 : 0);
