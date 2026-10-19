#!/usr/bin/env bash
# Prépare les sessions Claude Code dans le cloud : dépendances Video-Use + préchauffage Hyperframes.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
bash .claude/skills/motion-design-reel/scripts/setup-check.sh --install >/dev/null 2>&1 || true
