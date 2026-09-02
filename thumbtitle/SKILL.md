---
name: thumbtitle
description: 유튜브 제목과 썸네일(1280×720)을 한 세트로 설계·제작한다. 제목은 훅 패턴 8종·역할분담 5패턴·썸네일 문구 패턴 6종으로 후보를 뽑아 관문 채점 + 상대 평가 3축으로 순위를 가리고, 경쟁 조사(ytb 의 youtube search 로 상위 영상 제목·썸네일 집계)로 차별화한다. 썸네일은 선언적 JSON 스펙 → 자체 엔진(tt.js)으로 단일 HTML 을 만들어 agent-browser 로 규격 PNG 를 캡처한다. 하이브리드 방식 — 배경은 AI 이미지 생성(화풍 프리셋 10종 × Nano Banana 2 프롬프트, 프롬프트는 스펙에 기록), 문구·배지·강조는 HTML 오버레이라 문구만 바꾼 A/B 변형을 초 단위로 재추출한다. 레이아웃 패턴 6종 × 테마 5종(impact·clean·docu·finance·story) × 요소 7종. 콘택트 시트(320×180 피드·168×94 사이드바 + 재생시간 배지 목업)로 세트를 실제 노출 크기에서 검증하고, 채널 로그(thumbtitle-로그.md)와 유튜브 Test & Compare 로 승자 패턴을 되먹임한다. youtube-script 의 배포 패키지(제목 후보·썸네일 문구)를 입력으로 받아 완성하는 후속 스킬. 사용자가 /thumbtitle 을 입력하거나 "썸네일 만들어줘", "제목 뽑아줘", "제목이랑 썸네일", "썸네일 문구", "클릭 잘 되는 제목", "CTR 올리는 썸네일", "A/B 썸네일", "이 영상 제목 지어줘", "썸네일 시안", "썸네일 테스트 결과 기록해줘" 요청 시 사용. 영상 화면·모션은 scriptviz·mojs·mograph 가 맞다.
---

# thumbtitle

**제목과 썸네일은 한 장씩이 아니라 세트로 만든다.** 시청자는 썸네일을 먼저 보고
제목으로 확인한다 — 같은 말을 반복하면 기회를 버리고, 다른 약속을 하면 신뢰가 깨진다.

썸네일은 하이브리드다: 배경은 AI 이미지(프롬프트를 제시하고 사용자가 생성),
문구는 JSON 스펙 → `tt.js` 엔진이 HTML 로 조판 → agent-browser 캡처가 곧
업로드용 1280×720 PNG. **문구·좌표를 이미지 모델에 맡기지 않는다** — 한글이
깨지고, 수정마다 재생성해야 한다. 여기선 문구만 바꿔 초 단위로 다시 뽑는다.

## 워크플로

0. **입력과 이력을 먼저 읽는다. 그다음 방향을 확인한다.**

   대본·주제·youtube-script 배포 패키지(제목 후보·썸네일 문구) 중 무엇이 있는지
   본다. 배포 패키지가 있으면 그 후보를 씨앗으로 쓰되 세트 검증은 다시 한다.
   작업 폴더에 **`thumbtitle-로그.md` 가 있으면 최근 5편의 승자 패턴을 집계한다**
   (`references/feedback.md`) — 후보 구성과 상대 평가의 근거다.

   **사용자가 이미 말했다면 묻지 않는다.** 단서가 없을 때만 `AskUserQuestion` 으로
   한 번에 묻는다:

   | 질문 | 선택지 |
   |---|---|
   | 배경은? | **AI 이미지**(인물·장면 — 프롬프트 제시, 생성 대기) · **타이포만**(그라디언트 — 즉시) |
   | 채널 결은? | impact(예능·이슈) · clean(정보) · docu(다큐) · finance(경제) · story(엔터) |

1. **필요한 레퍼런스만 읽는다.** 기억으로 쓰지 않는다.

   | 파일 | 언제 |
   |---|---|
   | `references/title.md` | 제목·문구 패턴, 경쟁 조사, 관문+상대 평가 — **항상 먼저** |
   | `references/composition.md` | 레이아웃 패턴, AI 배경 프롬프트·화풍 프리셋, 색 판단 |
   | `references/feedback.md` | 채널 로그 포맷, Test & Compare, 되먹임 규칙 |
   | `references/spec.md` | JSON 필드 전부, validate 규칙 |
   | `references/themes.md` | 테마 5종 색·폰트 |
   | `references/api.md` | CLI·캡처 절차·실측 함정 |

2. **경쟁 조사를 하고, 제목·썸네일 세트 표를 보여준다.** 스펙보다 세트가 먼저다.

   절차는 `title.md#5`: 영상이 답하는 것 한 문장(상한선) → `youtube search` 로
   상위 제목·썸네일 집계(포화 패턴 회피) → 로그의 승자 패턴 1개 + 실험 패턴 1개를
   섞어 후보 6~8개 → 관문 채점 → 상대 평가 3축(훅 강도·구체성·채널 적합)으로
   상위 2~3개 → 문구 패턴으로 짝짓기. 사용자에게는 근거와 함께 표로:

   | 세트 | 제목 (훅) | 썸네일 문구 (패턴) | 레이아웃 | 상대평가 |
   |---|---|---|---|---|
   | A | 연금 인출, 순서 하나 바꿨더니… (반전) | "세금 2배" (숫자+명사) | 순수 타이포 | 8/9 |
   | B | 10명 중 9명이 반대로 깹니다 (숫자) | "정답은 반대" (반전 선언) | 인물+문구 | 7/9 · 실험 |

