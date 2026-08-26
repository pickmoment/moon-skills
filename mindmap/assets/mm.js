#!/usr/bin/env node
/*!
 * mm — command line front end for mindmap.js
 *
 *   node mm.js <in.json|in.md> <out.html> [options]
 *
 *   --interactive        fold/zoom/search viewer (default is a static page)
 *   --present            presentation mode — the camera flies branch to branch
 *   --stops node         presentation stops on depth-2 nodes too (default: branches)
 *   --svg                write a bare .svg instead of an HTML page
 *   --theme <name>       sketch | flat | editorial | bold
 *   --layout <name>      map | right | down
 *   --density <name>     brief | standard | detailed   (validation budget)
 *   --backdrop <name>    none | gradient | blob | vignette | glow
 *   --json               print the parsed spec to stdout and exit
 *   --quiet              do not print warnings
 */
'use strict';
var fs = require('fs');
var path = require('path');
var MM = require(path.join(__dirname, 'mindmap.js'));

var argv = process.argv.slice(2);
var flags = {}, files = [];
for (var i = 0; i < argv.length; i++) {
  var a = argv[i];
  if (a.slice(0, 2) === '--') {
    var key = a.slice(2);
    var takesValue = ['theme', 'layout', 'density', 'scale', 'padding', 'paper', 'seed', 'backdrop', 'stops'].indexOf(key) >= 0;
    flags[key] = takesValue ? argv[++i] : true;
  } else files.push(a);
}

if (!files.length || flags.help) {
  process.stdout.write(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('/*!')[1] + '\n');
  process.exit(files.length ? 0 : 1);
}

var input = files[0];
var raw = fs.readFileSync(input, 'utf8');
var spec = /\.(md|markdown|txt)$/i.test(input) ? MM.fromMarkdown(raw) : JSON.parse(raw);

['theme', 'layout', 'density', 'paper', 'seed', 'backdrop'].forEach(function (k) { if (flags[k]) spec[k] = flags[k]; });
MM.inlineImages(spec, path.dirname(path.resolve(input)));
if (flags.scale) spec.scale = parseFloat(flags.scale);
if (flags.padding) spec.padding = parseFloat(flags.padding);

if (flags.json) { process.stdout.write(JSON.stringify(spec, null, 2) + '\n'); process.exit(0); }

if (flags.interactive) spec.__interactive = true;
var check = MM.validate(spec);
if (!check.ok) {
  process.stderr.write('mindmap: spec is invalid\n  - ' + check.errors.join('\n  - ') + '\n');
  process.exit(1);
}
if (!flags.quiet && check.warnings.length) {
  process.stderr.write('mindmap warnings:\n  - ' + check.warnings.join('\n  - ') + '\n');
}
delete spec.__interactive;

var out = files[1] || input.replace(/\.[^.]+$/, '') + (flags.svg ? '.svg' : '.html');
var body = flags.svg ? MM.render(spec)
  : flags.present ? MM.toPresentation(spec, { stops: flags.stops })
  : flags.interactive ? MM.toInteractive(spec)
  : MM.toHTML(spec);
fs.writeFileSync(out, body);
var kind = flags.svg ? 'SVG' : flags.present ? '발표 모드 (← → 이동 · O 전체 보기 · F 전체화면)'
  : flags.interactive ? '인터랙티브 (클릭=접기/펼치기 · 드래그=이동 · / 검색)'
  : '정적 한 장 — 클릭으로 접거나 펼치려면 --interactive, 발표는 --present';
process.stderr.write('wrote ' + out + '  (' + check.stats.nodes + ' nodes, depth ' +
  check.stats.depth + ', ' + check.stats.branches + ' branches)\n' + kind +
  (spec.__inlined ? '\ninlined ' + spec.__inlined + ' image(s) as data URI' : '') + '\n');
