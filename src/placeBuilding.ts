import { getFootprint, getFootprintRadius, type HexCoordinates } from "./board";
import {
  BuildingDefinition,
  BuildingTypes,
  type BuildingType,
} from "./gameDefinitions";
import type { CornerRenderer } from "./CornerRenderer";
import { isModelType, type FarmRenderer } from "./FarmRenderer";
import type { ForestRenderer } from "./ForestRenderer";
import { hexToPixel, tileKey } from "./hexGeometry";
import type { WoodStorageRenderer } from "./WoodStorageRenderer";
import type { GroundMaterials, TileRenderer } from "./TileRenderer";

// the model shown on a tile
export type PlacedModel = { dispose: () => void; triangles: number };

// replaces trees, models and ground on the footprint of a building; a
// construction site shows bare soil and no model
export function placeBuilding(
  coords: HexCoordinates,
  type: BuildingType,
  parts: {
    forest: ForestRenderer;
    farms: FarmRenderer;
    woodStorage: WoodStorageRenderer;
    tiles: TileRenderer;
    materials: GroundMaterials;
    corners: CornerRenderer;
    models: Record<string, PlacedModel>;
  },
  underConstruction = false,
) {
  const { forest, farms, woodStorage, tiles, materials, corners, models } =
    parts;
  const radius = getFootprintRadius(BuildingDefinition[type].size);
  // bare soil below construction sites, farmland below farms, gravel below
  // the wood storage, compacted earth below production buildings, meadow below
  // everything else
  const category = BuildingTypes[type].category;
  const ground = underConstruction
    ? materials.soil
    : category === "FARM"
      ? materials.farmland
      : type === "WoodStorage"
        ? materials.gravel
        : category === "PRODUCTION"
          ? materials.earth
          : materials.meadow;
  // the building replaces trees, previous models and ground on its whole footprint
  for (const tile of getFootprint(coords, radius)) {
    forest.clearTile(tile);
    models[tileKey(tile)]?.dispose();
    delete models[tileKey(tile)];
  }
  tiles.setGrounds(getFootprint(coords, radius), ground);
  corners.update(getFootprint(coords, radius));
  const center = hexToPixel(coords.q, coords.r);
  if (!underConstruction && type === "WoodStorage") {
    models[tileKey(coords)] = woodStorage.create(center);
  } else if (!underConstruction && isModelType(type)) {
    // models are built from code at scale 1
    models[tileKey(coords)] = farms.create(type, center);
  }
}
