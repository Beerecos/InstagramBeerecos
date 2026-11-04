"use client";
/**
 * Paramètres → Instagram : connexion du compte (jeton collé une fois, vérifié auprès d'Instagram, gardé côté serveur),
 * renouvellement, et état du webhook des DM automatiques. Le guide pas à pas est intégré.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Copy } from "lucide-react";
import { instagram, type ConnectionView } from "@/lib/instagram/api";

export default function InstagramSettings() {
  const [view, setView] = useState<ConnectionView | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);


  const run = (label: string, fn: () => Promise<ConnectionView>) => async () => {
    setBusy(label); setError(null);
    try { const v = await fn(); setView((old) => ({ ...v, oauthReady: old?.oauthReady, webhook: v.webhook ?? old?.webhook })); setToken(""); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(null); }
  };
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("instagram");
    const messages: Record<string, string> = {
      ok: "Connexion Instagram enregistrée.",
      configuration: "La connexion Meta doit encore être configurée sur le serveur.",
      interdit: "Votre compte ne peut pas gérer cette connexion.",
      expire: "La connexion a expiré. Relancez-la depuis ce bouton.",
      annule: "Connexion annulée dans Meta. Aucun compte n’a été modifié.",
      "aucun-compte": "Meta ne transmet aucun compte Instagram après la connexion. Le partage du compte reste à résoudre.",
      "autre-compte": "Le compte partagé ne correspond pas au compte BeeRecos attendu.",
      erreur: "La connexion n’a pas pu être enregistrée. Vérifiez la configuration Meta avant de réessayer.",
    };
    instagram.connection().then((v) => { setView(v); setOauthMessage(status ? messages[status] ?? null : null); }).catch((e: Error) => setError(e.message));
  }, []);
  const hook = view?.webhook;
  const dmReady = Boolean(hook?.appSecret && hook?.verifyToken);

  return (
    <section id="instagram" className="card scroll-mt-20 p-4" aria-labelledby="instagram-titre">
      <h2 id="instagram-titre" className="font-semibold">Instagram</h2>
      {oauthMessage ? <p role="status" className="mt-2 text-sm">{oauthMessage}</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      {!view && !error ? <p role="status" className="mt-2 text-sm text-mut">Lecture…</p> : null}
      {view ? (
        <div className="mt-3 space-y-4 text-sm">
          <p className="flex items-center gap-2">
            {view.connected ? <CheckCircle2 aria-hidden size={18} className="text-acid-dim" /> : <CircleAlert aria-hidden size={18} className="text-amber-700" />}
            {view.connected ? <>Connecté à <strong>@{view.username}</strong>{view.renewal === "meta" ? " · renouvellement depuis Meta selon la durée choisie lors de la génération" : view.expiresAt ? ` · jeton valable jusqu'au ${new Date(view.expiresAt).toLocaleDateString("fr-FR")} (renouvelé automatiquement)` : " · date d'expiration inconnue : renouvelle-le dans un jour"}</> : "Pas encore connecté."}
          </p>
          {view.needsRefresh ? <p className="text-amber-800">Le jeton expire bientôt.</p> : null}
          {view.connected ? (
            <div className="flex flex-wrap gap-2">
              {view.renewal !== "meta" ? <button type="button" className="btn-ghost min-h-11" disabled={Boolean(busy)} onClick={run("refresh", instagram.refresh)}>{busy === "refresh" ? "Renouvellement…" : "Renouveler le jeton"}</button> : null}
              <button type="button" className="btn-ghost min-h-11 text-red-700" disabled={Boolean(busy)} onClick={run("off", instagram.disconnect)}>Déconnecter</button>
            </div>
          ) : null}
          {view.oauthReady ? <div className="space-y-2">
            <a className="btn-red inline-flex min-h-11 items-center" href="/api/instagram/connect">Se connecter avec Instagram</a>
            <p className="text-xs text-mut">Choisissez le compte BeeRecos dans Meta. L’application demande l’accès au profil, à la publication, aux commentaires et aux messages pour publier et répondre aux mots-clés.</p>
          </div> : null}
          <details className="rounded-xl border border-line p-3"><summary className="cursor-pointer">Connexion manuelle avec un jeton</summary>
          <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); void run("connect", () => instagram.connect(token))(); }}>
            <label className="block font-medium">{view.connected ? "Remplacer le jeton" : "Jeton d'accès Instagram"}
              <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Jeton copié depuis Meta" className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3 font-mono font-normal" />
            </label>
            <button type="submit" className="btn-red min-h-11" disabled={!token.trim() || Boolean(busy)}>{busy === "connect" ? "Vérification auprès d'Instagram…" : "Connecter"}</button>
            <p className="text-xs text-mut">Le jeton est vérifié auprès d&apos;Instagram puis gardé sur le serveur ; il ne s&apos;affiche plus jamais.</p>
          </form>
          </details>

          <div className="rounded-xl bg-black/[0.03] p-3">
            <p className="flex items-center gap-2 font-medium">
              {dmReady ? <CheckCircle2 aria-hidden size={16} className="text-acid-dim" /> : <CircleAlert aria-hidden size={16} className="text-amber-700" />}
              DM automatiques (commente MOT → DM) : {dmReady ? "webhook prêt" : "à brancher"}
            </p>
            {hook ? (
              <ul className="mt-2 space-y-1 text-xs">
                <li>Clé secrète de l&apos;app (IG_APP_SECRET) : {hook.appSecret ? "renseignée" : "manquante"}</li>
                <li>Phrase de vérification (IG_VERIFY_TOKEN) : {hook.verifyToken ? "renseignée" : "manquante"}</li>
                <li className="flex flex-wrap items-center gap-2">Adresse à donner à Meta : <code className="rounded bg-white px-1">{hook.callbackUrl}</code>
                  <button type="button" className="inline-flex items-center gap-1 text-brand underline" onClick={() => { void navigator.clipboard?.writeText(hook.callbackUrl).then(() => setCopied(true)); }}><Copy aria-hidden size={12} />{copied ? "copiée" : "copier"}</button>
                </li>
              </ul>
            ) : null}
          </div>

          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer font-medium">Guide : obtenir le jeton (une seule fois, 30 à 45 min)</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Dans l&apos;app Instagram : <strong>Paramètres → Type de compte</strong> → compte <strong>professionnel</strong>. Puis <strong>Messages → Outils connectés</strong> → autoriser l&apos;accès aux messages.</li>
              <li>Sur <a className="text-brand underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> : <strong>Créer une app</strong>, type <strong>Business</strong>.</li>
              <li>Ajouter le produit <strong>Instagram</strong> → <strong>API setup with Unified login</strong>.</li>
              <li>Cocher les autorisations : <code>instagram_basic</code>, <code>instagram_content_publish</code>, <code>instagram_manage_comments</code>, <code>instagram_manage_messages</code>.</li>
              <li><strong>Generate access tokens</strong> → ajouter le compte BeeRecos → copier le jeton → le coller ci-dessus → <strong>Connecter</strong>.</li>
              <li>Pour les DM : dans <strong>Webhooks</strong>, coller l&apos;adresse ci-dessus, choisir une phrase de vérification, s&apos;abonner à <strong>comments</strong>. Renseigne toi-même la phrase dans IG_VERIFY_TOKEN et la clé secrète Meta dans IG_APP_SECRET sur Vercel, sans les transmettre dans une conversation.</li>
              <li>Pour répondre à tout le monde (pas seulement aux comptes de test) : passer l&apos;app <strong>en direct</strong> ; Meta peut demander une vérification de l&apos;app.</li>
            </ol>
          </details>
        </div>
      ) : null}
    </section>
  );
}
