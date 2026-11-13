#!/usr/bin/env node
/**
 * Import de SFX Kit (Wyzowl, CC0-1.0) dans le Studio — 2026-11-12.
 *
 *   git clone https://github.com/wyzowl/sfx-kit.git /chemin/sfx-kit && git -C /chemin/sfx-kit checkout v1.0.0
 *   node automation/bin/import-sfx-kit.mjs /chemin/sfx-kit
 *
 * - Version épinglée (SFX_KIT_COMMIT) : le script refuse un autre commit.
 * - Chaque WAV est vérifié contre son sha256 du catalogue, puis converti en FLAC 16 bits 48 kHz (sans perte de
 *   placement : FLAC n'ajoute aucun retard au début, contrairement au MP3) dans public/hyperframes/sfx-kit/.
 *   L'aperçu (navigateur) et le rendu (serveur → ZIP Hyperframes) lisent les mêmes fichiers.
 * - Écrit le catalogue du panneau (public/hyperframes/sfx-kit/catalogue.json, chargé à l'ouverture du panneau) et les
 *   données de placement du moteur (src/domain/social/montage/sfx-kit-data.ts), avec la provenance et la licence.
 * Nécessite ffmpeg.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SFX_KIT_VERSION = "1.0.0";
export const SFX_KIT_COMMIT = "71815349a59fd9aa157fd61fedb2ae8482c96f39";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const src = resolve(process.argv[2] ?? "");
if (!process.argv[2]) { console.error("Usage : node automation/bin/import-sfx-kit.mjs <clone de wyzowl/sfx-kit>"); process.exit(2); }
const commit = execFileSync("git", ["-C", src, "rev-parse", "HEAD"]).toString().trim();
if (commit !== SFX_KIT_COMMIT) { console.error(`Commit ${commit} : attendu ${SFX_KIT_COMMIT} (v${SFX_KIT_VERSION}). Faites « git checkout v${SFX_KIT_VERSION} ».`); process.exit(1); }
const kit = JSON.parse(readFileSync(join(src, "sounds.json"), "utf8"));
if (kit.version !== SFX_KIT_VERSION || kit.license !== "CC0-1.0") { console.error(`Catalogue inattendu : version ${kit.version}, licence ${kit.license}.`); process.exit(1); }

// ---------------------------------------------------------------------------------------------- Français
const CATEGORY_FR = {
  whooshes: ["Whoosh", "Mouvements, glissements, vols et transitions", "souffle mouvement glissement transition passage"],
  "swishes-and-zips": ["Swish et zip", "Mouvements vifs : coups secs, coupes, éléments qui filent", "coup vif rapide fouet flèche trait"],
  swipes: ["Balayage du doigt", "Doigt qui glisse sur un écran : démo d'appli, cartes, carrousels", "balayage doigt écran glisser appli carrousel"],
  "reverse-whooshes": ["Whoosh inversé", "Air aspiré jusqu'à l'arrêt : ce qui se resserre, montée vers une coupe", "aspiration inversé coupe transition"],
  "risers-and-fallers": ["Montée et descente", "Tension avant une révélation, chute ou départ", "montée tension suspense révélation descente chute"],
  "bounce-spin-zoom": ["Rebond, rotation, zoom", "Rebonds, ressorts, rotations et zooms", "rebond ressort rotation tourner zoom"],
  impacts: ["Impact", "Objets qui atterrissent, se heurtent, frappent", "impact choc frappe atterrissage coup"],
  "cinematic-hits": ["Frappe cinéma", "Grosses frappes graves : titres, bandes-annonces, moments forts", "cinéma frappe titre bande-annonce dramatique"],
  "booms-and-bass": ["Boom et basse", "Booms graves, chutes de basse, 808 et grondements", "boom basse grave grondement révélation"],
  pops: ["Pop", "Éléments qui apparaissent, grandissent, éclatent", "pop apparition bulle texte titre"],
  "appear-and-vanish": ["Apparition et disparition", "Disparitions, fondus, matérialisations, cartes retournées", "apparition disparition magie fondu retourner carte"],
  "shape-changes": ["Changement de forme", "Formes et icônes qui grandissent, rétrécissent, se transforment", "forme grandir rétrécir transformer remplir"],
  interface: ["Interface", "Clics, tapotements, interrupteurs, déclics", "clic bouton interface tap interrupteur survol"],
  keyboard: ["Clavier", "Frappe, touches et saisie", "clavier frappe saisie taper touche écrire"],
  "writing-and-drawing": ["Écriture et dessin", "Stylo, crayon, feutre, craie : écrire, dessiner, cocher", "écriture stylo crayon feutre craie dessin coche surligner"],
  phone: ["Téléphone", "Vibrations, sonneries, numérotation", "téléphone vibreur sonnerie appel"],
  mechanical: ["Mécanique", "Serrures, loquets, interrupteurs, obturateurs", "mécanique serrure loquet interrupteur obturateur"],
  foley: ["Bruitage matière", "Papier, carton, tissu, plastique, verre et bois manipulés", "papier carton tissu plastique verre bois matière"],
  "everyday-props": ["Objet du quotidien", "Pages, livres, ciseaux, scotch, boîtes, sonnettes, eau", "page livre ciseaux scotch boîte sonnette eau"],
  notifications: ["Notification", "Réussite, échec, erreur, alerte, message", "notification réussite succès erreur alerte message"],
  tones: ["Ton", "Notes seules : un ding pour souligner, des marches pour une liste", "ding note ton liste étape souligner chiffre"],
  shimmers: ["Scintillement", "Mises en valeur, étincelles, révélations positives", "scintillement étincelle brillance mise en valeur"],
  "logo-stings": ["Signature logo", "Courtes signatures pour logo, carte de fin, titre", "logo signature fin marque jingle"],
  celebration: ["Célébration", "Applaudissements, cotillons, confettis, feux d'artifice", "célébration applaudissements fête confettis victoire"],
  time: ["Temps", "Horloges, alarmes, minuteurs, chronomètres, comptes à rebours", "temps horloge alarme minuteur chrono compte à rebours"],
  money: ["Argent", "Pièces, caisse, paiement par carte, billets", "argent pièce caisse paiement prix carte"],
  digital: ["Numérique", "Scan, traitement, bugs, parasites, sécurité", "numérique scan données ia bug sécurité"],
  data: ["Données", "Compteurs, progression, barres, graphiques, chiffres", "données chiffre compteur graphique barre progression"],
};
const WORD_FR = {
  fast: "rapide", medium: "moyen", slow: "lent", soft: "doux", hard: "fort", firm: "ferme", strong: "puissant", subtle: "subtil", clear: "net", big: "gros", massive: "massif",
  short: "court", long: "long", "1s": "1 s", "2s": "2 s", "4s": "4 s", rise: "montée", fall: "chute",
  light: "léger", heavy: "lourd", deep: "profond", small: "petit", large: "grand", high: "aigu", low: "grave", mid: "médium",
  in: "entrée", out: "sortie", bubble: "bulle", swish: "swish", "zip-in": "zip d'entrée", "zip-out": "zip de sortie",
  alert: "alerte", attention: "attention", blip: "bip", button: "bouton", clap: "clap", clip: "clip", ding: "ding", drop: "chute", drum: "tambour", error: "erreur", glitch: "bug",
  hit: "frappe", hover: "survol", latch: "loquet", "message-in": "message reçu", "message-out": "message envoyé", metal: "métal", mouse: "souris", process: "traitement",
  rocker: "bascule", scan: "scan", slam: "claquement", snap: "déclic", step: "marche", success: "réussite", tap: "tapotement", thunder: "tonnerre", toggle: "interrupteur",
  "toggle-off": "désactivation", "toggle-on": "activation", alarm: "alarme", "applause-big": "applaudissements, foule", "applause-small": "applaudissements, quelques personnes",
  bar: "barre qui monte", "book-close": "livre qui se ferme", bounce: "rebond", "box-open": "boîte qui s'ouvre", burst: "éclat", "card-tap": "paiement sans contact", chart: "graphique qui apparaît",
  clock: "horloge", "clock-fast": "tic-tac rapide", "coin-drop": "pièce qui tombe", "coin-spin": "pièce qui tourne", "coin-stack": "pièces empilées", "coins-pour": "pluie de pièces",
  confetti: "confettis", countdown: "compte à rebours 3-2-1", countup: "compteur qui monte", decrease: "compteur qui descend", deflate: "dégonflage", dissolve: "fondu", doorbell: "sonnette",
  drip: "gouttes", empty: "vidage", fill: "remplissage", fireworks: "feu d'artifice", "flip-quick": "retournement rapide", "flip-slow": "retournement lent", grow: "agrandissement",
  inflate: "gonflage", keypad: "clavier téléphonique", land: "chiffre qui atterrit", materialise: "matérialisation", morph: "transformation", notes: "billets comptés", "page-turn": "page tournée",
  poof: "pouf", popper: "cotillon", progress: "progression", register: "caisse enregistreuse", "ring-classic": "sonnerie classique", "ring-modern": "sonnerie", scissors: "ciseaux",
  "shop-bell": "clochette de boutique", shrink: "rétrécissement", spin: "rotation", splash: "éclaboussure", spring: "ressort", stopwatch: "chronomètre", stretch: "étirement", tape: "scotch",
  tick: "tic", timer: "minuteur terminé", "vibrate-hand": "vibreur en main", "vibrate-table": "vibreur sur table", zip: "fermeture éclair", "zoom-in": "zoom avant", "zoom-out": "zoom arrière",
  "808": "basse 808", rumble: "grondement", "sub-drop": "chute de basse", letter: "touche lettre", return: "touche Entrée", space: "barre d'espace", quick: "rapide", steady: "régulière",
  chalk: "craie", marker: "feutre", pen: "stylo", pencil: "crayon", draw: "dessin", slide: "glissé", touch: "touché", write: "écriture", eraser: "gomme", highlighter: "surligneur",
  scribble: "gribouillis", wipe: "effacement", lock: "serrure", ratchet: "cliquet", shutter: "obturateur", slider: "curseur", switch: "interrupteur", card: "carton", fabric: "tissu",
  glass: "verre", paper: "papier", plastic: "plastique", wood: "bois", failure: "échec", chime: "carillon", "ding-ding": "ding-ding", fanfare: "fanfare", flourish: "envolée", knock: "toc",
  minor: "mineur", pluck: "pincé", sparkle: "étincelle", thud: "bruit sourd", warm: "chaleureux", wobble: "vacillement", airy: "aérien", bold: "affirmé", bright: "lumineux",
  minimal: "minimal", playful: "joueur", tech: "tech", breach: "intrusion", corrupt: "données corrompues", decrypt: "déchiffrement", denied: "accès refusé", hacker: "hacker",
  interference: "interférence", "power-down": "extinction", "power-up": "allumage", radio: "radio", scramble: "brouillage", "signal-drop": "perte de signal", static: "neige TV",
  "1": "1", "2": "2", "3": "3", "4": "4", "5": "5",
};
const fr = (v) => WORD_FR[v] ?? v.replace(/-/g, " ");
const nameFr = (s) => `${CATEGORY_FR[s.category][0]} · ${Object.values(s.variant).map(fr).join(", ")}`;

// Filtres du panneau : un son peut appartenir à plusieurs.
const FILTERS = {
  textes: ["pops", "appear-and-vanish", "keyboard", "writing-and-drawing", "tones"],
  mouvements: ["whooshes", "swishes-and-zips", "swipes", "bounce-spin-zoom", "shape-changes"],
  transitions: ["whooshes", "reverse-whooshes", "risers-and-fallers", "swishes-and-zips"],
  impacts: ["impacts", "cinematic-hits", "booms-and-bass"],
  notifications: ["notifications", "interface", "phone", "data"],
  logos: ["logo-stings", "shimmers"],
};

// « Essentiels » : sons du guide d'intégration (GUIDE.md, tableau « On screen ») utiles à un Reel professionnel.
const ESSENTIELS = [
  "pop-small-in", "pop-medium-in", "pop-small-out", "appear-materialise", "tone-step-1", "tone-step-2", "tone-step-3", "tone-ding-mid",
  "whoosh-fast-soft", "whoosh-medium-soft", "whoosh-slow-soft", "whoosh-slow-medium", "swish-medium", "zip-in-medium", "reverse-whoosh-short-soft",
  "move-zoom-in", "move-zoom-out", "move-bounce", "transform-grow", "appear-flip-quick",
  "impact-light-firm", "impact-light-soft", "impact-medium-soft", "cinematic-drum-big", "boom-hit-medium",
  "riser-1s-soft", "riser-2s-soft", "shimmer-short-soft", "shimmer-medium-bright",
  "click-button-medium", "click-tap-medium", "click-toggle-on-medium", "keyboard-typing-steady-medium", "writing-pen-tick",
  "notification-success-soft", "notification-message-in-soft", "data-countup-medium", "data-number-land", "money-register",
  "sting-warm-short", "sting-bright-long", "celebration-popper",
];

// ---------------------------------------------------------------------------------------------- Import
const outDir = join(root, "public/hyperframes/sfx-kit");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const ids = new Set(kit.sounds.map((s) => s.id));
for (const id of ESSENTIELS) if (!ids.has(id)) { console.error(`Essentiel absent du catalogue : ${id}`); process.exit(1); }
for (const c of kit.categories) if (!CATEGORY_FR[c.id]) { console.error(`Catégorie sans traduction : ${c.id}`); process.exit(1); }

const panel = [];
const engine = {};
let bytes = 0;
for (const s of kit.sounds) {
  const wav = join(src, s.file);
  const sha = createHash("sha256").update(readFileSync(wav)).digest("hex");
  if (sha !== s.sha256) { console.error(`Empreinte différente pour ${s.id} : fichier modifié ou corrompu.`); process.exit(1); }
  if (s.file !== `sounds/${s.category}/${s.id}.wav`) { console.error(`Chemin inattendu pour ${s.id} : ${s.file}`); process.exit(1); }
  const rel = `sfx-kit/${s.category}/${s.id}.flac`;
  mkdirSync(join(outDir, s.category), { recursive: true });
  // Trames de 576 échantillons : avec la taille par défaut, un son de moins d'une trame (clic, pop) devient illisible
  // dès que le moteur de rendu se place au début du fichier (ffmpeg -ss 0 -t … : 0 échantillon, son muet au rendu).
  const out = join(root, "public/hyperframes", rel);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", wav, "-map_metadata", "-1", "-c:a", "flac", "-sample_fmt", "s16", "-ar", "48000", "-frame_size", "576", out]);
  // Contrôle : la lecture faite par le rendu (même commande que Hyperframes) rend bien tout le son.
  const pcm = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", "0", "-t", String(s.duration), "-i", out, "-ac", "1", "-f", "s16le", "-"]);
  const samples = pcm.length / 2, expected = Math.round(s.duration * 48000);
  if (Math.abs(samples - expected) > 48) { console.error(`${s.id} : ${samples} échantillons lus au lieu de ${expected}.`); process.exit(1); }
  bytes += statSync(out).size;
  const filters = Object.entries(FILTERS).filter(([, cats]) => cats.includes(s.category)).map(([k]) => k);
  panel.push({
    id: s.id, nom: nameFr(s), name: s.name, categorie: s.category, filtres: filters, duree: s.duration,
    motsCles: [CATEGORY_FR[s.category][2], ...Object.values(s.variant).map(fr), ...s.tags].join(" "),
    description: s.description, usage: s.use_for, eviter: s.avoid_for, synchro: s.sync.how, essentiel: ESSENTIELS.includes(s.id),
  });
  // Moteur : durée, point de synchro, corps du son (début / fin, pour l'atténuation sous la voix) et atténuation.
  engine[s.id] = [s.category, s.duration, s.sync.at, s.timing.onset, s.timing.body_end, s.under_voiceover_db];
}

const provenance = { source: "https://github.com/wyzowl/sfx-kit", version: SFX_KIT_VERSION, commit: SFX_KIT_COMMIT, licence: kit.license, credit: kit.credit, sons: kit.sounds.length, format: "FLAC 16 bits 48 kHz, trames de 576 échantillons (converti des WAV 24 bits d'origine, sha256 vérifiés ; lecture complète contrôlée)", importeLe: new Date().toISOString().slice(0, 10) };
writeFileSync(join(outDir, "catalogue.json"), JSON.stringify({ ...provenance, categories: kit.categories.map((c) => ({ id: c.id, nom: CATEGORY_FR[c.id][0], description: CATEGORY_FR[c.id][1] })), filtres: Object.keys(FILTERS), sons: panel }));
copyFileSync(join(src, "LICENSE"), join(outDir, "LICENSE"));
writeFileSync(join(outDir, "PROVENANCE.md"), `# SFX Kit (Wyzowl) — provenance\n\n- Source : ${provenance.source}\n- Version : v${SFX_KIT_VERSION} (commit ${SFX_KIT_COMMIT})\n- Licence : ${kit.license} (voir LICENSE). Crédit facultatif : ${kit.credit}\n- Sons importés : ${kit.sounds.length} (identifiants stables = noms de fichiers)\n- Format : ${provenance.format}\n- Import : \`node automation/bin/import-sfx-kit.mjs <clone>\`\n`);
const ts = `// Généré par automation/bin/import-sfx-kit.mjs — ne pas modifier à la main.
// SFX Kit (Wyzowl) v${SFX_KIT_VERSION}, commit ${SFX_KIT_COMMIT}, licence ${kit.license}. ${kit.sounds.length} sons.
// Par son : [catégorie, durée (s), sync.at (s), timing.onset (s), timing.body_end (s), under_voiceover_db].
export const SFX_KIT_VERSION = "${SFX_KIT_VERSION}";
export const SFX_KIT_COMMIT = "${SFX_KIT_COMMIT}";
export const SFX_KIT_DATA: Record<string, readonly [string, number, number, number, number, number]> = ${JSON.stringify(engine)};
`;
writeFileSync(join(root, "src/domain/social/montage/sfx-kit-data.ts"), ts);
console.log(`${kit.sounds.length} sons importés (v${SFX_KIT_VERSION}, ${SFX_KIT_COMMIT.slice(0, 7)}), ${(bytes / 1024 / 1024).toFixed(1)} Mo de FLAC.`);
