#!/usr/bin/env node
/*!
 * sv — scriptviz 명령줄 빌더
 *
 *   node sv.js <in.json|in.md|in.srt> [out.html] [옵션]
 *
 *   --theme <name>     midnight | paper | neon | warm
 *   --aspect <ratio>   16:9 | 9:16
 *   --autoplay         열자마자 자동 재생
 *   --clean            UI를 숨긴 채로 시작 (녹화용)
 *   --present          발표용으로 뽑는다 — HUD·프롬프터·도움말·자막을 아예 넣지 않고
 *                      무대만 남긴다. Space 다음 · ↓↑ 슬라이드 단위 · O 오버뷰 · F 전체화면
 *   --no-prompter      프롬프터 패널 없이
 *   --chroma <color>   크로마키 색 (기본 #00B140)
 *   --bg <name>        배경 레이어 (plain·grid·dots·blob·mesh·rays·scan·noise)
 *   --frame corners    네 모서리 브래킷
 *   --progress         화면 아래 진행 바
 *   --cps <n>          낭독 속도(초당 글자, 기본 5.0)
 *   --motion <name>    모션 톤 — apple(기본, 길게 눌리는 감속) · plain(예전, 빠르고 담백)
 *   --art-direction <name>  아트디렉션 팩 6종 중 하나
 *   --direct           대본 전체에 구도·감정 곡선·모티프를 자동 배정
 *   --style-frames     오프닝·대표 데이터·결론의 3방향 미리보기도 생성
 *   --subs <file>      자막(SRT·VTT)으로 타이밍을 실측으로 갈아끼운다
 *                      입력이 .srt/.vtt 면 그 자체로 초안을 만든다
 *                      자막을 넣으면 화면 자막이 기본으로 켜진다 (재생 중 S 로 토글)
 *   --no-captions      화면 자막을 끈 채로 시작 (자막은 타이밍에만 쓴다)
 *   --cc-size <px>     자막 글자 크기 (기본 16:9 38 · 9:16 46)
 *   --cc-color <css>   자막 글자 색 (기본 #ffffff)
 *   --cc-bg <css>      자막 배경 색 (기본 #080a10)
 *   --cc-opacity <0-1> 자막 배경 투명도 (기본 0.72 · 0 이면 배경 없음)
 *   --audio <file>     음성(mp3 등)을 덱에 심는다. 재생하면 소리가 시계를 잡는다
 *   --audio-offset <s> 음성 안에서 첫 비트가 시작하는 시각(초). 앞에 여백이 있을 때
 *   --no-inline-audio  음성을 파일 안에 넣지 않고 경로로 참조한다 (HTML 옆에 둬야 한다)
 *   --volume <0-1>     음성 볼륨
 *   --json             대본에서 만든 초안 스펙을 stdout 으로 출력하고 끝낸다
 *   --no-timing        타이밍 시트(.timing.csv)를 쓰지 않는다
 *   --quiet            경고 숨김
 *
 *   node sv.js icons  [검색어]   픽토그램 191종 찾기 (한글 이름 지원)
 *   node sv.js images <폴더>    쓸 이미지를 훑는다 — 크기·비율·놓을 자리
 */
'use strict';
var fs = require('fs');
var path = require('path');
var SV = require(path.join(__dirname, 'scriptviz.js'));

var argv = process.argv.slice(2);
var flags = {}, files = [];
var VALUED = ['theme', 'art-direction', 'aspect', 'chroma', 'cps', 'bg', 'frame', 'subs', 'title',
  'audio', 'audio-offset', 'volume', 'motion', 'cc-size', 'cc-color', 'cc-bg', 'cc-opacity'];
for (var i = 0; i < argv.length; i++) {
  var a = argv[i];
  if (a.slice(0, 2) === '--') {
    var key = a.slice(2);
    flags[key] = VALUED.indexOf(key) >= 0 ? argv[++i] : true;
  } else files.push(a);
}
if (!files.length || flags.help) {
  process.stdout.write(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('/*!')[1] + '\n');
  process.exit(files.length ? 0 : 1);
}

