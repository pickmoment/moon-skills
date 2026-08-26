# API · CLI · 대본 문법 · 내보내기

`<skill>` 은 이 SKILL.md 가 있는 폴더의 절대경로다. 의존성은 없다.

## Quickstart

```js
const SV = require('<skill>/assets/scriptviz.js');
const fs = require('fs');

const spec = { title: '…', theme: 'midnight', beats: [ /* … */ ] };

const check = SV.validate(spec);              // 항상 먼저
if (!check.ok) throw new Error(check.errors.join('\n'));
if (check.warnings.length) console.warn(check.warnings);

fs.writeFileSync('deck.html', SV.toHTML(spec));
fs.writeFileSync('deck.timing.csv', SV.toTimingCSV(spec));
```

## API

| 호출 | 돌려주는 것 |
|---|---|
| `SV.validate(spec)` | `{ ok, errors[], warnings[], stats }` — `stats` 는 비트·스텝 수와 총 길이 |
| `SV.toHTML(spec, opts?)` | 플레이어가 들어 있는 단일 HTML. 비트에 `fx` 가 있으면 mo.js 를 인라인한다(+116KB). `opts.fxCdn` 이면 CDN 으로 건다 |
| `SV.fx` · `SV.fxKinds` | 강조 이펙트 8종 이름과 설명 |
| `SV.motions` | 모션 톤 이름 (`apple` · `plain`) — `references/theming.md#모션-톤-motion` |
| `SV.fromScript(text)` | 대본 → **초안** 스펙 (아래 문법) |
| `SV.applySubtitles(spec, srt)` | 자막으로 타이밍을 실측으로 갈아끼운다 → `{ spec, report }`. 자막 원문은 `spec.captions` 로 남아 화면 자막이 된다 |
| `SV.fromSubtitles(srt, opts?)` | 자막 → **초안** 스펙 (대본 파일이 없을 때) |
| `SV.parseSubtitles(text)` | SRT · VTT → `[{ start, end, text }]` |
| `SV.normalize(spec)` | `{ beats: [...시간이 채워진 비트], total }` |
| `SV.toTimingCSV(spec)` | 비트별 시작·끝·길이·낭독문 CSV |
| `SV.inlineAssets(spec, dir)` | 로컬 이미지·음성 경로를 data URI 로 바꾼다 |
| `SV.estimateSeconds(text, cps?)` | 낭독 시간 추정(초) |
| `SV.themes` / `.scenes` | 쓸 수 있는 이름들 |

`toHTML` 의 `opts`: `theme` `aspect` `autoplay` `clean` `prompter:false` `chroma` `bg` `frame` `progress`.

## 스펙 최상위

```jsonc
{
  "title": "구독은 왜 무너졌나",
  "subtitle": "…",
  "theme": "midnight",       // midnight · paper · neon · warm
  "aspect": "16:9",          // 16:9 · 9:16
  "cps": 5.0,                // 낭독 속도(초당 글자, 공백 제외)
  "targetSec": 180,          // 목표 길이. 20% 이상 벗어나면 경고
  "transition": "fade",      // fade · up · wipe · cut  (비트별로 덮어쓸 수 있다)
  "bg": "plain",             // 배경 레이어. plain · grid · dots · blob · mesh · rays · scan · noise
  "frame": null,             // "corners" 면 네 모서리 브래킷
  "progress": false,         // 화면 맨 아래 진행 바
  "autoplay": false,
  "chroma": "#00B140",
  "audio": "voice.mp3",      // 음성. 재생하면 이 소리가 시계를 잡는다 (아래 '음성' 절)
  "css": "…",                // raw 장면용 추가 스타일
  "beats": [ /* … */ ]
}
```

## 비트

```jsonc
{
  "id": "b3",                       // 없으면 b1, b2 … 로 자동
  "chapter": "2장 · 왜 무너졌나",    // 화면 왼쪽 위에 작게 남는다
  "say": "낭독문 전체",              // 타이밍 계산 + 프롬프터. 화면에는 안 나온다
  "sec": 9.5,                       // 시간 못 박기 (없으면 say 에서 추정)
  "at": 143,                        // 절대 시작 시각(초). 녹음본이 있을 때
  "note": "카운트업이 끝나고 말하기", // 연출 메모. 프롬프터에만 보인다
  "words": [ /* … */ ],             // 자막으로 실측한 어절 위치. applySubtitles 가 채운다
  "transition": "up",
  "scene": { "type": "stat", "…": "…" }
}
```

