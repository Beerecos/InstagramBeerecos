#!/usr/bin/env bash
# Voix off de synthèse locale (HyperFrames tts · Kokoro-82M · voix française ff_siwis), une piste par réplique,
# puis transcription Whisper pour caler les sous-titres. Le texte de audio/voix/lignes.tsv est écrit
# phonétiquement (« Bi-Markétingue », « Imèle », « Linkédine ») pour la prononciation ; le texte affiché est dans config/promo.json.
# Usage : bash scripts/voice.sh
set -euo pipefail
cd "$(dirname "$0")/.."
while IFS=$'\t' read -r id txt; do
  npx hyperframes tts "$txt" -v ff_siwis -o "audio/voix/$id.wav" >/dev/null
  mkdir -p "audio/transcripts/$id"
  npx hyperframes transcribe "audio/voix/$id.wav" -m small -l fr -d "audio/transcripts/$id" >/dev/null
  printf '%s  %ss\n' "$id" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "audio/voix/$id.wav")"
done < audio/voix/lignes.tsv
mkdir -p public/audio/voix && cp audio/voix/s*.wav public/audio/voix/
echo "Mettre à jour config/promo.json (captions) avec les temps de audio/transcripts/*/transcript.json si le texte change."
