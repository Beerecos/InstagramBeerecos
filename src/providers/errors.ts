export type ProviderErrorCode =
  | "not_configured"
  | "unsupported_capability"
  | "invalid_input"
  | "unauthorized"
  | "rate_limited"
  | "budget_exceeded"
  | "upstream_error"
  | "timeout";

/** Erreur typée commune à tous les adapters. `retryable` guide les workflows. */
export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly retryable = code === "rate_limited" || code === "timeout" || code === "upstream_error",
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}
