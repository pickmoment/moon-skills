#!/usr/bin/env node
/*
 * thumbtitle 엔진 — 선언적 JSON 스펙으로 유튜브 썸네일(1280×720) HTML 을 만든다.
 * 사용법:
 *   node tt.js validate spec.json
 *   node tt.js build    spec.json [-o out.html]
 * 모듈: const { validate, toHTML } = require('./tt.js')
 */
'use strict';

const fs = require('fs');
const path = require('path');

const W = 1280, H = 720;
const MARGIN_X = 56, MARGIN_Y = 48;
const USABLE_W = W - MARGIN_X * 2;

// ---------------------------------------------------------------- 테마
const THEMES = {
  impact: { // 예능·이슈·리액션 — 초고대비, 검정+노랑
    bg: ['#141414', '#262626'], fill: '#ffffff', accent: '#ffd400', accent2: '#ff3b30',
    stroke: '#000000', strokeW: 14, box: '#111111', boxText: '#ffd400',
    shadow: '0 8px 32px rgba(0,0,0,.55)', scrim: '0,0,0',
  },
  clean: { // 정보·브이로그·튜토리얼 — 밝고 담백, 스트로크 없음
    bg: ['#f8fafc', '#e2e8f0'], fill: '#0f172a', accent: '#2563eb', accent2: '#e11d48',
    stroke: '#ffffff', strokeW: 0, box: '#0f172a', boxText: '#ffffff',
    shadow: '0 6px 24px rgba(15,23,42,.18)', scrim: '248,250,252',
  },
  docu: { // 다큐·역사·심층 — 시네마틱 네이비+골드
    bg: ['#0b1220', '#1e293b'], fill: '#f1f5f9', accent: '#e8c15a', accent2: '#94a3b8',
    stroke: '#0b1220', strokeW: 10, box: '#0b1220', boxText: '#e8c15a',
    shadow: '0 8px 32px rgba(0,0,0,.6)', scrim: '5,10,20',
  },
  finance: { // 경제·지표·투자 — 딥그린, 상승/하락 색
    bg: ['#04291a', '#0a3d2a'], fill: '#ffffff', accent: '#4ade80', accent2: '#f87171',
    stroke: '#02150d', strokeW: 12, box: '#02150d', boxText: '#4ade80',
    shadow: '0 8px 32px rgba(0,0,0,.55)', scrim: '2,21,13',
  },
  story: { // 엔터·스토리·미스터리 — 보라 그라디언트
    bg: ['#2e1065', '#701a75'], fill: '#ffffff', accent: '#f0abfc', accent2: '#fbbf24',
    stroke: '#1e0a3c', strokeW: 12, box: '#1e0a3c', boxText: '#f0abfc',
    shadow: '0 8px 32px rgba(0,0,0,.55)', scrim: '30,10,60',
  },
};

const ZONES = ['left-top','center-top','right-top','left-center','center-center','right-center','left-bottom','center-bottom','right-bottom'];
const HEADLINE_SIZES = { s: 64, m: 92, l: 122, xl: 156, xxl: 200 };
const SUB_SIZES      = { s: 34, m: 44, l: 56 };
const STICKER_SIZES  = { s: 64, m: 96, l: 140 };
const FLOW_TYPES = ['headline','sub','badge','sticker','cutout'];
const OVERLAY_TYPES = ['circle','arrow'];
const BG_TYPES = ['image','gradient','solid','split'];
const SCRIMS = ['left','right','bottom','full','none'];

// ---------------------------------------------------------------- 유틸
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const charLen = s => [...String(s).replace(/\s/g, '')].length;

function elId(el, i) { return el.id || `${el.type}${i}`; }

