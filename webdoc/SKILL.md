---
name: webdoc
description: 콘텐츠(회의록, 보고서, 캠페인 기획, 공지, 가이드, 지표 분석, 주제)를 프리미엄 단일 HTML 페이지로 변환한다. 네 가지 아키타입 지원 — (A) 감성 세로 스크롤 포스터: 서사형 배경 그라디언트(감정 아크 변형 3종), 세리프 감성 카피, SVG 애니메이션. (B) 프리미엄 보고서/회의록 원페이지: 무드 변형 4종(네이비 코퍼레이트·미니멀 모노라인·웜 에디토리얼·볼드 컬러블록), sticky TOC, 카운트업 스탯, 탭·아코디언·타임라인. (C) 탭 기반 가이드 문서: 840px doc 카드, hash 딥링크 탭. (D) 데이터 리포트: B 골격 + 인라인 SVG 차트(막대·추이·도넛·헬스맵). 사용자가 /webdoc을 입력하거나 "포스터 만들어줘", "보고서 페이지로 만들어줘", "이 회의록을 HTML로", "가이드 문서로 만들어줘", "지표 리포트 페이지로" 요청 시 사용.
---

# webdoc — 프리미엄 단일 HTML 콘텐츠 생성

콘텐츠를 **자기완결형(self-contained) 단일 HTML 파일**로 변환한다.
외부 JS 라이브러리 없음. 폰트만 CDN. 나머지는 전부 인라인 CSS/JS.

## 0. 아키타입 결정

입력 콘텐츠의 성격으로 판단하고, 애매하면 사용자에게 한 번만 묻는다.

| 아키타입 | 콘텐츠 | 타깃·폭 | 구조 | 기본 무드·폰트 | 상세 |
|---|---|---|---|---|---|
| **A. 감성 스크롤 포스터** | 캠페인, 공모전, 초대장, 브랜딩, 감성 메시지 | 모바일 우선 560px (PC 보정 700px) | 씬(scene) 서사: 표지→감성 카피→비주얼 컷→전환→정보 존→CTA | 감정 아크 3종 중 선택. 기본: 밤→아침 + Noto Sans KR + Gowun Batang | `references/poster-patterns.md` |
| **B. 프리미엄 보고서 원페이지** | 회의록, 과제 보고, 브리핑, 분석, 현황 정리 | 데스크톱 우선 1040px (모바일 대응) | 히어로→sticky TOC→번호 섹션(00~04)→푸터 | 무드 4종 중 선택. 기본: 네이비 코퍼레이트 + Pretendard + Space Grotesk | `references/report-patterns.md` |
| **C. 탭 가이드 문서** | 온보딩, 매뉴얼, 정책·절차 안내, FAQ | 데스크톱 840px 백색 doc 카드 | 헤더 밴드→sticky 탭 바→탭 패널→푸터 | B 무드 상속 (차분한 무드 권장) | `references/guide-patterns.md` |
| **D. 데이터 리포트** | 지표 분석, 운영 현황, KPI, 모니터링 요약 | 데스크톱 1040px (B와 동일) | B 골격 + 인라인 SVG 차트 컴포넌트 | B 무드 상속 (차트 가독성 제약 추가) | `references/data-patterns.md` |

각 아키타입은 reference 파일에 **무드 변형(mood variant)** 을 갖는다 — 표의 "기본"은 여러 선택지 중 하나일 뿐이다. 아키타입 결정 직후 무드도 함께 고른다.
C는 B의 축소판(히어로→헤더 밴드, 섹션→탭 패널), D는 B의 확장판(차트 추가) — 둘 다 해당 reference와 함께 `report-patterns.md`를 기반으로 읽는다.
D 제작 시 차트 코드를 쓰기 전에 **dataviz 스킬**이 사용 가능하면 먼저 읽는다 (차트 형태·색 선택 기준).

## 1. 진행 절차

