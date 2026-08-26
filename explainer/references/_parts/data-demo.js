/* =======================================================================
   1. 설정 · 콘텐츠 · 시각화  —  ★ 여기만 교체한다 (아래 엔진 코드는 손대지 않는다)
   계약: references/template.md §2
   ======================================================================= */
const CONFIG = {
  title: '캐시(Cache)는 어떻게 동작하는가',
  subtitle: '히트·미스부터 축출 정책·무효화까지, 캐시를 넣기 전에 알아야 할 것',
  kicker: 'SYSTEM DESIGN',
  lead: '캐시는 **느린 것을 빠르게** 만드는 대신 **틀릴 위험**을 산다. 이 문서는 그 거래를 이해하는 데 필요한 최소 지식을 다룬다.',
  stats: [                        // 히어로 지표 (선택, 2~4개). 없으면 [] 로 둔다
    { v: '5', l: '섹션' },
    { v: '13', l: '퀴즈 문항' },
    { v: '3', l: '시각화' }
  ],
  quiz: 'inline',                 // 'inline' | 'off' (off면 퀴즈 버튼·패널이 사라진다)
  search: true,                   // 검색창 표시
  footer: '출처: 시스템 설계 기본 개념 정리 · 학습용 문서'
};

const SECTIONS = [
  {
    id: 'why', tag: '개념',
    title: '캐시는 왜 필요한가',
    summary: '캐시는 **한 번 비싸게 구한 결과를 가까운 곳에 복사해 두는 것**이다. 계산·조회 비용이 크고 같은 요청이 반복될 때만 이득이 생긴다. 그래서 캐시의 가치는 성능 수치가 아니라 **재사용률(히트율)** 이 결정한다.',
    keys: [
      '캐시의 효과 = 히트율 × (원본 지연 − 캐시 지연)',
      '히트율이 낮으면 캐시는 **비용만 늘리는 계층**이 된다',
      '반복되지 않는 요청(1회성 조회)에는 캐시를 넣지 않는다'
    ],
    detail: `
### 평균 응답시간으로 보는 캐시

캐시가 있는 시스템의 평균 응답시간은 단순한 가중 평균이다.

\`\`\`text
평균 = 히트율 × 캐시지연 + (1 − 히트율) × 원본지연
\`\`\`

원본이 200ms, 캐시가 2ms라면 — 히트율 90%에서 평균은 21.8ms로 **약 9배** 빨라진다.
그런데 히트율이 50%면 101ms, 즉 **개선폭이 절반으로 줄어든다**. 히트율은 선형이 아니라
체감상 90% 이후부터 급격히 좋아진다.

### 캐시가 사는 곳

| 계층 | 예 | 지연 | 특징 |
|---|---|---|---|
| 프로세스 내 | 로컬 메모리 맵 | ~0.001ms | 가장 빠르나 인스턴스마다 따로 존재 |
| 분산 캐시 | Redis, Memcached | 0.5~3ms | 여러 인스턴스가 공유, 네트워크 홉 1회 |
| CDN / 엣지 | CloudFront, Fastly | 10~40ms | 사용자에 가까움, 정적·공용 응답에 적합 |
| 브라우저 | HTTP 캐시 | 0ms | 무료지만 서버가 통제하기 가장 어렵다 |

> 캐시를 어디에 둘지는 "무엇이 느린가"가 아니라 **"같은 답을 누가 얼마나 다시 묻는가"** 로 정한다.
> 사용자마다 다른 답이면 CDN은 도움이 되지 않는다.

### 캐시를 넣지 말아야 할 때

- 쓰기가 읽기보다 많은 데이터 — 무효화 비용이 이득을 먹는다
- 요청마다 결과가 달라지는 계산(개인화 점수, 실시간 재고)
- 한 번만 조회되는 대용량 리소스 — 캐시를 채우다 메모리만 밀어낸다
`,
    viz: 'hitrate',
    quiz: [
      { type: 'choice', q: '원본 지연 200ms, 캐시 지연 0ms, 히트율 50%일 때 평균 응답시간은?',
        choices: ['50ms', '100ms', '150ms', '200ms'], answer: 1,
        why: '0.5 × 0 + 0.5 × 200 = 100ms. 히트율 50%는 절반의 요청이 여전히 원본을 그대로 부담한다.' },
      { type: 'multi', q: '캐시를 넣어도 이득이 작은 경우를 모두 고르세요.',
        choices: ['같은 상품 상세를 하루 수십만 번 조회', '사용자마다 다른 추천 점수를 매 요청 계산', '한 번만 내려받는 대용량 로그 파일', '변경이 드문 환율 테이블 조회'],
        answer: [1, 2],
        why: '재사용이 없으면(개인화 실시간 계산, 1회성 대용량) 히트가 발생하지 않는다. 1·4번은 전형적인 캐시 적합 사례다.' },
      { type: 'short', q: '캐시의 효과를 결정하는 가장 중요한 지표는? (한 단어)',
        answer: '히트율', accept: ['hit rate', 'hitrate', '캐시히트율', 'cache hit rate'],
        why: '지연 차이가 커도 히트율이 낮으면 평균은 원본 지연에 수렴한다.' }
    ]
  },
  {
    id: 'flow', tag: '동작',
    title: '조회 흐름 — 히트, 미스, 그리고 캐시 스탬피드',
    summary: '캐시 조회는 **있으면 그대로 주고(히트), 없으면 원본에서 가져와 채운다(미스)** 는 두 갈래가 전부다. 문제는 미스가 동시에 몰릴 때 생긴다 — 같은 키의 미스 1,000건이 원본 요청 1,000건으로 증폭되는 현상을 캐시 스탬피드라 한다.',
    keys: [
      '**Cache-Aside(Lazy loading)**: 애플리케이션이 미스를 감지해 직접 채운다 — 가장 흔한 패턴',
      '**Write-Through**: 쓰기 때 캐시와 원본을 함께 갱신 — 일관성 유리, 쓰기 지연 증가',
      '스탬피드 방어: 키 단위 잠금(single-flight), TTL 지터, 사전 워밍'
    ],
    detail: `
### Cache-Aside 의사코드

\`\`\`js
async function getProduct(id) {
  const key = 'product:' + id;
  const hit = await cache.get(key);
  if (hit) return JSON.parse(hit);          // 히트: 여기서 끝

  const row = await db.findProduct(id);      // 미스: 원본 조회
  await cache.set(key, JSON.stringify(row), { ex: 300 }); // 캐시 채우기(TTL 5분)
  return row;
}
\`\`\`

### 세 가지 쓰기 전략

| 전략 | 쓰기 경로 | 강점 | 약점 |
|---|---|---|---|
| Cache-Aside | 원본만 쓰고 캐시는 삭제 | 단순, 캐시 장애에 강함 | 첫 조회가 항상 미스 |
| Write-Through | 캐시 → 원본 순서로 함께 쓰기 | 읽기 일관성 좋음 | 쓰기 지연 + 쓰지도 않을 데이터 캐싱 |
| Write-Back | 캐시에 쓰고 나중에 원본 반영 | 쓰기 폭주 흡수 | 캐시 유실 = 데이터 유실 |

### 스탬피드(thundering herd) 방어

1. **single-flight** — 같은 키의 미스는 한 요청만 원본에 가고 나머지는 그 결과를 기다린다
2. **TTL 지터** — 만료 시각을 \`300s ± 10%\` 로 흩어 동시 만료를 막는다
3. **stale-while-revalidate** — 만료된 값을 잠깐 더 내주면서 뒤에서 갱신한다

> !TTL을 모든 키에 똑같이 300초로 주면, 배포 직후 채워진 캐시가 **정확히 5분 뒤 한꺼번에 만료**되어
> 트래픽 스파이크를 만든다. 실제 장애의 흔한 원인이다.
`,
    viz: 'lookup',
    quiz: [
      { type: 'choice', q: 'Cache-Aside 패턴에서 데이터가 변경되면 캐시에 대해 보통 무엇을 하는가?',
        choices: ['변경된 값으로 캐시를 갱신한다', '해당 키를 삭제(무효화)한다', '캐시 전체를 비운다', '아무것도 하지 않고 TTL을 기다린다'],
        answer: 1,
        why: '갱신(update)은 경쟁 조건에서 오래된 값을 덮어쓸 위험이 있어, 삭제 후 다음 조회에서 다시 채우는 방식이 안전하다.' },
      { type: 'tf', q: 'TTL에 지터(무작위 편차)를 주는 이유는 동시 만료로 인한 원본 부하 급증을 막기 위해서다.',
        answer: true,
        why: '동일 TTL로 채워진 키들은 동일 시점에 만료되어 스탬피드를 만든다.' },
      { type: 'short', q: '같은 키의 미스가 몰릴 때 원본 요청을 1건으로 줄이는 기법의 이름은? (영문, 하이픈 포함)',
        answer: 'single-flight', accept: ['singleflight', '싱글플라이트', 'single flight'],
        why: '뮤텍스·Promise 공유로 구현한다. Go의 golang.org/x/sync/singleflight가 대표 구현이다.' }
    ]
  },
  {
    id: 'evict', tag: '정책',
    title: '무엇을 버릴까 — 축출 정책',
    summary: '캐시는 유한하다. 가득 찬 캐시에 새 항목을 넣으려면 무언가를 버려야 하고, 그 선택 규칙이 **축출 정책**이다. LRU(가장 오래 안 쓴 것부터)가 기본값인 이유는 대부분의 접근 패턴에 **시간 지역성**이 있기 때문이다.',
    keys: [
      '**LRU** — 최근성 기준. 범용적이고 예측 가능하다',
      '**LFU** — 빈도 기준. 인기 항목이 뚜렷할 때 유리, 오래된 인기에 발목 잡힐 수 있다',
      '캐시 크기를 늘려도 히트율은 로그처럼 완만하게만 오른다'
    ],
    detail: `
### 대표 정책 비교

| 정책 | 버리는 대상 | 잘 맞는 상황 | 실패 모드 |
|---|---|---|---|
| LRU | 가장 오래 참조되지 않은 항목 | 최근 본 것을 또 보는 패턴 | 대용량 순차 스캔이 캐시를 통째로 밀어냄 |
| LFU | 참조 횟수가 가장 적은 항목 | 인기 편중이 강한 트래픽 | 과거 인기 항목이 자리를 계속 차지 |
| FIFO | 가장 먼저 들어온 항목 | 구현이 극단적으로 단순 | 최근성/빈도를 모두 무시 |
| TTL-only | 만료된 항목 | 신선도가 최우선 | 메모리 상한을 스스로 지키지 못함 |

### 실무에서 자주 쓰는 조합

- **LRU + TTL** — 자리는 최근성으로 관리하고, 신선도는 TTL로 보장한다 (Redis \`allkeys-lru\` + \`EXPIRE\`)
- **W-TinyLFU** — 빈도 추정을 작은 스케치로 유지해 LFU의 메모리 문제를 피한다 (Caffeine 기본값)
- **세그먼트 분리** — 사용자 데이터와 정적 메타데이터를 다른 캐시에 둔다. 한쪽 스캔이 다른 쪽을 밀어내지 않게

### 크기를 얼마나 줘야 하나

히트율은 캐시 크기에 대해 **수확 체감**한다. 상위 20%의 키가 접근의 80%를 차지하는 분포라면,
그 20%가 들어갈 만큼만 주면 대부분의 이득을 얻는다. 실측 없이 "메모리를 두 배로"는 거의 항상 과투자다.

> 축출이 자주 일어난다는 신호는 \`evicted_keys\` 증가다. 히트율이 낮은데 축출이 적으면
> 크기 문제가 아니라 **키 설계나 TTL 문제**다.
`,
    viz: 'lru',
    quiz: [
      { type: 'choice', q: '캐시 크기 3, LRU 정책에서 A B C A D 순으로 접근했다. D를 넣을 때 축출되는 항목은?',
        choices: ['A', 'B', 'C', '아무것도 축출되지 않는다'], answer: 1,
        why: 'A는 4번째 접근으로 최신이 되었고, B가 가장 오래 참조되지 않은 항목이다.' },
      { type: 'choice', q: '대용량 배치가 테이블을 한 번씩 순차 조회해 캐시를 전부 밀어냈다. LRU의 어떤 약점인가?',
        choices: ['시간 지역성 부족', '스캔 저항성(scan resistance) 없음', '빈도 정보 미사용', 'TTL 미지원'],
        answer: 1,
        why: '한 번만 쓰이는 항목이 최근성 기준으로 최상위에 들어와 유용한 항목을 축출한다. W-TinyLFU 같은 정책이 이를 완화한다.' },
      { type: 'multi', q: '히트율이 낮은데 축출(evicted_keys)은 거의 없다. 의심할 원인을 모두 고르세요.',
        choices: ['캐시 메모리가 부족하다', 'TTL이 너무 짧다', '키에 불필요한 변수(타임스탬프 등)가 섞여 있다', '요청 자체가 반복되지 않는다'],
        answer: [1, 2, 3],
        why: '축출이 없다는 것은 자리가 남는다는 뜻이므로 크기 문제는 아니다. 키가 매번 달라지거나 TTL이 짧아 만료가 먼저 오는 쪽을 본다.' }
    ]
  },
  {
    id: 'stale', tag: '함정',
    title: '오래된 데이터 — 무효화가 어려운 이유',
    summary: '캐시의 진짜 비용은 메모리가 아니라 **정합성**이다. 원본이 바뀌었는데 캐시가 옛 값을 들고 있으면, 시스템은 조용히 틀린 답을 아주 빠르게 내놓는다. 그래서 "허용 가능한 낡음(staleness)"을 먼저 정의해야 한다.',
    keys: [
      '무효화 방식: **TTL 만료**(단순·느슨) / **이벤트 기반 삭제**(정확·복잡)',
      '데이터마다 허용 낡음이 다르다 — 재고 0초, 상품명 5분, 약관 1일',
      '캐시가 여러 계층이면 무효화도 계층마다 필요하다 (앱 → Redis → CDN)'
    ],
    detail: `
### 허용 낡음을 먼저 문서화한다

| 데이터 | 허용 낡음 | 방식 |
|---|---|---|
| 결제 가능 재고 | 0초 (캐시 금지) | 원본 직접 조회 |
| 가격 | 수 초 | 짧은 TTL + 변경 이벤트 삭제 |
| 상품 설명·이미지 | 수 분 | TTL + CDN purge |
| 카테고리 트리 | 수 시간 | 배포 시 워밍 |

### 이벤트 기반 무효화의 함정

\`\`\`text
1) DB 업데이트 성공
2) 캐시 삭제 발행 ← 여기서 실패하면?
3) 다음 조회는 옛 값을 히트
\`\`\`

2단계는 **원자적이지 않다**. 실무에서 쓰는 완화책은 세 가지다.

1. TTL을 안전망으로 항상 함께 둔다 (이벤트 유실 시 최대 TTL만 틀림)
2. 트랜잭션 아웃박스 → 컨슈머가 삭제를 재시도한다
3. 쓰기 직후 **읽기 자기 일관성**이 필요한 화면은 캐시를 우회한다 (\`?fresh=1\`)

### 다계층 캐시의 무효화 순서

원본에 가까운 쪽부터 지운다 — **DB → 분산 캐시 → 앱 로컬 캐시 → CDN**. 순서를 뒤집으면
아직 지워지지 않은 아래 계층의 옛 값이 방금 비운 위 계층을 다시 채운다.

> !"캐시 무효화는 컴퓨터 과학의 두 어려운 문제 중 하나"라는 농담은, 정확히는
> **무효화 시점을 아는 것**이 어렵다는 뜻이다. 값을 지우는 코드는 한 줄이다.
`,
    quiz: [
      { type: 'tf', q: '이벤트 기반 무효화를 쓰면 TTL은 더 이상 필요하지 않다.',
        answer: false,
        why: '이벤트는 유실·지연될 수 있다. TTL은 그때 틀림의 상한을 정해 주는 안전망이다.' },
      { type: 'choice', q: '다계층 캐시(앱 로컬 → Redis → CDN)를 무효화하는 올바른 순서는?',
        choices: ['CDN → Redis → 앱 로컬', '앱 로컬 → CDN → Redis', 'Redis → 앱 로컬 → CDN', '원본에 가까운 계층부터, 즉 Redis → 앱 로컬 → CDN'],
        answer: 3,
        why: '원본에 가까운 쪽을 먼저 비워야, 아래 계층의 옛 값이 위 계층을 다시 채우는 역류를 막을 수 있다.' }
    ]
  },
  {
    id: 'checklist', tag: '실무',
    title: '캐시를 넣기 전 체크리스트',
    summary: '캐시는 되돌리기 어려운 결정이다. 넣기 전에 **무엇을·어떤 키로·얼마나 오래·누가 지우는지** 네 가지가 문장으로 적혀야 하고, 넣은 뒤에는 히트율과 축출을 계측해야 한다.',
    keys: [
      '키 설계가 히트율을 결정한다 — 키에 변동 요소를 섞지 않는다',
      '히트율·축출·평균 지연을 대시보드에 올린 뒤 배포한다',
      '캐시 장애 시 원본으로 폴백되는지(그리고 원본이 버티는지) 먼저 확인한다'
    ],
    detail: `
### 배포 전 7문항

1. 이 데이터는 **같은 답이 반복 조회**되는가? (히트율 추정치는?)
2. 캐시 키에 사용자·시간·실험군 같은 **변동 요소가 섞이지 않았는가**?
3. 허용 낡음은 몇 초인가? 그 근거를 누가 승인했는가?
4. 무효화 주체는 누구인가? (TTL만? 이벤트? 둘 다?)
5. 캐시가 **전부 죽으면** 원본이 그 트래픽을 견디는가? (스탬피드 방어 있는가?)
6. 히트율·\`evicted_keys\`·평균 지연을 볼 수 있는가?
7. 캐시를 끄는 스위치(feature flag)가 있는가?

### 키 설계 예

\`\`\`text
나쁜 예:  product:1234:2026-08-21T09:31:04     ← 초 단위 타임스탬프 → 영구 미스
나쁜 예:  product:1234:user:88213              ← 사용자별 분화 → 히트율 붕괴
좋은 예:  product:v2:1234                      ← 스키마 버전 + 식별자
좋은 예:  price:v1:1234:KRW                    ← 결과를 실제로 바꾸는 축만 포함
\`\`\`

키에 \`v2\` 같은 **스키마 버전**을 넣어 두면, 응답 구조가 바뀔 때 캐시를 지우지 않고
버전만 올려 자연스럽게 갈아탈 수 있다.

### 계측할 4개 지표

| 지표 | 건강한 신호 | 나쁜 신호 |
|---|---|---|
| 히트율 | 80% 이상 유지 | 배포 후 급락 → 키 변경 의심 |
| evicted_keys | 완만·안정 | 급증 → 크기 부족 또는 스캔 유입 |
| p99 지연 | 캐시 지연에 수렴 | 미스 경로가 p99를 지배 |
| 원본 QPS | 캐시 도입 후 감소 | 그대로 → 캐시가 사실상 무동작 |

> 캐시를 켜는 PR과 캐시를 끄는 PR은 같은 날 준비한다. 되돌릴 수 없는 성능 최적화는 최적화가 아니다.
`,
    quiz: [
      { type: 'multi', q: '캐시 키로 쓰기에 부적절한 요소를 모두 고르세요.',
        choices: ['요청 시각(초 단위)', '리소스 ID', 'A/B 실험 그룹(결과가 동일한 경우)', '응답 스키마 버전'],
        answer: [0, 2],
        why: '결과를 바꾸지 않는 축을 키에 넣으면 키가 쪼개져 히트율이 떨어진다. 반대로 결과를 바꾸는 축(통화, 언어)은 반드시 넣어야 한다.' },
      { type: 'short', q: '캐시 응답 구조가 바뀔 때 기존 캐시를 지우지 않고 갈아타기 위해 키에 넣는 것은? (두 글자 + 숫자 형태의 개념명)',
        answer: '스키마 버전', accept: ['버전', 'version', 'schema version', '스키마버전', 'v2'],
        why: '키에 v1/v2를 두면 새 코드는 새 키만 읽고, 옛 키는 TTL로 자연 소멸한다.' }
    ]
  }
];

