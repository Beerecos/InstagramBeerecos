import { apiUrl } from "./api-config";
import { getAccessToken } from "./supabase";
import type { StudioAsset, StudioAssetData, StudioAssetKind } from "@/domain/social/studio-assets";
export class StudioAssetError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!apiUrl) throw new StudioAssetError("Backend du Studio non configuré.", 503);
  const token = await getAccessToken();
  const res = await fetch(`${apiUrl}/montage/admin`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new StudioAssetError(data.error ?? `Erreur serveur (${res.status}).`, res.status);
  return data as T;
}
export const studioAssets = {
  list: (kind?: StudioAssetKind) => call<{ assets: StudioAsset[] }>({ action: "asset-list", kind }),
  get: (assetId: string, revision?: number) => call<{ asset: StudioAsset }>({ action: "asset-get", assetId, revision }),
  save: <K extends StudioAssetKind>(input: { assetId?: string; expectedRevision?: number; kind: K; title: string; data: StudioAssetData[K] }) => call<{ asset: StudioAsset<K> }>({ action: "asset-save", ...input }),
  /** Display returned HTML and wait for the frame to load before exposing explicit approval. */
  preview: (assetId: string, expectedRevision: number) => call<{ asset: StudioAsset<"effect">; html: string; previewRevision: string }>({ action: "asset-preview", assetId, expectedRevision }),
  approve: (assetId: string, expectedRevision: number, previewRevision: string) => call<{ asset: StudioAsset<"effect"> }>({ action: "asset-approve", assetId, expectedRevision, previewRevision }),
  archive: (assetId: string, expectedRevision: number) => call<{ asset: StudioAsset }>({ action: "asset-archive", assetId, expectedRevision }),
};
