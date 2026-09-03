import sys, io
path = sys.argv[1]
data = sys.stdin.buffer.read().decode('utf-8')
src = io.open(path, encoding='utf-8').read()
n_ed = 0
for block in data.split('\n<<<<PAIR>>>>\n'):
    if not block.strip(): continue
    try: old, new = block.split('\n<<<<TO>>>>\n')
    except ValueError:
        print('BAD BLOCK:\n'+block[:200]); sys.exit(1)
    c = src.count(old)
    if c != 1:
        print('FAIL count=%d for:\n%s' % (c, old[:300])); sys.exit(1)
    src = src.replace(old, new); n_ed += 1
io.open(path, 'w', encoding='utf-8').write(src)
print('OK %d edits' % n_ed)
