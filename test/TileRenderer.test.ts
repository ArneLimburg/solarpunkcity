import { expect, test, vi } from "vitest";
import type { Scene, StandardMaterial } from "@babylonjs/core";

type FakeMesh = {
  name: string;
  shape?: unknown[];
  options?: { width: number; height: number };
  material?: { name: string };
  isPickable: boolean;
  visibility: number;
  isVisible: boolean;
  doNotSyncBoundingInfo: boolean;
  position: { y: number };
  buffer?: Float32Array;
  thinInstanceCount: number;
  thinInstanceSetBuffer: ReturnType<typeof vi.fn>;
  thinInstanceRefreshBoundingInfo: ReturnType<typeof vi.fn>;
  thinInstanceBufferUpdated: ReturnType<typeof vi.fn>;
  indices: number[];
  getIndices: () => number[];
  setIndices: ReturnType<typeof vi.fn>;
  clone: (name: string) => FakeMesh;
  setBoundingInfo: ReturnType<typeof vi.fn>;
};

const created = vi.hoisted(() => [] as unknown[]);

vi.mock("@babylonjs/core", () => {
  class Vector3 {
    static One = () => new Vector3(1, 1, 1);
    static Up = () => new Vector3(0, 1, 0);
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }
  class BoundingInfo {
    minimum: Vector3;
    maximum: Vector3;
    constructor(minimum: Vector3, maximum: Vector3) {
      this.minimum = minimum;
      this.maximum = maximum;
    }
  }
  class Color3 {
    static Black = () => new Color3(0, 0, 0);
    r: number;
    g: number;
    b: number;
    constructor(r = 0, g = 0, b = 0) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  }
  class StandardMaterial {
    diffuseColor?: Color3;
    specularColor?: Color3;
    diffuseTexture?: unknown;
    name: string;
    constructor(name: string) {
      this.name = name;
    }
  }
  const fakeMesh = (name: string): FakeMesh => {
    const mesh: FakeMesh = {
      name,
      isPickable: true,
      visibility: 1,
      isVisible: true,
      doNotSyncBoundingInfo: false,
      position: { y: 0 },
      thinInstanceCount: 0,
      thinInstanceSetBuffer: vi.fn(
        (_kind: string, buffer: Float32Array) => (mesh.buffer = buffer),
      ),
      thinInstanceRefreshBoundingInfo: vi.fn(),
      thinInstanceBufferUpdated: vi.fn(),
      // 28 triangles for the top cap, 28 for the bottom cap and 60 for the sides
      indices: Array.from({ length: 116 * 3 }, (_, i) => i),
      getIndices: () => mesh.indices,
      setIndices: vi.fn((indices: number[]) => (mesh.indices = indices)),
      clone: (cloneName: string) => fakeMesh(cloneName),
      setBoundingInfo: vi.fn(),
    };
    created.push(mesh);
    return mesh;
  };
  return {
    Vector3,
    BoundingInfo,
    Color3,
    StandardMaterial,
    Quaternion: {
      RotationAxis: (_axis: unknown, angle: number) => ({ angle }),
    },
    // a matrix is [angle, x, z] padded to 16 floats
    Matrix: {
      Compose: (
        _scale: unknown,
        rotation: { angle: number },
        position: { x: number; z: number },
      ) => {
        const values = new Float32Array(16);
        values.set([rotation.angle, position.x, position.z]);
        return {
          // like Babylon, which returns a Float32Array and not an Array
          asArray: () => values,
          copyToArray: (target: Float32Array, offset: number) =>
            target.set(values, offset),
        };
      },
    },
    Texture: { BILINEAR_SAMPLINGMODE: 3 },
    RawTexture: {
      CreateRGBATexture: (...args: unknown[]) => ({ texture: args }),
    },
    MeshBuilder: {
      ExtrudePolygon: (name: string, options: { shape: unknown[] }) => {
        const mesh = fakeMesh(name);
        mesh.shape = options.shape;
        return mesh;
      },
      CreateGround: (
        name: string,
        options: { width: number; height: number },
      ) => {
        const mesh = fakeMesh(name);
        mesh.options = options;
        return mesh;
      },
    },
  };
});

