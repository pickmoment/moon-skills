# Scenes — 장면 타입 19종

한 비트에 장면 하나. 장면은 **빌드 스텝**으로 나뉘고, 자동 재생에서는 비트 시간에
맞춰 스텝이 하나씩 열리고 수동 모드에서는 한 번 누를 때마다 하나씩 열린다.
스텝 수는 내용에서 자동으로 정해진다(각 항목에 적어둠).

모든 장면에 공통으로 쓸 수 있는 것:

| 필드 | 뜻 |
|---|---|
| `title` | 장면 왼쪽 위 제목 (`stat`·`list`·`compare`·`flow`·`timeline`·`bars`) |
| `kicker` | 그보다 작은 라벨 (`title`·`hero`·`stat`) |
| `align: "center"` | 가운데 정렬. 화면 전체를 쓰는 그래픽에 |
| `stepAt: [0, 1.2, 2.4]` | 스텝 등장 시각을 직접 지정 (초 또는 0~1 비율) |
| `bg` | 이 장면만 배경 레이어 교체 — `plain` `grid` `dots` `blob` `mesh` `rays` `scan` `noise` |
| `watermark: "03"` | 무대 뒤에 깔리는 큰 윤곽 글자. 챕터 번호·한 단어 |
| `reveal` | 등장 방식 — `up`(기본) `fade` `pop` `left` `wipe` `blur` |
| `stagger: false` | `title`·`hero` 의 단어 단위 등장을 끈다 |
| `composition` | 의미와 별개인 구도 변형. 아래 표의 장면별 허용값 사용 |
| `arc` | `setup` `tension` `evidence` `turn` `resolution` 중 현재 서사 상태 |
| `imageTreatment` | `natural` `editorial` `contrast` `duotone` `cinematic` |
| `share` | 다음 장면의 같은 이름 요소와 FLIP 전환. 문자열은 주 요소, 객체는 역할별 이름 |
| `wordEvents` | 특정 낭독 단어에서 역할 또는 공유 요소를 강조 |
| `motif` | 이 장면의 모티프 `state`·`intensity` 재정의. `false`면 숨김 |

### 구도 변형

`scene.type`은 정보의 의미, `scene.composition`은 배치만 결정한다. `SV.compositions(type)`으로
허용값을 확인한다. 자주 쓰는 조합:

| 장면 | 구도 |
|---|---|
| `hero` | `standard` `offset` `edge-crop` `center` |
| `stat` | `standard` `center-monument` `offset-monument` `edge-crop` `split-context` |
| `cards` | `standard` `open` `rail` `masonry` |
| `compare` | `standard` `axis` `stacked` |
| `image` | `standard` `full-bleed` `editorial-frame` |
| `split` | `standard` `visual-first` `overlap` |
| `flow` | `standard` `stepped` `vertical` |
| 데이터 장면 | `standard` 외 `poster` `monument` `field` `editorial` `open` 중 장면별 허용값 |

### 공유 요소·낭독 이벤트

같은 `share` 이름이 연속 장면에 있으면 이전 요소의 위치·크기에서 다음 요소로 FLIP 전환한다.
활자에서 차트로 연결할 때도 같은 이름을 쓴다.

```jsonc
[
  { "type": "hero", "text": "이탈률은 **41%**", "share": "churn" },
  { "type": "donut", "share": "churn", "items": [{"label":"이탈","value":41},{"label":"유지","value":59}] }
]
```

낭독 이벤트는 `target`에 `primary`, `title`, `item-1` 같은 역할이나 `share` 이름을 준다.

```jsonc
{ "type": "stat", "share": "churn", "items": [{"value":41,"unit":"%","label":"이탈"}],
  "wordEvents": [{"word":"마흔한", "target":"churn"}] }
```

텍스트에는 `**강조**`(악센트 색), `==형광==`(형광펜), `\n`(줄바꿈)을 쓸 수 있다.

**아이콘(픽토그램).** `list` · `cards` · `flow` · `stat` · `matrix` · `bars` · `timeline` ·
`compare`(열) · `lower` 의 항목에 `icon` 을 주면 인라인 SVG 픽토그램이 붙는다.
191종이 들어 있고, 색은 그 자리의 악센트를 따라간다.

