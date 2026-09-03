#!/bin/sh
SP=.
python3 - <<'PY'
import io,re
s=io.open('/home/user/game/index.html',encoding='utf-8').read()
i=s.index('<script type="module">')+len('<script type="module">')
j=s.index('</script>', i)
body=s[i:j]
# import 문만 빼고 검사 (node 는 three 를 못 찾는다)
body=re.sub(r"^import .*$", "", body, flags=re.M)
io.open('./mod.mjs','w',encoding='utf-8').write(body)
print("module chars:", len(body))
PY
node --check $SP/mod.mjs && echo "SYNTAX OK"
