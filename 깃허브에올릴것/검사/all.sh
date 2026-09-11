#!/bin/bash
# 전체 검사를 한꺼번에 돌린다.
#
# 왜 동시에 돌리나 — 하나씩 돌리면 24개에 20분이 넘고, 무엇보다 **기계가 한가하다.**
# 21차b의 t24 는 혼자서는 일곱 번 내리 통과했는데 여섯 개를 같이 돌리자 세 번에 한 번 빨개졌다
# (검사 사이에 진짜 화면 프레임이 돌아 주는 것에 기대고 있었다).
# 그러니 **바쁜 기계가 기본값**이다. 한가한 판이 필요한 것은 성능 측정뿐이고 그건 따로 돈다.
#
# 출력은 **빨간 것만** 나온다. 초록 스물네 줄은 읽을 것이 없다 — 마지막 합계가 '다 돌았나' 를 말해 준다.
# 항목 합계가 ALL 과 다르면 어딘가 통째로 죽은 것이다(문구도 같이 뜬다).
#
# 쓰는 법:  bash all.sh                      (클로드/index.html · 동시 4개)
#           bash all.sh ../../클로드/배포용/index.html
#           bash all.sh ../../클로드/index.html 6      (더 바쁘게 — 흔들리는 검사를 찾을 때)
cd "$(dirname "$0")" || exit 1
GAME=${1:-../../클로드/index.html}
JOBS=${2:-4}
BASE=${3:-$((20000 + RANDOM % 20000))}
ALL=1009                       # 지금 전체 항목 수 (늘면 이 줄을 고친다)
TESTS="t3 t4 t6 t7 t8 t9 t10 t11 t12 t13 t14 t15 t16 t17 t18 t19 t20 t21 t22 t23 t24 t25 t26 t27"

OUT=$(mktemp -d); i=0
for t in $TESTS; do
  i=$((i+1))
  ( node "$t.mjs" "$GAME" $((BASE+i*7)) >"$OUT/$t.log" 2>&1 ) &
  while [ "$(jobs -rp | wc -l)" -ge "$JOBS" ]; do wait -n; done
done
wait

tot=0; fail=0; dead=0
for t in $TESTS; do
  o=$(grep -c '  OK  ' "$OUT/$t.log"); f=$(grep -c '^FAIL' "$OUT/$t.log")
  tot=$((tot+o+f)); fail=$((fail+f))
  if [ $((o+f)) -eq 0 ]; then
    dead=$((dead+1))
    printf '%-5s 한 항목도 안 돌았다 ↓\n' "$t"; tail -5 "$OUT/$t.log" | sed 's/^/      /'
  elif [ "$f" -gt 0 ]; then
    printf '%-5s %d항목 · 실패 %d ↓\n' "$t" $((o+f)) "$f"
    grep '^FAIL' "$OUT/$t.log" | sed 's/^/      /'
  fi
done

printf '\n합계 %d항목 · 실패 %d' "$tot" "$fail"
[ "$tot" -ne "$ALL" ] && printf '  ← 항목이 %d개여야 한다(%d개 모자람)' "$ALL" $((ALL-tot))
printf '  · 동시 %d개\n' "$JOBS"
[ "$fail" -eq 0 ] && [ "$tot" -eq "$ALL" ] && { rm -rf "$OUT"; exit 0; }
echo "자세한 기록: $OUT"; exit 1
