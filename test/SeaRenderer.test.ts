import { expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

type FakeMesh = {
  name: string;
  isVisible: boolean;
  isPickable: boolean;
  material?: { name: string; diffuseColor?: unknown };
  data?: { positions: number[]; colors?: number[]; indices: number[] };
};

const meshes: FakeMesh[] = [];

vi.mock("@babylonjs/core", () => {
  class Mesh implements FakeMesh {
    isVisible = true;
    isPickable = true;
    material?: { name: string };
    data?: FakeMesh["data"];
    name: string;
    constructor(name: string) {
      this.name = name;
      meshes.push(this);
    }
  }
  class VertexData {
    positions: number[] = [];
    colors?: number[];
    indices: number[] = [];
    applyToMesh(mesh: FakeMesh) {
      mesh.data = this;
    }
  }
  class StandardMaterial {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
  }
  class Color3 {
    static Black = () => new Color3(0, 0, 0);
    r: number;
    g: number;
    b: number;
    constructor(r: number, g: number, b: number) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  }
  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }
  return { Mesh, VertexData, StandardMaterial, Color3, Vector3 };
});
vi.mock("../src/TileRenderer", () => ({
  WATER_COLOR: { r: 0.1, g: 0.65, b: 0.75 },
}));

import { createSeaRenderer } from "../src/SeaRenderer";
import { BEACH_Y, SEA_Y } from "../src/sea";

test("one sea mesh and one beach mesh, neither pickable", () => {
  const renderer = createSeaRenderer({} as Scene);
  expect(meshes.map((mesh) => mesh.name)).toEqual(["sea", "beach"]);
  expect(renderer.meshes).toEqual(meshes);
  expect(meshes.map((mesh) => mesh.isPickable)).toEqual([false, false]);
  expect(meshes.map((mesh) => mesh.material?.name)).toEqual([
    "seaMaterial",
    "beachMaterial",
  ]);
});

test("the water lies below the beach and fades from the river colour to deep blue", () => {
  const [sea, beach] = meshes;
  const { positions, colors, indices } = sea.data!;
  const heights = positions.filter((_, i) => i % 3 === 1);
  expect(new Set(heights)).toEqual(new Set([SEA_Y]));
  expect(new Set(beach.data!.positions.filter((_, i) => i % 3 === 1))).toEqual(
    new Set([BEACH_Y]),
  );
  expect(SEA_Y).toBeLessThan(BEACH_Y);
  expect(beach.data!.colors).toBeUndefined();
  // the sea polygon and the channel: two triangle fans of four points
  expect(positions).toHaveLength(8 * 3);
  expect(indices).toHaveLength(4 * 3);
  // coast vertices carry the river colour, outer vertices the deep blue
  const vertexColor = (i: number) => colors!.slice(i * 4, i * 4 + 3);
  expect(vertexColor(0)).toEqual([0.1, 0.65, 0.75]);
  expect(vertexColor(2)[2]).toBeCloseTo(0.45);
  // the channel is entirely river coloured
  for (let i = 4; i < 8; i++) expect(vertexColor(i)).toEqual([0.1, 0.65, 0.75]);
});

test("the backdrop can be hidden and shown", () => {
  const renderer = createSeaRenderer({} as Scene);
  renderer.setVisible(false);
  expect(renderer.meshes.map((mesh) => mesh.isVisible)).toEqual([false, false]);
  renderer.setVisible(true);
  expect(renderer.meshes.map((mesh) => mesh.isVisible)).toEqual([true, true]);
});