if (argv[0] === 'images') {
  var dir = argv[1] || '.';
  var rows;
  try { rows = SV.scanImages(dir); }
  catch (e) { console.error('폴더를 읽지 못했다: ' + dir); process.exit(1); }
  if (!rows.length) { console.error(dir + ' 안에 이미지가 없다'); process.exit(1); }
  var tot = 0;
  console.log('  ' + '파일'.padEnd(30) + '크기'.padStart(8) + '  ' + '픽셀'.padEnd(12) + '비율  놓을 자리');
  rows.forEach(function (r) {
    tot += r.kb;
    console.log('  ' + r.file.padEnd(30) +
      (r.kb + 'KB').padStart(8) + '  ' +
      (r.w ? (r.w + '×' + r.h) : '?').padEnd(12) +
      (r.ratio != null ? String(r.ratio) : '?').padEnd(6) + r.where +
      (r.warn.length ? '   ! ' + r.warn.join(' · ') : ''));
  });
  console.error('\n  ' + rows.length + '장 · 합계 ' + (tot > 1024 ? (tot / 1024).toFixed(1) + 'MB' : tot + 'KB') +
    ' (base64 로 박히면 약 ' + (tot * 4 / 3 > 1024 ? (tot * 4 / 3 / 1024).toFixed(1) + 'MB' : Math.round(tot * 4 / 3) + 'KB') + ')');
  console.error('  놓을 자리는 비율만 보고 정한 것이다 — **무엇이 찍혔는지는 직접 열어 보고** 비트에 배정한다.');
  process.exit(0);
}

if (argv[0] === 'icons') {
  var q = argv[1];
  var hits = SV.findIcons(q), al = SV.iconAliases();
  if (!hits.length) { console.error('"' + q + '" 에 맞는 픽토그램이 없다'); process.exit(1); }
  hits.forEach(function (k) {
    var ko = (al[k] || []).filter(function (x) { return /[가-힣]/.test(x); });
    console.log(('  ' + k + '                ').slice(0, 18) + ko.join(' · '));
  });
  console.error('  ' + hits.length + '개' + (q ? ' ("' + q + '")' : ' / 전체 ' + SV.icons.length));
  process.exit(0);
}

var input = files[0];
var raw = fs.readFileSync(input, 'utf8');
var spec;
if (/\.(json)$/i.test(input)) spec = JSON.parse(raw);
else if (/\.(srt|vtt)$/i.test(input)) spec = SV.fromSubtitles(raw, { title: flags.title });
else spec = SV.fromScript(raw);
if (flags['art-direction']) spec.artDirection = flags['art-direction'];
if (flags.direct) {
  var directed = SV.direct(spec, { artDirection: flags['art-direction'] });
  spec = directed.spec;
  if (!flags.quiet) process.stderr.write('디자인 디렉터: ' + directed.report.artDirection +
    ' · 구도 ' + directed.report.compositions.length + '장 · 감정 곡선 적용\n');
}
/* 음성을 붙인다. 경로는 그대로 두고 inlineAssets 가 data URI 로 바꾼다. */
if (flags.audio) {
  spec.audio = Object.assign({}, typeof spec.audio === 'string' ? { src: spec.audio } : spec.audio, {
    src: path.relative(path.dirname(path.resolve(input)), path.resolve(flags.audio)) || flags.audio
  });
}
if (spec.audio) {
  if (typeof spec.audio === 'string') spec.audio = { src: spec.audio };
  if (flags['audio-offset']) spec.audio.offset = parseFloat(flags['audio-offset']);
  if (flags.volume) spec.audio.volume = parseFloat(flags.volume);
  if (flags['no-inline-audio']) spec.audio.inline = false;
}

/* --json 은 "초안을 받아 손보는" 용도다. 여기서 이미지를 data URI 로 박으면
   사람이 못 읽는 덩어리가 되어 손볼 수가 없다 — 경로 그대로 내보낸다. */
if (!flags.json) SV.inlineAssets(spec, path.dirname(path.resolve(input)));

/* 자막이 있으면 추정 타이밍을 실측으로 바꾼다. 대본으로 화면을 짜고 녹음이
 * 끝난 뒤 이 단계를 태우는 것이 제 순서다. */
if (flags.subs) {
  var applied = SV.applySubtitles(spec, fs.readFileSync(flags.subs, 'utf8'));
  spec = applied.spec;
  var rp = applied.report;
  if (!flags.quiet) {
    process.stderr.write('자막 적용: ' + rp.applied.length + '비트 실측 · ' +
      rp.skipped.length + '비트 건너뜀  (cue ' + rp.cueCount + '개, ' +
      rp.duration.toFixed(1) + '초)\n');
    rp.skipped.forEach(function (s2) {
      process.stderr.write('  건너뜀 ' + s2.beat + ': ' + s2.why + '\n');
    });
  }
}

if (flags.theme) spec.theme = flags.theme;
if (flags.aspect) spec.aspect = flags.aspect;
if (flags.cps) spec.cps = parseFloat(flags.cps);
if (flags.bg) spec.bg = flags.bg;
if (flags.frame) spec.frame = flags.frame;
if (flags.progress) spec.progress = true;

