// Bibliothèque des 5 templates visuels sociaux (§48-63 + refonte structurée validée 2026-09-13).
// GÉNÉRATION DÉTERMINISTE, testable. BeeMarketing sépare LE LAYOUT (structure du template, ici) de
// L'IMAGE (fond/photo dépendant du contexte — médiathèque priorisée, IA en dernier recours) : la
// COHÉRENCE vient du DESIGN (mémoire de style), la VARIÉTÉ vient des PHOTOS RÉELLES et du contexte
// (club, ville, type d'événement) — jamais deux visuels identiques.
//
// §55 : l'IA ne génère QUE le fond/photo (`aiPrompt`) — jamais logo/texte/date/CTA, composés
// déterministiquement (`overlay`) et injectés depuis la médiathèque (`logoSlots`).
// §3 : aucune donnée inventée → un champ manquant reste un placeholder ⟨champ⟩ et est listé dans
// `missing` (jamais complété par une hypothèse). Aucun lieu (MOMA…) n'est codé en dur.

export type Palette = { primary: string; secondary: string; black: string; white: string };
export type StyleMemory = {
  palette: Palette;
  typography: string;
  tone: string;
  signature: string | null;      // ex. « BeeRecos — le réseau qui fait grandir »
  defaultHashtags: string[];
  motifs: string;
  notes: string | null;
};

// Défauts SOURCÉS de beerecos-knowledge/brand.md (charte validée, violet retiré) — pas d'invention.
export const DEFAULT_STYLE_MEMORY: StyleMemory = {
  palette: { primary: "#2851FF", secondary: "#3BCAC2", black: "#000000", white: "#FFFFFF" },
  typography: "Poppins",
  tone: "premium, business, élégant, impactant, mobile-first, peu de texte",
  signature: null,
  defaultHashtags: ["#BeeRecos", "#BusinessClub", "#Reseau"],
  motifs: "hexagone / alvéoles, réseau et mise en relation ; jamais de violet",
  notes: null,
};

// ------------------------------------------------------------------ Clés canoniques (5)
export type SocialTemplateType =
  | "club_event"        // T1 — Événement / Réunion de club (carrousel 5)
  | "why_join"          // T2 — Pourquoi rejoindre ? (carrousel 5)
  | "club_life"         // T3 — Actualité / Vie du club (carrousel 5, photos RÉELLES prioritaires)
  | "special_event"     // T4 — Événement spécial (visuel unique)
  | "member_spotlight"; // T5 — Membre à l'honneur (visuel unique 4:5)

export type TemplateFormat = "carousel" | "single";

// Stratégie photo par slide — pilote la médiathèque (Lot 2) et l'autorisation du fallback IA.
export type PhotoStrategy =
  | "real_required"   // photo réelle exigée (ex. vie du club) — IA seulement en dépannage explicite
  | "real_preferred"  // photo réelle préférée, IA acceptée en fallback
  | "portrait_required" // portrait réel du membre exigé
  | "ai_ok";          // fond IA acceptable (slides d'accroche/bénéfices abstraits)

// Slots de logos dynamiques — jamais cuits dans l'image (§55), injectés depuis la médiathèque.
export type LogoSlot = "logo_beerecos" | "logo_club" | "logo_partenaire" | "logo_lieu" | "logo_evenement";

export type ClubData = { name?: string; city?: string; link?: string; local_info?: string };
export type EventData = { name?: string; date?: string; time?: string; location?: string; address?: string; city?: string; url?: string; event_type?: string; club?: string; theme?: string };
export type MemberData = { first_name?: string; last_name?: string; company?: string; profession?: string; club?: string; quote?: string };
export type TemplateData = { club?: ClubData; event?: EventData; member?: MemberData };

export type Overlay = { role: string; text: string };
export type VisualBrief = {
  ratio: string;              // ratio de composition ("4:5" feed par défaut)
  photoStrategy: PhotoStrategy;
  aiPrompt: string;           // FOND/PHOTO uniquement (OpenAI), sans texte/logo/date/CTA — §55 (fallback)
  overlay: Overlay[];         // éléments composés déterministiquement — §56
  logoSlots: LogoSlot[];      // logos à injecter (0..N) depuis la médiathèque
  logo: string;               // consigne logo (zone de sécurité)
};
export type Slide = { index: number; role: string; headline: string; lines: string[]; visual: VisualBrief };
export type BuiltTemplate = {
  type: SocialTemplateType;
  label: string;
  format: TemplateFormat;
  defaultRatio: string;
  ratios: string[];           // ratios d'export proposés
  slides: Slide[];
  caption: string;
  cta: string;
  hashtags: string[];
  missing: string[];
};