import {
  GRID_RADIUS,
  isOnBoard,
  setBuilding,
  type HexCoordinates,
} from "../src/board";
import { BuildingDefinition } from "../src/gameDefinitions";
import { getTileRotation } from "../src/forest";
import { TILE_TOP, hexToPixel } from "../src/hexGeometry";
import {
  createGroundMaterials,
  createTileRenderer,
  getForestTiles,
  makeMaterial,
} from "../src/TileRenderer";

type BoundsInfo = {
  minimum: { x: number; y: number; z: number };
  maximum: { x: number; y: number; z: number };
};

const scene = {} as Scene;
const TILE_COUNT = 3 * GRID_RADIUS * (GRID_RADIUS + 1) + 1;

function setup() {
  created.length = 0;
  const materials = createGroundMaterials(scene);
  const renderer = createTileRenderer(scene, materials);
  const meshes = created as FakeMesh[];
  // all chunk meshes of a ground material
  const mesh = (material: StandardMaterial) =>
    meshes.filter((m) => m.name.startsWith(`tile_${material.name}_`));
  const setGround = (coords: HexCoordinates, material: StandardMaterial) =>
    renderer.setGrounds([coords], material);
  return { materials, renderer, meshes, mesh, setGround };
}

const count = (group: FakeMesh[]) =>
  group.reduce((sum, m) => sum + m.thinInstanceCount, 0);
const uploads = (group: FakeMesh[]) =>
  group.reduce(
    (sum, m) => sum + m.thinInstanceBufferUpdated.mock.calls.length,
    0,
  );
const clearUploads = (group: FakeMesh[]) =>
  group.forEach((m) => m.thinInstanceBufferUpdated.mockClear());

// the [angle, x, z] of the matrices in the buffers of a group of meshes
function placed(group: FakeMesh[]) {
  const result = new Set<string>();
  for (const mesh of group) {
    for (let i = 0; i < mesh.thinInstanceCount; i++) {
      const [angle, x, z] = mesh.buffer!.slice(i * 16, i * 16 + 3);
      result.add([angle, x, z].map((value) => value.toFixed(4)).join(","));
    }
  }
  return result;
}

function matrixOf(q: number, r: number) {
  const center = hexToPixel(q, r);
  return [getTileRotation({ q, r }), center.x, center.z]
    .map((value) => value.toFixed(4))
    .join(",");
}

test("makeMaterial creates a named material without specular highlights", () => {
  const color = { r: 1, g: 0, b: 0 };
  const material = makeMaterial("test", color as never, scene);
  expect(material.name).toBe("test");
  expect(material.diffuseColor).toBe(color);
  expect(material.specularColor).toEqual({ r: 0, g: 0, b: 0 });
});

test("the ground materials keep their names and the forest floor is textured", () => {
  const materials = createGroundMaterials(scene);
  expect(materials.forestFloor.name).toBe("forestFloor");
  expect(materials.meadow.name).toBe("meadow");
  expect(materials.farmland.name).toBe("farmland");
  expect(materials.soil.name).toBe("soil");
  expect(materials.forestFloor.diffuseTexture).toBeDefined();
  expect(materials.meadow.diffuseTexture).toBeUndefined();
  expect(materials.soil.diffuseTexture).toBeUndefined();
  expect(materials.gravel.name).toBe("gravel");
  expect(materials.gravel.diffuseTexture).toBeUndefined();
});

