import { useCallback, useEffect, useRef, useState } from "react";
import { studioAssets } from "@/lib/social/studio-assets-api";
import type { StudioAsset, StudioAssetData } from "@/domain/social/studio-assets";
import { sourceData, sourceFingerprint, type StudioSourceKind, type StudioSourceRef } from "@/domain/social/studio-sources";

// Projets IA détaillés (motion, story) ; le Réel IA simple (editorial) enregistre sa source à l'envoi au montage.
export function useStudioProject<K extends Exclude<StudioSourceKind, "editorial">>(kind: K, spec: StudioAssetData[K], onOpen: (data: StudioAssetData[K]) => void, sourceRef?: StudioSourceRef) {
  const [asset, setAsset] = useState<StudioAsset<K> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef(asset); current.current = asset;
  const openCallback = useRef(onOpen); openCallback.current = onOpen;
  const saving = useRef(false);
  const open = useCallback(async (ref: StudioSourceRef) => {
    setBusy(true); setError(null);
    try {
      const result = await studioAssets.get(ref.assetId, ref.revision);
      if (result.asset.kind !== kind) throw new Error("Ce projet utilise un autre type de source.");
      const loaded = result.asset as StudioAsset<K>;
      setAsset(loaded); current.current = loaded;
      openCallback.current(loaded.data as StudioAssetData[K]);
    } catch (e) { setError(e instanceof Error ? e.message : "Projet indisponible. Votre brouillon est conservé."); }
    finally { setBusy(false); }
  }, [kind]);
  const sourceKey = sourceRef ? `${sourceRef.assetId}:${sourceRef.revision}` : "";
  useEffect(() => { if (sourceRef) void open(sourceRef); }, [sourceKey, open]); // eslint-disable-line react-hooks/exhaustive-deps -- immutable source identity
  async function save(data: StudioAssetData[K] = spec, copy = false): Promise<StudioSourceRef> {
    if (saving.current) throw new Error("Un enregistrement est déjà en cours.");
    saving.current = true; setBusy(true); setError(null);
    try {
      const old = copy ? null : current.current;
      if (old && sourceFingerprint(kind, old.data as StudioAssetData[K]) === sourceFingerprint(kind, data)) return { assetId: old.id, revision: old.revision, kind };
      const result = await studioAssets.save({ ...(old ? { assetId: old.id, expectedRevision: old.revision } : {}), kind, title: data.title, data: sourceData(kind, data) });
      const saved = result.asset as StudioAsset<K>;
      setAsset(saved); current.current = saved;
      return { assetId: saved.id, revision: saved.revision, kind };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Enregistrement impossible. Votre brouillon est conservé.";
      setError(message); throw e;
    } finally { saving.current = false; setBusy(false); }
  }
  let dirty = true;
  try { dirty = !asset || sourceFingerprint(kind, asset.data as StudioAssetData[K]) !== sourceFingerprint(kind, spec); } catch { /* incomplete editable draft */ }
  return { asset, busy, error, dirty, open, save, saveCopy: () => save(spec, true) };
}
