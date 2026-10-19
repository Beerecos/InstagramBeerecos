import { setFloorSprites } from "@/vendor/pixel-agents/office/floorTiles";
import { buildDynamicCatalog, type LoadedAssetData } from "@/vendor/pixel-agents/office/layout/furnitureCatalog";
import { migrateLayoutColors } from "@/vendor/pixel-agents/office/layout/layoutSerializer";
import { setCarpetSprites } from "@/vendor/pixel-agents/office/sprites/carpetTiles";
import { setCharacterTemplates } from "@/vendor/pixel-agents/office/sprites/spriteData";
import { setProviderCapabilities } from "@/vendor/pixel-agents/office/toolUtils";
import type { OfficeLayout } from "@/vendor/pixel-agents/office/types";
import { setWallSprites } from "@/vendor/pixel-agents/office/wallTiles";

const BASE = "/pixel-agents";
let loading: Promise<OfficeLayout> | null = null;

const json = async <T,>(path: string): Promise<T> => {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Ressource introuvable : ${path}`);
  return (await res.json()) as T;
};

/** Charge une seule fois les sprites pré-décodés (Pixel Agents, MIT) et renvoie le plan du bureau. */
export function loadHiveAssets(): Promise<OfficeLayout> {
  loading ??= (async () => {
    const [characters, floors, walls, carpets, catalog, furniture, layout] = await Promise.all([
      json<Parameters<typeof setCharacterTemplates>[0]>("decoded/characters.json"),
      json<string[][][]>("decoded/floors.json"),
      json<string[][][][]>("decoded/walls.json"),
      json<string[][][][]>("decoded/carpets.json"),
      json<LoadedAssetData["catalog"]>("furniture-catalog.json"),
      json<LoadedAssetData["sprites"]>("decoded/furniture.json"),
      json<OfficeLayout>("default-layout.json"),
    ]);
    setCharacterTemplates(characters);
    setFloorSprites(floors);
    setWallSprites(walls);
    setCarpetSprites(carpets);
    buildDynamicCatalog({ catalog, sprites: furniture });
    // Outils « lecture » : l'agent lit au lieu de taper.
    setProviderCapabilities({ readingTools: ["Read", "WebSearch"], subagentToolNames: [] });
    return migrateLayoutColors(layout);
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}
