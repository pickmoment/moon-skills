/* ===== 템플릿 B 부트: 목차 + 스크롤스파이 ===== */
(function () {
  const $ = EX.$, $$ = EX.$$;
  EXUI.head();
  EXUI.set('[data-title2]', EX.inline(CONFIG.title), true);

  const toc = $('[data-toc]');
  toc.innerHTML = SECTIONS.map((s, i) => {
    const num = s.num || String(i + 1).padStart(2, '0');
    return '<li><a href="#' + s.id + '" data-t="' + s.id + '"><span class="n">' + EX.esc(num) + '</span>'
      + '<span>' + EX.inline(s.title) + '</span></a></li>';
  }).join('');

  EX.init(CONFIG, SECTIONS, VIZ);
  EXUI.toolbar();
  EXUI.keys();

  /* 목차 클릭: 해당 섹션으로 스크롤 (브라우저 기본 앵커 이동을 그대로 쓴다) */
  toc.addEventListener('click', (e) => {
    const a = e.target.closest('[data-t]');
    if (a) $$('.toc a').forEach((x) => x.classList.toggle('cur', x === a));
  });

  /* 스크롤스파이 — 현재 읽는 섹션을 목차에 표시 */
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      $$('.toc a').forEach((a) => a.classList.toggle('cur', a.dataset.t === en.target.dataset.sec));
    });
  }, { rootMargin: '-10% 0px -75% 0px', threshold: 0 });
  SECTIONS.forEach((s) => { if (s.el) io.observe(s.el); });
})();
