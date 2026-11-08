import { expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

type FakeInstance = {
  position: { set: ReturnType<typeof vi.fn> };
  isPickable: boolean;
  dispose: ReturnType<typeof vi.fn>;
};
type FakeMesh = {
  name: string;
  isVisible: boolean;
  isPickable: boolean;
  instances: FakeInstance[];
};

const meshes: FakeMesh[] = [];

vi.mock("@babylonjs/core", () => {
  class Mesh implements FakeMesh {
    isVisible = true;
    isPickable = true;
    material?: unknown;
    instances: FakeInstance[] = [];
    name: string;
    constructor(name: string) {
      this.name = name;
      meshes.push(this);
    }
    createInstance() {
      const instance = {
        position: { set: vi.fn() },
        isPickable: true,
        dispose: vi.fn(),
      };
      this.instances.push(instance);
      return instance;
    }
  }
  class VertexData {
    applyToMesh = vi.fn();
  }
  class StandardMaterial {}
  class Color3 {
    static Black = () => ({});
  }
  return { Mesh, VertexData, StandardMaterial, Color3 };
});

import { createWoodStorageRenderer } from "../src/WoodStorageRenderer";

test("the logs are built once and every log yard shares them", () => {
  const renderer = createWoodStorageRenderer({} as Scene, 1);
  expect(meshes.map((mesh) => mesh.name)).toEqual([
    "WoodStorageBark",
    "WoodStorageEndGrain",
  ]);
  const first = renderer.create({ x: 1, z: 2 });
  const second = renderer.create({ x: 3, z: 4 });
  expect(meshes).toHaveLength(2);
  for (const mesh of meshes) {
    expect(mesh.isVisible).toBe(false);
    expect(mesh.isPickable).toBe(false);
    expect(mesh.instances).toHaveLength(2);
    expect(mesh.instances[0].isPickable).toBe(false);
    expect(mesh.instances[1].position.set).toHaveBeenCalledWith(3, 0.1, 4);
  }
  expect(first.triangles).toBe(720);
  expect(second.triangles).toBe(720);

  first.dispose();
  expect(meshes[0].instances[0].dispose).toHaveBeenCalled();
  expect(meshes[1].instances[0].dispose).toHaveBeenCalled();
  expect(meshes[0].instances[1].dispose).not.toHaveBeenCalled();
});
