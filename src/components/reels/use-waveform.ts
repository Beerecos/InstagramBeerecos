"use client";
/**
 * Forme d'onde de la bande source (toutes les prises, dans l'ordre) : décodée une fois par prise dans le navigateur,
 * jamais envoyée. Les prises trop lourdes ne sont pas téléchargées (limite affichée) : la timeline reste utilisable.
 */
import { useEffect, useState } from "react";
import { peaks } from "@/domain/studio/timeline";
import type { Waveform } from "@/components/social/studio/StudioTimeline";

export const WAVEFORM_MAX_BYTES = 250 * 1024 * 1024;
const PER_SECOND = 50;
const cache = new Map<string, Float32Array>();

export type WaveTake = { key: string; url: string; fromMs: number; toMs: number };

async function decode(url: string): Promise<Float32Array> {
  const head = await fetch(url, { method: "HEAD" }).catch(() => null);
  const size = Number(head?.headers.get("content-length") ?? 0);
  if (size > WAVEFORM_MAX_BYTES) throw new Error("trop lourde");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("audio indisponible");
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(buffer);
    return peaks(audio.getChannelData(0), audio.sampleRate, PER_SECOND);
  } finally { void ctx.close(); }
}

export function useWaveform(takes: WaveTake[], totalMs: number) {
  const [wave, setWave] = useState<Waveform | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const signature = JSON.stringify(takes.map((t) => [t.key, t.fromMs, t.toMs]));
  useEffect(() => {
    if (!takes.length || !totalMs) return;
    let alive = true;
    (async () => {
      const all = new Float32Array(Math.ceil((totalMs / 1000) * PER_SECOND) + 1);
      const missing: string[] = [];
      for (const t of takes) {
        let p = cache.get(t.key);
        if (!p) {
          try { p = await decode(t.url); cache.set(t.key, p); } catch (e) { missing.push(`${t.key} (${e instanceof Error ? e.message : "illisible"})`); continue; }
        }
        all.set(p.subarray(0, Math.max(0, Math.min(p.length, all.length - Math.floor((t.fromMs / 1000) * PER_SECOND)))), Math.floor((t.fromMs / 1000) * PER_SECOND));
      }
      if (!alive) return;
      setWave({ peaks: all, perSecond: PER_SECOND });
      setNote(missing.length ? `Forme d'onde indisponible pour : ${missing.join(", ")}.` : null);
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcul seulement si les prises changent
  }, [signature, totalMs]);
  return { wave, note };
}