문자열만 넣으면(`"beats": ["…", "…"]`) 그 문장이 `say` 이고 장면은 `hero` 가 된다.

---

## CLI

```bash
node <skill>/assets/sv.js <in.json|in.md> [out.html] [옵션]

  --theme <name>     midnight | paper | neon | warm
  --aspect <ratio>   16:9 | 9:16
  --autoplay         열자마자 자동 재생
  --clean            UI를 숨긴 채로 시작 (녹화용)
  --no-prompter      프롬프터 패널 없이
  --chroma <color>   크로마키 색
  --bg <name>        배경 레이어 (plain·grid·dots·blob·mesh·rays·scan·noise)
  --audio <file>     음성(mp3·m4a·wav…)을 덱에 심는다. 재생하면 소리가 시계를 잡는다
  --audio-offset <s> 음성 안에서 첫 비트가 시작하는 시각(초)
  --volume <0-1>     음성 볼륨
  --no-inline-audio  음성을 안에 넣지 않고 경로로 참조한다 (HTML 옆에 둬야 한다)
  --subs <file>      자막(SRT·VTT)으로 타이밍을 실측으로 갈아끼운다
  --title <text>     .srt/.vtt 를 직접 넣을 때 타이틀 비트
  --cps <n>          낭독 속도
  --motion <name>    모션 톤 — apple(기본, 길게 눌리는 감속) · plain(빠르고 담백)
  --present          발표용으로 뽑는다 (아래 `--present` 절)
  --frame corners    네 모서리 브래킷
  --progress         화면 아래 진행 바
  --json             대본에서 만든 초안 스펙만 출력
  --no-timing        .timing.csv 를 만들지 않는다
  --quiet            경고 숨김
```

화면 자막 옵션(`--no-captions` · `--cc-size` · `--cc-color` · `--cc-bg` · `--cc-opacity`)은
`## 화면 자막` 절에 있다. **전체 목록은 언제나 `node <skill>/assets/sv.js --help`** —
이 문서가 아니라 그쪽이 원본이다.

`validate()` 를 돌리고, 경고를 stderr 로 내고, `<out>.timing.csv` 를 같이 쓴다.
`.md`/`.txt` 를 넣으면 `fromScript` 를, `.srt`/`.vtt` 를 넣으면 `fromSubtitles` 를 먼저
태운다. 이미지·음성 경로는 자동으로 인라인된다.

## 대본 문법 (`fromScript`)

```markdown
---
title: 구독은 왜 무너졌나
theme: midnight
cps: 5.0
---

# 구독은 왜 무너졌나          ← 타이틀 비트가 앞에 생긴다

## 1장 · 무슨 일이 있었나      ← 다음 비트부터 이 챕터

[00:03] 작년 한 해에만 …       ← 절대 타임코드 (추정치보다 우선)

((지도 대신 숫자만))           ← 연출 메모. 앞 비트에 붙는다

@stat 첫 달 이탈률은 41%…      ← 장면 타입 지정

![2026년 3월, 마지막 사무실](shots/office.jpg)   ← 사진. 대괄호 안이 캡션
처음엔 책상 네 개였다.                            ← 같은 문단의 나머지가 낭독문

@split ![](shots/team.png)     ← @split 과 함께면 왼쪽은 말, 오른쪽은 사진
그래서 온보딩부터 다시 짰다.
```

- 빈 줄로 나뉜 문단 하나가 비트 하나다. `---` 로도 나눌 수 있다.
- 타입을 안 적으면 문장 모양을 보고 **초안**을 고른다 — 반드시 다시 본다(`direction.md`).
- 초안은 뼈대다. `--json` 으로 뽑아 손보는 흐름을 권한다.

### 대본과 이미지를 섞어 쓰기

사진을 어느 대목에 붙일지는 **대본 안에서 정하는 게 가장 정확하다.** 나중에 JSON 을 열어
비트 번호를 세어가며 맞추지 않아도 된다.

```markdown
![2026년 3월, 마지막 사무실](shots/office.jpg)
처음엔 책상 네 개였다. 여기서 전부 시작했다.
```
→ `{ say: "처음엔 …", scene: { type: "image", src: "shots/office.jpg",
     caption: "2026년 3월, 마지막 사무실" } }`

