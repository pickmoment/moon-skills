# 테마 프리셋 6종 — `:root` 색 슬롯만 갈아 끼운다

`base-*.html`의 CSS 맨 위에는 세 블록이 있다.

1. `:root { … }` — 라이트 값
2. `html[data-theme="dark"] { … }` — 사용자가 테마 버튼으로 고른 다크
3. `@media (prefers-color-scheme:dark){ html:not([data-theme="light"]) { … } }` — OS 설정에 따른 다크

**2번과 3번은 값이 완전히 같다.** 프리셋을 적용할 때 라이트 값은 1번에, 다크 값은 2번과 3번에 **모두** 넣는다.
한쪽만 바꾸면 OS가 다크인 사용자와 버튼으로 다크를 켠 사용자가 다른 색을 본다.

주제 성격이 무드를 결정한다. **매번 기본값(인디고)으로 수렴하지 말고 아래에서 하나를 고르고 이유를 한 줄 남긴다.**

| 프리셋 | 어울리는 주제 | 인상 |
|---|---|---|
| A 인디고 스터디 (기본) | 기술 개념, 시스템 설계, 일반 학습 | 담백하고 중립적 |
| B 네이비 아카데믹 | 사내 교육, 정책·제도 해설, 격식 있는 브리핑 | 신뢰·공식 |
| C 미니멀 모노 | API·레퍼런스, 코드 중심, 체크리스트 | 절제·정보 밀도 |
| D 웜 에디토리얼 | 역사·인문, 기획 논리, 에세이형 설명 | 읽는 즐거움 |
| E 틸 사이언스 | 과학·의학·데이터 분석, 실험 결과 | 임상적 정확함 |
| F 바이올렛 나이트 | AI·프론트엔드, 발표 화면, 다크 선호 | 선명·현대적 |

---

## A. 인디고 스터디 (기본값 — 이미 적용된 상태)

```css
/* 라이트 */
--accent:#4b5cf6; --accent-2:#7c8ffb; --accent-tint:rgba(75,92,246,.10);
--bg:#f7f8fb; --surface:#ffffff; --surface-2:#f1f3f8;
--ink:#171a1f; --ink-sub:#5f6672; --line:rgba(120,127,145,.20);
/* 다크 */
--accent:#8b9dff; --accent-2:#aab6ff; --accent-tint:rgba(139,157,255,.14);
--bg:#0f1116; --surface:#181b22; --surface-2:#1f232c;
--ink:#e9ebf0; --ink-sub:#9aa2b1; --line:rgba(150,160,180,.20);
```

## B. 네이비 아카데믹

```css
/* 라이트 */
--accent:#1f4e8c; --accent-2:#3f74bb; --accent-tint:rgba(31,78,140,.10);
--bg:#f4f6f9; --surface:#ffffff; --surface-2:#eaeff5;
--ink:#0e1a26; --ink-sub:#4e5d6c; --line:rgba(30,60,95,.18);
--ok:#0f6d54; --ok-tint:rgba(15,109,84,.10);
--bad:#a8323b; --bad-tint:rgba(168,50,59,.09);
/* 다크 */
--accent:#7fb0e8; --accent-2:#a5c8f2; --accent-tint:rgba(127,176,232,.14);
--bg:#0b131c; --surface:#131e2a; --surface-2:#1a2836;
--ink:#e6edf4; --ink-sub:#93a4b6; --line:rgba(140,170,200,.20);
--ok:#54cfa8; --ok-tint:rgba(84,207,168,.12);
--bad:#f08a90; --bad-tint:rgba(240,138,144,.12);
```

조직 CI 색이 있으면 `--accent` 슬롯에 CI를 넣고 `--accent-2`는 같은 색을 15~20% 밝게 만든 값으로 둔다.

## C. 미니멀 모노

```css
/* 라이트 */
--accent:#1c1c1e; --accent-2:#4a4a4f; --accent-tint:rgba(28,28,30,.07);
--bg:#fbfbfb; --surface:#ffffff; --surface-2:#f2f2f3;
--ink:#111113; --ink-sub:#6c6c72; --line:rgba(0,0,0,.14);
/* 다크 */
--accent:#f2f2f3; --accent-2:#c3c3c8; --accent-tint:rgba(242,242,243,.10);
--bg:#0c0c0d; --surface:#151517; --surface-2:#1d1d20;
--ink:#f4f4f5; --ink-sub:#9b9ba1; --line:rgba(255,255,255,.14);
```

포인트색이 잉크색과 같으므로 **위계를 굵기·여백·괘선으로** 만든다. 이 프리셋에서는
`tag` 배지를 남발하지 말고(회색 덩어리가 된다), 대신 `num`과 소제목에 기대는 편이 낫다.
`--ok`/`--bad`는 기본값(초록/빨강)을 유지한다 — 퀴즈 정오 피드백은 색으로 구분돼야 한다.

## D. 웜 에디토리얼

