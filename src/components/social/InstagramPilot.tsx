"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAutopilotConfigured, pilot, STATUS_LABEL, type Overview, type ReelItem } from "@/lib/social/autopilot-api";
import {
  buildStoryComposition, CALIBRATION_MIN_ITEMS, CRITIQUE_GRID, DAY_LABEL, formatParis, MAX_ROUNDS, parseStorySpec, weightedScore, type CriterionKey,
} from "@/domain/social/reel-story";
import ReelPreview from "@/components/social/ReelPreview";

/**
 * PILOTAGE INSTAGRAM — la page unique du pilote automatique des Reels : prochain Reel, calendrier, file, connexions,
 * erreurs, demandes de visite. Les réglages secondaires sont dans un panneau. Chaque état affiché vient du serveur
 * (base, derniers travaux, vérification en direct) ; rien n'est déduit ni simulé ici.
 */

const CHIP: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-800", ready: "bg-brand-soft text-brand", rendering: "bg-amber-50 text-amber-900",
  ready_to_render: "bg-black/[0.05] text-fg", planned: "bg-black/[0.05] text-mut", publishing: "bg-amber-50 text-amber-900",
  to_verify: "bg-red-50 text-red-800", to_review: "bg-[#693BFC]/10 text-[#4b23c9]", failed: "bg-red-50 text-red-800", skipped: "bg-black/[0.05] text-mut",
};
const BTN = "inline-flex min-h-[40px] items-center justify-center rounded-full px-4 text-sm font-semibold transition disabled:opacity-50";
const PRIMARY = `${BTN} bg-brand text-white hover:bg-brand-strong`;
const GHOST = `${BTN} border border-line text-fg hover:border-brand/50`;
const fmt = (d: string | null | undefined) => (d ? formatParis(d) : "—");