**경제·금융 어휘 20종** (2026-08 추가) — `stock`(종목·주식·증시·캔들) · `interest`(금리·이자) ·
`tax`(세금·관세) · `loan`(대출·빚) · `bond`(채권·증서) · `dividend`(배당) · `safe`(금고) ·
`piggy`(저금통·저축) · `gold`(금괴) · `oil`(원유·유가) · `crypto`(암호화폐) · `realestate`(부동산·집값) ·
`salary`(급여·월급) · `ledger`(장부·재무제표) · `calculator`(계산기·정산) · `scale`(저울·규제) ·
`merger`(인수합병) · `container`(무역·수출입) · `umbrella`(보험) · `bubble`(거품·과열).

이미 있던 그림에도 경제 이름표를 달았다 — 환율→`exchange`, 물가·인플레→`trendup`,
경기침체→`trenddown`, 지수·거래량→`chart`, 중앙은행→`bank`, 자본·투자→`coins`,
유동성→`droplet`, 고용→`briefcase`, 기업→`building`.

**IT·개발 어휘 22종** (2026-08 추가) — `api`(API·연동) · `browser`(브라우저·프론트엔드) ·
`commit`(커밋) · `merge`(머지·병합) · `pullrequest`(풀리퀘스트·코드리뷰) · `pipeline`(파이프라인·빌드) ·
`dashboard`(대시보드·모니터링) · `queue`(큐·대기열) · `cache`(캐시) · `cube`(도커·모듈·패키지·마이크로서비스) ·
`loadbalancer`(부하분산) · `firewall`(방화벽) · `heartbeat`(헬스체크·업타임) · `gpu` · `neural`(신경망·딥러닝·모델) ·
`puzzle`(플러그인·라이브러리·확장) · `kanban`(칸반·보드·스프린트) · `ticket`(티켓·이슈) ·
`flask`(테스트·실험·QA) · `wireframe`(화면설계·UI) · `responsive`(반응형) · `webhook`(웹훅·콜백).

IT 이름표도 기존 그림에 달았다 — 배포·출시→`rocket`, 롤백·동기화→`refresh`, 저장소→`folder`,
로그·콘솔→`terminal`, 인프라·백엔드→`server`, 백업·용량→`database`, 아키텍처→`hierarchy`,
지연·응답시간→`stopwatch`, 성능→`bolt`, 장애·오류→`bug`, 권한→`key`, 인증→`usercheck`.

> `container` 는 **무역 컨테이너**다. 도커 컨테이너는 `cube` 를 쓴다.


**이름은 기억으로 쓰지 않는다.** 틀리면 그림 자리에 옅은 마름모만 남는다(예전에는 이름이
글자로 찍혔다). 스펙 검증이 미리 잡아주고, 이렇게 찾는다:

```bash
node <skill>/assets/sv.js icons 종목     # stock  종목 · 주식 · 증시 · 주가 · 코스피 …
node <skill>/assets/sv.js icons          # 191종 전체
```


| 갈래 | 이름 |
|---|---|
| 기본 | `check` `x` `plus` `minus` `right` `up` `down` `trendup` `trenddown` `user` `users` `heart` `star` `fire` `bolt` `clock` `calendar` `hourglass` `won` `wallet` `cart` `tag` `chart` `pie` `target` `rocket` `bulb` `search` `eye` `lock` `unlock` `shield` `warn` `info` `question` `doc` `folder` `mail` `phone` `laptop` `server` `cloud` `database` `gear` `key` `link` `globe` `pin` `camera` `video` `mic` `book` `bell` `gift` `box` `truck` `trophy` `flag` `leaf` `speech` `filter` `refresh` `play` `home` `building` |
| 사람 · 감정 | `userplus` `usercheck` `crowd` `smile` `frown` `thumbup` `thumbdown` `id` `hierarchy` |
| 돈 · 거래 | `creditcard` `bank` `moneybag` `receipt` `percent` `exchange` `coins` |
| 시간 | `alarm` `stopwatch` |
| 기기 · IT | `mobile` `desktop` `wifi` `code` `terminal` `bug` `cpu` `robot` `sparkle` `plug` |
| 이동 · 물류 | `car` `bus` `train` `plane` `ship` `bike` `walk` `route` |
| 미디어 | `picture` `music` `headphone` `broadcast` `newspaper` `share` |
| 건강 · 과학 | `hospital` `pill` `virus` `dna` `fitness` |
| 자연 | `sun` `moon` `rain` `droplet` `tree` |
| 교육 · 사무 | `graduation` `pencil` `ruler` `briefcase` `presentation` `stamp` `factory` `store` `clipboard` `inbox` |
| 음식 · 생활 | `coffee` `food` `bottle` |
| 스포츠 | `ball` `medal` `run` |
| 도구 · 기호 | `hammer` `scissors` `paint` `magnet` `layers` `branch` `loop` `sort` `grid` `crown` `ban` `expand` `collapse` `forward` `map` `compass` |