export const TEMPLATE_LABELS: Record<SocialTemplateType, string> = {
  club_event: "Événement / Réunion club",
  why_join: "Pourquoi rejoindre ?",
  club_life: "Actualité / Vie du club",
  special_event: "Événement spécial",
  member_spotlight: "Membre à l'honneur",
};

// Ratios d'export (respecter le ratio, jamais « 4K » comme une seule dimension) — §exports.
export const EXPORT_RATIOS: Record<string, { label: string; w: number; h: number }> = {
  "4:5":  { label: "Instagram 1080×1350", w: 1080, h: 1350 },
  "4:5hd": { label: "HD 2160×2700", w: 2160, h: 2700 },
  "4:5uhd": { label: "Très haute déf 4320×5400", w: 4320, h: 5400 },
  "9:16": { label: "Story 1080×1920", w: 1080, h: 1920 },
  "1:1":  { label: "Carré 1080×1080", w: 1080, h: 1080 },
};

// Catalogue métadonnées — source de vérité du SEED (migration 0038) et des cartes UX + routage Bee.
export type VisualTemplateMeta = {
  key: SocialTemplateType;
  label: string;
  objective: string;
  category: string;
  format: TemplateFormat;
  slideCount: number;
  defaultRatio: string;
  ratios: string[];
  photoStrategy: PhotoStrategy;
};

export const SOCIAL_VISUAL_TEMPLATES: VisualTemplateMeta[] = [
  { key: "club_event", label: TEMPLATE_LABELS.club_event, objective: "Remplir une réunion / un événement de club (invités qualifiés).", category: "social-club-event", format: "carousel", slideCount: 5, defaultRatio: "4:5", ratios: ["4:5", "4:5hd", "9:16"], photoStrategy: "real_preferred" },
  { key: "why_join", label: TEMPLATE_LABELS.why_join, objective: "Acquisition : donner envie de rejoindre le réseau BeeRecos.", category: "social-acquisition", format: "carousel", slideCount: 5, defaultRatio: "4:5", ratios: ["4:5", "4:5hd"], photoStrategy: "ai_ok" },
  { key: "club_life", label: TEMPLATE_LABELS.club_life, objective: "Montrer la vie réelle du club (preuve sociale) — photos réelles.", category: "social-club-life", format: "carousel", slideCount: 5, defaultRatio: "4:5", ratios: ["4:5", "4:5hd"], photoStrategy: "real_required" },
  { key: "special_event", label: TEMPLATE_LABELS.special_event, objective: "Annoncer un événement spécial (BeeToBee, gala, national…).", category: "social-special-event", format: "single", slideCount: 1, defaultRatio: "4:5", ratios: ["4:5", "1:1", "9:16"], photoStrategy: "real_preferred" },
  { key: "member_spotlight", label: TEMPLATE_LABELS.member_spotlight, objective: "Mettre un membre à l'honneur (valorisation + preuve sociale).", category: "social-member-spotlight", format: "single", slideCount: 1, defaultRatio: "4:5", ratios: ["4:5", "1:1"], photoStrategy: "portrait_required" },
];

const LOGO_RULE = "Logo BeeRecos (symbole bleu) en respectant la zone de sécurité ; pas de contour, pas de rotation, pas d'ombre. Logos additionnels (club/partenaire/lieu) injectés depuis la médiathèque, jamais dessinés par l'IA.";

function fieldFactory(missing: string[]) {
  return (key: string, value: string | undefined | null): string => {
    const v = (value ?? "").toString().trim();
    if (v) return v;
    missing.push(key);
    return `⟨${key}⟩`;
  };
}

