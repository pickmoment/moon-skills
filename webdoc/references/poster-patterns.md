# 아키타입 A — 감성 세로 스크롤 포스터 패턴

## 핵심 아이디어

**스크롤 = 시간의 흐름.** 페이지 전체가 하나의 감정 서사다.
배경 그라디언트가 서사의 감정 아크를 표현하고(아래 "감정 아크 변형"에서 콘텐츠에 맞는 아크를 고른다),
씬들이 순서대로 페이드인되며, 마지막에 정보 존 + CTA로 착지한다.

## 페이지 골격 (씬 시퀀스)

```
[0]   표지        — 감성 카피 + 애니메이션 SVG + 브랜드 워드마크 (min-height 92vh)
[1~n] 서사 씬     — 브릿지(텍스트만) ↔ 비주얼 컷(이미지+캡션) 교차 반복
[전환] 톤 전환 씬  — 감정의 변곡점. 배경색이 여기서부터 밝아짐 (id로 마킹)
[m]   메인 카피    — 캠페인의 핵심 메시지 (형광펜 하이라이트)
[m+1] 워드마크 카드 — 네이비 카드에 타이틀 + 기간
[m+2] 정보 존     — 흰 카드 나열 (기간/자격/방법/기준/시상/접수)
[m+3] CTA        — 그라디언트 카드 + QR + 기간 pill
      footer
```

`section{max-width:560px;margin:0 auto}` — 모바일 폭 기준.
PC 보정: `@media(min-width:1000px)`에서 씬 700px, 정보 존만 1060px 2열 grid.

## 폰트

```html
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
```
- 본문/정보: Noto Sans KR
- **감성 카피는 `.serif`** — 이 세리프 전환이 톤의 핵심. 기본 Gowun Batang, 아크에 따라 교체:
  Hahmlet(`family=Hahmlet:wght@400;600;800` — 현대적·구조적), Noto Serif KR(`family=Noto+Serif+KR:wght@500;700` — 중립적·정통)
- 카피 크기: 1.333 디스플레이 스케일(SKILL.md 타이포 절) 기준 — `.big` clamp(26px,7.4vw,38px) / `.mid` clamp(20px,5.6vw,27px), line-height 1.6~1.75
- 세리프 카피에 letter-spacing 양수 금지, weight 900 금지 (Gowun Batang은 700까지)

## 감정 아크 변형 — 콘텐츠의 감정 곡선에 맞게 선택

배경 그라디언트 서사·paintSky 구조·씬 시퀀스는 동일 — 바뀌는 것은 색 stop, 세리프, 카피 톤뿐.
**항상 밤→아침으로 수렴하지 말 것.** 선택 이유를 구조 제안에 한 줄 남긴다.

### 아크 1 · 밤 → 새벽 → 아침 (기본)

> 선택 기준: 미련·후회에서 도전·행동으로 — 공모전, 도전 캠페인, 재도약 메시지.

세리프: Gowun Batang. 아래 "배경 그라디언트 서사"의 stop 코드가 이 아크의 예시다.

```css
:root{
  --moon:#F3ECDC;   /* 어두운 배경 위 본문 (달빛 크림) */
  --posco:#05507D;  /* 브랜드 기준색 */
  --sky:#00A5E5;    /* 밝은 강조 */
  --amber:#F5C46B;  /* 감정 강조 (별/따뜻함) */
  --paper:#FFFFFF; --ink:#1C2733; --soft:#6B7A8C;
}
```

### 아크 2 · 백지 → 잉크 (모노톤 갤러리)

> 선택 기준: 시작·기록·아카이빙 — "빈 종이가 채워지는" 서사. 전시·초대장, 연간 회고, 기록 캠페인.

