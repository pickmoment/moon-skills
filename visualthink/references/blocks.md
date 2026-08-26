# Blocks — fields and JSON for every block type

The reference for writing the spec itself. For *which* block to reach for, read
`composition.md`.

## Common fields

Every item in `items` / `columns` / `branches` / `quadrants` accepts:

```jsonc
{
  "text":     "제목",           // also accepts: label, title, name
  "note":     "부연 설명",       // also accepts: desc, description, sub, detail
  "icon":     "bulb",           // see icon list below; unknown names are ignored
  "color":    "coral",          // palette name, index (0-7), or "#RRGGBB"
  "emphasis": true,             // highlighter swipe behind the text
  "badge":    "NEW",            // small pinned label
  "value":    "70%",            // stats / timeline: the figure or date

  "shape":    "cloud",          // silhouette; see Shapes below
  "mark":     "circle",         // annotation drawn around the card
  "pin":      "tape",           // tape | pin | clip fastener
  "tilt":     true              // true, or degrees (e.g. -1.5)
}
```

A plain string is valid shorthand: `"items": ["접수", "검토", "승인"]`.

**Colors** — omit `color` and each item is auto-assigned from the palette in order.
Set it explicitly only when the colour carries meaning (red = risk, green = done).

`coral` `teal` `yellow` `purple` `green` `blue` `pink` `gray`

---

## Blocks

### title — page headline (use once, at the top)
```jsonc
{ "type": "title", "text": "전작권 전환", "sub": "쟁점 요약", "icon": "flag",
  "align": "center", "highlight": true }
```
Shortcut: `{ "title": "…", "subtitle": "…" }` at the spec root does the same.

### callout — one message that must land
```jsonc
{ "type": "callout", "variant": "bubble", "label": "한 줄 요약", "icon": "bulb",
  "color": "yellow", "text": "핵심은 시점이 아니라 조건이다." }
```
`variant`: `box` (default) · `bubble` (speech tail) · `sticky` (folded note) · `bar` (quiet aside)

### flow — A → B → C, wraps to new rows automatically
```jsonc
{ "type": "flow", "title": "절차",
  "items": ["접수", "검토", "승인", "배포"],
  "arrowLabels": ["1일", "3일", "즉시"],   // optional, between items
  "perRow": 4 }                            // optional, otherwise auto
```

### steps — ordered procedure, numbered vertical rail
```jsonc
{ "type": "steps", "title": "검증 단계", "items": [
  { "text": "기본운용능력", "note": "지휘통제 체계 검증", "icon": "gear" },
  { "text": "완전운용능력", "note": "전 영역 주도 능력" }
]}
```

### cycle — a loop with no beginning or end
```jsonc
{ "type": "cycle", "title": "PDCA", "center": "개선",
  "items": ["계획", "실행", "점검", "조치"] }
```
Works best with 3–6 items. `center` is optional.

### timeline — events on a date axis
```jsonc
{ "type": "timeline", "title": "경과", "items": [
  { "value": "2014", "text": "합의", "note": "조건 기반" },
  { "value": "2026", "text": "재추진", "color": "coral" }
], "alternate": true }
```
`value` is the date/marker; `text` is the event. Labels alternate above/below.

### mindmap — one concept, its facets, their details
```jsonc
{ "type": "mindmap", "title": "구조", "center": "전환 조건", "branches": [
  { "text": "군사 능력", "color": "blue", "children": ["ISR", "정밀타격"] },
  { "text": "안보 환경", "color": "coral", "children": ["북핵 위협"] }
]}
```
Branches split evenly left and right. `children` are plain strings, one level deep.
Keep to **4–8 branches** and **≤4 children** each.

### compare — positions set against each other
```jsonc
{ "type": "compare", "title": "두 시각", "columns": [
  { "title": "찬성", "icon": "check", "color": "teal",
    "items": [{ "text": "주권 회복", "emphasis": true }, "자주국방"] },
  { "title": "우려", "icon": "warn", "color": "coral",
    "items": ["능력 격차", "억제력 저하"] }
]}
```
Exactly 2 columns draws a **VS** marker. 3–4 columns also work.

### grid — peer items, no ordering
```jsonc
{ "type": "grid", "title": "핵심 역량", "cols": 4, "items": [
  { "text": "정보", "note": "ISR 자산", "icon": "eye" },
  { "text": "타격", "note": "킬체인", "icon": "target" }
]}
```

### matrix — two dimensions, four quadrants
```jsonc
{ "type": "matrix", "title": "우선순위",
  "xAxis": ["시급성 낮음", "시급성 높음"],
  "yAxis": ["영향 작음", "영향 큼"],
  "quadrants": [
    { "text": "관망", "note": "장기" },        // top-left
    { "text": "즉시 착수", "icon": "fire" },   // top-right
    { "text": "제외" },                        // bottom-left
    { "text": "준비" }                         // bottom-right
  ]}
```
Order is **TL, TR, BL, BR**. Always supply exactly 4.

