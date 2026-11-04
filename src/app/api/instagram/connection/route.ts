import { oauthReady } from "@/server/instagram/oauth";
import { body, guarded } from "@/server/instagram/http";
import { connect, connectionStatus, refresh, UserError } from "@/server/instagram/service";

/** Compte Instagram connecté (jamais le jeton) + état du webhook des DM (variables présentes ou non). */
export function GET(request: Request) {
  return guarded("integrations:manage", async ({ deps }) => ({
    ...(await connectionStatus(deps)),
    oauthReady: oauthReady(),
    webhook: {
      appSecret: Boolean(process.env.IG_APP_SECRET),
      verifyToken: Boolean(process.env.IG_VERIFY_TOKEN),
      callbackUrl: `${new URL(request.url).origin}/api/webhooks/instagram`,
    },
  }));
}

export function POST(request: Request) {
  return guarded("integrations:manage", async ({ userId, deps }) => {
    const { token } = await body(request);
    if (typeof token !== "string") throw new UserError("Colle le jeton d'accès Instagram.");
    return connect(deps, userId, token);
  });
}

export function PATCH() {
  return guarded("integrations:manage", ({ userId, deps }) => refresh(deps, userId));
}

export function DELETE() {
  return guarded("integrations:manage", async ({ deps }) => {
    await deps.store.deleteConnection();
    return connectionStatus(deps);
  });
}
