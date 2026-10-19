#!/usr/bin/env bash
# Planche contact : N images clés réparties sur la vidéo, horodatées, en une seule image.
# Usage : contact-sheet.sh <video> [n=12] [sortie.jpg]
set -euo pipefail

in="${1:?usage: contact-sheet.sh <video> [n=12] [sortie.jpg]}"
n="${2:-12}"
out="${3:-${in%.*}-planche.jpg}"

dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")"
cols=4
rows=$(( (n + cols - 1) / cols ))
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for i in $(seq 0 $((n - 1))); do
  # Milieu de chaque tranche, pour éviter la toute première et la toute dernière image.
  t="$(awk -v d="$dur" -v i="$i" -v n="$n" 'BEGIN { printf "%.3f", d * (i + 0.5) / n }')"
  label="$(awk -v t="$t" 'BEGIN { printf "%d\\:%05.2f", int(t / 60), t - 60 * int(t / 60) }')"
  ffmpeg -v error -y -ss "$t" -i "$in" -frames:v 1 \
    -vf "scale=360:-2,drawtext=text='$label':x=10:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6" \
    "$tmp/$(printf '%03d' "$i").png"
done

ffmpeg -v error -y -framerate 1 -i "$tmp/%03d.png" \
  -vf "tile=${cols}x${rows}:padding=8:margin=8:color=0x111111" -frames:v 1 -q:v 3 "$out"
echo "$out"
