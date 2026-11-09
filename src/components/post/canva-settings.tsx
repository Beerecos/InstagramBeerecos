"use client";
/**
 * Paramètres → Canva : connexion officielle (bouton, aucun jeton à copier), droits réels du compte (remplissage
 * automatique des modèles de marque), guide de création de l'intégration Canva.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { canvaApi, type CanvaView } from "@/lib/canva/api";

const RETURN: Record<string, string> = {
  ok: "Canva est connecté.",
  refuse: "Connexion annulée sur Canva.",
  expire: "La demande a expiré : recommence la connexion.",
  "non-configure": "L'intégration Canva n'est pas encore configurée sur le serveur (voir le guide).",
  interdit: "Action réservée à l'administrateur.",
  erreur: "Canva a refusé la connexion : vérifie l'intégration (droits et adresse de retour), puis recommence.",
  "erreur-canva": "Canva a renvoyé une erreur : vérifie dans l'intégration les droits cochés (scopes) et l'adresse de retour, puis recommence.",
};

export default function CanvaSettings() {
  const params = useSearchParams();
  const back = params.get("canva");
  const detail = params.get("canva_detail");
  const [view, setView] = useState<CanvaView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { canvaApi.connection().then(setView).catch((e: Error) => setError(e.message)); }, []);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <section id="canva" className="card scroll-mt-20 p-4" aria-labelledby="canva-titre">
      <h2 id="canva-titre" className="font-semibold">Canva</h2>
      <p className="mt-1 text-sm text-mut">Tes modèles de marque Canva remplis automatiquement avec les textes du post, puis ajoutés à ses photos. Rien n&apos;est publié sans ta validation.</p>
      {back && RETURN[back] ? <p role="status" className={`mt-2 text-sm ${back === "ok" ? "text-acid-dim" : "text-amber-800"}`}>{RETURN[back]}{detail ? <span className="mt-1 block text-xs">Raison donnée par Canva : {detail}</span> : null}</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      {!view && !error ? <p role="status" className="mt-2 text-sm text-mut">Lecture…</p> : null}
      {view ? (
        <div className="mt-3 space-y-3 text-sm">
          <p className="flex items-center gap-2">
            {view.connected ? <CheckCircle2 aria-hidden size={18} className="text-acid-dim" /> : <CircleAlert aria-hidden size={18} className="text-amber-700" />}
            {view.connected ? "Compte Canva connecté." : "Pas encore connecté."}
          </p>
          {view.connected ? (
            <p className={view.autofill && view.brandTemplates ? "text-mut" : "text-amber-800"}>
              Remplissage automatique : {view.autofill ? "autorisé" : view.autofill === false ? "non autorisé par Canva pour ce compte" : "inconnu"} · Modèles de marque : {view.brandTemplates ? "accessibles" : view.brandTemplates === false ? "non accessibles" : "inconnu"}.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {view.appConfigured ? <a href="/api/canva/connect" className="btn-red min-h-11">{view.connected ? "Reconnecter Canva" : "Connecter Canva"}</a>
              : <p className="text-amber-800">L&apos;intégration Canva n&apos;est pas encore configurée sur le serveur.</p>}
            {view.connected ? <button type="button" className="btn-ghost min-h-11 text-red-700" onClick={async () => { try { setView(await canvaApi.disconnect()); } catch (e) { setError((e as Error).message); } }}>Déconnecter</button> : null}
          </div>
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer font-medium">Guide : créer l&apos;intégration Canva (une seule fois)</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Sur <a className="text-brand underline" href="https://www.canva.com/developers/integrations/connect-api" target="_blank" rel="noreferrer">canva.com/developers</a> : créer une intégration <strong>Connect API</strong>.</li>
              <li><strong>Scopes</strong> : profile (Read), brandtemplate:meta (Read), brandtemplate:content (Read), design:meta (Read), design:content (Read et Write).</li>
              <li><strong>Redirect URLs</strong> : ajouter <code className="rounded bg-black/[0.05] px-1">{origin}/api/canva/callback</code>.</li>
              <li>Transmets-moi le <strong>Client ID</strong> et le <strong>Client secret</strong> par un canal sûr : je les pose sur Vercel avec ton accord (jamais dans le code).</li>
              <li>Dans Canva, prépare tes <strong>modèles de marque</strong> avec des zones de données nommées (par ex. Titre, Accroche, Texte 1).</li>
            </ol>
          </details>
        </div>
      ) : null}
    </section>
  );
}
