import {
  BoundingInfo,
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
import { getTileRotation } from "./forest";
import { FOREST_FLOOR_SIZE, createForestFloorPixels } from "./forestFloor";
import { createRoundedHexOutline } from "./hexCorners";
import { HEX_SIZE, TILE_TOP, hexToPixel, tileKey } from "./hexGeometry";

const FOREST_FLOOR_COLOR = new Color3(0.2, 0.42, 0.18);
const MEADOW_COLOR = new Color3(0.55, 0.78, 0.4);
const FARMLAND_COLOR = new Color3(0.55, 0.45, 0.3);
const SOIL_COLOR = new Color3(0.4, 0.26, 0.15);
const GRAVEL_COLOR = new Color3(0.78, 0.7, 0.55);
const TILE_DEPTH = 0.2; // height of a tile below its top
const CHUNK_SIZE = 8 * HEX_SIZE * Math.sqrt(3); // edge of a spatial chunk of tiles

export type GroundMaterials = {
  forestFloor: StandardMaterial;
  meadow: StandardMaterial;
  farmland: StandardMaterial;
  soil: StandardMaterial;
  gravel: StandardMaterial;
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
    gravel: makeMaterial("gravel", GRAVEL_COLOR, scene),
  };
}

export type TileRenderer = {
  // every tile of the board (axial coordinates)
  tiles: HexCoordinates[];
  // moves tiles to the instance buffer of another ground material; each touched buffer is
  // uploaded only once
  setGrounds: (coords: HexCoordinates[], material: StandardMaterial) => void;
  // name of the current ground material of a tile
  getGround: (coords: HexCoordinates) => string | undefined;
  // thin instances over all layers and how many of their matrices consist of finite numbers only
  getInstanceStats: () => { instances: number; finiteMatrices: number };
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
  const matrices = new Float32Array(tiles.length * 16);
  const matrixOffsets: Record<string, number> = {};
  tiles.forEach((tile, i) => {
    const center = hexToPixel(tile.q, tile.r);
    Matrix.Compose(
      Vector3.One(),
      Quaternion.RotationAxis(Vector3.Up(), getTileRotation(tile)),
      new Vector3(center.x, TILE_TOP, center.z),
    ).copyToArray(matrices, i * 16);
    matrixOffsets[tileKey(tile)] = i * 16;
  });

  const shape = createRoundedHexOutline(HEX_SIZE).map(
    (point) => new Vector3(point.x, 0, point.z),
  );
  // the geometry is created once; the bottom cap is never visible, so its triangles are dropped
  const template = MeshBuilder.ExtrudePolygon(
    "tileTemplate",
    { shape, depth: TILE_DEPTH },
    scene,
  );
  const capTriangles = (shape.length - 2) * 3;
  const indices = Array.from(template.getIndices()!);
  template.setIndices([
    ...indices.slice(0, capTriangles),
    ...indices.slice(2 * capTriangles),
  ]);
  template.isPickable = false;
  template.isVisible = false;

  // spatial chunks: Babylon culls a thin instance mesh as a whole, so one mesh per chunk and
  // ground material lets it skip the chunks outside the view
  const chunkOf: Record<string, string> = {};
  const chunkTiles: Record<string, HexCoordinates[]> = {};
  for (const tile of tiles) {
    const { x, z } = hexToPixel(tile.q, tile.r);
    const chunk = `${Math.floor(x / CHUNK_SIZE)}_${Math.floor(z / CHUNK_SIZE)}`;
    chunkOf[tileKey(tile)] = chunk;
    (chunkTiles[chunk] ??= []).push(tile);
  }

  // per chunk and ground material: its mesh, its matrix buffer and the tiles in buffer order
  type Layer = { mesh: Mesh; data: Float32Array; keys: string[] };
  const layers: Record<string, Layer> = {}; // by layerKey
  const layerKey = (material: string, chunk: string) => `${material}|${chunk}`;
  const grounds: Record<string, string> = {}; // material name per tile
  const slots: Record<string, number> = {}; // buffer slot per tile
  for (const [chunk, chunkMembers] of Object.entries(chunkTiles)) {
    const min = new Vector3(Infinity, TILE_TOP - TILE_DEPTH, Infinity);
    const max = new Vector3(-Infinity, TILE_TOP, -Infinity);
    for (const tile of chunkMembers) {
      const { x, z } = hexToPixel(tile.q, tile.r);
      min.x = Math.min(min.x, x - HEX_SIZE);
      min.z = Math.min(min.z, z - HEX_SIZE);
      max.x = Math.max(max.x, x + HEX_SIZE);
      max.z = Math.max(max.z, z + HEX_SIZE);
    }
    for (const material of Object.values(materials)) {
      const mesh = template.clone(`tile_${material.name}_${chunk}`);
      mesh.material = material;
      mesh.isPickable = false;
      const keys =
        material === materials.forestFloor
          ? chunkMembers.map((tile) => tileKey(tile))
          : [];
      const data = new Float32Array(chunkMembers.length * 16);
      keys.forEach((key, slot) => {
        data.set(
          matrices.subarray(matrixOffsets[key], matrixOffsets[key] + 16),
          slot * 16,
        );
        grounds[key] = material.name;
        slots[key] = slot;
      });
      mesh.thinInstanceSetBuffer("matrix", data, 16, false);
      // the bounds cover all tiles of the chunk, whatever the layer currently holds
      mesh.setBoundingInfo(new BoundingInfo(min, max));
      mesh.doNotSyncBoundingInfo = true;
      mesh.thinInstanceCount = keys.length;
      // an empty layer would be drawn once as a plain mesh at the origin
      mesh.isVisible = keys.length > 0;
      layers[layerKey(material.name, chunk)] = { mesh, data, keys };
    }
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

  // layers whose buffer changed and has not been uploaded yet
  const dirty = new Set<Layer>();
  const flush = () => {
    for (const { mesh, keys } of dirty) {
      mesh.thinInstanceCount = keys.length;
      mesh.isVisible = keys.length > 0;
      mesh.thinInstanceBufferUpdated("matrix");
    }
    dirty.clear();
  };

  const move = (coords: HexCoordinates, material: StandardMaterial) => {
    const key = tileKey(coords);
    const from = layers[layerKey(grounds[key], chunkOf[key])];
    const to = layers[layerKey(material.name, chunkOf[key])];
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

    slots[key] = to.keys.length;
    to.data.set(
      matrices.subarray(matrixOffsets[key], matrixOffsets[key] + 16),
      slots[key] * 16,
    );
    to.keys.push(key);
    grounds[key] = material.name;
    dirty.add(from).add(to);
  };

  return {
    tiles,
    setGrounds: (coordinates, material) => {
      coordinates.forEach((coords) => move(coords, material));
      flush();
    },
    getGround: (coords) => grounds[tileKey(coords)],
    getInstanceStats: () => {
      let instances = 0;
      let finiteMatrices = 0;
      for (const { mesh, data } of Object.values(layers)) {
        instances += mesh.thinInstanceCount;
        for (let i = 0; i < mesh.thinInstanceCount; i++) {
          if (data.subarray(i * 16, i * 16 + 16).every(Number.isFinite)) {
            finiteMatrices++;
          }
        }
      }
      return { instances, finiteMatrices };
    },
  };
}

// the tiles that currently hold a forest
export function getForestTiles(coordinates: HexCoordinates[]) {
  return coordinates.filter((tile) => getBuilding(tile)?.type === "Forest");
}