export default function InstagramPilot() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(false);
  const [live, setLive] = useState<{ heygen: { ok: boolean; detail: string }; app: { ok: boolean; detail: string }; checkedAt: string } | null>(null);

  const load = useCallback(() => pilot.overview().then((d) => { setData(d); setError(null); }).catch((e) => setError((e as Error).message)), []);
  useEffect(() => { if (isAutopilotConfigured) void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setNotice(null); setError(null);
    try { await fn(); setNotice(ok); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (!isAutopilotConfigured) return <Shell><p className="rounded-xl bg-black/[0.04] p-4 text-sm text-mut">Le pilotage a besoin du serveur BeeMarketing (NEXT_PUBLIC_BEE_API_URL) : indisponible en mode démo.</p></Shell>;
  if (!data) return <Shell>{error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : <p role="status" className="text-sm text-mut">Chargement du pilotage…</p>}</Shell>;

  const s = data.settings;
  const autopilotValid = s.mode === "auto" && !!s.autopilot_until && new Date(s.autopilot_until) > new Date();
  const state = s.paused ? { label: "En pause", tone: "bg-amber-50 text-amber-900", detail: "Aucune production ni publication automatique (sauf le contenu de test)." }
    : autopilotValid ? { label: "Automatique", tone: "bg-emerald-50 text-emerald-800", detail: `Publication automatique autorisée jusqu'au ${fmt(s.autopilot_until)}, ${s.max_per_week} Reels par semaine au plus.` }
    : { label: "Brouillon", tone: "bg-brand-soft text-brand", detail: "Les Reels sont rédigés et rendus ; rien n'est publié." };
  const next = data.upcoming.find((c) => !["skipped", "failed"].includes(c.status)) ?? null;
  const test = [...data.upcoming, ...data.recent].find((c) => c.id === s.test_content_id) ?? null;

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${state.tone}`} data-testid="pilot-state">{state.label}</span>
        <p className="min-w-0 flex-1 text-sm text-mut">{state.detail}</p>
        <button type="button" className={GHOST} disabled={busy} onClick={() => act(() => pilot.updateSettings({ paused: !s.paused }), s.paused ? "Pilote repris." : "Pilote en pause.")}>{s.paused ? "Reprendre" : "Mettre en pause"}</button>
        <button type="button" className={GHOST} onClick={() => setPanel(true)} aria-haspopup="dialog">Réglages</button>
      </div>
      {notice ? <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {test ? <p className="mt-3 rounded-xl bg-[#693BFC]/10 px-3 py-2 text-sm text-fg">Mode test : « {test.title} » ({STATUS_LABEL[test.status]}) passe toutes les étapes, même en pause.</p> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <section aria-labelledby="next-title" className="card p-4">
          <h2 id="next-title" className="text-sm font-semibold">Prochain Reel</h2>
          {next ? <NextReel item={next} /> : <p className="mt-2 text-sm text-mut">Aucun créneau planifié : le prochain passage (toutes les 10 min) crée les créneaux.</p>}
        </section>

        <div className="min-w-0 space-y-5">
          <section aria-labelledby="queue-title" className="card p-4">
            <h2 id="queue-title" className="text-sm font-semibold">Calendrier et file des contenus</h2>
            <p className="mt-1 text-xs text-mut">{s.slot_rule.days.map((d) => DAY_LABEL[d]).join(", ")} à {s.slot_rule.time} (Europe/Paris) · rédaction {s.production_lead_hours} h avant le créneau.</p>
            <ul className="mt-3 divide-y divide-line">
              {data.upcoming.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="w-44 shrink-0 text-sm text-fg">{fmt(c.slot_at)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CHIP[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                  {c.status !== "published" && c.id !== s.test_content_id ? <button type="button" className="text-xs text-brand underline-offset-2 hover:underline" disabled={busy} onClick={() => act(() => pilot.setTest(c.id), "Contenu de test désigné.")}>Tester ce contenu</button> : null}
                  {!["published", "publishing", "skipped"].includes(c.status) ? <button type="button" className="text-xs text-mut hover:text-fg" disabled={busy} onClick={() => act(() => pilot.content(c.id, "skip"), "Contenu ignoré.")}>Ignorer</button> : null}
                  {["failed", "skipped"].includes(c.status) ? <button type="button" className="text-xs text-brand" disabled={busy} onClick={() => act(() => pilot.content(c.id, "retry"), "Nouvelle tentative programmée.")}>Réessayer</button> : null}
                  {c.status === "to_review" ? (
                    <span className="basis-full flex flex-wrap items-center gap-2 rounded-xl bg-[#693BFC]/10 px-3 py-2 text-xs">
                      <span className="min-w-0 flex-1">Refusée {MAX_ROUNDS} fois par le contrôle : la meilleure version attend ta décision. Elle ne sera ni rendue ni publiée sans elle.</span>
                      <button type="button" className={GHOST} disabled={busy} onClick={() => act(() => pilot.content(c.id, "approve-review"), "Version validée : elle part au rendu.")}>Valider cette version</button>
                      {c.source === "auto" ? <button type="button" className={GHOST} disabled={busy} onClick={() => act(() => pilot.content(c.id, "rewrite"), "Réécriture programmée (3 nouveaux tours).")}>Faire réécrire</button> : null}
                    </span>
                  ) : null}
                  {c.last_error ? <p className="basis-full text-xs text-red-700">{c.last_error}</p> : null}
                  {c.critique || c.spec ? <ReviewDetails item={c} busy={busy} act={act} /> : null}
                </li>
              ))}
              {!data.upcoming.length ? <li className="py-2 text-sm text-mut">Aucun créneau à venir.</li> : null}
            </ul>
            {data.recent.length ? (
              <details className="mt-3 text-sm"><summary className="cursor-pointer text-xs font-medium text-brand">Publications passées</summary>
                <ul className="mt-2 space-y-1">{data.recent.map((c) => (
                  <li key={c.id} className="flex flex-wrap gap-2 text-xs"><span className="w-44">{fmt(c.slot_at)}</span><span className="flex-1 truncate">{c.title}</span>
                    <span className={`rounded-full px-2 py-0.5 ${CHIP[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                    {c.ig_permalink ? <a className="text-brand underline" href={c.ig_permalink} target="_blank" rel="noreferrer">Voir</a> : null}</li>))}</ul>
              </details>
            ) : null}
          </section>

          <QualityCard data={data} busy={busy} act={act} />

          <section aria-labelledby="cx-title" className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="cx-title" className="text-sm font-semibold">Connexions</h2>
              <button type="button" className={GHOST} disabled={busy} onClick={() => act(async () => setLive(await pilot.checkConnections()), "Vérification terminée.")}>Vérifier maintenant</button>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="connections">
              <Cx name="Tâche programmée (Supabase)" ok={data.connections.cron.verified} detail={data.connections.cron.detail} />
              <Cx name="Stockage des Reels" ok={data.connections.storage.verified} detail={data.connections.storage.verified ? "Espaces reels et reels-public présents." : "Espaces de stockage absents (migration à appliquer)."} />
              <Cx name="Rédaction (Claude)" ok={lastOk(data.connections.claude)} warn={data.connections.claude.configured} detail={lastText(data.connections.claude, "Clé configurée, aucune rédaction encore.")} />
              <Cx name="Rendu vidéo (HeyGen)" ok={live ? live.heygen.ok : lastOk(data.connections.heygen)} warn={data.connections.heygen.configured} detail={live ? live.heygen.detail : lastText(data.connections.heygen, "Clé configurée, aucun rendu encore.")} />
              <Cx name="Publication (Make → Instagram)" ok={lastOk(data.connections.make)} warn={data.connections.make.configured} detail={lastText(data.connections.make, "Webhook configuré, aucune publication encore.")} />
              <Cx name="Emails (Brevo)" ok={false} warn={data.connections.brevo.configured} detail={data.connections.brevo.configured ? "Clé configurée : l'envoi réel se lit dans les demandes ci-dessous." : "BREVO_API_KEY absente : aucune confirmation envoyée."} />
              <Cx name="Commentaire CLUB (Manychat)" ok={false} warn={false} detail={data.connections.manychat.detail} />
              {live ? <Cx name="Ressources de rendu (site)" ok={live.app.ok} detail={live.app.detail} /> : null}
            </ul>
          </section>

          {data.problems.length ? (
            <section aria-labelledby="err-title" className="card border-red-200 p-4">
              <h2 id="err-title" className="text-sm font-semibold text-red-800">Erreurs et vérifications</h2>
              <ul className="mt-2 space-y-2">{data.problems.map((p) => (
                <li key={p.id} className="text-sm">
                  <span className="font-medium">{p.stage === "publication" ? "Publication" : p.stage === "render" ? "Rendu" : "Rédaction"}</span> · tentative {p.attempt} · {fmt(p.finished_at ?? p.created_at)}
                  <span className="block text-xs text-mut">{p.error}</span>
                  {p.status === "to_verify" ? <VerifyActions contentId={p.content_id} busy={busy} act={act} /> : null}
                </li>))}</ul>
            </section>
          ) : null}

          <section aria-labelledby="visit-title" className="card p-4">
            <h2 id="visit-title" className="text-sm font-semibold">Demandes de visite</h2>
            <p className="mt-1 text-xs text-mut">Enregistrées depuis /visiter-un-club. Attribution par campagne (utm) ; par Reel seulement si son identifiant a été transmis et vérifié. Sans synchronisation Manychat, les DM et clics ne sont pas comptés ici.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-mut"><tr><th className="py-1.5 font-medium">Reçue</th><th className="font-medium">Personne</th><th className="font-medium">Club</th><th className="font-medium">Campagne</th><th className="font-medium">Confirmation</th></tr></thead>
                <tbody className="divide-y divide-line">{data.visits.map((v) => (
                  <tr key={v.id}><td className="py-2">{fmt(v.created_at)}</td><td>{v.first_name} {v.last_name}<span className="block text-xs text-mut">{v.company}</span></td>
                    <td>{v.club_name}{v.club_city ? <span className="block text-xs text-mut">{v.club_city}</span> : null}</td>
                    <td className="text-xs">{[v.utm.utm_source, v.utm.utm_medium, v.utm.utm_campaign].filter(Boolean).join(" / ") || "directe"}</td>
                    <td className="text-xs">{CONFIRM_LABEL[v.confirmation_status] ?? v.confirmation_status}</td></tr>))}
                  {!data.visits.length ? <tr><td colSpan={5} className="py-2 text-mut">Aucune demande pour l'instant.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      {panel ? <SettingsPanel data={data} busy={busy} act={act} onClose={() => setPanel(false)} /> : null}
    </Shell>
  );
}

