import { parseStudioAssetData, type StudioAssetData } from "./studio-assets";
export type StudioSourceKind = "motion" | "story" | "editorial";
export type StudioSourceRef = { assetId: string; revision: number; kind: StudioSourceKind };
/** References only: the server retrieves the private proof, never a browser boolean. */
export type StudioSourceTransfer = { source: StudioSourceRef; jobId: string; renderId: string };
export type StudioSourceRender = { source?: StudioSourceRef; fingerprint: string; jobId?: string; renderId?: string };
export function sourceData<K extends StudioSourceKind>(kind: K, spec: StudioAssetData[K]): StudioAssetData[K] {
  return parseStudioAssetData(kind, JSON.parse(JSON.stringify(spec)));
}
export function sourceFingerprint<K extends StudioSourceKind>(kind: K, spec: StudioAssetData[K]): string {
  return JSON.stringify(sourceData(kind, spec));
}
export function sourceTransfer(render: StudioSourceRender | null | undefined, fingerprint: string): StudioSourceTransfer | null {
  if (!render?.source || render.fingerprint !== fingerprint || !render.jobId || !render.renderId) return null;
  return { source: render.source, jobId: render.jobId, renderId: render.renderId };
}
