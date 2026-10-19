/**
 * Contrats des fournisseurs. Le code métier ne dépend que de ces interfaces ;
 * chaque fournisseur réel est un adapter dans src/providers/<domaine>/<fournisseur>.ts.
 */

/** Valeur d'une capacité : supportée, non supportée, ou dépendante du compte/fournisseur. */
export type Capability = boolean | "providerDependent";
export type CapabilityMatrix<K extends string> = Record<K, Capability>;

export type ConnectionStatus = "connected" | "not_configured" | "error";

export interface ProviderBase<K extends string = string> {
  readonly id: string;
  readonly displayName: string;
  /** Capacités réellement disponibles (découvertes dynamiquement quand c'est possible). */
  capabilities(): Promise<CapabilityMatrix<K>>;
  /** Test de connexion sans effet de bord. */
  healthCheck(): Promise<{ status: ConnectionStatus; detail?: string }>;
}

export type CostEstimate = { currency: "EUR" | "USD"; amount: number; unit: "credits" | "seconds" | "tokens"; quantity: number };

// --- LLM ---------------------------------------------------------------------
export type LlmCapability = "toolUse" | "vision" | "structuredOutput" | "streaming";
export interface LLMProvider extends ProviderBase<LlmCapability> {
  generate(input: { system?: string; prompt: string; maxTokens?: number }): Promise<{ text: string; inputTokens: number; outputTokens: number }>;
}

// --- Vidéo IA ------------------------------------------------------------------
export type VideoCapability = "textToVideo" | "imageToVideo" | "videoToVideo" | "nativeAudio" | "characterConsistency" | "portrait9x16";
export type VideoSceneRequest = {
  idempotencyKey: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: "9:16" | "16:9" | "1:1";
  referenceImageUrl?: string;
  withAudio?: boolean;
};
export type VideoJobState = { jobId: string; status: "queued" | "running" | "succeeded" | "failed"; outputUrl?: string; error?: string; actualCost?: CostEstimate };
export interface VideoGenerationProvider extends ProviderBase<VideoCapability> {
  readonly maxDurationSeconds: number;
  estimateCost(req: VideoSceneRequest): Promise<CostEstimate>;
  submit(req: VideoSceneRequest): Promise<{ jobId: string }>;
  poll(jobId: string): Promise<VideoJobState>;
}

// --- Transcription -------------------------------------------------------------
export type TranscriptWord = { text: string; start: number; end: number; speaker?: string };
export interface TranscriptionProvider extends ProviderBase<"wordTimestamps" | "diarization"> {
  transcribe(input: { mediaUrl: string; language?: string }): Promise<{ language: string; words: TranscriptWord[] }>;
}

// --- Publication sociale ---------------------------------------------------------
export type SocialCapability =
  | "reels"
  | "posts"
  | "stories"
  | "carousels"
  | "schedule"
  | "updateScheduled"
  | "cancelScheduled"
  | "analytics"
  | "bestTimes"
  | "comments";
export type SocialNetwork = "instagram" | "linkedin";
export type SocialAccount = { id: string; network: SocialNetwork; handle: string; kind: "business" | "member" | "organization" };
export type ScheduledPost = { id: string; accountId: string; scheduledAt: string; caption: string; mediaUrls: string[]; status: "scheduled" | "published" | "failed" | "cancelled"; externalPostId?: string };
export interface SocialPublishingProvider extends ProviderBase<SocialCapability> {
  getAccounts(): Promise<SocialAccount[]>;
  getScheduledPosts(accountId: string): Promise<ScheduledPost[]>;
  /**
   * Les API directes (Instagram, LinkedIn) publient immédiatement : la programmation est assurée par
   * PUBLISHING_WORKFLOW (Vercel Workflow), qui appelle `schedulePost` à l'heure prévue avec `scheduledAt` = maintenant.
   */
  schedulePost(input: { idempotencyKey: string; accountId: string; scheduledAt: string; caption: string; mediaUrls: string[]; kind: "reel" | "post" | "story" | "video" | "image" | "text" | "document" }): Promise<ScheduledPost>;
  updateScheduledPost(id: string, patch: Partial<Pick<ScheduledPost, "scheduledAt" | "caption">>): Promise<ScheduledPost>;
  cancelScheduledPost(id: string): Promise<void>;
  fetchAnalytics(input: { accountId: string; from: string; to: string }): Promise<Array<{ externalPostId: string; metrics: Record<string, number> }>>;
  fetchBestTimes(accountId: string): Promise<Array<{ weekday: number; hour: number; score: number }>>;
  fetchPublishedContent(input: { accountId: string; since: string }): Promise<Array<{ externalPostId: string; permalink?: string; publishedAt: string; caption?: string }>>;
}

// --- Messagerie Instagram --------------------------------------------------------
export type MessagingCapability = "commentTrigger" | "privateReply" | "buttons" | "quickReplies" | "humanHandoff";
export interface InstagramMessagingProvider extends ProviderBase<MessagingCapability> {
  sendMessage(input: { idempotencyKey: string; threadId: string; text: string; buttons?: Array<{ title: string; url?: string; payload?: string }> }): Promise<{ messageId: string }>;
  getThread(threadId: string): Promise<{ threadId: string; messages: Array<{ id: string; from: "user" | "page"; text: string; at: string }> }>;
  handoffToHuman(threadId: string, reason: string): Promise<void>;
}

// --- Stockage ---------------------------------------------------------------------
export interface StorageProvider extends ProviderBase<"signedUrls" | "resumableUpload"> {
  createUploadUrl(input: { bucket: string; path: string; contentType: string }): Promise<{ url: string; token?: string }>;
  getSignedUrl(input: { bucket: string; path: string; expiresInSeconds: number }): Promise<string>;
}

// --- Notifications ------------------------------------------------------------------
export interface NotificationProvider extends ProviderBase<"email" | "push" | "inApp"> {
  notify(input: { userId: string; title: string; body: string; link?: string }): Promise<void>;
}