| 쓰는 법 | 나오는 장면 |
|---|---|
| `![캡션](경로)` | `image` — 화면 전체 사진 + 캡션 |
| `![](경로)` | `image` — 캡션 없이 |
| `@split ![](경로)` | `split` — 왼쪽은 낭독문 첫 문장이 제목, 오른쪽은 사진 |

- 이미지 줄은 문단 어디에 있어도 되고, 낭독문과 같은 줄에 있어도 뽑아낸다.
- 경로는 **대본 파일이 있는 폴더 기준**이다.
- `@split` 초안은 왼쪽 제목만 채워진다 — 항목은 `--json` 으로 뽑아 손본다.

**`--json` 은 이미지를 경로 그대로 내보낸다.** 초안을 손보라고 주는 것이라
data URI 로 박으면 사람이 못 읽는다. 최종 빌드에서만 파일 안에 박힌다.

**제 순서**

```bash
node <skill>/assets/sv.js images shots/        # 1. 재료 훑기 (+ 직접 열어 보기)
#    대본에 ![](경로) 를 써 넣는다              # 2. 대본에서 자리 정하기
node <skill>/assets/sv.js script.md --json > draft.json   # 3. 초안
#    draft.json 을 손본다                       # 4. 장면·항목 다듬기
node <skill>/assets/sv.js draft.json deck.html            # 5. 빌드 (이미지가 박힌다)
```

---

## 자막으로 타이밍 확정하기

글자 수 추정은 **대본만 있을 때의 방편**이다. 녹음이 끝나고 자막(SRT·VTT)이 나오면
진짜 시각을 알 수 있다. 추정은 비트가 쌓일수록 어긋나서, 8분 대본에서 마지막 비트가
2분 넘게 밀리는 일이 실제로 있다.

### 제 순서

```bash
# 1. 대본으로 화면을 짠다 (타이밍은 추정)
node <skill>/assets/sv.js script.md deck.html

# 2. 녹음하고, 자막을 만든다 (예: tools/subtitler)
#    mp3 + 대본 → voice.srt

# 3. 그 자막으로 타이밍을 확정하고, 음성을 얹는다
node <skill>/assets/sv.js script.md deck.html --subs voice.srt --audio voice.mp3
```

3번을 지나면 `at`·`sec` 이 실측으로 박히고, **프롬퍼터의 노래방 표시가 목소리와
맞는다.** 화면 구성은 그대로다 — 시각만 바뀐다.

```js
const { spec, report } = SV.applySubtitles(draft, fs.readFileSync('voice.srt', 'utf8'));
// report.applied = [{ beat, at, sec, matched }]
// report.skipped = [{ beat, why }]
fs.writeFileSync('deck.html', SV.toHTML(spec));
```

### 어긋난 비트는 건너뛴다

자막과 낭독문이 맞지 않는 비트는 **추정을 그대로 두고 `report.skipped` 에 남긴다.**
조용히 틀린 시각을 넣는 것보다 어디가 안 맞는지 말해주는 편이 낫다.

| `skipped` 에 뜨는 이유 | 뜻 |
|---|---|
| 낭독문이 없다 | 타이틀 비트처럼 `say` 가 빈 비트. 정상이다 |
| 자막과 낭독문이 맞지 않는다 (일치 0%) | 그 비트를 낭독하지 않았거나, 자막이 다른 영상의 것이다 |
| 남은 자막이 없다 | 자막이 대본보다 짧다. 뒷부분을 녹음하지 않았다 |

전부 건너뛰면 자막 짝이 틀린 것이다. 비트 순서와 자막 순서가 같다는 전제로 앞에서부터
소비하므로, **비트를 재배열한 뒤에는 다시 적용해야 한다.**

### 자막만 있을 때

대본 파일이 없고 자막만 있으면 자막으로 초안을 만든다.

```bash
node <skill>/assets/sv.js voice.srt deck.html --title "제목"
```

자막 한 장은 2~4초라 비트보다 작으므로 여러 장을 묶는다. 끊는 자리는 **자막 사이의
큰 쉼(문단 경계) → 문장 끝 → 목표 길이** 순서로 고른다. `fromSubtitles(srt, opts)`
의 `opts` 로 조절한다.

| | 기본 | |
|---|---|---|
| `target` | 11 | 비트 목표 길이(초) |
| `max` | 22 | 이 이상은 무조건 끊는다 |
| `gap` | 0.9 | 이만큼 쉬면 문단이 갈린 것으로 본다 |

