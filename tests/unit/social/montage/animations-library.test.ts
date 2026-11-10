import { describe, expect, it } from "vitest";
import { listMotions } from "@/domain/social/montage/beemotion";
import { renderAnimation } from "@/domain/social/montage/animations";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { analyzeScenes, sceneCardCandidate } from "@/domain/social/montage/scenes";
import { fieldsOf } from "@/domain/social/montage/suggest";

/** Bibliothèque (2026-11-10 : « vérifie quelles animations fonctionnent toutes ») : chaque carte posée sur une séquence
 * est pré-remplie avec ce qui est dit et se rend sans bandeau d'erreur. */
const SPEECH = "Tu connais 500 personnes. Qui sait vraiment quand te recommander ? Imagine que tu sois photographe, tes contacts connaissent ton métier, mais savent-ils qui tu aides ? La prochaine fois, explique qui tu aides et dans quelle situation. Commente RÉSEAU pour visiter un club.";
const words = SPEECH.split(" ").map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
const scenes = analyzeScenes(words, { keyword: "RÉSEAU" });
const toProps = (name: string, values: Record<string, string>) => Object.fromEntries(fieldsOf(ANIMATIONS[name]).flatMap((f) => {
  const v = (values[f.key] ?? "").trim();
  if (!v && f.optional) return [];
  return [[f.key, f.kind === "number" ? Number(v) : f.kind === "list" ? v.split("\n").filter(Boolean) : v]];
}));

describe("bibliothèque d'animations : chaque carte fonctionne", () => {
  const ids = listMotions().filter((m) => !m.manualOnly && m.id !== "logo-fin").map((m) => m.id).filter((id) => ANIMATIONS[id]);
  it.each(ids)("%s", (id) => {
    let placed = 0;
    for (const scene of scenes) {
      const c = sceneCardCandidate(id, scene, { canBehind: true, keyword: "RÉSEAU" });
      if (!c || c.note?.startsWith("Réglages à compléter")) continue;
      const props = toProps(id, c.values);
      expect(ANIMATIONS[id].props.safeParse(props).success, `${id} ${JSON.stringify(props)}`).toBe(true);
      expect(renderAnimation(id, props, { id: "t", start: 0, duration: 2.5, accent: "#2851FF" }, ANIMATIONS).error, id).toBeUndefined();
      // Aucun texte d'exemple du catalogue : tout vient de ce qui est dit.
      const ex = JSON.stringify(ANIMATIONS[id].example ?? {});
      for (const v of Object.values(props)) for (const t of [v].flat()) if (typeof t === "string" && t.length > 3 && !/^[a-z-]+$/.test(t)) expect(ex.includes(`"${t}"`), `${id} : « ${t} » vient de l'exemple`).toBe(false);
      placed++;
    }
    expect(placed, `${id} : aucune séquence ne peut la recevoir`).toBeGreaterThan(0);
  });
});
