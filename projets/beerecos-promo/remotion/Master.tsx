import React from "react";
import { AbsoluteFill, Sequence, interpolate, staticFile } from "remotion";
import { Audio, Video } from "@remotion/media";
import { C, CFG, FPS, FormatKey } from "./config";
import { Captions, FormatContext } from "./ui";
import "./fonts";
import { SCENES } from "./scenes";

export type MasterProps = { format: FormatKey; captions: boolean };

/** Ducking : la musique baisse pendant la parole (fenêtres = sous-titres calés sur la voix), rampes de 8 images. */
const duckAt = (f: number) =>
  CFG.captions.reduce((acc, c) => {
    const a = c.start * FPS - 8;
    const b = c.end * FPS + 8;
    const v = interpolate(f, [a - 8, a, b, b + 8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return Math.max(acc, v);
  }, 0);

export const Master: React.FC<MasterProps> = ({ format, captions }) => {
  const fmt = CFG.formats[format];
  const { music } = CFG.audio;
  return (
    <FormatContext.Provider value={fmt}>
      <AbsoluteFill style={{ background: C.white }}>
        {CFG.scenes.map((s) => {
          if (s.engine === "hyperframes") {
            // Clips HyperFrames muets rendus à l'identique (même cadence, même résolution).
            const clip = `clips/${s.id === "s01" ? "intro" : "outro"}-${fmt.id}.mp4`;
            return (
              <Sequence key={s.id} name={`${s.id} · ${s.name} (HyperFrames)`} from={s.start} durationInFrames={s.duration} premountFor={30}>
                <Video src={staticFile(clip)} muted style={{ width: fmt.width, height: fmt.height }} />
              </Sequence>
            );
          }
          const Scene = SCENES[s.id];
          return (
            <Sequence key={s.id} name={`${s.id} · ${s.name}`} from={s.start} durationInFrames={s.duration} premountFor={30}>
              <AbsoluteFill style={{ background: C.white }}>
                <Scene />
              </AbsoluteFill>
            </Sequence>
          );
        })}
        {captions && <Captions />}
        {/* Bande-son : mixage centralisé ici (voix, musique avec ducking, effets). */}
        <Audio
          src={staticFile(music.file)}
          volume={(f) => interpolate(duckAt(f), [0, 1], [music.volume, music.duckedVolume])}
        />
        {CFG.audio.voice.map((v) => (
          <Sequence key={v.file} name={`Voix ${v.scene}`} from={Math.round(v.at * FPS)} layout="none">
            <Audio src={staticFile(v.file)} volume={CFG.audio.voiceVolume} />
          </Sequence>
        ))}
        {CFG.audio.sfx.map((x, i) => (
          <Sequence key={i} name={`Effet ${i + 1}`} from={Math.round(x.at * FPS)} layout="none">
            <Audio src={staticFile(x.file)} volume={CFG.audio.sfxVolume} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </FormatContext.Provider>
  );
};
