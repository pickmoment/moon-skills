#!/usr/bin/env bash
# check.sh — youtube-script 납품 전 검수
#
#   check.sh <대본파일> [--target 5600] [--track long|talk]
#       .md → 모드 A(구조 대본) · .txt → 모드 B(순수 대사) · .sv.md → 모드 C(화면 대본)
#       --target(목표 글자수) · --track(롱폼/토킹헤드) 을 안 주면 파일 메타에서 읽는다
#   check.sh series <시리즈폴더>
#       편간 정합 — 분량 균질성 · 문체 드리프트 · 용어 표기 · 갈고리 연결 · 사이드카
#
# 종료 코드 0 = 통과, 1 = FAIL 하나 이상
set -u

FAILED=0
fail() { printf 'FAIL  %s\n' "$*"; FAILED=1; }
warn() { printf 'WARN  %s\n' "$*"; }
ok()   { printf 'ok    %s\n' "$*"; }
info() { printf '      %s\n' "$*"; }
head_() { printf '\n== %s\n' "$*"; }

usage() { sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; }

# ---------- 본문 추출 ----------
body_A() {
  perl -CSD -Mutf8 -ne 'last if /^## (출처|미확인 사항|연출 메모|배포 패키지)/;
    next if /^#/ || /^\s*$/ || /^-\s/ || /^\|/ || /^---/; print' "$1"
}
body_B() { perl -CSD -Mutf8 -ne 'next if /^\s*$/; print' "$1"; }
body_auto() { case "$1" in *.sv.md) body_C "$1" ;; *.txt) body_B "$1" ;; *) body_A "$1" ;; esac; }
body_C() {
  perl -CSD -Mutf8 -ne '
    if ($. == 1 && /^---\s*$/) { $fm = 1; next }
    if ($fm) { $fm = 0 if /^---\s*$/; next }
    next if /^#/ || /^\s*$/ || /^\(\(/;
    s/!\[[^\]]*\]\([^)]*\)//g; s/^\s*\[\d\d:\d\d\]\s*//; s/^\s*\@[a-zA-Z-]+\s*//;
    s/\(\([^)]*\)\)//g; s/^\s+//; next if /^\s*$/; print' "$1"
}

