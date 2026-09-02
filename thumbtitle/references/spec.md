# thumbtitle 스펙 레퍼런스

캔버스는 1280×720 고정(유튜브 썸네일 규격). 좌표는 쓰지 않는다 — 9구역 그리드에 놓으면 엔진이 배치한다.

## 최상위

```jsonc
{
  "meta": { "topic": "영상 주제", "series": "시리즈명", "title": "변형이 없을 때의 제목" },
  "theme": "impact",          // impact · clean · docu · finance · story → themes.md
  "background": { ... },
  "elements": [ ... ],
  "variants": [ ... ]         // 생략하면 기본 1변형(A)
}
```

## background

| 필드 | 값 | 설명 |
|---|---|---|
| `type` | `image` · `gradient` · `solid` · `split` | image = AI 배경(하이브리드), split = 비교 분할 |
| `src` | 경로 | image 전용. 스펙 파일 기준 상대경로. HTML 에 base64 인라인됨 |
| `focus` | `left` · `right` · `center` | 이미지의 피사체 위치. cover 정렬 기준이자 scrim 자동 방향의 근거 |
| `scrim` | `auto` · `left` · `right` · `bottom` · `full` · `none` | 문구 대비용 어두운 그라디언트. `auto`(기본) = focus 반대편. `none` 은 경고 |
| `colors` | `["#a","#b"]` | gradient·split 2색, solid 1색. 생략 시 테마 기본색 |
| `angle` | 도 | gradient 기본 135, split 기본 90(100 정도 주면 사선 분할) |
| `prompt` | 문자열 | **이 배경을 생성한 AI 프롬프트 원문.** image 배경이면 반드시 기록(없으면 경고) — 재생성·화풍 변형의 근거가 되고, 콘택트 시트에 표시되며 `tt.js prompt` 로 다시 꺼낸다. 변형별로 배경을 갈면 `variants[].background.prompt` 에도 기록 |

## elements — 공통 필드

| 필드 | 설명 |
|---|---|
| `id` | 변형 patch 대상 지정용. 생략 시 `type+인덱스` |
| `at` | 9구역: `left/center/right` × `top/center/bottom` 조합, 예 `left-center`. 기본 `left-center` |
| `dx` `dy` | px 미세조정 (비교 분할에서 위아래 쌓을 때 씀) |
| `rotate` | 도. 스티커·문구에 살짝 기울임 (-3~8 정도) |

**같은 구역의 흐름 요소(headline·sub·badge·sticker·cutout)는 쓴 순서대로 위→아래로 쌓인다**(간격 18px). 겹치지 않으니 kicker(sub) → headline 순서로 같은 구역에 쓰면 된다. circle·arrow 는 오버레이라 흐름 밖에서 구역 중심에 놓인다.

## 요소 7종

### headline — 훅 문구 (핵심)
```jsonc
{ "type": "headline", "at": "left-center", "size": "xl",
  "lines": ["세금 2배로", "내는 순서"],       // 줄 단위 필수 — 자동 줄바꿈 없음
  "highlight": ["2배"],                       // 강조어 → 테마 액센트색. {"word":"2배","color":"#f00"} 도 가능
  "stroke": true,                              // 기본 true(테마 외곽선). clean 테마는 원래 없음
  "box": false,                                // "solid" = 줄마다 박스, "tag" = 기울인 태그 박스
  "fill": "#fff", "rotate": 0 }
```
size: `s` 64 · `m` 92 · `l` 122 · `xl` 156(기본) · `xxl` 200px. box 를 켜면 stroke 는 자동으로 꺼진다(박스 안 텍스트는 boxText 색).

### sub — 킥커/보조 문구
```jsonc
{ "type": "sub", "text": "은퇴 전에 몰랐다가", "at": "left-top", "size": "l", "box": true }
```
size: `s` 34 · `m` 44(기본) · `l` 56px. `box:true` = 테마 박스 배경(둥근 모서리). highlight 사용 가능.

### badge — 회차/코너 표시
```jsonc
{ "type": "badge", "text": "EP.2", "at": "right-top", "style": "pill" }   // pill(액센트 알약) · corner(사선 리본)
```

### sticker — 이모지
```jsonc
{ "type": "sticker", "emoji": "⚠️", "at": "right-center", "size": "l", "rotate": 8 }
```
size: `s` 64 · `m` 96(기본) · `l` 140px.

### cutout — 누끼 이미지(인물/오브젝트 PNG)
```jsonc
{ "type": "cutout", "src": "인물.png", "at": "right-bottom", "width": 460,
  "prompt": "isolated character on transparent background, ..." }
```
배경과 별도로 얹는 전경 이미지. base64 인라인됨. AI 로 생성했다면 `prompt` 에 원문을 기록한다(`tt.js prompt` 가 같이 출력).

### circle · arrow — 강조 오버레이 (배경 위 특정 지점 가리킬 때)
```jsonc
{ "type": "circle", "at": "right-center", "w": 320, "h": 220, "dash": true }
{ "type": "arrow", "at": "center-center", "dir": "down-right", "len": 240 }
```
circle: `w`·`h`·`color`(기본 accent2)·`strokeWidth`(12)·`dash`. arrow: `dir` 8방향(right 기본)·`len`(220)·`color`(accent)·`strokeWidth`(16). 둘 다 `dx`/`dy` 로 정확한 위치를 잡는다.

## variants — A/B 변형

```jsonc
"variants": [
  { "name": "A-공포훅", "title": "이 순서로 깨면 세금이 2배가 됩니다", "patch": {} },
  { "name": "B-질문훅", "title": "연금 3개, 뭐부터 깰까? (정답은 반대)",
    "patch": { "h1": { "lines": ["정답은", "반대"], "highlight": ["반대"] },
               "kicker": { "text": "10명 중 9명이 틀리는" } },
    "background": { "scrim": "bottom" } }                // 배경 필드도 덮어쓰기 가능
]
```
`patch` 는 요소 `id` → 필드 얕은 병합. **`title` 을 반드시 함께 쓴다** — 제목·썸네일은 세트로 검증한다(콘택트 시트에 같이 표시됨).

## validate 가 잡는 것

에러(빌드 중단): 없는 theme/type/at/size/dir, headline 에 lines 없음, 이미지 파일 없음, patch 대상 id 없음, id 중복.

경고(반드시 읽을 것): 줄이 화면 폭 초과 추정(글자수×크기 계산) · headline 4줄 이상 · 흐름 요소 5개 초과(3요소 규칙 — 비교 분할 레이아웃은 좌우 쌍이라 예외적으로 넘을 수 있음, 시트로 확인) · **right-bottom 에 문구/배지(유튜브 재생시간 배지가 덮음)** · 이미지 배경에 scrim:none · **이미지 배경에 prompt 없음(재생성 근거 소실)** · highlight 단어가 lines 에 없음 · 변형에 title 없음.
