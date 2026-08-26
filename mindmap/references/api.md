# API · CLI · 마크다운 입력

`<skill>` 은 이 SKILL.md 가 있는 폴더의 절대경로다. 의존성은 없고 번들 한 개가
전부라 설치할 것이 없다.

## Quickstart

```js
const MM = require('<skill>/assets/mindmap.js');
const fs = require('fs');

const spec = { title: '…', root: { text: '…', children: [ /* … */ ] } };

const check = MM.validate(spec);                 // 항상 먼저
if (!check.ok) throw new Error(check.errors.join('\n'));
if (check.warnings.length) console.warn(check.warnings);

fs.writeFileSync('map.html', MM.toHTML(spec, { theme: 'sketch' }));        // 정적 한 장
fs.writeFileSync('map-i.html', MM.toInteractive(spec, { theme: 'flat' })); // 탐색용
const svg = MM.render(spec, { theme: 'editorial' });                       // 임베드
```

브라우저에서는 `<script src="assets/mindmap.js">` 뒤에 `MM.mount('#el', spec)`.

---

## API

| 호출 | 돌려주는 것 |
|---|---|
| `MM.validate(spec, opts?)` | `{ ok, errors[], warnings[], stats }` — `errors` 는 렌더를 막는다. `{ interactive: true }` 면 노드가 많다는 경고를 내지 않는다 |
| `MM.render(spec, opts?)` | SVG 문자열 |
| `MM.toHTML(spec, opts?)` | 정적 단일 HTML 문서 |
| `MM.toInteractive(spec, opts?)` | **접기·줌·검색이 되는 단일 HTML** (아래 참조) |
| `MM.toPresentation(spec, opts?)` | **발표 모드** — 카메라가 갈래를 하나씩 찾아가는 단일 HTML |
| `MM.toDataURI(spec, opts?)` | `data:image/svg+xml,…` — `<img src>` 용 |
| `MM.mount(target, spec, opts?)` | DOM 요소에 렌더 (브라우저) |
| `MM.fromMarkdown(md)` | 마크다운 아웃라인 → 스펙 |
| `MM.outline(spec)` | `[{ id, depth, text, kids, parent }]` 평탄한 목록 |
| `MM.inlineImages(spec, dir)` | 노드의 로컬 `image` 경로를 data URI 로 바꾼다 |
| `MM.icons()` | 쓸 수 있는 픽토그램 이름 149개 |
| `MM.themes` / `.layouts` / `.colors` / `.densities` | 쓸 수 있는 이름들 |

`opts` 는 스펙의 같은 이름 옵션을 덮어쓴다: `MM.render(spec, { theme: 'flat' })`.
스펙에 없는 렌더 전용 옵션은 이렇다.

| opt | 뜻 |
|---|---|
| `collapsed: ['r.2', 'r.2.0']` | 이 id 들을 접은 상태로 그린다 (노드의 `collapsed` 를 대체) |
| `query: '검색어'` | 맞는 노드만 남기고 나머지를 흐리게 |
| `heading: false` | 좌상단 헤딩을 그리지 않는다 |
| `backdrop` · `legend` · `links` | 스펙의 같은 필드를 덮어쓴다 |
| `background: false` | 배경 사각형 없이 (다른 문서에 얹을 때) |

노드 id 는 트리 위치에서 결정된다 — 루트가 `r`, 그 세 번째 아이가 `r.2`,
그 아이의 첫째가 `r.2.0`. 같은 스펙이면 항상 같은 id 가 나온다.

렌더는 **결정적이다.** 같은 스펙·같은 `seed` 면 바이트까지 같은 SVG가 나오므로
커밋하고 diff 해도 된다.

---

## CLI

```bash
node <skill>/assets/mm.js <in.json|in.md> [out.html] [옵션]

  --interactive        접기/줌/검색 뷰어로 (기본은 정적 한 장)
  --present            발표 모드 (카메라가 갈래를 하나씩 찾아간다)
  --stops node         발표 정차를 2단계 노드까지 (기본은 갈래마다)
  --svg                HTML 대신 .svg 파일로
  --theme <name>       sketch | flat | editorial | bold
  --layout <name>      map | right | down
  --density <name>     brief | standard | detailed
  --backdrop <name>    none | gradient | blob | vignette | glow
  --json               파싱된 스펙만 stdout 으로 출력
  --quiet              경고 숨김
```

`validate()` 를 자동으로 돌리고, 경고는 stderr 로, 노드 수·깊이·갈래 수를 마지막에
찍는다. 마크다운을 넘기면 `fromMarkdown` 을 먼저 태운다.

```bash
node <skill>/assets/mm.js outline.md map.html --interactive --theme sketch
```

---

## 마크다운 아웃라인

머릿속에 있는 것을 JSON으로 옮기기 전에, 아웃라인으로 먼저 쓰는 편이 빠를 때가 많다.