// Langage visuel (maquette validée Cédric 2026-09-13) : fond bleu nuit / near-black, photo réelle de
// networking ASSOMBRIE en arrière-plan, texte blanc, accent bleu électrique, rendu premium/cinématique.
const DESIGN_LANGUAGE = "fond bleu nuit (#0d1b2a) à near-black, photo de networking d'affaires assombrie et contrastée en arrière-plan, rendu premium/cinématique, accent bleu électrique";

// Fond IA (fallback §55) : couleurs de marque, aucun texte/logo, ratio explicite.
function bg(scene: string, m: StyleMemory, ratio = "4:5"): string {
  return `Fond ${scene}. Direction artistique : ${DESIGN_LANGUAGE}. Couleurs de marque UNIQUEMENT : bleu ${m.palette.primary}, turquoise ${m.palette.secondary}, noir, blanc — JAMAIS de violet. Motifs : ${m.motifs}. Style : ${m.tone}. AUCUN texte, AUCUN logo, AUCUNE date, AUCUN CTA dans l'image (ajoutés ensuite en composition). Format ${ratio}.`;
}

function hashtagsFor(m: StyleMemory, extra: string[] = []): string[] {
  return [...new Set([...m.defaultHashtags, ...extra])];
}

function caption(parts: { hook: string; message: string; benefits: string[]; infos: string[]; cta: string }, hashtags: string[], m: StyleMemory): string {
  const lines = [
    parts.hook,
    "",
    parts.message,
    ...(parts.benefits.length ? ["", ...parts.benefits.map((b) => `• ${b}`)] : []),
    ...(parts.infos.length ? ["", ...parts.infos] : []),
    "",
    parts.cta,
    ...(m.signature ? ["", m.signature] : []),
    "",
    hashtags.join(" "),
  ];
  return lines.join("\n");
}

// Fabrique de slide (réduit la répétition, garantit la présence des champs de schéma).
function slide(index: number, role: string, headline: string, lines: string[], visual: Partial<VisualBrief> & { aiPrompt: string; photoStrategy: PhotoStrategy }): Slide {
  return {
    index, role, headline, lines,
    visual: {
      ratio: visual.ratio ?? "4:5",
      photoStrategy: visual.photoStrategy,
      aiPrompt: visual.aiPrompt,
      overlay: visual.overlay ?? [],
      logoSlots: visual.logoSlots ?? ["logo_beerecos"],
      logo: visual.logo ?? LOGO_RULE,
    },
  };
}

