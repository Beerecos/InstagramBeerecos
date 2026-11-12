"use client";
/**
 * Effets sonores SFX Kit dans le Studio (2026-11-12) : panneau « Sons » (catalogue, écoute, ajout), liste des sons de
 * la vidéo (volume, sourdine, décalage, remplacer, détacher, supprimer) et contrôle avant la vidéo finale.
 * Toute la logique de placement est dans le moteur (domain/social/montage/sons.ts) : l'écran ne fait que l'appeler.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Star, Trash2, Unlink, Volume2, VolumeX } from "lucide-react";
import type { CaptionWord, Edit, Son } from "@/domain/social/montage/edit";
import { SON_LIB } from "@/domain/social/montage/edit";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { detacherSon, genererSonsAuto, modifierSon, nouvelIdSon, placeSons, retirerSonsAuto, sfxInfo, sfxPath, supprimerSon, type SonProbleme } from "@/domain/social/montage/sons";

export type CatalogueSon = { id: string; nom: string; name: string; categorie: string; filtres: string[]; duree: number; motsCles: string; description: string; usage: string[]; eviter: string[]; synchro: string; essentiel: boolean };
type Catalogue = { version: string; commit: string; licence: string; categories: { id: string; nom: string; description: string }[]; sons: CatalogueSon[] };

const ASSETS = "/hyperframes/";
let cataloguePromise: Promise<Catalogue> | null = null;
/** Catalogue chargé à la première ouverture du panneau (pas au démarrage du Studio). */
export function loadCatalogue(): Promise<Catalogue> {
  cataloguePromise ??= fetch(`${ASSETS}sfx-kit/catalogue.json`).then((r) => { if (!r.ok) throw new Error(`Catalogue des sons indisponible (${r.status}).`); return r.json(); }).catch((e) => { cataloguePromise = null; throw e; });
  return cataloguePromise;
}

const FAVORIS_KEY = "ibr.sons.favoris";
function useFavoris(): [Set<string>, (id: string) => void] {
  const [fav, setFav] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(FAVORIS_KEY) ?? "[]")); } catch { return new Set(); } });
  const toggle = (id: string) => setFav((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); try { localStorage.setItem(FAVORIS_KEY, JSON.stringify([...n])); } catch { /* stockage indisponible */ } return n; });
  return [fav, toggle];
}

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sec = (s: number) => `${s.toFixed(s < 1 ? 2 : 1).replace(".", ",")} s`;
const FILTRES = [["essentiels", "Essentiels"], ["favoris", "Favoris"], ["tout", "Tout"], ["textes", "Textes"], ["mouvements", "Mouvements et zooms"], ["transitions", "Transitions"], ["impacts", "Impacts"], ["notifications", "Notifications"], ["logos", "Logos"]] as const;
type Filtre = typeof FILTRES[number][0];

/** Une seule écoute à la fois, distincte du lecteur du projet ; arrêtée à la fermeture. */
function useEcoute() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const stop = () => { audio.current?.pause(); audio.current = null; setPlaying(null); };
  const play = (id: string) => {
    const was = playing;
    stop();
    if (was === id) return;
    const path = sfxPath(id);
    if (!path) return;
    const a = new Audio(`${ASSETS}${path}`);
    audio.current = a;
    a.onended = () => { if (audio.current === a) stop(); };
    a.onerror = () => { if (audio.current === a) stop(); };
    setPlaying(id);
    void a.play().catch(() => { if (audio.current === a) stop(); });
  };
  useEffect(() => () => { audio.current?.pause(); }, []);
  return { playing, play, stop };
}

export type SonsCible = { mode: "ajout" } | { mode: "remplacer"; occId: string };

