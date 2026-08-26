#!/usr/bin/env node
/*!
 * shots — scriptviz 덱을 컷별 PNG 시퀀스나 WebM 영상으로 굽는다.
 * agent-browser CLI 가 설치돼 있어야 한다 (`npm i -g agent-browser`).
 *
 *   node shots.js <deck.html> [outdir] [옵션]
 *
 *   --beat            비트마다 한 장 (기본은 스텝마다 한 장)
 *   --wait <ms>       컷마다 애니메이션이 끝나기를 기다리는 시간 (기본 1500)
 *   --size <w> <h>    캡처 해상도 (기본 1920 1080, 9:16 이면 --size 1080 1920)
 *   --video           PNG 대신 자동 재생을 WebM 으로 녹화한다 (영상만 — 소리는 안 담긴다)
 *                     강조 이펙트(fx)는 이 모드에서만 담긴다. PNG 정지컷에는 안 나온다.
 *   --no-cc           화면 자막을 끄고 캡처한다 (편집기에서 자막을 따로 얹을 때)
 *   --session <name>  agent-browser 세션 이름
 */
'use strict';
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var argv = process.argv.slice(2);
var flags = {}, files = [];
for (var i = 0; i < argv.length; i++) {
  var a = argv[i];
  if (a === '--size') { flags.w = argv[++i]; flags.h = argv[++i]; }
  else if (a === '--wait') flags.wait = +argv[++i];
  else if (a === '--session') flags.session = argv[++i];
  else if (a.slice(0, 2) === '--') flags[a.slice(2)] = true;
  else files.push(a);
}
if (!files.length || flags.help) {
  process.stdout.write(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('/*!')[1] + '\n');
  process.exit(files.length ? 0 : 1);
}

var deck = path.resolve(files[0]);
var outdir = path.resolve(files[1] || (deck.replace(/\.html?$/i, '') + '-shots'));
var W = flags.w || 1920, H = flags.h || 1080;
var WAIT = flags.wait || 1500;
var SES = flags.session ? ['--session', flags.session] : [];

function ab(args) {
  var r = cp.spawnSync('agent-browser', args.concat(SES), { encoding: 'utf8' });
  if (r.error) { console.error('agent-browser 를 찾지 못했다: npm i -g agent-browser'); process.exit(1); }
  return r.stdout || '';
}
function evalJson(js) {
  var out = ab(['eval', '--json', js]);
  try {
    var env = JSON.parse(out.trim().split('\n').pop());
    if (!env.success) throw new Error(env.error || 'eval failed');
    return JSON.parse(env.data.result);
  } catch (e) { console.error('eval 실패: ' + e.message + '\n' + out); process.exit(1); }
}
function sleep(ms) { cp.spawnSync(process.execPath, ['-e', 'setTimeout(function(){},' + ms + ')']); }

ab(['set', 'viewport', String(W), String(H)]);
/* PNG 정지컷에는 이펙트를 넣지 않는다 — 반쯤 터진 파티클이 찍히면 그 컷은 못 쓴다.
   --video 녹화에서는 그대로 보인다. */
ab(['open', 'file://' + deck + '?clean=1&mute=1' +
  (flags.video ? '' : '&fx=0') + (flags['no-cc'] ? '&cc=0' : '')]);
sleep(900);
var info = evalJson('JSON.stringify({stops:window.SVAPI.stops,total:window.SVAPI.total,n:window.SVAPI.beats,audio:!!window.SVAPI.audio})');

if (flags.video) {
  var file = outdir.replace(/\/?$/, '') + '.webm';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  ab(['record', 'start', file]);
  evalJson('window.SVAPI.goto(0,0);JSON.stringify("start")');
  cp.spawnSync('agent-browser', ['eval', 'document.dispatchEvent(new KeyboardEvent("keydown",{key:"p"}))'].concat(SES));
  sleep(Math.ceil(info.total * 1000) + 1500);
  ab(['record', 'stop']);
  console.error('recorded ' + file + '  (' + Math.round(info.total) + 's)');
  if (info.audio) {
    /* 브라우저 녹화는 화면만 담는다. 음성은 나중에 붙인다. */
    console.error('음성은 이 파일에 안 담긴다 — 원본 mp3 를 얹는다:\n' +
      '  ffmpeg -i ' + file + ' -i <voice.mp3> -c:v copy -c:a aac -shortest ' +
      file.replace(/\.webm$/, '.mp4'));
  }
  process.exit(0);
}

fs.mkdirSync(outdir, { recursive: true });
var stops = flags.beat
  ? info.stops.filter(function (s, i, a) { return i === a.length - 1 || a[i + 1][0] !== s[0]; })
  : info.stops;

stops.forEach(function (s, i) {
  var label = evalJson('JSON.stringify(window.SVAPI.goto(' + s[0] + ',' + s[1] + '))');
  sleep(WAIT);
  var name = String(i + 1).padStart(3, '0') + '_' + label.replace(/[^\w.]/g, '') + '.png';
  ab(['screenshot', path.join(outdir, name)]);
  process.stderr.write('\r' + (i + 1) + '/' + stops.length + '  ' + name + '   ');
});
process.stderr.write('\n' + stops.length + ' PNG -> ' + outdir + '\n');