1. **콘텐츠 파악** — 입력(파일/대화/주제)을 전부 읽는다. 요약하지 말고 원문 기준으로 구조화한다. 추정으로 사실을 만들지 않는다 (없는 수치·인용 생성 금지).
2. **구조 제안** — 섹션 플랜을 5~8줄로 짧게 제시: 아키타입, **무드 변형(+선택 이유 한 줄)**, 섹션 목록, 트랙 색상 할당, 팔레트. 사용자가 "바로 만들어줘" 톤이면 생략하고 진행 (단 무드 선택 자체는 생략 불가 — 내부적으로라도 결정하고 시작).
3. **제작** — 아래 공통 DNA + 해당 references 패턴 파일을 따라 단일 HTML 작성. 파일명은 한국어 스네이크 허용 (`{주제}_{용도}.html`).
4. **자동 검수** — 결정적 항목은 grep으로 기계 확인 (자기 선언 금지):
   ```bash
   F=산출물.html
   for p in 'lang="ko"' 'name="viewport"' 'word-break:\s*keep-all' 'prefers-reduced-motion' 'failsafe' 'focus-visible'; do
     grep -qE "$p" "$F" && echo "OK   $p" || echo "MISS $p"
   done
   grep -qE '@media print' "$F" && echo "OK   @media print" || echo "MISS @media print (B·C·D 필수, A는 생략 가능)"
   grep -nE '<script[^>]+src=' "$F" && echo "MISS 외부 JS 존재" || echo "OK   외부 JS 없음"
   ```
   MISS가 있으면 수정 후 재실행. 전부 OK가 될 때까지 다음 단계로 가지 않는다.
5. **렌더링 검수** — agent-browser 스킬로 실제로 열어서 본다:
   - `file://` 로 열고 뷰포트 **390×844**(모바일) → 풀페이지 스크린샷, **1440×900**(데스크톱) → 동일
   - JS 평가로 가로 overflow 검사: `document.documentElement.scrollWidth > document.documentElement.clientWidth` 가 true면 원인 요소를 찾아 수정
   - 스크린샷에서 볼 것: 텍스트·카드 잘림/겹침, 어색한 줄바꿈(조사 홀로 남는 줄), 대비 부족, 히어로·차트·SVG 정상 렌더
   - 문제 발견 시 수정 → 재촬영. agent-browser를 쓸 수 없는 환경이면 그 사실을 보고에 명시한다
6. **결과 보고** — 체크리스트 최종 확인 + 스크린샷 검수 결과 요약.

## 2. 공통 디자인 DNA (전 아키타입 적용)

### 무드 선택 — 획일화 금지
- 각 아키타입은 reference 파일에 무드 변형 2~4종을 갖는다. 제작 전 반드시 하나를 고르고 이유를 한 줄 남긴다
- **매번 같은 팔레트/폰트로 수렴하지 말 것** — "딥 네이비 + Pretendard"는 기본값 중 하나일 뿐이다. 콘텐츠 톤이 무드를 결정한다: 공식·격식 → 네이비, 기술·담백 → 미니멀, 인사이트·따뜻함 → 웜, 캠페인·에너지 → 볼드
- 무드가 바뀌어도 **하드 제약은 불변**: 페이지 골격, 컴포넌트 이름, 접근성·인쇄·reduced-motion 요구사항, 단일 HTML·외부 JS 금지
- 조직 CI 색이 주어지면 선택한 무드의 "기준색" 슬롯에 CI를 넣는다 — 무드 자체를 버리지 않는다

### 문서 기본
- `<html lang="ko">`, viewport 메타, `word-break:keep-all` 필수
- `:root`에 CSS 변수 팔레트 — 각 색에 **의미 주석** (`--ember:#D14E1C; /* 도전 track */`)
- `*{box-sizing:border-box;margin:0;padding:0}`, `html{scroll-behavior:smooth}`
- `-webkit-font-smoothing:antialiased`, `letter-spacing:-0.01em ~ -0.03em`(타이트), `line-height:1.6+`(넉넉)

