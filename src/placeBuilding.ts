import { getFootprint, getFootprintRadius, type HexCoordinates } from "./board";
import {
  BuildingDefinition,
  BuildingTypes,
  type BuildingType,
} from "./gameDefinitions";
import type { CornerRenderer } from "./CornerRenderer";
import type {
  ConstructionRenderer,
  ConstructionSite,
} from "./ConstructionRenderer";
import { isModelType, type FarmRenderer } from "./FarmRenderer";
import type { ForestRenderer } from "./ForestRenderer";
import { hexToPixel, tileKey } from "./hexGeometry";
import { getHydroPowerPlantRotation } from "./hydroPowerPlant";
import type { WindTurbineRenderer } from "./WindTurbineRenderer";
import type { WoodStorageRenderer } from "./WoodStorageRenderer";
import type { GroundMaterials, TileRenderer } from "./TileRenderer";

// the model shown on a tile
export type PlacedModel = { dispose: () => void; triangles: number };

// replaces trees, models and ground on the footprint of a building; a
// construction site shows bare soil and the blueprint of the model
export function placeBuilding(
  coords: HexCoordinates,
  type: BuildingType,
  parts: {
    forest: ForestRenderer;
    farms: FarmRenderer;
    woodStorage: WoodStorageRenderer;
    windTurbines: WindTurbineRenderer;
    // the rooftop turbines of the apartment buildings
    apartmentRotors: WindTurbineRenderer;
    tiles: TileRenderer;
    materials: GroundMaterials;
    corners: CornerRenderer;
    models: Record<string, PlacedModel>;
    construction: ConstructionRenderer;
    // the blueprint shown on the center tile of a construction site
    sites: Record<string, ConstructionSite>;
  },
  underConstruction = false,
) {
  const {
    forest,
    farms,
    woodStorage,
    windTurbines,
    apartmentRotors,
    tiles,
    materials,
    corners,
    models,
    construction,
    sites,
  } = parts;
  const radius = getFootprintRadius(BuildingDefinition[type].size);
  // bare soil below construction sites, farmland below farms, gravel below
  // the wood storage, compacted earth below production buildings, meadow below
  // everything else
  const category = BuildingTypes[type].category;
  // the river keeps its water below a hydro power plant, also on its site
  const ground =
    type === "HydroPowerPlant"
      ? materials.water
      : underConstruction
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
    sites[tileKey(tile)]?.dispose();
    delete sites[tileKey(tile)];
  }
  tiles.setGrounds(getFootprint(coords, radius), ground);
  corners.update(getFootprint(coords, radius));
  const center = hexToPixel(coords.q, coords.r);
  if (underConstruction) {
    // the blueprint fills with the finished model as the work proceeds
    if (type === "WoodStorage" || isModelType(type)) {
      sites[tileKey(coords)] = construction.create(
        type,
        center,
        type === "HydroPowerPlant" ? getHydroPowerPlantRotation(coords) : 0,
      );
    }
  } else if (type === "WoodStorage") {
    models[tileKey(coords)] = woodStorage.create(center);
  } else if (type === "HydroPowerPlant") {
    // the weir lies across the river
    models[tileKey(coords)] = farms.create(
      type,
      center,
      getHydroPowerPlantRotation(coords),
    );
  } else if (type === "WindTurbine") {
    // the rotor turns, see WindTurbineRenderer
    models[tileKey(coords)] = windTurbines.create(coords, center);
  } else if (type === "AppartmentBuilding") {
    // the rooftop rotor turns, see WindTurbineRenderer
    models[tileKey(coords)] = apartmentRotors.create(coords, center);
  } else if (isModelType(type)) {
    // models are built from code at scale 1
    models[tileKey(coords)] = farms.create(type, center);
  }
}
