import { expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

type FakeMesh = {
  name: string;
  shape: unknown[];
  material?: { name: string };
  isPickable: boolean;
  buffer?: Float32Array;
  thinInstanceSetBuffer: ReturnType<typeof vi.fn>;
  thinInstanceRefreshBoundingInfo: ReturnType<typeof vi.fn>;
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
  class Color3 {}
  return {
    Vector3,
    Color3,
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
    MeshBuilder: {
      ExtrudePolygon: (name: string, options: { shape: unknown[] }) => {
        const mesh: FakeMesh = {
          name,
          shape: options.shape,
          isPickable: true,
          thinInstanceSetBuffer: vi.fn(
            (_kind: string, buffer: Float32Array | null) =>
              (mesh.buffer = buffer ?? undefined),
          ),
          thinInstanceRefreshBoundingInfo: vi.fn(),
        };
        created.push(mesh);
        return mesh;
      },
    },
  };
});
vi.mock("../src/TileRenderer", () => ({
  makeMaterial: (name: string) => ({ name }),
}));

import { createCornerRenderer } from "../src/CornerRenderer";
import { GRID_RADIUS, isOnBoard, type HexCoordinates } from "../src/board";

const scene = {} as Scene;
const materials = {
  forestFloor: { name: "forestFloor" },
  meadow: { name: "meadow" },
  farmland: { name: "farmland" },
} as never;

// 6 corners per tile; the 6 * GRID_RADIUS + 6 outward corners on the rim of the board belong to
// a single tile and are not filled
const filled = (tileCount: number) => 6 * tileCount - (6 * GRID_RADIUS + 6);

function allTiles() {
  const tiles: HexCoordinates[] = [];
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (isOnBoard({ q, r })) tiles.push({ q, r });
    }
  }
  return tiles;
}

function setup() {
  created.length = 0;
  const grounds: Record<string, string> = {};
  const getGround = (c: HexCoordinates) =>
    grounds[`${c.q},${c.r}`] ?? "forestFloor";
  const tiles = allTiles();
  const renderer = createCornerRenderer(scene, materials, tiles, getGround);
  const meshes = created as FakeMesh[];
  const count = (name: string) =>
    (meshes.find((m) => m.name === `corner_${name}`)!.buffer?.length ?? 0) / 16;
  return { renderer, grounds, meshes, count, tiles };
}

test("one non-pickable corner mesh per material shares the corner piece shape", () => {
  const { meshes } = setup();
  expect(meshes.map((m) => m.material!.name)).toEqual([
    "forestFloor",
    "meadow",
    "farmland",
    "cornerMixed",
  ]);
  expect(meshes.every((m) => !m.isPickable)).toBe(true);
  expect(meshes.every((m) => m.shape.length === 6)).toBe(true);
});

test("on the all-forest board the corners are filled except the outermost", () => {
  const { renderer, count, tiles } = setup();
  expect(count("forestFloor")).toBe(filled(tiles.length));
  expect(count("meadow")).toBe(0);
  expect(count("farmland")).toBe(0);
  expect(count("cornerMixed")).toBe(0);
  expect(renderer.getMaterialName({ tile: { q: 0, r: 0 }, corner: 0 })).toBe(
    "forestFloor",
  );
  expect(
    renderer.getMaterialName({ tile: { q: GRID_RADIUS, r: 0 }, corner: 0 }),
  ).toBeUndefined();
});

test("a matrix places a piece at its tile and rotates it to its corner", () => {
  const { meshes, tiles } = setup();
  const buffer = meshes[0].buffer!;
  expect(buffer.length).toBe(16 * filled(tiles.length));
  const angles = new Set<number>();
  for (let i = 0; i < buffer.length; i += 16) angles.add(buffer[i]);
  expect(angles.size).toBe(6);
});

test("a changed ground moves the fills of its vertices to the majority material", () => {
  const { renderer, grounds, count } = setup();
  grounds["0,0"] = "farmland";
  renderer.update([{ q: 0, r: 0 }]);
  // corner 0 of (0,0) meets (1,0) and (0,1): one farmland and two forest → forest
  expect(renderer.getMaterialName({ tile: { q: 0, r: 0 }, corner: 0 })).toBe(
    "forestFloor",
  );
  grounds["1,0"] = "farmland";
  renderer.update([{ q: 1, r: 0 }]);
  // two farmland and one forest → farmland, also for the pieces of the neighbors
  expect(renderer.getMaterialName({ tile: { q: 0, r: 0 }, corner: 0 })).toBe(
    "farmland",
  );
  expect(renderer.getMaterialName({ tile: { q: 1, r: 0 }, corner: 2 })).toBe(
    "farmland",
  );
  expect(renderer.getMaterialName({ tile: { q: 0, r: 1 }, corner: 4 })).toBe(
    "farmland",
  );
  expect(count("farmland")).toBeGreaterThan(0);
});

test("three different grounds at a vertex give the mixed fill", () => {
  const { renderer, grounds, count } = setup();
  grounds["0,0"] = "farmland";
  grounds["1,0"] = "meadow";
  renderer.update([
    { q: 0, r: 0 },
    { q: 1, r: 0 },
  ]);
  expect(renderer.getMaterialName({ tile: { q: 0, r: 0 }, corner: 0 })).toBe(
    "cornerMixed",
  );
  // the two tiles share two vertices, each with a forest tile as the third one
  expect(count("cornerMixed")).toBe(6);
});

test("tiles outside the board are ignored by an update", () => {
  const { renderer, count, tiles } = setup();
  renderer.update([{ q: GRID_RADIUS + 1, r: 0 }]);
  expect(count("forestFloor")).toBe(filled(tiles.length));
});
