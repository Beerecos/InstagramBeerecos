import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { ProviderError } from "@/providers/errors";
import type { AIProvider, AiCapability } from "./types";

const DEFAULT_MODEL = "claude-opus-5-5";
// Repli serveur automatique si le modèle refuse une requête (catégorie de refus → modèle adapté).
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Adapter Claude (SDK officiel Anthropic). Doc : skill claude-api, version SDK 0.135. */
export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly displayName = "Claude (Anthropic)";
  private readonly client: Anthropic;

  constructor(private readonly opts: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 2 });
  }

  get model(): string {
    return this.opts.model ?? DEFAULT_MODEL;
  }

  async capabilities(): Promise<Record<AiCapability, boolean>> {
    return {
      generateText: true,
      generateStructured: true,
      webSearch: true,
      analyzeImage: true,
      generateImage: false,
      generateVideo: false,
      transcribeAudio: false,
      textToSpeech: false,
    };
  }

  async healthCheck() {
    try {
      await this.client.models.retrieve(this.model);
      return { status: "connected" as const };
    } catch (e) {
      return { status: "error" as const, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  async generateText({ system, prompt, maxTokens = 16000 }: { system: string; prompt: string; maxTokens?: number }) {
    const res = await this.call(() =>
      this.client.beta.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    );
    if (res.stop_reason === "refusal") throw new ProviderError(this.id, "upstream_error", "Le modèle a refusé la demande.", false);
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    return { text, usage: { provider: this.id, model: res.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens } };
  }

  async generateStructured<S extends z.ZodType>({ system, prompt, schema, maxTokens = 16000, allowWebSearch }: { system: string; prompt: string; schema: S; maxTokens?: number; allowWebSearch?: boolean }) {
    const res = await this.call(() =>
      this.client.beta.messages.parse({
        model: this.model,
        max_tokens: maxTokens,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
        system,
        messages: [{ role: "user", content: prompt }],
        ...(allowWebSearch ? { tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 5 }] } : {}),
      }),
    );
    if (res.stop_reason === "refusal") throw new ProviderError(this.id, "upstream_error", "Le modèle a refusé la demande.", false);
    if (res.stop_reason === "max_tokens") throw new ProviderError(this.id, "upstream_error", "Réponse tronquée (limite de longueur atteinte).", true);
    if (!res.parsed_output) throw new ProviderError(this.id, "invalid_input", "Réponse non conforme au format attendu.", true);

    // Sources réelles : uniquement les URLs renvoyées par l'outil de recherche web.
    const sources = res.content.flatMap((b) =>
      b.type === "web_search_tool_result" && Array.isArray(b.content) ? b.content.flatMap((r) => ("url" in r ? [r.url] : [])) : [],
    );
    return {
      data: res.parsed_output as z.infer<S>,
      sources: [...new Set(sources)],
      usage: { provider: this.id, model: res.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
    };
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new ProviderError(this.id, "unauthorized", "Clé Anthropic invalide.", false);
      if (e instanceof Anthropic.RateLimitError) throw new ProviderError(this.id, "rate_limited", "Limite de débit atteinte.");
      if (e instanceof Anthropic.BadRequestError) throw new ProviderError(this.id, "invalid_input", e.message, false);
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError(this.id, "timeout", "Délai dépassé.");
      if (e instanceof Anthropic.APIError) throw new ProviderError(this.id, "upstream_error", e.message);
      throw e;
    }
  }
}