```markdown
---
title: 온보딩 첫 2주
theme: sketch
layout: map
density: standard
---

# 온보딩 첫 2주            ← 루트 (첫 h1)

## 1주차 · 보는 주          ← depth 1 (헤딩 레벨로 중첩)
- 코드 읽기 :: 배포까지 한 바퀴     ← `::` 뒤는 note
  - 로컬 실행                       ← 들여쓰기 2칸 = 한 단계 아래
- **첫 PR** :: 오타라도 낸다        ← `**…**` = mark
- [+] 도메인 학습                   ← `[+]` = 처음에 접힘
  - 용어집 훑기
- {coral} 30분 규칙                 ← `{색}` = 갈래 색
```

- 앞의 `---` 블록은 스펙 옵션이 된다(`theme`, `layout`, `density`, `paper`, `backdrop`, `title` …).
- 헤딩(`#`~`######`)은 레벨로, 불릿(`-`, `*`, `1.`)은 들여쓰기 2칸으로 중첩된다.
- 목록 아래 그냥 쓴 한 줄은 바로 위 노드의 `note` 가 된다.
- 순서 있는 목록(`1.`)도 그냥 자식이 된다 — **마인드맵은 순서를 표현하지 않는다.**

---

## 어느 출력에서 무엇이 되는가

| | 정적 `toHTML` | 인터랙티브 `toInteractive` | 발표 `toPresentation` |
|---|---|---|---|
| 클릭으로 접기·펼치기 | **안 된다** | 된다 | 안 된다(전부 펼친 채 보여준다) |
| 드래그·휠로 이동·확대 | 안 된다 | 된다 | 안 된다(카메라가 정해진 곳으로) |
| 검색 | 안 된다 | 된다 | 안 된다 |
| 카메라 이동 | — | — | 된다 |
| 인쇄·이미지로 쓰기 | 좋다 | 그냥 된다 | HUD가 빠지고 인쇄된다 |

**정적 출력에서 클릭이 안 되는 것은 버그가 아니다** — 그림 한 장이다.
접었다 펴며 볼 것이면 `toInteractive`, 발표할 것이면 `toPresentation` 을 쓴다.
CLI 는 무엇을 만들었는지와 그 조작법을 마지막 줄에 찍어 준다.

## 발표 모드

`MM.toPresentation(spec)` 은 **슬라이드가 아니다.** 맵 한 장을 그대로 두고 카메라가
갈래를 하나씩 찾아간다 — 보는 사람은 그 갈래가 전체 어디에 붙어 있는지를 계속 본다.

정차 순서는 **전체 → 갈래 1 → 갈래 2 → … → 전체**다. 각 정차에서 그 갈래의 하위
트리만 밝고 나머지는 흐려지며, 맥락으로 상위 노드(갈래면 중심 노드, 더 깊은 노드면
바로 위 부모)가 함께 화면에 담긴다. `collapsed` 는 무시하고 **전부 펼친 채** 보여준다.

| 조작 | |
|---|---|
| `←` `→` `Space` | 이동 (화면 왼쪽 20% 클릭 = 이전, 나머지 = 다음, 스와이프도) |
| `O` | 전체 보기 · `Home`/`End` 처음/끝 · `0-9` 바로가기 |
| `F` | 전체화면 · `?` 도움말 |

주소 해시 `#4` 는 4번째 정차를 가리킨다.

| opt | 기본 | |
|---|---|---|
| `stops` | `'branch'` | `'node'` 면 2단계 노드까지 정차한다 |
| `context` | `true` | 상위 노드를 함께 담아 맥락을 준다. `false` 면 그 갈래만 |
| `dim` | `true` | 다른 갈래를 흐리게 |
| `maxZoom` | `2.2` | 작은 갈래가 지나치게 커지지 않게 하는 상한 |
| `pad` | `60` | 화면 여백 |
| `transition` | `780` | 카메라 이동 시간(ms) |
| `endOverview` | `true` | 마지막에 전체 보기로 돌아간다 |
| `respectCollapsed` | `false` | `true` 면 접힌 노드를 접힌 채로 발표한다 |

## 인터랙티브 출력

`MM.toInteractive(spec)` 는 라이브러리를 통째로 품은 **단일 HTML 파일**을 낸다.
서버도 네트워크도 필요 없고(웹폰트만 CDN에서 받는다), 그대로 보내면 열린다.

| 조작 | |
|---|---|
| 노드 클릭 | 접기 / 펼치기 |
| 노드 더블클릭 | 그 노드를 화면 가운데로 |
| 드래그 · 휠 | 이동 · 확대 |
| `1` ~ `9` | 해당 단계까지 접기 · `e` 전부 펼치기 (툴바 버튼은 1·2·3) |
| `/` | 검색 — 맞는 노드만 남기고 흐리게, 접힌 가지는 자동으로 펼쳐진다 |
| `0` `+` `-` | 화면 맞춤 · 확대 · 축소 · `f` 전체화면 |
| 툴바 | 테마·레이아웃 전환, SVG/PNG 내려받기 |

접기 상태는 저장되지 않는다. 처음 열었을 때의 모습은 스펙의 `collapsed` 가 정한다 —
**보여주고 싶은 층까지만 펼쳐서 넘긴다.**

PNG 내려받기는 브라우저가 SVG를 캔버스에 굽는 방식이라 웹폰트가 시스템 폰트로
대체될 수 있다. 글꼴이 중요한 자리에는 SVG를 쓴다.
