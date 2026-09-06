#!/usr/bin/env bash
# check.sh — youtube-script 납품 전 검수
#
#   check.sh <대본파일> [--target 5600] [--track <트랙>]
#       .md → 모드 A(구조 대본) · .txt → 모드 B(순수 대사) · .sv.md → 모드 C(화면 대본)
#       --track  long(롱폼) · talk(토킹헤드) · recall(인출 훈련) · predict(예측·검증) · duo(대화·대담)
#       --target(낭독 목표 글자수) · --track 을 안 주면 파일 메타에서 읽는다
#   check.sh series <시리즈폴더>
#       편간 정합 — 분량 균질성 · 문체 드리프트 · 용어 표기 · 갈고리 연결 · 사이드카
#
# 트랙별 추가 검수
#   recall  Q/⏸/A 헤딩의 짝, 간격 재인출 2개 이상·5분 이상 간격, 질문 간격, 멈춤 회계
#   predict P/⏸/R 헤딩의 짝, 예측 지점 2~3개, 예측→공개 4분 이내, 멈춤 회계
#   duo     화자 라벨 누락, 라벨 종류 2개, 한 발언 3문장, 발언 비중
#
# 종료 코드 0 = 통과, 1 = FAIL 하나 이상
set -u

FAILED=0
fail() { printf 'FAIL  %s\n' "$*"; FAILED=1; }
warn() { printf 'WARN  %s\n' "$*"; }
ok()   { printf 'ok    %s\n' "$*"; }
info() { printf '      %s\n' "$*"; }
head_() { printf '\n== %s\n' "$*"; }

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; }

# ---------- 메타 읽기 ----------
meta_target() { perl -CSD -Mutf8 -ne 'if (/목표:.*?([0-9][0-9,]*)\s*자/) { my $t=$1; $t=~s/,//g; print $t; exit }' "$1"; }
meta_pause()  { perl -CSD -Mutf8 -ne 'if (/멈춤\s*(?:합계\s*[:：]?\s*)?([0-9]+)\s*초/) { print $1; exit }' "$1"; }
meta_track()  {
  perl -CSD -Mutf8 -ne 'if (/^\s*[-*]?\s*트랙\s*[:：]\s*(.+)/) { my $t = $1;
    print $t =~ /인출/     ? "recall"
        : $t =~ /예측/     ? "predict"
        : $t =~ /대화|대담/ ? "duo"
        : $t =~ /토킹/     ? "talk"
        :                    "long"; print "\n"; exit }' "$1"
}

src_of() {  # 대본파일 → 메타가 들어 있는 파일
  case "$1" in
    *.sv.md) local s="${1%.sv.md}.md"; [ -f "$s" ] && printf '%s' "$s" || printf '%s' "${1%.sv.md}.meta.md" ;;
    *.txt)   printf '%s' "${1%.txt}.meta.md" ;;
    *)       printf '%s' "$1" ;;
  esac
}
track_of() { local s; s="$(src_of "$1")"; [ -f "$s" ] && meta_track "$s" || echo long; }

# ---------- 본문 추출 ----------
# 트랙 duo 는 화자 라벨(`진행자:`)을 낭독 글자에서 뺀다 — 읽지 않는 글자다
body_A() {
  DUO="${2:-}" perl -CSD -Mutf8 -ne 'last if /^## (출처|미확인 사항|연출 메모|배포 패키지|인출 장부)/;
    next if /^#/ || /^\s*$/ || /^-\s/ || /^\|/ || /^---/ || /^```/;
    s/^([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,9})\s*[:：]\s*// if $ENV{DUO} eq "duo";
    print' "$1"
}
body_B() {
  DUO="${2:-}" perl -CSD -Mutf8 -ne 'next if /^\s*$/;
    s/^([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,9})\s*[:：]\s*// if $ENV{DUO} eq "duo";
    print' "$1"
}
body_C() {
  perl -CSD -Mutf8 -ne '
    if ($. == 1 && /^---\s*$/) { $fm = 1; next }
    if ($fm) { $fm = 0 if /^---\s*$/; next }
    next if /^#/ || /^\s*$/ || /^\(\(/;
    s/!\[[^\]]*\]\([^)]*\)//g; s/^\s*\[\d\d:\d\d\]\s*//; s/^\s*\@[a-zA-Z-]+\s*//;
    s/\(\([^)]*\)\)//g; s/^\s+//; next if /^\s*$/; print' "$1"
}
body_auto() {
  local t; t="$(track_of "$1")"
  case "$1" in *.sv.md) body_C "$1" ;; *.txt) body_B "$1" "$t" ;; *) body_A "$1" "$t" ;; esac
}