// ---------------------------------------------------------------- validate
function validate(spec, specDir) {
  const errors = [], warnings = [];
  const E = m => errors.push(m), Wn = m => warnings.push(m);

  if (!spec || typeof spec !== 'object') { E('스펙이 객체가 아니다'); return { errors, warnings }; }
  const theme = spec.theme || 'impact';
  if (!THEMES[theme]) E(`theme "${theme}" 없음 — ${Object.keys(THEMES).join('·')} 중 하나`);

  // 배경
  const bg = spec.background || { type: 'gradient' };
  if (!BG_TYPES.includes(bg.type)) E(`background.type "${bg.type}" 없음 — ${BG_TYPES.join('·')}`);
  if (bg.type === 'image') {
    if (!bg.src) E('background.type=image 인데 src 가 없다');
    else if (specDir && !fs.existsSync(path.resolve(specDir, bg.src)))
      E(`배경 이미지를 찾을 수 없다: ${path.resolve(specDir, bg.src)}`);
    if ((bg.scrim || 'auto') === 'none') Wn('이미지 배경에 scrim:none — 문구 대비가 죽을 수 있다. 캡처로 반드시 확인');
    if (!bg.prompt) Wn('background.prompt 가 없다 — 생성 프롬프트를 스펙에 기록해야 배경을 다시 뽑거나 변형할 수 있다');
  }
  if (bg.scrim && !SCRIMS.includes(bg.scrim) && bg.scrim !== 'auto') E(`background.scrim "${bg.scrim}" 없음 — ${SCRIMS.join('·')}`);

  // 요소
  const els = spec.elements || [];
  if (!els.length) E('elements 가 비었다');
  const ids = new Set();
  let flowCount = 0, hasHeadline = false;

  els.forEach((el, i) => {
    const tag = `elements[${i}](${el.type || '?'})`;
    if (!FLOW_TYPES.includes(el.type) && !OVERLAY_TYPES.includes(el.type))
      return E(`${tag}: type 없음 — ${[...FLOW_TYPES, ...OVERLAY_TYPES].join('·')}`);
    const id = elId(el, i);
    if (ids.has(id)) E(`${tag}: id "${id}" 중복`);
    ids.add(id);
    const at = el.at || 'left-center';
    if (!ZONES.includes(at)) E(`${tag}: at "${at}" 없음 — 9구역(${ZONES.slice(0,3).join('·')}…)`);
    if (FLOW_TYPES.includes(el.type)) flowCount++;

    if (el.type === 'headline') {
      hasHeadline = true;
      const lines = el.lines || (el.text ? [el.text] : null);
      if (!lines || !lines.length) E(`${tag}: lines 가 없다 — 줄바꿈은 자동이 아니다, 줄 단위로 쓴다`);
      else {
        const size = HEADLINE_SIZES[el.size || 'xl'];
        if (!size) E(`${tag}: size "${el.size}" 없음 — ${Object.keys(HEADLINE_SIZES).join('·')}`);
        if (lines.length > 3) Wn(`${tag}: ${lines.length}줄 — 3줄 넘으면 피드에서 안 읽힌다`);
        lines.forEach(ln => {
          const est = charLen(ln) * (size || 156) * 0.98;
          if (est > USABLE_W) Wn(`${tag}: "${ln}" ${charLen(ln)}자×${el.size || 'xl'} — 화면 폭(${USABLE_W}px)을 넘을 수 있다(추정 ${Math.round(est)}px). 줄을 쪼개거나 size 를 낮춘다`);
        });
        (el.highlight || []).forEach(h => {
          const w = typeof h === 'string' ? h : h.word;
          if (!lines.some(ln => ln.includes(w))) Wn(`${tag}: highlight "${w}" 가 lines 에 없다`);
        });
      }
      if (at === 'right-bottom') Wn(`${tag}: right-bottom — 유튜브 재생시간 배지가 덮는다. 다른 구역으로`);
    }
    if (el.type === 'sub') {
      if (!el.text) E(`${tag}: text 가 없다`);
      if (el.size && !SUB_SIZES[el.size]) E(`${tag}: size "${el.size}" 없음 — ${Object.keys(SUB_SIZES).join('·')}`);
      if (at === 'right-bottom') Wn(`${tag}: right-bottom — 재생시간 배지가 덮는다`);
    }
    if (el.type === 'badge' && !el.text) E(`${tag}: text 가 없다`);
    if (el.type === 'badge' && at === 'right-bottom') Wn(`${tag}: right-bottom — 재생시간 배지가 덮는다`);
    if (el.type === 'sticker' && !el.emoji) E(`${tag}: emoji 가 없다`);
    if (el.type === 'sticker' && el.size && !STICKER_SIZES[el.size]) E(`${tag}: size "${el.size}" 없음`);
    if (el.type === 'cutout') {
      if (!el.src) E(`${tag}: src 가 없다`);
      else if (specDir && !fs.existsSync(path.resolve(specDir, el.src)))
        E(`컷아웃 이미지를 찾을 수 없다: ${path.resolve(specDir, el.src)}`);
    }
    if (el.type === 'arrow' && el.dir && !['right','left','up','down','down-right','down-left','up-right','up-left'].includes(el.dir))
      E(`${tag}: dir "${el.dir}" 없음`);
  });

  if (!hasHeadline) Wn('headline 이 없다 — 문구 없는 썸네일이 맞는지 확인');
  if (flowCount > 4) Wn(`문구·배지·스티커가 ${flowCount}개 — 3요소 규칙. 작게 보면 아무것도 안 읽힌다`);

  // 변형
  (spec.variants || []).forEach((v, i) => {
    if (!v.name) Wn(`variants[${i}]: name 이 없다 — A/B 구분을 위해 붙인다`);
    Object.keys(v.patch || {}).forEach(id => {
      if (!ids.has(id)) E(`variants[${i}]: patch 대상 id "${id}" 가 elements 에 없다`);
    });
    if (!v.title) Wn(`variants[${i}]: title 이 없다 — 제목·썸네일은 세트로 검증한다`);
  });

  return { errors, warnings };
}

