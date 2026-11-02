/**
 * Modèle IA canonique d'Instagram BeeRecos : MotionSpec (scènes avec voix, texte affiché, visuel, pivot, cartes).
 * Adaptateur des contenus hérités « Recommandation » (StorySpec, 7 séquences fixes) : les textes validés sont repris
 * mot pour mot, sans recopie manuelle entre deux éditeurs. Seule la signature finale officielle est ajoutée
 * (logo et baseline), comme dans le film validé du 2026-10-23.
 */
import { DEFAULT_VOICE_SPEED } from "@/domain/social/reel-story/pron";
import { AUDREY_VOICE_ID } from "@/domain/social/reel-story/audrey";
import { MOTION_STYLE_ID, type MotionScene, type MotionSpec } from "@/domain/social/reel-story/motion-spec";
import type { StorySpec } from "@/domain/social/reel-story/spec";

/** Texte affiché sans les marqueurs d'emphase `*mot*` ; le premier mot souligné devient le mot pivot. */
function unmark(text: string): { text: string; pivot?: string } {
  const pivot = /\*([^*]+)\*/.exec(text)?.[1]?.trim();
  return { text: text.replace(/\*/g, "").trim(), ...(pivot ? { pivot } : {}) };
}

export const OFFICIAL_SIGNATURE_VOICE = "BeeRecos. Mon réseau, c’est ton réseau.";

export function storyToMotion(story: StorySpec): MotionSpec {
  const lines = story.voice.lines;
  const scenes: MotionScene[] = [];
  const push = (id: string, scene: Omit<MotionScene, "id">) => { if (scene.voice.trim()) scenes.push({ id, ...scene }); };
  const hook = unmark(story.hook.text);
  push("s1", { visual: "titre", voice: lines.hook, title: hook.text, subtitle: story.hook.complement || undefined, pivot: hook.pivot });
  const consequence = unmark(story.consequence.text);
  push("s2", { visual: "titre", voice: lines.consequence, title: consequence.text, pivot: consequence.pivot });
  const rupture = unmark(story.rupture.text);
  push("s3", { visual: "titre", voice: lines.rupture, title: rupture.text, pivot: rupture.pivot });
  const value = unmark(story.value.text);
  push("s4", { visual: "titre", voice: lines.value, title: value.text, pivot: value.pivot });
  const steps = story.steps.items.map((s) => s.title.replace(/[.!]+$/, "").trim()).filter(Boolean);
  push("s5", { visual: "liste", voice: lines.steps, title: steps.join("\n"), items: steps.slice(0, 3) });
  push("s6", { visual: "marque", voice: lines.signature, title: story.signature.tagline.replace(/[.!]+$/, "") });
  push("s7", { visual: "cta", voice: lines.cta, title: story.cta.verb.charAt(0) + story.cta.verb.slice(1).toLowerCase(), subtitle: story.cta.complement || undefined, pivot: story.cta.keyword });
  scenes.push({ id: "s8", visual: "signature", voice: OFFICIAL_SIGNATURE_VOICE, title: "" });
  return {
    kind: "motion",
    style: MOTION_STYLE_ID,
    title: story.title,
    objective: "",
    pillar: story.pillar,
    targetSeconds: 45,
    settings: { rythme: "dynamique", texte: "equilibre", presence: "mascotte" },
    scenes,
    cta: { keyword: story.cta.keyword, complement: story.cta.complement },
    voice: { provider: "heygen", voiceId: AUDREY_VOICE_ID, speed: DEFAULT_VOICE_SPEED },
  };
}

import type { Reel } from "@/domain/social/montage/reels";

const VOICE_MAX = 220; // limite d'une voix de scène dans MotionSpec
const SCENES_MAX = 12;
const PILLAR: Record<string, MotionSpec["pillar"]> = { reseau: "reseau_monetise", formation: "formation", digitalisation_ia: "digitalisation_ia" };

