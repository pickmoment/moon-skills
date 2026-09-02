# 썸네일 구성 판단

## 0. 이 스킬이 맞는가

정지 이미지 썸네일 + 제목 세트를 만드는 스킬이다. 움직이는 인트로·모션은 `mojs`/`mograph`, 대본에 맞춘 영상 화면은 `scriptviz`, 대본 자체는 `youtube-script`. youtube-script 의 배포 패키지(제목 후보·썸네일 문구)가 있으면 그걸 입력으로 받아 세트를 완성한다.

## 1. 레이아웃 패턴 6종

| 패턴 | 언제 | 스펙 골격 |
|---|---|---|
| **인물+문구** (하이브리드 기본) | 사람 얼굴이 있으면 CTR 이 오른다. 리액션·주장·스토리 | `background:image(focus:right)` + 왼쪽에 sub(킥커)→headline. §3 프롬프트로 배경 생성 |
| **순수 타이포** | 개념·정보·리스트. 배경 생성 대기 없이 즉시 | `background:gradient` + headline(xl~xxl) + sub + badge |
| **비교 분할** | A vs B, 선택 문제 | `background:split` + 좌우 각각 headline/sub(dy 로 쌓기) + 중앙 sticker(⚔️/🆚) |
| **오브젝트+라벨** | 물건·화면·차트가 주인공 | `background:image(focus:center, scrim:bottom)` + 하단 headline + circle/arrow 로 지점 강조 |
| **숫자 강조** | 금액·퍼센트·순위 | headline 1줄에 숫자만 xxl + highlight, sub 로 맥락 |
| **비포/애프터** | 변화·실험 결과 | split 또는 이미지 + 좌우 sub(box) + arrow(right) |

## 2. 원칙 — 작게 봐도 살아남는가

- **3요소 규칙.** 시선이 닿는 덩어리(문구·인물·스티커)는 3개 이하. 흐름 요소 5개 초과면 validate 가 경고한다(비교 분할만 예외).
- **headline 은 줄당 2~7자, 최대 3줄.** 자동 줄바꿈이 없으니 의미 단위로 직접 쪼갠다. "세금 2배로 / 내는 순서"처럼 줄 끝이 궁금증을 남기게.
- **highlight 는 한 문구에 1~2단어.** 전부 칠하면 아무것도 안 튄다.
- **right-bottom 은 버리는 땅.** 유튜브 재생시간 배지가 덮는다. badge 는 right-top, 회차 리본은 left-bottom.
- **제목이 말한 단어를 썸네일이 반복하지 않는다.** → title.md 역할분담.
- 최종 판정은 콘택트 시트(`?sheet=1`)의 **168×94** 에서 한다. 거기서 headline 이 안 읽히면 실패다. sub 는 168 에서 안 읽혀도 된다(320 피드에서 읽히면 충분).

## 3. AI 배경 프롬프트 (하이브리드)

문구는 엔진이 얹는다. **이미지 모델에게 텍스트를 맡기지 않는다** — 한글 렌더링이 깨지고, 문구 수정마다 재생성해야 한다. 배경에게 시키는 것은 넷: 피사체, 감정, 여백, 조명.

Nano Banana 2 기준 템플릿 (사용자에게 복사용으로 제시):

**인물형**
```
YouTube thumbnail background, 16:9. A [나이/성별/인상착의] with an exaggerated
[shocked/skeptical/triumphant] expression, positioned on the RIGHT third of the
frame, looking toward the LEFT (toward empty space). LEFT half of the frame is
clean dark negative space for text overlay. Dramatic rim lighting, high contrast,
shallow depth of field, cinematic color grade. NO text, NO letters, NO logos.
```

**오브젝트형**
```
YouTube thumbnail background, 16:9. Extreme close-up of [대상], centered,
dramatic studio lighting on a dark background. Bottom third of the frame is
darker empty space for text overlay. High contrast, punchy colors.
NO text, NO letters, NO watermarks.
```

바꿔 끼우는 곳: 피사체·감정·**여백 방향**(문구를 왼쪽에 놓을 거면 RIGHT 에 피사체). 시선은 문구 쪽을 향하게 하면 시선 유도가 된다.

