# 아키타입 B — 프리미엄 보고서/회의록 원페이지 패턴

## 페이지 골격 (순서 고정)

```
<header class="hero">   히어로 (배경·처리는 선택한 무드를 따름 — 아래 "무드 변형" 절)
<nav class="toc">       sticky 목차 (스크롤 시 활성 하이라이트)
<main>
  <section id="...">    번호 섹션 × 4~6개 (00 개요 → 01 본론 → ... → 마지막 후속조치/로드맵)
<footer>                네이비 푸터 + disclaimer
```

`main{max-width:1040px;margin:0 auto;padding:0 24px}`
`section{padding:72px 0;border-bottom:1px solid var(--line)}`

## 무드 변형 — 제작 전 하나를 고른다

콘텐츠 톤에 맞춰 선택하고 구조 제안에 이유를 한 줄 남긴다. **매번 무드 1로 수렴하지 말 것.**
골격·컴포넌트·인터랙션·접근성·인쇄는 4종 모두 동일 — 바뀌는 것은 팔레트·서체·히어로 처리뿐.
조직 CI 색이 있으면 선택한 무드의 기준색 슬롯에 넣는다 (주석에 출처 명시).
폰트 페어링 근거는 SKILL.md "타이포 — 폰트 페어링" 표 참조.
이 문서의 코드 예시에 나오는 트랙색 변수명(`--ember`/`--teal`/`--steel`)은 무드 1 기준 — 다른 무드에서는 그 무드의 트랙 변수(무드 2는 `--accent`, 무드 3은 `--wine`/`--moss`/`--ochre`, 무드 4는 `--cobalt`/`--coral`)로 치환한다. 구조·로직은 그대로.

### 무드 1 · 네이비 코퍼레이트 (기본)

> 선택 기준: 공식 보고·경영 브리핑·회의록 — 신뢰·격식이 최우선일 때.

폰트: Pretendard + Space Grotesk
```html
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
```
```css
--mono:'Space Grotesk',ui-monospace,monospace;
--sans:'Pretendard','Pretendard Variable',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
```
```css
:root{
  --ink:#08293D;        /* deep navy — 히어로/푸터 배경 */
  --paper:#EBEEF2;      /* 페이지 배경 */
  --surface:#FFFFFF;    /* 카드 */
  --surface-2:#F4F6F9;  /* 보조 카드 */
  --line:#D6DCE3; --line-soft:#E5E9EE;
  --text:#161B22; --muted:#5C6675; --muted-2:#828C9A;
  --ember:#D14E1C; --ember-soft:#FBEDE6;   /* 트랙 1 */
  --teal:#0C8079;  --teal-soft:#E2F1EF;    /* 트랙 2 */
  --steel:#005386; --steel-soft:#E6EEF5;   /* 거버넌스/최상위 */
  --radius:14px;
}
```

### 무드 2 · 미니멀 모노라인

> 선택 기준: 기술 문서·아키텍처 리뷰·엔지니어링 회고 — 색보다 내용, 타이포와 여백만으로 위계를 만들 때.

폰트: IBM Plex Sans KR + IBM Plex Mono
```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```
```css
:root{
  --ink:#111417;        /* 잉크 블랙 — 텍스트 기준색. 배경으로는 푸터에만 */
  --paper:#FFFFFF; --surface:#FFFFFF; --surface-2:#F6F7F8;
  --line:#E3E6EA; --line-soft:#EEF0F2;
  --text:#1A1D21; --muted:#5A6472; --muted-2:#8A929E;
  --accent:#0F62FE; --accent-soft:#EDF2FE;  /* 포인트 단 1색 */
  --radius:10px;
}
```
- 히어로: 배경도 흰색. 스케일 최상단의 거대한 h1 + 상하 헤어라인 + mono 메타만 — seam·그라디언트·상단 애니메이션 라인 없음
- 트랙 구분은 색 대신 **mono 라벨 + 번호**(`T1` `T2`). `--accent`는 페이지 전체 5회 이하
- sticky TOC: `rgba(255,255,255,.92)` + 하단 헤어라인, 활성 탭은 검정 2px 밑줄
- 카드 그림자 금지 — 1px 헤어라인만. 위계는 크기·굵기·여백으로
- 섹션 padding을 한 단계 승격(96px) — 여백 자체가 이 무드의 장식이다

### 무드 3 · 웜 에디토리얼

> 선택 기준: 인사이트 리포트·트렌드 분석·인터뷰/문화 콘텐츠 — 잡지처럼 읽히는 따뜻한 톤이 필요할 때.

