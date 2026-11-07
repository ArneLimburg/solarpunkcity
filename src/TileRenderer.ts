import {
  Color3,
  Matrix,
  MeshBuilder,
  Quaternion,
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
  isOnBoard,
  type HexCoordinates,
} from "./board";
import { TILE_TOP } from "./ForestRenderer";
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

export type TileRenderer = {
  // every tile of the board (axial coordinates)
  tiles: HexCoordinates[];
  // moves a tile to the instance buffer of another ground material
  setGround: (coords: HexCoordinates, material: StandardMaterial) => void;
  // name of the current ground material of a tile
  getGround: (coords: HexCoordinates) => string | undefined;
};

// Draws the board with one base mesh per ground material; every tile is a thin instance of the
// base mesh of its material. One invisible plane at the height of the tile top is the only
// pickable mesh of the board.
export function createTileRenderer(
  scene: Scene,
  materials: GroundMaterials,
): TileRenderer {
  const tiles: HexCoordinates[] = [];
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (isOnBoard({ q, r })) tiles.push({ q, r });
    }
  }

  // the matrix of every tile, 16 floats per tile in board order
  const matrices = new Float32Array(
    tiles.flatMap((tile) => {
      const center = hexToPixel(tile.q, tile.r);
      return Matrix.Compose(
        Vector3.One(),
        Quaternion.RotationAxis(Vector3.Up(), getTileRotation(tile)),
        new Vector3(center.x, 0.1, center.z),
      ).asArray() as number[];
    }),
  );
  const matrixOffsets: Record<string, number> = {};
  tiles.forEach((tile, i) => (matrixOffsets[tileKey(tile)] = i * 16));

  const shape = createRoundedHexOutline(HEX_SIZE).map(
    (point) => new Vector3(point.x, 0, point.z),
  );
  // per ground material: its base mesh, its matrix buffer and the tiles in buffer order
  const layers: Record<
    string,
    { mesh: Mesh; data: Float32Array; keys: string[] }
  > = {};
  const grounds: Record<string, string> = {}; // material name per tile
  const slots: Record<string, number> = {}; // buffer slot per tile
  for (const material of Object.values(materials)) {
    const mesh = MeshBuilder.ExtrudePolygon(
      `tile_${material.name}`,
      { shape, depth: 0.2 },
      scene,
    );
    mesh.material = material;
    mesh.isPickable = false;
    const keys =
      material === materials.forestFloor
        ? tiles.map((tile) => tileKey(tile))
        : [];
    const data = matrices.slice();
    mesh.thinInstanceSetBuffer("matrix", data, 16, false);
    // the bounds cover the whole board, so no layer is culled by mistake
    mesh.thinInstanceRefreshBoundingInfo(true);
    mesh.thinInstanceCount = keys.length;
    keys.forEach((key, slot) => {
      grounds[key] = material.name;
      slots[key] = slot;
    });
    layers[material.name] = { mesh, data, keys };
  }

  const pickPlane = MeshBuilder.CreateGround(
    "tilePickPlane",
    {
      width: 2 * HEX_SIZE * Math.sqrt(3) * (GRID_RADIUS + 1),
      height: 2 * HEX_SIZE * Math.sqrt(3) * (GRID_RADIUS + 1),
    },
    scene,
  );
  pickPlane.position.y = TILE_TOP;
  pickPlane.visibility = 0; // invisible, but still hit by picking
  pickPlane.isPickable = true;

  const publish = ({ mesh, keys }: { mesh: Mesh; keys: string[] }) => {
    mesh.thinInstanceCount = keys.length;
    mesh.thinInstanceBufferUpdated("matrix");
  };

  return {
    tiles,
    setGround: (coords, material) => {
      const key = tileKey(coords);
      const from = layers[grounds[key]];
      const to = layers[material.name];
      if (from === to) return;
      // the last tile of the old buffer fills the gap (a no-op if it is the tile itself)
      const slot = slots[key];
      const lastKey = from.keys[from.keys.length - 1];
      from.data.copyWithin(
        slot * 16,
        slots[lastKey] * 16,
        slots[lastKey] * 16 + 16,
      );
      from.keys[slot] = lastKey;
      slots[lastKey] = slot;
      from.keys.pop();
      publish(from);

      slots[key] = to.keys.length;
      to.data.set(
        matrices.subarray(matrixOffsets[key], matrixOffsets[key] + 16),
        slots[key] * 16,
      );
      to.keys.push(key);
      grounds[key] = material.name;
      publish(to);
    },
    getGround: (coords) => grounds[tileKey(coords)],
  };
}

// the tiles that currently hold a forest
export function getForestTiles(coordinates: HexCoordinates[]) {
  return coordinates.filter((tile) => getBuilding(tile)?.type === "Forest");
}
