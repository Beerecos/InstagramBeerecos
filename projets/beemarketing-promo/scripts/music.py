#!/usr/bin/env python3
"""Musique et effets sonores originaux, synthétisés ici (aucun échantillon tiers, aucun droit à céder).

Usage : python3 scripts/music.py  →  public/audio/musique.wav + public/audio/sfx/*.wav
Lit le tempo, la durée et les accents dans config/promo.json.
"""
import json
import pathlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

ROOT = pathlib.Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "config" / "promo.json").read_text())
SR = 48000
BPM = CFG["audio"]["bpm"]
DUR = CFG["video"]["durationInFrames"] / CFG["video"]["fps"]
BEAT = 60 / BPM
ACCENTS = [s["start"] / CFG["video"]["fps"] for s in CFG["scenes"]][1:]
rng = np.random.default_rng(7)  # graine fixe : rendu reproductible


def t(n):
    return np.arange(n) / SR


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def env(n, a=0.005, d=0.2):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    e[na:] = np.exp(-np.arange(n - na) / (d * SR))
    return e


def note(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def add(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def kick():
    n = int(0.35 * SR)
    f = 48 + 90 * np.exp(-t(n) / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.12)


def hat():
    n = int(0.06 * SR)
    return hp(rng.standard_normal(n), 7000) * env(n, 0.001, 0.015)


def clap():
    n = int(0.18 * SR)
    return lp(hp(rng.standard_normal(n), 1200), 6000) * env(n, 0.002, 0.05)


def saw(freq, n):
    ph = (np.cumsum(np.full(n, freq)) / SR) % 1
    return 2 * ph - 1


def pad(chord, n):
    s = sum(saw(note(m) * d, n) for m in chord for d in (0.997, 1.003))
    a = np.minimum(1, t(n) / 0.25) * np.minimum(1, (n / SR - t(n)) / 0.3)
    return lp(s, 1400) * a / len(chord)


def pluck(midi, dur=0.25):
    n = int(dur * SR)
    s = saw(note(midi), n) * 0.6 + np.sin(2 * np.pi * note(midi) * t(n)) * 0.4
    return lp(s, 3500) * env(n, 0.002, 0.09)


def bass(midi, dur):
    n = int(dur * SR)
    s = np.sin(2 * np.pi * note(midi) * t(n)) + 0.3 * np.sign(np.sin(2 * np.pi * note(midi) * t(n)))
    return lp(s, 500) * env(n, 0.004, dur * 0.8)


def swell(dur=1.2):
    n = int(dur * SR)
    return lp(rng.standard_normal(n), 5000) * (t(n) / dur) ** 2 * 0.5


def impact():
    n = int(1.5 * SR)
    k = np.zeros(n)
    kk = kick()
    k[: len(kk)] = kk
    return lp(rng.standard_normal(n), 3000) * 0.35 * env(n, 0.002, 0.35) + k * 0.6


def music():
    n = int(DUR * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    # Progression : la mineur → fa → do → sol (une mesure de 4 temps chacun).
    prog = [(57, [57, 60, 64, 67]), (53, [53, 57, 60, 64]), (48, [55, 60, 64, 67]), (55, [55, 59, 62, 67])]
    bar = 4 * BEAT
    arp = [0, 2, 1, 3, 2, 1, 3, 2]
    bars = int(DUR / bar) + 1
    first_drop = ACCENTS[0]
    outro = ACCENTS[-1]
    for b in range(bars):
        t0 = b * bar
        root, chord = prog[b % 4]
        p = pad(chord, int(bar * SR))
        add(L, p, t0, 0.16)
        add(R, p, t0, 0.16)
        for k in range(8):
            tk = t0 + k * BEAT / 2
            if tk >= DUR - 0.2:
                continue
            m = chord[arp[k]] + 12
            add(L, pluck(m), tk, 0.10 if k % 2 else 0.07)
            add(R, pluck(m), tk + 0.012, 0.07 if k % 2 else 0.10)
        for k in range(4):
            tk = t0 + k * BEAT
            if first_drop <= tk < outro:
                add(L, kick(), tk, 0.55)
                add(R, kick(), tk, 0.55)
                add(L, bass(root - 12, BEAT * 0.9), tk, 0.22)
                add(R, bass(root - 12, BEAT * 0.9), tk, 0.22)
                h = hat()
                add(L, h, tk + BEAT / 2, 0.10)
                add(R, h, tk + BEAT / 2, 0.13)
                if k in (1, 3):
                    c = clap()
                    add(L, c, tk, 0.16)
                    add(R, c, tk, 0.16)
    for a in ACCENTS:
        s = swell()
        add(L, s, a - len(s) / SR, 0.18)
        add(R, s, a - len(s) / SR, 0.18)
        im = impact()
        add(L, im, a, 0.5)
        add(R, im, a, 0.5)
    fade = np.ones(n)
    fl = int(1.5 * SR)
    fade[-fl:] = np.linspace(1, 0, fl) ** 1.5
    fi = int(0.05 * SR)
    fade[:fi] = np.linspace(0, 1, fi)
    out = np.stack([L * fade, R * fade], 1)
    return out / np.max(np.abs(out)) * 0.7


def sfx():
    n = int(0.09 * SR)
    click = np.sin(2 * np.pi * 1500 * t(n)) * env(n, 0.001, 0.012) + hp(rng.standard_normal(n), 3000) * env(n, 0.001, 0.004) * 0.3
    n = int(0.35 * SR)
    pop = np.concatenate([np.sin(2 * np.pi * 784 * t(int(0.09 * SR))) * env(int(0.09 * SR), 0.003, 0.05),
                          np.sin(2 * np.pi * 1175 * t(n)) * env(n, 0.003, 0.1)])
    n = int(0.5 * SR)
    sweep = rng.standard_normal(n)
    out = np.zeros(n)
    for i in range(0, n, 2400):
        f = 400 + 5000 * np.sin(np.pi * i / n)
        out[i:i + 2400] = lp(sweep[i:i + 2400], min(f, 20000))
    whoosh = out * np.sin(np.pi * t(n) / (n / SR)) ** 2
    n = int(0.25 * SR)
    tick = np.sin(2 * np.pi * 2200 * t(n)) * env(n, 0.001, 0.03) * 0.6
    return {"clic": click, "validation": pop, "transition": whoosh, "notif": tick}


def write(path, x):
    path.parent.mkdir(parents=True, exist_ok=True)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    x = x / max(1e-9, np.max(np.abs(x))) * 0.8
    wavfile.write(path, SR, (x * 32767).astype(np.int16))


if __name__ == "__main__":
    write(ROOT / "public/audio/musique.wav", music())
    for name, sig in sfx().items():
        write(ROOT / f"public/audio/sfx/{name}.wav", sig)
    print("Musique et effets générés dans public/audio/")