const CONFIRM_LABEL: Record<string, string> = { sent: "Email envoyé", failed: "Échec d'envoi", uncertain: "Envoi incertain", not_configured: "Brevo non configuré", pending: "En attente" };
type LastHolder = { configured: boolean; last: { status: string; finished_at: string; error: string | null } | null };
const lastOk = (c: LastHolder) => c.configured && c.last?.status === "succeeded";
const lastText = (c: LastHolder, empty: string) => !c.configured ? "Non configuré." : !c.last ? empty : c.last.status === "succeeded" ? `Dernier succès : ${fmt(c.last.finished_at)}.` : `Dernier échec : ${c.last.error ?? c.last.status}`;

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <p className="kicker text-brand">Réseaux sociaux · Pilotage</p>
      <h1 className="font-display text-3xl">Pilotage Instagram</h1>
      <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-mut">Reels rédigés, rendus et publiés automatiquement ; le commentaire CLUB mène à la demande de visite d'un club.</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function NextReel({ item }: { item: ReelItem }) {
  const html = useMemo(() => {
    const p = item.spec ? parseStorySpec(item.spec) : null;
    if (!p?.ok) return null;
    try { return buildStoryComposition(p.spec, { assetBase: `${window.location.origin}/hyperframes`, preview: true }); } catch { return null; }
  }, [item.spec]);
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-medium">{item.title}</p>
      <p className="text-xs text-mut">{fmt(item.slot_at)} · {STATUS_LABEL[item.status]}</p>
      {item.video_url ? (
        <video src={item.video_url} controls playsInline preload="metadata" className="aspect-[9/16] w-full rounded-2xl bg-black" data-testid="next-video" aria-label={`MP4 « ${item.title} »`} />
      ) : html ? (
        <><ReelPreview html={html} title={item.title} /><p className="text-xs text-mut">Aperçu animé : le MP4 n'est pas encore rendu.</p></>
      ) : <p className="rounded-xl bg-black/[0.04] p-3 text-sm text-mut">Texte pas encore rédigé : la rédaction démarre {item.slot_at ? "avant le créneau" : "au prochain passage"}.</p>}
      {item.video_url ? <a className="text-xs text-brand underline" href={item.video_url} download>Télécharger le MP4</a> : null}
      {item.caption ? <details className="text-xs"><summary className="cursor-pointer text-brand">Légende</summary><p className="mt-1 whitespace-pre-wrap text-fg">{item.caption}</p></details> : null}
    </div>
  );
}

