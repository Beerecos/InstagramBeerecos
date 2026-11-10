"use client";
/**
 * Musique de fond en mode simple (2026-11-10 : « un audio simple en fond, léger ») : un son de la bibliothèque
 * (déposé avec sa licence), joué du début à la fin, baissé automatiquement pendant la voix. Un clic, enregistré tout de
 * suite (annulable). Aucune musique n'est inventée ni téléchargée : seulement celles de la bibliothèque.
 */
import type { Edit } from "@/domain/social/montage/edit";
import type { MediaItem } from "@/domain/social/montage/media";

/** Niveaux : volume pendant les silences, puis sous la voix. */
export const MUSIC_LEVELS = { leger: { label: "Léger", volume: 0.12, duck: 0.05 }, moyen: { label: "Moyen", volume: 0.22, duck: 0.08 } } as const;
type Level = keyof typeof MUSIC_LEVELS;

/** La musique de fond : le son qui commence au début et se baisse sous la voix. */
export const isBackgroundMusic = (s: Edit["sounds"][number]) => s.atMs === 0 && Boolean(s.duck) && s.durationMs === undefined;

export default function StudioMusic({ edit, library, disabled, onChange, onOpenLibrary }: { edit: Edit; library: MediaItem[] | null; disabled: boolean; onChange: (patch: Pick<Edit, "sounds">) => void; onOpenLibrary: () => void }) {
  const tracks = (library ?? []).filter((m) => m.kind === "son");
  const current = edit.sounds.find(isBackgroundMusic) ?? null;
  const level: Level = current && current.volume > MUSIC_LEVELS.leger.volume + 0.01 ? "moyen" : "leger";
  const others = edit.sounds.filter((s) => !isBackgroundMusic(s));
  const pick = (file: string | null, lv: Level = level) => {
    const l = MUSIC_LEVELS[lv];
    onChange({ sounds: file ? [{ file, atMs: 0, volume: l.volume, duck: { volume: l.duck } }, ...others] : others });
  };
  const choice = (active: boolean) => `flex min-h-11 items-center rounded-xl border px-3 text-left text-sm transition ${active ? "border-brand ring-2 ring-brand/30" : "border-line hover:border-brand"}`;
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Musique de fond</legend>
      <p className="text-xs text-mut">Jouée tout le long, discrète, et baissée automatiquement quand tu parles.</p>
      {library === null ? <p className="text-xs text-mut">Chargement de la bibliothèque…</p> : !tracks.length ? (
        <div className="space-y-2 rounded-xl bg-black/[0.04] p-3 text-sm">
          <p>Aucune musique dans ta bibliothèque. Ajoute un morceau libre de droits (mp3), avec sa licence.</p>
          <button type="button" className="btn-ghost min-h-11 px-3 text-sm" onClick={onOpenLibrary}>Ajouter une musique</button>
        </div>
      ) : <>
        <div role="radiogroup" aria-label="Musique de fond" className="grid gap-2 sm:grid-cols-2">
          <button type="button" role="radio" aria-checked={!current} className={choice(!current)} onClick={() => current && pick(null)}>Sans musique</button>
          {tracks.map((t) => <button key={t.id} type="button" role="radio" aria-checked={current?.file === t.fileName} className={choice(current?.file === t.fileName)} onClick={() => current?.file !== t.fileName && pick(t.fileName)}>♪ {t.title}</button>)}
        </div>
        {current ? (
          <div role="radiogroup" aria-label="Volume de la musique" className="grid grid-cols-2 gap-2">
            {(Object.keys(MUSIC_LEVELS) as Level[]).map((k) => <button key={k} type="button" role="radio" aria-checked={level === k} className={choice(level === k)} onClick={() => level !== k && pick(current.file, k)}>{MUSIC_LEVELS[k].label}</button>)}
          </div>
        ) : null}
        <button type="button" className="text-xs text-brand underline" onClick={onOpenLibrary}>Ajouter une autre musique</button>
      </>}
    </fieldset>
  );
}
