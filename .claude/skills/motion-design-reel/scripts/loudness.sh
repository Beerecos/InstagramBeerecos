#!/usr/bin/env bash
# Mesure le volume intégré (LUFS) ; avec --fix, normalise à -14 LUFS / -1 dBTP en deux passes.
# Usage : loudness.sh <video> [--fix sortie.mp4]
set -euo pipefail

in="${1:?usage: loudness.sh <video> [--fix sortie.mp4]}"
target=-14

measure() {
  ffmpeg -hide_banner -nostats -i "$1" -af "loudnorm=I=$target:TP=-1:LRA=11:print_format=json" -f null - 2>&1 \
    | sed -n '/^{/,/^}/p'
}

json="$(measure "$in")"
get() { printf '%s' "$json" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
printf 'Volume intégré : %s LUFS  |  True peak : %s dBTP  (cible %s LUFS)\n' \
  "$(get input_i)" "$(get input_tp)" "$target"

if [ "${2:-}" = "--fix" ]; then
  out="${3:?--fix demande un fichier de sortie}"
  ffmpeg -hide_banner -v error -y -i "$in" -c:v copy \
    -af "loudnorm=I=$target:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
    -c:a aac -b:a 192k -ar 48000 "$out"
  json="$(measure "$out")"
  printf 'Après correction : %s LUFS  |  %s dBTP  ->  %s\n' "$(get input_i)" "$(get input_tp)" "$out"
fi
