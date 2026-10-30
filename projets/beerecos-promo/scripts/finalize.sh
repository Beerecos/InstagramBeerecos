#!/usr/bin/env bash
# Finalise un rendu Remotion : normalisation sonore (−14 LUFS, crête vraie −1,5 dBTP, deux passes),
# vidéo copiée sans réencodage, H.264 + yuv420p + AAC, faststart pour la lecture en ligne.
# Usage : bash scripts/finalize.sh exports/raw_9x16.mp4 exports/BeeRecos_Promo_60s_9x16.mp4
set -euo pipefail
in=$1; out=$2
stats=$(ffmpeg -hide_banner -i "$in" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$stats" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i "$in" -c:v copy \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000" \
  -c:a aac -b:a 192k -movflags +faststart "$out"
echo "→ $out"