// ---------------------------------------------------------------- 렌더 조각
function inlineImage(src, specDir) {
  const p = path.resolve(specDir || '.', src);
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/png';
  return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
}

function bgCSS(bg, T, specDir) {
  const type = bg.type || 'gradient';
  if (type === 'solid') return `background:${bg.colors?.[0] || T.bg[0]};`;
  if (type === 'split') {
    const [a, b] = bg.colors && bg.colors.length >= 2 ? bg.colors : T.bg;
    return `background:linear-gradient(${bg.angle ?? 90}deg, ${a} 0 50%, ${b} 50% 100%);`;
  }
  if (type === 'image') {
    const url = inlineImage(bg.src, specDir);
    const pos = { left: 'left center', right: 'right center', center: 'center' }[bg.focus || 'center'] || 'center';
    return `background:url('${url}') ${pos}/cover no-repeat #111;`;
  }
  const cs = bg.colors && bg.colors.length >= 2 ? bg.colors : T.bg;
  return `background:linear-gradient(${bg.angle ?? 135}deg, ${cs[0]}, ${cs[1]});`;
}

function scrimCSS(bg, T) {
  let s = bg.scrim || 'auto';
  if (s === 'auto') {
    if ((bg.type || 'gradient') !== 'image') return '';
    s = { left: 'right', right: 'left', center: 'bottom' }[bg.focus || 'center'] || 'bottom';
  }
  if (s === 'none') return '';
  const c = T.scrim;
  const g = {
    left:   `linear-gradient(90deg, rgba(${c},.82) 0%, rgba(${c},.55) 34%, rgba(${c},0) 60%)`,
    right:  `linear-gradient(270deg, rgba(${c},.82) 0%, rgba(${c},.55) 34%, rgba(${c},0) 60%)`,
    bottom: `linear-gradient(0deg, rgba(${c},.85) 0%, rgba(${c},.5) 34%, rgba(${c},0) 58%)`,
    full:   `linear-gradient(rgba(${c},.5), rgba(${c},.5))`,
  }[s];
  return g ? `background:${g};` : '';
}