test("exactly one base mesh per ground material holds the tiles as thin instances", () => {
  const { materials, renderer, meshes, mesh } = setup();
  expect(renderer.tiles).toHaveLength(TILE_COUNT);
  expect(renderer.tiles.every(isOnBoard)).toBe(true);

  const template = meshes.find((m) => m.name === "tileTemplate")!;
  expect(template.isPickable).toBe(false);
  expect(template.isVisible).toBe(false);
  // 6 rounded corners with 4 segments, i.e. 5 points each
  expect(template.shape).toHaveLength(30);
  // the bottom cap (the second 28 triangles) is dropped
  expect(template.indices).toHaveLength((116 - 28) * 3);
  expect(template.indices.slice(0, 84)).toEqual(
    Array.from({ length: 84 }, (_, i) => i),
  );
  expect(template.indices.slice(84, 87)).toEqual([168, 169, 170]);

  const tileMeshes = meshes.filter((m) => m.name.startsWith("tile_"));
  for (const material of Object.values(materials)) {
    // one mesh per spatial chunk, all sharing the material
    expect(mesh(material).length).toBeGreaterThan(10);
    expect(mesh(material).map((m) => m.material)).toEqual(
      mesh(material).map(() => material),
    );
  }
  expect(tileMeshes).toHaveLength(5 * mesh(materials.meadow).length);
  for (const tileMesh of tileMeshes) {
    expect(tileMesh.isPickable).toBe(false);
    // Babylon must not shrink the chunk bounds to the current instances
    expect(tileMesh.doNotSyncBoundingInfo).toBe(true);
    expect(tileMesh.setBoundingInfo).toHaveBeenCalledTimes(1);
  }
  // the chunk is far smaller than the board
  const bounds = mesh(materials.forestFloor).map(
    (m) => m.setBoundingInfo.mock.calls[0][0] as BoundsInfo,
  );
  for (const { minimum, maximum } of bounds) {
    expect(maximum.x - minimum.x).toBeLessThan(25);
    expect(maximum.z - minimum.z).toBeLessThan(25);
    expect(maximum.y).toBe(TILE_TOP);
  }
  // every tile lies inside the bounds of a chunk
  const center = hexToPixel(2, -1);
  expect(
    bounds.some(
      ({ minimum, maximum }) =>
        minimum.x <= center.x - 1 &&
        maximum.x >= center.x + 1 &&
        minimum.z <= center.z - 1 &&
        maximum.z >= center.z + 1,
    ),
  ).toBe(true);
  // empty layers are hidden, otherwise they are drawn once at the origin
  expect(mesh(materials.forestFloor).every((m) => m.isVisible)).toBe(true);
  expect(mesh(materials.meadow).some((m) => m.isVisible)).toBe(false);
  expect(mesh(materials.farmland).some((m) => m.isVisible)).toBe(false);
  expect(mesh(materials.soil).some((m) => m.isVisible)).toBe(false);

  expect(count(mesh(materials.forestFloor))).toBe(TILE_COUNT);
  expect(count(mesh(materials.meadow))).toBe(0);
  expect(count(mesh(materials.farmland))).toBe(0);
  expect(count(mesh(materials.soil))).toBe(0);
  expect(count(mesh(materials.gravel))).toBe(0);
  const forest = placed(mesh(materials.forestFloor));
  expect(forest.size).toBe(TILE_COUNT);
  expect(forest.has(matrixOf(2, -1))).toBe(true);
  // one finite matrix of 16 numbers per tile
  for (const { buffer, thinInstanceCount } of mesh(materials.forestFloor)) {
    expect(buffer).toHaveLength(thinInstanceCount * 16);
    expect(buffer!.every(Number.isFinite)).toBe(true);
  }
  expect(renderer.getInstanceStats()).toEqual({
    instances: TILE_COUNT,
    finiteMatrices: TILE_COUNT,
  });
  expect(renderer.getGround({ q: 1, r: -1 })).toBe("forestFloor");
});

test("one invisible pickable plane at the tile top is the only pickable mesh", () => {
  const { meshes } = setup();
  const pickable = meshes.filter((m) => m.isPickable);
  expect(pickable.map((m) => m.name)).toEqual(["tilePickPlane"]);
  expect(pickable[0].visibility).toBe(0);
  expect(pickable[0].position.y).toBe(TILE_TOP);
  // the plane covers the whole board
  const farthest = hexToPixel(GRID_RADIUS, 0).x;
  expect(pickable[0].options!.width / 2).toBeGreaterThan(farthest);
});

test("the instance stats do not count non-finite matrices", () => {
  const { materials, renderer, mesh } = setup();
  mesh(materials.forestFloor).find(
    (m) => m.thinInstanceCount > 1,
  )!.buffer![16] = NaN;
  expect(renderer.getInstanceStats()).toEqual({
    instances: TILE_COUNT,
    finiteMatrices: TILE_COUNT - 1,
  });
});