**장면 타입은 초안이다.** 자막에는 문단 구조가 없어서 대본으로 시작할 때보다 초안이
거칠다 — `direction.md` 로 반드시 다시 고른다.

---

## 음성(mp3)과 함께 재생하기

자막으로 타이밍을 박은 다음 `--audio` 로 음성을 얹으면, **덱을 재생할 때 목소리가
흐르고 화면이 그 목소리에 맞춰 넘어간다.** 소리를 따로 틀고 화면을 맞출 필요가 없다.

```bash
node <skill>/assets/sv.js script.md deck.html --subs voice.srt --audio voice.mp3
```

음성은 HTML 안에 data URI 로 들어간다 — **파일 하나만 옮기면 소리까지 따라간다.**
8분 내레이션이면 HTML 이 10MB 안팎이 된다. 그게 부담이면 `--no-inline-audio` 로
경로 참조로 두고 mp3 를 HTML 옆에 둔다.

### 소리가 시계를 잡는다

재생 중에는 화면이 `audio.currentTime` 을 읽어 따라간다. 그래서

- 버퍼링이 걸려도 화면이 앞서가지 않는다
- 오디오를 앞으로 감으면 화면이 그 자리로 따라온다
- 비트를 점프하거나 하단 바를 클릭하면 **음성도 그 시각으로 옮겨간다**
- `Space` 로 수동 전환하면 소리는 멈춘다 (직접 넘길 때는 소리가 방해다)
- `L`(낭독 페이스)은 내가 읽는 모드라 소리를 틀지 않는다

브라우저가 소리를 막으면(자동 재생 정책) **화면은 자체 시계로 조용히 굴러간다.**
멈추지 않고, 토스트로 알려준다.

### 스펙으로 쓸 때

```jsonc
"audio": "voice.mp3"          // 짧게 쓰면 경로 하나
"audio": {
  "src": "voice.mp3",
  "offset": 0,                // 음성 안에서 첫 비트가 시작하는 시각(초).
                              //  앞에 인트로 음악이 3초 붙어 있으면 3
  "volume": 1,
  "inline": true,             // false 면 HTML 안에 넣지 않고 경로로 참조
  "master": true,             // false 면 소리만 나고 화면은 자체 시계로 간다 (권하지 않는다)
  "duration": null            // 음성 길이를 알면 적어둔다. validate 가 화면 길이와 견준다
}
```

### 첫 재생은 한 번 눌러야 한다

브라우저는 소리 있는 자동 재생을 막는다. `--autoplay` 로 뽑으면 **"▶ 소리와 함께 재생"
시작판**이 뜨고, 그걸 누르면 처음부터 소리와 함께 간다. 자동 재생이 아니면 평소대로
`P` 나 재생 버튼을 누르면 된다 — 그 클릭이 곧 허가다.

### 폰에서 열 때

**소리·전환·동기는 폰에서도 그대로 된다.** 무대를 누르면 다음, 왼쪽 끝을 누르면 이전이고,
키보드가 없어도 HUD 버튼(재생·대본·클린·소리·전체·?)으로 다 조작된다. 좁은 화면에서는
HUD 가 두 줄로 흐르고 제작용 버튼(낭독·가이드·크로마)은 접힌다. 대본 패널은 **접었을 때
무대가 15% 넘게 커지는 경우에만** 접힌 채로 시작한다 — 눕힌 폰과 9:16 이 여기 해당하고,
폰 세로에 16:9 를 넣으면 어차피 폭이 병목이라 그대로 펴 둔다.

폰 세로로 16:9 를 보면 무대가 화면 폭에 갇혀 작다. **쇼츠가 아니면 폰은 눕혀서 본다** —
`전체 F` 로 전체화면까지 가면 가장 크다.

**iOS 는 확인이 더 필요하다.** 사파리는 `data:` URI 로 심은 미디어의 시킹·`duration` 을
제대로 못 다루는 일이 있다. 그래서 재생을 걸고도 음성 시각이 흐르지 않으면 **화면이
자체 시계로 넘어가고**(소리는 그대로 난다) 그 사실을 화면에 알린다. 그 토스트를 보면
`--no-inline-audio` 로 다시 뽑아 mp3 를 HTML 옆에 두면 된다. 소리가 아예 안 나면
**아이폰 무음 스위치**부터 본다 — 웹 오디오는 그 스위치를 따른다.

### 자막 없이 음성만 붙이지 않는다

