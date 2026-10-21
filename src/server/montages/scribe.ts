import "server-only";
import { scribeToWords } from "@/domain/video/montage";
import type { CaptionWord } from "@/domain/video/edit";

export const SCRIBE_URL = "https://api.elevenlabs.io/v1/speech-to-text";

/**
 * Transcription mot à mot par ElevenLabs Scribe. La prise n'est pas renvoyée par l'application :
 * Scribe la télécharge lui-même depuis une URL signée à durée courte (`cloud_storage_url`).
 */
export async function transcribeWithScribe(videoUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<CaptionWord[]> {
  const form = new FormData();
  form.set("model_id", "scribe_v1");
  form.set("cloud_storage_url", videoUrl);
  form.set("language_code", "fr");
  form.set("timestamps_granularity", "word");
  form.set("tag_audio_events", "false");
  form.set("diarize", "false");
  const res = await fetchImpl(SCRIBE_URL, { method: "POST", headers: { "xi-api-key": apiKey }, body: form, signal: AbortSignal.timeout(280_000) });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(res.status === 401 ? "Clé ElevenLabs refusée : vérifiez ELEVENLABS_API_KEY." : `ElevenLabs a répondu ${res.status}${detail ? ` : ${detail}` : ""}`);
  }
  const words = scribeToWords(await res.json());
  if (!words.length) throw new Error("Aucune parole détectée dans la prise.");
  return words;
}
