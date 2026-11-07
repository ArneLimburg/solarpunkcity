import {
  Color3,
  MeshBuilder,
  RawTexture,
  StandardMaterial,
  Texture,
  Vector3,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import {
  GRID_RADIUS,
  getBuilding,
  getFootprint,
  getFootprintRadius,
  isOnBoard,
  type HexCoordinates,
} from "./board";
import { BuildingDefinition, BuildingTypes } from "./gameDefinitions";
import type { BuildingType } from "./gameDefinitions";
import { getTileRotation } from "./forest";
import { FOREST_FLOOR_SIZE, createForestFloorPixels } from "./forestFloor";
import { createRoundedHexOutline } from "./hexCorners";
import { HEX_SIZE, hexToPixel, tileKey } from "./hexGeometry";

const FOREST_FLOOR_COLOR = new Color3(0.2, 0.42, 0.18);
const MEADOW_COLOR = new Color3(0.55, 0.78, 0.4);
const FARMLAND_COLOR = new Color3(0.55, 0.45, 0.3);
const SOIL_COLOR = new Color3(0.4, 0.26, 0.15);

export type GroundMaterials = {
  forestFloor: StandardMaterial;
  meadow: StandardMaterial;
  farmland: StandardMaterial;
  soil: StandardMaterial;
};

// hex meshes per tile ("q,r")
export type TileMeshes = Record<string, Mesh>;

export function makeMaterial(name: string, color: Color3, scene: Scene) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = Color3.Black();
  return m;
}

export function createGroundMaterials(scene: Scene): GroundMaterials {
  const forestFloor = makeMaterial("forestFloor", FOREST_FLOOR_COLOR, scene);
  forestFloor.diffuseTexture = RawTexture.CreateRGBATexture(
    createForestFloorPixels(),
    FOREST_FLOOR_SIZE,
    FOREST_FLOOR_SIZE,
    scene,
    true,
    false,
    Texture.BILINEAR_SAMPLINGMODE,
  );
  return {
    forestFloor,
    meadow: makeMaterial("meadow", MEADOW_COLOR, scene),
    farmland: makeMaterial("farmland", FARMLAND_COLOR, scene),
    soil: makeMaterial("soil", SOIL_COLOR, scene),
  };
}

export function createHexTile(
  q: number,
  r: number,
  scene: Scene,
  material: StandardMaterial,
) {
  const hex = MeshBuilder.ExtrudePolygon(
    `hex_${q}_${r}`,
    {
      shape: createRoundedHexOutline(HEX_SIZE).map(
        (point) => new Vector3(point.x, 0, point.z),
      ),
      depth: 0.2,
    },
    scene,
  );
  hex.position = hexToPixel(q, r);
  hex.position.y = 0.1;
  hex.material = material;
  hex.rotation.y = getTileRotation({ q, r });
  return hex;
}

// creates a hex tile for every tile of the board (axial coordinates)
export function createTiles(scene: Scene, material: StandardMaterial) {
  const meshes: TileMeshes = {};
  const coordinates: HexCoordinates[] = [];
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (isOnBoard({ q, r })) {
        meshes[tileKey({ q, r })] = createHexTile(q, r, scene, material);
        coordinates.push({ q, r });
      }
    }
  }
  return { meshes, coordinates };
}

// the tiles that currently hold a forest
export function getForestTiles(coordinates: HexCoordinates[]) {
  return coordinates.filter((tile) => getBuilding(tile)?.type === "Forest");
}

// bare soil below construction sites, farmland below farms, meadow below
// everything else
export function setFootprintGround(
  meshes: TileMeshes,
  materials: GroundMaterials,
  coords: HexCoordinates,
  type: BuildingType,
  underConstruction = false,
) {
  const radius = getFootprintRadius(BuildingDefinition[type].size);
  const farm = BuildingTypes[type].category === "FARM";
  const ground = underConstruction
    ? materials.soil
    : farm
      ? materials.farmland
      : materials.meadow;
  for (const tile of getFootprint(coords, radius)) {
    meshes[tileKey(tile)].material = ground;
  }
}

export function getTileMaterialName(
  meshes: TileMeshes,
  coords: HexCoordinates,
): string | undefined {
  return meshes[tileKey(coords)].material!.name;
}
