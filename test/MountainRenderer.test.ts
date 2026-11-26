import { expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

type FakeMesh = {
  name: string;
  isPickable: boolean;
  material?: { backFaceCulling: boolean };
};

const meshes: FakeMesh[] = [];
const applied = vi.hoisted(() => ({ data: undefined as unknown }));

vi.mock("@babylonjs/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@babylonjs/core")>();
  class Mesh implements FakeMesh {
    isPickable = true;
    material?: { backFaceCulling: boolean };
    name: string;
    constructor(name: string) {
      this.name = name;
      meshes.push(this);
    }
  }
  class VertexData {
    applyToMesh() {
      applied.data = this;
    }
  }
  class StandardMaterial {
    backFaceCulling = true;
  }
  return { ...original, Mesh, VertexData, StandardMaterial };
});

import { createMountainRenderer } from "../src/MountainRenderer";

test("one pickable-free mesh with one material is created once", () => {
  const isInFrustum = vi.fn(() => true);
  const scene = {
    get meshes() {
      return meshes;
    },
    activeCamera: { isInFrustum },
  } as unknown as Scene;
  const renderer = createMountainRenderer(scene);
  expect(meshes).toHaveLength(1);
  expect(meshes[0].name).toBe("mountains");
  expect(meshes[0].isPickable).toBe(false);
  expect(meshes[0].material).toBeDefined();
  const data = applied.data as { indices: number[]; colors: number[] };
  expect(data.colors.length).toBeGreaterThan(0);
  const stats = renderer.getStats();
  expect(stats).toEqual({
    meshes: 1,
    triangles: data.indices.length / 3,
    pickable: false,
    inView: true,
  });
  expect(stats.triangles).toBeLessThan(4000);
  expect(isInFrustum).toHaveBeenCalledWith(meshes[0]);
  renderer.getStats();
  expect(meshes).toHaveLength(1);
});
