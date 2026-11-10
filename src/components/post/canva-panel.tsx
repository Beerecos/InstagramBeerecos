"use client";
/**
 * Onglet Post → « Créer le visuel avec Canva » : choisir un modèle de marque, remplir ses zones de texte, Canva crée le
 * design, l'exporte en JPG, et chaque page rejoint les photos du post (carrousel si plusieurs pages). Rien n'est publié.
 * Bibliothèque à jour (demande de Cédric, 2026-11-10) : relue en revenant sur l'onglet (après une modification dans
 * Canva), toutes les minutes tant que le panneau est ouvert et visible, et sur « Actualiser ». Canva ne prévient pas
 * des changements de modèles (pas de webhook pour les modèles de marque) : la relecture est le seul moyen fiable.
 */
const REFRESH_MS = 60_000;
const FOCUS_MIN_MS = 5_000;
import { useCallback, useEffect, useRef, useState } from "react";
import { Palette, RefreshCw } from "lucide-react";
import { canvaApi, type CanvaField, type CanvaTemplate, type CanvaView } from "@/lib/canva/api";

export type CanvaPhoto = { path: string; url: string };

export default function CanvaPanel({ disabled, room, onAdd }: { disabled: boolean; room: number; onAdd: (photos: CanvaPhoto[], note: string) => void }) {
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
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const lastSync = useRef(0);
  const chosenRef = useRef<CanvaTemplate | null>(null);
  useEffect(() => { chosenRef.current = chosen; }, [chosen]);
  /** Relit la bibliothèque ; le modèle choisi garde ses textes s'il existe encore, ses zones sont relues. */
  const refresh = useCallback(async (silent: boolean) => {
    lastSync.current = Date.now();
    try {
      const list = (await canvaApi.templates()).templates;
      setTemplates(list); setSyncedAt(new Date());
      const cur = chosenRef.current;
      if (!cur) return;
      const still = list.find((t) => t.id === cur.id);
      if (!still) { setChosen(null); setFields(null); setTexts({}); setError("Le modèle choisi n'existe plus dans Canva (supprimé ou retiré des modèles de marque)."); return; }
      setChosen(still);
      const next = (await canvaApi.fields(still.id)).fields;
      setFields(next);
      setTexts((t) => Object.fromEntries(Object.entries(t).filter(([k]) => next.some((f) => f.name === k && f.type === "text"))));
    } catch (e) { if (!silent) throw e; }
  }, []);
  const openPanel = () => { setOpen(true); if (!templates) void run("Lecture de tes modèles Canva…", () => refresh(false)); };
  useEffect(() => {
    if (!open) return;
    const again = () => { if (document.visibilityState === "visible" && Date.now() - lastSync.current > FOCUS_MIN_MS) void refresh(true); };
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(true); }, REFRESH_MS);
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", again); window.removeEventListener("focus", again); };
  }, [open, refresh]);
  const choose = (t: CanvaTemplate) => { setChosen(t); setFields(null); setTexts({}); setEditUrl(null); void run("Lecture des zones du modèle…", async () => setFields((await canvaApi.fields(t.id)).fields)); };
  const textFields = (fields ?? []).filter((f) => f.type === "text");
  const create = () => chosen && run("Canva crée le visuel (quelques secondes)…", async () => {
    const r = await canvaApi.createVisual({ templateId: chosen.id, title: `Post BeeRecos · ${chosen.title}`, texts });
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
        <button type="button" className="btn-ghost min-h-11" disabled={disabled || room <= 0} onClick={openPanel}>Choisir un modèle Canva</button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-mut">
            <button type="button" className="btn-ghost inline-flex min-h-11 items-center gap-1 px-3 text-sm" disabled={Boolean(busy)} onClick={() => void run("Actualisation de tes modèles Canva…", () => refresh(false))}>
              <RefreshCw aria-hidden size={14} /> Actualiser
            </button>
            <span role="status">{syncedAt ? `À jour à ${syncedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · mis à jour automatiquement quand tu reviens de Canva` : null}</span>
          </div>
          {templates && !templates.length ? <p className="text-sm text-mut">Aucun modèle de marque avec des zones remplissables dans ton Canva.</p> : null}
          {templates?.length ? (
            <ul aria-label="Modèles Canva" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {templates.map((t) => (
                <li key={t.id}>
                  <button type="button" aria-pressed={chosen?.id === t.id} onClick={() => choose(t)} disabled={Boolean(busy)}
                    className={`w-full overflow-hidden rounded-lg border text-left text-xs ${chosen?.id === t.id ? "border-brand ring-2 ring-brand/30" : "border-line"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.thumbnailUrl ? <img src={t.thumbnailUrl} alt="" className="aspect-[4/5] w-full object-cover" /> : <span className="grid aspect-[4/5] place-items-center bg-black/[0.04]">Aperçu indisponible</span>}
                    <span className="block truncate p-1.5">{t.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {chosen?.editUrl ? (
            <p className="text-sm">
              <a className="inline-flex min-h-11 items-center gap-1 text-brand underline" href={chosen.editUrl} target="_blank" rel="noreferrer">Modifier ce modèle dans Canva</a>
              <span className="block text-xs text-mut">Mise en page, couleurs, zones : dans Canva. En revenant ici, la bibliothèque et les zones du modèle sont relues automatiquement.</span>
            </p>
          ) : null}
          {chosen && fields ? (
            textFields.length ? (
              <div className="space-y-2">
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
