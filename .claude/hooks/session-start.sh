#!/usr/bin/env bash
# Prépare les sessions Claude Code dans le cloud : Node 24 (exigé par eve), dépendances npm,
# dépendances Python de la chaîne vidéo.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

NODE_DIR="$HOME/.local/node24"
if ! "$NODE_DIR/bin/node" -v 2>/dev/null | grep -q '^v24\.'; then
  V=$(curl -fsS https://nodejs.org/dist/index.json | python3 -c "import json,sys;print([r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v24.')][0])")
  mkdir -p "$NODE_DIR"
  curl -fsSL "https://nodejs.org/dist/$V/node-$V-linux-x64.tar.xz" | tar -xJ -C "$NODE_DIR" --strip-components=1
fi
[ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export PATH=\"$NODE_DIR/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
export PATH="$NODE_DIR/bin:$PATH"

npm install --no-audit --no-fund >/dev/null 2>&1 || true
bash .claude/skills/motion-design-reel/scripts/setup-check.sh --install >/dev/null 2>&1 || true