**한글로도 부른다.** `"icon": "돈"` `"사람들"` `"시간"` `"경고"` `"성장"` `"목표"` `"아이디어"`
`"자동차"` `"학교"` `"병원"` … 자주 쓰는 이름 200개 남짓이 별칭으로 걸려 있다.
없는 이름을 주면 **그 문자열을 그대로 글자로 찍으므로** 이모지(`"icon": "🔥"`)도 그냥 된다 —
다만 이모지는 테마 색을 따르지 않는다.

**`iconStyle`** 을 장면에 주면 아이콘 모양이 바뀐다.

| 값 | 생김새 |
|---|---|
| 없음 | 선 아이콘 그대로 |
| `"chip"` | 아이콘 색의 옅은 원 배경 |
| `"solid"` | 꽉 찬 원 안에 배경색으로 뚫린 아이콘 — 가장 눈에 띈다 |

---

## title — 오프닝·챕터 표지
```jsonc
{ "type": "title", "kicker": "EP.04", "text": "구독은 왜 무너졌나",
  "sub": "3년치 데이터로 본 이탈의 구조" }
```
스텝: 본문 → `sub`. 영상 첫 3초, 챕터가 바뀌는 자리.

## hero — 한 줄로 못 박는 메시지
```jsonc
{ "type": "hero", "text": "문제는 가격이 아니라 **첫 달**이었다",
  "sub": "첫 달을 넘기면 1년을 간다" }
```
스텝: 본문 → `sub`. **덱에서 가장 자주 쓰는 장면.** 30자가 넘으면 자동으로 한 단계 작아진다.

## stat — 숫자를 크게
```jsonc
{ "type": "stat", "title": "작년에 벌어진 일",
  "items": [
    { "value": "12", "unit": "곳", "label": "문을 닫은 구독 서비스" },
    { "value": "41", "unit": "%", "label": "첫 달 이탈률", "tone": "a2", "note": "전년 33%" }
  ],
  "caption": "출처: 자체 집계 2024" }
```
스텝: 숫자 하나당 1 + `caption`. 숫자는 **0에서 카운트업**한다(콤마·소수점 유지).
`tone`은 `a1`(악센트) `a2`(보조) 생략(흰색). 16:9는 3개, 9:16은 2개까지.
**하나만 크게 보여주는 편이 거의 항상 낫다.**

## list — 항목을 쌓아 올린다
```jsonc
{ "type": "list", "title": "무너진 이유 세 가지",
  "items": [
    { "text": "획득 비용", "note": "3년 새 2.4배" },
    { "text": "이탈률", "note": "첫 달에 41%" }
  ],
  "ordered": false }
```
스텝: 항목당 1. 기본은 번호 칩, `ordered: false` 면 점. `icon`에 이모지를 넣으면 번호를 대신한다.

## compare — 두세 갈래를 맞세운다
```jsonc
{ "type": "compare", "title": "두 갈래 길",
  "columns": [
    { "title": "구독 유지", "items": ["예측 가능한 매출", "높은 획득 비용"] },
    { "title": "광고 전환", "items": ["진입 장벽이 없다", "규모가 필요하다"] }
  ],
  "verdict": "규모가 없으면 광고는 답이 아니다" }
```
스텝: 열당 1 + `verdict`. 2열이면 가운데 **VS** 배지가 붙는다(`"vs": false` 로 끄거나 문구 교체).