전환은 여전히 글자 수 추정이라 **소리만 정확하고 화면이 어긋난다.** `validate` 가
`음성을 붙였는데 타이밍이 전부 추정이다` 로 경고한다. 순서는 늘 **자막 → 음성**이다.

덱을 열었을 때 음성 길이와 화면 길이가 5% 넘게 다르면 화면 안에서도 알려준다
(`음성 8:12 vs 화면 6:40`). 그 차이는 자막으로 좁힌다.

---

## 조작키

| | |
|---|---|
| `Space` `→` | 다음 스텝 (수동) |
| `←` | 이전 스텝 · `↓` `↑` 비트 단위 |
| `P` | 자동 재생 토글 |
| `L` | **낭독 페이스** — 장면은 그대로 두고 대본 위치만 흐른다 |
| `Shift+↑` `Shift+↓` | 프롬프터 글자 크기 |
| `C` | 클린 모드(UI 숨김) · `T` 프롬프터 접기 |
| `G` | 안전영역 가이드 · `X` 크로마키 · `F` 전체화면 |
| `M` | **소리 끄기 / 켜기** (음성을 붙였을 때) |
| `S` | 화면 자막 켜기 / 끄기 (자막을 넣었을 때) |
| `O` | 슬라이드 오버뷰 · `Esc` 닫기 |
| `Home` `End` | 첫 비트 · 마지막 비트 |
| `PageDown` `PageUp` | `Space` `←` 와 같다 (프리젠터 리모컨용) |
| `R` 처음으로 · `0-9` 비트 점프 · `K` 타이밍 시트 복사 · `?` 도움말 | |

키보드가 없는 화면에서는 HUD 버튼이 같은 일을 한다 — 키 힌트는 감춰지고 제작용
버튼(낭독·가이드·크로마)은 접힌다. 화면 왼쪽 20% 클릭은 이전, 나머지는 다음.
하단 바를 클릭하면 그 시각으로 이동한다.
주소 해시 `#b3.2` 는 3번 비트 2번 스텝을 가리킨다.

## 컷 내보내기 · 영상 녹화

```bash
node <skill>/assets/shots.js deck.html out/ [옵션]

  --beat            비트마다 한 장 (기본은 스텝마다)
  --wait <ms>       컷마다 애니메이션이 끝나기를 기다린다 (기본 1500)
  --size <w> <h>    캡처 해상도 (기본 1920 1080 / 세로는 1080 1920)
  --video           PNG 대신 자동 재생을 WebM 으로 녹화
                    강조 이펙트(fx)는 이 모드에서만 담긴다 — PNG 정지컷에는 안 나온다
  --no-cc           화면 자막을 끄고 캡처한다 (편집기에서 자막을 따로 얹을 때)
  --session <name>  agent-browser 세션 이름
```

`agent-browser` CLI 로 실제 브라우저를 몰아 **1920×1080 PNG 시퀀스**를 굽는다.
파일명은 `003_b3.4.png`(순번 + 비트.스텝)라 편집기 타임라인에 순서대로 얹으면 된다.
`--video` 는 자동 재생을 통째로 WebM 으로 뜬다. **브라우저 녹화는 화면만 담는다 —
소리는 들어가지 않는다.** 음성이 붙은 덱이면 원본 mp3 를 나중에 얹는다.

```bash
ffmpeg -i deck.webm -i voice.mp3 -c:v copy -c:a aac -shortest deck.mp4
```

PNG 시퀀스를 굽는 동안에는 음성이 음소거된다(`?mute=1`). 편집기에서는 PNG 시퀀스와
mp3 를 같은 타임라인에 얹고 `.timing.csv` 로 자리를 잡는다.

프리미어·파이널컷에는 이렇게 넘긴다: **PNG 시퀀스 + `.timing.csv`.**
CSV의 `start`/`end` 가 각 컷이 놓일 자리다.

## 노래방식 프롬프터

재생 중에는 프롬프터의 낭독문이 **지금 읽을 위치까지 칠해진다.** 지나간 어절은 밝게,
지금 읽는 어절은 왼쪽부터 차오르고, 남은 어절은 흐리다.

위치는 기본적으로 **비트 시간을 어절의 글자 수로 나눈 추정**이다(문장 끝에는 쉼을
더한다). 목소리를 듣고 맞추는 것이 아니라서 실제 낭독과 어긋날 수 있다 — 어긋나면
이렇게 잡는다.