// ------------------------------------------------------------------ Générateur principal
export function buildTemplate(type: SocialTemplateType, data: TemplateData, memory: StyleMemory = DEFAULT_STYLE_MEMORY): BuiltTemplate {
  const missing: string[] = [];
  const f = fieldFactory(missing);
  const meta = SOCIAL_VISUAL_TEMPLATES.find((t) => t.key === type)!;
  const base = { type, label: meta.label, format: meta.format, defaultRatio: meta.defaultRatio, ratios: meta.ratios, missing };

  // -------- T1 — Événement / Réunion de club (carrousel 5) — ordre maquette :
  // hook → infos pratiques → pourquoi venir → réseau qui fait avancer → CTA « Je m'inscris ».
  if (type === "club_event") {
    const club = f("club.name", data.club?.name ?? data.event?.club);
    const city = f("club.city", data.club?.city ?? data.event?.city);
    const ev = data.event ?? {};
    const date = f("event.date", ev.date); const time = f("event.time", ev.time);
    const loc = f("event.location", ev.location); const address = (ev.address ?? "").trim();
    const url = f("event.url", ev.url ?? data.club?.link);
    const cta = `Je m'inscris maintenant : ${url}`;
    const hashtags = hashtagsFor(memory, [`#${city.replace(/\s+/g, "")}`]);
    return {
      ...base, cta, hashtags,
      slides: [
        slide(1, "hook", "Et si on se rencontrait au prochain club ?", ["Des entrepreneurs qui avancent ensemble."], { photoStrategy: "real_preferred", aiPrompt: bg(`événement de networking d'affaires à ${city}, ambiance chaleureuse et professionnelle`, memory), overlay: [{ role: "hook", text: "Et si on se rencontrait au prochain CLUB ?" }, { role: "accent", text: "CLUB" }, { role: "subline", text: "Des entrepreneurs qui avancent ensemble." }], logoSlots: ["logo_beerecos", "logo_club"] }),
        slide(2, "infos", "Informations pratiques", [date, time, [loc, address].filter(Boolean).join(" · ")].filter(Boolean), { photoStrategy: "real_preferred", aiPrompt: bg("réunion d'affaires conviviale entre dirigeants, arrière-plan pour informations pratiques", memory), overlay: [{ role: "date", text: date }, { role: "time", text: time }, { role: "location", text: address ? `${loc} · ${address}` : loc }], logoSlots: ["logo_beerecos", "logo_lieu"] }),
        slide(3, "pourquoi", "Pourquoi venir ?", ["Rencontrer des dirigeants", "Échanger sur vos enjeux", "Créer des opportunités"], { photoStrategy: "ai_ok", aiPrompt: bg("sobre et premium, alvéoles de ruche stylisées, espace pour une liste à icônes", memory), overlay: [{ role: "reasons", text: "Rencontrer des dirigeants · Échanger sur vos enjeux · Créer des opportunités" }] }),
        slide(4, "reseau", "Un réseau qui fait avancer vos projets", ["Réseau", "Formation", "Digitalisation"], { photoStrategy: "real_preferred", aiPrompt: bg("dirigeants au travail, collaboration autour d'un écran, énergie positive", memory), overlay: [{ role: "pillars", text: "Réseau · Formation · Digitalisation" }] }),
        slide(5, "cta", "On vous attend !", [cta], { photoStrategy: "ai_ok", aiPrompt: bg("appel à l'action premium, espace pour un bouton bleu et un lien", memory), overlay: [{ role: "cta", text: "Je m'inscris maintenant" }, { role: "link", text: url }], logoSlots: ["logo_beerecos", "logo_club"] }),
      ],
      caption: caption({ hook: `🤝 Prochaine réunion de ${club} à ${city}`, message: "Deux heures pour rencontrer des dirigeants, échanger sur vos enjeux et créer des opportunités.", benefits: ["Réseau de dirigeants", "Formation", "Digitalisation"], infos: [`📅 ${date} · ${time}`, `📍 ${address ? `${loc} — ${address}` : loc}`], cta }, hashtags, memory),
    };
  }

  // -------- T2 — Pourquoi rejoindre ? (carrousel 5) — ordre maquette :
  // question → seul pour avancer → RÉSEAU → FORMATION → DIGITALISATION + CTA « Visitez un club ».
  if (type === "why_join") {
    const club = (data.club?.name ?? "").trim();
    const city = (data.club?.city ?? "").trim();
    const url = f("club.link", data.club?.link ?? data.event?.url);
    const cta = `Visitez un club : ${url}`;
    const hashtags = hashtagsFor(memory, city ? [`#${city.replace(/\s+/g, "")}`] : []);
    return {
      ...base, cta, hashtags,
      slides: [
        slide(1, "hook", "Votre réseau vous rapporte-t-il vraiment du business ?", [], { photoStrategy: "real_preferred", aiPrompt: bg("portrait de dirigeant confiant, regard vers l'objectif, ambiance premium", memory), overlay: [{ role: "hook", text: "Votre réseau vous rapporte-t-il vraiment du business ?" }] }),
        slide(2, "constat", "Trop souvent seul pour avancer", ["Manque de contacts, peu d'opportunités, difficile de trouver les bonnes personnes…"], { photoStrategy: "real_preferred", aiPrompt: bg("dirigeant pensif, atmosphère introspective mais élégante", memory), overlay: [{ role: "problem", text: "Manque de contacts, peu d'opportunités, difficile de trouver les bonnes personnes…" }] }),
        slide(3, "reseau", "Réseau", ["Rencontrez les bonnes personnes près de chez vous et au niveau national."], { photoStrategy: "ai_ok", aiPrompt: bg("networking d'affaires, poignée de main, mise en relation", memory), overlay: [{ role: "pillar", text: "RÉSEAU" }, { role: "detail", text: "Les bonnes personnes, près de chez vous et au national." }] }),
        slide(4, "formation", "Formation", ["Développez vos compétences grâce à des formations certifiées et concrètes."], { photoStrategy: "ai_ok", aiPrompt: bg("montée en compétence, atmosphère studieuse et moderne", memory), overlay: [{ role: "pillar", text: "FORMATION" }, { role: "detail", text: "Des formations certifiées et concrètes." }] }),
        slide(5, "digitalisation", "Digitalisation", ["Des outils innovants pour transformer votre réseau en opportunités.", cta], { photoStrategy: "ai_ok", aiPrompt: bg("outils digitaux et IA, transformation, données en croissance", memory), overlay: [{ role: "pillar", text: "DIGITALISATION" }, { role: "detail", text: "Des outils innovants qui transforment votre réseau en opportunités." }, { role: "cta", text: "Visitez un club" }, { role: "link", text: url }], logoSlots: ["logo_beerecos", "logo_club"] }),
      ],
      caption: caption({ hook: `✨ Pourquoi rejoindre ${club || "un Business Club BeeRecos"} ?`, message: "Un cercle de dirigeants pour développer votre activité par le réseau, la formation et le digital.", benefits: ["Réseau : les bonnes personnes, local + national", "Formation certifiée et concrète", "Digitalisation : des outils qui transforment votre réseau"], infos: [], cta }, hashtags, memory),
    };
  }

  // -------- T3 — Actualité / Vie du club (carrousel 5, PHOTOS RÉELLES) — wording maquette.
  if (type === "club_life") {
    const club = f("club.name", data.club?.name);
    const city = (data.club?.city ?? "").trim();
    const url = f("club.link", data.club?.link ?? data.event?.url);
    const cta = `Rejoignez-nous : ${url}`;
    const hashtags = hashtagsFor(memory, city ? [`#${city.replace(/\s+/g, "")}`, "#VieDuClub"] : ["#VieDuClub"]);
    const realPhoto = (moment: string) => bg(`PHOTO RÉELLE PRIORITAIRE du club (${moment}). Si aucune photo réelle n'est disponible : fond abstrait aux couleurs de marque (ne PAS simuler de vrais visages)`, memory);
    return {
      ...base, cta, hashtags,
      slides: [
        slide(1, "hook", "Retour sur notre dernière réunion !", ["Des échanges enrichissants et des rencontres inspirantes."], { photoStrategy: "real_required", aiPrompt: realPhoto("photo d'ambiance de la dernière réunion"), overlay: [{ role: "hook", text: "Retour sur notre dernière réunion !" }, { role: "subline", text: "Des échanges enrichissants et des rencontres inspirantes." }], logoSlots: ["logo_beerecos", "logo_club"] }),
        slide(2, "moment", "Des échanges concrets", ["Des métiers variés, des expertises partagées et des opportunités réelles."], { photoStrategy: "real_required", aiPrompt: realPhoto("membres en train d'échanger, discussions d'affaires"), overlay: [{ role: "caption", text: "Des métiers variés, des expertises partagées et des opportunités réelles." }] }),
        slide(3, "moment", "Une ambiance unique", ["Business, convivialité et bonne humeur !"], { photoStrategy: "real_required", aiPrompt: realPhoto("présentation d'un membre devant le groupe, ambiance conviviale"), overlay: [{ role: "caption", text: "Business, convivialité et bonne humeur !" }] }),
        slide(4, "moment", "Merci à tous nos membres et invités !", ["Vous faites vivre le club."], { photoStrategy: "real_required", aiPrompt: realPhoto("photo de groupe conviviale"), overlay: [{ role: "caption", text: "Vous faites vivre le club." }], logoSlots: ["logo_beerecos", "logo_club"] }),
        slide(5, "cta", "Envie de vivre la prochaine ?", [cta], { photoStrategy: "ai_ok", aiPrompt: bg("invitation chaleureuse, espace pour un bouton bleu et un lien", memory), overlay: [{ role: "cta", text: "Rejoignez-nous" }, { role: "link", text: url }], logoSlots: ["logo_beerecos", "logo_club"] }),
      ],
      caption: caption({ hook: `📸 Retour en images sur la vie de ${club}`, message: "Des échanges concrets, une ambiance unique et une vraie dynamique de dirigeants. La preuve en images.", benefits: [], infos: [], cta }, hashtags, memory),
    };
  }

  // -------- T4 — Événement spécial (visuel unique) — maquette : titre événement + zone + date/lieu +
  // baseline « Rencontrez. Échangez. Développez. » + tagline manuscrite.
  if (type === "special_event") {
    const ev = data.event ?? {};
    const name = f("event.name", ev.name); const date = f("event.date", ev.date);
    const time = f("event.time", ev.time); const loc = f("event.location", ev.location);
    const address = (ev.address ?? "").trim();
    const zone = (ev.theme ?? ev.city ?? "").trim(); // ex. « Pays Basque × Sud Landes »
    const url = f("event.url", ev.url);
    const cta = `Inscription : ${url}`;
    const hashtags = hashtagsFor(memory, ["#Evenement"]);
    return {
      ...base, cta, hashtags,
      slides: [
        slide(1, "affiche", name, [zone, `${date} · ${time}`, address ? `${loc} — ${address}` : loc, cta].filter(Boolean), {
          ratio: "4:5", photoStrategy: "real_preferred",
          aiPrompt: bg(`événement spécial premium « ${name} », ambiance haut de gamme et soignée`, memory),
          overlay: [
            { role: "hook", text: name },
            ...(zone ? [{ role: "zone", text: zone }] : []),
            { role: "date", text: `${date} · ${time}` },
            { role: "location", text: address ? `${loc} — ${address}` : loc },
            { role: "baseline", text: "Rencontrez. Échangez. Développez." },
            { role: "tagline_manuscrite", text: "Plus qu'un réseau, une dynamique." },
            { role: "cta", text: "Je m'inscris" }, { role: "link", text: url },
          ],
          logoSlots: ["logo_beerecos", "logo_evenement", "logo_partenaire", "logo_lieu"],
        }),
      ],
      caption: caption({ hook: `✨ ${name}${zone ? ` — ${zone}` : ""}`, message: "Rencontrez. Échangez. Développez. Plus qu'un réseau, une dynamique.", benefits: [], infos: [`📅 ${date} · ${time}`, `📍 ${address ? `${loc} — ${address}` : loc}`], cta }, hashtags, memory),
    };
  }

  // -------- T5 — Membre à l'honneur (visuel unique 4:5) — maquette : label + portrait + identité +
  // citation + CTA « Découvrir le club » + tagline manuscrite.
  const mb = data.member ?? {};
  const first = f("member.first_name", mb.first_name); const last = f("member.last_name", mb.last_name);
  const company = f("member.company", mb.company); const profession = f("member.profession", mb.profession);
  const club = f("member.club", mb.club ?? data.club?.name);
  const link = (data.club?.link ?? "").trim();
  const quote = (mb.quote ?? "").trim();
  const cta = `Vous souhaitez le rencontrer ? Venez visiter son club.`;
  const hashtags = hashtagsFor(memory, ["#MembreALHonneur"]);
  return {
    ...base, cta, hashtags,
    slides: [
      slide(1, "portrait", `${first} ${last}`, [`${profession} — ${company}`, club, quote].filter(Boolean), {
        ratio: "4:5", photoStrategy: "portrait_required",
        aiPrompt: bg("cadre portrait premium (LA PHOTO RÉELLE DU MEMBRE sera intégrée en composition ; ne PAS inventer de visage), fond élégant aux couleurs de marque", memory),
        overlay: [
          { role: "label", text: "Membre à l'honneur" },
          { role: "name", text: `${first} ${last}` },
          { role: "profession", text: `${profession} — ${company}` },
          { role: "club", text: club },
          ...(quote ? [{ role: "quote", text: `« ${quote} »` }] : []),
          { role: "cta", text: "Découvrir le club" },
          ...(link ? [{ role: "link", text: link }] : []),
          { role: "tagline_manuscrite", text: "Des entrepreneurs qui font bouger les territoires." },
        ],
        logoSlots: ["logo_beerecos", "logo_club"],
      }),
    ],
    caption: caption({ hook: `👤 Membre à l'honneur : ${first} ${last}`, message: `${profession} — ${company}. Membre de ${club}.${quote ? ` « ${quote} »` : ""}`, benefits: [], infos: [], cta }, hashtags, memory),
  };
}
