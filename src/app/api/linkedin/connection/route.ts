import { guarded } from "@/server/instagram/http";
import { view } from "@/server/linkedin/service";
import { linkedinApp } from "@/server/linkedin/http";
import { linkedinStore } from "@/server/linkedin/store";

/** État de la connexion LinkedIn (jamais le jeton) et configuration de l'application. */
export function GET() {
  return guarded("integrations:manage", async () => {
    const app = linkedinApp();
    const conn = await linkedinStore().get().catch(() => null);
    return { ...view(conn, app.organizationUrn), appConfigured: Boolean(app.clientId && app.clientSecret) };
  });
}

export function DELETE() {
  return guarded("integrations:manage", async () => {
    await linkedinStore().remove();
    return { ...view(null, linkedinApp().organizationUrn), appConfigured: true };
  });
}
