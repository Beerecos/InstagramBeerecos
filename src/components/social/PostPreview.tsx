"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/components/social/router";
import { listCampaigns, updateDeliverable, type Deliverable, type Campaign } from "@/lib/social/api";
import { listEditorialAccounts } from "@/lib/social/editorial-api";
import { CTA_SUGGESTIONS, channelLabel } from "@/lib/social/content";
import { haptic } from "@/lib/social/haptics";
import { localDateTime, plannedDateIso } from "@/domain/social/editorial-calendar";

/**
 * Aperçu d'un livrable AVANT validation, avec un rendu réaliste par réseau
 * (LinkedIn vs Instagram, fond clair comme les vraies apps) + boutons
 * J'aime / Commenter / Partager factices pour se projeter.
 * Le bouton Valider est ici : on prévisualise, puis on valide.
 */

type Network = "linkedin" | "instagram";

/* --- petites icônes (traits, currentColor) --- */
const ic = (d: ReactNode, fill = false) => (
  <svg viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
    {d}
  </svg>
);
const HeartOutline = ic(<path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z" />);
const HeartFill = ic(<path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z" />, true);
const Comment = ic(<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.2A8 8 0 1 1 21 12z" />);
const Send = ic(<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />);
const Repost = ic(<path d="M4 9V7a3 3 0 0 1 3-3h9l-2-2m2 13v2a3 3 0 0 1-3 3H4l2 2M16 4l2 2-2 2M8 20l-2-2 2-2" />);
const Bookmark = ic(<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />);
const ThumbUp = ic(<path d="M7 10v10H4V10h3zm3 10h7.5a2 2 0 0 0 2-1.7l1-6A2 2 0 0 0 18.5 10H14V6a2 2 0 0 0-2-2l-2 6v10z" />);
const Dots = ic(<><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>);

const CHANNEL_LABEL: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", youtube: "YouTube", email: "Email" };
const chanLabel = (c: string) => CHANNEL_LABEL[c] ?? channelLabel(c);

/** Rend le texte : hashtags colorés, retours à la ligne conservés. */
function body(text: string, hashClass: string) {
  return text.split(/(\s+)/).map((tok, i) =>
    tok.length > 1 && tok.startsWith("#") ? <span key={i} className={hashClass}>{tok}</span> : <span key={i}>{tok}</span>,
  );
}

/* ---------------- LinkedIn ---------------- */
export function LinkedInCard({ text, imageSrc }: { text: string; imageSrc: string | null }) {
  const [liked, setLiked] = useState(false);
  const actions: { key: string; label: string; icon: ReactNode; on?: boolean; onClick?: () => void }[] = [
    { key: "like", label: "J'aime", icon: ThumbUp, on: liked, onClick: () => { haptic(); setLiked((v) => !v); } },
    { key: "comment", label: "Commenter", icon: Comment },
    { key: "repost", label: "Republier", icon: Repost },
    { key: "send", label: "Envoyer", icon: Send },
  ];
  return (
    <div className="overflow-hidden rounded-xl bg-white text-neutral-900 shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <img src="/beerecos-logo.jpg" alt="BeeRecos" className="h-12 w-12 rounded-full bg-white object-contain ring-1 ring-neutral-200" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-semibold">BeeRecos</div>
          <div className="truncate text-xs text-neutral-500">Réseau d'affaires · #MonReseauCestTonReseau</div>
          <div className="text-xs text-neutral-500">maintenant · 🌐</div>
        </div>
        <span className="text-neutral-400">{Dots}</span>
      </div>
      {text && (
        <div className="whitespace-pre-wrap break-words px-4 pb-3 text-[15px] leading-relaxed text-neutral-800">
          {body(text, "font-medium text-[#0A66C2]")}
        </div>
      )}
      {imageSrc && (
        <img src={imageSrc} alt="Visuel" className="w-full border-y border-neutral-100" />
      )}
      <div className="mt-1 flex items-center justify-between border-t border-neutral-100 px-2 py-1">
        {actions.map((a) => (
          <button
            key={a.key}
            onClick={a.onClick}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] font-semibold transition active:scale-95 ${
              a.on ? "text-[#0A66C2]" : "text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Instagram ---------------- */
export function InstagramCard({ text, imageSrc }: { text: string; imageSrc: string | null }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl bg-white text-neutral-900 shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <img src="/beerecos-logo.jpg" alt="BeeRecos" className="h-8 w-8 rounded-full bg-white object-contain ring-1 ring-neutral-200" />
        <span className="text-sm font-semibold lowercase">beerecos</span>
        <span className="ml-auto text-neutral-500">{Dots}</span>
      </div>
      {imageSrc ? (
        <img src={imageSrc} alt="Visuel" className="aspect-square w-full object-cover" />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[#2851FF] to-[#3BCAC2] p-6">
          <div className="max-h-full overflow-hidden whitespace-pre-wrap break-words text-center text-[15px] font-medium leading-relaxed text-fg">
            {text || "Visuel BeeRecos"}
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 px-3 pt-3">
        <button onClick={() => { haptic(); setLiked((v) => !v); }} className={`transition active:scale-90 ${liked ? "text-red-500" : "text-neutral-800"}`} aria-label="J'aime">
          {liked ? HeartFill : HeartOutline}
        </button>
        <button className="text-neutral-800 transition active:scale-90" aria-label="Commenter">{Comment}</button>
        <button className="text-neutral-800 transition active:scale-90" aria-label="Partager">{Send}</button>
        <button onClick={() => { haptic(); setSaved((v) => !v); }} className={`ml-auto transition active:scale-90 ${saved ? "text-neutral-900" : "text-neutral-800"}`} aria-label="Enregistrer">
          {saved ? ic(<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />, true) : Bookmark}
        </button>
      </div>
      {text && (
        <div className="whitespace-pre-wrap break-words px-3 pb-4 pt-2 text-sm leading-relaxed text-neutral-800">
          <span className="font-semibold lowercase">beerecos</span>{" "}
          {body(text, "text-[#00376B]")}
        </div>
      )}
    </div>
  );
}

/* --- Compteur & conseils de longueur par réseau --- */
const LIMITS: Record<Network, { reco: number; max: number; cutoff: number }> = {
  linkedin: { reco: 1300, max: 3000, cutoff: 210 },
  instagram: { reco: 125, max: 2200, cutoff: 125 },
};

function Meter({ net, text }: { net: Network; text: string }) {
  const L = LIMITS[net];
  const n = [...text].length; // vrai nombre de caractères (emojis compris)
  const over = n > L.max;
  const warn = n > L.reco;
  const pct = Math.min(100, (n / L.max) * 100);
  const tone = over ? "text-red-400" : warn ? "text-amber-400" : "text-acid";
  const bar = over ? "bg-red-400" : warn ? "bg-amber-400" : "bg-acid";
  const hashtags = (text.match(/#[^\s#]+/g) ?? []).length;
  const igHashOver = net === "instagram" && hashtags > 30;

  return (
    <div className="mt-3 rounded-xl border border-line bg-black/[0.02] p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-mut">{net === "linkedin" ? "LinkedIn" : "Instagram"} · longueur</span>
        <span className={`font-semibold tabular-nums ${tone}`}>
          {n.toLocaleString("fr-FR")} / {L.max.toLocaleString("fr-FR")}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-mut-2">
        <div>Recommandé : ≤ {L.reco.toLocaleString("fr-FR")} caractères pour l'engagement.</div>
        {n > L.cutoff && (
          <div className="text-amber-400">
            ⚠️ {net === "linkedin"
              ? `Le texte est coupé après ~${L.cutoff} caractères (« …voir plus »). Mets l'accroche au tout début.`
              : `La légende est coupée vers ${L.cutoff} caractères. L'essentiel doit passer avant.`}
          </div>
        )}
        {over && <div className="text-red-400">⛔ Dépasse la limite {net === "linkedin" ? "LinkedIn" : "Instagram"} ({L.max.toLocaleString("fr-FR")}). À raccourcir.</div>}
        {net === "instagram" && (
          <div className={igHashOver ? "text-red-400" : ""}>
            {hashtags} hashtag{hashtags > 1 ? "s" : ""} {igHashOver ? "— trop (max 30)" : "(max 30)"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PostPreview({
  item: initialItem,
  busy,
  onValidate,
  onArchive,
  onClose,
  onSaved,
}: {
  item: Deliverable;
  busy: boolean;
  onValidate: (id: string) => void;
  onArchive: (id: string) => void;
  onClose: () => void;
  onSaved?: (item: Deliverable) => void;
}) {
  const [item, setItem] = useState(initialItem);
  const [net, setNet] = useState<Network>(item.channel === "instagram" ? "instagram" : "linkedin");
  const [copied, setCopied] = useState(false);
  const mediaPending = !!item.studioSource && !item.studioSource.renderReady;
  const incompleteStudio = !!item.studioSource && (!item.content?.trim() || !item.cta?.trim() || !item.accountIds?.length);
  const canValidate = !incompleteStudio && (item.status === "draft" || item.status === "review") && !mediaPending;
  const readOnly = item.status === "published" || item.status === "archived";

  // Rattachement à une campagne (LOT 5, §21) — objectif, CTA, lien, attribution.
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState(item.campaignId ?? "");
  const [cta, setCta] = useState(item.cta ?? "");
  const [destUrl, setDestUrl] = useState(item.destinationUrl ?? "");
  const [scheduledAt, setScheduledAt] = useState(localDateTime(item.scheduledAt));
  const [attributionCode, setAttributionCode] = useState(item.attributionCode);
  const [linking, setLinking] = useState(false);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const dirty = campaignId !== (item.campaignId ?? "") || cta !== (item.cta ?? "") || destUrl !== (item.destinationUrl ?? "") || scheduledAt !== localDateTime(item.scheduledAt);

  useEffect(() => {
    let active = true;
    if (initialItem.accountIds?.length) listEditorialAccounts().then((accounts) => { if (active) setAccountNames(Object.fromEntries(accounts.map((account) => [account.id, account.name]))); }).catch(() => { /* Les identifiants conservés restent affichés ; le serveur vérifie les droits. */ });
    listCampaigns().then((r) => { if (active) setCampaigns(r.items); }).catch((e: Error) => { if (active) setLinkNotice(`Campagnes indisponibles : ${e.message}`); });
    return () => { active = false; };
  }, [initialItem.accountIds]);

  async function saveLink() {
    setLinking(true);
    setLinkNotice(null);
    haptic();
    try {
      const d = await updateDeliverable(item.id, {
        expectedVersion: item.contentVersion,
        campaignId: campaignId || null,
        workspaceId: campaignId ? campaigns.find((campaign) => campaign.id === campaignId)?.workspace_id ?? item.workspaceId : item.workspaceId,
        cta: cta || null,
        destinationUrl: destUrl || null,
        scheduledAt: plannedDateIso(scheduledAt),
      });
      setItem(d);
      onSaved?.(d);
      setAttributionCode(d.attributionCode);
      haptic("success");
      setLinkNotice("Modifications enregistrées. Le contenu doit être validé dans sa nouvelle version.");
    } catch (e) {
      setLinkNotice((e as Error).message);
    } finally {
      setLinking(false);
    }
  }

  async function copyCode() {
    if (!attributionCode) return;
    try {
      await navigator.clipboard.writeText(attributionCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1800);
    } catch { /* presse-papiers indisponible */ }
  }

  // Le visuel peut être joint au texte du post via un marqueur [[BEE_IMAGE]]…
  const raw = item.content ?? "";
  const mk = raw.match(/\[\[BEE_IMAGE\]\]([\s\S]*?)\[\[\/BEE_IMAGE\]\]/);
  const isImageDeliverable = raw.startsWith("data:image");
  const imageSrc = item.media?.find((asset) => asset.type === "image")?.url ?? (isImageDeliverable ? raw : mk ? `data:image/png;base64,${mk[1].trim()}` : null);
  const captionText = isImageDeliverable ? "" : raw.replace(/\[\[BEE_IMAGE\]\][\s\S]*?\[\[\/BEE_IMAGE\]\]/, "").trim();

  async function copyText() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(captionText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = captionText;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      haptic("success");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* presse-papiers indisponible → no-op */
    }
  }

  const tab = (n: Network, label: string) => (
    <button
      onClick={() => { haptic(); setNet(n); }}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
        net === n ? "bg-brand text-white" : "border border-line text-mut hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Aperçu du post">
      <button aria-label="Fermer" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-ink/95 backdrop-blur-xl sm:rounded-3xl">
        {/* En-tête + sélecteur de réseau */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="mr-1 text-xs text-mut">Aperçu</span>
          {item.channel === "email" ? <span className="text-sm font-semibold">Email</span> : <>{tab("linkedin", "LinkedIn")}{tab("instagram", "Instagram")}</>}
          {item.channel && (
            <span className="ml-1 hidden text-[11px] text-mut-2 sm:inline">prévu : {chanLabel(item.channel)}</span>
          )}
          <button onClick={onClose} className="ml-auto text-mut hover:text-fg" aria-label="Fermer">✕</button>
        </div>

        {/* Rendu par réseau */}
        <div className="flex-1 overflow-y-auto bg-neutral-100/5 p-4">
          {item.channel === "email" ? <article className="rounded-lg border border-line bg-white p-4 text-neutral-900"><p className="text-xs text-neutral-500">Objet</p><h2 className="mb-4 font-semibold">{item.title || "Objet à compléter"}</h2><p className="whitespace-pre-wrap break-words text-sm">{captionText}</p>{item.cta && <p className="mt-4 text-sm font-semibold">{item.cta}</p>}{item.destinationUrl && <p className="mt-1 break-all text-xs">{item.destinationUrl}</p>}</article> : net === "linkedin"
            ? <LinkedInCard text={captionText} imageSrc={imageSrc} />
            : <InstagramCard text={captionText} imageSrc={imageSrc} />}
          {item.media?.filter((asset) => asset.type === "video").map((asset, index) => <video key={index} src={asset.url} controls preload="metadata" className="mt-3 max-h-96 w-full rounded-lg" />)}
          {item.media?.filter((asset) => asset.type === "image").slice(1).map((asset, index) => <img key={index} src={asset.url} alt={asset.alt || `Visuel ${index + 2}`} loading="lazy" className="mt-3 max-h-80 w-full rounded-lg object-contain" />)}
          {mediaPending && <p role="alert" className="mt-3 text-sm text-amber-700">Le rendu final est en attente. Termine le rendu dans le studio avant de valider.</p>}
          {incompleteStudio && <p role="alert" className="mt-3 text-sm text-amber-700">Complète la légende, le CTA et les comptes dans « Préparer le post » avant de valider.</p>}
          {item.channel !== "email" && <div className="mt-3 space-y-1 text-xs text-mut"><p>CTA : {item.cta || "Non renseigné"}</p><p>Mot-clé : {item.keyword || "Non renseigné"}</p><p>Comptes sélectionnés : {item.accountIds?.map((id) => accountNames[id] || `Compte ${id}`).join(", ") || "Aucun"}</p><p>Version du post : {item.contentVersion}</p></div>}
          {captionText && item.channel !== "email" && <Meter net={net} text={captionText} />}
          {captionText && (
            <button
              onClick={copyText}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition active:scale-95 ${
                copied ? "border-acid/40 bg-acid/10 text-acid" : "border-line bg-black/[0.03] text-mut hover:text-fg"
              }`}
            >
              {copied ? "Texte copié ✅" : "Copier le texte"}
            </button>
          )}
          <p className="mt-3 text-center text-xs text-mut-2">
            Aperçu — les interactions sont illustratives. Valider le contenu ne le publie pas.
          </p>

          {/* Rattachement campagne (§21) */}
          {!readOnly && item.studioSource?.sourceType === "montage" && <Link to={`/reels/${item.studioSource.sourceId}?panel=post`} onClick={onClose} className="mt-3 block rounded-lg border border-brand px-3 py-2 text-center text-sm text-brand">Modifier le réel et son post</Link>}
          <fieldset disabled={busy || linking || readOnly} className="mt-4 space-y-2 rounded-xl border border-line bg-black/[0.02] p-3 disabled:opacity-60">
            <legend className="text-xs font-semibold text-fg">Campagne et date prévue</legend>
            <select aria-label="Campagne du contenu" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
              className="w-full rounded-lg border border-line bg-black/[0.03] px-3 py-2 text-xs text-fg outline-none focus:border-brand">
              <option value="" className="bg-white">— Aucune (organique) —</option>
              {campaigns.map((c) => <option key={c.id} value={c.id} className="bg-white">{c.name}</option>)}
            </select>
            <select aria-label="Appel à l’action" value={cta} onChange={(e) => setCta(e.target.value)}
              className="w-full rounded-lg border border-line bg-black/[0.03] px-3 py-2 text-xs text-fg outline-none focus:border-brand">
              <option value="" className="bg-white">— CTA (optionnel) —</option>
              {cta && !CTA_SUGGESTIONS.some((suggestion) => suggestion === cta) && <option value={cta}>{cta}</option>}
              {CTA_SUGGESTIONS.map((c) => <option key={c} value={c} className="bg-white">{c}</option>)}
            </select>
            <input aria-label="Lien de destination" type="url" value={destUrl} onChange={(e) => setDestUrl(e.target.value)} placeholder="Lien de destination (optionnel)"
              className="w-full rounded-lg border border-line bg-black/[0.03] px-3 py-2 text-xs text-fg outline-none focus:border-brand" />
            <div>
              <label htmlFor="preview-planned-date" className="mb-1 block text-[11px] text-mut">Date prévue ({Intl.DateTimeFormat().resolvedOptions().timeZone}) — ne publie rien</label>
              <input id="preview-planned-date" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-lg border border-line bg-black/[0.03] px-3 py-2 text-xs text-fg outline-none focus:border-brand" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={saveLink} disabled={linking || !dirty}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 hover:bg-brand-strong disabled:opacity-50">
                {linking ? "…" : "Enregistrer"}
              </button>
              {attributionCode && (
                <button onClick={copyCode}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] transition active:scale-95 ${
                    codeCopied ? "border-acid/40 bg-acid/10 text-acid" : "border-line text-mut hover:text-fg"
                  }`}>
                  {codeCopied ? "Copié ✅" : `Code : ${attributionCode}`}
                </button>
              )}
            </div>
            {linkNotice && <div className="text-[11px] text-mut">{linkNotice}</div>}
          </fieldset>
          {dirty && <p className="mt-2 text-xs text-mut">Enregistre les modifications avant de valider.</p>}
        </div>

        {/* Actions de validation */}
        <div className="flex items-center gap-2 border-t border-line px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-sm text-mut transition active:scale-95 hover:text-fg">
            Fermer
          </button>
          {item.status !== "archived" && (
            <button
              onClick={() => { haptic(); onArchive(item.id); }}
              disabled={busy}
              className="rounded-full border border-line px-4 py-2.5 text-sm text-mut transition active:scale-95 hover:text-fg disabled:opacity-50"
            >
              Archiver
            </button>
          )}
          <button
            onClick={() => canValidate && onValidate(item.id)}
            disabled={busy || linking || dirty || !canValidate}
            className="ml-auto rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(40,80,255,0.75)] transition active:scale-95 hover:bg-brand-strong disabled:opacity-50"
          >
            {busy ? "…" : canValidate ? "Valider le post" : mediaPending ? "Rendu en attente" : incompleteStudio ? "Post à compléter" : item.status === "approved" ? "Contenu validé" : "Lecture seule"}
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}