## flow — A → B → C
```jsonc
{ "type": "flow", "title": "이탈이 생기는 경로",
  "steps": [
    { "text": "가입", "note": "첫날 기대치 최고" },
    { "text": "3일차", "note": "쓸 이유를 못 찾음" },
    { "text": "결제일", "note": "해지 버튼" }
  ]}
```
스텝: 노드당 1. 현재 스텝의 노드가 강조된다. 5개까지.

## timeline — 시점 위에 사건
```jsonc
{ "type": "timeline", "title": "3년의 흐름",
  "items": [
    { "when": "2022", "text": "구독 붐", "note": "신규 서비스 급증" },
    { "when": "2024", "text": "광고 전환", "note": "아홉 곳이 갈아탔다" }
  ]}
```
스텝: 시점당 1. 9:16에서는 세로 축으로 바뀐다.

## quote — 인용
```jsonc
{ "type": "quote", "text": "우리는 고객을 산 게 아니라 **빌린** 것이었다",
  "by": "익명", "role": "전 구독 서비스 대표" }
```
스텝: 본문 → 출처.

## bars — 막대 비교
```jsonc
{ "type": "bars", "title": "1인당 획득 비용", "unit": "천원", "max": 50,
  "items": [
    { "label": "검색 광고", "value": 42 },
    { "label": "추천", "value": 7, "tone": "mute" }
  ],
  "caption": "2024년 4분기", "together": false }
```
스텝: 막대당 1(+`caption`). `together: true` 면 한꺼번에 자란다.
`tone`: 생략(악센트) `b2`(보조) `mute`(회색). `max`를 주면 축이 고정된다.

## image — 사진·스크린샷
```jsonc
{ "type": "image", "src": "shots/office.jpg", "caption": "2026년 3월, 마지막 사무실",
  "fit": "cover", "kenburns": true }
```
스텝: 이미지 → 캡션. `fit` 은 `cover`(기본, 화면을 채우고 잘림) · `contain`(다 보이게).
`kenburns` 는 14초에 걸친 아주 느린 줌(기본 켜짐, `false` 로 끈다).

**사진을 반쪽만 쓰려면** `split` 의 `right.src` 를 쓴다 — 패널을 꽉 채운다.

### 이미지는 이렇게 넣는다

**경로는 스펙 파일이 있는 폴더 기준**이고, 빌드할 때 **data URI 로 박힌다** — 산출물
하나만 들고 다니면 어디서든 사진이 보인다.

```
deck.json
shots/office.jpg     ->  "src": "shots/office.jpg"
```

| 넣는 방식 | 어떻게 되나 |
|---|---|
| 로컬 경로 | data URI 로 파일 안에 박힌다 (권장) |
| `data:image/...` 직접 | 그대로 쓴다 |
| `https://...` | **파일 안에 안 들어간다.** 오프라인·녹화에서 빈칸이 된다 — 빌드가 경고한다 |

**지원 형식**: `png` · `jpg` · `jpeg` · `gif` · `webp` · `svg`

**크기**: 화면은 1920 폭이면 충분하다. base64 는 원본의 4/3 로 불어나므로 큰 사진을 그대로
넣으면 HTML 이 몇 MB 가 된다. 900KB 를 넘으면 빌드가 경고한다.

```bash
# 넣기 전에 줄인다
sips -Z 1920 shots/office.jpg          # macOS
```

빌드가 알려주는 것 — 못 찾은 경로, 인터넷 주소, 큰 파일:
```
inlined 2 image(s) as data URI
! 이미지를 찾지 못했다 (화면에 안 나온다): shots/없는파일.png
  경로는 스펙 파일이 있는 폴더 기준이다
```

## split — 왼쪽 말, 오른쪽 그림
```jsonc
{ "type": "split",
  "left": { "kicker": "핵심", "title": "남은 건 하나",
            "items": ["첫 달을 어떻게 넘기나", "그다음은 저절로 간다"] },
  "right": { "flow": [ { "icon": "문서", "text": "설문 화면" },
                       { "icon": "확인", "text": "관리 상태" } ] } }
```
스텝: 왼쪽 → 오른쪽.