### 색상 체계 — "트랙 컬러"
콘텐츠의 주제/과제/축마다 색 하나를 배정하고 **모든 컴포넌트에 일관 적용**
(태그, 불릿, 스탯 숫자, 탭 테두리, 타임라인 점이 같은 트랙이면 같은 색).
- 진한 원색 + soft 배경색 쌍으로 정의: `--ember`/`--ember-soft`, `--teal`/`--teal-soft`
- 트랙 컬러의 **구체적 색값은 무드가 정한다** — 무드별 팔레트는 reference의 무드 변형 절 참조 (미니멀 무드는 트랙을 색 대신 mono 라벨·번호로 구분)
- 조직 CI가 있으면 CI 색을 무드의 기준색 슬롯에 (POSCO Blue `#005386`, deep navy `#08293D` 등). CI 색은 주석에 출처 명시
- 배경은 무드의 종이색(`--paper`), 카드는 surface색 + `1px solid var(--line)` + radius 12~24px

### 타이포 — 타입 스케일
크기는 모듈러 스케일에서만 고른다. 스케일에 없는 임의 px 금지.
- 문서형(B·C·D): base 16px × **1.25** → `13 / 16 / 20 / 25 / 31 / 39 / 49`
- 디스플레이형(A·히어로 h1): base 17px × **1.333** → `17 / 23 / 30 / 40 / 54 / 72`
- `clamp()` 산출 논리: max = 스케일 값, min = 스케일 1~2단계 아래, 중간 vw 계수 ≈ max ÷ 타깃 폭 × 100
  (예: 1040px 문서 h1 49px → `clamp(31px, 4.7vw, 49px)`, 히어로 54px → `clamp(30px, 6vw, 54px)`)
- 16px 이하 본문·라벨은 clamp 없이 고정값
- 제목: `font-weight:800~900`(세리프 헤드라인은 700까지) + `letter-spacing:-0.03em`

### 타이포 — 폰트 페어링 (무드와 짝)
| 세트 | 본문 | 디스플레이/세리프 | mono(숫자·킥커) | 어울리는 무드 |
|---|---|---|---|---|
| 1 기본 | Pretendard | — | Space Grotesk | 네이비 코퍼레이트, 볼드 컬러블록 |
| 2 플레인 | IBM Plex Sans KR | — | IBM Plex Mono | 미니멀 모노라인 |
| 3 에디토리얼 | Pretendard | Noto Serif KR (헤드라인) | JetBrains Mono | 웜 에디토리얼 |
| 4 감성 | Noto Sans KR | Gowun Batang 또는 Hahmlet | — | 포스터(A) 감정 아크 |

전부 구글 폰트/jsDelivr CDN 로드 가능 (로드 태그는 각 reference 참조). 한 문서에 서체 3종(본문+디스플레이+mono) 초과 금지.
**숫자·킥커·태그·라벨은 전부 mono 폰트** + `letter-spacing:.1~.22em` + `text-transform:uppercase`.

### 타이포 — 한글 조판 디테일
- **행간**: 한글은 어센더·디센더 구분 없이 전각을 꽉 채워 라틴보다 행이 빽빽해 보인다 → 본문 `line-height:1.65~1.8` (라틴 관행 1.5로 줄이지 말 것). uppercase mono 라벨은 1.3~1.4
- **자간**: 한글 본문에 양수 letter-spacing 금지 — 낱글자로 흩어져 조판이 무너진다. 허용 범위 `-0.02em ~ 0`. 넓은 자간(`.1em+`)은 라틴 uppercase 라벨 전용
- **혼용 보정**: 라틴 mono 숫자·영문이 한글 옆에서 작아 보이면 `font-size:1.02~1.05em`, baseline이 뜨면 `vertical-align:-0.02em`으로 보정
- **keep-all의 한계**: 긴 합성어·URL·영문 토큰이 한 덩어리로 넘쳐 가로 overflow를 만든다 → `word-break:keep-all`에 `overflow-wrap:break-word`를 반드시 병기. 제목의 조사 고아("…에서<개행>는")는 `<br>` 수동 제어 + `text-wrap:balance` 병용

### 타이포 — 숫자 조판
- 표·스탯·카운트업 숫자는 `font-variant-numeric:tabular-nums` — 자릿수 세로 정렬 + 카운트업 중 너비 흔들림 방지
- 큰 숫자 + 단위: 단위(원/건/%/명)는 숫자의 **45~55% 크기 + muted 색** — `1,240<span class="unit">건</span>`. 단위가 숫자와 같은 크기·색이면 실패
- 증감 표기는 부호·단위까지 mono로 통일 (`▲ +12%`)