/** Panneau « Sons » : recherche, filtres, Essentiels / Favoris, écoute, « Ajouter ici » / « Associer à l'animation ». */
export function SonsPanel({ open, cible, animationLabel, canAddHere, onAddHere, onAssociate, onReplace }: {
  open: boolean; cible: SonsCible; animationLabel: string | null; canAddHere: boolean;
  onAddHere: (id: string) => void; onAssociate: (id: string) => void; onReplace: (occId: string, id: string) => void;
}) {
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("essentiels");
  const [limit, setLimit] = useState(40);
  const [fav, toggleFav] = useFavoris();
  const ecoute = useEcoute();
  useEffect(() => { if (open && !cat) loadCatalogue().then(setCat).catch((e) => setError(e instanceof Error ? e.message : "Catalogue indisponible.")); }, [open, cat]);
  // L'écoute s'arrête dès que le panneau se ferme.
  const { stop } = ecoute;
  useEffect(() => { if (!open) stop(); }, [open, stop]);
  const catNom = useMemo(() => new Map(cat?.categories.map((c) => [c.id, c.nom]) ?? []), [cat]);
  const liste = useMemo(() => {
    if (!cat) return [];
    const words = fold(q).split(/\s+/).filter(Boolean);
    // En recherche, « Essentiels » s'élargit à tout le catalogue ; les autres filtres restent appliqués.
    const scope = words.length && filtre === "essentiels" ? "tout" : filtre;
    return cat.sons.filter((s) => {
      if (scope === "essentiels" && !s.essentiel) return false;
      if (scope === "favoris" && !fav.has(s.id)) return false;
      if (!["essentiels", "favoris", "tout"].includes(scope) && !s.filtres.includes(scope)) return false;
      const hay = fold(`${s.nom} ${catNom.get(s.categorie) ?? ""} ${s.motsCles} ${s.id}`);
      return words.every((w) => hay.includes(w));
    });
  }, [cat, q, filtre, fav, catNom]);
  const replacing = cible.mode === "remplacer";
  return (
    <div className="space-y-3">
      {replacing ? <p role="status" className="rounded-xl bg-white/5 px-3 py-2 text-sm">Choisis le son qui remplace l’effet sélectionné.</p> : null}
      <input type="search" aria-label="Rechercher un son" placeholder="Rechercher : pop, whoosh, zoom, logo, ding…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(40); }} className="sv2-input w-full" />
      <div role="group" aria-label="Filtres des sons" className="flex gap-2 overflow-x-auto pb-1">
        {FILTRES.map(([k, label]) => <button key={k} type="button" aria-pressed={filtre === k} className="sv2-chip" onClick={() => { setFiltre(k); setLimit(40); }}>{label}{k === "favoris" ? ` (${fav.size})` : ""}</button>)}
      </div>
      {error ? <p role="alert" className="text-sm text-red-300">{error} <button type="button" className="underline" onClick={() => { setError(null); setCat(null); }}>Réessayer</button></p> : null}
      {!cat && !error ? <p role="status" className="text-sm text-[#AAB4C3]">Chargement du catalogue…</p> : null}
      {cat ? <p className="text-xs text-[#AAB4C3]">{liste.length} son{liste.length > 1 ? "s" : ""} · SFX Kit v{cat.version} (Wyzowl, {cat.licence})</p> : null}
      {cat && !liste.length ? <p className="text-sm text-[#AAB4C3]">{filtre === "favoris" ? "Aucun favori : touche l’étoile d’un son pour le retrouver ici." : "Aucun son ne correspond."}</p> : null}
      <ul aria-label="Sons du catalogue" className="space-y-2">
        {liste.slice(0, limit).map((s) => {
          const on = ecoute.playing === s.id;
          return (
            <li key={s.id} className="sv2-son">
              <button type="button" className="sv2-icon-btn" aria-label={`${on ? "Arrêter" : "Écouter"} ${s.nom}`} aria-pressed={on} onClick={() => ecoute.play(s.id)}>{on ? <Pause aria-hidden size={16} /> : <Play aria-hidden size={16} />}</button>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight" title={s.description}>{s.nom}</span>
                <span className="block truncate text-xs text-[#AAB4C3]">{sec(s.duree)} · {catNom.get(s.categorie)}</span>
              </span>
              <button type="button" className="sv2-icon-btn" aria-label={`${fav.has(s.id) ? "Retirer des favoris" : "Ajouter aux favoris"} : ${s.nom}`} aria-pressed={fav.has(s.id)} onClick={() => toggleFav(s.id)}><Star aria-hidden size={16} fill={fav.has(s.id) ? "currentColor" : "none"} /></button>
              <span className="sv2-son-actions">{replacing ? <button type="button" className="sv2-mini" onClick={() => { ecoute.stop(); onReplace(cible.occId, s.id); }}>Remplacer par ce son</button> : <>
                <button type="button" className="sv2-mini" disabled={!canAddHere} title="Le début du son se place à la position de lecture" onClick={() => { ecoute.stop(); onAddHere(s.id); }}>Ajouter ici</button>
                <button type="button" className="sv2-mini" disabled={!animationLabel} title={animationLabel ? `Relier à ${animationLabel}` : "Sélectionne d’abord une animation"} onClick={() => { ecoute.stop(); onAssociate(s.id); }}>Associer à l’animation</button>
              </>}</span>
            </li>
          );
        })}
      </ul>
      {liste.length > limit ? <button type="button" className="sv2-action w-full" onClick={() => setLimit(limit + 60)}>Afficher plus de sons ({liste.length - limit})</button> : null}
    </div>
  );
}

