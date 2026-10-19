#!/usr/bin/env bash
# Vérifie (et avec --install, installe) ce qu'il faut pour la méthode motion-design-reel.
# Usage : setup-check.sh [--install]
set -u

INSTALL=0
[ "${1:-}" = "--install" ] && INSTALL=1

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
VIDEO_USE="$ROOT/.claude/skills/video-use"
missing=0

ok()   { printf '  [ok]  %s\n' "$1"; }
ko()   { printf '  [!!]  %s\n' "$1"; missing=$((missing + 1)); }

echo "Outils système"
if command -v node >/dev/null; then
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -ge 22 ]; then ok "Node.js $(node -v)"; else ko "Node.js $(node -v) (22+ requis)"; fi
else
  ko "Node.js absent (22+ requis)"
fi
command -v ffmpeg  >/dev/null && ok "ffmpeg"  || ko "ffmpeg absent"
command -v ffprobe >/dev/null && ok "ffprobe" || ko "ffprobe absent"
command -v python3 >/dev/null && ok "python3 $(python3 -V 2>&1 | cut -d' ' -f2)" || ko "python3 absent"

echo "Hyperframes"
if hf="$(npx --yes hyperframes --version 2>/dev/null)"; then
  ok "hyperframes $hf (via npx)"
else
  ko "hyperframes ne répond pas (npx --yes hyperframes --version)"
fi

echo "Video-Use (dépendances Python)"
if python3 -c 'import requests, librosa, matplotlib, PIL, numpy' 2>/dev/null; then
  ok "requests librosa matplotlib pillow numpy"
else
  ko "dépendances Python de video-use manquantes"
  if [ "$INSTALL" = 1 ]; then
    if command -v uv >/dev/null; then
      uv pip install --system requests librosa matplotlib pillow numpy >/dev/null 2>&1 \
        || pip3 install --quiet requests librosa matplotlib pillow numpy
    else
      pip3 install --quiet requests librosa matplotlib pillow numpy
    fi
    python3 -c 'import requests, librosa, matplotlib, PIL, numpy' 2>/dev/null \
      && { ok "installées"; missing=$((missing - 1)); }
  fi
fi

echo "Voix IA locale (Hyperframes tts)"
if python3 -c 'import kokoro_onnx, soundfile' 2>/dev/null; then
  ok "kokoro-onnx soundfile"
else
  ko "kokoro-onnx / soundfile manquants (voix locale)"
  if [ "$INSTALL" = 1 ]; then
    uv pip install --system kokoro-onnx soundfile >/dev/null 2>&1 || pip3 install --quiet kokoro-onnx soundfile
    python3 -c 'import kokoro_onnx, soundfile' 2>/dev/null && { ok "installées"; missing=$((missing - 1)); }
  fi
fi

echo "Clé ElevenLabs (transcription Video-Use, optionnelle)"
if [ -n "${ELEVENLABS_API_KEY:-}" ] || grep -q '^ELEVENLABS_API_KEY=..' "$VIDEO_USE/.env" 2>/dev/null; then
  ok "ELEVENLABS_API_KEY trouvée"
else
  echo "  [--]  absente : coupes Video-Use indisponibles ; utiliser la transcription locale Hyperframes"
fi

if [ "$missing" -gt 0 ]; then
  echo "$missing élément(s) manquant(s)."
  exit 1
fi
echo "Prêt."