# 한글은 NFC 로 맞춰야 글자수가 맞는다 — 자모가 분해된 NFD 는 "한" 하나가 3자로 세어진다
nfc() { perl -CSD -Mutf8 -MUnicode::Normalize -pe '$_ = NFC($_)'; }

# ---------- 공통 측정 ----------
stats() {  # stdin=본문, → chars/sentences/avg + 90자 초과 목록
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

BANNED='알아보겠습니다|살펴보겠습니다|말씀드리겠습니다|다양한|여러 가지|여러가지|많은 사람들|정말 중요|매우 놀라|라고 할 수 있|아시다시피|결론적으로|먼저 .*그다음|구독과 좋아요|한번 생각해 보|어떻게 생각하세요|어떻게 생각하시나요'

check_len() {  # $1=chars $2=target $3=cps $4=멈춤초
  local c=$1 t=$2 cps=$3 p=${4:-0}
  local pmin; pmin=$(awk -v p="$p" 'BEGIN{printf "%.1f", p/60}')
  if [ "$t" -eq 0 ]; then
    warn "목표 글자수를 못 찾았다 (--target 으로 준다). 현재 ${c}자 · 롱폼 $(echo "$c" | awk '{printf "%.1f", $1/310}')분 · 토킹헤드 $(echo "$c" | awk '{printf "%.1f", $1/370}')분"
    return
  fi
  local lo=$(( t * 9 / 10 )) hi=$(( t * 11 / 10 ))
  local mins total
  mins=$(awk -v c="$c" -v p="$cps" 'BEGIN{printf "%.1f", c/p}')
  total=$(awk -v m="$mins" -v s="$pmin" 'BEGIN{printf "%.1f", m+s}')
  if [ "$c" -lt "$lo" ] || [ "$c" -gt "$hi" ]; then
    fail "분량 ${c}자 — 목표 ${t}자 허용 ${lo}~${hi} 밖 (낭독 ${mins}분). 미달은 층을 더 파고, 초과는 중복 재설명을 자른다"
  else
    ok "분량 ${c}자 (목표 ${t} · 허용 ${lo}~${hi} · 낭독 ${mins}분)"
  fi
  [ "$p" -gt 0 ] && info "멈춤 ${p}초 포함 총 길이 ≈ ${total}분"
}

# ---------- 트랙 C·D — 헤딩 이벤트 ----------
events() {  # 대본(.md) → "종류 번호 시작초" 스트림
  perl -CSD -Mutf8 -ne '
    next unless /^##\s*\[(\d+):(\d\d)\s*[-\x{2013}\x{2014}~]\s*\d+:\d\d\]\s*(.*)$/;
    my $t = $1 * 60 + $2; my $r = $3;
    if    ($r =~ /^\x{23F8}\s*멈춤\s*(\d+)\s*초/) { print "PAUSE $1 $t\n" }
    elsif ($r =~ /^Q(\d+)\x{21BB}/)               { print "QR $1 $t\n" }
    elsif ($r =~ /^Q(\d+)/)                       { print "Q $1 $t\n" }
    elsif ($r =~ /^A(\d+)/)                       { print "A $1 $t\n" }
    elsif ($r =~ /^P(\d+)/)                       { print "P $1 $t\n" }
    elsif ($r =~ /^R(\d+)/)                       { print "R $1 $t\n" }' "$1"
}

PAUSE_SUM=0
check_recall() {  # $1=대본 $2=모드 $3=SRC $4=SIDE
  local F="$1" MODE="$2" SRC="$3" SIDE="$4"
  head_ "인출 사이클 (트랙 C)"
  if [ "$MODE" != A ]; then
    local S="${SIDE:-$SRC}"
    if [ -f "$S" ] && grep -q '^## 인출 장부' "$S"; then
      ok "$(basename "$S") 에 ## 인출 장부 있음"
      PAUSE_SUM="$(meta_pause "$S")"; PAUSE_SUM="${PAUSE_SUM:-0}"
      [ "$PAUSE_SUM" -eq 0 ] && warn "인출 장부에 '멈춤 합계: N초' 가 없다 — 총 길이를 계산할 수 없다"
    else
      fail "## 인출 장부가 없다 (${S:-사이드카}) — 모드 A가 아니면 질문·멈춤·답이 여기에만 남는다 (templates.md §4)"
    fi
    info "모드 A가 아니라 Q/⏸/A 헤딩 대조는 건너뛴다. 장부 표를 직접 확인한다"
    return
  fi

  local EV; EV="$(events "$F")"
  local nQ nA nP nQR
  nQ=$(printf '%s\n'  "$EV" | grep -c '^Q '  || true)
  nQR=$(printf '%s\n' "$EV" | grep -c '^QR ' || true)
  nA=$(printf '%s\n'  "$EV" | grep -c '^A '  || true)
  nP=$(printf '%s\n'  "$EV" | grep -c '^PAUSE ' || true)

  if [ "$nQ" -eq 0 ]; then
    fail "인출 질문 헤딩이 없다 — '## [01:10–01:35] Q1 · {질문}' 형식으로 쓴다 (templates.md §2)"
    return
  fi
  info "질문 ${nQ}개 · 재인출 ${nQR}개 · 답 ${nA}개 · 멈춤 ${nP}개"

  [ "$nA" -eq "$nQ" ] || fail "질문 ${nQ}개 vs 답 ${nA}개 — Q 하나에 A 하나. 답 없는 질문은 인출 질문이 아니라 열린 루프다"
  local want=$(( nQ + nQR ))
  [ "$nP" -eq "$want" ] || fail "멈춤 ${nP}개 vs 질문+재인출 ${want}개 — 멈춤 없는 질문은 수사의문문이다 (craft.md §2.5)"

  # Q 번호와 A 번호의 짝
  local qn an
  qn="$(printf '%s\n' "$EV" | awk '$1=="Q"{print $2}' | sort -n | tr '\n' ' ')"
  an="$(printf '%s\n' "$EV" | awk '$1=="A"{print $2}' | sort -n | tr '\n' ' ')"
  if [ "$qn" = "$an" ]; then ok "Q/A 번호 짝 맞음 (${qn% })"
  else fail "Q 번호 [${qn% }] 와 A 번호 [${an% }] 가 안 맞는다"; fi
  local DUP; DUP="$(printf '%s\n' "$EV" | awk '$1=="Q"{print $2}' | sort | uniq -d | tr '\n' ' ')"
  [ -n "${DUP// /}" ] && fail "질문 번호 중복: Q${DUP% } — 같은 번호를 두 번 쓰면 재인출과 구분이 안 된다"

  # 간격 재인출
  if [ "$nQR" -lt 2 ]; then
    fail "간격 재인출이 ${nQR}개 — 편당 최소 2개. 'Q1↻ · 재인출' 헤딩으로 표기한다 (craft.md §2.5)"
  else ok "간격 재인출 ${nQR}개"; fi
  local n t qt
  while read -r _ n t; do
    [ -z "${n:-}" ] && continue
    qt="$(printf '%s\n' "$EV" | awk -v k="$n" '$1=="Q" && $2==k {print $3; exit}')"
    if [ -z "$qt" ]; then fail "재인출 Q${n}↻ 에 대응하는 원 질문 Q${n} 이 없다"; continue; fi
    if [ $(( t - qt )) -lt 300 ]; then
      fail "재인출 Q${n}↻ 가 원 질문에서 $(( (t - qt) / 60 ))분 $(( (t - qt) % 60 ))초 뒤 — 5분 이상 떨어뜨린다. 붙여 물으면 단기 기억을 꺼내는 것뿐이다"
    else ok "Q${n}↻ 간격 $(( (t - qt) / 60 ))분"; fi
  done < <(printf '%s\n' "$EV" | grep '^QR ' || true)

  # 질문 간격
  local prev=-1 gapmax=0 g
  while read -r t; do
    [ -z "${t:-}" ] && continue
    [ "$prev" -ge 0 ] && { g=$(( t - prev )); [ "$g" -gt "$gapmax" ] && gapmax=$g; }
    prev=$t
  done < <(printf '%s\n' "$EV" | awk '$1=="Q"||$1=="QR"{print $3}' | sort -n)
  if [ "$gapmax" -gt 150 ]; then warn "질문 사이 최대 간격 $(( gapmax / 60 ))분 $(( gapmax % 60 ))초 — 목표 90~120초 (formats.md §2)"
  else ok "질문 간격 최대 ${gapmax}초"; fi

  # 멈춤 길이와 합계
  PAUSE_SUM=$(printf '%s\n' "$EV" | awk '$1=="PAUSE"{s+=$2} END{print s+0}')
  local bad; bad=$(printf '%s\n' "$EV" | awk '$1=="PAUSE" && ($2<3 || $2>5){c++} END{print c+0}')
  [ "$bad" -gt 0 ] && warn "멈춤 ${bad}개가 3~5초 밖 — 짧으면 인출이 안 되고 길면 스킵한다"
  info "멈춤 합계 ${PAUSE_SUM}초"
  if [ -f "$SRC" ]; then
    local dec; dec="$(meta_pause "$SRC")"
    [ -n "${dec:-}" ] && [ "$dec" -ne "$PAUSE_SUM" ] && warn "메타에 적힌 멈춤 ${dec}초 ≠ 실제 헤딩 합계 ${PAUSE_SUM}초 — 메타를 갱신한다"
  fi
}

check_predict() {  # $1=대본 $2=모드 $3=SRC $4=SIDE
  local F="$1" MODE="$2" SRC="$3" SIDE="$4"
  head_ "예측 지점 (트랙 D)"
  if [ "$MODE" != A ]; then
    local S="${SIDE:-$SRC}"
    if [ -f "$S" ] && grep -q '^## 인출 장부' "$S"; then
      ok "$(basename "$S") 에 ## 인출 장부 있음"
      PAUSE_SUM="$(meta_pause "$S")"; PAUSE_SUM="${PAUSE_SUM:-0}"
    else
      fail "## 인출 장부가 없다 (${S:-사이드카}) — 예측·공개·멈춤이 여기에만 남는다 (templates.md §4)"
    fi
    info "모드 A가 아니라 P/⏸/R 헤딩 대조는 건너뛴다"
    return
  fi

  local EV; EV="$(events "$F")"
  local nPr nR nPa
  nPr=$(printf '%s\n' "$EV" | grep -c '^P '     || true)
  nR=$(printf '%s\n'  "$EV" | grep -c '^R '     || true)
  nPa=$(printf '%s\n' "$EV" | grep -c '^PAUSE ' || true)

  if [ "$nPr" -eq 0 ]; then
    fail "예측 요청 헤딩이 없다 — '## [05:00–05:30] P1 · 예측 요청' 형식으로 쓴다 (templates.md §2)"
    return
  fi
  info "예측 ${nPr}개 · 공개 ${nR}개 · 멈춤 ${nPa}개"

  if [ "$nPr" -lt 2 ]; then
    fail "예측 지점이 ${nPr}개 — 최소 2개. P2(전이 예측)를 빼면 한 번의 예측은 일화로 끝난다 (formats.md §2)"
  elif [ "$nPr" -gt 3 ]; then
    warn "예측 지점 ${nPr}개 — 3개를 넘으면 D가 아니라 C(인출 훈련형)다. 트랙을 다시 본다"
  else ok "예측 지점 ${nPr}개"; fi

  [ "$nR" -eq "$nPr" ] || fail "예측 ${nPr}개 vs 공개 ${nR}개 — P 하나에 R 하나. 공개 없는 예측은 배신이다"
  [ "$nPa" -eq "$nPr" ] || fail "멈춤 ${nPa}개 vs 예측 ${nPr}개 — 예측 요청마다 멈춤이 하나"

  local n t rt
  while read -r _ n t; do
    [ -z "${n:-}" ] && continue
    rt="$(printf '%s\n' "$EV" | awk -v k="$n" '$1=="R" && $2==k {print $3; exit}')"
    if [ -z "$rt" ]; then fail "예측 P${n} 에 대응하는 공개 R${n} 이 없다"; continue; fi
    if [ "$rt" -le "$t" ]; then fail "공개 R${n} 이 예측 P${n} 보다 앞선다 — 타임코드를 확인한다"
    elif [ $(( rt - t )) -gt 240 ]; then
      fail "P${n} → R${n} 간격 $(( (rt - t) / 60 ))분 — 4분 이내에 공개한다. 예측 상태를 오래 두면 자기가 뭘 골랐는지 잊는다"
    else ok "P${n} → R${n} 간격 $(( (rt - t) / 60 ))분 $(( (rt - t) % 60 ))초"; fi
  done < <(printf '%s\n' "$EV" | grep '^P ' || true)

  PAUSE_SUM=$(printf '%s\n' "$EV" | awk '$1=="PAUSE"{s+=$2} END{print s+0}')
  local bad; bad=$(printf '%s\n' "$EV" | awk '$1=="PAUSE" && ($2<6 || $2>8){c++} END{print c+0}')
  [ "$bad" -gt 0 ] && warn "멈춤 ${bad}개가 6~8초 밖 — 선택지를 고르는 시간이다"
  info "멈춤 합계 ${PAUSE_SUM}초"
  if [ -f "$SRC" ]; then
    local dec; dec="$(meta_pause "$SRC")"
    [ -n "${dec:-}" ] && [ "$dec" -ne "$PAUSE_SUM" ] && warn "메타에 적힌 멈춤 ${dec}초 ≠ 실제 헤딩 합계 ${PAUSE_SUM}초 — 메타를 갱신한다"
  fi
}

check_duo() {  # $1=대본 $2=모드
  local F="$1" MODE="$2"
  head_ "화자 (트랙 E)"
  [ "$MODE" = C ] && { info "화면 대본은 라벨을 ((메모))로 옮긴다 — 라벨 검사 생략"; return; }

  local RAW; RAW="$(mktemp)"
  case "$MODE" in
    A) body_A "$F" "" > "$RAW" ;;
    B) body_B "$F" "" > "$RAW" ;;
  esac

  local NOLABEL; NOLABEL=$(perl -CSD -Mutf8 -ne 'print if !/^([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,9})\s*[:：]\s*\S/' "$RAW" | grep -c . || true)
  if [ "$NOLABEL" -gt 0 ]; then
    fail "화자 라벨이 없는 문단 ${NOLABEL}개 — 누가 말하는지 모르는 문단은 녹음 사고가 된다 (formats.md §3)"
    perl -CSD -Mutf8 -ne 'print "      · " . substr($_, 0, 40) . "\n" if !/^([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,9})\s*[:：]\s*\S/' "$RAW" | head -5
  else ok "모든 문단에 화자 라벨 있음"; fi

  local LABELS N
  LABELS="$(perl -CSD -Mutf8 -ne 'print "$1\n" if /^([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,9})\s*[:：]\s*\S/' "$RAW" | sort | uniq -c | sort -rn)"
  N=$(printf '%s\n' "$LABELS" | grep -c . || true)
  printf '%s\n' "$LABELS" | sed 's/^/      /'
  if [ "$N" -eq 2 ]; then ok "화자 2명"
  elif [ "$N" -lt 2 ]; then fail "화자가 ${N}명 — 대담이 아니다. 트랙 B로 바꾸거나 반론자를 세운다"
  else fail "화자가 ${N}명 — 세 번째 화자가 있으면 좌담이고 이 골격이 맞지 않는다 (formats.md §2)"; fi

  # 한 발언 3문장 이내
  local LONGU
  LONGU=$(perl -CSD -Mutf8 -ne 's/^([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,9})\s*[:：]\s*//;
    my @s = grep { /\S/ } split /(?<=[.?!])\s+/; print "$.\n" if @s > 3' "$RAW" | grep -c . || true)
  if [ "$LONGU" -gt 0 ]; then
    warn "4문장 이상인 발언 ${LONGU}개 — 한 발언 3문장 이내. 5문장을 넘으면 독백이다"
    perl -CSD -Mutf8 -ne 's/^([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,9})\s*[:：]\s*//;
      my @s = grep { /\S/ } split /(?<=[.?!])\s+/; printf("      · %d문장 | %s\n", scalar @s, substr($_,0,32)) if @s > 3' "$RAW" | head -5
  else ok "모든 발언이 3문장 이내"; fi

  # 발언 비중
  perl -CSD -Mutf8 -MUnicode::Normalize -ne '
    next unless /^([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,9})\s*[:：]\s*(.*)$/;
    $n{$1} += length NFC($2); $tot += length NFC($2);
    END { for (sort { $n{$b} <=> $n{$a} } keys %n) {
      printf("      %-10s %6d자  %4.1f%%\n", $_, $n{$_}, 100*$n{$_}/$tot);
      print "SKEW\n" if $n{$_}/$tot > 0.8 } }' "$RAW" > "$RAW.b"
  grep -v '^SKEW$' "$RAW.b"
  if grep -q '^SKEW$' "$RAW.b"; then
    warn "한 화자가 발언의 80% 이상 — 대담이 아니라 인터뷰 형식의 독백이다. 되묻기를 늘린다"
  else ok "발언 비중 균형"; fi
  rm -f "$RAW" "$RAW.b"
}

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
  local CPS AVG_LO AVG_HI TNAME
  case "$TRACK" in
    talk)    CPS=370; AVG_LO=30; AVG_HI=45; TNAME="토킹헤드" ;;
    recall)  CPS=350; AVG_LO=25; AVG_HI=42; TNAME="인출 훈련형" ;;
    predict) CPS=330; AVG_LO=35; AVG_HI=50; TNAME="예측·검증형" ;;
    duo)     CPS=380; AVG_LO=22; AVG_HI=40; TNAME="대화·대담형" ;;
    *)       TRACK=long; CPS=310; AVG_LO=45; AVG_HI=60; TNAME="롱폼 내레이션" ;;
  esac
  PAUSE_SUM=0

  printf '검수: %s  (모드 %s · 트랙 %s · 목표 %s자)\n' "$F" "$MODE" "$TNAME" "${TARGET/#0/미상}"

  head_ "인코딩"
  if ! perl -e 'use strict; my $d = do { local $/; open my $fh, "<:raw", $ARGV[0] or die; <$fh> };
        require Encode; my $ok = eval { Encode::decode("UTF-8", $d, Encode::FB_CROAK()); 1 }; exit($ok ? 0 : 1)' "$F"; then
    fail "UTF-8 이 아니다 — 다른 인코딩(CP949 등)으로 저장됐다. 글자수·검색이 전부 어긋난다"
    printf '\n%s\n' "=== 인코딩부터 고친다. 나머지 검사는 의미가 없어 건너뛴다"
    return
  else
    ok "UTF-8"
    perl -CSD -Mutf8 -ne 'exit 1 if /^\x{FEFF}/' "$F" || fail "파일 앞에 BOM 이 있다 — 낭독되지 않는 글자가 하나 섞여 있다. 제거한다"
    if perl -CSD -Mutf8 -ne 'exit 1 if /[\x{1100}-\x{11FF}\x{A960}-\x{A97F}\x{D7B0}-\x{D7FF}]/' "$F"; then
      ok "한글 정규화 NFC"
    else
      warn "한글 자모가 분해돼 있다(NFD) — 글자수가 두 배 이상으로 세어진다. 아래 수치는 NFC 로 맞춰 계산했지만, 파일 자체를 NFC 로 저장해야 편집기·TTS 에서 사고가 없다"
    fi
    case "$MODE" in
      B) [ -n "$(tail -c 1 "$F")" ] && warn "파일 끝에 개행이 없다 (templates.md §3)" ;;
    esac
  fi

  # 트랙 전용 검사를 먼저 — 멈춤 합계를 분량 보고에 쓴다
  case "$TRACK" in
    recall)  check_recall  "$F" "$MODE" "$SRC" "$SIDE" ;;
    predict) check_predict "$F" "$MODE" "$SRC" "$SIDE" ;;
    duo)     check_duo     "$F" "$MODE" ;;
  esac

  local TMP; TMP="$(mktemp)"; trap 'rm -f "$TMP"' RETURN
  case "$MODE" in
    A) body_A "$F" "$TRACK" ;;
    B) body_B "$F" "$TRACK" ;;
    C) body_C "$F" ;;
  esac | nfc > "$TMP"

  head_ "분량과 문장"
  local S; S="$(stats < "$TMP")"
  local CHARS AVG LONG
  CHARS=$(printf '%s' "$S" | head -1 | sed -n 's/.*chars=\([0-9]*\).*/\1/p')
  AVG=$(printf '%s'  "$S" | head -1 | sed -n 's/.*avg=\([0-9.]*\).*/\1/p')
  LONG=$(printf '%s' "$S" | head -1 | sed -n 's/.*long=\([0-9]*\).*/\1/p')
  check_len "$CHARS" "$TARGET" "$CPS" "$PAUSE_SUM"
  if [ "${LONG:-0}" -gt 0 ]; then
    fail "90자 초과 문장 ${LONG}개 — 전부 쪼갠다"
    printf '%s\n' "$S" | tail -n +2
  else ok "90자 초과 문장 없음"; fi
  if awk -v a="$AVG" -v lo="$AVG_LO" -v hi="$AVG_HI" 'BEGIN{exit !(a<lo||a>hi)}'; then
    warn "평균 문장 길이 ${AVG}자 — ${TNAME} 목표 ${AVG_LO}~${AVG_HI}자"
  else ok "평균 문장 길이 ${AVG}자"; fi

  head_ "금지 표현"
  if grep -nE "$BANNED" "$TMP"; then fail "금지 표현 — craft.md §4 표의 대안으로 고친다"; else ok "없음"; fi

  head_ "초 약속 대사"
  if grep -nE '[0-9]+ ?초[^.?!…]*(드릴게|드리겠|기다리겠|기다릴게|기다려 보|세어 보|세 보겠|셀게|셉니다)' "$TMP"; then
    fail "낭독 대사가 멈춤 초를 약속한다 — 실제 멈춤 길이와 어긋난다. 초 없는 지시문으로 고친다 (craft.md §2.5)"
  else ok "없음"; fi

  head_ "낭독 아닌 글자 누출"
  case "$MODE" in
    A) if grep -nE '\[(B롤|비롤|자료|화면|인서트|pause|정지|강조|효과음)|※|▶' "$TMP"; then
         fail "연출 지시가 낭독 본문에 섞였다 — ## 연출 메모 로 옮긴다"; else ok "없음"; fi
       if [ "$TRACK" = recall ] || [ "$TRACK" = predict ]; then
         if grep -nE '\([0-9]+초 ?(쉼|정지|멈춤)\)|\.\.\.$|…$' "$TMP"; then
           fail "멈춤을 낭독 본문에 적었다 — '⏸ 멈춤 N초' 헤딩으로 옮긴다 (craft.md §2.5)"
         else ok "멈춤 표기 누출 없음"; fi
       fi ;;
    B) LEAK='^#|^[[:space:]]*[-*+] |^[[:space:]]*[0-9]+\. |\*\*|`|^---|\[|\]|\(|\)|※|▶|[0-9]{2}:[0-9]{2}'
       if grep -nE "$LEAK" "$F"; then
         fail "순수 대사 파일에 낭독하지 않는 글자가 있다 — 전부 제거한다"; else ok "없음"; fi
       [ "$TRACK" = duo ] && info "트랙 E는 줄머리 화자 라벨만 예외로 허용된다 (templates.md §3)" ;;
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
    if [ "$TRACK" = recall ] || [ "$TRACK" = predict ]; then
      head_ "화면 대본 멈춤 메모"
      local NM; NM=$(perl -CSD -Mutf8 -ne '$c++ while /\(\(\s*멈춤/g; END{print $c+0}' "$F")
      if [ "$NM" -gt 0 ]; then ok "((멈춤 …)) 메모 ${NM}개"
      else fail "((멈춤 N초)) 메모가 없다 — 편집자가 인출 멈춤 자리를 모른다 (templates.md §5)"; fi
    fi
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
          BASE="$(body_auto "$SRC" | nfc | stats | head -1 | sed -n 's/.*chars=\([0-9]*\).*/\1/p')"
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

  head_ "트랙 일관성"
  local TSET; TSET="$(for f in "${EPS[@]}"; do track_of "$f"; done | sort -u | tr '\n' ' ')"
  info "쓰인 트랙: ${TSET% }"
  local TN; TN=$(printf '%s' "$TSET" | wc -w | tr -d ' ')
  if [ "$TN" -eq 1 ]; then ok "전편 동일 트랙"
  elif [ "$TN" -eq 2 ] && printf '%s' "$TSET" | grep -q recall && printf '%s' "$TSET" | grep -q predict; then
    warn "C + D 혼합 — 마지막 편만 D(전이 검사)인 경우에만 허용된다 (formats.md §0). 바이블에 그 사실이 적혀 있는지 확인"
  else fail "한 시리즈에 트랙이 ${TN}종 섞였다 — 톤이 깨진다 (formats.md §0)"; fi

  head_ "편별 분량과 문체 (${#EPS[@]}편)"
  local SUM=0 CNT=0
  for f in "${EPS[@]}"; do
    local S C A T
    S="$(body_auto "$f" | nfc | stats | head -1)"
    C=$(printf '%s' "$S" | sed -n 's/.*chars=\([0-9]*\).*/\1/p')
    A=$(printf '%s' "$S" | sed -n 's/.*avg=\([0-9.]*\).*/\1/p')
    T="$(meta_target "$(src_of "$f")" 2>/dev/null)"
    printf '      %-44s %6s자  avg %s  목표 %s  [%s]\n' "$(basename "$f")" "$C" "$A" "${T:-?}" "$(track_of "$f")"
    if [ -n "${T:-}" ] && [ "${T:-0}" -gt 0 ]; then
      [ "$C" -lt $(( T * 9 / 10 )) ] || [ "$C" -gt $(( T * 11 / 10 )) ] && fail "$(basename "$f") 분량이 목표 ±10% 밖"
    fi
    SUM=$(awk -v s="$SUM" -v a="$A" 'BEGIN{print s+a}'); CNT=$((CNT+1))
    case "$f" in *.txt) [ -f "${f%.txt}.meta.md" ] || fail "$(basename "$f") 사이드카 없음" ;; esac
  done
  local MEAN; MEAN=$(awk -v s="$SUM" -v n="$CNT" 'BEGIN{printf "%.1f", s/n}')
  info "편별 평균 문장 길이의 평균 = ${MEAN}자"
  for f in "${EPS[@]}"; do
    local A; A="$(body_auto "$f" | nfc | stats | head -1 | sed -n 's/.*avg=\([0-9.]*\).*/\1/p')"
    awk -v a="$A" -v m="$MEAN" 'BEGIN{exit !((a>m?a-m:m-a) > m*0.15)}' \
      && warn "$(basename "$f") 문체 드리프트 — 평균 문장 ${A}자 (시리즈 평균 ${MEAN}자에서 15% 이탈)"
  done

  if printf '%s' "$TSET" | grep -qE 'recall|predict'; then
    head_ "인출 설계 (트랙 C·D 시리즈)"
    grep -q '^## 인출 설계' "$BIBLE" \
      && ok "바이블에 ## 인출 설계 있음" \
      || fail "바이블에 ## 인출 설계(질문 은행)가 없다 — 편마다 질문을 따로 만들면 겹친다 (templates.md §1)"
    info "편별 질문·재인출·예측 수:"
    for f in "${EPS[@]}"; do
      case "$f" in
        *.md) local E; E="$(events "$f")"
              printf '      %-44s Q%s ↻%s A%s P%s R%s ⏸%s\n' "$(basename "$f")" \
                "$(printf '%s\n' "$E" | grep -c '^Q ' || true)" \
                "$(printf '%s\n' "$E" | grep -c '^QR ' || true)" \
                "$(printf '%s\n' "$E" | grep -c '^A ' || true)" \
                "$(printf '%s\n' "$E" | grep -c '^P ' || true)" \
                "$(printf '%s\n' "$E" | grep -c '^R ' || true)" \
                "$(printf '%s\n' "$E" | grep -c '^PAUSE ' || true)" ;;
        *)    printf '      %-44s (모드 B — 사이드카 인출 장부를 직접 본다)\n' "$(basename "$f")" ;;
      esac
    done
    info "같은 질문이 두 편에 배정되지 않았는지는 바이블 질문 은행의 '배정 편' 열로 대조한다"
  fi

  if printf '%s' "$TSET" | grep -q duo; then
    head_ "화자 표기 통일 (트랙 E 시리즈)"
    grep -q '^## 화자' "$BIBLE" && ok "바이블에 ## 화자 있음" \
      || fail "바이블에 ## 화자 섹션이 없다 — 라벨이 편마다 갈린다 (templates.md §1)"
    for f in "${EPS[@]}"; do
      printf '      %-44s %s\n' "$(basename "$f")" \
        "$(perl -CSD -Mutf8 -ne 'print "$1 " if /^([가-힣A-Za-z][가-힣A-Za-z0-9 ]{0,9})\s*[:：]\s*\S/' "$f" | tr ' ' '\n' | sort -u | tr '\n' ' ')"
    done
    info "위 목록이 편마다 다르면 라벨이 갈린 것이다"
  fi

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