세리프: **Hahmlet**. 강조는 낙관(도장) 레드 단 1색.
```css
:root{
  --paper-0:#FAFAF7;  /* 표지 — 백지 */
  --paper-1:#EFEDE8;  /* 서사 중반 — 종이 그림자 */
  --ink:#17181A;      /* 피날레 잉크 블록 */
  --vermilion:#D6482B; /* 낙관 레드 — 유일한 강조색 */
  --soft:#75726B;
}
```
- 그라디언트: 밝음→밝음을 유지하다 **메인 카피 직전 씬에서 잉크 블랙으로 반전** — paintSky의 전환 stop을 표지가 아니라 피날레에 배치 (기본 아크의 역방향 활용)
- 비주얼 컷은 흑백(`filter:grayscale(1)`) + vermilion 캡션 포인트. 잉크 블록 위 텍스트는 `--paper-0`
- 정보 존은 다시 밝은 배경으로 복귀 — "기록이 끝나고 실무가 시작된다"는 리듬

### 아크 3 · 노을 → 밤의 여운 (선셋)

> 선택 기준: 마무리·감사·회고 — 뜨거웠던 시간이 저물고 여운이 남는 서사. 시즌 마감 인사, 수상작 발표, 감사 메시지.

세리프: Gowun Batang 또는 Noto Serif KR.
```css
:root{
  --glow:#FFD9A0;   /* 석양 크림 — 어두운 배경 위 본문 */
  --coral:#E4694A;  /* 감정 강조 (남은 열기) */
  --plum:#472B4E;   /* 전환 구간 */
  --night:#241A38;  /* 피날레 */
  --paper:#FFF9F2; --ink:#2B1E33; --soft:#8A7A90;
}
```
- 그라디언트: `#F4A261 → #C75146 → #6D3B5E → #241A38` — 위가 밝고 아래로 깊어지는 **역방향 아크** (기본 아크와 반대)
- 정보 존은 어두운 배경 위 밝은 카드 대비로 해결 (밝은 존 전환 없음) — 카드 그림자를 `rgba(0,0,0,.5)`로 강화
- 표지 SVG 메타포도 아크에 맞게: 지는 해, 긴 그림자, 남는 불씨·잔광

## 배경 그라디언트 서사 (시그니처 기법 — stop 색은 아크 1 예시, 선택한 아크의 색으로 교체)

body에 세로 linear-gradient로 감정 아크를 깔되, **JS가 실제 섹션 위치로 stop을 재계산**한다:

```js
function paintSky(){
  const H=document.body.scrollHeight;
  const dawn=document.getElementById('dawn-start');   // 전환 시작 씬
  const light=document.getElementById('light-start'); // 밝음 시작 씬
  if(!dawn||!light||!H)return;
  const d0=dawn.offsetTop/H*100;
  const l0=light.offsetTop/H*100;
  const l1=(light.offsetTop+window.innerHeight*.28)/H*100;
  document.body.style.background=`linear-gradient(180deg,
    #0A1422 0%, #0E1B30 ${Math.max(d0-15,8)}%, #16273F ${d0}%,
    #22344F ${l0-4}%, #33465F ${l0}%,
    #C9D9E4 ${l1}%, #F2F6F9 ${Math.min(l1+8,96)}%, #F2F6F9 100%)`;
}
window.addEventListener('load',paintSky);
window.addEventListener('resize',paintSky);
setTimeout(paintSky,600); setTimeout(paintSky,2000); // 폰트/이미지 로딩 후 재계산
```
CSS에는 근사 그라디언트를 미리 깔아 JS 실패에 대비한다.

## 씬 페이드인 (failsafe 필수)

```css
.scene{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;
  padding:4.5vh 28px;opacity:0;transform:translateY(24px);transition:opacity 1s ease,transform 1s ease}
.scene.bridge{min-height:34vh}      /* 텍스트만 있는 브릿지 씬 */
.scene.on{opacity:1;transform:none}
@keyframes failsafe{to{opacity:1;transform:none}}
.scene{animation:failsafe .8s ease 3s forwards}   /* JS 실패 시 3초 후 강제 표시 */
```
```js
const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('on');})},{threshold:.3});
document.querySelectorAll('.scene').forEach(s=>io.observe(s));
```

## 비주얼 컷 (이미지 + 시네마틱 캡션)

```html
<div class="vwrap">
  <img src="...">  <!-- webp/png, base64 임베드 가능. 없으면 placeholder -->
  <div class="vcap serif">캡션 — 독백체 한두 줄</div>
