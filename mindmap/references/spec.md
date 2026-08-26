# Spec — 트리와 노드 필드

마인드맵 스펙은 **한 그루의 트리**다. 좌표·크기·줄바꿈·색 배정은 전부 라이브러리가
계산한다. 위치를 지정할 수 없고, 지정할 필요도 없다.

```jsonc
{
  "title": "심리적 안전감",       // 문서 제목. root.text 와 다르면 좌상단 헤딩으로도 그려진다
  "subtitle": "팀 위키 발췌",     // 헤딩이 있을 때만 그 아래에 붙는다
  "theme": "sketch",              // sketch · flat · editorial · bold
  "layout": "map",                // map · right · down
  "density": "standard",          // brief · standard · detailed  (validate 전용)
  "backdrop": "none",             // none · gradient · blob · vignette · glow
  "paper": false,                 // grid · dot · ruled · true(=grid) · false
  "legend": [                     // 색을 의미로 썼을 때만
    { "color": "green", "label": "완료", "icon": "check" },
    { "color": "coral", "label": "위험", "icon": "warn" }
  ],
  "links": [                      // 트리 밖의 관계 (아래 "교차 연결선")
    { "from": "r.1.0", "to": "r.2.0", "label": "영향", "color": "coral" }
  ],
  "scale": 1,                     // 전체 배율. 0.85 면 한 화면에 더 들어간다
  "padding": 48,
  "seed": "any-string",           // sketch 테마의 손떨림 난수
  "root": { "text": "심리적 안전감", "children": [ /* ... */ ] }
}
```

`root` 대신 `title` + `branches` 로도 쓸 수 있다 — `{ "title": "…", "branches": [...] }`.

---

## 노드

```jsonc
{
  "text": "회의가 조용하다",      // 필수. 라벨
  "note": "질문이 없다면 신호",   // 라벨 아래 작은 글씨 한두 줄
  "children": [ /* 노드 또는 문자열 */ ],
  "color": "coral",              // 팔레트 이름 · 0~7 · "#RRGGBB". depth 1 에서만 의미가 있다
  "icon": "경고",                // 픽토그램 (아래 "아이콘"). 세트에 없으면 글자/이모지로 찍힌다
  "status": "risk",              // done · doing · todo · risk · blocked · idea · new
  "progress": 0.65,              // 0~1. 라벨 아래 진행 막대 + 퍼센트
  "tags": ["긴급", "결제"],       // 작은 칩. 3개까지
  "image": "shots/before.png",   // 라벨 옆 썸네일. 로컬 경로는 data URI 로 박힌다
  "imageSize": "lg",             // sm · md(기본) · lg
  "emphasis": "circle",          // 노드를 통째로 감싸는 강조 원
  "mark": true,                  // 형광펜 강조. 한 장에 한두 개
  "badge": "주 120",             // 노드 우상단 알약. 숫자·상태 한 조각
  "collapsed": true,             // 처음에 접힌 채로 시작 (정적 출력에서도 자식이 숨는다)
  "side": "left"                 // map 레이아웃에서 좌/우 강제. 보통은 자동 균형에 맡긴다
}
```

**문자열은 노드의 축약형이다** — `"실수를 보고할 수 있다"` 는 `{ "text": "…" }` 와 같다.
잎 노드는 문자열로 쓰는 편이 읽기 쉽다.

```jsonc
{ "text": "무엇인가", "children": [
  { "text": "질문해도 안전", "note": "모른다고 말할 수 있다" },
  "실수를 보고할 수 있다",
  "반대 의견이 기록된다"
]}
```

---

## 아이콘 (픽토그램)

`icon` 에 이름을 주면 인라인 SVG 픽토그램이 라벨 앞에 붙는다. **149개**가 들어 있고
(scriptviz 스킬과 같은 세트라 두 산출물을 한 문서에 섞어도 톤이 맞는다),
색은 그 노드의 갈래 색을 따라간다.