### 타이포 — 수직 리듬
- spacing도 토큰만 사용: `8 / 16 / 24 / 40 / 64 / 96` — 임의 px 금지
- 섹션 padding 64~96px, sec-head → 첫 컴포넌트 40px
- 헤딩은 **위 여백 : 아래 여백 = 2:1** — 헤딩이 자기 아래 내용에 붙어 보여야 한다
- 카드 내부 padding(24~28px)과 카드 사이 gap(16~20px)의 밀도 역전 금지

### 타이포 — 강조 위계 (우선순위 순)
1. **weight** — 본문 강조의 기본. `<strong>` 700 + 진한 텍스트색. 문단당 1~2회
2. **색** — weight로 부족할 때만 트랙컬러. 문단당 1회, 그 트랙의 색만
3. **크기** — 문장 단위 승격(리드·대표 인용)에만. 단어 단위 크기 강조 금지
4. **서체 전환** — serif(감성·인용)/mono(데이터·라벨)는 "역할"에 고정. 임의 강조용 전환 금지

한 요소에 강조 장치 2개 초과 중첩 금지 (색+굵기까지). 형광펜 하이라이트는 포스터(A) 전용.
카피 톤: 발표문·보도자료체 존댓말. 감성 포스터는 시적 단문 + 줄바꿈 리듬.

### 모션 (필수 3종 안전장치 포함)
- **reveal-on-scroll**: IntersectionObserver로 `.reveal → .in` (opacity + translateY 22px, cubic-bezier(.2,.7,.2,1))
- **failsafe**: JS 실패 대비 `animation:failsafe .8s ease 3s forwards` 로 3초 후 강제 표시
- **reduced-motion**: `@media(prefers-reduced-motion:reduce)`에서 전 애니메이션 무효화
- 애니메이션은 CSS transition/keyframes + IntersectionObserver 트리거만. 스크롤 이벤트 핸들러로 매 프레임 계산 금지

### 이미지
- 로고·QR는 자리표시자(placeholder div)로 두고 위치만 잡는다 — 사용자가 base64로 교체 가능함을 안내
- 실제 이미지를 받으면 base64 data URI로 임베드 (자기완결성 유지)

## 3. 검수 체크리스트

- [ ] 단일 파일, 외부 의존은 폰트 CDN뿐
- [ ] **무드 변형을 명시적으로 선택**했고 팔레트·폰트가 그 무드와 일치 — 콘텐츠 톤과 무관하게 기본 네이비로 수렴하지 않음
- [ ] 모바일(390px)·데스크톱(1440px) **스크린샷 검수 통과** — 가로 overflow 없음, 잘림·겹침 없음
- [ ] reveal failsafe + prefers-reduced-motion 존재
- [ ] 트랙 컬러가 전 컴포넌트에 일관 적용, 크기·여백이 타입 스케일/spacing 토큰에서만 나옴
- [ ] **접근성**: 탭·아코디언에 role/aria-expanded/aria-controls + 방향키·Enter 조작, `:focus-visible` 스타일 존재
- [ ] **대비**: 본문·13px 이하 텍스트는 4.5:1 이상 — `--muted-2`급 연회색은 uppercase mono 장식 라벨 전용
- [ ] **`@media print`** (B·C·D 필수): reveal 강제 표시, 아코디언·탭 패널 전체 펼침, sticky 해제 (`report-patterns.md` 인쇄 섹션)
- [ ] 원문에 없는 수치·인용·사실 없음. 푸터에 입력 파일명, 원문 파일명, 참고 문서 목록을 나열하지 않음. 필요한 경우에만 내용상 disclaimer를 짧게 표기 ("※ 본문의 예시는 이해를 돕기 위한 가상의 사례입니다.")
- [ ] `word-break:keep-all` 적용, 한국어 조사 어색한 줄바꿈 없음 (필요 시 `<br>` 수동 제어)
- [ ] 인터랙션(탭/아코디언/카운트업)이 콘텐츠에 실제 필요한 것만 — 장식용 남발 금지
- [ ] 차트(D): 인라인 SVG + `aria-label`, 축·단위 표기, 막대 y축 0 시작, 원문 수치 그대로
