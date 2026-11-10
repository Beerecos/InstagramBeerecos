"use client";
/**
 * Onglet Post → « Créer le visuel avec Canva » : choisir un modèle de marque, remplir ses zones de texte, Canva crée le
 * design, l'exporte en JPG, et chaque page rejoint les photos du post (carrousel si plusieurs pages). Rien n'est publié.
 */
import { useEffect, useState } from "react";
import { Palette, Sparkles } from "lucide-react";
import { canvaApi, type CanvaField, type CanvaTemplate, type CanvaView } from "@/lib/canva/api";
import { canvaSuggestBrief, parseCanvaSuggestions } from "@/domain/instagram/canva-suggest";
import { generateEditorialText } from "@/lib/social/editorial-api";
import { canvaKind, type CanvaKind } from "@/domain/instagram/canva-kind";

export type CanvaPhoto = { path: string; url: string };

export default function CanvaPanel({ disabled, room, onAdd, context = "", format = "simple" }: { disabled: boolean; room: number; onAdd: (photos: CanvaPhoto[], note: string) => void; context?: string; format?: CanvaKind }) {
  const [view, setView] = useState<CanvaView | null>(null);
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<CanvaTemplate[] | null>(null);
  const [chosen, setChosen] = useState<CanvaTemplate | null>(null);
  const [fields, setFields] = useState<CanvaField[] | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState<string | null>(null);

  useEffect(() => { canvaApi.connection().then(setView).catch(() => setView(null)); }, []);
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Canva indisponible."); } finally { setBusy(null); }
  };
  const openPanel = () => { setOpen(true); if (!templates) void run("Lecture de tes modèles Canva…", async () => setTemplates((await canvaApi.templates()).templates)); };
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  /** Suggestions IA : remplit seulement les zones vides ; zones factuelles jamais inventées (canva-suggest.ts). */
  const suggest = async (list: CanvaField[]) => {
    const names = list.filter((f) => f.type === "text").map((f) => f.name);
    if (!names.length) return;
    const raw = await generateEditorialText({ channel: "instagram", workspaceId: null, brief: canvaSuggestBrief(names, context) });
    const r = parseCanvaSuggestions(raw, names, context);
    setTexts((cur) => ({ ...r.texts, ...Object.fromEntries(Object.entries(cur).filter(([, v]) => v.trim())) }));
    setSuggestNote(`Textes suggérés par l'IA : relis-les avant de créer le visuel.${r.skipped.length ? ` À compléter toi-même (information absente du post) : ${r.skipped.join(", ")}.` : ""}`);
  };
  const choose = (t: CanvaTemplate) => {
    setChosen(t); setFields(null); setTexts({}); setEditUrl(null); setSuggestNote(null);
    void run("Lecture des zones du modèle…", async () => {
      const list = (await canvaApi.fields(t.id)).fields;
      setFields(list);
      // Avec un sujet ou une légende déjà écrits, les textes sont suggérés tout de suite.
      if (context.trim()) { setBusy("L'IA suggère les textes…"); try { await suggest(list); } catch { setSuggestNote("Suggestion IA indisponible : écris les textes toi-même."); } }
    });
  };
  // Seuls les modèles du format choisi : posts dans Post, carrousels dans Carrousel.
  const shown = templates?.filter((t) => canvaKind(t.title) === format) ?? null;
  // Changement de format : un modèle de l'autre format n'est plus le modèle choisi.
  const active = chosen && canvaKind(chosen.title) === format ? chosen : null;
  const textFields = (fields ?? []).filter((f) => f.type === "text");
  const create = () => active && run("Canva crée le visuel (quelques secondes)…", async () => {
    const r = await canvaApi.createVisual({ templateId: active.id, title: `Post BeeRecos · ${active.title}`, texts });
    const kept = r.paths.slice(0, Math.max(0, room));
    onAdd(kept.map((path) => ({ path, url: r.previews[path] ?? "" })),
      `Visuel Canva ajouté : ${kept.length} image(s)${r.pages > kept.length ? ` (${r.pages - kept.length} page(s) au-delà de la limite du format non ajoutée(s))` : ""}${r.missing.length ? ` · zones laissées vides : ${r.missing.join(", ")}` : ""}.`);
    setEditUrl(r.editUrl);
  });

  if (!view) return null;
  return (
    <section aria-labelledby="canva-panel-titre" className="space-y-2 rounded-xl border border-line p-3">
      <h2 id="canva-panel-titre" className="flex items-center gap-2 font-medium"><Palette aria-hidden size={16} className="text-brand" /> Créer le visuel avec Canva</h2>
      {!view.connected ? (
        <p className="text-sm text-mut">{view.appConfigured ? "Canva n'est pas connecté." : "Canva n'est pas encore configuré sur le serveur."} <a className="text-brand underline" href="/settings#canva">Paramètres → Canva</a></p>
      ) : view.autofill === false || view.brandTemplates === false ? (
        <p className="text-sm text-amber-800">Ce compte Canva n&apos;a pas accès au remplissage automatique des modèles de marque (Canva Pro, Teams ou Enterprise).</p>
      ) : !open ? (
        <button type="button" className="btn-ghost min-h-11" disabled={disabled || room <= 0} onClick={openPanel}>{format === "carrousel" ? "Choisir un modèle Canva carrousel" : "Choisir un modèle Canva post"}</button>
      ) : (
        <div className="space-y-3">
          {shown && !shown.length ? (
            <p className="text-sm text-mut">{format === "carrousel"
              ? "Aucun modèle carrousel dans ton Canva. Pour qu'un modèle apparaisse ici, mets « Carrousel » dans son nom (dans Canva)."
              : "Aucun modèle de post dans ton Canva (les modèles dont le nom contient « Carrousel » sont rangés dans Carrousel)."}</p>
          ) : null}
          {shown?.length ? (
            <ul aria-label={format === "carrousel" ? "Modèles Canva carrousel" : "Modèles Canva post"} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {shown.map((t) => (
                <li key={t.id}>
                  <button type="button" aria-pressed={active?.id === t.id} onClick={() => choose(t)} disabled={Boolean(busy)}
                    className={`w-full overflow-hidden rounded-lg border text-left text-xs ${active?.id === t.id ? "border-brand ring-2 ring-brand/30" : "border-line"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.thumbnailUrl ? <img src={t.thumbnailUrl} alt="" className="aspect-[4/5] w-full object-cover" /> : <span className="grid aspect-[4/5] place-items-center bg-black/[0.04]">Aperçu indisponible</span>}
                    <span className="block truncate p-1.5">{t.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {active?.editUrl ? (
            <p className="text-sm">
              <a className="inline-flex min-h-11 items-center gap-1 text-brand underline" href={active.editUrl} target="_blank" rel="noreferrer">Modifier ce modèle dans Canva</a>
              <span className="block text-xs text-mut">Mise en page, couleurs, zones : dans Canva. Les visuels suivants utilisent la version enregistrée.</span>
            </p>
          ) : null}
          {active && fields ? (
            textFields.length ? (
              <div className="space-y-2">
                <button type="button" className="btn-ghost inline-flex min-h-11 items-center gap-1 px-3 text-sm" disabled={Boolean(busy) || !context.trim()} onClick={() => void run("L'IA suggère les textes…", () => suggest(fields))}>
                  <Sparkles aria-hidden size={14} /> Suggérer les textes avec l&apos;IA
                </button>
                {!context.trim() ? <p className="text-xs text-mut">Écris d&apos;abord le sujet ou la légende du post : l&apos;IA s&apos;en sert pour proposer les textes.</p> : null}
                {suggestNote ? <p role="status" className="text-xs text-brand">{suggestNote}</p> : null}
                {textFields.map((f) => (
                  <label key={f.name} className="block text-sm">{f.name}
                    <textarea rows={2} maxLength={500} value={texts[f.name] ?? ""} onChange={(e) => setTexts({ ...texts, [f.name]: e.target.value })}
                      className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
                  </label>
                ))}
                {fields.some((f) => f.type !== "text") ? <p className="text-xs text-mut">Les zones image du modèle gardent l&apos;image prévue dans Canva.</p> : null}
                <button type="button" className="btn-red min-h-11" disabled={disabled || Boolean(busy) || !Object.values(texts).some((v) => v.trim())} onClick={() => void create()}>Créer le visuel</button>
              </div>
            ) : <p className="text-sm text-amber-800">Ce modèle n&apos;a aucune zone de texte remplissable.</p>
          ) : null}
          {editUrl ? <p className="text-sm"><a className="text-brand underline" href={editUrl} target="_blank" rel="noreferrer">Retoucher ce design dans Canva</a> (puis l&apos;exporter et le réimporter si tu le modifies).</p> : null}
        </div>
      )}
      {busy ? <p role="status" className="text-sm text-mut">{busy}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