### 화풍 프리셋 10종

템플릿의 조명·질감 부분("Dramatic rim lighting, high contrast, …")을 아래 키워드로 갈아 끼운다. 여백·시선·NO text 지시는 화풍과 무관하게 그대로 둔다.

| 화풍 | 어떤 채널/영상 | 프롬프트 키워드 | 어울리는 테마 |
|---|---|---|---|
| 시네마틱 실사 | 다큐·심층·역사 | cinematic photo, dramatic rim lighting, shallow depth of field, film grain | docu |
| 과장 리액션 실사 | 예능·리액션·챌린지 | studio portrait photo, exaggerated shocked expression, punchy saturated colors | impact |
| 3D 카툰 렌더 | 설명형·과학·경제 교양 | 3D render, Pixar style character, soft studio lighting, vibrant colors | impact · story |
| 웹툰/만화 일러스트 | 썰·스토리텔링·사연 | Korean webtoon style illustration, flat cel shading, expressive comic character | story |
| 플랫 벡터 | 지식·경제·트렌드 | flat vector illustration, minimal geometric shapes, limited 2-3 color palette | clean · finance |
| 오브젝트 스튜디오샷 | 리뷰·테크·제품 | extreme close-up, product photography, dark studio background, single light source | impact · finance |
| 포토 콜라주 | 이슈·시사·연예 | photo collage composition, cutout elements, bold contrast | impact |
| 손그림 스케치 | 교육·요약·독서 | hand-drawn sketch, whiteboard doodle style, notebook texture | clean |
| 레트로 아카이브 | 역사·사건 재조명 | vintage newspaper print, archival photo texture, sepia tone | docu |
| 네온/글리치 | 게임·테크·미래 | neon glow, cyberpunk color palette, dark background with glowing accents | story · impact |

고르는 기준 셋: **① 채널 단위로 고정한다** — 화풍이 편마다 바뀌면 피드에서 채널 정체성이 사라진다(테마와 같은 원리). **② 훅과의 궁합** — 공포·경고 훅에 3D 카툰은 힘이 빠지고, 담백한 정보 영상에 과장 리액션 실사는 낚시 냄새가 난다. **③ 밝은 화풍(플랫 벡터·손그림)에는 clean 테마**를 — 어두운 테마의 scrim 이 밝은 배경과 싸운다(themes.md).

**확정한 프롬프트는 `background.prompt` 로 스펙에 그대로 기록한다** (컷아웃은 요소의 `prompt`). 스펙이 썸네일의 유일한 소스가 되고 — 콘택트 시트에 표시되며, `tt.js prompt` 로 언제든 다시 꺼내 재생성·화풍 변형의 출발점으로 쓴다. image 배경에 prompt 가 없으면 validate 가 경고한다.

**이미지를 받으면:** 피사체가 있는 쪽을 `focus` 로 지정 → scrim 은 `auto`(반대편에 깔림). 그래도 대비가 약하면 `scrim:"full"` 이나 headline `box:"solid"` 로 올린다. 여백이 프롬프트대로 안 나왔으면 문구 구역을 옮기는 게 재생성보다 빠르다.

**배경을 기다리는 동안** gradient 로 먼저 조판을 확정하는 것도 좋은 순서다 — 문구·구도를 시트로 검증해 두고 배경만 갈아끼운다(`background` 의 type/src/focus 만 수정).

## 4. 색 판단

- 유튜브 UI 는 흰/검 + 빨강. **순수 빨강 배경은 UI 에 묻힌다** — 쓰려면 accent 로만.
- 피드에서 이웃 썸네일과 싸운다: **경쟁 조사(title.md §5-2)에서 기록한 상위 썸네일의 지배적 명도·색과 반대로 간다** — 남들이 밝으면 어둡게(impact·docu), 어두우면 밝게(clean). 상위 썸네일은 `youtube video <id>` 의 thumbnail URL 로 직접 본다.
- 화풍도 같은 논리다: 상위가 전부 과장 리액션 실사면 플랫 벡터·시네마틱이 오히려 튄다(§3 프리셋에서 비어 있는 자리를 고른다).
- 시리즈면 테마·badge 위치를 편마다 고정한다 — 채널 정체성이 된다.
