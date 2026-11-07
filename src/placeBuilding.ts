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
    tiles: TileRenderer;
    materials: GroundMaterials;
    corners: CornerRenderer;
    models: Record<string, PlacedModel>;
  },
  underConstruction = false,
) {
  const { forest, farms, tiles, materials, corners, models } = parts;
  const radius = getFootprintRadius(BuildingDefinition[type].size);
  // bare soil below construction sites, farmland below farms, meadow below
  // everything else
  const ground = underConstruction
    ? materials.soil
    : BuildingTypes[type].category === "FARM"
      ? materials.farmland
      : materials.meadow;
  // the building replaces trees, previous models and ground on its whole footprint
  for (const tile of getFootprint(coords, radius)) {
    forest.clearTile(tile);
    models[tileKey(tile)]?.dispose();
    delete models[tileKey(tile)];
    tiles.setGround(tile, ground);
  }
  corners.update(getFootprint(coords, radius));
  if (!underConstruction && isModelType(type)) {
    // models are built from code at scale 1
    models[tileKey(coords)] = farms.create(
      type,
      hexToPixel(coords.q, coords.r),
    );
  }
}