폰트: Noto Serif KR(헤드라인) + Pretendard(본문) + JetBrains Mono
```html
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```
```css
:root{
  --ink:#2A211A;        /* 딥 브라운 — 히어로/푸터 */
  --paper:#F7F2E9;      /* 크림 */
  --surface:#FFFDF8; --surface-2:#F1EADD;
  --line:#E0D6C6; --line-soft:#EAE2D4;
  --text:#26201A; --muted:#6E6355; --muted-2:#988C7C;
  --wine:#8C2F39;  --wine-soft:#F4E4E4;    /* 트랙 1 */
  --moss:#4A5D3A;  --moss-soft:#E8ECE0;    /* 트랙 2 */
  --ochre:#B0762A; --ochre-soft:#F5EBD9;   /* 트랙 3 */
  --radius:16px;
}
```
- h1·h2·sec-title만 Noto Serif KR **700** (세리프에 900 금지 — 무게 대신 크기로 위계). 본문·리드는 Pretendard 유지
- 히어로 seam은 ochre 1개만 은은하게. thesis 인용도 세리프 정체로
- 스탯 숫자는 mono 유지 (세리프 숫자는 tabular 정렬이 무너진다)

### 무드 4 · 볼드 컬러블록

> 선택 기준: 캠페인 결과 보고·신규 제안·사내 이벤트 리캡 — 에너지와 설득이 목적일 때.

폰트: Pretendard(900까지 활용) + Space Grotesk (무드 1과 동일 로드)
```css
:root{
  --ink:#141220;
  --paper:#F4F3F7; --surface:#FFFFFF; --surface-2:#F0EFF5;
  --line:#DCDAE5; --line-soft:#E8E7EF;
  --text:#1B1926; --muted:#5E5A70; --muted-2:#8D89A0;
  --cobalt:#2431C9; --cobalt-soft:#E7E9FB;  /* 트랙 1 */
  --coral:#E8452E;  --coral-soft:#FCE8E4;   /* 트랙 2 */
  --lime:#9BE83B;   --lime-ink:#233308;     /* 강조 블록 전용 — 본문 텍스트색 금지 */
  --radius:18px;
}
```
- 섹션 1~2개만 트랙색 **풀블리드 배경**(흰/soft 텍스트)으로 승격 — 전 섹션 컬러블록 금지, 밝은 섹션과 교차 배치
- 컬러 배경 위 텍스트는 대비 4.5:1 확인, 그 위의 카드·차트는 반드시 흰 surface
- 히어로: `--ink` 대신 트랙색 딥 그라디언트 허용, h1 weight 900 + 스케일 한 단계 승격
- 컬러블록 섹션도 `-webkit-print-color-adjust:exact` 필요 (인쇄 블록에 추가)

## 히어로 구성 요소 (위→아래 순 — 무드 1 기준, 다른 무드는 해당 절의 조정사항 적용)

1. 애니메이션 상단 라인 3px — 트랙 색들을 잇는 gradient, `background-size:220% 100%` + 9s ease-in-out 무한 왕복
2. `hero__seam` — 좌·우·하단 radial-gradient 3개로 트랙 색 은은한 빛 번짐 (`rgba(트랙색,.18~.40)`)
3. 로고 자리 (height 38px, 모바일 30px)
4. `hero__eyebrow` — mono 12.5px `.22em` uppercase, `조직 · 프로그램 · 문서종류`를 `·`로 구분, 첫 단어만 트랙색 `<b>`
5. `<h1>` — `clamp(30px,6vw,58px)` weight 800, 핵심 구절 하나만 `<span class="accent">`에 텍스트 그라디언트 (`background-clip:text`)
6. `hero__thesis` — 대표 인용/한줄 논지, `border-left:2px solid var(--ember)`, max-width 660px
7. `hero__meta` — mono 소문자 key + 값 쌍 (일시/장소/참여/과제/후속)
8. `scrollcue` — mono 11px "SCROLL · …", `::before`에 폭이 늘었다 주는 라인 pulse

## sticky TOC

```css
nav.toc{position:sticky;top:0;z-index:40;background:rgba(8,41,61,.93);backdrop-filter:blur(10px)}
.toc a{color:#9aa5b3;font-size:13px;padding:14px;border-bottom:2px solid transparent}
.toc a.active{color:#fff;border-color:var(--ember)}
.toc a .n{font-family:var(--mono);font-size:11px}  /* 00 01 02 번호 */
```
활성화: IntersectionObserver `rootMargin:'-45% 0px -50% 0px'` 로 화면 중앙 섹션 감지.

## 섹션 헤더 (모든 섹션 공통)

