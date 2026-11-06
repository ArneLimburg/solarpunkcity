import { getFootprint, getFootprintRadius, type HexCoordinates } from "./board";
import { BuildingDefinition, type BuildingType } from "./gameDefinitions";
import type { CornerRenderer } from "./CornerRenderer";
import { isModelType, type FarmRenderer } from "./FarmRenderer";
import type { ForestRenderer } from "./ForestRenderer";
import { hexToPixel, tileKey } from "./hexGeometry";
import {
  setFootprintGround,
  type GroundMaterials,
  type TileMeshes,
} from "./TileRenderer";

// the model shown on a tile
export type PlacedModel = { dispose: () => void; triangles: number };

// replaces trees, models and ground on the footprint of a building
export function placeBuilding(
  coords: HexCoordinates,
  type: BuildingType,
  parts: {
    forest: ForestRenderer;
    farms: FarmRenderer;
    tileMeshes: TileMeshes;
    materials: GroundMaterials;
    corners: CornerRenderer;
    models: Record<string, PlacedModel>;
  },
) {
  const { forest, farms, tileMeshes, materials, corners, models } = parts;
  const radius = getFootprintRadius(BuildingDefinition[type].size);
  // the building replaces trees and previous models on its whole footprint
  for (const tile of getFootprint(coords, radius)) {
    forest.clearTile(tile);
    models[tileKey(tile)]?.dispose();
    delete models[tileKey(tile)];
  }
  setFootprintGround(tileMeshes, materials, coords, type);
  corners.update(getFootprint(coords, radius));
  if (isModelType(type)) {
    // models are built from code at scale 1
    models[tileKey(coords)] = farms.create(
      type,
      hexToPixel(coords.q, coords.r),
    );
  }
}
