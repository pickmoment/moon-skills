# explainer 커스터마이즈 가이드 (데이터 계약)

**로직·레이아웃·스타일은 `base-card.html` / `base-docs.html` / `base-steps.html`에 이미 전부 구현되어 있다.**
문서를 만들 때 HTML·CSS·JS를 새로 쓰지 않는다 — 템플릿을 복사한 뒤 파일 맨 위
`1. 설정 · 콘텐츠 · 시각화` 블록(= `CONFIG` / `SECTIONS` / `VIZ`)**만** 교체한다.

```bash
cp <스킬경로>/references/base-docs.html <작업디렉토리>/<주제-슬러그>-explainer.html
```

세 템플릿은 **같은 데이터 계약**을 쓴다. 즉 `CONFIG`/`SECTIONS`/`VIZ` 블록을 그대로 복사해
다른 base 파일에 붙이면 레이아웃만 바뀐 같은 문서가 된다. 사용자가 "다른 스타일로 보여줘"라고 하면
콘텐츠를 다시 쓰지 말고 데이터 블록만 옮긴다.

---

## 1. CONFIG

```js
const CONFIG = {
  title: '캐시(Cache)는 어떻게 동작하는가',       // 필수
  subtitle: '히트·미스부터 축출 정책·무효화까지',  // 부제 한 줄
  kicker: 'SYSTEM DESIGN',                     // 상단 라벨(mono·대문자). 분야·문서 성격을 짧게
  lead: '캐시는 **느린 것을 빠르게** 만드는 대신…', // 문서 서두 요약(markdown 1~3문장)
  stats: [{ v: '5', l: '섹션' }, { v: '13', l: '퀴즈 문항' }],  // 0~4개. 없으면 []
  quiz: 'inline',   // 'inline'(기본) | 'off' — off면 퀴즈 버튼·패널이 사라진다
  search: true,     // 검색창 표시 여부
  footer: '출처: …' // 푸터 한 줄 (출처·작성 맥락)
};
```

- `stats`의 숫자는 **실제 값과 일치해야 한다** (섹션 수, 퀴즈 문항 수 등). 불일치는 즉시 눈에 띈다.
- 진행 상태를 저장하지 않으므로 `id`는 필요 없다. 옛 문서에서 옮겨왔다면 `id`·`gate`는 지운다.

## 2. SECTIONS — 섹션 하나가 카드/단계 하나

