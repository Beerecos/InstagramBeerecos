"use client";
/**
 * Paramètres → Instagram : connexion du compte par le parcours unifié de l'app BeeRecos Studio (jeton Facebook collé une
 * fois, échangé côté serveur contre le jeton de la Page reliée ; « Connecté » seulement si Meta renvoie le compte),
 * vérification, et état du webhook des DM automatiques. Le guide pas à pas est intégré.
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
  useEffect(() => { instagram.connection().then(setView).catch((e: Error) => setError(e.message)); }, []);

  const run = (label: string, fn: () => Promise<ConnectionView>) => async () => {
    setBusy(label); setError(null);
    try { const v = await fn(); setView((old) => ({ ...v, webhook: v.webhook ?? old?.webhook })); setToken(""); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(null); }
  };
  const hook = view?.webhook;
  const dmReady = Boolean(hook?.appSecret && hook?.verifyToken);

  return (
    <section id="instagram" className="card scroll-mt-20 p-4" aria-labelledby="instagram-titre">
      <h2 id="instagram-titre" className="font-semibold">Instagram</h2>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      {!view && !error ? <p role="status" className="mt-2 text-sm text-mut">Lecture…</p> : null}
      {view ? (
        <div className="mt-3 space-y-4 text-sm">
          <p className="flex items-center gap-2">
            {view.connected ? <CheckCircle2 aria-hidden size={18} className="text-acid-dim" /> : <CircleAlert aria-hidden size={18} className="text-amber-700" />}
            {view.connected ? <>Connecté à <strong>{view.username}</strong> · compte renvoyé par Meta, vérifié chaque jour</> : "Pas encore connecté."}
          </p>
          {view.needsRefresh ? <p className="text-amber-800">Le jeton expire bientôt.</p> : null}
          {view.connected ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost min-h-11" disabled={Boolean(busy)} onClick={run("refresh", instagram.refresh)}>{busy === "refresh" ? "Vérification…" : "Vérifier la connexion"}</button>
              <button type="button" className="btn-ghost min-h-11 text-red-700" disabled={Boolean(busy)} onClick={run("off", instagram.disconnect)}>Déconnecter</button>
            </div>
          ) : null}
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void run("connect", () => instagram.connect(token))(); }}>
            <label className="block font-medium">{view.connected ? "Remplacer le jeton" : "Jeton d'accès (Explorateur de l'API Graph)"}
              <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAA…" className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3 font-mono font-normal" />
            </label>
            <button type="submit" className="btn-red min-h-11" disabled={!token.trim() || Boolean(busy)}>{busy === "connect" ? "Vérification auprès de Meta…" : "Connecter"}</button>
            <p className="text-xs text-mut">Le serveur l&apos;échange contre le jeton de la Page reliée au compte Instagram, vérifie le compte auprès de Meta, puis le garde ; il ne s&apos;affiche plus jamais.</p>
          </form>

          <div className="rounded-xl bg-black/[0.03] p-3">
            <p className="flex items-center gap-2 font-medium">
              {dmReady ? <CheckCircle2 aria-hidden size={16} className="text-acid-dim" /> : <CircleAlert aria-hidden size={16} className="text-amber-700" />}
              DM automatiques (commente MOT → DM) : {dmReady ? "webhook prêt" : "à brancher"}
            </p>
            {hook ? (
              <ul className="mt-2 space-y-1 text-xs">
                <li>Clé secrète de l&apos;app (META_APP_SECRET) : {hook.appSecret ? "renseignée" : "manquante"}</li>
                <li>Phrase de vérification (IG_VERIFY_TOKEN) : {hook.verifyToken ? "renseignée" : "manquante"}</li>
                <li className="flex flex-wrap items-center gap-2">Adresse à donner à Meta : <code className="rounded bg-white px-1">{hook.callbackUrl}</code>
                  <button type="button" className="inline-flex items-center gap-1 text-brand underline" onClick={() => { void navigator.clipboard?.writeText(hook.callbackUrl).then(() => setCopied(true)); }}><Copy aria-hidden size={12} />{copied ? "copiée" : "copier"}</button>
                </li>
              </ul>
            ) : null}
          </div>

          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer font-medium">Guide : obtenir le jeton (5 minutes)</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Ouvrir l&apos;<a className="text-brand underline" href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer">Explorateur de l&apos;API Graph</a> : application <strong>BeeRecos Studio</strong>, <strong>Jeton d&apos;utilisateur</strong>.</li>
              <li>Autorisations : <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>business_management</code>, <code>instagram_basic</code>, <code>instagram_content_publish</code>, <code>instagram_manage_comments</code>, <code>instagram_manage_messages</code>.</li>
              <li><strong>Generate Access Token</strong> → cocher uniquement la Page <strong>Beerecos</strong> et le compte Instagram <strong>beerecos</strong>.</li>
              <li>Prolonger le jeton : dans l&apos;Explorateur, clic sur l&apos;icône ⓘ à gauche du jeton → <strong>Ouvrir dans l&apos;outil Token d&apos;accès</strong> → <strong>Prolonger le token d&apos;accès</strong> (en bas) → copier le nouveau jeton. Sans cette étape, la connexion tombe au bout de quelques heures.</li>
              <li>Coller le jeton prolongé ci-dessus → <strong>Connecter</strong>. Le site affiche « Connecté à beerecos » seulement si Meta renvoie ce compte.</li>
            </ol>
          </details>
        </div>
      ) : null}
    </section>
  );
}
