# 아키타입 C — 탭 기반 가이드 문서 패턴

B의 축소판: 히어로 → 헤더 밴드, 번호 섹션 → 탭 패널. 온보딩·매뉴얼·정책/절차 안내·FAQ용.
팔레트·폰트·reveal·접근성·인쇄는 `report-patterns.md`를 그대로 따르고, 이 파일은 차이점만 기술한다.

## 무드 (B의 무드 변형 4종 상속 + 가이드 제약)

가이드는 "반복해서 참조하는 차분한 문서"다 — 무드 선택에 다음 제약을 얹는다:
- 기본 권장: **무드 1(네이비)** 또는 **무드 2(미니멀)** — 매뉴얼·정책은 조용할수록 좋다
- 무드 3(웜)은 온보딩·컬처 가이드처럼 환영 톤이 필요할 때만
- 무드 4(컬러블록)는 **헤더 밴드에만** 허용 — 어떤 무드든 doc 카드 본문·탭 패널은 밝은 surface 유지, 풀블리드 컬러 섹션 금지
- 탭 활성 pill 색 = 선택한 무드의 기준색. 무드 2에서는 pill 배경 대신 검정 텍스트 + 2px 밑줄형으로 대체 가능
- callout 의미색(info/warn/danger)은 무드와 무관하게 유지 — 경고색을 무드 팔레트로 갈아입히지 않는다
- 무드 2 선택 시 헤더 밴드도 흰 배경 + 상하 헤어라인 + 큰 h1로 대체 (네이비 밴드 없음)

## 페이지 골격

```
body (--paper 배경)
  <div class="doc">          840px 백색 카드
    <header class="band">    네이비 헤더 밴드 (카드 상단)
    <nav class="tabbar">     sticky 탭 바
    <main>
      <section role="tabpanel"> × 3~6
    <footer class="doc-foot">
```

```css
.doc{max-width:840px;margin:40px auto;background:var(--surface);border-radius:20px;
  box-shadow:0 20px 60px rgba(8,41,61,.10);overflow:hidden}
@media(max-width:640px){.doc{margin:0;border-radius:0}}   /* 모바일 풀블리드 */
```
`overflow:hidden`이 sticky를 깨면 `.doc`에서 빼고 `.band`에 radius를 직접 준다.

## 헤더 밴드 (히어로의 압축판)

min-height 없음, `padding:44px 40px`. 구성 (위→아래):
1. 로고 자리 (height 30px)
2. eyebrow — mono 12px `.2em` uppercase, `팀 · 문서종류 · 상태`
3. `<h1>` — clamp(26px,4.5vw,40px) weight 800, 핵심 구절만 `.accent` 텍스트 그라디언트
4. 한 줄 설명 (max-width 560px)
5. meta — mono key:value (대상 / 버전 / 최종수정 / 문의)

배경은 `--ink` + seam radial **1개만** — 가이드는 차분하게, 히어로처럼 화려하지 않게.

## sticky 탭 바

```css
.tabbar{position:sticky;top:0;z-index:30;display:flex;gap:4px;padding:10px 24px;overflow-x:auto;
  background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.tabbar [role=tab]{flex-shrink:0;font-size:13.5px;font-weight:600;color:var(--muted);
  padding:9px 16px;border-radius:100px;border:1px solid transparent;background:none;cursor:pointer}
.tabbar [role=tab][aria-selected=true]{color:var(--steel);background:var(--steel-soft);border-color:var(--steel)}
.tabbar [role=tab] .n{font-family:var(--mono);font-size:11px;margin-right:6px}
```
- role/aria/roving tabindex/방향키는 `report-patterns.md` 접근성 섹션 그대로
- **URL hash 딥링크** (가이드는 "이 탭 봐" 공유가 잦다):
```js
function activate(id,push){ /* aria-selected/tabindex/panel 표시 갱신 */
  if(push)history.replaceState(null,'','#'+id);}
addEventListener('DOMContentLoaded',()=>{
  const t=location.hash&&document.querySelector(`[aria-controls="${location.hash.slice(1)}"]`);
  if(t)t.click();});
```
패널 id는 한국어 슬러그 허용 (`#설치`, `#권한신청`).

## 탭 패널 = 문서 섹션

`padding:36px 40px` (모바일 28px 20px). 내부는 doc 톤:
- h2 22px/800 → h3 16.5px/700 계층, 본문 15px `line-height:1.75`
- 패널 전환은 display 토글 + 짧은 fade (`animation:fadein .35s ease`) — reveal 관찰 대상 아님
- 순차 서사(1장→2장)면 탭 대신 그냥 세로 섹션으로 — 탭은 병렬 주제일 때만 (B와 같은 원칙)

## 컴포넌트 (가이드 특화 — B 카탈로그에 추가)

| 컴포넌트 | 용도 | 핵심 스펙 |
|---|---|---|
| **callout** | 안내/주의/위험 | `border-left:3px` + soft 배경 + radius 10. info=steel, warn=`#B7791F`/`#FBF3E4`, danger=ember. 첫 줄에 mono 라벨 (`NOTE` `주의` `금지`) |
| **step list** | 순서 절차 | B의 steps 그대로 (48px mono 번호 컬럼) |
| **kbd / code** | 키·명령·경로·값 | `background:var(--surface-2);border:1px solid var(--line);border-radius:6px;font:13px var(--mono);padding:2px 7px`. 여러 줄이면 pre 블록 (배경 `--ink`, 크림색 글자) |
| **표** | 옵션·권한 매트릭스 | th는 mono 11px uppercase muted, 행 사이 헤어라인, 첫 열 `font-weight:700`. 숫자 열 우측 정렬 |
| **FAQ 아코디언** | 질문 모음 | B 아코디언 스펙 + Q 굵게, A 안에 callout 재사용 가능 |
| **버전 배지** | 문서 이력 | `.doc-foot`에 mono `v1.2 · 2026-07-05 · 변경: …` |

## 푸터 (.doc-foot)

`--surface-2` 배경 (네이비 아님 — doc 카드 안이므로 가볍게), 가운데 정렬:
문서 정식 명칭 `<b>` → 담당·문의 → 버전 배지 → 필요한 경우에만 disclaimer `.note`.
입력 파일명, 원문 파일명, 참고 문서 목록은 푸터에 나열하지 않는다.

## 인쇄

`report-patterns.md` 인쇄 블록 그대로 — 탭 문서의 인쇄 = **전체 펼침**이 핵심.
추가: `.band{-webkit-print-color-adjust:exact;print-color-adjust:exact}`, `.doc{box-shadow:none;max-width:none;margin:0}`.