3. **AI 배경이면 프롬프트를 제시하고, 기다리는 동안 그라디언트로 조판을 확정한다.**
   프롬프트 템플릿은 `composition.md#3` — 피사체 위치(여백 방향)·시선·NO text 가
   핵심. 화풍은 프리셋 10종에서 채널 결과 경쟁 조사의 빈자리에 맞춰 고르고 **채널
   단위로 고정**한다. **확정한 프롬프트는 `background.prompt` 로 스펙에 기록한다**
   (컷아웃은 요소의 `prompt`) — 시트에 표시되고 `tt.js prompt` 로 다시 꺼낸다.
   이미지를 받으면 `background` 의 `type/src/focus` 만 갈아끼운다.

4. **예제에서 시작해 스펙을 쓰고 반드시 검증한다.** 백지에서 쓰지 않는다.

   | 예제 | 무엇 |
   |---|---|
   | `assets/examples/starter-typo.json` | 순수 타이포 (impact, A/B 변형) |
   | `assets/examples/starter-hybrid.json` | 인물+문구 (docu, 이미지 배경+scrim+prompt 기록) |
   | `assets/examples/starter-compare.json` | 비교 분할 (finance, split+dy 쌓기) |

   ```bash
   node <skill>/assets/tt.js validate spec.json
   node <skill>/assets/tt.js build    spec.json -o 결과.html
   ```

   경고를 무시하지 않는다 — 대부분 "폭을 넘는다"거나 "재생시간 배지가 덮는다"다.
   확정된 세트는 전부 `variants` 로 넣는다(`name`·`title`·`patch`). **Test &
   Compare 에 올릴 거면 변형 3개는 문구만 다른 게 아니라 가설(훅·레이아웃)이
   달라야 한다** — `feedback.md`.

5. **캡처가 곧 검증이자 산출물이다. 자기 선언 금지.**

   ```bash
   agent-browser set viewport 1280 720
   agent-browser open "file:///절대경로/결과.html?v=1"
   agent-browser screenshot 썸네일_A.png            # 업로드용 규격 PNG
   agent-browser eval "window.TT.show(2)"
   agent-browser screenshot 썸네일_B.png
   agent-browser open "file:///절대경로/결과.html?sheet=1"
   agent-browser screenshot --full 시트.png
   ```

   **변형 수만큼 본다.** 보는 것: 줄이 화면을 넘는지, scrim 대비가 사는지,
   요소가 겹치는지 — 그리고 **시트의 168×94 에서 headline 이 읽히는지.** 안
   읽히면 줄이거나 키워서 다시. 시트는 사용자에게도 보여 세트를 고르게 한다.

6. **산출물을 안내하고 로그에 기록한다.** 변형별 1280×720 PNG + 확정 제목 +
   시트 PNG. 파일명은 한국어 허용 (`{주제}_썸네일_A.png`). 확정 세트·패턴 태그·
   스펙 경로를 `thumbtitle-로그.md` 에 적고(결과 칸은 `대기`), Test & Compare
   등록과 제목 수동 A/B 절차를 안내한다 — `feedback.md`. **다음에 결과를 들으면
   로그의 `대기` 를 채우고 교훈 한 줄을 남긴다.**

## 규칙

- **대본이 답하지 않는 것을 제목·썸네일로 약속하지 않는다.** 이탈이 아니라 신뢰가
  깨진다 (youtube-script 와 같은 원칙).
- **썸네일 문구는 제목의 부분 문자열이 되면 안 된다.** 역할분담은 `title.md#1`,
  문구 패턴은 `title.md#3`.
- **줄바꿈은 손으로.** headline `lines` 는 의미 단위로 직접 쪼갠다 (줄당 2~7자).
- **highlight 는 1~2단어, 시선 덩어리는 3개까지.**
- **글자수 안전선(20~28자 등)은 관행이지 표준이 아니다** — 최종은 모바일 화면과
  콘택트 시트로 확인한다.
- 산출물 HTML 은 자기완결(이미지 base64 인라인, 외부 JS 0). 진짜 산출물은 캡처 PNG 다.

## 체크

```bash
F=결과.html
grep -q 'lang="ko"' $F && echo "OK   lang" || echo "MISS lang"
grep -q 'window.TT' $F && echo "OK   캡처 API" || echo "MISS 캡처 API"
grep -qE '<script[^>]+src=' $F && echo "WARN 외부 JS" || echo "OK   외부 JS 없음"
grep -q 'sheet' $F && echo "OK   콘택트 시트" || echo "MISS 시트"
grep -q 'data-prompt="..*"' $F && echo "OK   프롬프트 기록" || echo "INFO 프롬프트 없음(타이포 전용이면 정상)"
```