**`right` 는 아래 중 하나다. 위에 있는 것부터 고른다** — 아래로 갈수록 스킬이 보증하는
게 줄어든다.

| 값 | 그림 | 언제 |
|---|---|---|
| `flow` | 아이콘+글자 노드가 화살표로 이어진다 (2~3단계) | A → B 흐름, 전후 대비 |
| `picto` + `label` | 픽토그램 하나를 크게 | 개념 하나를 상징으로 |
| `stat` | 큰 숫자 하나 (`value` `unit` `label` `note`) | 오른쪽에 수치를 세울 때. 카운트업이 붙는다 |
| `items` | 아이콘 목록 (`{icon, text}`) | 항목 3~4개 |
| `quote` + `by` | 인용 | 말을 세울 때 |
| `src` | 이미지 (data URI 로 심긴다) | 사진·스크린샷 |
| `svg` | 손으로 짠 SVG | 위로 안 되는 도해. `visualthink`·`mindmap` 산출물을 넣는 자리 |
| `html` | 손으로 짠 HTML | 마지막 수단 |

```jsonc
"right": { "picto": "저울", "label": "관리 상태" }
"right": { "stat": { "value": "41", "unit": "%", "label": "자동승인 비중", "note": "전년 33%" } }
"right": { "items": [ { "icon": "금고", "text": "자산 보관" }, { "icon": "권한", "text": "접근 권한" } ] }
"right": { "quote": "설문은 답을 묻지만\n관리는 상태를 본다", "by": "내부 감사 지침" }
```

> **`svg` · `html` 은 스킬이 크기·선굵기·글꼴을 보증하지 못한다.** 특히 **24×24 아이콘
> viewBox 를 이 패널에 넣으면 안 된다** — 패널만큼 커지면서 `stroke-width: 2` 가 수십 px
> 로 뭉개진다. `validate` 가 경고하지만, 애초에 `flow`·`picto` 로 되는 일인지 먼저 본다.
> 손으로 짜야 하면 viewBox 를 실제 도해 크기(예: `0 0 400 300`)로 잡고 `stroke-width` 를
> 2~3 으로 둔다. 글꼴 크기는 `var(--fs-h3)` 처럼 변수를 쓴다 — 숫자를 박으면 9:16 에서
> 어긋난다.

## lower — 로어서드 자막
```jsonc
{ "type": "lower", "text": "김문근", "sub": "구독 경제 리서치" }
```
스텝 1. 화면 왼쪽 아래 이름표. `X` 키로 배경을 크로마키 색으로 바꾸면
그대로 합성 소재가 된다.

## cards — 아이콘 카드 격자
```jsonc
{ "type": "cards", "title": "무너진 이유 세 가지", "cols": 3,
  "items": [
    { "icon": "won", "text": "획득 비용", "note": "3년 새 2.4배" },
    { "icon": "users", "text": "이탈률", "note": "첫 달에 41%", "tone": "b" },
    { "icon": "chart", "text": "콘텐츠 단가", "note": "경쟁이 값을 올렸다", "tone": "c" }
  ]}
```
스텝: 카드당 1(+`caption`). 16:9는 4장, 9:16은 2장까지(세로에서는 한 줄로 쌓인다).
**`list` 와 갈리는 지점은 아이콘이다.** 아이콘 없이 쓸 거면 `list` 가 낫다 —
`validate()` 가 그렇게 경고한다.

## donut — 비율 원형
```jsonc
{ "type": "donut", "title": "매출 구성", "unit": "%",
  "items": [
    { "label": "구독", "value": 52 }, { "label": "광고", "value": 31 },
    { "label": "제휴", "value": 12 }, { "label": "기타", "value": 5 }
  ],
  "center": { "value": "52%", "label": "아직은 구독" },
  "caption": "2024년 4분기" }
```
스텝: 조각당 1(+`caption`). 조각은 순서대로 **그려지며 채워진다**. 5조각까지 —
나머지는 "기타"로 묶는다. `center` 를 생략하면 첫 조각의 비율이 가운데에 들어간다.
`total` 을 주면 합이 100이 아니어도 된다.