/** Découpe une parole en morceaux ≤ 220 caractères aux fins de phrase (puis aux virgules), sans perdre un mot. */
export function splitSpoken(text: string, max = VOICE_MAX): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return [clean];
  const parts = clean.match(/[^.!?…]+[.!?…]+["»”]?|[^.!?…]+$/g)?.map((p) => p.trim()).filter(Boolean) ?? [clean];
  const out: string[] = [];
  for (const p of parts.flatMap((p) => (p.length <= max ? [p] : p.split(/(?<=,)\s+/)))) {
    const last = out.at(-1);
    if (last && `${last} ${p}`.length <= max) out[out.length - 1] = `${last} ${p}`;
    else out.push(p);
  }
  return out;
}

/**
 * Un des 72 scripts → scènes de réel IA, dans l'éditeur unique. Paroles reprises mot pour mot (réparties si une
 * phrase dépasse la limite d'une scène IA), textes à l'écran = overlays du script ; rien n'est inventé : un overlay
 * absent reste vide et l'éditeur le signale. Signature officielle ajoutée en fin.
 */
export function reelToMotion(reel: Reel): { spec: MotionSpec; warnings: string[] } {
  const warnings: string[] = [];
  const scenes: MotionScene[] = [];
  const keyword = reel.cta.display_keyword;
  reel.scenes.forEach((s, i) => {
    const chunks = splitSpoken(s.spoken_text);
    if (chunks.length > 1) warnings.push(`Scène ${i + 1} : parole répartie sur ${chunks.length} scènes IA (limite de ${VOICE_MAX} caractères par voix), texte inchangé.`);
    const title = (s.overlay.text ?? "").trim();
    if (!title && s.role !== "cta") warnings.push(`Scène ${i + 1} : aucun texte à l'écran dans le script, à compléter.`);
    chunks.forEach((voice, k) => scenes.push({
      id: `s${scenes.length + 1}`,
      visual: s.role === "cta" ? "cta" : "titre",
      voice,
      title: s.role === "cta" ? "Commente" : title,
      ...(s.role === "cta" ? { pivot: keyword } : {}),
      ...(k > 0 && s.role === "cta" ? { visual: "titre" as const, title } : {}),
    }));
  });
  // Une seule scène CTA, juste avant la signature : les morceaux qui précèdent le dernier restent des scènes titre.
  const ctaIdx = scenes.map((x) => x.visual).lastIndexOf("cta");
  scenes.forEach((x, i) => { if (x.visual === "cta" && i !== ctaIdx) Object.assign(x, { visual: "titre", title: x.title === "Commente" ? "" : x.title, pivot: undefined }); });
  if (ctaIdx >= 0 && ctaIdx !== scenes.length - 1) {
    const [cta] = scenes.splice(ctaIdx, 1);
    scenes.push(cta);
    warnings.push("La scène d'appel à l'action a été placée en dernier, juste avant la signature.");
  }
  scenes.push({ id: `s${scenes.length + 1}`, visual: "signature", voice: OFFICIAL_SIGNATURE_VOICE, title: "" });
  if (scenes.length > SCENES_MAX) warnings.push(`${scenes.length} scènes : l'éditeur IA en accepte ${SCENES_MAX} au plus, regroupe des scènes avant le rendu.`);
  const spec: MotionSpec = {
    kind: "motion", style: MOTION_STYLE_ID,
    title: `${reel.reel_id} · ${reel.title}`.slice(0, 80),
    objective: (reel.objective ?? "").slice(0, 160),
    pillar: PILLAR[reel.primary_pillar ?? ""] ?? "reseau_monetise",
    targetSeconds: 45,
    settings: { rythme: "dynamique", texte: "equilibre", presence: "mascotte" },
    scenes,
    cta: { keyword, complement: "" },
    voice: { provider: "heygen", voiceId: AUDREY_VOICE_ID, speed: DEFAULT_VOICE_SPEED },
  };
  return { spec, warnings };
}
