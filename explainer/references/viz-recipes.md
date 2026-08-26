# 시각화 위젯 레시피 8종 (복사해서 `VIZ`에 붙인다)

계약은 하나다 — `VIZ.<키> = { title, note, mount(host, api) }`. `host`는 `.viz-stage` div이고,
"시각화로 보기"를 처음 열 때 한 번만 호출된다. `api`는 `{ md, esc, inline }`. 스타일은 이미 있는 클래스를 쓴다
(`.viz-ctrl`, `.viz-row`, `.viz-btn`, `.viz-readout`/`.viz-stat`, `.viz-legend`, `input[type=range]`).

## 어떤 레시피를 고를까

| 설명하려는 것 | 레시피 |
|---|---|
| 변수 하나가 결과를 얼마나 바꾸는가 | **1. 파라미터 슬라이더** |
| 요청·데이터가 어디를 거쳐 흐르는가 | **2. 단계 흐름 다이어그램** |
| 규칙을 반복 적용하면 상태가 어떻게 변하는가 | **3. 스텝 시뮬레이터** |
| 도입 전/후, 잘못된 방식/올바른 방식 | **4. A/B 비교 토글** |
| 실제 수치의 크기·추이 비교 | **5. 인터랙티브 차트** |
| 확산·전파·경쟁이 만드는 창발 패턴 | **6. 그리드 시뮬레이션** |
| 무엇이 무엇에 의존하는가 | **7. 관계 그래프** |
| "우리 상황에 넣으면 어떻게 되나" | **8. 계산기 위젯** |

원칙 넷: ① 조작 요소는 3개 이하 ② 첫 화면이 이미 의미 있는 상태 ③ 숫자는 `.viz-stat`으로 크게
④ 애니메이션은 이해를 돕는 만큼만(자동재생은 정지 버튼과 함께).

---

## 1. 파라미터 슬라이더 + 비교 막대 (canvas)

변수를 움직여 결과가 비선형으로 변하는 것을 체감시킨다. `references/base-*.html`의 `hitrate` 위젯이 이 형태다.

```js
slider: {
  title: '변수를 바꾸면 결과가 얼마나 달라지는가',
  note: '슬라이더를 움직여 보세요.',
  mount(host) {
    host.innerHTML = `
      <canvas></canvas>
      <div class="viz-ctrl">
        <div class="viz-row"><label for="p1">비율</label><input id="p1" type="range" min="0" max="100" value="90"><output>90%</output></div>
        <div class="viz-row"><label for="p2">기준값</label><input id="p2" type="range" min="20" max="500" step="10" value="200"><output>200</output></div>
      </div>
      <div class="viz-readout"><div class="viz-stat"><b data-o="r">–</b><span>결과</span></div></div>`;
    const cv = host.querySelector('canvas'), ctx = cv.getContext('2d');
    const V = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
    const H = 130;
    const fit = () => { const w = cv.clientWidth || 520, d = devicePixelRatio || 1;
      cv.width = w * d; cv.height = H * d; cv.style.height = H + 'px'; ctx.setTransform(d, 0, 0, d, 0, 0); return w; };
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); };
    function draw() {
      const p = +host.querySelector('#p1').value / 100, base = +host.querySelector('#p2').value;
      const out = base * (1 - p);                       // ← 설명할 수식으로 바꾼다
      const w = fit(), pad = 84, barW = w - pad - 20;
      ctx.clearRect(0, 0, w, H);
      [{ l: '기준', v: base, c: V('--ink-sub', '#888') }, { l: '적용 후', v: out, c: V('--accent', '#4b5cf6') }]
        .forEach((r, i) => {
          const y = 24 + i * 52;
          ctx.font = '600 12px ' + V('--font', 'sans-serif'); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillStyle = V('--ink-sub', '#888'); ctx.fillText(r.l, pad - 12, y + 13);
          ctx.fillStyle = V('--surface-2', '#eee'); rr(pad, y, barW, 26, 8);
          ctx.fillStyle = r.c; rr(pad, y, Math.max(2, (r.v / base) * barW), 26, 8);
          ctx.fillStyle = V('--ink', '#111'); ctx.textAlign = 'left';
          ctx.font = '700 12px ' + V('--font-mono', 'monospace');
          ctx.fillText(r.v.toFixed(1), pad + Math.max(2, (r.v / base) * barW) + 8, y + 13);
        });
      host.querySelector('[data-o="r"]').textContent = out.toFixed(1);
    }
    host.querySelectorAll('input').forEach((i) => i.addEventListener('input', () => {
      i.parentElement.querySelector('output').textContent = i.value + (i.id === 'p1' ? '%' : ''); draw();
    }));
    addEventListener('resize', draw); document.addEventListener('ex:theme', draw);
    draw(); requestAnimationFrame(draw);   // 폭이 확정되는 다음 프레임에 한 번 더
  }
}
```