```
check x plus minus right up down trendup trenddown user users userplus usercheck crowd
smile frown thumbup thumbdown id hierarchy heart star fire bolt clock alarm stopwatch
calendar hourglass won wallet creditcard bank moneybag receipt percent exchange coins
cart tag chart pie target rocket bulb search eye lock unlock shield warn info question
doc folder mail phone mobile laptop desktop server cloud database gear key link globe
pin map compass camera video mic music headphone picture broadcast newspaper share book
bell gift box truck car bus train plane ship bike walk route trophy medal ball run flag
leaf tree sun moon rain droplet speech filter refresh loop play forward home building
factory store hospital pill virus dna fitness graduation pencil ruler briefcase
presentation stamp clipboard inbox coffee food bottle code terminal bug cpu robot
sparkle plug wifi hammer scissors paint magnet layers branch sort grid crown ban
expand collapse
```

**한글로도 부른다** — `"icon": "돈"` `"사람들"` `"시간"` `"경고"` `"성장"` `"목표"`
`"아이디어"` `"자동차"` `"학교"` … 자주 쓰는 이름 200개 남짓이 별칭으로 걸려 있다.
세트에 없는 이름은 그대로 글자로 찍히므로 이모지(`"icon": "🔥"`)도 그냥 된다.

## 상태 · 진행률 · 태그

| 필드 | 그려지는 것 |
|---|---|
| `status` | 상태색 픽토그램이 붙는다 — `done`✓초록 · `doing`🕐파랑 · `todo`—회색 · `risk`⚠주황 · `blocked`🚫주황 · `idea`💡노랑 · `new`★보라 |
| `progress` | 라벨 아래 얇은 막대와 퍼센트. 0~1 |
| `tags` | 라벨 아래 작은 칩. 3개까지 |
| `image` | 라벨 옆 정사각 썸네일(모서리 둥글게). 로컬 경로는 빌드할 때 data URI 로 박힌다 |
| `emphasis` | `"circle"` — 노드를 감싸는 강조 원. 한 장에 하나 |

`status` 와 `icon` 을 함께 주면 **모양은 `icon`, 색은 `status`** 가 이긴다.

## 교차 연결선

트리는 위계만 표현한다. "이 가지와 저 가지가 얽혀 있다"는 관계는 `spec.links` 로 긋는다.

```jsonc
"links": [
  { "from": "r.1.0", "to": "r.2.0", "label": "영향", "color": "coral" },
  { "from": "r.3", "to": "r.0", "style": "solid", "arrow": false, "bend": 0.3 }
]
```

기본은 **점선 + 화살표**다 — 가지가 아니라는 표시다. `from`/`to` 는 노드 id
(`r` · `r.0` · `r.0.2`)이고, 접혀서 화면에 없는 노드를 가리키면 그 선은 그려지지 않는다.
**한 장에 두세 개까지.** 그 이상이면 트리가 아니라 그래프이고, 다른 도구가 맞다.

---

## 색

**색은 depth 1 갈래에만 지정한다.** 자식은 부모 갈래의 색을 물려받고, 그 물려받은
색이 "이건 저 갈래에 속한다"를 말해준다. 잎마다 다른 색을 주면 그 신호가 사라진다.

지정하지 않으면 `coral · teal · yellow · purple · green · blue · pink · gray` 순으로
자동 배정된다. **의미가 있을 때만 직접 지정한다** — 빨강=위험, 초록=완료처럼.

루트는 색을 주지 않으면 테마의 잉크색(중립)으로 칠해진다. 루트에 강한 색을 주면
갈래 색과 경쟁하므로, 특별한 이유가 없으면 비워둔다.

---

## 길이 예산

라벨은 문장이 아니라 **다이어그램 라벨**이다. 넘치면 깨지지 않고 줄어들지만,
줄어든 글자는 아무도 읽지 않는다. `density` 를 스펙에 적어두면 `validate()` 가
이 예산으로 검사한다.

| `density` | 라벨 | 노트 | 갈래 수 | 총 노드 |
|---|---|---|---|---|
| `brief` | ≤14자 | ≤24자 | ≤5 | ≤18 |
| `standard` | ≤20자 | ≤40자 | ≤7 | ≤45 |
| `detailed` | ≤28자 | ≤56자 | ≤9 | ≤90 |

**깊이는 예산에 없다.** 층위는 내용이 정한다 — 6단계가 필요한 내용이면 6단계로
내려간다. 깊이를 맞추려고 하위 층을 라벨 하나에 몰아 요약하지 않는다.

경고는 상한이 아니라 신호다. 내용이 정말 그만큼이면 그대로 두되, **한 장에 몰아넣을지
나눌지**를 다시 본다. 길이 경고는 따른다 — 캔버스를 키우지 말고 단어를 줄인다.
