"""Split the approved reference sheet into the base body's garment layers.

Source: assets/avatar-reference-candidates/body-study-2026-10-04.png
(male/female x front/right/back). Each layer keeps the sheet's pixel grid,
so every part rect and joint below is in original sheet pixels.

Outputs (sd-foundation-ref-*):
  shirt.png    torso + collar; the cloth under the hanging arm and sleeves
               rebuilt from the cloth around it (see rebuild_cloth), with
               the torso's own side outline under the sleeves (front/back)
  sleeves.png  sleeves with cuffs
  shorts.png   shorts; the cloth under the hand rebuilt the same way
  shoes.png    shoes and socks
  arms.png     arms; the part hidden in the sleeve extended to the shoulder
  legs.png     legs; the part hidden in the shorts extended to the hip
  neck.png     neck below the chin, extended up under the original head
  data.js      part rects, joints, limb radii and scale per sex/view

The body (arms, legs, neck and the body fields of data.js) is FROZEN since
stage 3 (tools/garment/frozen/frozen-body.json). Garments never re-derive
it. The code lives in tools/avatar_build/ (body.py, cloth.py, common.py) and
stays so the frozen body can always be rebuilt and compared byte-for-byte.

Run:
  python3 tools/build-reference-body.py --out DIR [--debug DIR]
      rebuild into DIR (a check: tools/garment/verify-body-freeze.py --rebuild)
  python3 tools/build-reference-body.py --allow-body-change [--debug DIR]
      write assets/ (a body change: needs the user's approval, then
      python3 tools/garment/make-frozen.py --allow-body-change)
Writing assets/ without --allow-body-change is refused.
"""
import argparse
import os
import sys

sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from avatar_build import body, freeze  # noqa: E402


def main(argv=None):
    p = argparse.ArgumentParser(description='Rebuild the frozen reference body layers.')
    p.add_argument('--out', help='output directory (default: assets/, which needs --allow-body-change)')
    p.add_argument('--debug', help='write label and refill debug images here')
    p.add_argument('--allow-body-change', action='store_true',
                   help='allow writing the frozen body into assets/ (user approval required)')
    args = p.parse_args(argv)
    out = os.path.realpath(args.out or body.ASSETS)
    if out == os.path.realpath(body.ASSETS) and not args.allow_body_change:
        print('refused: assets/sd-foundation-ref-* is the frozen body (tools/garment/frozen/frozen-body.json).\n'
              '  기준 몸은 고정되어 있습니다. 확인용 다시 만들기는 --out <임시 폴더>로, 몸을 바꾸려면 사용자 승인 뒤\n'
              '  --allow-body-change를 붙이세요.', file=sys.stderr)
        return 2
    os.makedirs(out, exist_ok=True)
    body.enable_body_mode('tools/build-reference-body.py')
    sheet, labels = body.build(out, args.debug)
    if args.debug:
        body.debug(sheet, labels, args.debug, out)
    problems = freeze.compare_outputs(out)
    if problems:
        print('frozen body differs from this build:\n  ' + '\n  '.join(problems))
        if out == os.path.realpath(body.ASSETS):
            print('BODY CHANGED in assets/: regenerate the frozen artifacts with\n'
                  '  python3 tools/garment/make-frozen.py --allow-body-change\n'
                  'and record the user approval (이 변경은 사용자 승인이 필요합니다).')
    else:
        print('frozen body reproduced (sha256 equal to frozen-body.json)')
    print('ok')
    return 0


if __name__ == '__main__':
    sys.exit(main())