if (flags.json) { process.stdout.write(JSON.stringify(spec, null, 2) + '\n'); process.exit(0); }

var check = SV.validate(spec);
if (!check.ok) {
  process.stderr.write('scriptviz: 스펙이 잘못됐다\n  - ' + check.errors.join('\n  - ') + '\n');
  process.exit(1);
}
if (!flags.quiet && check.warnings.length) {
  process.stderr.write('scriptviz 경고:\n  - ' + check.warnings.join('\n  - ') + '\n');
}

var out = files[1] || input.replace(/\.[^.]+$/, '') + '.html';
fs.writeFileSync(out, SV.toHTML(spec, {
  autoplay: !!flags.autoplay,
  clean: !!flags.clean,
  prompter: flags['no-prompter'] ? false : true,
  chroma: flags.chroma,
  present: !!flags.present,
  motion: flags.motion || null,
  captions: flags['no-captions'] ? false : true,
  ccSize: flags['cc-size'] ? +flags['cc-size'] : null,
  ccColor: flags['cc-color'] || null,
  ccBg: flags['cc-bg'] || null,
  ccOpacity: flags['cc-opacity'] != null ? +flags['cc-opacity'] : null
}));
if (flags['style-frames']) {
  var sf = out.replace(/\.html?$/i, '') + '.styles.html';
  fs.writeFileSync(sf, SV.toStyleFramesHTML(spec));
}
var msg = 'wrote ' + out + '  (' + check.stats.beats + ' beats, ' + check.stats.steps +
  ' steps, ' + check.stats.totalTc + ')';
if (flags['style-frames']) msg += '\nwrote ' + out.replace(/\.html?$/i, '') + '.styles.html (아트디렉션 3방향)';
if (flags.present) {
  msg += '\n발표용 — HUD·프롬프터·자막 없이 무대만 나간다' +
    '\n  Space·→ 다음 · ↓↑ 슬라이드 단위 · O 오버뷰 · F 전체화면';
  if (Array.isArray(spec.captions) && spec.captions.length) {
    msg += '\n  자막 ' + spec.captions.length + '장은 타이밍에만 쓰였다 (발표용에는 안 실린다)';
  }
} else if (Array.isArray(spec.captions) && spec.captions.length) {
  msg += '\n화면 자막 ' + spec.captions.length + '장 ' +
    (flags['no-captions'] ? '꺼짐 — 재생 중 S 로 켠다' : '켜짐 — 재생 중 S 로 끈다, 캡처는 ?cc=0');
}
if (!flags['no-timing']) {
  var csv = out.replace(/\.html?$/i, '') + '.timing.csv';
  fs.writeFileSync(csv, SV.toTimingCSV(spec));
  msg += '\nwrote ' + csv;
}
if (spec.__inlined) msg += '\ninlined ' + spec.__inlined + ' image(s) as data URI';
if (spec.__imgMissing) {
  msg += '\n! 이미지를 찾지 못했다 (화면에 안 나온다): ' + spec.__imgMissing.join(', ') +
    '\n  경로는 스펙 파일이 있는 폴더 기준이다';
}
if (spec.__imgRemote) {
  msg += '\n! 인터넷 주소 이미지: ' + spec.__imgRemote.join(', ') +
    '\n  파일 안에 안 들어간다 — 오프라인·녹화에서 빈칸이 된다. 내려받아 로컬 경로로 넣는다';
}
if (spec.__imgHeavy) {
  msg += '\n! 큰 이미지: ' + spec.__imgHeavy.join(', ') +
    '\n  base64 는 원본의 4/3 로 불어난다. 화면은 1920 폭이면 충분하니 줄여서 넣는다';
}
if (spec.__audioMissing) msg += '\n음성 파일을 찾지 못했다: ' + spec.__audioMissing;
else if (spec.__audioBytes) {
  var mb = spec.__audioBytes / 1048576;
  msg += '\n음성 ' + mb.toFixed(1) + 'MB 를 HTML 안에 넣었다 (--no-inline-audio 면 경로 참조)';
  /* 큰 data URI 는 폰 사파리에서 시킹·duration 이 어긋나는 일이 있다. */
  if (mb > 8) msg += '\n※ 폰으로 열 거면 --no-inline-audio 를 권한다 — iOS 는 큰 data URI 음성의 시각을 못 읽는 일이 있다';
}
else if (spec.audio) msg += '\n음성은 경로 참조다 — ' + spec.audio.src + ' 를 HTML 옆에 둔다';
process.stderr.write(msg + '\n');