const RAISONS: Record<SonProbleme["raison"], string> = {
  introuvable: "Son introuvable", "animation-supprimee": "Animation supprimée : ne sonne plus", "hors-montage": "Passage coupé : ne sonne plus", muet: "Muet",
};

/** Libellé de l'ancrage d'une occurrence. */
function ancreLabel(o: Son, edit: Edit): string {
  const a = o.ancre;
  if (a.type === "libre") return "Placé librement";
  if (a.type === "logo") return "Logo de fin";
  if (a.type === "repere") return a.nature === "zoom" ? "Zoom" : a.nature === "transition" ? "Transition" : "Vidéo en carte";
  const anim = edit.custom.find((c) => c.id === a.animId);
  return `Relié à : ${anim ? ANIMATIONS[anim.name]?.label ?? anim.name : "animation supprimée"}${a.point === "fin" ? " (fin)" : ""}`;
}

/** Sons de la vidéo : réglages de chaque occurrence. `edit` = montage affiché (animations du brouillon comprises). */
export function SonsDeLaVideo({ edit, words, selected, disabled, onSelect, onChange, onReplace, onSeek, sourceAt }: {
  edit: Edit; words: CaptionWord[]; selected: string | null; disabled: boolean;
  onSelect: (id: string | null) => void; onChange: (next: Edit) => void; onReplace: (occId: string) => void; onSeek: (outputMs: number) => void; sourceAt: (outputMs: number) => number;
}) {
  const [catNoms, setCatNoms] = useState<Map<string, string>>(new Map());
  useEffect(() => { loadCatalogue().then((c) => setCatNoms(new Map(c.sons.map((s) => [s.id, s.nom])))).catch(() => {}); }, []);
  const { placed, problemes } = useMemo(() => placeSons(edit, []), [edit]);
  const at = new Map(placed.map((p) => [p.occ.id, p]));
  const issue = new Map(problemes.map((p) => [p.occ.id, p.raison]));
  const auto = edit.sonsReglages?.auto ?? false;
  const sons = [...(edit.sons ?? [])].sort((a, b) => (at.get(a.id)?.startMs ?? Infinity) - (at.get(b.id)?.startMs ?? Infinity) || a.id.localeCompare(b.id));
  return (
    <section aria-label="Sons de la vidéo" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-11 flex-1 items-center gap-2 text-sm font-semibold"><input type="checkbox" role="switch" checked={auto} disabled={disabled} onChange={(e) => onChange(e.target.checked ? genererSonsAuto(edit, words) : retirerSonsAuto(edit))} className="h-5 w-5 accent-[#2851FF]" /> Son automatique</label>
        {auto ? <button type="button" className="sv2-mini" disabled={disabled} onClick={() => onChange(genererSonsAuto(edit, words))}>Relancer</button> : null}
      </div>
      <p className="text-xs text-[#AAB4C3]">{auto ? "Les animations importantes, les zooms, les transitions et le logo reçoivent un son discret. Tes remplacements, volumes et suppressions sont gardés à chaque relance." : "Désactivé : seuls les sons que tu ajoutes sont joués."}</p>
      <label className="block text-sm font-semibold">Volume des effets <span className="font-normal text-[#AAB4C3]">{Math.round((edit.sonsReglages?.volume ?? 1) * 100)} %</span>
        <input type="range" min={0} max={1.5} step={0.05} value={edit.sonsReglages?.volume ?? 1} disabled={disabled} aria-label="Volume global des effets" onChange={(e) => onChange({ ...edit, sonsReglages: { auto, volume: e.target.valueAsNumber } })} className="sv2-range mt-1 block w-full" /></label>
      {!sons.length ? <p className="text-sm text-[#AAB4C3]">Aucun effet sonore. Ouvre « Sons » pour en ajouter, ou active le son automatique.</p> : null}
      <ul className="space-y-2">
        {sons.map((o) => {
          const p = at.get(o.id), why = issue.get(o.id), info = sfxInfo(o.son), sel = selected === o.id;
          const nom = catNoms.get(o.son) ?? o.son;
          return (
            <li key={o.id} className={`sv2-son-occ ${sel ? "sv2-son-occ-on" : ""}`} data-testid="son-occurrence">
              <div className="flex items-center gap-2">
                <button type="button" className="min-w-0 flex-1 text-left" aria-pressed={sel} onClick={() => { onSelect(sel ? null : o.id); if (p) onSeek(Math.max(0, p.startMs - 400)); }}>
                  <span className="block truncate text-sm font-semibold">{nom}{o.origine === "auto" ? <span className="ml-1 text-xs font-normal text-[#AAB4C3]">· auto</span> : null}</span>
                  <span className="block truncate text-xs text-[#AAB4C3]">{ancreLabel(o, edit)}{p ? ` · ${sec(p.startMs / 1000)}` : ""}{why && why !== "muet" ? ` · ${RAISONS[why]}` : ""}</span>
                </button>
                <button type="button" className="sv2-icon-btn" aria-label={`${o.muet ? "Réactiver" : "Rendre muet"} ${nom}`} aria-pressed={o.muet} disabled={disabled} onClick={() => onChange(modifierSon(edit, o.id, { muet: !o.muet }))}>{o.muet ? <VolumeX aria-hidden size={16} /> : <Volume2 aria-hidden size={16} />}</button>
                <button type="button" className="sv2-icon-btn" aria-label={`Supprimer ${nom}`} disabled={disabled} onClick={() => { onChange(supprimerSon(edit, o.id)); if (sel) onSelect(null); }}><Trash2 aria-hidden size={16} /></button>
              </div>
              {sel ? <div className="mt-2 space-y-2">
                <label className="block text-xs font-semibold">Volume {Math.round(o.volume * 100)} %{p?.duckDb ? <span className="font-normal text-[#AAB4C3]"> · baissé de {-p.duckDb} dB sous la voix</span> : null}
                  <input type="range" min={0} max={1.5} step={0.05} value={o.volume} disabled={disabled} aria-label={`Volume de ${nom}`} onChange={(e) => onChange(modifierSon(edit, o.id, { volume: e.target.valueAsNumber }))} className="sv2-range mt-1 block w-full" /></label>
                {o.ancre.type !== "libre" ? <label className="block text-xs font-semibold">Décalage {o.decalageMs > 0 ? "+" : ""}{(o.decalageMs / 1000).toFixed(2).replace(".", ",")} s
                  <input type="range" min={-1000} max={1000} step={10} value={o.decalageMs} disabled={disabled} aria-label={`Décalage de ${nom}`} onChange={(e) => onChange(modifierSon(edit, o.id, { decalageMs: e.target.valueAsNumber }))} className="sv2-range mt-1 block w-full" /></label> : null}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="sv2-mini" disabled={disabled} onClick={() => onReplace(o.id)}>Remplacer</button>
                  {o.ancre.type !== "libre" && (!why || why === "muet") ? <button type="button" className="sv2-mini" disabled={disabled} onClick={() => onChange(detacherSon(edit, o.id, sourceAt))}><Unlink aria-hidden size={14} /> Détacher</button> : null}
                  {info ? <span className="self-center text-xs text-[#AAB4C3]">Durée {sec(info.durationS)}</span> : null}
                </div>
              </div> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Nouvelle occurrence : « Ajouter ici » (début du fichier à la position de lecture) ou associée à une animation. */
export function ajouterSon(edit: Edit, son: string, ancre: Son["ancre"]): { edit: Edit; id: string } {
  const id = nouvelIdSon(edit);
  return { id, edit: { ...edit, sons: [...(edit.sons ?? []), { id, son, lib: SON_LIB, ancre, decalageMs: 0, volume: 0.7, muet: false, origine: "manuel" }] } };
}

/** Effets qui ne seront pas dans la vidéo finale : catalogue (identifiant inconnu) ou fichier inaccessible. */
export function useSonsIndisponibles(edit: Edit | null): { ids: string[]; checking: boolean } {
  const files = useMemo(() => (edit?.sons ?? []).filter((o) => !o.muet).map((o) => [o.id, sfxPath(o.son)] as const), [edit]);
  const [bad, setBad] = useState<{ key: string; ids: string[] } | null>(null);
  const key = JSON.stringify(files);
  useEffect(() => {
    let alive = true;
    const unique = [...new Set(files.map(([, f]) => f).filter(Boolean))] as string[];
    Promise.all(unique.map(async (f) => [f, await fetch(`${ASSETS}${f}`, { method: "HEAD" }).then((r) => r.ok).catch(() => false)] as const)).then((res) => {
      if (!alive) return;
      const ok = new Map(res);
      setBad({ key, ids: files.filter(([, f]) => !f || !ok.get(f)).map(([id]) => id) });
    });
    return () => { alive = false; };
  }, [key, files]);
  return { ids: bad?.key === key ? bad.ids : [], checking: bad?.key !== key && files.length > 0 };
}

/** Contrôle avant la vidéo finale : chaque effet impossible à rendre est nommé ; corriger ou continuer sans lui. */
export function SonsAvantPublication({ edit, indisponibles, disabled, onChange, onReplace }: { edit: Edit; indisponibles: string[]; disabled: boolean; onChange: (next: Edit) => void; onReplace: (occId: string) => void }) {
  const { problemes } = placeSons(edit, []);
  const silencieux = problemes.filter((p) => p.raison === "animation-supprimee" || p.raison === "hors-montage");
  const bloquants = (edit.sons ?? []).filter((o) => !o.muet && (indisponibles.includes(o.id) || !sfxInfo(o.son)));
  if (!bloquants.length && !silencieux.length) return null;
  return (
    <section aria-label="Effets sonores à vérifier" className="rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-sm text-black">
      {bloquants.length ? <>
        <p className="font-semibold">⚠️ {bloquants.length} effet{bloquants.length > 1 ? "s" : ""} sonore{bloquants.length > 1 ? "s" : ""} impossible{bloquants.length > 1 ? "s" : ""} à rendre (fichier manquant ou illisible)</p>
        <ul className="mt-2 space-y-1">{bloquants.map((o) => <li key={o.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 truncate">« {o.son} »</span>
          <button type="button" className="btn-ghost min-h-10 text-xs" disabled={disabled} onClick={() => onReplace(o.id)}>Remplacer</button>
          <button type="button" className="btn-ghost min-h-10 text-xs" disabled={disabled} onClick={() => onChange(supprimerSon(edit, o.id))}>Supprimer</button></li>)}</ul>
        <button type="button" className="btn-ghost mt-2 min-h-10 text-xs" disabled={disabled} onClick={() => onChange(bloquants.reduce((e, o) => modifierSon(e, o.id, { muet: true }), edit))}>Continuer sans ces effets (ils passent en muet)</button>
      </> : null}
      {silencieux.length ? <p className="mt-2 text-xs">{silencieux.length} effet{silencieux.length > 1 ? "s" : ""} ne sonnera pas (animation supprimée ou passage coupé). Tu peux les supprimer dans « Sons de la vidéo ».</p> : null}
    </section>
  );
}


/** Vérifie en arrière-plan que les fichiers des effets sont accessibles ; ne rend rien. */
export function SonsVerification({ edit, onResult }: { edit: Edit | null; onResult: (ids: string[]) => void }) {
  const { ids, checking } = useSonsIndisponibles(edit);
  const key = ids.join(",");
  useEffect(() => { if (!checking) onResult(key ? key.split(",") : []); }, [key, checking, onResult]);
  return null;
}