- `fit()`은 `devicePixelRatio`를 반영한다 — 이걸 빼면 레티나에서 흐릿하다.
- 마지막 `requestAnimationFrame(draw)`은 패널이 열린 직후 폭이 확정되지 않은 첫 프레임 보정이다.

## 2. 단계 흐름 다이어그램 (SVG + 스텝 컨트롤)

시나리오별로 "지금 어디가 활성인가"를 짚어 준다. base 템플릿의 `lookup` 위젯이 이 형태다.

```js
flow: {
  title: '흐름을 단계별로 따라가기',
  mount(host) {
    const STEPS = {
      정상: [ { on: ['a'], t: '① 클라이언트가 요청한다.' },
              { on: ['a', 'e1', 'b'], t: '② 게이트웨이가 인증을 확인한다.' },
              { on: ['b', 'e2', 'a'], t: '③ 응답을 반환한다.' } ],
      실패: [ { on: ['a', 'e1', 'b'], t: '① 토큰이 만료됐다.' },
              { on: ['b'], t: '② 401을 반환하고 갱신을 요구한다.' } ]
    };
    host.innerHTML = `
      <svg viewBox="0 54 560 84" role="img" aria-label="흐름도">
        <defs><marker id="ar2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8"
          markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>
        <g class="fl">
          <g data-n="a"><rect x="16" y="66" width="150" height="58" rx="12"/><text x="91" y="100">클라이언트</text></g>
          <g data-n="b"><rect x="394" y="66" width="150" height="58" rx="12"/><text x="469" y="100">게이트웨이</text></g>
          <path data-n="e1" d="M170 84 H389" marker-end="url(#ar2)"/>
          <path data-n="e2" d="M389 108 H172" marker-end="url(#ar2)"/>
          <text class="lb" x="280" y="76">요청</text><text class="lb" x="280" y="126">응답</text>
        </g></svg>
      <div class="viz-ctrl">
        ${Object.keys(STEPS).map((k, i) => `<button class="viz-btn${i ? '' : ' on'}" data-s="${k}">${k}</button>`).join('')}
        <span style="flex:1"></span>
        <button class="viz-btn" data-go="-1">◀ 이전</button><button class="viz-btn" data-go="1">다음 ▶</button>
      </div>
      <p class="viz-note" data-cap style="margin:12px 0 0;min-height:2.6em"></p>
      <style>
        [data-viz] .fl rect{fill:var(--surface-2);stroke:var(--line);stroke-width:1.5}
        [data-viz] .fl text{fill:var(--ink);font:600 13px var(--font);text-anchor:middle}
        [data-viz] .fl text.lb{fill:var(--ink-sub);font:500 10.5px var(--font-mono)}
        [data-viz] .fl path{fill:none;stroke:var(--line);stroke-width:2;color:var(--line)}
        [data-viz] .fl [data-n].hi rect{fill:var(--accent-tint);stroke:var(--accent);stroke-width:2.5}
        [data-viz] .fl [data-n].hi text{fill:var(--accent)}
        [data-viz] .fl path.hi{stroke:var(--accent);color:var(--accent);stroke-width:2.8}
      </style>`;
    let key = Object.keys(STEPS)[0], i = 0;
    const paint = () => {
      const st = STEPS[key][i];
      host.querySelectorAll('[data-n]').forEach((el) => el.classList.toggle('hi', st.on.includes(el.dataset.n)));
      host.querySelector('[data-cap]').innerHTML = EX.inline(st.t) + ` <span style="opacity:.6">(${i + 1}/${STEPS[key].length})</span>`;
    };
    host.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
      host.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b));
      key = b.dataset.s; i = 0; paint();
    }));
    host.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      i = (i + +b.dataset.go + STEPS[key].length) % STEPS[key].length; paint();
    }));
    paint();
  }
}
```

