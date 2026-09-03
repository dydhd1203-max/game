#!/bin/sh
# 문법 검사 — index.html 안의 모듈 스크립트만 뽑아 node --check 를 돌린다.
#   사용법: bash chk.sh <게임파일>       (안 주면 ../index.html)
# ★ 예전엔 경로가 소스에 박혀 있어서 폴더를 옮긴 뒤로 늘 깨져 있었다. 인자로 받는다.
SRC="${1:-../index.html}"
[ -f "$SRC" ] || { echo "파일이 없다: $SRC"; exit 1; }
TMP="$(mktemp -d)"
SRC="$SRC" TMP="$TMP" python3 - <<'PY'
import io,os,re
src=os.environ['SRC']; tmp=os.environ['TMP']
s=io.open(src,encoding='utf-8').read()
i=s.index('<script type="module">')+len('<script type="module">')
j=s.index('</script>', i)
body=s[i:j]
# import 문만 빼고 검사 (node 는 three 를 못 찾는다)
body=re.sub(r"^import .*$", "", body, flags=re.M)
io.open(os.path.join(tmp,'mod.mjs'),'w',encoding='utf-8').write(body)
print("module chars:", len(body))
PY
node --check "$TMP/mod.mjs" && echo "SYNTAX OK"
R=$?; rm -rf "$TMP"; exit $R
