# 아키타입 D — 데이터 리포트 패턴 (B 확장)

지표 분석·운영 현황·KPI·모니터링 요약용. **골격·팔레트·히어로·TOC·인터랙션·접근성·인쇄는 B(`report-patterns.md`)를 그대로 쓰고**, 이 파일은 차트 컴포넌트만 추가한다.
차트 코드를 쓰기 전에 dataviz 스킬이 사용 가능하면 먼저 읽는다.

## 무드 (B의 무드 변형 4종 상속 + 차트 가독성 제약)

- 차트는 무드와 무관하게 **흰/surface 카드 위에** — 크림 배경(무드 3)·컬러블록 배경(무드 4)에 차트를 직접 얹지 않는다
- 축·그리드·눈금은 항상 중립 회색(`--muted`/`--line-soft`) — 무드 팔레트로 물들이지 않는다
- 무드 2(미니멀): 차트도 "강조 1색 + 회색" 구도가 기본 — 다계열이 꼭 필요할 때만 색 추가, 그래도 부족하면 표로
- 무드 3(웜): 세리프는 figcaption의 h3까지만 — 축·값 라벨은 mono 유지
- 상태색(ok/warn/crit)과 증감색은 의미 고정 — 무드가 바뀌어도 갈아입히지 않는다

## 원칙

- 차트는 전부 **인라인 SVG** — 라이브러리 금지. 좌표는 제작 시 직접 계산해 하드코딩 (런타임 데이터 바인딩 없음)
- 수치·기간·단위는 원문 그대로. 축 라벨·단위 반드시 표기, **막대 y축은 0에서 시작**
- 차트 하나 = 메시지 하나. 제목은 "무엇을 보라"는 문장형 ("confirm 지연은 전 구간 30s 이내 유지")
- 색은 트랙 컬러 재사용. 계열 3개 초과면 표 전환을 검토
- 등장 애니메이션은 전부 reveal `.in` 클래스 트리거 — reduced-motion에서 자동 무효

## 차트 프레임 (공통 래퍼)

```html
<figure class="chart card reveal">
  <figcaption><span class="tag">TREND</span><h3>제목 — 문장형</h3><p class="sub">2026.06 · 단위: 건 · 출처: ops 리포트</p></figcaption>
  <svg viewBox="0 0 720 300" role="img" aria-label="차트 내용 한 문장 요약">…</svg>
  <ul class="legend">…</ul>
</figure>
```
```css
.chart svg{width:100%;height:auto;display:block}   /* viewBox만으로 반응형 */
.ax{font:11px var(--mono);fill:var(--muted)}       /* 축 라벨 */
.val{font:700 14px var(--mono);fill:var(--text)}   /* 값 라벨 */
.ax,.val{font-variant-numeric:tabular-nums}        /* 자릿수 정렬 */
.grid{stroke:var(--line-soft)}
```
`aria-label` 필수 — 결론을 문장으로 ("6월 주문 건수는 5개월 중 최고인 1,240건").

## 1. 막대 (기간·항목 비교)

```html
<svg viewBox="0 0 720 300">
  <g class="grid"><line x1="60" y1="70" x2="700" y2="70"/> …y눈금 4~5개…</g>
  <line x1="60" y1="250" x2="700" y2="250" stroke="var(--line)"/>
  <g class="bars">
    <g><rect x="90" y="120" width="48" height="130" rx="6" fill="var(--ember)"/>
       <text x="114" y="108" class="val" text-anchor="middle">1,240</text>
       <text x="114" y="272" class="ax" text-anchor="middle">4월</text></g>
    …
  </g>
</svg>
```
```css
.chart .bars rect{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);
  transition:transform .8s cubic-bezier(.2,.7,.2,1)}
.chart.in .bars rect{transform:scaleY(1)}
.chart .bars g:nth-child(2) rect{transition-delay:.08s}   /* 순차 등장 */
```
- 강조할 막대 하나만 진한 트랙색, 나머지는 `--line`급 회색 — 전부 원색 금지
- 그룹 막대는 2계열까지. 그 이상이면 추이 라인이나 표로

## 2. 추이 라인 (시계열)