/* ---- 시각화 위젯: key → { title, note, mount(host) }  (레시피: references/viz-recipes.md) ---- */
const VIZ = {
  /* 1) 파라미터 슬라이더 + 비교 막대 */
  hitrate: {
    title: '히트율이 평균 응답시간을 어떻게 바꾸는가',
    note: '슬라이더를 움직여 보세요. 히트율 90% 부근부터 개선폭이 급격히 커집니다.',
    mount(host) {
      host.innerHTML = `
        <canvas></canvas>
        <div class="viz-ctrl">
          <div class="viz-row"><label for="v-h">히트율</label><input id="v-h" type="range" min="0" max="100" step="1" value="90"><output>90%</output></div>
          <div class="viz-row"><label for="v-c">캐시 지연</label><input id="v-c" type="range" min="0" max="20" step="0.5" value="2"><output>2ms</output></div>
          <div class="viz-row"><label for="v-o">원본 지연</label><input id="v-o" type="range" min="20" max="500" step="10" value="200"><output>200ms</output></div>
        </div>
        <div class="viz-readout">
          <div class="viz-stat"><b data-o="avg">–</b><span>평균 응답</span></div>
          <div class="viz-stat"><b data-o="gain">–</b><span>개선 배수</span></div>
          <div class="viz-stat"><b data-o="save">–</b><span>원본 부하 감소</span></div>
        </div>`;
      const cv = host.querySelector('canvas'), ctx = cv.getContext('2d');
      const V = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f);
      const H = 150;
      const fit = () => { const w = cv.clientWidth || 520, d = window.devicePixelRatio || 1;
        cv.width = w * d; cv.height = H * d; cv.style.height = H + 'px'; ctx.setTransform(d, 0, 0, d, 0, 0); return w; };
      const rr = (x, y, w, h, r) => { ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill(); };
      function draw() {
        const h = +host.querySelector('#v-h').value / 100, c = +host.querySelector('#v-c').value, o = +host.querySelector('#v-o').value;
        const avg = h * c + (1 - h) * o;
        const w = fit(), pad = 92, barW = w - pad - 18;
        ctx.clearRect(0, 0, w, H);
        const rows = [{ l: '캐시 없음', v: o, col: V('--ink-sub', '#888') }, { l: '캐시 적용', v: avg, col: V('--accent', '#4b5cf6') }];
        ctx.font = '600 12px ' + V('--font', 'sans-serif');
        rows.forEach((r, i) => {
          const y = 34 + i * 58, len = Math.max(2, (r.v / o) * barW);
          ctx.fillStyle = V('--ink-sub', '#888'); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText(r.l, pad - 12, y + 13);
          ctx.fillStyle = V('--surface-2', '#eee'); rr(pad, y, barW, 26, 8);
          ctx.fillStyle = r.col; rr(pad, y, len, 26, 8);
          ctx.fillStyle = V('--ink', '#111'); ctx.textAlign = 'left';
          ctx.font = '700 12px ' + V('--font-mono', 'monospace');
          ctx.fillText(r.v.toFixed(1) + 'ms', pad + len + 8, y + 13);
          ctx.font = '600 12px ' + V('--font', 'sans-serif');
        });
        ctx.fillStyle = V('--ink-sub', '#888'); ctx.textAlign = 'center';
        ctx.fillText('막대 길이 = 원본 지연 대비 비율', w / 2, H - 12);
        host.querySelector('[data-o="avg"]').textContent = avg.toFixed(1) + 'ms';
        host.querySelector('[data-o="gain"]').textContent = (o / Math.max(avg, 0.01)).toFixed(1) + '×';
        host.querySelector('[data-o="save"]').textContent = Math.round(h * 100) + '%';
      }
      host.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
        const out = inp.parentElement.querySelector('output');
        out.textContent = inp.value + (inp.id === 'v-h' ? '%' : 'ms');
        draw();
      }));
      addEventListener('resize', draw); document.addEventListener('ex:theme', draw);
      draw(); requestAnimationFrame(draw); /* 폭이 확정되는 다음 프레임에 한 번 더 */
    }
  },

  /* 2) 단계별 흐름 다이어그램 (SVG + 스텝 컨트롤) */
  lookup: {
    title: '캐시 조회 흐름 단계별로 따라가기',
    note: '히트 시나리오와 미스 시나리오를 각각 한 단계씩 진행해 보세요.',
    mount(host) {
      const SCEN = {
        hit: [
          { on: ['app'], t: '① 앱이 상품 정보를 요청한다.' },
          { on: ['app', 'e1', 'cache'], t: '② 먼저 캐시에 키 product:1234 를 조회한다.' },
          { on: ['cache', 'e2', 'app'], t: '③ 값이 있다 — **히트**. 그대로 응답한다. DB는 호출되지 않는다.' }
        ],
        miss: [
          { on: ['app'], t: '① 앱이 상품 정보를 요청한다.' },
          { on: ['app', 'e1', 'cache'], t: '② 캐시를 조회한다.' },
          { on: ['cache'], t: '③ 값이 없다 — **미스**.' },
          { on: ['cache', 'e3', 'db'], t: '④ 원본(DB)에서 조회한다. 여기서 지연 대부분이 발생한다.' },
          { on: ['db', 'e4', 'cache'], t: '⑤ 결과를 캐시에 저장한다 (TTL 부여).' },
          { on: ['cache', 'e2', 'app'], t: '⑥ 앱에 응답한다. 다음 동일 요청은 히트가 된다.' }
        ]
      };
      host.innerHTML = `
        <svg viewBox="0 54 560 84" role="img" aria-label="캐시 조회 흐름도">
          <defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>
          <g class="fl">
            <g data-n="app"><rect x="16" y="66" width="118" height="58" rx="12"/><text x="75" y="100">앱 서버</text></g>
            <g data-n="cache"><rect x="221" y="66" width="118" height="58" rx="12"/><text x="280" y="100">캐시</text></g>
            <g data-n="db"><rect x="426" y="66" width="118" height="58" rx="12"/><text x="485" y="100">DB (원본)</text></g>
            <path data-n="e1" d="M138 84 H216" marker-end="url(#ar)"/>
            <path data-n="e2" d="M216 108 H140" marker-end="url(#ar)"/>
            <path data-n="e3" d="M343 84 H421" marker-end="url(#ar)"/>
            <path data-n="e4" d="M421 108 H345" marker-end="url(#ar)"/>
            <text class="lb" x="177" y="76">조회</text><text class="lb" x="177" y="126">응답</text>
            <text class="lb" x="382" y="76">미스 시</text><text class="lb" x="382" y="126">저장</text>
          </g>
        </svg>
        <div class="viz-ctrl">
          <button class="viz-btn on" data-s="hit">히트 시나리오</button>
          <button class="viz-btn" data-s="miss">미스 시나리오</button>
          <span style="flex:1"></span>
          <button class="viz-btn" data-go="-1">◀ 이전</button>
          <button class="viz-btn" data-go="1">다음 ▶</button>
          <button class="viz-btn" data-play>▶ 자동</button>
        </div>
        <p class="viz-note" data-cap style="margin:12px 0 0;min-height:2.6em"></p>
        <style>
          [data-viz] .fl rect{fill:var(--surface-2);stroke:var(--line);stroke-width:1.5}
          [data-viz] .fl text{fill:var(--ink);font:600 13px var(--font);text-anchor:middle}
          [data-viz] .fl text.lb{fill:var(--ink-sub);font:500 10.5px var(--font-mono);letter-spacing:.04em}
          [data-viz] .fl path{fill:none;stroke:var(--line);stroke-width:2;color:var(--line)}
          [data-viz] .fl [data-n].hi rect{fill:var(--accent-tint);stroke:var(--accent);stroke-width:2.5}
          [data-viz] .fl [data-n].hi text{fill:var(--accent)}
          [data-viz] .fl path.hi{stroke:var(--accent);color:var(--accent);stroke-width:2.8}
        </style>`;
      let scen = 'hit', i = 0, timer = null;
      const cap = host.querySelector('[data-cap]');
      const paint = () => {
        const step = SCEN[scen][i];
        host.querySelectorAll('[data-n]').forEach((el) => el.classList.toggle('hi', step.on.indexOf(el.dataset.n) > -1));
        cap.innerHTML = EX.inline(step.t) + ' <span style="opacity:.6">(' + (i + 1) + '/' + SCEN[scen].length + ')</span>';
      };
      const go = (d) => { i = (i + d + SCEN[scen].length) % SCEN[scen].length; paint(); };
      host.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
        host.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b));
        scen = b.dataset.s; i = 0; paint();
      }));
      host.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(+b.dataset.go)));
      const play = host.querySelector('[data-play]');
      play.addEventListener('click', () => {
        if (timer) { clearInterval(timer); timer = null; play.classList.remove('on'); play.textContent = '▶ 자동'; return; }
        play.classList.add('on'); play.textContent = '❙❙ 정지';
        timer = setInterval(() => go(1), 1600);
      });
      paint();
    }
  },

  /* 3) 스텝 시뮬레이터 (상태 기계 + DOM 셀) */
  lru: {
    title: 'LRU 축출 시뮬레이터',
    note: '캐시 크기를 바꿔 가며 같은 요청 순서를 재생해 보세요. 크기 3과 4의 히트율 차이를 확인할 수 있습니다.',
    mount(host) {
      const SEQ = ['A', 'B', 'C', 'A', 'D', 'B', 'E', 'A', 'D', 'C', 'A', 'B'];
      host.innerHTML = `
        <div class="viz-ctrl" style="margin:0 0 14px">
          <div class="viz-row" style="flex:0 1 220px"><label for="v-n">캐시 크기</label>
            <input id="v-n" type="range" min="1" max="5" step="1" value="3"><output>3</output></div>
          <span style="flex:1"></span>
          <button class="viz-btn" data-step>다음 요청 ▶</button>
          <button class="viz-btn" data-auto>▶ 자동</button>
          <button class="viz-btn" data-reset>처음부터</button>
        </div>
        <div data-seq style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px"></div>
        <div data-slots style="display:flex;flex-wrap:wrap;gap:8px;min-height:56px"></div>
        <p class="viz-note" data-log style="margin:12px 0 0;min-height:1.6em"></p>
        <div class="viz-readout">
          <div class="viz-stat"><b data-o="hit">0</b><span>히트</span></div>
          <div class="viz-stat"><b data-o="miss">0</b><span>미스</span></div>
          <div class="viz-stat"><b data-o="rate">–</b><span>히트율</span></div>
        </div>`;
      let cap = 3, at = 0, cache = [], hit = 0, miss = 0, timer = null;
      const el = (s) => host.querySelector(s);
      const chip = (t, style) => '<span style="' + style + '">' + t + '</span>';
      function paint(msg) {
        el('[data-seq]').innerHTML = SEQ.map((k, i) => chip(k,
          'font:700 12px var(--font-mono);padding:.3em .65em;border-radius:7px;'
          + (i < at ? 'background:var(--surface-2);color:var(--ink-sub);'
            : i === at ? 'background:var(--accent);color:#fff;'
              : 'background:transparent;border:1px dashed var(--line);color:var(--ink-sub);'))).join('');
        el('[data-slots]').innerHTML = Array.from({ length: cap }, (_, i) => {
          const k = cache[i];
          const tag = k ? (i === 0 && cache.length > 1 ? 'LRU' : i === cache.length - 1 && cache.length > 1 ? 'MRU' : '') : '';
          return '<div style="flex:1 1 68px;min-width:68px;height:56px;border-radius:10px;display:flex;'
            + 'flex-direction:column;align-items:center;justify-content:center;gap:1px;font:700 15px var(--font-mono);' + (k
              ? 'background:var(--accent-tint);border:1.5px solid var(--accent);color:var(--accent)'
              : 'background:var(--surface-2);border:1.5px dashed var(--line);color:var(--ink-sub)') + '">'
            + '<span>' + (k || '·') + '</span>'
            + '<span style="font:600 8.5px var(--font-mono);letter-spacing:.08em;opacity:.7;height:11px">' + tag + '</span></div>';
        }).join('');
        el('[data-log]').innerHTML = msg || '요청 순서를 한 단계씩 진행하면 캐시 슬롯이 어떻게 바뀌는지 보입니다. 왼쪽이 가장 오래된 항목(LRU)입니다.';
        el('[data-o="hit"]').textContent = hit; el('[data-o="miss"]').textContent = miss;
        el('[data-o="rate"]').textContent = (hit + miss) ? Math.round((hit / (hit + miss)) * 100) + '%' : '–';
      }
      function step() {
        if (at >= SEQ.length) { paint('시퀀스 종료 — 크기를 바꿔 다시 재생해 보세요.'); stop(); return; }
        const k = SEQ[at], idx = cache.indexOf(k);
        let msg;
        if (idx > -1) { cache.splice(idx, 1); cache.push(k); hit++; msg = '<b>' + k + '</b> → 히트. 최근 사용으로 올라갑니다(MRU).'; }
        else {
          miss++;
          if (cache.length >= cap) { const out = cache.shift(); msg = '<b>' + k + '</b> → 미스. 가장 오래된 <b>' + out + '</b> 를 축출하고 넣습니다.'; }
          else { msg = '<b>' + k + '</b> → 미스. 빈 슬롯에 넣습니다.'; }
          cache.push(k);
        }
        at++; paint(msg);
      }
      function reset() { at = 0; cache = []; hit = 0; miss = 0; stop(); paint(); }
      function stop() { if (timer) { clearInterval(timer); timer = null; el('[data-auto]').classList.remove('on'); el('[data-auto]').textContent = '▶ 자동'; } }
      el('#v-n').addEventListener('input', (e) => { cap = +e.target.value; e.target.parentElement.querySelector('output').textContent = cap; reset(); });
      el('[data-step]').addEventListener('click', step);
      el('[data-reset]').addEventListener('click', reset);
      el('[data-auto]').addEventListener('click', (e) => {
        if (timer) return stop();
        e.target.classList.add('on'); e.target.textContent = '❙❙ 정지';
        timer = setInterval(step, 900);
      });
      paint();
    }
  }
};