function Cx({ name, ok, warn = false, detail }: { name: string; ok: boolean; warn?: boolean; detail: string }) {
  const tone = ok ? "bg-emerald-500" : warn ? "bg-amber-400" : "bg-black/20";
  return (
    <li className="flex items-start gap-2 rounded-xl border border-line p-3">
      <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />
      <span className="min-w-0"><span className="block text-sm font-medium">{name}</span>
        <span className="block text-xs text-mut">{ok ? "Vérifié · " : warn ? "Configuré, non vérifié · " : "Non vérifié · "}{detail}</span></span>
    </li>
  );
}

function VerifyActions({ contentId, busy, act }: { contentId: string; busy: boolean; act: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [link, setLink] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input className="min-h-[36px] flex-1 rounded-lg border border-line px-2 text-sm" placeholder="Lien Instagram du Reel publié" value={link} onChange={(e) => setLink(e.target.value)} />
      <button type="button" className={GHOST} disabled={busy || !link} onClick={() => act(() => pilot.content(contentId, "verified-published", { permalink: link }), "Publication confirmée.")}>Il est publié</button>
      <button type="button" className={GHOST} disabled={busy} onClick={() => act(() => pilot.content(contentId, "verified-not-published"), "Remis en file.")}>Il n'est pas publié</button>
    </div>
  );
}

