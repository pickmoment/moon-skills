/* ===== 공통 UI 배선 (헤더 채우기 · 툴바 · 키보드). 수정하지 않는다 ===== */
const EXUI = (function () {
  const $ = EX.$, $$ = EX.$$;
  const set = (sel, v, asHtml) => { const el = $(sel); if (!el) return; if (asHtml) el.innerHTML = v || ''; else el.textContent = v || ''; };

  function head() {
    document.title = CONFIG.title + (CONFIG.subtitle ? ' — ' + CONFIG.subtitle : '');
    set('[data-kicker]', CONFIG.kicker);
    set('[data-title]', EX.inline(CONFIG.title), true);
    set('[data-subtitle]', EX.inline(CONFIG.subtitle || ''), true);
    set('[data-lead]', EX.md(CONFIG.lead || ''), true);
    set('[data-foot]', EX.inline(CONFIG.footer || ''), true);
    const st = $('[data-stats]');
    if (st) {
      const list = CONFIG.stats || [];
      st.hidden = !list.length;
      st.innerHTML = list.map((s) => '<div class="stat"><b>' + EX.esc(s.v) + '</b><span>' + EX.esc(s.l) + '</span></div>').join('');
    }
    if (CONFIG.search === false) { const s = $('.search'); if (s) s.hidden = true; }
  }

  function toolbar() {
    const s = $('[data-search]');
    if (s) s.addEventListener('input', () => {
      const n = EX.filter(s.value);
      const nr = $('[data-nores]'); if (nr) nr.hidden = n > 0;
      set('[data-count]', s.value ? n + '개 섹션' : '');
    });
    const all = $('[data-all]');
    if (all) all.addEventListener('click', () => {
      const open = all.dataset.on !== '1';
      EX.expandAll(open);
      all.dataset.on = open ? '1' : '';
      all.textContent = open ? '전체 접기' : '전체 펼치기';
    });
    const th = $('[data-theme]');
    if (th) th.addEventListener('click', () => { th.title = '테마: ' + EX.theme(); });
    const pr = $('[data-print]');
    if (pr) pr.addEventListener('click', () => { EX.expandAll(true); setTimeout(() => window.print(), 300); });
  }

  function keys() {
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.matches('input,textarea,select')) {
        if (e.key === 'Escape') { e.target.value = ''; e.target.dispatchEvent(new Event('input')); e.target.blur(); }
        return;
      }
      if (e.key === '/') { const s = $('[data-search]'); if (s) { e.preventDefault(); s.focus(); } }
      else if (e.key === 'e' || e.key === 'E') { const a = $('[data-all]'); if (a) a.click(); }
      else if (e.key === 't' || e.key === 'T') { const t = $('[data-theme]'); if (t) t.click(); }
    });
  }

  return { head: head, toolbar: toolbar, keys: keys, set: set };
})();
