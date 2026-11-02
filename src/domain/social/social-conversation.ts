// Conversion sociale (commentaire → réponse → DM → lead) — LOGIQUE PURE, testable.
// Cerveau owned du tunnel Instagram/Meta (prompt maître §69-95). Aucun envoi ici : ce module
// DÉCIDE (mots-clés, localisation, état, message) ; l'Edge Function `meta-webhook` EXÉCUTERA
// (recevra les webhooks, enverra via l'API Meta) — gate fail-closed tant que l'app Meta n'est pas
// connectée. Réutilise le pipeline CRM existant (leads.status) plutôt que de le dupliquer.

// --- Mots-clés (§74-75) : insensible à la casse, aux accents et aux espaces multiples ---
export function normalizeKeyword(s: string | null | undefined): string {
  return (s ?? "")
    .trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export type CommentRuleMode = "keyword" | "all";

/** Retourne le mot-clé déclencheur trouvé (normalisé), ou null. mode 'all' → toujours déclenché. */
export function matchCommentKeyword(text: string, mode: CommentRuleMode, keywords: string[]): string | null {
  if (mode === "all") return "*";
  const hay = normalizeKeyword(text);
  if (!hay) return null;
  for (const kw of keywords) {
    const n = normalizeKeyword(kw);
    if (n && hay.includes(n)) return n;
  }
  return null;
}

// --- Localisation (§81-82) : « je suis à Anglet », « 64100 », « vers Biarritz », « Bidart » ---
const _PREP = "(?:a|à|sur|vers|dans|proche de|pres de|près de|habite a|habite à|travaille a|travaille à|situe a|situé à)";
const _CITY = "([A-Za-zÀ-ÿ][\\wÀ-ÿ'’\\-]+(?:[ \\-][A-Za-zÀ-ÿ][\\wÀ-ÿ'’\\-]+)?)";

export type ParsedLocation = { city: string | null; postalCode: string | null };

export function parseLocation(text: string): ParsedLocation {
  const raw = (text ?? "").trim();
  let postalCode: string | null = null;
  let city: string | null = null;

  const cp = raw.match(/\b(\d{5})\b/);
  if (cp) postalCode = cp[1];

  const prep = new RegExp(`${_PREP}\\s+${_CITY}`, "i").exec(raw);
  if (prep) {
    city = prep[1].trim();
  } else if (/^[A-Za-zÀ-ÿ][\wÀ-ÿ'’-]{2,}(?:[ -][A-Za-zÀ-ÿ][\wÀ-ÿ'’-]+)?$/.test(raw) && !/^\d+$/.test(raw)) {
    // message = juste un nom de ville (« Bayonne », « Anglet », « Saint-Jean »)
    city = raw;
  }
  return { city: city || null, postalCode };
}

// --- Machine à états (§80). État détaillé de la conversation sociale (distinct du lead). ---
export const SOCIAL_STATES = [
  "comment_received", "public_reply_sent", "dm_initial_sent", "dm_user_engaged",
  "qualification_started", "qualified", "club_proposed", "event_proposed",
  "registration_clicked", "registered", "phone_followup", "present", "member",
] as const;
export type SocialState = (typeof SOCIAL_STATES)[number];

export type SocialTrigger =
  | "public_reply" | "dm_sent" | "user_reply" | "start_qualif" | "location_given"
  | "club_chosen" | "event_sent" | "registration_click" | "registered"
  | "no_registration_48h" | "present" | "member";

const FLOW: Record<SocialState, Partial<Record<SocialTrigger, SocialState>>> = {
  comment_received: { public_reply: "public_reply_sent" },
  public_reply_sent: { dm_sent: "dm_initial_sent" },
  dm_initial_sent: { user_reply: "dm_user_engaged" },
  dm_user_engaged: { start_qualif: "qualification_started" },
  qualification_started: { location_given: "qualified" },
  qualified: { club_chosen: "club_proposed" },
  club_proposed: { event_sent: "event_proposed" },
  event_proposed: { registration_click: "registration_clicked", no_registration_48h: "phone_followup" },
  registration_clicked: { registered: "registered" },
  registered: { present: "present" },
  phone_followup: { registered: "registered" },
  present: { member: "member" },
  member: {},
};

/** Transition contrôlée : renvoie l'état suivant, ou l'état courant si la transition est invalide. */
export function nextSocialState(current: SocialState, trigger: SocialTrigger): SocialState {
  return FLOW[current]?.[trigger] ?? current;
}

// Jusqu'où le BOT peut avancer AUTOMATIQUEMENT (§95 human handover, closing=no_path). Au-delà
// d'"event_proposed", ce sont des faits externes (inscription/présence/adhésion BeeJoin) ou humains.
const BOT_AUTO_MAX_STATE: SocialState = "event_proposed";
const _ORDER = new Map(SOCIAL_STATES.map((s, i) => [s, i]));
export function botMayAutoAdvanceTo(state: SocialState): boolean {
  return (_ORDER.get(state) ?? 99) <= (_ORDER.get(BOT_AUTO_MAX_STATE) ?? 0);
}

// --- Correspondance état social → statut lead (réutilise le pipeline CRM, ne le duplique pas). ---
// null = ne change pas le statut du lead (les premiers échanges gardent le lead en l'état).
export function leadStatusForSocialState(state: SocialState): string | null {
  switch (state) {
    case "comment_received":
    case "public_reply_sent":
    case "dm_initial_sent": return null;
    case "dm_user_engaged":
    case "qualification_started": return "ENGAGED";
    case "qualified":
    case "club_proposed": return "INTERESTED";
    case "event_proposed": return "INVITED";
    case "registration_clicked": return "TO_CONFIRM";
    case "registered": return "CONFIRMED";
    case "phone_followup": return "TO_CALL";
    case "present": return "ATTENDED";
    case "member": return "MEMBER";
  }
}

// --- Messages (§77-78, §86) : variantes de réponse publique + 1er DM. Rotation anti-répétition. ---
export function fillVars(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null || v === "" ? `{{${k}}}` : String(v);
  });
}

const PUBLIC_REPLY_VARIANTS = [
  "Merci {{first_name}}, je vous envoie les informations en message privé.",
  "Avec plaisir {{first_name}} — regardez vos messages privés.",
  "Merci pour votre intérêt {{first_name}}, vous allez recevoir les informations en privé.",
];

/** Choisit une variante de façon déterministe (index tournant) pour éviter la répétition. */
export function pickReplyVariant(index: number, vars: Record<string, string | null | undefined> = {}): string {
  const tpl = PUBLIC_REPLY_VARIANTS[((index % PUBLIC_REPLY_VARIANTS.length) + PUBLIC_REPLY_VARIANTS.length) % PUBLIC_REPLY_VARIANTS.length];
  return fillVars(tpl, vars);
}

const FIRST_DM_TEMPLATE =
  "Bonjour {{first_name}}, merci pour votre commentaire. Vous souhaitez venir découvrir notre Business Club ?";

export function firstDm(vars: Record<string, string | null | undefined>): string {
  return fillVars(FIRST_DM_TEMPLATE, vars);
}