```html
<div class="sec-head reveal">
  <div class="sec-kicker"><span class="num">01</span> 킥커 라벨 <span class="bar"></span></div>
  <h2 class="sec-title">섹션 제목 — 서술형·단정형</h2>
  <p class="sec-lead">2~3문장 리드. <strong>핵심어만 강조.</strong></p>
</div>
```
kicker: mono 12px `.2em` uppercase, num은 트랙색, bar는 `flex:1;height:1px;max-width:120px`.
섹션 제목은 명사나열이 아닌 **문장형 헤드라인** ("도전을 기록하고, 보고를 다시 짓다").

## 컴포넌트 카탈로그 (콘텐츠에 맞는 것만 골라 쓴다)

| 컴포넌트 | 용도 | 핵심 스펙 |
|---|---|---|
| **stat strip** | 핵심 수치 3~5개 | grid auto-fit minmax(150px,1fr), gap 1px로 헤어라인 분할, 숫자 mono clamp(30~42px) + `font-variant-numeric:tabular-nums` + `data-count` 카운트업, 단위는 숫자의 절반 크기 + muted 색(`<span class="unit">건</span>`), 트랙색 클래스 `.e .t .s` |
| **infobar** | 일시/장소/형식 등 메타 | stat strip과 같은 헤어라인 grid, mono 라벨 + 굵은 값 |
| **card** | 기본 서술 블록 | 흰 배경, 1px line, radius 14, padding 28. 상단에 `.tag`(soft 배경 pill) |
| **tabs + panels** | 병렬 과제 2~3개 | 탭 자체가 카드(tg: mono 라벨/tt: 제목/td: 부제), 활성 시 트랙색 border + `box-shadow:0 0 0 1px 트랙색` |
| **steps** | 번호 프레임워크 | grid-template-columns:48px 1fr, 번호는 mono 22px 트랙색 |
| **bench grid** | 벤치마킹 사례 | auto-fit minmax(220px,1fr), 회사명 + mono 국가 flag 라벨 |
| **timeviz** | 비중/구성 시각화 | flex 가로 막대, 세그먼트 `width:0`에서 `data-w`%로 1.1s 전환, 범례 |
| **pain (ranked)** | 우선순위 목록 | `.rank` = 흰 글자 트랙색 pill "1순위" |
| **accordion** | 강평·토론 주제별 정리 | +아이콘 CSS로 그림(::before/::after), max-height 트랜지션, 내부에 `.quote` |
| **quote** | 발언 인용 | `border-left:3px solid var(--steel)` + soft 배경, `.who`는 mono uppercase "— 화자" |
| **timeline** | 후속 조치 로드맵 | 좌측 세로선 + 트랙색 점, `.when` mono + h4 + p + `.owner` mono "OWNER · 팀" |
| **tag / pill** | 분류 라벨 | mono 11px, radius 100px, soft 배경 + 트랙색 글자 |

## 인터랙션 JS (검증된 스니펫 — 그대로 사용)

```js
// Reveal on scroll
const ro=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');ro.unobserve(e.target);}})},{threshold:0.12});
document.querySelectorAll('.reveal').forEach(el=>ro.observe(el));

// Count up (ease-out cubic)
const fmt=n=>n.toLocaleString('ko-KR');
const cu=new IntersectionObserver((es)=>{es.forEach(e=>{
  if(!e.isIntersecting)return;
  const el=e.target,end=+el.dataset.count,dur=1100,t0=performance.now();
  const tick=now=>{const p=Math.min((now-t0)/dur,1);el.textContent=fmt(Math.floor((1-Math.pow(1-p,3))*end));if(p<1)requestAnimationFrame(tick);else el.textContent=fmt(end);};
  requestAnimationFrame(tick);cu.unobserve(el);
})},{threshold:0.5});
document.querySelectorAll('[data-count]').forEach(el=>cu.observe(el));

// Tabs
tabs.forEach(t=>t.addEventListener('click',()=>{ /* 전체 off → 클릭한 것 on, data-tab ↔ data-panel 매칭 */ }));

// Accordion: b.style.maxHeight = open ? b.scrollHeight+'px' : 0
// 초기 open 항목은 requestAnimationFrame(()=>setOpen(true))

// TOC active: rootMargin '-45% 0px -50% 0px'
```

```css
.reveal{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
.reveal.in{opacity:1;transform:none}
```

## 접근성 (탭·아코디언 필수 스펙)

