"use client";
/**
 * Paramètres → LinkedIn : connexion officielle (bouton, aucun jeton à copier), état du profil et de la page BeeRecos,
 * guide de création de l'application LinkedIn.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { instagram, type LinkedInView } from "@/lib/instagram/api";

const RETURN: Record<string, string> = {
  ok: "LinkedIn est connecté.",
  refuse: "Connexion annulée sur LinkedIn.",
  expire: "La demande a expiré : recommence la connexion.",
  "non-configure": "L'application LinkedIn n'est pas encore configurée sur le serveur (voir le guide).",
  interdit: "Action réservée à l'administrateur.",
  erreur: "LinkedIn a refusé la connexion : vérifie l'application (produits et adresse de retour), puis recommence.",
};

export default function LinkedInSettings() {
  const params = useSearchParams();
  const back = params.get("linkedin");
  const [view, setView] = useState<LinkedInView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { instagram.linkedinConnection().then(setView).catch((e: Error) => setError(e.message)); }, []);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <section id="linkedin" className="card scroll-mt-20 p-4" aria-labelledby="linkedin-titre">
      <h2 id="linkedin-titre" className="font-semibold">LinkedIn</h2>
      {back && RETURN[back] ? <p role="status" className={`mt-2 text-sm ${back === "ok" ? "text-acid-dim" : "text-amber-800"}`}>{RETURN[back]}</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      {!view && !error ? <p role="status" className="mt-2 text-sm text-mut">Lecture…</p> : null}
      {view ? (
        <div className="mt-3 space-y-3 text-sm">
          <p className="flex items-center gap-2">
            {view.connected ? <CheckCircle2 aria-hidden size={18} className="text-acid-dim" /> : <CircleAlert aria-hidden size={18} className="text-amber-700" />}
            {view.connected ? <>Profil connecté : <strong>{view.name}</strong>{view.expiresAt ? ` · accès valable jusqu'au ${new Date(view.expiresAt).toLocaleDateString("fr-FR")}` : ""}</> : "Pas encore connecté."}
          </p>
          <p className="text-mut">Page BeeRecos : {view.page.allowed ? "autorisée" : view.page.configured ? "en attente de l'autorisation de LinkedIn (Community Management API) ; tu publies sur ton profil en attendant" : "non configurée (identifiant de page à poser sur le serveur)"}.</p>
          <div className="flex flex-wrap gap-2">
            {view.appConfigured === false ? <p className="text-amber-800">L&apos;application LinkedIn n&apos;est pas encore configurée sur le serveur.</p>
              : <a href="/api/linkedin/connect" className="btn-red min-h-11">{view.connected ? "Reconnecter LinkedIn" : "Connecter LinkedIn"}</a>}
            {view.connected ? <button type="button" className="btn-ghost min-h-11 text-red-700" onClick={async () => { await instagram.linkedinDisconnect(); setView({ ...view, connected: false, name: null, expiresAt: null }); }}>Déconnecter</button> : null}
          </div>
          <p className="text-xs text-mut">L&apos;accès LinkedIn dure environ 60 jours : reconnecte-toi quand l&apos;app te le demande. Le jeton reste sur le serveur.</p>
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer font-medium">Guide : créer l&apos;application LinkedIn (une seule fois)</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Sur <a className="text-brand underline" href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer">linkedin.com/developers/apps</a> : <strong>Create app</strong>, rattachée à la page BeeRecos (elle doit la valider).</li>
              <li>Onglet <strong>Products</strong> : ajouter <strong>Sign In with LinkedIn using OpenID Connect</strong> et <strong>Share on LinkedIn</strong> (publication sur ton profil, immédiat).</li>
              <li>Onglet <strong>Auth</strong> : ajouter l&apos;adresse de retour <code className="rounded bg-black/[0.05] px-1">{origin}/api/linkedin/callback</code>.</li>
              <li>Transmets-moi le <strong>Client ID</strong> et le <strong>Client Secret</strong> : je les pose sur Vercel avec ton accord (jamais dans le code).</li>
              <li>Pour la page BeeRecos : demander le produit <strong>Community Management API</strong> (validation par LinkedIn, plusieurs semaines possibles), puis me donner l&apos;identifiant de la page.</li>
            </ol>
          </details>
        </div>
      ) : null}
    </section>
  );
}
