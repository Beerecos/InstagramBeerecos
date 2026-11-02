// Adresse des Edge Functions BeeMarketing (même projet Supabase que BeeMarketing, décision du 2026-11-02).
// Équivalent Next.js de `src/lib/api-config.ts` (VITE_BEE_API_URL) : aucune bascule silencieuse vers la production.
const rawApi = process.env.NEXT_PUBLIC_BEE_API_URL?.trim();
export const isDemoMode = rawApi?.toLowerCase() === "demo";
export const apiUrl = rawApi && !isDemoMode ? rawApi.replace(/\/+$/, "") : undefined;
