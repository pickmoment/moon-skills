/* ===== explainer 엔진 — 3개 템플릿이 공유한다. 여기는 수정하지 않는다 (데이터만 교체)
   설계 원칙: 세로 스크롤 한 방향 · 진행 상태/저장 없음 · 높이 애니메이션 없음(hidden 토글만) ===== */
const EX = (function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '').replace(/[.,!?;:'"()\[\]{}\-_/\\]/g, '');

  /* ---------- markdown 미니 렌더러 ---------- */
  function inline(s) {
    const codes = [];
    let t = esc(s).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '@@C' + (codes.length - 1) + '@@'; });
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => '<img src="' + u + '" alt="' + a + '" loading="lazy">');
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, u) => '<a href="' + u + '"' + (/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '') + '>' + a + '</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    t = t.replace(/==([^=]+)==/g, '<mark>$1</mark>');
    t = t.replace(/ {2}\n/g, '<br>');
    return t.replace(/@@C(\d+)@@/g, (m, i) => '<code>' + codes[+i] + '</code>');
  }
  const itemRe = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  function parseList(lines, i) {
    const first = lines[i].match(itemRe);
    const base = first[1].length, ordered = /\d/.test(first[2]);
    let html = '<' + (ordered ? 'ol' : 'ul') + '>', open = false;
    while (i < lines.length) {
      const m = lines[i].match(itemRe);
      if (m) {
        const ind = m[1].length;
        if (ind < base) break;
        if (ind >= base + 2) { const r = parseList(lines, i); html += r.html; i = r.i; continue; }
        if (open) html += '</li>';
        html += '<li>' + inline(m[3]); open = true; i++; continue;
      }
      if (lines[i].trim() === '') {
        if (i + 1 < lines.length && itemRe.test(lines[i + 1])) { i++; continue; }
        break;
      }
      if (/^\s{2,}\S/.test(lines[i]) && open) { html += ' ' + inline(lines[i].trim()); i++; continue; }
      break;
    }
    return { html: html + (open ? '</li>' : '') + '</' + (ordered ? 'ol' : 'ul') + '>', i };
  }
  function md(src) {
    if (!src) return '';
    const lines = String(src).replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n');
    const out = []; let p = [], i = 0;
    const flush = () => { if (p.length) { out.push('<p>' + inline(p.join(' ')) + '</p>'); p = []; } };
    while (i < lines.length) {
      const ln = lines[i];
      if (/^\s*```/.test(ln)) {
        flush();
        const lang = (ln.match(/^\s*```\s*([\w-]+)?/) || [])[1] || '';
        const body = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i++; }
        i++;
        const code = esc(body.join('\n'));
        /* mermaid는 원본을 data-src에 보관한다 — mermaid CDN의 startOnLoad 자동 렌더가
           본문 텍스트를 SVG로 갈아치운 뒤 우리가 다시 읽으면 소스가 사라지기 때문이다. */
        out.push(lang === 'mermaid'
          ? '<div class="mmd" data-src="' + escAttr(body.join('\n')) + '"><pre><code>' + code + '</code></pre></div>'
          : '<pre><code' + (lang ? ' class="lang-' + esc(lang) + '"' : '') + '>' + code + '</code></pre>');
        continue;
      }
      if (/^\s*$/.test(ln)) { flush(); i++; continue; }
      const h = ln.match(/^\s*(#{2,4})\s+(.*)$/);
      if (h) { flush(); const t = h[1].length <= 3 ? 'h3' : 'h4'; out.push('<' + t + '>' + inline(h[2]) + '</' + t + '>'); i++; continue; }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(ln)) { flush(); out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(ln)) {
        flush(); const body = []; let warn = false;
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          let t = lines[i].replace(/^\s*>\s?/, '');
          if (/^!/.test(t)) { warn = true; t = t.replace(/^!\s*/, ''); }
          body.push(t); i++;
        }
        out.push('<blockquote' + (warn ? ' class="warn"' : '') + '>' + md(body.join('\n')) + '</blockquote>');
        continue;
      }
      if (/^\s*\|/.test(ln) && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*$/.test(lines[i + 1])) {
        flush();
        const cells = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
        const head = cells(lines[i]); i += 2; const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        /* 표는 스크롤 래퍼로 감싼다 — 표 자체에 display:block을 주면 width:100%가 안 먹어 헤더가 어긋난다 */
        out.push('<div class="tw"><table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'
          + rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
        continue;
      }
      if (itemRe.test(ln)) { flush(); const r = parseList(lines, i); out.push(r.html); i = r.i; continue; }
      p.push(ln.trim()); i++;
    }
    flush();
    return out.join('\n');
  }

  let CFG = {}, SECS = [], VZ = {};

  /* ---------- mermaid (상세에 mermaid 블록이 있고 CDN을 켰을 때만 동작) ---------- */
  let mmReady = false, mmN = 0;
  function mermaidIn(scope) {
    if (!window.mermaid) return;
    const nodes = $$('.mmd:not([data-done])', scope);
    if (!nodes.length) return;
    if (!mmReady) {
      const dark = document.documentElement.dataset.theme === 'dark'
        || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches);
      window.mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'loose', fontFamily: 'inherit' });
      mmReady = true;
    }
    nodes.forEach((n) => {
      n.dataset.done = '1';
      Promise.resolve(window.mermaid.render('mm' + (++mmN), n.dataset.src || ''))
        .then((r) => { n.innerHTML = r.svg; })
        .catch(() => { /* 실패 시 코드블록 폴백을 그대로 둔다 */ });
    });
  }

  /* ---------- 퀴즈 (즉시 채점 + 해설. 점수 집계·저장 없음) ---------- */
  function quizHTML(sec) {
    return '<div class="quizbox">' + sec.quiz.map((q, n) => {
      const key = sec.id + '#' + n;
      let body = '';
      if (q.type === 'short') {
        body = '<div class="qz-form"><input type="text" placeholder="답을 입력하세요" data-in="' + key + '" autocomplete="off">'
          + '<button class="btn primary" data-sub="' + key + '">확인</button></div>';
      } else {
        const opts = q.type === 'tf' ? ['맞다', '아니다'] : (q.choices || []);
        body = '<div class="opts">' + opts.map((c, oi) =>
          '<button class="opt" data-opt="' + key + '" data-oi="' + oi + '"><span class="mk">'
          + (q.type === 'tf' ? (oi === 0 ? 'O' : 'X') : String.fromCharCode(65 + oi)) + '</span><span>' + inline(c) + '</span></button>').join('') + '</div>'
          + (q.type === 'multi' ? '<div class="qz-form"><button class="btn primary" data-sub="' + key + '">채점</button>'
            + '<span class="hint">정답을 모두 고른 뒤 채점</span></div>' : '');
      }
      return '<div class="qz" data-qz="' + key + '"><div class="qz-top"><span class="qz-n">Q' + (n + 1) + '</span>'
        + '<span class="qz-q">' + inline(q.q) + '</span></div>' + body
        + '<div class="fb"></div><button class="qz-again" data-again="' + key + '" hidden>다시 풀기</button></div>';
    }).join('') + '</div>';
  }
  const answerOf = (q) => q.type === 'tf' ? [q.answer === true || q.answer === 0 ? 0 : 1]
    : q.type === 'multi' ? [].concat(q.answer) : q.type === 'short' ? null : [q.answer];

  function grade(sec, n, box, pick, text) {
    const q = sec.quiz[n]; let ok = false;
    if (q.type === 'short') ok = [q.answer].concat(q.accept || []).map(norm).indexOf(norm(text)) > -1;
    else if (q.type === 'multi') ok = pick.slice().sort().join(',') === [].concat(q.answer).slice().sort().join(',');
    else if (q.type === 'tf') ok = pick[0] === (q.answer === true || q.answer === 0 ? 0 : 1);
    else ok = pick[0] === q.answer;

    const ans = answerOf(q);
    box.classList.toggle('solved', ok);
    $$('.opt', box).forEach((o) => {
      const oi = +o.dataset.oi; o.disabled = true; o.classList.remove('pick');
      if (ans && ans.indexOf(oi) > -1) o.classList.add('right');
      else if (pick.indexOf(oi) > -1) o.classList.add('wrong');
    });
    const input = $('[data-in]', box), sub = $('[data-sub]', box);
    if (input) input.disabled = true;
    if (sub) sub.disabled = true;
    const fb = $('.fb', box);
    fb.className = 'fb show ' + (ok ? 'ok' : 'no');
    fb.innerHTML = '<b>' + (ok ? '정답' : '오답') + '</b>'
      + (!ok && q.type === 'short' ? ' — 정답: <b>' + esc(q.answer) + '</b>' : '')
      + (q.why ? '<span class="why">' + inline(q.why) + '</span>' : '');
    $('[data-again]', box).hidden = false;
  }
  function resetQz(box) {
    box.classList.remove('solved');
    $$('.opt', box).forEach((o) => { o.disabled = false; o.classList.remove('right', 'wrong', 'pick'); });
    const input = $('[data-in]', box), sub = $('[data-sub]', box);
    if (input) { input.disabled = false; input.value = ''; }
    if (sub) sub.disabled = false;
    const fb = $('.fb', box); fb.className = 'fb'; fb.innerHTML = '';
    $('[data-again]', box).hidden = true;
  }

  /* ---------- 섹션 DOM ---------- */
  function build(root) {
    root.innerHTML = SECS.map((s, i) => {
      const num = s.num || String(i + 1).padStart(2, '0');
      const metas = [];
      if (s.tag) metas.push('<span class="pill">' + esc(s.tag) + '</span>');
      if (s.quiz && s.quiz.length && CFG.quiz !== 'off') metas.push('<span class="pill ghost">퀴즈 ' + s.quiz.length + '</span>');
      if (s.viz && VZ[s.viz]) metas.push('<span class="pill ghost">시각화</span>');
      const acts = ['<button class="btn primary" data-act="detail" aria-expanded="false"><span>상세 설명</span><span class="ic chev" aria-hidden="true">▾</span></button>'];
      if (s.viz && VZ[s.viz]) acts.push('<button class="btn" data-act="viz" aria-expanded="false"><span aria-hidden="true">◎</span><span>시각화로 보기</span></button>');
      if (s.quiz && s.quiz.length && CFG.quiz !== 'off') acts.push('<button class="btn" data-act="quiz" aria-expanded="false"><span aria-hidden="true">✎</span><span>퀴즈 ' + s.quiz.length + '문항</span></button>');
      return '<article class="sec" id="' + s.id + '" data-sec="' + s.id + '" data-i="' + i + '">'
        + '<header class="sec-head"><span class="sec-num">' + esc(num) + '</span>'
        + '<div class="sec-headmain"><h2 class="sec-title">' + inline(s.title) + '</h2>'
        + (metas.length ? '<div class="sec-meta">' + metas.join('') + '</div>' : '') + '</div></header>'
        + '<div class="sec-summary md">' + md(s.summary) + '</div>'
        + (s.keys && s.keys.length ? '<ul class="keys">' + s.keys.map((k) => '<li>' + inline(k) + '</li>').join('') + '</ul>' : '')
        + '<div class="sec-actions no-print">' + acts.join('') + '</div>'
        + '<div class="panel" data-panel="detail" hidden><div class="panel-in md">' + md(s.detail) + '</div></div>'
        + (s.viz && VZ[s.viz] ? '<div class="panel" data-panel="viz" hidden><div class="panel-in"><div class="viz" data-viz="' + esc(s.viz) + '">'
          + '<div class="viz-title">' + esc(VZ[s.viz].title || '시각화') + '</div>'
          + (VZ[s.viz].note ? '<div class="viz-note">' + inline(VZ[s.viz].note) + '</div>' : '')
          + '<div class="viz-stage"></div></div></div></div>' : '')
        + (s.quiz && s.quiz.length && CFG.quiz !== 'off' ? '<div class="panel" data-panel="quiz" hidden><div class="panel-in">'
          + quizHTML(s) + '</div></div>' : '')
        + '</article>';
    }).join('');
    SECS.forEach((s) => { s.el = $('[data-sec="' + s.id + '"]', root); });

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act) { toggle(act.closest('.sec').dataset.sec, act.dataset.act); return; }
      const opt = e.target.closest('.opt');
      if (opt && !opt.disabled) {
        const parts = opt.dataset.opt.split('#'), sec = SECS.find((x) => x.id === parts[0]), n = +parts[1];
        if (sec.quiz[n].type === 'multi') { opt.classList.toggle('pick'); return; }
        grade(sec, n, opt.closest('.qz'), [+opt.dataset.oi]); return;
      }
      const sub = e.target.closest('[data-sub]');
      if (sub) {
        const parts = sub.dataset.sub.split('#'), sec = SECS.find((x) => x.id === parts[0]), n = +parts[1];
        const box = sub.closest('.qz');
        if (sec.quiz[n].type === 'multi') grade(sec, n, box, $$('.opt.pick', box).map((o) => +o.dataset.oi));
        else grade(sec, n, box, [], $('[data-in]', box).value);
        return;
      }
      const ag = e.target.closest('[data-again]');
      if (ag) resetQz(ag.closest('.qz'));
    });
    root.addEventListener('keydown', (e) => {
      const inp = e.target.closest('[data-in]');
      if (inp && e.key === 'Enter') { e.preventDefault(); $('[data-sub]', inp.closest('.qz')).click(); }
    });
  }

  /* ---------- 패널 토글 (높이 애니메이션 없음 — hidden 만 바꾼다) ---------- */
  function toggle(sid, kind, force) {
    const sec = SECS.find((s) => s.id === sid); if (!sec) return;
    const panel = $('[data-panel="' + kind + '"]', sec.el); if (!panel) return;
    const open = force == null ? panel.hidden : !!force;
    if (open === !panel.hidden) return;
    panel.hidden = !open;
    const btn = $('[data-act="' + kind + '"]', sec.el);
    if (btn) { btn.setAttribute('aria-expanded', String(open)); btn.classList.toggle('on', open && kind !== 'detail'); }
    if (!open) return;
    if (kind === 'detail') mermaidIn(panel);
    if (kind === 'viz') mountViz(sec, panel);
  }
  function mountViz(sec, panel) {
    const host = $('.viz-stage', panel); if (!host || host.dataset.done) return;
    host.dataset.done = '1';
    try { VZ[sec.viz].mount(host, { md: md, esc: esc, inline: inline }); }
    catch (err) { host.innerHTML = '<p class="viz-note">시각화를 불러올 수 없습니다.</p>'; console.error(err); }
  }
  const expandAll = (open) => SECS.forEach((s) => toggle(s.id, 'detail', open));

  /* ---------- 검색 ---------- */
  function filter(q) {
    const t = norm(q); let n = 0;
    SECS.forEach((s) => {
      const hay = norm([s.title, s.tag, s.summary, (s.keys || []).join(' '), s.detail].join(' '));
      const hit = !t || hay.indexOf(t) > -1;
      s.el.hidden = !hit; if (hit) n++;
    });
    return n;
  }

  /* ---------- 테마 (세션 한정, 저장하지 않는다) ---------- */
  let themeCur = 'auto';
  function theme(next) {
    const v = next || (themeCur === 'auto' ? 'dark' : themeCur === 'dark' ? 'light' : 'auto');
    themeCur = v;
    if (v === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = v;
    mmReady = false;
    $$('.mmd[data-done]').forEach((n) => { n.removeAttribute('data-done'); });
    $$('.panel:not([hidden])').forEach(mermaidIn);
    document.dispatchEvent(new Event('ex:theme')); /* 시각화 위젯이 색을 다시 읽는 신호 */
    return v;
  }

  /* ---------- 초기화 ---------- */
  function init(cfg, secs, viz) {
    CFG = cfg || {}; SECS = (secs || []).slice(); VZ = viz || {};
    build($('[data-sections]'));
    const h = decodeURIComponent(location.hash.slice(1));
    if (h && SECS.some((s) => s.id === h)) {
      toggle(h, 'detail', true);
      requestAnimationFrame(() => { const el = SECS.find((s) => s.id === h).el; if (el) el.scrollIntoView({ block: 'start' }); });
    }
    return { cfg: CFG, secs: SECS };
  }

  return {
    init: init, md: md, inline: inline, esc: esc, toggle: toggle, expandAll: expandAll,
    filter: filter, theme: theme, mermaidIn: mermaidIn,
    get sections() { return SECS; }, get cfg() { return CFG; }, $: $, $$: $$
  };
})();
