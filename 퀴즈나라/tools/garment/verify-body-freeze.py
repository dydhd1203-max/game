"""Check that the base body is still the frozen one (stage 3, WP1).

  python3 tools/garment/verify-body-freeze.py              fast checks (seconds)
  python3 tools/garment/verify-body-freeze.py --rebuild    + rebuild the body into a temp dir (byte-identical)
                                                            and regenerate the frozen artifacts (byte-identical)
  python3 tools/garment/verify-body-freeze.py --self-test  + negative controls (each must be caught)

Fast checks:
  - assets/sd-foundation-ref-arms/legs/neck.png and the legacy basic layers
    and data file have the sha256 pinned in tools/garment/frozen/frozen-body.json;
  - the body fields of sd-foundation-ref-data.js equal the frozen ones;
  - SPEC and SPEC_F in avatar-foundation.js equal the frozen values and text;
  - the template is 1629x1086 with the sheet at x 90 (margins 90/91);
  - every frozen artifact and the clean arm/neck art match their sha256;
  - the runtime constants the limits come from are unchanged;
  - derive() refuses to run outside body mode;
  - build-reference-body.py refuses to write assets/ without --allow-body-change.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, TOOLS)
from avatar_build import freeze, frozen  # noqa: E402
from avatar_build.common import TEMPLATE, sha256_file  # noqa: E402

ROOT = os.path.dirname(TOOLS)
PY = sys.executable


def fast(assets=freeze.ASSETS, record=None, runtime=freeze.RUNTIME, quiet=False):
    problems = freeze.check(assets, record, runtime)
    record = record if record is not None else freeze.load_frozen()
    geo = record['template']['measured']
    if (geo['left'], geo['right'], geo['size']) != (TEMPLATE['left'], TEMPLATE['right'], [TEMPLATE['width'], TEMPLATE['height']]):
        problems.append('template geometry %s is not 90/91 on 1629x1086' % geo)
    live = freeze.template_geometry()
    if live['left'] != TEMPLATE['left'] or live['right'] != TEMPLATE['right'] or live['maxDiff'] > .5:
        problems.append('template-sheet.png no longer holds the sheet at x 90 (%s)' % live)
    limits = json.load(open(os.path.join(freeze.FROZEN_DIR, 'limits.json'), encoding='utf-8'))
    rc = frozen.runtime_constants()
    if json.loads(json.dumps(rc)) != limits['runtime']:
        problems.append('runtime constants behind limits.json changed: regenerate with make-frozen.py --allow-body-change')
    return problems


def guard_checks():
    problems = []
    # derive() outside body mode.
    code = ('import sys; sys.path.insert(0, %r)\n'
            'from avatar_build import body\n'
            'try:\n'
            '    body.derive("m-front", body.FIGURES["m-front"])\n'
            '    print("RAN")\n'
            'except body.BodyModeError:\n'
            '    print("REFUSED")\n') % TOOLS
    out = subprocess.run([PY, '-c', code], capture_output=True, text=True).stdout.strip()
    if out != 'REFUSED':
        problems.append('derive() ran outside body mode (%s)' % out)
    # Writes into assets/ without the flag.
    before = {n: sha256_file(os.path.join(freeze.ASSETS, n)) for n in freeze.BUILD_OUTPUTS}
    for args in ([], ['--out', freeze.ASSETS], ['--out', freeze.ASSETS + '/']):
        r = subprocess.run([PY, os.path.join(TOOLS, 'build-reference-body.py')] + args, capture_output=True, text=True)
        if r.returncode != 2 or 'refused' not in r.stderr:
            problems.append('build-reference-body.py %s was not refused (exit %d)' % (' '.join(args), r.returncode))
    after = {n: sha256_file(os.path.join(freeze.ASSETS, n)) for n in freeze.BUILD_OUTPUTS}
    if before != after:
        problems.append('assets changed during the refusal check')
    return problems


def rebuild():
    problems = []
    tmp = tempfile.mkdtemp(prefix='body-rebuild-')
    try:
        r = subprocess.run([PY, os.path.join(TOOLS, 'build-reference-body.py'), '--out', tmp], capture_output=True, text=True)
        if r.returncode != 0:
            return ['rebuild failed: ' + r.stderr[-400:]]
        for n in freeze.BUILD_OUTPUTS:
            a, b = sha256_file(os.path.join(tmp, n)), sha256_file(os.path.join(freeze.ASSETS, n))
            print('  %-32s %s %s' % (n, a[:16], 'identical' if a == b else 'DIFFERS'))
            if a != b:
                problems.append('rebuild of %s differs' % n)
        r = subprocess.run([PY, os.path.join(TOOLS, 'garment', 'make-frozen.py'), '--check', '--quiet'], capture_output=True, text=True)
        print('  ' + (r.stdout.strip().splitlines() or ['?'])[-1])
        if r.returncode != 0:
            problems.append('frozen artifacts are not reproduced: ' + r.stdout[-400:] + r.stderr[-400:])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return problems


def self_test():
    """Each tampered copy must be reported."""
    caught, missed, control = [], [], None
    tmp = tempfile.mkdtemp(prefix='freeze-selftest-')
    try:
        assets = os.path.join(tmp, 'assets'); os.makedirs(assets)
        for n in freeze.BUILD_OUTPUTS:
            shutil.copyfile(os.path.join(freeze.ASSETS, n), os.path.join(assets, n))
        record = freeze.load_frozen()

        def expect(name, problems):
            (caught if problems else missed).append(name)

        control = freeze.check(assets, record, artifacts=False)
        # one byte of the neck PNG (inside its pixel data)
        p = os.path.join(assets, 'sd-foundation-ref-neck.png')
        data = bytearray(open(p, 'rb').read()); data[len(data) // 2] ^= 1; open(p, 'wb').write(bytes(data))
        expect('neck PNG byte flip', freeze.check(assets, record, artifacts=False))
        shutil.copyfile(os.path.join(freeze.ASSETS, 'sd-foundation-ref-neck.png'), p)
        # an elbow joint +1 px in the data file
        p = os.path.join(assets, freeze.DATA_JS)
        text = open(p, encoding='utf-8').read()
        data = freeze.read_data_js(p)
        data['figures']['f-front']['joints']['elbow'][0][1] += 1
        open(p, 'w', encoding='utf-8').write(text[:text.index('Object.freeze(') + 14] + json.dumps(data, separators=(',', ':')) + ');\n')
        expect('elbow +1 px in data.js', freeze.check(assets, record, artifacts=False))
        shutil.copyfile(os.path.join(freeze.ASSETS, freeze.DATA_JS), p)
        # SPEC_F waist changed in a copy of the runtime
        rt = os.path.join(tmp, 'avatar-foundation.js')
        src = open(freeze.RUNTIME, encoding='utf-8').read()
        open(rt, 'w', encoding='utf-8').write(src.replace('SPEC_F=Object.freeze({...SPEC,waist:37.75', 'SPEC_F=Object.freeze({...SPEC,waist:37.80', 1))
        expect('SPEC_F.waist 37.75 -> 37.80', freeze.check(assets, record, rt, artifacts=False))
        # a frozen artifact edited
        rec = json.loads(json.dumps(record))
        k = next(iter(rec['artifacts']))
        rec['artifacts'][k] = '0' * 64
        expect('stale frozen artifact', freeze.check(freeze.ASSETS, rec))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print('  control (untouched copy): %s' % ('passes' if not control else 'REPORTED %s' % control))
    for c in caught:
        print('  caught: ' + c)
    for m in missed:
        print('  MISSED: ' + m)
    problems = ['self-test missed: ' + m for m in missed]
    if control:
        problems.append('self-test control (untouched copy) reported a problem')
    return problems


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument('--rebuild', action='store_true')
    p.add_argument('--self-test', action='store_true')
    args = p.parse_args(argv)
    problems = fast()
    print('frozen body: %s' % ('ok' if not problems else 'PROBLEMS'))
    guards = guard_checks()
    problems += guards
    print('guards (derive outside body mode, writes without --allow-body-change): %s' % ('ok' if not guards else 'FAIL'))
    if args.rebuild:
        print('rebuild into a temp dir:')
        problems += rebuild()
    if args.self_test:
        print('negative controls:')
        problems += self_test()
    if problems:
        print('FAIL:\n  ' + '\n  '.join(problems))
        return 1
    print('ok')
    return 0


if __name__ == '__main__':
    sys.exit(main())