**탭** — roving tabindex + 방향키:
```html
<div class="tabs" role="tablist" aria-label="과제 선택">
  <button class="tab" role="tab" id="tab-a" aria-selected="true" aria-controls="panel-a">…</button>
  <button class="tab" role="tab" id="tab-b" aria-selected="false" aria-controls="panel-b" tabindex="-1">…</button>
</div>
<section role="tabpanel" id="panel-a" aria-labelledby="tab-a" data-print-title="01 · 과제명">…</section>
```
```js
tablist.addEventListener('keydown',e=>{
  const ts=[...tablist.querySelectorAll('[role=tab]')];
  let i=ts.indexOf(document.activeElement);
  if(e.key==='ArrowRight')i=(i+1)%ts.length;
  else if(e.key==='ArrowLeft')i=(i-1+ts.length)%ts.length;
  else if(e.key==='Home')i=0; else if(e.key==='End')i=ts.length-1; else return;
  e.preventDefault(); ts[i].focus(); ts[i].click();   // 포커스 이동 즉시 활성화
});
```
- click 핸들러에서 `aria-selected`와 `tabindex`(활성만 0, 나머지 -1)를 함께 갱신
- 탭은 반드시 `<button>` — div+click은 키보드 접근 불가라 금지

**아코디언**:
```html
<h3><button class="acc-btn" aria-expanded="false" aria-controls="acc-1">주제</button></h3>
<div class="acc-body" id="acc-1" role="region">…</div>
```
- 토글 시 `aria-expanded` 갱신. 헤더도 반드시 `<button>`

**공통**:
```css
:focus-visible{outline:2px solid var(--steel);outline-offset:2px;border-radius:4px}
```
- **대비 규칙**: 흰 배경 본문·13px 이하 텍스트는 `--muted`(#5C6675, 대비 ≈5.8:1)까지만.
  `--muted-2`(#828C9A, ≈3.4:1)는 uppercase mono 장식 라벨 전용 — 정보 전달 텍스트 금지.
  네이비 히어로 위 연한 글자도 동일 원칙 (#9aa5b3 이상 밝기).

## 인쇄 CSS (@media print — B·C·D 필수)

보고서는 PDF 저장·인쇄가 잦다. 이 블록이 없으면 reveal 미발동 요소가 통째로 빈 채 인쇄되고, 접힌 아코디언·비활성 탭 내용이 사라진다.

```css
@media print{
  @page{margin:14mm}
  body{background:#fff}
  .reveal{opacity:1!important;transform:none!important;transition:none!important}
  nav.toc,.scrollcue{display:none}
  .acc-body{max-height:none!important}
  .acc-btn{pointer-events:none}
  .tabs{display:none}                        /* 탭 바 숨기고 패널 전부 세로 출력 */
  [role=tabpanel]{display:block!important}
  [role=tabpanel]::before{content:attr(data-print-title);display:block;font-weight:800;font-size:15px;margin:24px 0 12px}
  .card,.quote,.stat,.tl-item{break-inside:avoid}
  .hero,footer{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
```
- 탭 패널마다 `data-print-title="01 · 제목"`을 달아 인쇄에서 섹션 제목 역할
- 카운트업 숫자는 HTML 초기 텍스트를 **최종값**으로 넣는다 (JS가 0부터 다시 셈) — JS 미실행 인쇄·노스크립트에서도 값이 보인다

## 푸터

`var(--ink)` 배경(선택한 무드의 기준색 — 무드 1 네이비/무드 3 딥브라운/무드 4 트랙 그라디언트, 무드 2는 흰 배경+상단 헤어라인), 가운데 정렬: 로고 자리 → `<b>` 문서 정식 명칭 → 대표 인용 한 줄 → 필요한 경우에만 `.note`(12px) disclaimer.

- 푸터에는 입력 파일명, 원문 파일명, 참고 문서 목록을 쓰지 않는다.
- 필요한 경우에만 내용상 disclaimer를 짧게 둔다: "※ 본문의 예시는 이해를 돕기 위한 가상의 사례입니다."
- 회의록처럼 발언 보정이 실제로 있었을 때만 보정 사실을 표기한다: "※ 일부 발언은 가독성을 위해 맥락에 맞게 보정되었습니다."

## 콘텐츠 작성 원칙

- 타입 스케일·한글 조판(keep-all 병기, 행간·자간)·숫자 조판·수직 리듬은 SKILL.md 타이포 절을 따른다
- 회의록이면: 발언을 주제별로 재구성 (시간순 X), 인용은 `.quote`로 분리하고 화자 명시
- 수치는 반드시 원문 근거. 스탯 스트립에 올릴 숫자가 4개 미만이면 스탯 스트립 생략
- 각 섹션 리드에서 "왜 이 섹션인가"를 한 문장으로
- 탭은 병렬 구조(과제 1/과제 2)일 때만. 순차 서사는 그냥 섹션으로
