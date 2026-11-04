/** Safe, bounded provider diagnostics. Never log tokens, response bodies or URLs. */
export async function diagnoseMetaAccess(token: string, fetcher: typeof fetch = fetch) {
  const appId = process.env.IG_APP_ID;
  const secret = process.env.IG_APP_SECRET;
  if (!appId || !secret) return;
  const numeric = (v: unknown) => typeof v === "string" && /^\d{1,30}$/.test(v) ? v : null;
  const allowedScopes = new Set(["instagram_basic", "instagram_content_publish", "instagram_manage_comments", "instagram_manage_messages", "public_profile", "business_management", "instagram_business_basic"]);
  const probe = async (path: string, params: Record<string,string>, authorization: string) => {
    try {
      const url = new URL(`https://graph.facebook.com/v26.0/${path}`);
      for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
      const response = await fetcher(url, { headers: { Authorization: `Bearer ${authorization}` }, cache:"no-store", redirect:"error", signal:AbortSignal.timeout(8000) });
      return await response.json();
    } catch { return {}; }
  };
  const [identity, debug] = await Promise.all([
    probe("me", {fields:"client_business_id"}, token),
    probe("debug_token", {input_token:token}, `${appId}|${secret}`),
  ]);
  const d = debug?.data;
  const detail = {
    clientBusinessId: numeric(identity?.client_business_id),
    identityError: typeof identity?.error?.code === "number" ? identity.error.code : null,
    tokenAppId: numeric(d?.app_id),
    valid: d?.is_valid === true,
    tokenType: ["SYSTEM_USER","USER","PAGE","APP"].includes(d?.type) ? d.type : "other",
    scopes: Array.isArray(d?.scopes) ? d.scopes.filter((s: unknown) => allowedScopes.has(String(s))) : [],
    targets: Array.isArray(d?.granular_scopes) ? d.granular_scopes.filter((s: {scope?:string}) => s && allowedScopes.has(s.scope ?? "")).map((s: {scope:string;target_ids?:unknown[]}) => ({scope:s.scope, ids:Array.isArray(s.target_ids) ? s.target_ids.map(numeric).filter(Boolean) : []})) : [],
    debugError: typeof debug?.error?.code === "number" ? debug.error.code : null,
  };
  console.warn("instagram_access_diagnostic", JSON.stringify(detail));
  return detail;
}