function SettingsPanel({ data, busy, act, onClose }: { data: Overview; busy: boolean; act: (fn: () => Promise<unknown>, ok: string) => Promise<void>; onClose: () => void }) {
  const s = data.settings;
  const [days, setDays] = useState<number[]>(s.slot_rule.days);
  const [time, setTime] = useState(s.slot_rule.time);
  const [max, setMax] = useState(s.max_per_week);
  const [lead, setLead] = useState(s.production_lead_hours);
  const [duration, setDuration] = useState<30 | 90 | 180>(90);
  const [confirm, setConfirm] = useState("");
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const testable = [...data.upcoming].filter((c) => c.status !== "published");
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="Réglages du pilote">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Réglages</h2><button type="button" className={GHOST} onClick={onClose}>Fermer</button></div>

        <h3 className="mt-6 text-sm font-semibold">Publication automatique</h3>
        {s.mode === "auto" && s.autopilot_until ? (
          <div className="mt-2 space-y-2 text-sm"><p>Autorisée jusqu'au {fmt(s.autopilot_until)} (accordée le {fmt(s.autopilot_granted_at)}).</p>
            <button type="button" className={GHOST} disabled={busy} onClick={() => act(() => pilot.revokeAutopilot(), "Retour en brouillon : plus aucune publication automatique.")}>Revenir en brouillon</button></div>
        ) : (
          <div className="mt-2 space-y-2 text-sm">
            <p className="text-mut">À activer une fois, après le test. Ensuite, les Reels prêts sont publiés à leur créneau sans validation à chaque fois, dans la limite de {s.max_per_week} par semaine. Révocable à tout moment.</p>
            <label className="block text-xs font-medium text-mut">Durée
              <select className="mt-1 block min-h-[40px] w-full rounded-lg border border-line px-2" value={duration} onChange={(e) => setDuration(Number(e.target.value) as 30 | 90 | 180)}>
                <option value={30}>30 jours</option><option value={90}>90 jours</option><option value={180}>180 jours</option></select></label>
            <label className="block text-xs font-medium text-mut">Écris « PUBLIER AUTOMATIQUEMENT » pour confirmer
              <input className="mt-1 block min-h-[40px] w-full rounded-lg border border-line px-2" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
            <button type="button" className={PRIMARY} disabled={busy || confirm !== "PUBLIER AUTOMATIQUEMENT"} onClick={() => act(() => pilot.grantAutopilot(duration, confirm), "Pilote automatique activé.")}>Activer le pilote automatique</button>
          </div>
        )}

        <h3 className="mt-6 text-sm font-semibold">Mode test</h3>
        <p className="mt-1 text-xs text-mut">Un seul contenu passe toutes les étapes, même en pause. Le serveur vérifie lequel.</p>
        <select className="mt-2 block min-h-[40px] w-full rounded-lg border border-line px-2 text-sm" value={s.test_content_id ?? ""} disabled={busy}
          onChange={(e) => act(() => pilot.setTest(e.target.value || null), e.target.value ? "Contenu de test désigné." : "Mode test désactivé.")}>
          <option value="">Aucun</option>{testable.map((c) => <option key={c.id} value={c.id}>{c.title} — {STATUS_LABEL[c.status]}</option>)}</select>
        {s.test_content_id ? <button type="button" className={`${PRIMARY} mt-2`} disabled={busy} onClick={() => act(() => pilot.publishTestNow(), "Publication du test envoyée à Make.")}>Publier le test maintenant</button> : null}

        <h3 className="mt-6 text-sm font-semibold">Calendrier (Europe/Paris)</h3>
        <div className="mt-2 flex flex-wrap gap-1">{[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
            className={`min-h-[36px] rounded-full border px-3 text-xs ${days.includes(d) ? "border-brand bg-brand text-white" : "border-line"}`}>{DAY_LABEL[d]}</button>))}</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <label className="font-medium text-mut">Heure<input type="time" className="mt-1 block min-h-[40px] w-full rounded-lg border border-line px-2" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label className="font-medium text-mut">Max / semaine<input type="number" min={1} max={7} className="mt-1 block min-h-[40px] w-full rounded-lg border border-line px-2" value={max} onChange={(e) => setMax(Number(e.target.value))} /></label>
          <label className="font-medium text-mut">Rédaction (h avant)<input type="number" min={6} max={168} className="mt-1 block min-h-[40px] w-full rounded-lg border border-line px-2" value={lead} onChange={(e) => setLead(Number(e.target.value))} /></label>
        </div>
        <button type="button" className={`${GHOST} mt-3`} disabled={busy || !days.length} onClick={() => act(() => pilot.updateSettings({ slotRule: { days, time }, maxPerWeek: max, leadHours: lead }), "Calendrier enregistré.")}>Enregistrer le calendrier</button>
        <StudioUpload busy={busy} act={act} />
        <p className="mt-6 text-xs text-mut">La pause et les modes agissent sur la production et la publication automatiques de BeeMarketing. Ils ne désactivent pas la règle Manychat (à gérer dans Manychat).</p>
      </div>
    </div>
  );
}