test("setGrounds moves a tile to the buffer of another material", () => {
  const { materials, renderer, mesh, setGround } = setup();
  const forest = mesh(materials.forestFloor);
  const meadow = mesh(materials.meadow);
  const farmland = mesh(materials.farmland);

  setGround({ q: 2, r: -1 }, materials.meadow);
  expect(renderer.getGround({ q: 2, r: -1 })).toBe("meadow");
  expect(renderer.getGround({ q: 0, r: 0 })).toBe("forestFloor");
  expect(count(forest)).toBe(TILE_COUNT - 1);
  expect(count(meadow)).toBe(1);
  expect(uploads(forest)).toBe(1);
  expect(uploads(meadow)).toBe(1);
  expect(placed(meadow)).toEqual(new Set([matrixOf(2, -1)]));
  expect(placed(forest).has(matrixOf(2, -1))).toBe(false);
  expect(placed(forest).size).toBe(TILE_COUNT - 1);

  // the same material again changes nothing
  clearUploads(meadow);
  setGround({ q: 2, r: -1 }, materials.meadow);
  expect(uploads(meadow)).toBe(0);

  // moving the tile on, and moving the last tile of a buffer
  setGround({ q: 0, r: 0 }, materials.meadow);
  setGround({ q: 2, r: -1 }, materials.farmland);
  expect(placed(meadow)).toEqual(new Set([matrixOf(0, 0)]));
  expect(placed(farmland)).toEqual(new Set([matrixOf(2, -1)]));
  expect(renderer.getGround({ q: 2, r: -1 })).toBe("farmland");
  expect(renderer.getGround({ q: 0, r: 0 })).toBe("meadow");
  expect(count(forest)).toBe(TILE_COUNT - 2);
  expect(placed(forest).size).toBe(TILE_COUNT - 2);

  // an earlier tile of a buffer is replaced by the last one
  setGround({ q: 1, r: 0 }, materials.meadow);
  setGround({ q: 0, r: 0 }, materials.farmland);
  expect(placed(meadow)).toEqual(new Set([matrixOf(1, 0)]));
  expect(placed(farmland)).toEqual(new Set([matrixOf(2, -1), matrixOf(0, 0)]));
});

test("layers are hidden when empty and visible again when they hold tiles", () => {
  const { materials, mesh, setGround } = setup();
  const meadow = mesh(materials.meadow);
  setGround({ q: 1, r: 0 }, materials.meadow);
  expect(meadow.filter((m) => m.isVisible)).toHaveLength(1);
  setGround({ q: 1, r: 0 }, materials.forestFloor);
  expect(meadow.some((m) => m.isVisible)).toBe(false);
  expect(count(meadow)).toBe(0);
});

test("setGrounds uploads each touched layer once", () => {
  const { materials, renderer, mesh } = setup();
  const forest = mesh(materials.forestFloor);
  const meadow = mesh(materials.meadow);
  const farmland = mesh(materials.farmland);
  const footprint = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
  ];
  renderer.setGrounds(footprint, materials.meadow);
  expect(uploads(forest)).toBe(1);
  expect(uploads(meadow)).toBe(1);
  expect(uploads(farmland)).toBe(0);
  expect(count(meadow)).toBe(3);
  expect(count(forest)).toBe(TILE_COUNT - 3);
  expect(placed(meadow)).toEqual(
    new Set(footprint.map(({ q, r }) => matrixOf(q, r))),
  );

  // moving them on to another layer touches the old and the new layer once
  clearUploads(meadow);
  renderer.setGrounds(footprint, materials.farmland);
  expect(uploads(meadow)).toBe(1);
  expect(uploads(farmland)).toBe(1);
  expect(uploads(forest)).toBe(1);
  expect(meadow.some((m) => m.isVisible)).toBe(false);
  expect(count(farmland)).toBe(3);

  // tiles that already have the ground are not uploaded again
  clearUploads(farmland);
  renderer.setGrounds(footprint, materials.farmland);
  expect(uploads(farmland)).toBe(0);
});

test("only tiles that hold a forest are returned as forest tiles", () => {
  const tiles = [
    { q: 5, r: 5 },
    { q: 6, r: 5 },
  ];
  expect(getForestTiles(tiles)).toEqual(tiles);
  setBuilding(tiles[0], BuildingDefinition.Farm);
  expect(getForestTiles(tiles)).toEqual([tiles[1]]);
});