```js
const SECTIONS = [{
  id: 'why',            // 필수. 영문 슬러그 (해시 딥링크 #why 에 쓰인다)
  num: '01',            // 선택. 생략하면 순서대로 01, 02 … 자동
  tag: '개념',           // 선택. 배지 (개념/동작/정책/함정/실무 처럼 성격 라벨)
  title: '캐시는 왜 필요한가',           // 필수
  summary: '**기본으로 보이는 요약.** …',  // 필수. markdown. 2~3문장 (400자 이내)
  keys: ['핵심 한 줄', '핵심 한 줄'],     // 선택. 2~4개. 요약 아래 회색 박스에 표시
  detail: `### 소제목 …`,                // 접히는 상세 (markdown, 템플릿 리터럴로 여러 줄)
  viz: 'hitrate',                       // 선택. VIZ의 키
  quiz: [ /* §3 */ ]                    // 선택
}];
```

역할 분담을 지키는 것이 이 문서 형식의 핵심이다.

| 필드 | 역할 | 분량 기준 |
|---|---|---|
| `summary` | **이것만 읽어도 요지가 남는다.** 결론부터 쓴다 | 2~3문장 |
| `keys` | 요약을 스캔 가능한 조각으로 분해 | 각 1줄, 2~4개 |
| `detail` | 근거·절차·표·코드·예외. 여기서 처음 등장하는 개념은 없어야 한다 | 소제목 2~4개 |
| `quiz` | summary·detail만 읽고 답할 수 있는 것만 출제 | 섹션당 2~3문항 |

- `summary`가 길어지면 섹션을 쪼갠다. 요약이 화면 한 덩어리를 넘기면 "요약 먼저" 구조가 무너진다.
- `detail`에 요약을 되풀이하지 않는다. 상세는 **요약이 참인 이유**를 다룬다.
- 섹션 수 권장: card 3~8개 · docs 6~20개 · steps 4~12개.

## 3. 퀴즈 계약

```js
quiz: [
  { type: 'choice', q: '질문', choices: ['A','B','C','D'], answer: 1, why: '해설' },
  { type: 'multi',  q: '모두 고르세요', choices: [...], answer: [1,2], why: '해설' },
  { type: 'short',  q: '한 단어로?', answer: '히트율', accept: ['hit rate','hitrate'], why: '해설' },
  { type: 'tf',     q: '…는 참이다.', answer: true, why: '해설' }
]
```

| type | answer | 채점 |
|---|---|---|
| `choice` (기본) | 정답 보기 **인덱스**(0부터) | 보기 클릭 즉시 채점 |
| `multi` | 정답 인덱스 **배열** | 여러 개 선택 후 "채점" 버튼 |
| `short` | 정답 문자열 (+`accept` 동의어 배열) | 대소문자·공백·문장부호 무시 비교, Enter 제출 |
| `tf` | `true` / `false` | O·X 버튼 |

- `why`(해설)는 사실상 필수다 — 오답 피드백이 학습의 핵심이고, 없으면 "오답"만 뜬다.
- 보기는 **길이를 비슷하게** 쓴다. 유독 긴 보기가 정답이면 문제가 아니라 힌트가 된다.
- 소스에 없는 사실로 문제를 만들지 않는다. 애매한 정답은 `multi`나 `short` 대신 `choice`로 좁힌다.

## 4. VIZ — 시각화 위젯 계약

```js
const VIZ = {
  hitrate: {
    title: '히트율이 평균 응답시간을 어떻게 바꾸는가',
    note: '슬라이더를 움직여 보세요.',      // 선택
    mount(host) { /* host = .viz-stage div. 여기에 DOM을 채운다 */ }
  }
};
```

- `mount(host, api)` — 해당 섹션의 "시각화로 보기"를 **처음 열 때 한 번** 호출된다(지연 마운트).
- 두 번째 인자 `api`: `{ md(), esc(), inline() }`. 패널이 높이 애니메이션 없이 열리므로 위젯이 비동기로
  커져도 잘리지 않는다(따로 호출할 것이 없다).
- 위젯 안에서 쓸 스타일은 이미 준비돼 있다 — `.viz-ctrl`, `.viz-row`, `input[type=range]`,
  `.viz-btn`, `.viz-readout`/`.viz-stat`, `.viz-legend`. 새 CSS를 만들지 말고 이 클래스를 쓴다.
- 색은 CSS 변수로 읽는다: `getComputedStyle(document.documentElement).getPropertyValue('--accent')`.
  테마가 바뀌면 `document.addEventListener('ex:theme', redraw)` 로 다시 그린다.
- 복사해서 쓰는 8종 레시피: `references/viz-recipes.md`.

## 5. markdown 지원 범위 (`summary`, `keys`, `detail`, 퀴즈 문항)

지원: `###`/`####` 소제목 · `**굵게**`(포인트색) · `*기울임*` · `` `코드` `` · ```` ```lang ```` 코드블록 ·
표(`| a | b |` + `|---|`) · 불릿/번호 목록(2칸 들여쓰기 1단 중첩) · `> 인용`(콜아웃) · `>! 경고 인용` ·
`---` 구분선 · `[링크](url)` · `![그림](src)` · `~~취소~~` · `==하이라이트==` · 두 칸 공백 + 줄바꿈 · ```` ```mermaid ````

미지원(의도적): `#`/`##` 최상위 헤딩(문서 제목과 충돌), 각주, HTML 직접 삽입, 정의 목록.

- `keys`와 퀴즈 문항은 **인라인 요소만** 렌더된다(목록·표·코드블록 불가).
- 이미지는 작은 도해·아이콘이면 data URI로 임베드해 단일 파일을 유지한다. 큰 사진이 여럿이면
  상대 경로 + 이미지 폴더로 전환하고 **파일이 분리된다는 사실을 사용자에게 알린다**.
- 개념 도해는 이미지보다 mermaid나 `VIZ` 위젯이 우선이다(수정 가능하므로).
- mermaid를 쓰면 `<head>`의 CDN 주석 한 줄을 **반드시 해제**한다. 안 쓰면 그대로 둔다.

## 6. 필요할 때만 손대는 곳

| 대상 | 위치 | 비고 |
|---|---|---|
| 색·폰트 무드 | `:root`의 테마 슬롯 6줄 + `html[data-theme="dark"]`와 `prefers-color-scheme` 블록 | 프리셋은 `references/themes.md`. **다크 블록도 함께** 바꾼다 |
| mermaid CDN | `<head>` 주석 한 줄 | §5 |
| 카드 그리드 최소 폭 | card: `.grid{grid-template-columns:repeat(auto-fill,minmax(348px,1fr))}` | 섹션이 3개 이하면 `minmax(420px,1fr)` |
| 상세 본문 가독폭 | `.panel-in{max-width:74ch}` | 코드·표가 많으면 `86ch` |

