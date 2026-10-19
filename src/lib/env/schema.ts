import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/** Variables lisibles par le navigateur : uniquement des valeurs publiques. */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  NEXT_PUBLIC_APP_URL: z.url().optional(),
});

/** Variables serveur : secrets et configuration des fournisseurs. Jamais exposées au client. */
export const serverEnvSchema = clientEnvSchema.extend({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_SECRET_KEY: optionalString,
  BEEMARKETING_DEMO_MODE: z
    .enum(["0", "1"])
    .optional()
    .transform((v) => v === "1"),

  ANTHROPIC_API_KEY: optionalString,
  AI_GATEWAY_API_KEY: optionalString,

  // LinkedIn (API officielle) : profil membre (w_member_social) et page entreprise (Community Management API)
  LINKEDIN_CLIENT_ID: optionalString,
  LINKEDIN_CLIENT_SECRET: optionalString,
  LINKEDIN_ORGANIZATION_URN: z
    .string()
    .trim()
    .regex(/^urn:li:organization:\d+$/, "format attendu : urn:li:organization:<id>")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  LINKEDIN_API_VERSION: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "format attendu : AAAAMM")
    .optional()
    .or(z.literal("").transform(() => undefined)),

  IG_ACCESS_TOKEN: optionalString,
  IG_USER_ID: optionalString,
  IG_APP_SECRET: optionalString,
  IG_VERIFY_TOKEN: optionalString,

  GOOGLE_VEO_API_KEY: optionalString,
  RUNWAY_API_KEY: optionalString,
  ELEVENLABS_API_KEY: optionalString,

  GOOGLE_DRIVE_CLIENT_ID: optionalString,
  GOOGLE_DRIVE_CLIENT_SECRET: optionalString,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Configuration invalide :\n- ${issues.join("\n- ")}`);
    this.name = "EnvError";
  }
}

/** Valide l'environnement et applique les règles transverses (cohérence, sécurité). */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvError(parsed.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`));
  }
  const env = parsed.data;
  const issues: string[] = [];
  const supabaseConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (Boolean(env.NEXT_PUBLIC_SUPABASE_URL) !== Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY vont ensemble.");
  }
  // Le mode démo ne peut jamais court-circuiter une vraie authentification.
  if (env.BEEMARKETING_DEMO_MODE && supabaseConfigured) {
    issues.push("BEEMARKETING_DEMO_MODE=1 est interdit quand Supabase est configuré.");
  }
  if (env.NODE_ENV === "production" && !supabaseConfigured && !env.BEEMARKETING_DEMO_MODE) {
    issues.push("Supabase doit être configuré en production (voir docs/DEPLOYMENT.md).");
  }
  if (env.SUPABASE_SECRET_KEY?.startsWith("sb_publishable_")) {
    issues.push("SUPABASE_SECRET_KEY contient une clé publishable : utiliser la clé secrète.");
  }
  if (issues.length) throw new EnvError(issues);
  return env;
}