**자막을 `--subs` 로 넣으면 추정이 아니라 실측이 된다.** 자막 한 장의 구간을 그
안의 어절에 글자 수로 나눠 깔기 때문에, 칠해지는 위치가 자막 타임코드와 맞는다.

| 증상 | 손볼 곳 |
|---|---|
| 전체적으로 표시가 앞서간다 / 뒤처진다 | `spec.cps` (낭독 속도) |
| 특정 비트만 어긋난다 | 그 비트의 `sec` |
| 이미 녹음본이 있다 | **자막을 만들어 `--subs`** — 어절 위치까지 실측이 된다 |
| 자막 없이 녹음본만 있다 | 그 비트의 `at` (절대 타임코드) — 구간 안에서 다시 나뉜다 |

**`L`(낭독 페이스)** 는 녹화하며 직접 넘길 때를 위한 모드다. 장면은 넘어가지 않고
대본 위치만 흐르다가 비트 끝에서 멈춘다 — 한 비트를 읽는 동안 페이스를 보고,
다 읽으면 `Space` 로 직접 넘긴다. 자동 재생(`P`)을 켜면 자동으로 꺼진다.

프롬프터는 클린 모드(`C`)에서 숨겨지므로 **녹화 화면에는 잡히지 않는다.**
글자가 작으면 `Shift+↑` 로 키운다.

## 브라우저에서 직접 녹화할 때

1. `--clean` 으로 뽑거나 `C` 를 눌러 UI를 숨긴다
2. `F` 로 전체화면 (창 비율이 16:9가 아니어도 무대는 정확한 비율을 유지한다)
3. OBS·퀵타임 화면 녹화를 켠다 (음성을 붙였으면 **시스템 소리도 잡히게** 설정한다 —
   화면 녹화 기본값은 소리를 빼는 경우가 많다)
4. 낭독하며 `Space` 로 넘기거나(`L` 을 켜면 프롬프터가 페이스를 짚어준다),
   `P` 로 자동 재생을 걸고 그 위에 내레이션을 얹는다

## 강조 이펙트 (fx)

비트에 `fx` 를 달면 그 비트로 넘어가는 순간 이펙트가 터진다. 스펙 문법은
`references/scenes.md#fx--강조-이펙트-선택`, 쓸 자리 판단은 `references/direction.md` 를 본다.

- **`fx` 를 안 쓰면 산출물은 예전과 완전히 같다** — mo.js 는 쓸 때만 실린다.
- 이펙트는 무대(`#stage`) 안 `#fxl` 레이어에 붙는다. 무대와 같이 축소·확대되고
  무대 밖으로는 잘린다. 크로마키 배경에서도 그대로 나온다.
- `?fx=0` 으로 열면 발사하지 않는다. `shots.js` 의 PNG 모드가 이걸 쓴다.

만들면서 값을 잡을 때는 콘솔에서 직접 쏴 본다:

```js
SVAPI.fx('impact')
SVAPI.fx({ kind: 'picto', icon: '하트', count: 12, radius: 480 })
SVAPI.fxKinds        // 8종 이름
```

## 아트디렉션·디자인 디렉터·스타일 프레임

```bash
node <skill>/assets/sv.js deck.json out.html \
  --art-direction editorial-documentary --direct --style-frames
```

- `--art-direction`: 색상보다 큰 시각 문법을 고른다. 6종은 `theming.md#아트디렉션-팩-6종`.
- `--direct`: 원본을 복사해 장면별 `composition`, 감정 곡선 `arc`, 모티프 상태,
  이미지 처리 프리셋을 배정한다.
- `--style-frames`: `out.styles.html`을 추가 생성한다. 세 아트디렉션 × 오프닝·대표 데이터·
  결론을 한 화면에서 비교한다.

```js
const directed = SV.direct(spec, { artDirection: 'broadcast-data' });
console.log(directed.report);                 // 배정한 구도와 감정 곡선
const html = SV.toHTML(directed.spec);
const frames = SV.toStyleFramesHTML(spec);    // 비교용 단일 HTML
SV.compositions('stat');                      // 허용 구도 목록
```

`spec.motif`은 덱 전체 모티프다. 장면의 `scene.motif.state`가 같은 형태를 긴장·전환·결론에
맞춰 변형한다. `scene.share`는 연속 장면의 같은 이름을 FLIP으로 잇고, 활자와 차트도 같은
이름이면 형태·위치 전환 대상으로 처리한다. 필드 형식은 `scenes.md#공유-요소낭독-이벤트`.

## 화면 자막

