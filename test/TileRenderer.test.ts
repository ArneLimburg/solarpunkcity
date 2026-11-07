import { expect, test, vi } from "vitest";
import type { Scene, StandardMaterial } from "@babylonjs/core";

type FakeMesh = {
  name: string;
  shape?: unknown[];
  options?: { width: number; height: number };
  material?: { name: string };
  isPickable: boolean;
  visibility: number;
  position: { y: number };
  buffer?: Float32Array;
  thinInstanceCount: number;
  thinInstanceSetBuffer: ReturnType<typeof vi.fn>;
  thinInstanceRefreshBoundingInfo: ReturnType<typeof vi.fn>;
  thinInstanceBufferUpdated: ReturnType<typeof vi.fn>;
};

const created = vi.hoisted(() => [] as unknown[]);

vi.mock("../src/ForestRenderer", () => ({ TILE_TOP: 0.2 }));
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
      position: { y: 0 },
      thinInstanceCount: 0,
      thinInstanceSetBuffer: vi.fn(
        (_kind: string, buffer: Float32Array) => (mesh.buffer = buffer),
      ),
      thinInstanceRefreshBoundingInfo: vi.fn(),
      thinInstanceBufferUpdated: vi.fn(),
    };
    created.push(mesh);
    return mesh;
  };
  return {
    Vector3,
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
      ) => ({
        asArray: () => [
          rotation.angle,
          position.x,
          position.z,
          ...new Array(13).fill(0),
        ],
      }),
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

import { GRID_RADIUS, isOnBoard, setBuilding } from "../src/board";
import { BuildingDefinition } from "../src/gameDefinitions";
import { getTileRotation } from "../src/forest";
import { hexToPixel } from "../src/hexGeometry";
import {
  createGroundMaterials,
  createTileRenderer,
  getForestTiles,
  makeMaterial,
} from "../src/TileRenderer";

const scene = {} as Scene;
const TILE_COUNT = 3 * GRID_RADIUS * (GRID_RADIUS + 1) + 1;

function setup() {
  created.length = 0;
  const materials = createGroundMaterials(scene);
  const renderer = createTileRenderer(scene, materials);
  const meshes = created as FakeMesh[];
  const mesh = (material: StandardMaterial) =>
    meshes.find((m) => m.name === `tile_${material.name}`)!;
  return { materials, renderer, meshes, mesh };
}

// the [angle, x, z] of the matrices in the buffer of a mesh
function placed(mesh: FakeMesh) {
  const result = new Set<string>();
  for (let i = 0; i < mesh.thinInstanceCount; i++) {
    const [angle, x, z] = mesh.buffer!.slice(i * 16, i * 16 + 3);
    result.add([angle, x, z].map((value) => value.toFixed(4)).join(","));
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
  expect(materials.forestFloor.diffuseTexture).toBeDefined();
  expect(materials.meadow.diffuseTexture).toBeUndefined();
});

test("exactly one base mesh per ground material holds the tiles as thin instances", () => {
  const { materials, renderer, meshes, mesh } = setup();
  expect(renderer.tiles).toHaveLength(TILE_COUNT);
  expect(renderer.tiles.every(isOnBoard)).toBe(true);

  const tileMeshes = meshes.filter((m) => m.name.startsWith("tile_"));
  expect(tileMeshes.map((m) => m.name)).toEqual([
    "tile_forestFloor",
    "tile_meadow",
    "tile_farmland",
  ]);
  for (const tileMesh of tileMeshes) {
    expect(tileMesh.isPickable).toBe(false);
    // 6 rounded corners with 4 segments, i.e. 5 points each
    expect(tileMesh.shape).toHaveLength(30);
    expect(tileMesh.thinInstanceRefreshBoundingInfo).toHaveBeenCalledWith(true);
  }
  expect(mesh(materials.meadow).material).toBe(materials.meadow);

  expect(mesh(materials.forestFloor).thinInstanceCount).toBe(TILE_COUNT);
  expect(mesh(materials.meadow).thinInstanceCount).toBe(0);
  expect(mesh(materials.farmland).thinInstanceCount).toBe(0);
  const forest = placed(mesh(materials.forestFloor));
  expect(forest.size).toBe(TILE_COUNT);
  expect(forest.has(matrixOf(2, -1))).toBe(true);
  expect(renderer.getGround({ q: 1, r: -1 })).toBe("forestFloor");
});

test("one invisible pickable plane at the tile top is the only pickable mesh", () => {
  const { meshes } = setup();
  const pickable = meshes.filter((m) => m.isPickable);
  expect(pickable.map((m) => m.name)).toEqual(["tilePickPlane"]);
  expect(pickable[0].visibility).toBe(0);
  expect(pickable[0].position.y).toBe(0.2);
  // the plane covers the whole board
  const farthest = hexToPixel(GRID_RADIUS, 0).x;
  expect(pickable[0].options!.width / 2).toBeGreaterThan(farthest);
});

test("setGround moves a tile to the buffer of another material", () => {
  const { materials, renderer, mesh } = setup();
  const forest = mesh(materials.forestFloor);
  const meadow = mesh(materials.meadow);
  const farmland = mesh(materials.farmland);

  renderer.setGround({ q: 2, r: -1 }, materials.meadow);
  expect(renderer.getGround({ q: 2, r: -1 })).toBe("meadow");
  expect(renderer.getGround({ q: 0, r: 0 })).toBe("forestFloor");
  expect(forest.thinInstanceCount).toBe(TILE_COUNT - 1);
  expect(meadow.thinInstanceCount).toBe(1);
  expect(forest.thinInstanceBufferUpdated).toHaveBeenCalledWith("matrix");
  expect(meadow.thinInstanceBufferUpdated).toHaveBeenCalledWith("matrix");
  expect(placed(meadow)).toEqual(new Set([matrixOf(2, -1)]));
  expect(placed(forest).has(matrixOf(2, -1))).toBe(false);
  expect(placed(forest).size).toBe(TILE_COUNT - 1);

  // the same material again changes nothing
  meadow.thinInstanceBufferUpdated.mockClear();
  renderer.setGround({ q: 2, r: -1 }, materials.meadow);
  expect(meadow.thinInstanceBufferUpdated).not.toHaveBeenCalled();

  // moving the tile on, and moving the last tile of a buffer
  renderer.setGround({ q: 0, r: 0 }, materials.meadow);
  renderer.setGround({ q: 2, r: -1 }, materials.farmland);
  expect(placed(meadow)).toEqual(new Set([matrixOf(0, 0)]));
  expect(placed(farmland)).toEqual(new Set([matrixOf(2, -1)]));
  expect(renderer.getGround({ q: 2, r: -1 })).toBe("farmland");
  expect(renderer.getGround({ q: 0, r: 0 })).toBe("meadow");
  expect(forest.thinInstanceCount).toBe(TILE_COUNT - 2);
  expect(placed(forest).size).toBe(TILE_COUNT - 2);

  // an earlier tile of a buffer is replaced by the last one
  renderer.setGround({ q: 1, r: 0 }, materials.meadow);
  renderer.setGround({ q: 0, r: 0 }, materials.farmland);
  expect(placed(meadow)).toEqual(new Set([matrixOf(1, 0)]));
  expect(placed(farmland)).toEqual(new Set([matrixOf(2, -1), matrixOf(0, 0)]));
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