## line — 추이 꺾은선
```jsonc
{ "type": "line", "title": "구독자 추이",
  "xLabels": ["1월", "3월", "5월", "7월", "9월", "11월"],
  "series": [
    { "label": "신규", "values": [120, 138, 131, 150, 142, 158] },
    { "label": "해지", "values": [40, 52, 61, 78, 95, 121], "tone": "accent2" }
  ],
  "max": 200, "area": false, "caption": "단위: 천 명" }
```
스텝: 계열당 1(+`caption`). 선은 **왼쪽부터 그려진다.** 계열 3개·점 12개까지.
첫 계열에는 면적이 깔린다(`area: false` 로 끈다). 계열 하나면 `values` 만 줘도 된다.

## pictograph — 아이소타입(그림으로 세는 수)

퍼센트를 **세어 볼 수 있는 그림**으로 바꾼다. 같은 41%라도 `stat` 보다 훨씬 세게 박힌다.
쓰는 방식이 셋이다.

**① 기본 — 전체 중 채워진 만큼**
```jsonc
{ "type": "pictograph", "title": "열 명 중 넉 명",
  "total": 100, "filled": 41.5, "icon": "사람", "cols": 20, "chunk": 10,
  "label": "첫 달에 떠난다", "size": "md", "tone": "accent", "caption": "2024년 코호트" }
```
스텝: 1(+`caption`). `filled` 에 소수를 주면 **마지막 한 칸이 그 비율만큼만 찬다**(41.5 → 반 칸).
`chunk: 10` 은 열 개마다 사이를 벌려 세기 쉽게 만든다. `size` 는 `sm` · `md` · `lg`.

**② `groups` — 한 격자를 여러 색으로 나눠 채우기**
```jsonc
{ "type": "pictograph", "title": "100명이 어디로 갔나", "total": 100, "chunk": 10,
  "groups": [
    { "label": "계속 구독", "value": 59, "icon": "usercheck" },
    { "label": "광고 요금제로", "value": 26, "tone": "accent2" },
    { "label": "완전 이탈", "value": 15, "tone": "muted" }
  ]}
```
스텝: 그룹당 1. 그룹마다 **차례로 불이 들어오고** 아래에 범례가 붙는다.
`donut` 과 같은 데이터지만, 이쪽은 "몇 명인지"가 먼저 읽힌다. 그룹 4개까지.

**③ `rows` — 두세 줄을 나란히 놓고 비교**
```jsonc
{ "type": "pictograph", "title": "2년 사이", "size": "sm", "chunk": 10,
  "rows": [
    { "label": "2022", "total": 100, "filled": 22, "value": "22%" },
    { "label": "2024", "total": 100, "filled": 41, "value": "41%", "tone": "accent2" }
  ],
  "caption": "첫 달 이탈률" }
```
스텝: 줄당 1. 같은 척도로 시점·집단을 견준다. 줄 4개까지.

한 화면에 아이콘 100개까지(9:16은 60개). 그보다 많으면 세는 그림이 아니라 무늬가 된다.

## funnel — 단계별 이탈
```jsonc
{ "type": "funnel", "title": "가입 퍼널", "unit": "명",
  "items": [
    { "label": "방문", "value": 10000 }, { "label": "가입", "value": 3200 },
    { "label": "첫 결제", "value": 1100 }, { "label": "3개월 유지", "value": 640 }
  ],
  "scale": "soft", "drop": true }
```
스텝: 단계당 1(+`caption`). 라벨과 값은 도형 **바깥 오른쪽**에 붙고, 단계 사이의
감소율(`▼ 68%`)이 자동으로 계산된다(`drop: false` 로 끈다).
`scale: "soft"`(기본)는 폭 차이를 눌러 뒤 단계도 읽히게 한다 — 값 그대로 그리려면 `"linear"`.

