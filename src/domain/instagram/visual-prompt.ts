/**
 * Images réalistes des carrousels (OpenAI Images). L'IA ne fabrique que la photo : jamais de texte, de logo,
 * de marque lisible ni de personne réelle identifiable ; titres, chiffres et logo officiel restent posés par la mise en page.
 * Une image générée est une illustration : jamais présentée comme une archive ou une photo réelle du produit.
 */
import { z } from "zod";

export const IMAGE_MODES = {
  scene: "Scène réaliste (lieu, personnes anonymes, ambiance)",
  produit: "Objet détouré (fond transparent, à poser sur la slide)",
} as const;
export type ImageMode = keyof typeof IMAGE_MODES;

export const ImageRequestSchema = z.object({
  description: z.string().trim().min(8, "Décris l'image en une phrase au moins.").max(600),
  subject: z.string().trim().max(200).default(""),
  mode: z.enum(["scene", "produit"]).default("scene"),
});
export type ImageRequest = z.input<typeof ImageRequestSchema>;

const RULES = [
  "Absolutely no text, letters, numbers, captions, signage, logos, brand names or watermarks anywhere in the image.",
  "Any person must be an anonymous, non-identifiable adult; never a real or famous person, never a specific real employee.",
  "Photorealistic only: no illustration, no cartoon, no 3D render look, no collage.",
].join(" ");

/** Consigne envoyée au modèle d'image (en anglais : rendu plus fiable). */
export function imagePrompt(req: z.output<typeof ImageRequestSchema>): string {
  const context = req.subject ? ` Story context: ${req.subject}.` : "";
  if (req.mode === "produit") {
    return `Photorealistic studio product photograph of a single object, shown whole and isolated on a fully transparent background, soft natural shadow, sharp details, high-end editorial look. Object: ${req.description}.${context} The object is generic (unbranded) and centered with margins. ${RULES}`;
  }
  return `Photorealistic editorial photograph, natural soft light, shallow depth of field, authentic and warm documentary style, vertical framing. Scene: ${req.description}.${context} Colors that sit well next to a bright blue (#2851FF), black and white layout. ${RULES}`;
}

/** Message lisible pour Cédric à partir d'une erreur OpenAI (clé, vérification du compte, quota, contenu refusé). */
export function imageError(status: number, raw: string): string {
  const text = raw.toLowerCase();
  if (status === 401) return "Clé OpenAI refusée : vérifie OPENAI_API_KEY sur Vercel.";
  if (status === 403 && text.includes("verif")) return "Compte OpenAI non vérifié : la génération d'images gpt-image demande de vérifier l'organisation sur platform.openai.com (Settings → Organization → Verify).";
  if (status === 429) return "Quota OpenAI atteint (crédit ou limite par minute) : réessaie dans un instant ou recharge le crédit.";
  if (status === 400 && (text.includes("safety") || text.includes("moderation"))) return "Image refusée par la modération OpenAI : reformule la description.";
  return `Génération d'image impossible (OpenAI ${status}).`;
}