</div>
```
`.vwrap`: radius 20px, `box-shadow:0 18px 60px rgba(0,0,0,.45)`, 검은 배경.
`.vcap`: 하단 absolute, `linear-gradient(180deg,transparent,rgba(4,10,18,.88))` 위에 세리프 크림색 + text-shadow.
캡션은 자막처럼 — 독백·회상체 ("중단됐던 그 소재연구, 지금이면 대박인데..").

## 애니메이션 SVG 스토리텔링 (표지)

콘텐츠 메타포를 SVG 한 장으로 (예: "남들이 보는 길=직선 vs 내가 걸어온 길=굽은 궤적 + 목표 별").
기법:
- 별 반짝임: `@keyframes tw{0%,100%{opacity:.2}50%{opacity:.85}}` + nth-child로 delay 분산
- 선 그리기: `stroke-dasharray:1500;stroke-dashoffset:1500` → `animation:draw 5s forwards`
- 노드/라벨 순차 등장: `.n1{animation-delay:2.3s}` ... 스토리 순서대로 delay 배치
- 최종 목표: glow + pulse 무한 반복

## 텍스트 강조 장치

```css
.marker{background:linear-gradient(transparent 58%, #FFE193 58%, #FFE193 92%, transparent 92%);padding:0 6px}  /* 형광펜 */
.remember{color:var(--posco);background:linear-gradient(transparent 62%, rgba(0,165,229,.22) 62%, rgba(0,165,229,.22) 94%, transparent 94%)}
.accent{color:var(--sky)} .amber{color:var(--amber)}
.finstar{color:#F5C46B;letter-spacing:.4em}  /* ✦ 구분 별 */
```

## 정보 존 (어두운 서사 → 밝은 실무 정보)

```html
<section class="info">   <!-- 항상 보임: opacity:1, 애니메이션 없음 -->
  <div class="card"><span class="tag">응모 기간</span><h3>...</h3><p>...</p><p class="note">※ ...</p></div>
  ...
  <div class="cta">...</div>
  <footer>...</footer>
</section>
```
- `.card`: 흰 배경, radius 18, `box-shadow:0 6px 24px rgba(브랜드색,.08)`
- `.tag`: 브랜드색 pill (흰 글자)
- `.steps`: 2열 grid — `<b>01 라벨</b><span>설명</span>`
- `.crit`: 기준 키워드 pill 나열 (soft 배경 + 브랜드색 글자)
- `.prz`: 시상 행 — 이모지 아이콘 + 제목 + 설명, 행 사이 헤어라인
- `.cta`: 브랜드색 그라디언트 카드 — 세리프 헤드카피 + sub + QR 자리(132px 흰 박스) + 기간 pill
- PC에서 정보 존만 2열: `section.info{max-width:1060px;display:grid;grid-template-columns:1fr 1fr}`, cta/footer는 `grid-column:1/-1`

## 워드마크 카드

```css
.wm-card{border-radius:24px;text-align:center;padding:52px 28px 46px;
  background:radial-gradient(120% 90% at 50% -20%, rgba(밝은색,.28), transparent 55%),
             linear-gradient(160deg,#073B5C 0%,#05507D 55%,#042A44 100%);
  box-shadow:0 24px 70px rgba(5,80,125,.35)}
```
구성: ✦ ✦ ✦ 별 → 타이틀(900, clamp 34~52px, 흰색) → 언더라인 바(54×3px) → 부제(letterspaced) → 기간(amber).

## 카피 작성 원칙

- 씬 하나 = 문장 하나. 줄바꿈(`<br>`)으로 호흡 제어
- 서사 구간은 독백/시적 반말·명사형 종결, 정보 존부터 존댓말 전환
- 감정 단어 하나만 `.amber`/`.accent`로 강조
- 반전 구조: 어두운 감정(미련·후회) → 재해석(그것도 도전) → 행동 촉구(CTA)
- CTA 헤드는 캠페인 슬로건의 변주 ("제출도, 도전이다.")
