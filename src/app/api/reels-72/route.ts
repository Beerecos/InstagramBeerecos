import structure from "../../../../content/reels-72/BeeRecos_72_Reels_Structure.json";

/**
 * Structure des 72 réels versionnée dans le dépôt (content/reels-72), servie à l'utilisateur connecté (proxy) pour
 * l'import idempotent de la fonction serveur `montage` (`reels-import`). Contenu éditorial, aucune donnée personnelle.
 */
export function GET() {
  return new Response(JSON.stringify(structure), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, max-age=0" } });
}
