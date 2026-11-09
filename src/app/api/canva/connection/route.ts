import { guardedCanva } from "@/server/canva/http";
import { view } from "@/server/canva/service";

/** État de la connexion Canva (jamais les jetons). */
export function GET() {
  return guardedCanva("content:edit", async ({ deps }) => view(deps, await deps.store.get()));
}

/** Déconnexion : les jetons sont supprimés du serveur. */
export function DELETE() {
  return guardedCanva("integrations:manage", async ({ deps }) => { await deps.store.remove(); return view(deps, null); });
}