### pyramid — hierarchy (or funnel with `invert`)
```jsonc
{ "type": "pyramid", "title": "계층", "invert": false, "items": [
  { "text": "전략", "note": "국가 목표" },
  { "text": "작전" },
  { "text": "전술" }
]}
```
First item is the **apex**. `"invert": true` makes it a funnel (wide at top).

### stats — headline figures
```jsonc
{ "type": "stats", "title": "숫자로 보기", "items": [
  { "value": "70%", "text": "진척률" },
  { "value": "3단계", "text": "검증 절차" }
]}
```
2–4 items. `value` is the big number, `text` is the label beneath.

### list — points to remember
```jsonc
{ "type": "list", "title": "기억할 것", "numbered": true, "items": [
  { "text": "조건이 기준이다", "note": "날짜가 아니라" },
  { "text": "격차는 ISR에 있다", "emphasis": true }
]}
```
`"numbered": true` for 1·2·3; otherwise each item's `icon` (or a checkmark) is used.

### actors — people, roles, stakeholders
```jsonc
{ "type": "actors", "title": "이해관계자", "items": [
  { "text": "사용자", "pose": "shrug", "face": "worried", "says": "왜 안 되죠?", "fx": "sweat" },
  { "text": "담당자", "pose": "point", "face": "happy",   "note": "정책 부서" },
  { "text": "검토자", "pose": "think", "face": "think",   "thinks": "근거가 부족한데" },
  { "text": "승인",   "pose": "raise", "face": "laugh",   "shout": "YAY!", "fx": "confetti" }
]}
```

Doodle figures — big head, outlined garment, expressive face.

| field | values |
|---|---|
| `pose` | `stand` `point` `raise` `wave` `think` `shrug` `hold` `strong` `cheer` `jump` `walk` `run` `fall` `sit` |
| `face` | `neutral` `happy` `laugh` `sad` `cry` `surprised` `shock` `angry` `think` `love` `starry` `sleep` `wink` `worried` `dead` `blank` |
| `fx` | `sparkle` `star` `heart` `note` `question` `exclaim` `zzz` `sweat` `confetti` `motion` — one name or an array |
| `body` | `shirt` (default) · `skirt` |
| `says` | speech bubble |
| `thinks` | thought bubble (dotted trail) |
| `shout` | large un-bubbled interjection above the head — `"YAY!"` `"OMG!"` |

Natural aliases resolve throughout: `celebrate`→raise, `hello`→wave, `flex`→strong,
`oops`→fall, `wow`→surprised, `panic`→shock, `haha`→laugh, `boohoo`→cry,
`zzz`→sleep, `idea`→sparkle, `party`→confetti.

**Pick pose and face to carry the meaning.** A `shrug` + `worried` says
"nobody owns this" faster than a sentence. Use `shout` for reactions and `says`
for content. 2–5 figures; more and they stop being individuals.

Use it for **who is involved**, not as decoration.

### scene — one figure making a statement
```jsonc
{ "type": "scene", "side": "left", "thinks": false,
  "actor": { "text": "담당자", "pose": "point", "face": "neutral", "fx": "sparkle" },
  "text": "시점이 아니라 조건의 문제입니다." }
```
`side` puts the figure on the `left` (default) or `right`. The bubble's tail
points back at the figure automatically.

### quote / divider / spacer
```jsonc
{ "type": "quote", "text": "능력의 문제다.", "by": "정책 보고서" }
{ "type": "divider", "style": "wave" }      // wave · dots · line
{ "type": "spacer", "size": 24 }
```

---

## Icons

`bulb` `check` `cross` `warn` `star` `person` `people` `doc` `clock` `money`
`target` `question` `heart` `chart` `trend` `flag` `lock` `search` `fire`
`rocket` `eye` `shield` `bolt` `link` `gear` `brain` `chat` `calendar` `book`
`plus` `minus` `arrowUp` `arrowDown` `globe` `pin`

Natural aliases also resolve: `idea`→bulb, `risk`→warn, `goal`→target, `time`→clock,
`cost`→money, `team`→people, `growth`→trend, `urgent`→fire, `ai`→brain, `ok`→check,
`launch`→rocket, `security`→shield, `deadline`→clock, and others.

Unknown icon names are silently dropped at render time and reported by `validate()`
as a warning. Icons are optional — a diagram with no icons is fine.

---

## Shapes

`shape` on any item changes its silhouette. **Shape carries meaning — pick one
that says something**, or omit it and get the theme's default.

| shape | reads as |
|---|---|
| `round` (default), `rect` | a plain item |
| `pill` | a label or tag |
| `ellipse` | a hub or a start/end node |
| `cloud` | an idea, a hypothesis, something not yet fixed |
| `burst` | an alarm, a breakthrough, a shock |
| `banner` | a heading or a phase marker |
| `tag` | a category, a label, an aside |
| `scroll` | a document, a policy, a record |
| `sticky` | a note somebody left |
| `hex` | a component or a module |
| `diamond` | a decision point |
