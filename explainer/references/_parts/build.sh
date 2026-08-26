#!/usr/bin/env bash
# _parts 조각을 조립해 references/base-*.html (자기완결 단일 파일)을 생성한다.
# 템플릿 자체를 개선할 때만 실행한다. 문서를 만들 때는 base-*.html을 복사해 쓴다.
set -euo pipefail
cd "$(dirname "$0")"
OUT=".."

build() {
  key="$1"
  {
    cat <<'HTML'
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>설명 문서</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<!-- MERMAID: 상세 설명에 ```mermaid 코드블록을 쓸 때만 아래 한 줄의 주석을 해제한다 (없으면 그대로 둔다) -->
<!-- <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script> -->
<style>
HTML
    cat css-common.css
    echo
    cat "css-$key.css"
    echo '</style>'
    echo '</head>'
    echo '<body>'
    cat "shell-$key.html"
    echo '<script>'
    cat data-demo.js engine.js boot-common.js "boot-$key.js"
    echo '</script>'
    echo '</body>'
    echo '</html>'
  } > "$OUT/base-$key.html"
  printf 'built base-%s.html (%s lines)\n' "$key" "$(wc -l < "$OUT/base-$key.html" | tr -d ' ')"
}

for k in card docs steps; do build "$k"; done