# ---------- 공통 측정 ----------
stats() {  # stdin=본문, $1=라벨 → chars/sentences/avg + 90자 초과 목록
  perl -CSD -Mutf8 -0777 -ne '
    s/\s+$//; my $n = 0; my ($cnt, $tot, @long) = (0, 0);
    for my $l (split /\n/, $_) { $l =~ s/\s+$//; $n += length $l }
    for my $s (split /(?<=[.?!])\s+/, $_) {
      $s =~ s/^\s+|\s+$//g; $s =~ s/\s*\n\s*/ /g; next unless length $s;
      $cnt++; $tot += length $s; push @long, $s if length($s) > 90;
    }
    printf "chars=%d sentences=%d avg=%.1f long=%d\n", $n, $cnt, $cnt ? $tot/$cnt : 0, scalar @long;
    printf "  %3d | %s\n", length($_), $_ for @long;'
}

numbers() {  # stdin=본문 → 아라비아 수치
  perl -CSD -Mutf8 -ne 'while (/([0-9][0-9,.]*\s*(?:퍼센트|개월|시간|달러|년|월|일|%|억|만|천|조|원|배|개|명|건|분|초|곳|위|차|번))/g) { print "$1\n" }' | sort -u
}
kor_numbers() {  # stdin=본문 → 한글로 풀어 쓴 수치 (출처 대조에서 새기 쉬운 것)
  perl -CSD -Mutf8 -ne 'while (/((?:열|스무|스물|서른|마흔|쉰|예순|일흔|여든|아흔|백|천)?(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉)?(?:열|스무|스물|서른|마흔|쉰|예순|일흔|여든|아흔)?\s*(?:개월|개|곳|명|번|차례|달|해|년|시간|시|분|배|가지|사람|건|채|척|대))/g) {
    my $t = $1; $t =~ s/^\s+|\s+$//g; next unless $t =~ /^(열|스무|스물|서른|마흔|쉰|예순|일흔|여든|아흔|백|천|두|세|네|다섯|여섯|일곱|여덟|아홉)/; print "$t\n" }' | sort -u
}

BANNED='알아보겠습니다|살펴보겠습니다|말씀드리겠습니다|다양한|여러 가지|여러가지|많은 사람들|정말 중요|매우 놀라|라고 할 수 있|아시다시피|결론적으로|먼저 .*그다음|구독과 좋아요'

check_len() {  # $1=chars $2=target $3=cps
  local c=$1 t=$2 cps=$3
  if [ "$t" -eq 0 ]; then
    warn "목표 글자수를 못 찾았다 (--target 으로 준다). 현재 ${c}자 · 롱폼 $(echo "$c" | awk '{printf "%.1f", $1/310}')분 · 토킹헤드 $(echo "$c" | awk '{printf "%.1f", $1/370}')분"
    return
  fi
  local lo=$(( t * 9 / 10 )) hi=$(( t * 11 / 10 ))
  local mins=$(awk -v c="$c" -v p="$cps" 'BEGIN{printf "%.1f", c/p}')
  if [ "$c" -lt "$lo" ] || [ "$c" -gt "$hi" ]; then
    fail "분량 ${c}자 — 목표 ${t}자 허용 ${lo}~${hi} 밖 (예상 ${mins}분). 미달은 층을 더 파고, 초과는 중복 재설명을 자른다"
  else
    ok "분량 ${c}자 (목표 ${t} · 허용 ${lo}~${hi} · 예상 ${mins}분)"
  fi
}

meta_target() { perl -CSD -Mutf8 -ne 'if (/목표:.*?([0-9][0-9,]*)\s*자/) { my $t=$1; $t=~s/,//g; print $t; exit }' "$1"; }
meta_track()  { perl -CSD -Mutf8 -ne 'if (/트랙:\s*(\S+)/) { print $1 =~ /토킹/ ? "talk" : "long"; exit }' "$1"; }

# ---------- 파일 하나 검수 ----------
check_file() {
  local F="$1" TARGET="$2" TRACK="$3" MODE
  [ -f "$F" ] || { fail "파일 없음: $F"; return; }
  case "$F" in
    *.sv.md)   MODE=C ;;
    *.meta.md) fail "사이드카는 검수 대상이 아니다 — 짝이 되는 .txt 를 넘긴다"; return ;;
    *.txt)     MODE=B ;;
    *.md)      MODE=A ;;
    *)         fail "확장자로 모드를 못 정한다: $F"; return ;;
  esac

  local SIDE="" SRC=""
  case "$MODE" in
    A) SRC="$F" ;;
    B) SIDE="${F%.txt}.meta.md"; SRC="$SIDE" ;;
    C) SRC="${F%.sv.md}.md"; [ -f "$SRC" ] || SRC="${F%.sv.md}.meta.md" ;;
  esac
  [ -z "$TARGET" ] && [ -f "$SRC" ] && TARGET="$(meta_target "$SRC")"
  [ -z "$TRACK" ]  && [ -f "$SRC" ] && TRACK="$(meta_track "$SRC")"
  [ -z "$TARGET" ] && TARGET=0
  [ -z "$TRACK" ]  && TRACK=long
  local CPS=310 AVG_LO=45 AVG_HI=60
  [ "$TRACK" = talk ] && { CPS=370; AVG_LO=30; AVG_HI=45; }

  printf '검수: %s  (모드 %s · 트랙 %s · 목표 %s자)\n' "$F" "$MODE" "$TRACK" "${TARGET/#0/미상}"

  local TMP; TMP="$(mktemp)"; trap 'rm -f "$TMP"' RETURN
  "body_$MODE" "$F" > "$TMP"

  head_ "분량과 문장"
  local S; S="$(stats < "$TMP")"
  local CHARS AVG LONG
  CHARS=$(printf '%s' "$S" | head -1 | sed -n 's/.*chars=\([0-9]*\).*/\1/p')
  AVG=$(printf '%s'  "$S" | head -1 | sed -n 's/.*avg=\([0-9.]*\).*/\1/p')
  LONG=$(printf '%s' "$S" | head -1 | sed -n 's/.*long=\([0-9]*\).*/\1/p')
  check_len "$CHARS" "$TARGET" "$CPS"
  if [ "${LONG:-0}" -gt 0 ]; then
    fail "90자 초과 문장 ${LONG}개 — 전부 쪼갠다"
    printf '%s\n' "$S" | tail -n +2
  else ok "90자 초과 문장 없음"; fi
  if awk -v a="$AVG" -v lo="$AVG_LO" -v hi="$AVG_HI" 'BEGIN{exit !(a<lo||a>hi)}'; then
    warn "평균 문장 길이 ${AVG}자 — ${TRACK} 목표 ${AVG_LO}~${AVG_HI}자"
  else ok "평균 문장 길이 ${AVG}자"; fi

  head_ "금지 표현"
  if grep -nE "$BANNED" "$TMP"; then fail "금지 표현 — craft.md §4 표의 대안으로 고친다"; else ok "없음"; fi

  head_ "낭독 아닌 글자 누출"
  case "$MODE" in
    A) if grep -nE '\[(B롤|비롤|자료|화면|인서트|pause|정지|강조|효과음)|※|▶' "$TMP"; then
         fail "연출 지시가 낭독 본문에 섞였다 — ## 연출 메모 로 옮긴다"; else ok "없음"; fi ;;
    B) if grep -nE '^#|^[[:space:]]*[-*+] |^[[:space:]]*[0-9]+\. |\*\*|`|^---|\[|\]|\(|\)|※|▶|[0-9]{2}:[0-9]{2}' "$F"; then
         fail "순수 대사 파일에 낭독하지 않는 글자가 있다 — 전부 제거한다"; else ok "없음"; fi ;;
    C) ok "모드 C 는 지시문이 문법의 일부 — 아래 scriptviz 파싱으로 확인" ;;
  esac

  head_ "수치와 출처"
  local SRCSEC; SRCSEC="$(mktemp)"
  if [ -f "$SRC" ]; then perl -CSD -Mutf8 -ne 'print if /^## 출처/../^## (미확인|연출|배포)/' "$SRC" > "$SRCSEC"; fi
  if [ ! -s "$SRCSEC" ]; then
    if [ "$MODE" = B ] && [ ! -f "$SIDE" ]; then :; else fail "## 출처 섹션이 비었거나 없다 ($SRC)"; fi
  fi
  local MISS=0 N
  while IFS= read -r N; do
    [ -z "$N" ] && continue
    if ! grep -qF "${N%% *}" "$SRCSEC" 2>/dev/null; then warn "출처 미대조 수치: $N"; MISS=$((MISS+1)); fi
  done < <(numbers < "$TMP")
  [ "$MISS" -eq 0 ] && ok "아라비아 수치 전부 ## 출처에 대응"
  local KN; KN="$(kor_numbers < "$TMP" | tr '\n' ' ')"
  if [ -n "${KN// /}" ]; then
    warn "한글로 풀어 쓴 수 — 출처에는 아라비아 숫자로 병기했는지 직접 확인: $KN"
  fi
  rm -f "$SRCSEC"

  if [ "$MODE" = B ]; then
    head_ "사이드카"
    if [ -f "$SIDE" ]; then
      ok "$(basename "$SIDE") 있음"
      info "비트 대응 표에 넣을 실제 문단 번호:"
      perl -CSD -Mutf8 -00 -ne 'chomp; next unless length; $i++; printf("      %3d | %s\n", $i, substr($_,0,24))' "$F"
    else fail "사이드카 없음: $SIDE — 없이 납품하지 않는다"; fi
    head_ "문단 구조 (3~5문장이 목표)"
    perl -CSD -Mutf8 -00 -ne 'chomp; next unless length; $i++; my @s = grep { /\S/ } split /(?<=[.?!])\s+/;
      printf("      %3d | %d문장%s\n", $i, scalar @s, (@s<2 ? "  ← 짧다" : (@s>6 ? "  ← 길다" : "")))' "$F"
  fi

  if [ "$MODE" = C ]; then
    head_ "scriptviz 파싱"
    local SV="${SCRIPTVIZ:-$HOME/.claude/skills/scriptviz/assets/sv.js}"
    if [ ! -f "$SV" ]; then warn "scriptviz 를 못 찾았다 ($SV) — SCRIPTVIZ 로 경로를 준다"
    else
      local J; J="$(mktemp)"
      if node "$SV" "$F" --json > "$J" 2>"$J.err"; then
        node -e '
          const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
          const b = (s.beats || []).filter(x => x.scene && x.scene.type !== "title");
          const cps = s.cps || 5.2;
          const short = b.filter(x => x.say && x.say.length / cps < 2.2);
          const stat = b.filter(x => x.scene.type === "stat" &&
            (x.scene.items || []).some(i => String(i.value) === "00" || !/[0-9]/.test(String(i.value || ""))));
          let run = 1, worst = 1;
          for (let i = 1; i < b.length; i++) { run = b[i].scene.type === b[i-1].scene.type ? run + 1 : 1; worst = Math.max(worst, run) }
          const say = b.reduce((n, x) => n + (x.say || "").length, 0);
          console.log(`      컷 ${b.length}개 · 낭독 ${say}자 · 예상 ${(say/cps/60).toFixed(1)}분 · 같은 장면 최대 ${worst}연속`);
          if (short.length) { console.log(`SHORT ${short.length}`); short.forEach(x => console.log("      · " + x.say)) }
          if (stat.length) { console.log(`NODIGIT ${stat.length}`); stat.forEach(x => console.log("      · " + x.say)) }
          if (worst >= 4) console.log("RUN " + worst);
          console.log("SAY " + say);
        ' "$J" > "$J.out"
        grep -v '^\(SHORT\|NODIGIT\|RUN\|SAY\) ' "$J.out"
        ok "파싱 통과"
        grep -q '^SHORT ' "$J.out" && fail "낭독 2.2초를 못 채우는 컷이 있다 — 앞뒤와 합친다"
        grep -q '^NODIGIT ' "$J.out" && fail "@stat 카드에 숫자가 안 박혔다 — 숫자에 scriptviz 가 아는 단위(%·퍼센트·배·억·만·천·명·원·건·위)를 붙이거나 @hero 로 바꾼다"
        grep -q '^RUN ' "$J.out" && warn "같은 장면 타입이 4연속 이상 — 하나를 다른 타입으로"
        if [ -f "$SRC" ]; then
          local SAY BASE; SAY="$(sed -n 's/^SAY //p' "$J.out")"
          BASE="$(body_auto "$SRC" | stats | head -1 | sed -n 's/.*chars=\([0-9]*\).*/\1/p')"
          if [ -n "$BASE" ] && [ "$BASE" -gt 0 ]; then
            if awk -v a="$SAY" -v b="$BASE" 'BEGIN{exit !( (a>b?a-b:b-a) > b*0.05 )}'; then
              fail "원본 대본과 낭독문이 다르다 (C ${SAY}자 vs 원본 ${BASE}자) — C 는 쪼개기만 하고 문장을 바꾸지 않는다"
            else ok "원본 대본과 낭독문 일치 (C ${SAY}자 vs 원본 ${BASE}자)"; fi
          fi
        fi
      else fail "scriptviz 파싱 실패:"; cat "$J.err"; fi
      rm -f "$J" "$J.err" "$J.out"
    fi
  fi

  head_ "배포 패키지"
  if [ -f "$SRC" ] && grep -q '^## 배포 패키지' "$SRC"; then ok "있음"
  else warn "## 배포 패키지(제목 후보·썸네일 문구·설명·챕터)가 없다 — templates.md §6"; fi
}

