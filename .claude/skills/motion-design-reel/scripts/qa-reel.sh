#!/usr/bin/env bash
# Contrôle technique avant publication Instagram : 1080x1920, 30/60 i/s, piste audio, ~-14 LUFS.
# Les zones cachées (bas ~20 %, bord droit) se vérifient à l'œil sur la planche générée.
# Usage : qa-reel.sh <video>
set -uo pipefail

in="${1:?usage: qa-reel.sh <video>}"
here="$(dirname "$0")"
fail=0

ok() { printf '  [ok]  %s\n' "$1"; }
ko() { printf '  [!!]  %s\n' "$1"; fail=1; }

probe() { ffprobe -v error -select_streams "$1" -show_entries "stream=$2" -of csv=p=0 "$in" | head -1; }

wh="$(probe v:0 width,height)"
[ "$wh" = "1080,1920" ] && ok "Résolution 1080×1920" || ko "Résolution ${wh/,/×} (attendu 1080×1920)"

fps="$(probe v:0 avg_frame_rate | awk -F/ '{ if ($2 > 0) printf "%.2f", $1 / $2; else print $1 }')"
case "$fps" in
  30.00|29.97|60.00|59.94) ok "Cadence $fps i/s" ;;
  *) ko "Cadence $fps i/s (attendu 30 ou 60)" ;;
esac

codec="$(probe v:0 codec_name)"
[ "$codec" = "h264" ] || [ "$codec" = "hevc" ] && ok "Codec vidéo $codec" || ko "Codec vidéo $codec (h264 recommandé)"

if [ -n "$(probe a:0 codec_name)" ]; then
  ok "Piste audio présente"
  lufs="$(bash "$here/loudness.sh" "$in" | sed -n 's/^Volume intégré : \([-0-9.]*\) LUFS.*/\1/p')"
  if awk -v l="$lufs" 'BEGIN { exit !(l >= -15.5 && l <= -12.5) }'; then
    ok "Volume $lufs LUFS"
  else
    ko "Volume $lufs LUFS (viser -14 ; corriger avec loudness.sh --fix)"
  fi
else
  ko "Aucune piste audio (le son d'origine doit être conservé)"
fi

dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")"
printf '  [--]  Durée %.1f s\n' "$dur"

# Planche avec repères des zones cachées par l'interface Instagram.
sheet="${in%.*}-zones.jpg"
ffmpeg -v error -y -ss "$(awk -v d="$dur" 'BEGIN { print d / 2 }')" -i "$in" -frames:v 1 \
  -vf "drawbox=x=0:y=ih*0.8:w=iw:h=ih*0.2:color=red@0.35:t=fill,drawbox=x=iw*0.85:y=0:w=iw*0.15:h=ih:color=red@0.35:t=fill,scale=540:-2" \
  "$sheet" && echo "  [--]  Zones cachées à vérifier visuellement : $sheet"

exit "$fail"
