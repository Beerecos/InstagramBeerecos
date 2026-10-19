import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env/schema";
import { INTEGRATIONS, integrationStates } from "@/server/integrations/registry";

describe("intégrations", () => {
  it("couvre les 8 cartes demandées", () => {
    expect(INTEGRATIONS.map((i) => i.id).sort()).toEqual(["claude", "google_drive", "instagram", "manychat", "metricool", "runway", "supabase", "veo"]);
  });
  it("signale ce qui manque sans jamais exposer de valeur", () => {
    const states = integrationStates(parseServerEnv({ ANTHROPIC_API_KEY: "sk-secret-value" }));
    const claude = states.find((s) => s.id === "claude")!;
    expect(claude.status).toBe("connected");
    expect(claude.verified).toBe(false);
    expect(JSON.stringify(states)).not.toContain("sk-secret-value");
    expect(states.find((s) => s.id === "metricool")!.missing).toEqual(["METRICOOL_MCP_URL", "METRICOOL_API_TOKEN"]);
  });
});
