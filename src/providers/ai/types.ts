import type { z } from "zod";
import type { ProviderBase } from "@/providers/types";

export type AiCapability =
  | "generateText"
  | "generateStructured"
  | "webSearch"
  | "analyzeImage"
  | "generateImage"
  | "generateVideo"
  | "transcribeAudio"
  | "textToSpeech";

export type AiUsage = { provider: string; model: string; inputTokens: number; outputTokens: number };

/**
 * Abstraction IA indépendante du fournisseur. Chaque adapter déclare ses capacités ;
 * une capacité absente lève ProviderError("unsupported_capability"), jamais un faux résultat.
 */
export interface AIProvider extends ProviderBase<AiCapability> {
  generateText(input: { system: string; prompt: string; maxTokens?: number }): Promise<{ text: string; usage: AiUsage }>;
  generateStructured<S extends z.ZodType>(input: {
    system: string;
    prompt: string;
    schema: S;
    maxTokens?: number;
    allowWebSearch?: boolean;
  }): Promise<{ data: z.infer<S>; usage: AiUsage; sources: string[] }>;
}