# ---------- 시리즈 통합 검수 ----------
check_series() {
  local D="${1%/}"
  [ -d "$D" ] || { fail "폴더 없음: $D"; return; }
  local BIBLE="$D/00-series.md"
  [ -f "$BIBLE" ] || fail "시리즈 바이블 없음: $BIBLE"

  local -a EPS=()
  local f
  for f in "$D"/[0-9][0-9]-*; do
    [ -e "$f" ] || continue
    case "$f" in */00-series.md|*.meta.md|*.sv.md) continue ;; esac
    EPS+=("$f")
  done
  [ "${#EPS[@]}" -gt 0 ] || { fail "편 대본을 못 찾았다"; return; }

  head_ "편별 분량과 문체 (${#EPS[@]}편)"
  local SUM=0 CNT=0 LINE
  for f in "${EPS[@]}"; do
    local S C A T
    S="$(body_auto "$f" | stats | head -1)"
    C=$(printf '%s' "$S" | sed -n 's/.*chars=\([0-9]*\).*/\1/p')
    A=$(printf '%s' "$S" | sed -n 's/.*avg=\([0-9.]*\).*/\1/p')
    case "$f" in *.md) T="$(meta_target "$f")" ;; *) T="$(meta_target "${f%.txt}.meta.md" 2>/dev/null)" ;; esac
    printf '      %-44s %6s자  avg %s  목표 %s\n' "$(basename "$f")" "$C" "$A" "${T:-?}"
    if [ -n "${T:-}" ] && [ "${T:-0}" -gt 0 ]; then
      [ "$C" -lt $(( T * 9 / 10 )) ] || [ "$C" -gt $(( T * 11 / 10 )) ] && fail "$(basename "$f") 분량이 목표 ±10% 밖"
    fi
    SUM=$(awk -v s="$SUM" -v a="$A" 'BEGIN{print s+a}'); CNT=$((CNT+1))
    case "$f" in *.txt) [ -f "${f%.txt}.meta.md" ] || fail "$(basename "$f") 사이드카 없음" ;; esac
  done
  local MEAN; MEAN=$(awk -v s="$SUM" -v n="$CNT" 'BEGIN{printf "%.1f", s/n}')
  info "편별 평균 문장 길이의 평균 = ${MEAN}자"
  for f in "${EPS[@]}"; do
    local A; A="$(body_auto "$f" | stats | head -1 | sed -n 's/.*avg=\([0-9.]*\).*/\1/p')"
    awk -v a="$A" -v m="$MEAN" 'BEGIN{exit !((a>m?a-m:m-a) > m*0.15)}' \
      && warn "$(basename "$f") 문체 드리프트 — 평균 문장 ${A}자 (시리즈 평균 ${MEAN}자에서 15% 이탈)"
  done

  head_ "갈고리 연결 (바이블 확정 문장 ↔ 실제 대본)"
  if [ -f "$BIBLE" ]; then
    while IFS='|' read -r ep kind frag; do
      [ -z "${frag// /}" ] && continue
      local tgt="" g
      for g in "$D"/"$(printf '%02d' "$ep")"-*; do
        case "$g" in *.meta.md|*.sv.md) continue ;; esac
        [ -e "$g" ] && tgt="$g" && break
      done
      if [ -z "$tgt" ]; then warn "${ep}편 파일을 못 찾아 ${kind} 대조 생략"; continue; fi
      if grep -qF "$frag" "$tgt"; then ok "${ep}편 ${kind}: “${frag}…” 발견"
      else fail "${ep}편 ${kind}가 대본에 없다: “${frag}…” ($(basename "$tgt"))"; fi
    done < <(perl -CSD -Mutf8 -0777 -ne '
      for my $blk (split /^### /m, $_) {
        next unless $blk =~ /^\s*(\d+)편/; my $n = $1;
        for my $k (["갈고리 문장", "갈고리"], ["회수 문장", "회수"]) {
          next unless $blk =~ /\Q$k->[0]\E:\s*["“]([^"”]{8,})/;
          my $v = $1; next if $v =~ /^\s*(해당 )?없음/;
          print "$n|$k->[1]|" . substr($v, 0, 12) . "\n";
        }
      }' "$BIBLE")
  fi

  head_ "용어 표기 통일 (라틴 문자 토큰 상위 20)"
  for f in "${EPS[@]}"; do body_auto "$f"; done \
    | grep -ohE '[A-Za-z]{2,}' | sort | uniq -c | sort -rn | head -20 | sed 's/^/      /'
  info "한글 고유명사는 위 명령으로 안 잡힌다 — 시리즈 핵심 용어 3~5개를 grep -c 로 편별 비교한다"
}

# ---------- 진입점 ----------
[ $# -eq 0 ] && { usage; exit 1; }
if [ "$1" = series ]; then
  shift; [ $# -eq 1 ] || { usage; exit 1; }
  check_series "$1"
else
  F=""; TARGET=""; TRACK=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --target) TARGET="$2"; shift 2 ;;
      --track)  TRACK="$2";  shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) F="$1"; shift ;;
    esac
  done
  [ -n "$F" ] || { usage; exit 1; }
  check_file "$F" "$TARGET" "$TRACK"
fi

printf '\n%s\n' "$([ "$FAILED" -eq 0 ] && echo '=== 통과 — FAIL 없음. WARN 은 눈으로 확인한다' || echo '=== FAIL 있음 — 고친 뒤에 보고한다')"
exit "$FAILED"