- SVG `viewBox`는 **내용에 딱 맞게** 자른다. 여백이 남으면 위젯이 텅 빈 상자로 보인다.
- 노드는 `data-n`, 화살표도 `data-n` — 단계 정의가 `on: ['a','e1','b']` 처럼 읽힌다.
- 자동재생을 넣을 땐 정지 버튼을 같은 자리에 둔다(`setInterval` + 토글).

## 3. 스텝 시뮬레이터 (상태 기계, DOM)

규칙을 한 스텝씩 적용해 상태 변화를 눈으로 따라가게 한다. base 템플릿의 `lru` 위젯이 이 형태다.
핵심 골격만 옮기면 아래와 같다.

```js
sim: {
  title: '규칙을 한 단계씩 적용해 보기',
  mount(host) {
    const SEQ = ['A', 'B', 'C', 'A', 'D', 'B'];   // 입력 시퀀스
    host.innerHTML = `
      <div class="viz-ctrl" style="margin:0 0 14px">
        <div class="viz-row" style="flex:0 1 200px"><label for="cap">용량</label>
          <input id="cap" type="range" min="1" max="4" value="2"><output>2</output></div>
        <span style="flex:1"></span>
        <button class="viz-btn" data-step>다음 ▶</button><button class="viz-btn" data-auto>▶ 자동</button>
        <button class="viz-btn" data-reset>처음부터</button>
      </div>
      <div data-seq style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px"></div>
      <div data-state style="display:flex;flex-wrap:wrap;gap:8px;min-height:56px"></div>
      <p class="viz-note" data-log style="margin:12px 0 0;min-height:1.6em"></p>
      <div class="viz-readout"><div class="viz-stat"><b data-o="n">0</b><span>처리한 요청</span></div></div>`;
    let cap = 2, at = 0, slots = [], timer = null;
    const el = (s) => host.querySelector(s);
    function paint(msg) {
      el('[data-seq]').innerHTML = SEQ.map((k, i) => `<span style="font:700 12px var(--font-mono);padding:.3em .65em;border-radius:7px;${
        i < at ? 'background:var(--surface-2);color:var(--ink-sub)' : i === at ? 'background:var(--accent);color:#fff'
        : 'border:1px dashed var(--line);color:var(--ink-sub)'}">${k}</span>`).join('');
      el('[data-state]').innerHTML = Array.from({ length: cap }, (_, i) => `<div style="flex:1 1 68px;height:56px;
        border-radius:10px;display:grid;place-items:center;font:700 15px var(--font-mono);${slots[i]
          ? 'background:var(--accent-tint);border:1.5px solid var(--accent);color:var(--accent)'
          : 'background:var(--surface-2);border:1.5px dashed var(--line);color:var(--ink-sub)'}">${slots[i] || '·'}</div>`).join('');
      el('[data-log]').innerHTML = msg || '한 단계씩 진행하며 상태 변화를 확인하세요.';
      el('[data-o="n"]').textContent = at;
    }
    function step() {
      if (at >= SEQ.length) { stop(); return paint('시퀀스 종료 — 값을 바꿔 다시 재생해 보세요.'); }
      const k = SEQ[at++];                                   // ← 규칙을 이 안에서 구현한다
      if (!slots.includes(k)) { if (slots.length >= cap) slots.shift(); slots.push(k); paint(`<b>${k}</b> 신규 — 추가`); }
      else paint(`<b>${k}</b> 이미 있음 — 그대로`);
    }
    const stop = () => { clearInterval(timer); timer = null; el('[data-auto]').classList.remove('on'); el('[data-auto]').textContent = '▶ 자동'; };
    el('#cap').addEventListener('input', (e) => { cap = +e.target.value;
      e.target.parentElement.querySelector('output').textContent = cap; at = 0; slots = []; stop(); paint(); });
    el('[data-step]').addEventListener('click', step);
    el('[data-reset]').addEventListener('click', () => { at = 0; slots = []; stop(); paint(); });
    el('[data-auto]').addEventListener('click', (e) => {
      if (timer) return stop();
      e.target.classList.add('on'); e.target.textContent = '❙❙ 정지'; timer = setInterval(step, 900);
    });
    paint();
  }
}
```

- **자동재생 타이머는 반드시 정지 경로를 만든다.** 패널을 닫아도 타이머는 살아 있다.
- 시퀀스는 고정값으로 둔다(랜덤이면 사용자끼리 같은 화면을 못 본다).

## 4. A/B 비교 토글

"잘못된 방식 → 올바른 방식"처럼 **두 상태의 차이 자체가 설명**일 때 쓴다.

```js
ab: {
  title: '두 방식을 나란히 비교하기',
  mount(host) {
    const CASES = {
      '캐시 없음': { badge: '평균 200ms', rows: [['요청 1', '200ms'], ['요청 2', '200ms'], ['요청 3', '200ms']], note: '모든 요청이 원본을 부담한다.' },
      '캐시 적용': { badge: '평균 68ms', rows: [['요청 1', '200ms (미스)'], ['요청 2', '2ms (히트)'], ['요청 3', '2ms (히트)']], note: '첫 요청만 비싸고 이후는 거의 무료다.' }
    };
    const keys = Object.keys(CASES);
    host.innerHTML = `
      <div class="viz-ctrl" style="margin:0 0 14px">
        ${keys.map((k, i) => `<button class="viz-btn${i ? '' : ' on'}" data-c="${k}">${k}</button>`).join('')}
        <span style="flex:1"></span><span class="pill" data-badge></span>
      </div>
      <div data-body style="display:grid;gap:6px"></div>
      <p class="viz-note" data-note style="margin:12px 0 0"></p>`;
    const paint = (k) => {
      const c = CASES[k];
      host.querySelector('[data-badge]').textContent = c.badge;
      host.querySelector('[data-body]').innerHTML = c.rows.map(([l, v]) => `
        <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 14px;background:var(--surface-2);
          border:1px solid var(--line);border-radius:9px;font-size:.88rem">
          <span>${l}</span><b style="font-family:var(--font-mono);color:var(--accent)">${v}</b></div>`).join('');
      host.querySelector('[data-note]').textContent = c.note;
    };
    host.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => {
      host.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); paint(b.dataset.c);
    }));
    paint(keys[0]);
  }
}
```

- 두 상태의 **행 수와 라벨을 같게** 유지한다. 그래야 차이가 값에만 남는다.
- 3안 이상이면 토글 대신 5번(차트)으로 바꾼다.

## 5. 인터랙티브 차트 (SVG + hover 툴팁)

실제 수치를 비교할 때. 차트를 쓰기 전에 **dataviz 스킬이 있으면 먼저 읽는다**(형태·색 선택 기준).

```js
chart: {
  title: '구간별 수치 비교',
  mount(host) {
    const DATA = [{ l: 'p50', v: 12 }, { l: 'p90', v: 48 }, { l: 'p99', v: 210 }, { l: 'max', v: 640 }];
    const W = 560, H = 200, pad = { l: 44, r: 12, t: 14, b: 32 };
    const max = Math.max(...DATA.map((d) => d.v)) * 1.1;
    const bw = (W - pad.l - pad.r) / DATA.length;
    host.innerHTML = `
      <div style="position:relative">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="구간별 수치">
          ${[0, .5, 1].map((f) => { const y = pad.t + (H - pad.t - pad.b) * (1 - f); return `
            <line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/>
            <text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" fill="var(--ink-sub)"
              style="font:500 10px var(--font-mono)">${Math.round(max * f)}</text>`; }).join('')}
          ${DATA.map((d, i) => { const h = (H - pad.t - pad.b) * (d.v / max), x = pad.l + i * bw + bw * .18;
            return `<rect data-i="${i}" x="${x}" y="${H - pad.b - h}" width="${bw * .64}" height="${h}" rx="5"
              fill="var(--accent)" opacity=".85" style="cursor:pointer"/>
              <text x="${x + bw * .32}" y="${H - pad.b + 16}" text-anchor="middle" fill="var(--ink-sub)"
                style="font:600 11px var(--font)">${d.l}</text>`; }).join('')}
        </svg>
        <div data-tip style="position:absolute;pointer-events:none;opacity:0;transform:translate(-50%,-115%);
          background:var(--ink);color:var(--bg);font:600 11px var(--font-mono);padding:5px 9px;border-radius:7px;
          white-space:nowrap;transition:opacity .12s"></div>
      </div>`;
    const tip = host.querySelector('[data-tip]'), svg = host.querySelector('svg');
    svg.addEventListener('pointermove', (e) => {
      const r = e.target.closest('[data-i]');
      if (!r) { tip.style.opacity = 0; return; }
      const d = DATA[+r.dataset.i], box = svg.getBoundingClientRect(), rb = r.getBoundingClientRect();
      tip.textContent = d.l + ' · ' + d.v + 'ms';
      tip.style.left = (rb.left - box.left + rb.width / 2) + 'px';
      tip.style.top = (rb.top - box.top) + 'px';
      tip.style.opacity = 1;
    });
    svg.addEventListener('pointerleave', () => { tip.style.opacity = 0; });
  }
}
```

- 눈금은 3줄로 충분하다. 격자를 촘촘히 그리면 값보다 배경이 먼저 보인다.
- 값 하나가 나머지를 압도하면(위 예의 `max`) 로그 스케일 대신 **그 항목을 따로 언급**하는 편이 정직하다.

## 6. 그리드 시뮬레이션 (canvas)

확산·전파·경쟁처럼 **규칙은 단순한데 결과가 창발**하는 현상에.

```js
grid: {
  title: '확산이 어떻게 퍼지는가',
  note: '전파 확률을 바꿔 가며 재생해 보세요.',
  mount(host) {
    const N = 40;
    host.innerHTML = `
      <canvas></canvas>
      <div class="viz-ctrl">
        <div class="viz-row"><label for="p">전파 확률</label><input id="p" type="range" min="5" max="60" value="24"><output>24%</output></div>
        <button class="viz-btn" data-step>1스텝 ▶</button><button class="viz-btn" data-auto>▶ 자동</button>
        <button class="viz-btn" data-reset>초기화</button>
      </div>
      <div class="viz-readout">
        <div class="viz-stat"><b data-o="t">0</b><span>스텝</span></div>
        <div class="viz-stat"><b data-o="a">1</b><span>확산된 칸</span></div></div>`;
    const cv = host.querySelector('canvas'), ctx = cv.getContext('2d');
    const V = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
    let cells = new Uint8Array(N * N), t = 0, timer = null, p = .24;
    const seed = () => { cells = new Uint8Array(N * N); cells[(N / 2 | 0) * N + (N / 2 | 0)] = 1; t = 0; };
    function draw() {
      const w = cv.clientWidth || 520, d = devicePixelRatio || 1, s = w / N;
      cv.width = w * d; cv.height = w * d; cv.style.height = w + 'px'; ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = V('--surface-2', '#eee'); ctx.fillRect(0, 0, w, w);
      ctx.fillStyle = V('--accent', '#4b5cf6');
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cells[y * N + x]) ctx.fillRect(x * s, y * s, s - .6, s - .6);
      host.querySelector('[data-o="t"]').textContent = t;
      host.querySelector('[data-o="a"]').textContent = cells.reduce((a, v) => a + v, 0);
    }
    function step() {
      const next = cells.slice();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (cells[y * N + x]) continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          return nx >= 0 && nx < N && ny >= 0 && ny < N && cells[ny * N + nx];
        });
        if (nb && Math.random() < p) next[y * N + x] = 1;
      }
      cells = next; t++; draw();
    }
    const stop = () => { clearInterval(timer); timer = null;
      host.querySelector('[data-auto]').classList.remove('on'); host.querySelector('[data-auto]').textContent = '▶ 자동'; };
    host.querySelector('#p').addEventListener('input', (e) => {
      p = +e.target.value / 100; e.target.parentElement.querySelector('output').textContent = e.target.value + '%'; });
    host.querySelector('[data-step]').addEventListener('click', step);
    host.querySelector('[data-reset]').addEventListener('click', () => { stop(); seed(); draw(); });
    host.querySelector('[data-auto]').addEventListener('click', (e) => {
      if (timer) return stop();
      e.target.classList.add('on'); e.target.textContent = '❙❙ 정지'; timer = setInterval(step, 220);
    });
    addEventListener('resize', draw); document.addEventListener('ex:theme', draw);
    seed(); draw(); requestAnimationFrame(draw);
  }
}
```

- `N`은 40 이하로. 그 이상은 모바일에서 칸이 1px 미만이 되어 회색 덩어리가 된다.
- 셀 상태가 3종 이상이면 `.viz-legend`로 색 범례를 붙인다.

## 7. 관계 그래프 (SVG, 고정 좌표)

의존·참조·소유 관계를 탐색시킨다. 물리 시뮬레이션을 쓰지 말고 **좌표를 손으로 지정**한다(재현성·가독성).

```js
graph: {
  title: '무엇이 무엇에 의존하는가',
  note: '노드를 클릭하면 직접 연결된 것만 강조됩니다.',
  mount(host) {
    const NODES = [{ id: 'api', l: 'API', x: 280, y: 40, d: '요청 진입점' },
      { id: 'cache', l: '캐시', x: 120, y: 140, d: '조회 결과 저장' },
      { id: 'db', l: 'DB', x: 280, y: 230, d: '원본 데이터' },
      { id: 'queue', l: '큐', x: 440, y: 140, d: '무효화 이벤트 전달' }];
    const EDGES = [['api', 'cache'], ['api', 'db'], ['db', 'queue'], ['queue', 'cache']];
    const pos = (id) => NODES.find((n) => n.id === id);
    host.innerHTML = `
      <svg viewBox="0 10 560 250" role="img" aria-label="의존 관계도">
        ${EDGES.map(([a, b]) => `<line data-e="${a}|${b}" x1="${pos(a).x}" y1="${pos(a).y}" x2="${pos(b).x}" y2="${pos(b).y}"
          stroke="var(--line)" stroke-width="2"/>`).join('')}
        ${NODES.map((n) => `<g data-id="${n.id}" style="cursor:pointer">
          <circle cx="${n.x}" cy="${n.y}" r="34" fill="var(--surface-2)" stroke="var(--line)" stroke-width="1.5"/>
          <text x="${n.x}" y="${n.y + 5}" text-anchor="middle" fill="var(--ink)" style="font:700 13px var(--font)">${n.l}</text>
        </g>`).join('')}
      </svg>
      <p class="viz-note" data-info style="margin:10px 0 0;min-height:1.6em">노드를 클릭해 보세요.</p>`;
    const svg = host.querySelector('svg');
    svg.addEventListener('click', (e) => {
      const g = e.target.closest('[data-id]');
      const id = g && g.dataset.id;
      host.querySelectorAll('[data-id] circle').forEach((c) => {
        const nid = c.parentElement.dataset.id;
        const near = !id || nid === id || EDGES.some(([a, b]) => (a === id && b === nid) || (b === id && a === nid));
        c.setAttribute('fill', nid === id ? 'var(--accent)' : near ? 'var(--accent-tint)' : 'var(--surface-2)');
        c.setAttribute('stroke', near ? 'var(--accent)' : 'var(--line)');
        c.parentElement.style.opacity = near ? 1 : .4;
      });
      host.querySelectorAll('[data-e]').forEach((l) => {
        const [a, b] = l.dataset.e.split('|'), on = id && (a === id || b === id);
        l.setAttribute('stroke', on ? 'var(--accent)' : 'var(--line)');
        l.setAttribute('stroke-width', on ? 3 : 2);
      });
      host.querySelector('[data-info]').innerHTML = id
        ? `<b style="color:var(--accent)">${pos(id).l}</b> — ${pos(id).d}` : '노드를 클릭해 보세요.';
    });
  }
}
```

- 노드 6개를 넘기면 좌표 배치가 무너진다. 그 이상은 mermaid 다이어그램이 낫다.
- 텍스트 노드는 `text-anchor="middle"` + `y + 5`(반지름과 무관하게 시각 중앙 보정).

## 8. 계산기 위젯 (입력 → 판정)

"우리 상황에 적용하면 어떤 값이 나오나"를 직접 넣어 보게 한다. 임계값 판정 문구가 핵심이다.

```js
calc: {
  title: '내 상황에 넣어 보기',
  mount(host) {
    host.innerHTML = `
      <div class="viz-ctrl" style="margin:0">
        <div class="viz-row"><label for="qps">초당 요청</label><input id="qps" type="range" min="10" max="5000" step="10" value="800"><output>800</output></div>
        <div class="viz-row"><label for="hr">예상 히트율</label><input id="hr" type="range" min="0" max="100" value="85"><output>85%</output></div>
      </div>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-top:16px">
        <div class="gauge" data-g style="width:104px;height:104px"><span data-gt style="width:80px;height:80px">–</span></div>
        <div style="flex:1;min-width:180px">
          <div class="viz-readout" style="margin:0">
            <div class="viz-stat"><b data-o="q">–</b><span>원본에 남는 QPS</span></div>
            <div class="viz-stat"><b data-o="s">–</b><span>절감</span></div>
          </div>
          <p class="viz-note" data-v style="margin:10px 0 0"></p>
        </div>
      </div>`;
    const VERDICT = [[90, 'ok', '캐시 효과가 뚜렷하다 — 도입 가치가 크다.'],
      [60, 'warn', '효과는 있으나 키 설계를 먼저 점검할 여지가 있다.'],
      [0, 'bad', '히트율이 낮다 — 캐시보다 쿼리·인덱스를 먼저 본다.']];
    function calc() {
      const qps = +host.querySelector('#qps').value, hr = +host.querySelector('#hr').value;
      const left = Math.round(qps * (1 - hr / 100));
      host.querySelector('[data-o="q"]').textContent = left.toLocaleString();
      host.querySelector('[data-o="s"]').textContent = hr + '%';
      host.querySelector('[data-g]').style.setProperty('--v', hr);
      host.querySelector('[data-gt]').textContent = hr + '%';
      const [, tone, txt] = VERDICT.find(([th]) => hr >= th);
      const c = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)' }[tone];
      host.querySelector('[data-g]').style.setProperty('--accent', c);
      host.querySelector('[data-v]').innerHTML = `<b style="color:${c}">${txt}</b>`;
    }
    host.querySelectorAll('input').forEach((i) => i.addEventListener('input', () => {
      i.parentElement.querySelector('output').textContent = i.value + (i.id === 'hr' ? '%' : ''); calc();
    }));
    calc();
  }
}
```

- 판정 문구는 **행동 지침**으로 쓴다("좋음/나쁨"이 아니라 "무엇을 먼저 보라").
- 임계값은 문서 본문에서 근거를 밝힌 값만 쓴다. 근거 없는 기준선은 만들지 않는다.

---

## 새 위젯을 만들 때 체크리스트

1. 이 위젯이 없으면 이해가 정말 어려운가? (장식용 시각화는 넣지 않는다)
2. 조작 3개 이하, 첫 화면부터 의미 있는 상태인가?
3. 색을 `--accent`/`--ok`/`--bad`/`--ink-sub` 변수로만 썼는가? (하드코딩하면 다크 모드에서 깨진다)
4. canvas면 `devicePixelRatio` 보정 + `resize`/`ex:theme` 재렌더가 있는가?
5. `setInterval`을 썼다면 정지 경로가 있는가?
6. 모바일 폭(390px)에서 컨트롤이 겹치지 않는가? (`.viz-row`의 `flex:1 1 200px` 유지)
7. 위젯이 열린 뒤 비동기로 커져도 되는가? (패널은 높이 고정이 없으므로 그대로 늘어난다)