```css
/* 라이트 */
--accent:#b5502f; --accent-2:#d47a56; --accent-tint:rgba(181,80,47,.10);
--bg:#faf7f2; --surface:#fffdfa; --surface-2:#f2ece3;
--ink:#241d17; --ink-sub:#6b5f53; --line:rgba(90,70,50,.20);
--ok:#4a7c46; --ok-tint:rgba(74,124,70,.10);
--warn:#9a6a12; --warn-tint:rgba(154,106,18,.10);
/* 다크 */
--accent:#e59774; --accent-2:#f0b899; --accent-tint:rgba(229,151,116,.14);
--bg:#14100d; --surface:#1d1813; --surface-2:#26201a;
--ink:#f2ebe3; --ink-sub:#b0a293; --line:rgba(200,170,140,.20);
--ok:#8fc98a; --ok-tint:rgba(143,201,138,.12);
--warn:#dcae5c; --warn-tint:rgba(220,174,92,.12);
```

세리프 헤드라인을 함께 쓴다. `<head>`에 한 줄 추가하고 `--font-display`만 바꾼다.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700&display=swap" rel="stylesheet">
```
```css
--font-display:'Noto Serif KR',Pretendard,serif;
```

세리프는 **제목 전용**이다. 본문까지 세리프로 바꾸면 화면 가독성이 떨어진다.
세리프 제목은 `font-weight`를 700 이하로 (900은 뭉친다).

## E. 틸 사이언스

```css
/* 라이트 */
--accent:#0f766e; --accent-2:#2a9d92; --accent-tint:rgba(15,118,110,.10);
--bg:#f5f9f9; --surface:#ffffff; --surface-2:#eaf2f2;
--ink:#0f1a1a; --ink-sub:#526463; --line:rgba(20,80,75,.18);
--warn:#9a6a12; --warn-tint:rgba(154,106,18,.10);
/* 다크 */
--accent:#5ecfc0; --accent-2:#8ee0d5; --accent-tint:rgba(94,207,192,.14);
--bg:#0a1314; --surface:#111e1f; --surface-2:#18292a;
--ink:#e6f1f0; --ink-sub:#92a8a7; --line:rgba(130,190,185,.20);
--warn:#dcae5c; --warn-tint:rgba(220,174,92,.12);
```

데이터·차트가 많은 문서에 잘 맞는다. 차트를 넣을 때 `--accent` 하나로 계열을 만들려 하지 말고
**dataviz 스킬**의 범주형 팔레트 규칙을 따른다.

## F. 바이올렛 나이트 (다크 우선)

```css
/* 라이트 */
--accent:#6d4bd6; --accent-2:#8f74e6; --accent-tint:rgba(109,75,214,.10);
--bg:#f8f7fc; --surface:#ffffff; --surface-2:#f0eef8;
--ink:#161327; --ink-sub:#5e5876; --line:rgba(90,80,140,.20);
/* 다크 */
--accent:#a78bfa; --accent-2:#c4b2fd; --accent-tint:rgba(167,139,250,.16);
--bg:#0b0a12; --surface:#15131f; --surface-2:#1d1a2b;
--ink:#eeeaf7; --ink-sub:#a49cba; --line:rgba(170,150,220,.22);
```

발표·시연용이면 문서를 다크로 고정할 수 있다 — `<html lang="ko" data-theme="dark">`.
인쇄는 어떤 테마에서도 흑백으로 강제된다(공통 CSS의 `@media print`가 팔레트를 덮는다).

---

## 폰트 페어링

| 조합 | 본문 | 디스플레이 | mono | 어울리는 프리셋 |
|---|---|---|---|---|
| 기본 | Pretendard | Pretendard | JetBrains Mono / SF Mono | A · B · F |
| 플레인 | IBM Plex Sans KR | 동일 | IBM Plex Mono | C · E |
| 에디토리얼 | Pretendard | Noto Serif KR | JetBrains Mono | D |

- 한 문서에 서체 3종(본문·디스플레이·mono)을 넘기지 않는다.
- 한글 본문에 양수 `letter-spacing`을 주지 않는다(공통 CSS는 `-0.011em`). 넓은 자간은 `kicker` 같은
  라틴 대문자 라벨 전용이다.
- mono는 시스템 폰트 폴백으로도 충분하다. CDN을 추가하기 전에 그 폰트가 **숫자 정렬(tabular)** 을
  지원하는지 확인한다.

## 색을 고를 때의 하드 제약

- `--accent`는 흰 배경 위 본문색으로도 쓰인다(`.md strong`, 링크) — **대비 4.5:1 이상**을 만족해야 한다.
  파스텔 톤을 accent로 쓰면 `**굵게**`가 읽히지 않는다.
- `--accent-tint`는 항상 accent의 8~16% 투명 혼합. 불투명 색을 넣으면 배지·인용 배경이 탁해진다.
- `--ok`/`--bad`는 퀴즈 채점 신호다. 프리셋 톤에 맞춰 조정하되 **초록/빨강 계열을 유지**한다.
- 다크 값의 `--accent`는 라이트보다 밝게(명도 +15~25%). 같은 값을 쓰면 어두운 배경에서 가라앉는다.