function zoneCSS() {
  const cols = { left: `left:${MARGIN_X}px;align-items:flex-start;text-align:left`, center: 'left:50%;align-items:center;text-align:center', right: `right:${MARGIN_X}px;align-items:flex-end;text-align:right` };
  const rows = { top: `top:${MARGIN_Y}px`, center: 'top:50%', bottom: `bottom:${MARGIN_Y}px` };
  return ZONES.map(z => {
    const [c, r] = z.split('-');
    const tx = c === 'center' ? '-50%' : '0', ty = r === 'center' ? '-50%' : '0';
    return `.z-${z}{${cols[c]};${rows[r]};transform:translate(${tx},${ty})}`;
  }).join('\n');
}

function highlightHTML(line, highlights, T) {
  let html = esc(line);
  (highlights || []).forEach(h => {
    const word = typeof h === 'string' ? h : h.word;
    const color = (typeof h === 'object' && h.color) || T.accent;
    const ew = esc(word);
    if (html.includes(ew)) html = html.replace(ew, `<span class="hl" style="color:${color}">${ew}</span>`);
  });
  return html;
}

function renderElement(el, i, T, specDir) {
  const at = el.at || 'left-center';
  const rot = el.rotate ? `--rot:${el.rotate}deg;` : '';
  const off = `${el.dx ? `--dx:${el.dx}px;` : ''}${el.dy ? `--dy:${el.dy}px;` : ''}`;
  const style = s => ` style="${rot}${off}${s || ''}"`;

  if (el.type === 'headline') {
    const lines = el.lines || [el.text];
    const size = HEADLINE_SIZES[el.size || 'xl'];
    const fill = el.fill || T.fill;
    const strokeOn = el.stroke !== false && T.strokeW > 0;
    const boxOn = el.box === 'solid' || el.box === 'tag' || el.box === true;
    const lns = lines.map(ln => {
      const fillHTML = highlightHTML(ln, el.highlight, T);
      const strokeHTML = strokeOn && !boxOn ? `<span class="stk" aria-hidden="true">${esc(ln)}</span>` : '';
      return `<div class="ln${boxOn ? (el.box === 'tag' ? ' box tag' : ' box') : ''}">${strokeHTML}<span class="fil">${fillHTML}</span></div>`;
    }).join('');
    return `<div class="el hd"${style(`--fs:${size}px;--fill:${fill};`)}>${lns}</div>`;
  }
  if (el.type === 'sub') {
    const size = SUB_SIZES[el.size || 'm'];
    const boxOn = el.box === 'solid' || el.box === true;
    return `<div class="el sb${boxOn ? ' box' : ''}"${style(`--fs:${size}px;${el.fill ? `--fill:${el.fill};` : ''}`)}>${highlightHTML(el.text, el.highlight, T)}</div>`;
  }
  if (el.type === 'badge') {
    const st = el.style === 'corner' ? 'bd-corner' : 'bd-pill';
    return `<div class="el bd ${st}"${style(el.fill ? `--bg:${el.fill};` : '')}>${esc(el.text)}</div>`;
  }
  if (el.type === 'sticker') {
    return `<div class="el st"${style(`--fs:${STICKER_SIZES[el.size || 'm']}px;`)}>${esc(el.emoji)}</div>`;
  }
  if (el.type === 'cutout') {
    const url = inlineImage(el.src, specDir);
    return `<img class="el co"${style(`width:${el.width || 420}px;`)} src="${url}" alt="">`;
  }
  if (el.type === 'circle') {
    const w = el.w || 300, h = el.h || 200, sw = el.strokeWidth || 12;
    return `<svg class="ov" data-at="${at}"${style(`width:${w}px;height:${h}px;`)} viewBox="0 0 ${w} ${h}"><ellipse cx="${w/2}" cy="${h/2}" rx="${w/2 - sw}" ry="${h/2 - sw}" fill="none" stroke="${el.color || T.accent2}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${el.dash ? '24 14' : 'none'}"/></svg>`;
  }
  if (el.type === 'arrow') {
    const len = el.len || 220, sw = el.strokeWidth || 16, c = el.color || T.accent;
    const pad = sw * 2.2;
    const bw = len + pad * 2, bh = len * 0.5 + pad * 2;
    // 살짝 휜 손그림 곡선 + 화살촉
    const x1 = pad, y1 = bh / 2 + len * 0.12, x2 = pad + len, y2 = bh / 2 - len * 0.12;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - len * 0.16;
    const ang = Math.atan2(y2 - my, x2 - mx);
    const hd = sw * 2.4;
    const hx1 = x2 - hd * Math.cos(ang - 0.5), hy1 = y2 - hd * Math.sin(ang - 0.5);
    const hx2 = x2 - hd * Math.cos(ang + 0.5), hy2 = y2 - hd * Math.sin(ang + 0.5);
    const rotMap = { right: 0, 'down-right': 45, down: 90, 'down-left': 135, left: 180, 'up-left': 225, up: 270, 'up-right': 315 };
    const dirRot = rotMap[el.dir || 'right'];
    return `<svg class="ov" data-at="${at}" style="${off}width:${bw}px;height:${bh}px;--rot:${(el.rotate || 0) + dirRot}deg" viewBox="0 0 ${bw} ${bh}"><path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/><path d="M${hx1} ${hy1} L${x2} ${y2} L${hx2} ${hy2}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return '';
}

// ---------------------------------------------------------------- 변형 적용
function applyPatch(spec, variant) {
  const els = spec.elements.map((el, i) => {
    const patch = (variant.patch || {})[elId(el, i)];
    return patch ? { ...el, ...patch } : el;
  });
  return { ...spec, elements: els, background: variant.background ? { ...spec.background, ...variant.background } : spec.background };
}

// ---------------------------------------------------------------- toHTML
function toHTML(spec, specDir) {
  const T = THEMES[spec.theme || 'impact'];
  const variants = (spec.variants && spec.variants.length)
    ? spec.variants
    : [{ name: 'A', title: spec.meta?.title || '', patch: {} }];

  const stages = variants.map((v, vi) => {
    const s = applyPatch(spec, v);
    const bg = s.background || { type: 'gradient' };
    const flow = {};
    const overlays = [];
    s.elements.forEach((el, i) => {
      const html = renderElement(el, i, T, specDir);
      if (OVERLAY_TYPES.includes(el.type)) overlays.push(html);
      else (flow[el.at || 'left-center'] ||= []).push(html);
    });
    const zonesHTML = Object.entries(flow).map(([z, arr]) => `<div class="zone z-${z}">${arr.join('')}</div>`).join('');
    return `<section class="stage" id="v${vi + 1}" data-name="${esc(v.name || `V${vi + 1}`)}" data-title="${esc(v.title || '')}" data-prompt="${esc(bg.prompt || '')}" style="${bgCSS(bg, T, specDir)}"><div class="scrim" style="${scrimCSS(bg, T)}"></div>${zonesHTML}${overlays.join('')}</section>`;
  }).join('\n');

  const meta = spec.meta || {};
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(meta.topic || 'thumbtitle')}</title>
<style>
:root{--accent:${T.accent};--accent2:${T.accent2};--strokeC:${T.stroke};--strokeW:${T.strokeW}px;--box:${T.box};--boxText:${T.boxText}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#2b2b2b}
body{font-family:"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;-webkit-font-smoothing:antialiased}
.stage{position:absolute;top:0;left:0;width:${W}px;height:${H}px;overflow:hidden;display:none}
.stage.on{display:block}
.scrim{position:absolute;inset:0}
.zone{position:absolute;display:flex;flex-direction:column;gap:18px;max-width:${W - MARGIN_X * 2}px}
${zoneCSS()}
.el{transform:rotate(var(--rot,0deg)) translate(var(--dx,0),var(--dy,0));filter:drop-shadow(${T.shadow})}
.hd{font-size:var(--fs);font-weight:900;line-height:1.08;letter-spacing:-.025em;color:var(--fill)}
.hd .ln{position:relative;display:block}
.hd .stk{position:absolute;inset:0;-webkit-text-stroke:var(--strokeW) var(--strokeC);color:transparent;z-index:0}
.hd .fil{position:relative;z-index:1}
.hd .ln.box{display:inline-block;background:var(--box);color:var(--boxText);padding:.02em .16em .06em;margin-bottom:.06em}
.hd .ln.box.tag{transform:skew(-6deg)}
.hd .ln.box .fil .hl{filter:brightness(1.15)}
.sb{font-size:var(--fs);font-weight:800;letter-spacing:-.01em;color:var(--fill,${T.fill});opacity:.96}
.sb.box{background:var(--box);color:var(--boxText);padding:.14em .5em;border-radius:.3em}
.bd{font-weight:800;font-size:40px;letter-spacing:0}
.bd-pill{background:var(--bg,var(--accent));color:#111;padding:8px 26px;border-radius:999px}
.bd-corner{background:var(--bg,var(--accent2));color:#fff;padding:10px 28px;clip-path:polygon(0 0,100% 0,92% 100%,0 100%)}
.st{font-size:var(--fs);line-height:1}
.co{display:block}
.ov{position:absolute;transform:translate(-50%,-50%) rotate(var(--rot,0deg)) translate(var(--dx,0),var(--dy,0));filter:drop-shadow(0 6px 18px rgba(0,0,0,.4))}
${ZONES.map(z => { const [c, r] = z.split('-'); const xs = { left: `${MARGIN_X + 180}px`, center: '50%', right: `${W - MARGIN_X - 180}px` }; const ys = { top: `${MARGIN_Y + 120}px`, center: '50%', bottom: `${H - MARGIN_Y - 120}px` }; return `.ov[data-at="${z}"]{left:${xs[c]};top:${ys[r]}}`; }).join('\n')}
/* 콘택트 시트 */
.sheet{display:none;padding:28px;color:#eee;font-size:15px}
body.sheet-mode .sheet{display:block}
body.sheet-mode .stage{display:none!important}
.sheet h1{font-size:20px;margin-bottom:20px;font-weight:800}
.sheet .row{display:flex;gap:24px;align-items:flex-start;margin-bottom:30px;flex-wrap:wrap}
.sheet .thumb{position:relative;overflow:hidden;border-radius:10px;background:#000;flex:none}
.sheet .thumb .stage{display:block!important;transform-origin:0 0}
.sheet .t320{width:320px;height:180px}.sheet .t320 .stage{transform:scale(.25)}
.sheet .t168{width:168px;height:94px}.sheet .t168 .stage{transform:scale(.13125)}
.sheet .cap{max-width:420px;line-height:1.6}
.sheet .cap b{font-size:17px}
.sheet .pr{margin-top:8px;font-size:12px;color:#9a9a9a;line-height:1.55;white-space:pre-wrap;border-left:2px solid #555;padding-left:8px}
.sheet .dur{position:absolute;right:5px;bottom:5px;background:rgba(0,0,0,.85);color:#fff;font-size:11px;font-weight:700;padding:2px 5px;border-radius:3px}
@media print{body{background:#fff}}
</style>
</head>
<body>
${stages}
<div class="sheet"><h1>${esc(meta.topic || '')} — 제목·썸네일 세트 (320×180 피드 / 168×94 사이드바)</h1><div id="rows"></div></div>
<script>
(function(){
  var stages=[].slice.call(document.querySelectorAll('.stage'));
  var qs=new URLSearchParams(location.search);
  window.TT={
    count:stages.length,
    show:function(n){stages.forEach(function(s,i){s.classList.toggle('on',i===n-1)});document.body.classList.remove('sheet-mode');return stages[n-1]&&stages[n-1].dataset.name},
    sheet:function(){
      document.body.classList.add('sheet-mode');
      var rows=document.getElementById('rows');rows.innerHTML='';
      stages.forEach(function(s){
        var row=document.createElement('div');row.className='row';
        ['t320','t168'].forEach(function(cls){
          var box=document.createElement('div');box.className='thumb '+cls;
          var c=s.cloneNode(true);c.removeAttribute('id');c.classList.add('on');box.appendChild(c);
          var d=document.createElement('span');d.className='dur';d.textContent='12:34';box.appendChild(d);
          row.appendChild(box);
        });
        var cap=document.createElement('div');cap.className='cap';
        cap.innerHTML='<b>'+s.dataset.name+'</b><br>'+(s.dataset.title||'(title 없음)');
        if(s.dataset.prompt){var pr=document.createElement('div');pr.className='pr';pr.textContent=s.dataset.prompt;cap.appendChild(pr);}
        row.appendChild(cap);
        rows.appendChild(row);
      });
    }
  };
  if(qs.get('sheet'))TT.sheet();else TT.show(parseInt(qs.get('v')||'1',10)||1);
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------- CLI
function main() {
  const [cmd, specPath, ...rest] = process.argv.slice(2);
  if (!cmd || !['validate', 'build', 'prompt'].includes(cmd) || !specPath) {
    console.log('사용법:\n  node tt.js validate spec.json\n  node tt.js build    spec.json [-o out.html]\n  node tt.js prompt   spec.json          # 스펙에 기록된 생성 프롬프트 출력');
    process.exit(cmd ? 1 : 0);
  }
  const specDir = path.dirname(path.resolve(specPath));
  let spec;
  try { spec = JSON.parse(fs.readFileSync(specPath, 'utf8')); }
  catch (e) { console.error(`✗ JSON 파싱 실패: ${e.message}`); process.exit(1); }

  if (cmd === 'prompt') { // 이미지가 아직 없어도(validate 실패 전) 프롬프트는 꺼낼 수 있어야 한다
    const out = [];
    const base = spec.background || {};
    if (base.prompt) out.push(['배경', base.prompt]);
    (spec.elements || []).forEach((el, i) => { if (el.prompt) out.push([`${el.type} "${elId(el, i)}"`, el.prompt]); });
    (spec.variants || []).forEach(v => {
      if (v.background?.prompt && v.background.prompt !== base.prompt) out.push([`배경 — 변형 ${v.name || '?'}`, v.background.prompt]);
      Object.entries(v.patch || {}).forEach(([id, p]) => { if (p.prompt) out.push([`"${id}" — 변형 ${v.name || '?'}`, p.prompt]); });
    });
    if (!out.length) console.log('스펙에 기록된 프롬프트가 없다 — background.prompt / cutout 의 prompt 에 기록한다');
    else out.forEach(([k, p]) => console.log(`── ${k}\n${p}\n`));
    return;
  }

  const { errors, warnings } = validate(spec, specDir);
  warnings.forEach(w => console.log(`⚠ ${w}`));
  errors.forEach(e => console.log(`✗ ${e}`));
  if (errors.length) { console.log(`\n${errors.length}개 에러 — 고치고 다시`); process.exit(1); }

  if (cmd === 'validate') {
    console.log(`✓ OK (경고 ${warnings.length}개) — 변형 ${(spec.variants || [1]).length}개`);
    return;
  }
  const oi = rest.indexOf('-o');
  const out = oi >= 0 ? rest[oi + 1] : specPath.replace(/\.json$/, '') + '.html';
  fs.writeFileSync(out, toHTML(spec, specDir));
  const n = (spec.variants && spec.variants.length) || 1;
  console.log(`✓ ${out} (변형 ${n}개 — ?v=1..${n}, ?sheet=1)`);
}

if (require.main === module) main();
module.exports = { validate, toHTML, THEMES, ZONES };
