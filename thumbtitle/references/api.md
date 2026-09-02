# API · 캡처 · 함정

## CLI

```bash
node <skill>/assets/tt.js validate spec.json          # 에러·경고만 출력
node <skill>/assets/tt.js build    spec.json -o 결과.html   # validate 후 생성 (-o 생략 시 spec 이름.html)
node <skill>/assets/tt.js prompt   spec.json          # 기록된 생성 프롬프트 출력(배경·컷아웃·변형별) — 이미지가 아직 없어도 동작
```

이미지(배경·컷아웃)는 스펙 파일 기준 상대경로로 찾아 **base64 로 HTML 에 인라인**한다 — 산출물은 자기완결 단일 HTML, 외부 JS 0.

## HTML 안의 API

| 진입 | 무엇 |
|---|---|
| `?v=N` | N번째 변형만 1280×720 로 표시 (캡처용, 기본 v=1) |
| `?sheet=1` | 콘택트 시트 — 변형마다 320×180(피드)·168×94(사이드바) + 재생시간 배지 목업 + 제목 + 배경 생성 프롬프트 |
| `window.TT.show(n)` | 변형 전환 (리로드 없이). 변형 이름을 반환 |
| `window.TT.sheet()` | 시트 모드 전환 |
| `window.TT.count` | 변형 수 |

정지 이미지라 rAF 가 필요 없다 — 오프스크린 창에서도 즉시 렌더되므로 agent-browser 캡처가 곧 검증이자 산출물이다.

## 캡처 절차 (산출물 PNG = 스크린샷)

```bash
agent-browser set viewport 1280 720
agent-browser open "file:///절대경로/결과.html?v=1"
agent-browser screenshot 썸네일_A.png                 # 이게 곧 업로드용 1280×720 PNG
agent-browser eval "window.TT.show(2)"                # 리로드 없이 다음 변형
agent-browser screenshot 썸네일_B.png
agent-browser open "file:///절대경로/결과.html?sheet=1"
agent-browser screenshot --full 시트.png              # 세트 검증용
```

유튜브 업로드 규격: 1280×720, 2MB 이하, JPG/PNG. 스크린샷 PNG 가 크면 `--screenshot-format jpeg` 로 다시 찍는다.

## 함정 (실측)

- **`agent-browser screenshot` 의 옵션은 경로 앞에 쓴다. 풀페이지 플래그는 `--full` 이다.** `screenshot 파일.png --full-page` 라고 쓰면 `--full-page` 라는 이름의 파일이 cwd 에 생긴다(실제로 당함).
- **viewport 를 1280×720 으로 안 맞추면 스크린샷이 규격이 아니다.** 스테이지는 (0,0) 고정 1280×720 이라 viewport 만 맞으면 그대로 규격 PNG.
- **headline 줄바꿈은 자동이 아니다.** `lines` 배열로 직접 쪼갠다. 한 줄이 길면 validate 가 폭 초과를 추정 경고하지만, 추정(글자수×크기)이므로 최종은 눈으로.
- **box 를 켜면 stroke 가 꺼진다** — 박스+외곽선 중첩은 지저분해서 엔진이 막아 놨다.
- **circle/arrow 는 흐름 밖 오버레이다.** 구역 중심에 놓이므로 배경 위 특정 지점은 `dx`/`dy` 로 잡는다. 스크린샷 보면서 두 번 안에 잡는 게 정상.
- **폰트는 시스템 폰트다**(Pretendard→Apple SD Gothic Neo→Noto Sans KR). 캡처 머신이 바뀌면 글자 폭이 달라진다 — 같은 머신에서 빌드·캡처.
- 이미지 base64 인라인 때문에 HTML 이 이미지 크기만큼 커진다. 정상이며, 산출물은 어차피 PNG 캡처다.
