import { getFootprint, getFootprintRadius, type HexCoordinates } from "./board";
import { BuildingDefinition, type BuildingType } from "./gameDefinitions";
import type { CornerRenderer } from "./CornerRenderer";
import { isModelType, type FarmRenderer } from "./FarmRenderer";
import type { ForestRenderer } from "./ForestRenderer";
import { hexToPixel, tileKey } from "./hexGeometry";
import type { WoodStorageRenderer } from "./WoodStorageRenderer";
import {
  setFootprintGround,
  type GroundMaterials,
  type TileMeshes,
} from "./TileRenderer";

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
    tileMeshes: TileMeshes;
    materials: GroundMaterials;
    corners: CornerRenderer;
    models: Record<string, PlacedModel>;
  },
  underConstruction = false,
) {
  const { forest, farms, woodStorage, tileMeshes, materials, corners, models } =
    parts;
  const radius = getFootprintRadius(BuildingDefinition[type].size);
  // the building replaces trees and previous models on its whole footprint
  for (const tile of getFootprint(coords, radius)) {
    forest.clearTile(tile);
    models[tileKey(tile)]?.dispose();
    delete models[tileKey(tile)];
  }
  setFootprintGround(tileMeshes, materials, coords, type, underConstruction);
  corners.update(getFootprint(coords, radius));
  const center = hexToPixel(coords.q, coords.r);
  if (!underConstruction && type === "WoodStorage") {
    models[tileKey(coords)] = woodStorage.create(center);
  } else if (!underConstruction && isModelType(type)) {
    // models are built from code at scale 1
    models[tileKey(coords)] = farms.create(type, center);
  }
}
