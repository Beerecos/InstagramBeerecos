import "server-only";
import { parseServerEnv, type ServerEnv } from "./schema";

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

export function isSupabaseConfigured(env: ServerEnv = serverEnv()): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function isDemoMode(env: ServerEnv = serverEnv()): boolean {
  return env.BEESOCIAL_DEMO_MODE && !isSupabaseConfigured(env);
}
