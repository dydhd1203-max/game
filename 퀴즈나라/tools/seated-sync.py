"""Writes avatar-foundation.js SEATED_LAYERS and the seated line of
tools/deployment-files.cjs from assets/seated/layers.json (tools/seated-layers.py).

  python3 tools/seated-sync.py

tools/seated-layers.py runs it after every cut, so the runtime table and the
deployed pictures always match the layers on disk (the file list used to be
pasted by hand, and a missed picture is a 404 that hides a seated avatar).
"""
import json, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sync(quiet=False):
    D = json.load(open(os.path.join(ROOT, 'assets/seated/layers.json'))); files = []; sexes = []
    for sex, views in D.items():
        vs = []
        for view, e in views.items():
            ls = []
            for name, rect in e['layers'].items():
                if not rect: ls.append("'%s':null" % name); continue
                url = 'assets/seated/%s-%s-%s.png' % (sex, view, name.replace(':', '-'))
                assert os.path.exists(os.path.join(ROOT, url)), url + ' is in layers.json but not on disk'
                files.append(url)
                ls.append("'%s':Object.freeze({url:'%s',rect:%s})" % (name, url, json.dumps(rect)))
            vs.append("%s:Object.freeze({seat:%s,frame:%s,unit:%s,layers:Object.freeze({%s})})" % (view, e['seat'], json.dumps(e['frame']), e['unit'], ','.join(ls)))
        sexes.append("%s:Object.freeze({%s})" % (sex, ','.join(vs)))
    js = 'Object.freeze({' + ','.join(sexes) + '})'
    p = os.path.join(ROOT, 'avatar-foundation.js'); t = open(p).read(); assert len(re.findall(r"const SEATED_LAYERS=.*;\n", t)) == 1
    open(p, 'w').write(re.sub(r"const SEATED_LAYERS=.*;\n", lambda m: 'const SEATED_LAYERS=' + js + ';\n', t))
    # the deployment list: the line after the seated comment
    p = os.path.join(ROOT, 'tools/deployment-files.cjs'); lines = open(p).read().split('\n')
    i = [k for k, l in enumerate(lines) if 'Seated (floor-sit) layers' in l]; assert len(i) == 1, 'seated comment in deployment-files.cjs'
    assert lines[i[0] + 1].strip().startswith("'assets/seated/"), 'seated line in deployment-files.cjs'
    lines[i[0] + 1] = '  ' + ','.join("'%s'" % f for f in files) + ','
    open(p, 'w').write('\n'.join(lines))
    if not quiet: print('seated-sync:', len(files), 'pictures in SEATED_LAYERS and tools/deployment-files.cjs')
    return files


if __name__ == '__main__':
    sync()
