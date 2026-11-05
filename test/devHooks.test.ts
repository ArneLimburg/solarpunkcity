import { expect, test, vi } from "vitest";
import type { ArcRotateCamera, Engine, Scene } from "@babylonjs/core";

const project = vi.hoisted(() => vi.fn());

vi.mock("@babylonjs/core", () => {
  class Vector3 {
    static Project = project;
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }
  return { Vector3, Matrix: { IdentityReadOnly: {} } };
});
vi.mock("../src/TileRenderer", () => ({
  getTileMaterialName: (meshes: Record<string, { name: string }>, c: never) =>
    meshes[`${(c as { q: number }).q},${(c as { r: number }).r}`].name,
}));

import { build } from "../src/game";
import { createDevHooks } from "../src/devHooks";

function setup() {
  const toGlobal = vi.fn(() => "viewport");
  const hooks = createDevHooks({
    engine: { getRenderWidth: () => 200, getRenderHeight: () => 100 } as Engine,
    scene: { getTransformMatrix: () => "matrix" } as unknown as Scene,
    camera: { viewport: { toGlobal } } as unknown as ArcRotateCamera,
    canvas: { clientWidth: 100, clientHeight: 50 } as HTMLCanvasElement,
    ring: {
      tile: { q: 1, r: 1 },
      tiles: [{ q: 1, r: 1 }],
      show: vi.fn(),
      hide: vi.fn(),
    },
    tileMeshes: { "0,0": { name: "meadow" } } as never,
    models: { "0,0": { triangles: 42 } },
    getTreeCount: () => 3,
  });
  return { hooks, toGlobal };
}

test("tileToScreen scales projected positions to the canvas size", () => {
  const { hooks, toGlobal } = setup();
  project.mockReturnValue({ x: 100, y: 50, z: 0.5 });
  expect(hooks.tileToScreen({ q: 0, r: 0 })).toEqual({ x: 50, y: 25 });
  expect(project).toHaveBeenCalledWith(
    expect.objectContaining({ y: 0.1 }),
    {},
    "matrix",
    "viewport",
  );
  expect(toGlobal).toHaveBeenCalledWith(200, 100);
});

test("tileToScreen returns null for tiles outside the view", () => {
  const { hooks } = setup();
  for (const point of [
    { x: 1, y: 1, z: -1 },
    { x: 1, y: 1, z: 2 },
    { x: -1, y: 1, z: 0.5 },
    { x: 201, y: 1, z: 0.5 },
    { x: 1, y: -1, z: 0.5 },
    { x: 1, y: 101, z: 0.5 },
  ]) {
    project.mockReturnValue(point);
    expect(hooks.tileToScreen({ q: 0, r: 0 })).toBeNull();
  }
});

test("the hooks expose ring, models, trees, material and buildings", () => {
  const { hooks } = setup();
  expect(hooks.getRingTile()).toEqual({ q: 1, r: 1 });
  const tiles = hooks.getRingTiles();
  expect(tiles).toEqual([{ q: 1, r: 1 }]);
  expect(tiles).not.toBe(hooks.getRingTiles());
  expect(hooks.getTileMaterial({ q: 0, r: 0 })).toBe("meadow");
  expect(hooks.getModelCount({ q: 0, r: 0 })).toBe(1);
  expect(hooks.getModelCount({ q: 1, r: 0 })).toBe(0);
  expect(hooks.getModelTriangleCount({ q: 0, r: 0 })).toBe(42);
  expect(hooks.getModelTriangleCount({ q: 1, r: 0 })).toBe(0);
  expect(hooks.getTreeCount({ q: 0, r: 0 })).toBe(3);
  expect(hooks.getBuildingType({ q: 5, r: 5 })).toBe("Forest");
  expect(typeof hooks.addResources).toBe("function");
  expect(build).toBeDefined();
});
