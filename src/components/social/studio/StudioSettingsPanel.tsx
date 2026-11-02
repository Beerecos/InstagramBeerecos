"use client";
import { useEffect, useState } from "react";
import { montage } from "@/lib/social/montage-api";
import { MAX_RULES, type StudioSettings } from "@/domain/social/montage/ideation";

/**
 * STYLES ET PARAMÈTRES DU STUDIO (lot S4, Video Agent Kit §7 « Styles / préférences » et « Paramètres ») : réglages
 * appliqués à chaque nouveau montage (sous-titres) et règles de la direction notées MOT POUR MOT, transmises à
 * Bee à chaque proposition (animations, retours, storyboard). Paramètres : services configurés et mémoire de marque
 * chargée, sans jamais afficher une clé.
 */

type Services = { transcription: boolean; claude: boolean; rendu: boolean; ressources: boolean };
const SERVICE_LABELS: { key: keyof Services; label: string; secret: string }[] = [
  { key: "transcription", label: "Transcription (ElevenLabs Scribe)", secret: "ELEVENLABS_API_KEY" },
  { key: "claude", label: "Propositions de Bee (Claude)", secret: "ANTHROPIC_API_KEY" },
  { key: "rendu", label: "Rendu MP4 (HeyGen)", secret: "HEYGEN_API_KEY" },
  { key: "ressources", label: "Ressources de rendu (polices, logo)", secret: "APP_URL" },
];
const field = "mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";

export default function StudioSettingsPanel() {
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [services, setServices] = useState<Services | null>(null);
  const [memory, setMemory] = useState<string[]>([]);
  const [rule, setRule] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    montage.getSettings().then((r) => { setSettings(r.settings); setSaved(JSON.stringify(r.settings)); setServices(r.services); setMemory(r.memory); }).catch((e) => setError(e.message));
  }, []);
  if (!settings) return error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <p role="status" className="text-sm text-mut">Chargement…</p>;
  const style = settings.captionStyle;
  const setStyle = (k: keyof StudioSettings["captionStyle"], v: string) => setSettings({ ...settings, captionStyle: { ...style, [k]: v ? Number(v) : undefined } });
  const save = async (next: StudioSettings) => {
    setBusy(true); setError(null); setNotice(null);
    try { const r = await montage.saveSettings(next); setSettings(r.settings); setSaved(JSON.stringify(r.settings)); setNotice("Préférences enregistrées : elles s'appliquent aux prochains montages et aux propositions de Bee."); }
    catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(false); }
  };
  const addRule = () => { const r = rule.trim(); if (r.length < 3) return; setRule(""); void save({ ...settings, rules: [...settings.rules, r] }); };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="styles" className="card space-y-3 p-5">
        <h2 id="styles" className="font-display text-lg">Styles et préférences</h2>
        <p className="text-sm text-mut">Réglages de départ de chaque nouveau montage (modifiables ensuite dans le montage).</p>
        <p className="text-sm">Couleurs : charte BeeRecos, bleu, noir et blanc (non modifiables).</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.subtitles} onChange={(e) => setSettings({ ...settings, subtitles: e.target.checked })} /> Sous-titres affichés</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.zoomCoupes} onChange={(e) => setSettings({ ...settings, zoomCoupes: e.target.checked })} /> Zoom alterné à chaque coupe (Reels plus dynamiques)</label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-sm">Haut du bloc (px)<input className={field} type="number" min={900} max={1700} placeholder="1460" value={style.top ?? ""} onChange={(e) => setStyle("top", e.target.value)} /></label>
          <label className="block text-sm">Largeur (px)<input className={field} type="number" min={400} max={1000} placeholder="760" value={style.maxWidth ?? ""} onChange={(e) => setStyle("maxWidth", e.target.value)} /></label>
          <label className="block text-sm">Corps (px)<input className={field} type="number" min={32} max={72} placeholder="44" value={style.fontSize ?? ""} onChange={(e) => setStyle("fontSize", e.target.value)} /></label>
        </div>
        <button type="button" className="btn-red min-h-[40px] px-3 text-sm" disabled={busy || JSON.stringify(settings) === saved} onClick={() => save(settings)}>Enregistrer les préférences</button>

        <h3 className="pt-2 text-sm font-medium">Tes retours, devenus règles</h3>
        <p className="text-xs text-mut">Notés mot pour mot ; Bee les applique à chaque proposition ({settings.rules.length}/{MAX_RULES}).</p>
        <ul aria-label="Règles de la direction" className="space-y-1">
          {settings.rules.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="min-w-0 flex-1">« {r} »</span>
              <button type="button" className="btn-ghost min-h-[32px] px-2 text-xs" disabled={busy} onClick={() => save({ ...settings, rules: settings.rules.filter((_, j) => j !== i) })}>Retirer</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className={field} aria-label="Nouvelle règle" value={rule} maxLength={300} placeholder="Ex. Jamais « booster » : on dit « développer »." onChange={(e) => setRule(e.target.value)} />
          <button type="button" className="btn-ghost mt-1 min-h-[40px] px-3 text-sm" disabled={busy || rule.trim().length < 3 || settings.rules.length >= MAX_RULES} onClick={addRule}>Ajouter</button>
        </div>
        {notice ? <p role="status" className="text-sm">{notice}</p> : null}
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      </section>

      <section aria-labelledby="parametres" className="card space-y-3 p-5">
        <h2 id="parametres" className="font-display text-lg">Paramètres</h2>
        <ul aria-label="Services du Studio" className="space-y-1 text-sm">
          {SERVICE_LABELS.map((s) => (
            <li key={s.key} className={services?.[s.key] ? "" : "text-amber-800"}>
              {services?.[s.key] ? "✓" : "⚠"} {s.label}{services?.[s.key] ? "" : ` — secret ${s.secret} à ajouter aux fonctions Supabase`}
            </li>
          ))}
        </ul>
        <h3 className="pt-2 text-sm font-medium">Mémoire de marque lue par Bee</h3>
        <ul aria-label="Mémoire de marque" className="space-y-1 text-sm">
          {["brand", "forbidden-claims", "tone-of-voice", "prompts-reseaux-sociaux"].map((slug) => (
            <li key={slug} className={memory.includes(slug) ? "" : "text-amber-800"}>{memory.includes(slug) ? "✓" : "⚠"} {slug}{memory.includes(slug) ? "" : " — absente (DONNÉE MANQUANTE)"}</li>
          ))}
        </ul>
        <p className="text-xs text-mut">Sans brand et forbidden-claims, Bee ne propose rien. Les clés restent dans les secrets Supabase : elles ne sont jamais affichées.</p>
      </section>
    </div>
  );
}