자막 파일(`--subs`)을 함께 넣으면 **타이밍만 갈아끼우는 게 아니라 자막 원문도 남는다**
(`spec.captions`). 그 자막을 무대 위에 띄울 수 있다 — 발표자용 프롬프터와는 다른
것이다. 프롬프터는 무대 밖에 있고, 이건 무대 안에 있어서 **녹화·컷 캡처에 그대로
담긴다.**

```bash
node <skill>/assets/sv.js deck.json out.html --subs voice.srt
#   화면 자막 3장 켜짐 — 재생 중 S 로 끈다, 캡처는 ?cc=0

node <skill>/assets/sv.js deck.json out.html --subs voice.srt --no-captions
node <skill>/assets/sv.js deck.json out.html --subs voice.srt --cc-size 46
```

**켜고 끄는 방법 네 가지**

| 어디서 | 어떻게 |
|---|---|
| 재생 중 | `S` 키, 또는 HUD 의 `자막` 버튼 (자막이 있을 때만 나온다) |
| 스타일 조절 | `Shift+S`, 또는 HUD 의 `자막설정` 버튼 |
| 열 때 | `?cc=1` · `?cc=0` |
| 빌드할 때 | `--no-captions` (CLI) · `toHTML(spec, { captions: false })` |
| 도구에서 | `SVAPI.captions(true|false)` · `SVAPI.cueCount` · `SVAPI.captionStyle({…})` |

기본값은 **켜짐**이다 — 자막을 넣었다는 건 대개 화면에도 필요하다는 뜻이라서.
타이밍 보정에만 쓰고 화면에는 안 띄우려면 `--no-captions`.

**모양 — 네 가지를 정한다**

| 값 | 기본 | CLI | 스펙 | URL |
|---|---|---|---|---|
| 글자 크기 | 16:9 `38` · 9:16 `46` | `--cc-size 50` | `caption.size` | `?ccsize=50` |
| 글자 색 | `#ffffff` | `--cc-color '#ffe066'` | `caption.color` | `?cccolor=%23ffe066` |
| 배경 색 | `#080a10` | `--cc-bg '#2b0b1f'` | `caption.bg` | `?ccbg=%232b0b1f` |
| 배경 투명도 | `0.72` | `--cc-opacity 0.55` | `caption.opacity` | `?ccopacity=0.55` |

```jsonc
{ "title": "…", "caption": { "size": 50, "color": "#ffe066", "bg": "#2b0b1f", "opacity": 0.55 },
  "beats": [ … ] }
```

**배경은 글자 뒤에 깔린 별도 레이어다.** 투명도를 낮춰도 글자는 그대로 진하다 —
`opacity: 0.2` 로 배경만 옅게 깔고 글자는 또렷하게 쓸 수 있다. `opacity: 0` 이면
배경이 사라지고 그림자만 남는다(`?ccplain=1` 과 같다).

색은 CSS 색이면 뭐든 된다 — `#ffe066` · `rgb(255,224,102)` · `var(--accent)`.

**화면에서 맞춘다.** HUD 의 `자막설정` 버튼(또는 `Shift+S`)을 누르면 설정판이 열린다 —
글자 크기·글자 색·배경 색·배경 투명도를 슬라이더와 색 피커로 바로 조절하고, 자막에
즉시 반영된다. 프리셋 세 개(`기본` · `옅게` · `없이`)로 시작점을 잡으면 빠르다.

맞춘 값은 **`스펙 복사`** 로 클립보드에 담아 스펙에 그대로 붙여 넣는다:

```
"caption": {"size":50,"color":"#ffe066","bg":"#2b0b1f","opacity":0.55}
```

값은 브라우저에 남아 다음에 그 덱을 열 때 그대로 복원된다. `되돌리기` 는 저장을 지우고
빌드 값으로 되돌린다.

> **캡처는 저장값을 무시한다.** `?clean=1`(PNG·WebM 캡처가 여는 방식)로 열면 브라우저에
> 남은 값을 쓰지 않고 **빌드 값 그대로** 간다 — 컷마다 자막 스타일이 달라지면 안 되니까.
> 캡처에 다른 스타일을 쓰고 싶으면 URL 파라미터를 붙인다.

콘솔·도구에서 바꿀 수도 있다:

```js
SVAPI.captionStyle({ size: 46, opacity: 0.4 })   // 바뀐 전체 값을 돌려준다 (설정판도 따라 움직인다)
SVAPI.captionStyle()                              // 지금 값 확인
```

