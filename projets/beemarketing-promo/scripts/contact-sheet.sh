#!/usr/bin/env bash
# Planche de contrôle : images fixes Remotion à des instants donnés, assemblées en grille.
# Usage : bash scripts/contact-sheet.sh <9x16|16x9> <sortie.png> <image1> <image2> ...
set -euo pipefail
fmt=$1; out=$2; shift 2
tmp=$(mktemp -d)
for fr in "$@"; do
  npx remotion still remotion/index.ts "BeeMarketing-$fmt" "$tmp/$(printf %05d "$fr").png" --frame="$fr" --log=error >/dev/null
done
w=$([ "$fmt" = 9x16 ] && echo 300 || echo 480)
ffmpeg -v error -y -pattern_type glob -i "$tmp/*.png" -vf "scale=$w:-1,drawbox=c=gray:t=1,tile=$(( $# < 6 ? $# : 6 ))x$(( ($# + 5) / 6 ))" -frames:v 1 "$out"
rm -rf "$tmp"
