"""Writes avatar-foundation.js SEATED_LAYERS from assets/seated/layers.json
(tools/seated-layers.py) and prints the pictures for tools/deployment-files.cjs.

  python3 tools/seated-sync.py
"""
import json, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(ROOT, 'assets/seated/layers.json'))); files = []
sexes = []
for sex, views in D.items():
    vs = []
    for view, e in views.items():
        unit = None; ls = []
        for name, rect in e['layers'].items():
            if not rect: ls.append("'%s':null" % name); continue
            url = 'assets/seated/%s-%s-%s.png' % (sex, view, name.replace(':', '-')); files.append(url)
            ls.append("'%s':Object.freeze({url:'%s',rect:%s})" % (name, url, json.dumps(rect)))
        vs.append("%s:Object.freeze({seat:%s,frame:%s,unit:%s,layers:Object.freeze({%s})})" % (view, e['seat'], json.dumps(e['frame']), e['unit'], ','.join(ls)))
    sexes.append("%s:Object.freeze({%s})" % (sex, ','.join(vs)))
js = 'Object.freeze({' + ','.join(sexes) + '})'
p = os.path.join(ROOT, 'avatar-foundation.js'); t = open(p).read(); assert len(re.findall(r"const SEATED_LAYERS=.*;\n", t)) == 1
t = re.sub(r"const SEATED_LAYERS=.*;\n", lambda m: 'const SEATED_LAYERS=' + js + ';\n', t); open(p, 'w').write(t)
print(json.dumps(files))
