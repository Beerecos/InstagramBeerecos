"use client";
/**
 * Éditeur IA unique : brief, script, scènes, recommandations visuelles, animations, narration, sons, aperçu et rendu
 * dans MotionStyleSource (MotionSpec, Hyperframes). L'ancien style « Recommandation » n'est plus un second éditeur :
 * c'est un modèle de départ converti en scènes, et un adaptateur de lecture pour les contenus hérités.
 */
import { useState } from "react";
import MotionStyleSource from "@/components/social/MotionStyleSource";
import { AiVideoSource } from "@/components/social/ReelsStudio";
import { studioAssets } from "@/lib/social/studio-assets-api";
import { storyToMotion } from "@/domain/reels/ai-spec";
import { DEMO_STORY, type StorySpec } from "@/domain/social/reel-story/spec";
import type { MotionSpec } from "@/domain/social/reel-story/motion-spec";
import type { StudioSourceRef, StudioSourceTransfer } from "@/domain/social/studio-sources";

type Props = {
  sourceRef?: StudioSourceRef;
  onUseMotion?: (file: File, spec: MotionSpec, transfer: StudioSourceTransfer) => Promise<void>;
  onUseStory?: (file: File, title: string, spec: StorySpec, transfer: StudioSourceTransfer) => Promise<void>;
};

export default function AiEditor({ sourceRef, onUseMotion, onUseStory }: Props) {
  const [initial, setInitial] = useState<MotionSpec | undefined>(undefined);
  const [key, setKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const start = (spec: MotionSpec) => { setInitial(spec); setKey((k) => k + 1); setError(null); };

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
      {!sourceRef ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-mut">Point de départ :</span>
          <button type="button" className="btn-ghost min-h-10" onClick={() => start(storyToMotion(DEMO_STORY))}>Modèle « Recommandation »</button>
          <span className="text-xs text-mut">ou décris ton sujet ci-dessous pour une proposition de scènes.</span>
        </div>
      ) : null}
      <MotionStyleSource key={key} sourceRef={initial ? undefined : sourceRef} initialSpec={initial} onUseVideo={onUseMotion} />
    </div>
  );
}
