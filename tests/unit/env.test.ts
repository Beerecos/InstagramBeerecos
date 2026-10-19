import { describe, expect, it } from "vitest";
import { EnvError, parseServerEnv } from "@/lib/env/schema";

const SUPA = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" };

describe("validation de l'environnement", () => {
  it("accepte un environnement de développement vide", () => {
    expect(parseServerEnv({ NODE_ENV: "development" }).BEESOCIAL_DEMO_MODE).toBe(false);
  });
  it("exige Supabase en production, sauf démo explicite", () => {
    expect(() => parseServerEnv({ NODE_ENV: "production" })).toThrow(EnvError);
    expect(parseServerEnv({ NODE_ENV: "production", BEESOCIAL_DEMO_MODE: "1" }).BEESOCIAL_DEMO_MODE).toBe(true);
    expect(parseServerEnv({ NODE_ENV: "production", ...SUPA }).NEXT_PUBLIC_SUPABASE_URL).toBe(SUPA.NEXT_PUBLIC_SUPABASE_URL);
  });
  it("interdit le mode démo quand Supabase est configuré", () => {
    expect(() => parseServerEnv({ ...SUPA, BEESOCIAL_DEMO_MODE: "1" })).toThrow(/interdit/);
  });
  it("refuse une configuration Supabase incomplète ou une clé mal placée", () => {
    expect(() => parseServerEnv({ NEXT_PUBLIC_SUPABASE_URL: SUPA.NEXT_PUBLIC_SUPABASE_URL })).toThrow(/vont ensemble/);
    expect(() => parseServerEnv({ ...SUPA, SUPABASE_SECRET_KEY: "sb_publishable_oops" })).toThrow(/clé secrète/);
  });
  it("rejette une URL invalide", () => {
    expect(() => parseServerEnv({ NEXT_PUBLIC_SUPABASE_URL: "pas-une-url", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k" })).toThrow(EnvError);
  });
});