## matrix — 2×2 사분면
```jsonc
{ "type": "matrix", "title": "무엇부터 할까",
  "xAxis": ["비용 낮음", "비용 높음"],
  "yAxis": ["효과 작음", "효과 큼"],
  "quadrants": [
    { "icon": "bolt", "text": "바로 한다", "note": "온보딩 메일" },
    { "icon": "target", "text": "계획해서", "note": "가격 개편", "tone": "b" },
    { "icon": "clock", "text": "나중에", "note": "디자인 리뉴얼", "tone": "mute" },
    { "icon": "x", "text": "버린다", "note": "신규 채널", "tone": "mute" }
  ]}
```
스텝: 4. 순서는 **좌상 → 우상 → 좌하 → 우하**. `xAxis` 는 `[왼쪽, 오른쪽]`,
`yAxis` 는 `[아래, 위]`.

## raw — 탈출구
```jsonc
{ "type": "raw", "steps": 3,
  "html": "<div class='rv' data-at='0'>…</div><div class='rv' data-at='2'>…</div>" }
```
장면 타입으로 안 되는 컷에만. `class="rv" data-at="N"` 을 붙이면 그 스텝에서 등장한다.
CSS 변수(`--accent`, `--ink`, `--fs-hero` …)를 그대로 쓸 수 있고, `spec.css` 에
스타일을 추가할 수 있다. **raw 가 전체의 4분의 1을 넘으면 설계를 다시 본다.**

## fx — 강조 이펙트 (선택)

비트가 화면에 올라오는 순간 **한 번 터지는** 연출이다. 장면 위에 얹히기만 하고
낭독 시계·장면 렌더링은 건드리지 않는다. 쓰면 mo.js 가 산출물에 실린다(+116KB) —
**안 쓰면 산출물은 예전과 완전히 같다.**

```jsonc
{ "say": "…", "scene": { … }, "fx": "impact" }

{ "fx": { "kind": "picto", "icon": "하트", "at": "focus", "step": 0,
          "count": 9, "radius": 400, "size": 26,
          "colors": ["accent2"], "duration": 1100 } }

{ "fx": ["ripple", { "kind": "sparkle", "step": 1 }] }   // 여러 개도 된다
```

| kind | 그림 | 언제 |
|---|---|---|
| `burst` | 한 점에서 방사로 터진다 | 수치 확정, 결론 |
| `ripple` | 링 두 겹이 퍼진다 | 여기를 보라 |
| `impact` | 링 + 방사 라인 | 큰 숫자가 꽂힐 때 |
| `pop` | 작은 링 + 점 여섯 | 항목 하나를 짚을 때 |
| `sparkle` | 별가루가 사방으로 | 좋은 소식 |
| `confetti` | 위에서 색종이 | 축하, 마무리 |
| `rise` | 아래에서 입자가 떠오른다 | 비트 내내 깔리는 앰비언트 |
| `picto` | 픽토그램이 터진다 (`icon` 필수) | 하트 반응, 별점, 주제 그림 |

**`at` — 어디서 터지나**

| 값 | 자리 |
|---|---|
| 생략 · `"focus"` | 그 장면의 주인공 요소 (기본) |
| `"center"` `"top"` `"bottom"` `"left"` `"right"` | 무대 기준 |
| `".pgrid"` 같은 선택자 | 그 요소의 중심 |
| `{ "x": "62%", "y": "40%" }` | 무대 좌표 |

장면별 주인공은 자동으로 잡힌다 — `stat`은 숫자, `pictograph`는 그리드,
`quote`는 인용문, `flow`는 첫 노드, `title`·`hero`는 큰 글자.

**`step`** 은 몇 번째 스텝에서 터질지다(기본 0 = 비트 진입). `colors` 는 테마 토큰
(`accent` `accent2` `ink` `muted`)이나 CSS 색.

**정지컷(PNG)에는 안 담긴다.** 컷 캡처는 애니메이션이 끝나길 기다렸다 찍는 방식이라
반쯤 터진 파티클이 들어가면 못 쓰는 컷이 된다 — `shots.js` 가 PNG 모드에서는 아예
발사하지 않는다(`?fx=0`). **`--video` 녹화와 실제 재생에서만 보인다.**
동작 줄이기(`prefers-reduced-motion`)가 켜진 환경에서도 발사하지 않는다.