```html
<polyline class="ln" pathLength="1" points="60,180 156,150 252,164 348,120 444,96"
  fill="none" stroke="var(--teal)" stroke-width="2.5" stroke-linejoin="round"/>
<circle cx="444" cy="96" r="5" fill="var(--teal)" stroke="#fff" stroke-width="2"/>
<text x="444" y="80" class="val" text-anchor="middle">98.7%</text>
```
```css
.chart .ln{stroke-dasharray:1;stroke-dashoffset:1}
.chart.in .ln{transition:stroke-dashoffset 1.4s ease .2s;stroke-dashoffset:0}
```
- `pathLength="1"` 트릭으로 dasharray 계산 불필요 (polyline에도 적용됨)
- 점은 변곡점·최종값만. **마지막 점 + mono 값 라벨**이 시그니처
- 계열 2개면 두 번째는 `stroke-dasharray:6 5` 점선 + 다른 트랙색
- 임계선(SLA 등)은 수평 점선 `stroke:var(--ember);stroke-dasharray:4 4` + 우측 끝 mono 라벨

## 3. 도넛 (구성비)

```html
<svg viewBox="0 0 220 220">
  <g transform="rotate(-90 110 110)">
    <circle class="seg" cx="110" cy="110" r="84" fill="none" stroke="var(--ember)" stroke-width="26"
      pathLength="100" stroke-dasharray="62 38" stroke-dashoffset="0"/>
    <circle class="seg" cx="110" cy="110" r="84" fill="none" stroke="var(--teal)" stroke-width="26"
      pathLength="100" stroke-dasharray="27 73" stroke-dashoffset="-62"/>
    <circle class="seg" cx="110" cy="110" r="84" fill="none" stroke="var(--line)" stroke-width="26"
      pathLength="100" stroke-dasharray="11 89" stroke-dashoffset="-89"/>
  </g>
  <text x="110" y="104" text-anchor="middle" style="font:800 34px var(--mono);fill:var(--text)">62%</text>
  <text x="110" y="128" text-anchor="middle" class="ax">TW 비중</text>
</svg>
```
- `pathLength="100"` → dasharray가 곧 퍼센트. 세그먼트 k의 offset = −(앞 세그먼트 합)
- 등장: `.chart .seg{stroke-dasharray:0 100}` → `.chart.in .seg{…최종값…}` transition (dasharray는 CSS 속성으로 지정해야 transition 가능하므로, 최종값을 CSS 쪽에 둔다)
- 세그먼트 **5개 초과 금지** — 넘으면 막대나 표로. 도넛 옆에 범례 필수 (색+라벨+정확값)

## 4. 상태 그리드 (서비스 헬스맵)

서비스 × 상태 매트릭스 — 운영 리포트 단골:
```html
<div class="health">  <!-- grid auto-fit minmax(150px,1fr), gap:1px, 배경 --line 헤어라인 분할 -->
  <div class="hcell ok"><b>lcp-pg-api</b><span>p99 1.2s</span><i>● 정상</i></div>
  <div class="hcell warn"><b>…</b><span>lag 4.2k</span><i>▲ 관찰</i></div>
  <div class="hcell crit"><b>…</b><span>5xx 0.8%</span><i>■ 이상</i></div>
</div>
```
- 상태색: ok=teal, warn=`#B7791F`, crit=ember — soft 배경 + `border-left:3px` 상태색
- `<i>`는 mono 11px 상태 라벨. **색+도형+텍스트 삼중 부호화** (색맹 대비, 색만으로 구분 금지)
- `<span>`은 mono 12px 핵심 지표 1개만 — 셀에 지표 나열 금지, 상세는 아래 표로

## 표 (차트보다 표가 맞을 때)

행 10개 이하의 원자료·정확값 대조는 표가 정답:
- th는 mono 11px uppercase muted, 행 사이 헤어라인
- 숫자 열은 **우측 정렬 + mono + `font-variant-numeric:tabular-nums`** (자릿수 비교가 목적)
- 이상치 셀만 `.warn`(soft 배경) — 정상 행에 색 입히지 않는다
- 전월 대비 등 증감은 `▲ +12%`(ember)/`▼ -3%`(teal) mono — 도메인상 증가가 나쁜 지표(에러율 등)면 색 반전
