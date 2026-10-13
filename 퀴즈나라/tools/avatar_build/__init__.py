"""Shared imaging library for the reference body, the garment pipeline and the
hair tools (stage 3). numpy + PIL only.

  common  generic masks, filters, flood fills, sheet/template geometry
  cloth   prints, hidden-cloth rebuild, painted outlines, seam fade, pin-holes
  body    the frozen body build (body mode only; tools/build-reference-body.py)
  freeze  frozen-body hashes and checks (tools/garment/verify-body-freeze.py)
  frozen  frozen build artifacts: owner map, zones, cover/occlusion masks,
          contact bands, clean limb/neck art, class limits
"""
