#!/bin/bash
# Cloud-session setup for the QUIZ나라 tools (퀴즈나라/tools).
# - The browser verifiers default to /usr/bin/chromium, which cloud containers
#   do not have; point them at the pre-installed Playwright Chromium instead.
# - Python build tools must not leave __pycache__ in the repo.
# - The garment/hair pipelines need numpy and Pillow only.
# The zombie game (클로드/, 깃허브에올릴것/) keeps its own setup and is untouched.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

env_file="${CLAUDE_ENV_FILE:-}"
put() { [ -n "$env_file" ] && echo "export $1" >> "$env_file"; return 0; }

browser=""
for candidate in /opt/pw-browsers/chromium-*/chrome-linux/chrome /usr/bin/chromium /usr/bin/chromium-browser; do
  if [ -x "$candidate" ]; then browser="$candidate"; break; fi
done
if [ -n "$browser" ] && [ -z "${QUIZ_BROWSER_EXECUTABLE:-}" ]; then
  put "QUIZ_BROWSER_EXECUTABLE=\"$browser\""
fi

put "PYTHONDONTWRITEBYTECODE=1"

if ! python3 -c 'import numpy, PIL' >/dev/null 2>&1; then
  python3 -m pip install --quiet --disable-pip-version-check numpy pillow \
    || python3 -m pip install --quiet --disable-pip-version-check --break-system-packages numpy pillow
fi

echo "QUIZ나라 session setup: browser=${browser:-none}, python deps ok"
