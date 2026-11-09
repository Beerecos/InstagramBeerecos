"use client";
/**
 * Paramètres → Canva → « Modèles du Studio » : Cédric choisit quels modèles de marque apparaissent dans l'onglet Post
 * et, pour chacun, s'il sert à un post (une image) ou à un carrousel. Rien n'est modifié dans Canva.
 */
import { useEffect, useState } from "react";
import { canvaApi, type CanvaTemplate, type TemplateKind } from "@/lib/canva/api";

type Choice = TemplateKind | "";
const LABEL: Record<Choice, string> = { "": "Non utilisé", post: "Post (une image)", carrousel: "Carrousel" };

export default function CanvaChoices() {
  const [list, setList] = useState<CanvaTemplate[] | null>(null);
  const [kinds, setKinds] = useState<Record<string, Choice>>({});
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    canvaApi.templates().then((r) => {
      const k = Object.fromEntries(r.templates.map((t) => [t.id, (t.kind ?? "") as Choice]));
      setList(r.templates); setKinds(k); setSaved(JSON.stringify(k));
    }).catch((e: Error) => setError(e.message));
  }, []);
  const save = async () => {
    if (!list) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const choices = list.filter((t) => kinds[t.id]).map((t) => ({ id: t.id, title: t.title, kind: kinds[t.id] as TemplateKind }));
      await canvaApi.saveChoices(choices);
      setSaved(JSON.stringify(kinds));
      setNotice(choices.length ? `${choices.length} modèle(s) retenu(s) : l'onglet Post ne propose plus que ceux du bon format.` : "Aucun modèle retenu : l'onglet Post propose tous tes modèles.");
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(false); }
  };

  return (
    <div id="canva-modeles" className="scroll-mt-20 space-y-2 rounded-xl border border-line p-3">
      <h3 className="font-medium">Modèles du Studio</h3>
      <p className="text-xs text-mut">Choisis les modèles Canva proposés dans l&apos;onglet Post, et leur format. Seuls les modèles de marque avec des zones de texte remplissables apparaissent.</p>
      {!list && !error ? <p role="status" className="text-sm text-mut">Lecture de tes modèles Canva…</p> : null}
      {list && !list.length ? <p className="text-sm text-mut">Aucun modèle de marque remplissable dans ton Canva pour l&apos;instant.</p> : null}
      {list?.length ? (
        <ul aria-label="Modèles Canva du Studio" className="space-y-2">
          {list.map((t) => (
            <li key={t.id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.thumbnailUrl ? <img src={t.thumbnailUrl} alt="" className="h-16 w-12 shrink-0 rounded object-cover" /> : <span className="h-16 w-12 shrink-0 rounded bg-black/[0.05]" />}
              <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
              <label className="sr-only" htmlFor={`kind-${t.id}`}>Format de {t.title}</label>
              <select id={`kind-${t.id}`} value={kinds[t.id] ?? ""} onChange={(e) => setKinds({ ...kinds, [t.id]: e.target.value as Choice })} className="min-h-11 rounded-xl border border-line bg-white px-2 text-sm">
                {(["", "post", "carrousel"] as Choice[]).map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}
              </select>
            </li>
          ))}
        </ul>
      ) : null}
      {list?.length ? <button type="button" className="btn-red min-h-11" disabled={busy || JSON.stringify(kinds) === saved} onClick={() => void save()}>{busy ? "Enregistrement…" : "Enregistrer mes modèles"}</button> : null}
      {notice ? <p role="status" className="text-sm text-acid-dim">{notice}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