이 표에 없는 것을 고치기 시작하면 그때부터 검증 책임이 생긴다 — §7의 브라우저 확인까지 해야 한다.

## 7. 검증 (생략 금지)

```bash
node <스킬경로>/references/check.js <생성한.html>
```

제어문자 오염 · JS 문법 · 데이터 계약(id 중복, 퀴즈 answer 범위, viz 키, summary 길이) ·
필수 마크업 · mermaid CDN 정합성을 한 번에 본다. **FAIL이 0이 될 때까지 다음 단계로 가지 않는다.**
WARN은 판단 사항이다(해설 없는 문항, 참조되지 않는 위젯 등) — 의도한 것이면 그대로 둔다.

데이터 블록만 교체했다면 위 검증으로 충분하다. **CSS나 엔진을 건드렸거나 새 `VIZ` 위젯을 만들었다면**
브라우저로 직접 확인한다(agent-browser 스킬):

```bash
agent-browser open "file://$PWD/<파일>.html" --viewport 1440x900
agent-browser set viewport 390 844     # 모바일도 확인
agent-browser eval "document.documentElement.scrollWidth>document.documentElement.clientWidth"  # 가로 overflow → false여야 한다
```

`html{scroll-behavior:smooth}` 때문에 CLI 클릭 직후 좌표가 흔들린다 — 클릭 검증은
`agent-browser eval "…click()"` 처럼 **프로그램적으로** 하거나 스크롤 후 1초 대기한다.
인쇄는 헤드풀 브라우저의 PDF 출력이 빈 페이지로 나오므로, `@media print` 를 `@media screen` 으로
바꾼 사본을 열어 눈으로 확인한다.

## 8. 엔진을 다시 쓰지 않는 이유 (이미 구현된 것)

| 영역 | 구현 |
|---|---|
| markdown | `md()`/`inline()` — §5 범위. 코드스팬 보호 후 인라인 치환 순서까지 고정 |
| 패널 토글 | `hidden` 속성만 바꾼다(+ 짧은 페이드). 높이 애니메이션이 없으므로 캔버스·다이어그램이 잘리지 않는다 |
| 퀴즈 | 4종 채점·정답/오답 표시·해설·다시 풀기 (점수 집계·저장 없음) |
| 시각화 | 첫 열람 시 지연 마운트, 예외 시 폴백 메시지, 테마 변경 이벤트 |
| mermaid | 지연 렌더 + 다크 테마 초기화 + 실패 시 코드블록 폴백 |
| 저장 | **없음.** localStorage를 쓰지 않는다 — 새로 고치면 초기 상태 |
| 그 외 | 해시 딥링크, 검색 필터, 테마 순환(auto→dark→light), 인쇄 시 전체 펼침 + 흑백 팔레트, `/`·`E`·`T` 키, 스크롤스파이(docs) |

구조상 **넣지 않은 것**이 있고, 그건 요청이 아니라 버그 이력 때문이다 — 되살리지 않는다.

| 넣지 않은 것 | 이유 |
|---|---|
| 진행률·완료 표시·localStorage | 상태와 화면이 어긋나는 버그의 진원지였고, 읽는 데 필요하지 않다 |
| 패널 높이 애니메이션 | 캔버스·mermaid가 나중에 커지면 하단이 잘렸다 |
| fixed 하단 내비게이션 | 본문 마지막 줄을 가렸다 |
| sticky 툴바 | 스크롤 직후 클릭이 툴바에 먹혔다 |
| 한 화면 한 단계(단계 전환) | 스크롤 위치·잠금 상태가 서로 꼬였다. 순서는 스텝 롱폼(C)이 시각적으로만 표현한다 |

또 `[hidden]{display:none!important}` 규칙도 그대로 둔다 — `display`를 가진 요소가 `hidden`을
무시하는 문제를 막는 장치다.

## 9. 템플릿 자체를 개선할 때

`base-*.html`은 `references/_parts/`의 조각을 `build.sh`로 조립한 결과다.

```bash
<스킬경로>/references/_parts/build.sh     # css-common + css-<t> + shell-<t> + data-demo + engine + boot-common + boot-<t>
```

조각을 고쳐 다시 조립하면 세 템플릿에 동시에 반영된다. **`base-*.html`을 직접 편집하면
다음 빌드에서 덮어써진다.** 문서 생성은 언제나 `base-*.html` 복사로 한다.
