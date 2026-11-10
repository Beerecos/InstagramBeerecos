#!/bin/bash
# Effets sonores du preset EDITORIAL IMPACT : créations originales BeeRecos, synthétisées avec ffmpeg
# (bruit à graine fixe + sinusoïdes), donc reproductibles. Sortie : public/hyperframes/sfx/*.wav (mono 48 kHz).
# Usage : bash automation/make-sfx.sh
set -euo pipefail
cd "$(dirname "$0")/../public/hyperframes/sfx" 2>/dev/null || { mkdir -p "$(dirname "$0")/../public/hyperframes/sfx"; cd "$(dirname "$0")/../public/hyperframes/sfx"; }
R=48000
tone() { ffmpeg -v error -y -f lavfi -i "aevalsrc=exprs='$2':s=$R:d=$3" -ac 1 -c:a pcm_s16le "$1.wav"; }
nz() { # nom durée enveloppe filtres [son tonal]
  ffmpeg -v error -y -f lavfi -i "anoisesrc=r=$R:d=$2:c=white:seed=11:a=1" -f lavfi -i "aevalsrc=exprs='${5:-0}':s=$R:d=$2" \
    -filter_complex "[0]$4,volume='$3':eval=frame[n];[n][1]amix=inputs=2:normalize=0,alimiter=limit=0.84:level=false" -ac 1 -c:a pcm_s16le "$1.wav"; }
tone microPop "sin(2*PI*(1250*t-2600*t*t))*exp(-t*55)*0.8" 0.09
tone digitalTick "sin(2*PI*2350*t)*exp(-t*380)*0.6" 0.03
nz uiClick 0.03 "exp(-t*420)*0.7" "highpass=f=1800" "sin(2*PI*3200*t)*exp(-t*500)*0.3"
nz cardSlide 0.3 "min(t/0.06,1)*exp(-max(t-0.06,0)*11)*0.7" "lowpass=f=2600,highpass=f=250,volume=1.6"
nz softHit 0.4 "exp(-t*220)*0.25" "lowpass=f=3000" "(sin(2*PI*68*t)*0.9+sin(2*PI*136*t)*0.25)*exp(-t*13)"
nz cardDrop 0.25 "exp(-t*120)*0.35" "lowpass=f=2400" "sin(2*PI*92*t)*0.8*exp(-t*18)"
nz softRiser 1.2 "pow(t/1.2,2)*0.35*if(gt(t,1.17),(1.2-t)/0.03,1)" "lowpass=f=4000" "sin(2*PI*(380*t+330*t*t))*0.3*pow(t/1.2,2)"
nz softDowner 1.0 "pow(1-t,2)*0.35" "lowpass=f=4000" "sin(2*PI*(1100*t-330*t*t))*0.3*pow(1-t,2)"
ffmpeg -v error -y -f lavfi -i "anoisesrc=r=$R:d=0.32:c=pink:seed=11:a=1" \
  -af "bandpass=f=1300:width_type=h:w=1800,highpass=f=280,volume='pow(sin(PI*t/0.32),3)*1.6':eval=frame,alimiter=limit=0.84:level=false" \
  -ac 1 -c:a pcm_s16le editorialWhoosh.wav
echo "SFX générés dans $(pwd)"
