#!/usr/bin/env node
/* explainer 산출물 검증기.  사용법: node <스킬경로>/references/check.js <생성한.html>
   확인 항목: 제어문자 오염 · JS 문법 · 데이터 계약 · 필수 마크업 · mermaid CDN 정합성 */
const fs = require('fs');
const f = process.argv[2];
if (!f) { console.error('사용법: node check.js <파일.html>'); process.exit(2); }
const s = fs.readFileSync(f, 'utf8');
const err = [], warn = [], ok = [];

/* 0. 제어문자 */
const ctl = s.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
if (ctl) err.push('제어문자 ' + ctl.length + '개 오염 — 파일을 다시 생성한다');
else ok.push('제어문자 없음');

/* 1. script 블록 문법 */
const m = s.match(/<script>([\s\S]*?)<\/script>/);
if (!m) err.push('<script> 블록을 찾을 수 없다');
else {
  try { new Function(m[1]); ok.push('JS 문법 OK'); }
  catch (e) { err.push('JS 문법 오류: ' + e.message); }
}

/* 2. 데이터 계약 */
let CONFIG, SECTIONS, VIZ;
if (m) {
  const head = m[1].split('/* ===== explainer 엔진')[0];
  try {
    const r = new Function(head + '\n;return {CONFIG:CONFIG,SECTIONS:SECTIONS,VIZ:VIZ}')();
    CONFIG = r.CONFIG; SECTIONS = r.SECTIONS; VIZ = r.VIZ || {};
  } catch (e) { err.push('CONFIG/SECTIONS/VIZ 평가 실패: ' + e.message); }
}
if (SECTIONS) {
  if (!CONFIG || !CONFIG.title) err.push('CONFIG.title 누락');
  if (CONFIG && CONFIG.id) warn.push('CONFIG.id는 더 이상 쓰이지 않는다 (진행 상태 저장 제거) — 지워도 된다');
  if (CONFIG && CONFIG.gate) warn.push('CONFIG.gate는 더 이상 쓰이지 않는다 (단계 잠금 제거) — 지워도 된다');
  const seen = new Set();
  SECTIONS.forEach((x, i) => {
    const at = 'SECTIONS[' + i + ']' + (x.id ? ' (' + x.id + ')' : '');
    if (!x.id) err.push(at + ': id 필수');
    else if (seen.has(x.id)) err.push(at + ': id 중복');
    else seen.add(x.id);
    if (!/^[A-Za-z][\w-]*$/.test(x.id || '')) err.push(at + ': id는 영문으로 시작하는 슬러그여야 한다 (해시 딥링크용)');
    if (!x.title) err.push(at + ': title 필수');
    if (!x.summary) err.push(at + ': summary 필수 (기본 노출 요약)');
    if (!x.detail) warn.push(at + ': detail 없음 — 접히는 상세가 비어 보인다');
    if (x.summary && x.summary.length > 400) warn.push(at + ': summary가 ' + x.summary.length + '자 — 3문장 이내로 줄인다');
    if (x.viz && !VIZ[x.viz]) err.push(at + ': viz "' + x.viz + '" 가 VIZ에 없다');
    (x.quiz || []).forEach((q, n) => {
      const qa = at + ' quiz[' + n + ']';
      if (!q.q) err.push(qa + ': q 필수');
      const t = q.type || 'choice';
      if (['choice', 'multi', 'short', 'tf'].indexOf(t) < 0) err.push(qa + ': 알 수 없는 type "' + t + '"');
      if (t === 'choice') {
        if (!Array.isArray(q.choices) || q.choices.length < 2) err.push(qa + ': choices 2개 이상 필요');
        else if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.choices.length) err.push(qa + ': answer 인덱스 범위 초과');
      }
      if (t === 'multi') {
        if (!Array.isArray(q.answer) || !q.answer.length) err.push(qa + ': multi의 answer는 인덱스 배열');
        else if (q.answer.some((v) => v < 0 || v >= (q.choices || []).length)) err.push(qa + ': answer 인덱스 범위 초과');
        else if (q.answer.length === (q.choices || []).length) warn.push(qa + ': 모든 보기가 정답 — 변별력이 없다');
      }
      if (t === 'short' && !q.answer) err.push(qa + ': short의 answer 필수');
      if (t === 'tf' && typeof q.answer !== 'boolean') err.push(qa + ': tf의 answer는 true/false');
      if (!q.why) warn.push(qa + ': why(해설) 없음 — 오답 피드백이 빈약해진다');
    });
  });
  Object.keys(VIZ).forEach((k) => {
    if (typeof VIZ[k].mount !== 'function') err.push('VIZ.' + k + ': mount 함수 필수');
    if (!SECTIONS.some((x) => x.viz === k)) warn.push('VIZ.' + k + ': 어떤 섹션도 참조하지 않는다');
  });
  ok.push('섹션 ' + SECTIONS.length + '개 · 퀴즈 ' + SECTIONS.reduce((a, x) => a + (x.quiz || []).length, 0)
    + '문항 · 시각화 ' + Object.keys(VIZ).length + '개');
}

/* 3. 필수 마크업 */
[['lang="ko"', 'html lang'], ['name="viewport"', 'viewport 메타'], ['word-break:keep-all', '한국어 줄바꿈'],
 ['prefers-reduced-motion', '모션 감소 대응'], ['@media print', '인쇄 스타일'], ['data-sections', '섹션 마운트 지점']]
  .forEach(([p, label]) => { s.indexOf(p) > -1 ? ok.push(label) : err.push(label + ' 누락 (' + p + ')'); });

/* 4. mermaid CDN 정합성 */
const usesMermaid = (SECTIONS || []).some((x) => /```mermaid/.test([x.summary, x.detail, (x.keys || []).join(' ')].join('\n')));
const cdnLive = /<script[^>]+mermaid[^>]*>/.test(s.replace(/<!--[\s\S]*?-->/g, ''));
if (usesMermaid && !cdnLive) err.push('mermaid 코드블록이 있는데 <head>의 mermaid CDN 주석이 해제되지 않았다');
if (!usesMermaid && cdnLive) warn.push('mermaid를 쓰지 않는데 CDN이 켜져 있다 — 주석 처리한다');
if (usesMermaid && cdnLive) ok.push('mermaid CDN 정합');

/* 5. 그 밖의 외부 리소스 */
const ext = (s.replace(/<!--[\s\S]*?-->/g, '').match(/<script[^>]+src="([^"]+)"/g) || [])
  .filter((x) => !/mermaid/.test(x));
if (ext.length) err.push('허용되지 않은 외부 JS: ' + ext.join(', '));

console.log(ok.map((x) => 'OK    ' + x).join('\n'));
if (warn.length) console.log(warn.map((x) => 'WARN  ' + x).join('\n'));
if (err.length) console.log(err.map((x) => 'FAIL  ' + x).join('\n'));
console.log('\n' + (err.length ? '실패 ' + err.length + '건 — 수정 후 다시 실행한다' : '검증 통과' + (warn.length ? ' (경고 ' + warn.length + '건 확인)' : '')));
process.exit(err.length ? 1 : 0);