type Act = (fn: () => Promise<unknown>, ok: string) => Promise<void>;
const CHECK_TONE = (ok: boolean) => (ok ? "text-emerald-700" : "text-red-700");

/**
 * Contrôle qualité : créateur ≠ contrôleur. Contrôles mesurés (oui / non) puis grille du contrôleur, preuve à l'appui.
 * La note ne bloque qu'une fois étalonnée sur tes propres notes ; tes retours deviennent des règles écrites.
 */
function QualityCard({ data, busy, act }: { data: Overview; busy: boolean; act: Act }) {
  const q = data.quality;
  const s = data.settings;
  const [rule, setRule] = useState("");
  const [keywords, setKeywords] = useState((s.dm_keywords ?? ["CLUB"]).join(", "));
  const cal = q?.calibration;
  return (
    <section aria-labelledby="qa-title" className="card p-4" data-testid="quality">
      <h2 id="qa-title" className="text-sm font-semibold">Contrôle qualité</h2>
      <p className="mt-1 text-xs text-mut">Chaque Reel automatique passe des contrôles mesurés, puis un contrôleur séparé qui juge sans rien réécrire. {MAX_ROUNDS} refus → il remonte ici, à arbitrer.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        <Cx name="Contrôleur séparé (ChatGPT)" ok={false} warn={Boolean(q?.critic.configured)}
          detail={!q?.critic.configured ? "Aucune clé IA : seuls les contrôles mesurés s'appliquent." : q.critic.independent ? "ChatGPT juge ce que Claude a rédigé (OPENAI_API_KEY + CRITIC_MODEL)." : "Claude se contrôle lui-même (non indépendant) : poser OPENAI_API_KEY et CRITIC_MODEL pour que ChatGPT juge."} />
        <Cx name="Étalonnage de la note" ok={Boolean(cal?.calibrated)} warn={Boolean(cal?.items)}
          detail={cal?.calibrated ? `Étalonné : ${cal.items} Reels notés, écart moyen ${cal.gap} point. La note bloque sous 9.` : `${cal?.items ?? 0}/${CALIBRATION_MIN_ITEMS} Reels notés par toi${cal?.gap != null ? `, écart moyen ${cal.gap} point` : ""}. Tant que ce n'est pas étalonné, seul le verdict argumenté du contrôleur compte.`} />
      </ul>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-mut">Tes retours, devenus règles</h3>
      <p className="mt-1 text-xs text-mut">Notés mot pour mot ; appliqués à la rédaction et vérifiés par le contrôleur à chaque Reel suivant.</p>
      <ul className="mt-2 space-y-1">{(s.learned_rules ?? []).map((r) => (
        <li key={r.id} className="flex items-start gap-2 text-sm"><span className="min-w-0 flex-1">« {r.text} » <span className="text-xs text-mut">— {fmt(r.at)}</span></span>
          <button type="button" className="text-xs text-mut hover:text-fg" disabled={busy} onClick={() => act(() => pilot.rules("remove", r.id), "Règle retirée.")}>Retirer</button></li>))}
        {!(s.learned_rules ?? []).length ? <li className="text-sm text-mut">Aucune règle pour l'instant.</li> : null}</ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-line px-2 text-sm" placeholder="Ex. : jamais « booster », on dit « développer »." aria-label="Nouvelle règle" value={rule} onChange={(e) => setRule(e.target.value)} />
        <button type="button" className={GHOST} disabled={busy || rule.trim().length < 5} onClick={() => act(async () => { await pilot.rules("add", rule.trim()); setRule(""); }, "Règle ajoutée.")}>Ajouter</button>
      </div>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-mut">Mots-clés actifs dans Manychat</h3>
      <p className="mt-1 text-xs text-mut">À tenir à jour toi-même (pas de synchronisation) : un Reel dont le mot-clé n'y figure pas, ou qui en invite un autre, est refusé avant rendu.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-line px-2 text-sm" aria-label="Mots-clés actifs" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        <button type="button" className={GHOST} disabled={busy} onClick={() => act(() => pilot.updateSettings({ dmKeywords: keywords.split(/[\s,;]+/).filter(Boolean) }), "Mots-clés enregistrés.")}>Enregistrer</button>
      </div>
    </section>
  );
}

/** Rapport d'un contenu : brief, contrôles mesurés, verdicts du contrôleur (preuve, consigne), tours refusés, note humaine. */
function ReviewDetails({ item, busy, act }: { item: ReelItem; busy: boolean; act: Act }) {
  const r = item.critique;
  const final = r?.final;
  const lastRound = r?.rounds?.[r.rounds.length - 1];
  const critique = final?.critique ?? lastRound?.critique ?? null;
  const checks = final?.checks ?? lastRound?.checks ?? [];
  const failed = checks.filter((c) => !c.ok).length;
  return (
    <details className="basis-full text-xs">
      <summary className="cursor-pointer text-brand">
        Contrôle{checks.length ? ` · ${checks.length - failed}/${checks.length} mesures` : ""}{critique ? ` · contrôleur ${critique.verdict === "reussi" ? "réussi" : "refusé"} (${critique.score}/10${critique.independent ? "" : ", non indépendant"})` : ""}
        {item.human_review ? ` · ta note ${weightedScore(item.human_review.scores)}/10` : ""}
      </summary>
      <div className="mt-2 space-y-3 rounded-xl border border-line p-3">
        {r?.brief ? <p><span className="font-medium">Brief</span> · sujet « {r.brief.sujet} » · angle « {r.brief.angle} » · mot-clé {r.brief.motCle}</p> : null}
        {r?.arbitrated ? <p className="text-mut">Arbitré par {r.arbitrated.by} le {fmt(r.arbitrated.at)}.</p> : null}
        {checks.length ? (
          <ul className="space-y-0.5">{checks.map((c) => <li key={c.key} className={CHECK_TONE(c.ok)}>{c.ok ? "✓" : "✗"} {c.label} — <span className="text-mut">{c.proof}</span></li>)}</ul>
        ) : null}
        {critique ? (
          <div><p className="font-medium">Contrôleur : {critique.summary}</p>
            <ul className="mt-1 space-y-1">{critique.criteria.map((c) => {
              const g = CRITIQUE_GRID.find((x) => x.key === c.key);
              return <li key={c.key}><span className={CHECK_TONE(c.ok)}>{g?.label} ({g?.weight} %) : {c.score}/10</span> — <span className="text-mut">preuve : {c.proof}</span>{c.instruction ? <span className="block text-fg">Consigne : {c.instruction}</span> : null}</li>;
            })}</ul></div>
        ) : null}
        {r?.rounds && r.rounds.length > 1 ? (
          <div><p className="font-medium">Versions précédentes</p>
            <ul className="mt-1 space-y-1">{r.rounds.slice(0, -1).map((x) => (
              <li key={x.round} className="text-mut">Tour {x.round} · {x.refusedBy === "critique" ? "refusé par le contrôleur" : x.refusedBy === "controle" ? "refusé par les contrôles" : "accepté"}{x.hook ? ` · accroche « ${x.hook.replace(/\n/g, " ")} »` : ""}{x.critique ? ` · ${x.critique.score}/10` : ""}</li>))}</ul></div>
        ) : null}
        {item.spec ? <RateForm item={item} busy={busy} act={act} /> : null}
      </div>
    </details>
  );
}

/** Ta note sur la même grille : sert à étalonner le contrôleur (dix Reels notés, écart moyen sous un point). */
function RateForm({ item, busy, act }: { item: ReelItem; busy: boolean; act: Act }) {
  const [scores, setScores] = useState<Record<CriterionKey, number>>(() => item.human_review?.scores ?? Object.fromEntries(CRITIQUE_GRID.map((c) => [c.key, 8])) as Record<CriterionKey, number>);
  const [comment, setComment] = useState(item.human_review?.comment ?? "");
  return (
    <div>
      <p className="font-medium">Ta note (étalonnage)</p>
      <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">{CRITIQUE_GRID.map((c) => (
        <label key={c.key} className="text-mut">{c.label}
          <select className="mt-0.5 block min-h-[36px] w-full rounded-lg border border-line px-1 text-fg" value={scores[c.key]} onChange={(e) => setScores({ ...scores, [c.key]: Number(e.target.value) })}>
            {Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n}</option>)}</select></label>))}</div>
      <input className="mt-2 block min-h-[36px] w-full rounded-lg border border-line px-2" placeholder="Commentaire (facultatif)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button type="button" className={`${GHOST} mt-2`} disabled={busy} onClick={() => act(() => pilot.content(item.id, "rate", { scores, comment }), "Note enregistrée.")}>Enregistrer ma note ({weightedScore(scores)}/10)</button>
    </div>
  );
}