**우선순위**는 빌드 값 → 화면에서 맞춘 값(브라우저 저장) → URL 파라미터 순으로 덮인다.

- 한국어 줄바꿈은 어절 단위(`word-break: keep-all`)라 단어가 중간에 안 잘린다
- 무대 안 안전영역 위쪽에 놓인다. 크로마키(`X`)에서도 남는다

**캡처**

PNG 시퀀스·WebM 에 기본으로 담긴다. 편집기에서 자막을 따로 얹을 거면 빼고 굽는다:

```bash
node <skill>/assets/shots.js deck.html out/ --no-cc
```

## 발표용으로 뽑기 (`--present`)

같은 스펙 하나로 **영상용 화면**과 **발표용 슬라이드**를 둘 다 낸다. 장면 19종·픽토그램
191종·데이터 시각화를 그대로 쓰고, 영상용 장치(프롬프터·낭독 시계·자동재생)만 걷어낸다.

```bash
node <skill>/assets/sv.js deck.json talk.html --present
#   발표용 — 스페이스·→ 로 넘기고, O 로 슬라이드 오버뷰, F 로 전체화면
```

`toHTML(spec, { present: true })` · `spec.present = true` · `?present=1` 도 같다.

**무엇이 달라지나**

| | 영상용 (기본) | 발표용 (`--present`) |
|---|---|---|
| 진행 | 낭독 시계로 자동재생 | 사람이 넘긴다 (자동재생 없음) |
| HUD·프롬프터·도움말 | 있음 | **아예 안 실린다** |
| 화면 자막 | 자막 넣으면 기본 켬 | **아예 안 실린다** (타이밍에만 쓰인다) |
| 화면에 남는 것 | 무대 + 조작 UI | **무대뿐** — 손을 떼면 커서까지 사라진다 |

발표용은 UI 를 CSS 로 가리는 게 아니라 **빌드에서 빼기 때문에**, 실수로 튀어나오거나
녹화·캡처에 섞일 일이 없다. 자막 큐도 안 실려서 파일이 그만큼 가볍다.
`--subs` 를 함께 준 경우 자막은 **타이밍 보정에만** 쓰인다.

**조작**

| 키 | 하는 일 |
|---|---|
| `Space` `→` · 화면 오른쪽 클릭 | 다음 스텝 (스텝이 끝나면 다음 슬라이드) |
| `←` · 화면 왼쪽 20% 클릭 | 이전 |
| `↓` `↑` | **슬라이드 단위**로 이동 (스텝 건너뛰기) |
| `O` | 슬라이드 오버뷰 |
| `Esc` | 오버뷰 닫기 |
| `F` | 전체화면 |
| `0`~`9` | 그 번호 슬라이드로 |

### 슬라이드 오버뷰

`O` 를 누르면 전체 슬라이드가 썸네일 그리드로 펼쳐진다. 누르면 그 슬라이드로 간다 —
Q&A 때 앞으로 되돌아갈 때 쓴다. **썸네일은 실제 장면을 그대로 줄인 것**이라 따로
만들지 않고, 모든 빌드 스텝이 끝난 상태로 보여준다. 캡션에는 낭독문 앞부분이 붙는다.

오버뷰는 발표 모드가 아니어도 열린다(`O` · HUD 의 `슬라이드` 버튼) — 영상용 덱을
훑어볼 때도 쓸모가 있다. 발표용에는 버튼이 없으니 `O` 로 연다.

## 이미지

`sv.js` 는 빌드할 때 `SV.inlineAssets(spec, 스펙파일_폴더)` 를 자동으로 부른다.
`scene.src` · `right.src` 의 **로컬 경로**를 data URI 로 바꿔 산출물 하나에 박는다
(`references/scenes.md#image--사진스크린샷`).

쓸 이미지를 먼저 훑을 때:
```bash
node <skill>/assets/sv.js images shots/
```
```js
SV.scanImages('shots')   // [{ file, kb, w, h, ratio, where, why, warn }]
SV.imageSize(buf, 'png') // [w, h] — 헤더만 읽는다
```

직접 부를 때:
```js
SV.inlineAssets(spec, path.dirname(specFile));
spec.__inlined      // 박은 장수
spec.__imgMissing   // 못 찾은 경로들
spec.__imgRemote    // http(s) — 파일 안에 안 들어간다
spec.__imgHeavy     // 900KB 넘는 것들
```
