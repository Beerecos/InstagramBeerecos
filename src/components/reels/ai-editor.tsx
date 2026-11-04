"use client";
/**
 * Éditeur IA unique : brief, script, scènes, recommandations visuelles, animations, narration, sons, aperçu et rendu
 * dans MotionStyleSource (MotionSpec, Hyperframes). L'ancien style « Recommandation » n'est plus un second éditeur :
 * c'est un modèle de départ converti en scènes, et un adaptateur de lecture pour les contenus hérités.
 */
import { useEffect, useState } from "react";
import { reels } from "@/lib/social/montage-api";
import MotionStyleSource from "@/components/social/MotionStyleSource";
import { AiVideoSource } from "@/components/social/ReelsStudio";
import { studioAssets } from "@/lib/social/studio-assets-api";
import { reelToMotion, storyToMotion } from "@/domain/reels/ai-spec";
import { DEMO_STORY, type StorySpec } from "@/domain/social/reel-story/spec";
import type { MotionSpec } from "@/domain/social/reel-story/motion-spec";
import type { StudioSourceRef, StudioSourceTransfer } from "@/domain/social/studio-sources";

type Props = {
  sourceRef?: StudioSourceRef;
  /** Un des 72 scripts (V01–V72) à transformer en réel IA. */
  scriptId?: string | null;
  onUseMotion?: (file: File, spec: MotionSpec, transfer: StudioSourceTransfer) => Promise<void>;
  onUseStory?: (file: File, title: string, spec: StorySpec, transfer: StudioSourceTransfer) => Promise<void>;
};

export default function AiEditor({ sourceRef, scriptId, onUseMotion, onUseStory }: Props) {
  const [loadedScript, setLoadedScript] = useState<string | null>(null);
  const loadingScript = Boolean(scriptId && /^V\d{2}$/.test(scriptId) && loadedScript !== scriptId);
  const [initial, setInitial] = useState<MotionSpec | undefined>(undefined);
  const [key, setKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const start = (spec: MotionSpec) => { setInitial(spec); setKey((k) => k + 1); setError(null); };
  useEffect(() => {
    if (!scriptId || !/^V\d{2}$/.test(scriptId)) return;
    let alive = true;
    reels.get(scriptId).then(({ reel }) => {
      if (!alive) return;
      const { spec, warnings } = reelToMotion(reel.data);
      setNotes([`Script ${reel.reelId} · révision ${reel.revision}${reel.editorial === "approved" ? " (texte validé)" : " (texte non validé)"} repris mot pour mot.`, ...warnings]);
      setInitial(spec); setKey((k) => k + 1);
    }).catch((e: Error) => { if (alive) setError(`Script ${scriptId} illisible : ${e.message}`); }).finally(() => { if (alive) setLoadedScript(scriptId); });
    return () => { alive = false; };
  }, [scriptId]);

  if (loadingScript) return <p role="status" className="card p-5">Chargement de ton script…</p>;

  if (sourceRef?.kind === "story" && !initial) {
    const convert = async () => {
      try {
        const { asset } = await studioAssets.get(sourceRef.assetId, sourceRef.revision);
        start(storyToMotion(asset.data as StorySpec));
      } catch (e) { setError(e instanceof Error ? e.message : "Lecture du contenu impossible."); }
    };
    return (
      <div className="space-y-3">
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <p>Contenu hérité au format « Recommandation » (version {sourceRef.revision}). Il reste lisible tel quel ; pour le modifier scène par scène, reprends-le dans l&apos;éditeur unique.</p>
          <button type="button" className="btn-red min-h-11" onClick={convert}>Reprendre en scènes</button>
        </div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <AiVideoSource sourceRef={sourceRef} onUseVideo={onUseStory} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {notes.length ? <ul role="status" className="card list-disc space-y-1 p-3 pl-7 text-sm">{notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {!sourceRef ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-mut">Point de départ :</span>
          <button type="button" className="btn-ghost min-h-10" onClick={() => { if (window.confirm("Charger ce modèle remplace le travail affiché. Continuer ?")) start(storyToMotion(DEMO_STORY)); }}>Modèle « Recommandation »</button>
          <span className="text-xs text-mut">ou décris ton sujet ci-dessous pour une proposition de scènes.</span>
        </div>
      ) : null}
      <MotionStyleSource key={key} sourceRef={initial ? undefined : sourceRef} initialSpec={initial} onUseVideo={onUseMotion} />
    </div>
  );
}