/** Vidéo studio fournie : durée lue dans le navigateur, dépôt direct au stockage par URL signée, puis vérification. */
function StudioUpload({ busy, act }: { busy: boolean; act: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [hook, setHook] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pick = (f: File | null) => {
    setFile(f); setDuration(null); setErr(null);
    if (!f) return;
    if (!/^video\/(mp4|quicktime)$/.test(f.type)) { setErr("Format attendu : MP4 ou MOV vertical."); return; }
    if (f.size > 200 * 1024 * 1024) { setErr("200 Mo au plus."); return; }
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { setDuration(Math.round(v.duration * 100) / 100); URL.revokeObjectURL(v.src); };
    v.onerror = () => setErr("Durée illisible : vérifie le fichier.");
    v.src = URL.createObjectURL(f);
  };
  const send = () => act(async () => {
    if (!file || !duration) throw new Error("Choisis une vidéo.");
    const r = await pilot.studioCreate({ title, hook, duration });
    const res = await fetch(r.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "video/mp4" }, body: file });
    if (!res.ok) throw new Error(`Dépôt refusé par le stockage (HTTP ${res.status}).`);
    await pilot.studioUploaded(r.id);
    setFile(null); setTitle(""); setHook("");
  }, "Vidéo studio déposée : elle prend le prochain créneau libre (transcription, sous-titres, rendu).");
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">Vidéo studio ou Flow (facultatif)</h3>
      <p className="mt-1 text-xs text-mut">Vidéo verticale tournée, ou plan généré dans Flow (Gemini) puis téléchargé — 8 à 90 s : accroche, sous-titres issus de la transcription réelle, pictogramme et CTA ajoutés au rendu. Elle remplace le prochain Reel automatique pas encore rédigé.</p>
      <input type="file" accept="video/mp4,video/quicktime" className="mt-2 block w-full text-sm" aria-label="Vidéo studio" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      {duration ? <p className="mt-1 text-xs text-mut">Durée : {duration.toLocaleString("fr-FR")} s</p> : null}
      <input className="mt-2 block min-h-[40px] w-full rounded-lg border border-line px-2 text-sm" placeholder="Titre interne" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="mt-2 block min-h-[40px] w-full rounded-lg border border-line px-2 text-sm" placeholder="Accroche affichée dès la première seconde" value={hook} onChange={(e) => setHook(e.target.value)} />
      {err ? <p role="alert" className="mt-1 text-xs text-red-700">{err}</p> : null}
      <button type="button" className={`${GHOST} mt-2`} disabled={busy || !file || !duration || !title.trim() || !hook.trim() || !!err} onClick={send}>Déposer la vidéo</button>
    </div>
  );
}
