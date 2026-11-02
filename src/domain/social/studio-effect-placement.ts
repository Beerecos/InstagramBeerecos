import { parseStudioAssetData, type StudioEffect } from "./studio-assets";
import { animationOutputRange, retimeAnimation } from "./montage/placement";
import type { Range } from "./montage/edit";
import type { CustomAnimation } from "./montage/suggest";

/** Store visible relative timing; never include a removed section in an effect's duration. */
export function captureStudioEffect(layers: CustomAnimation[], ranges: Range[]): StudioEffect {
  const visible = layers.map(layer => ({...structuredClone(layer), ...animationOutputRange(layer,ranges)}));
  if (!visible.length || visible.some(layer=>layer.toMs-layer.fromMs<100)) throw new Error("Choisissez des animations visibles dans le montage.");
  const start = Math.min(...visible.map(layer=>layer.fromMs));
  return parseStudioAssetData("effect", {schemaVersion:1, durationMs:Math.max(...visible.map(layer=>layer.toMs))-start,
    layers:visible.map(layer=>({...layer,fromMs:layer.fromMs-start,toMs:layer.toMs-start}))});
}
export function placeStudioEffect(effect:StudioEffect,ranges:Range[],atOutputMs:number,uuid:()=>string=()=>crypto.randomUUID()):CustomAnimation[] {
  const valid=parseStudioAssetData("effect",effect);
  const groupId = uuid();
  return structuredClone(valid.layers).map(layer=>retimeAnimation({...layer,id:uuid(),groupId},ranges,atOutputMs+layer.fromMs,atOutputMs+layer.toMs));
}
