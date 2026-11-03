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
  material?: { alpha: number };
  instances: FakeInstance[];
};

const meshes: FakeMesh[] = [];

vi.mock("@babylonjs/core", () => {
  class Mesh implements FakeMesh {
    isVisible = true;
    isPickable = true;
    material?: { alpha: number };
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
  class StandardMaterial {
    alpha = 1;
  }
  return {
    Mesh,
    VertexData,
    StandardMaterial,
    Color3: { Black: () => ({}) },
  };
});

import { createFarmRenderer, isModelType } from "../src/FarmRenderer";

test("each farm type is built once and shown with instances", () => {
  const renderer = createFarmRenderer({} as Scene, 1);
  const first = renderer.create("Farm", { x: 1, z: 2 });
  const second = renderer.create("Farm", { x: 3, z: 4 });
  expect(meshes).toHaveLength(1);
  expect(meshes[0].isVisible).toBe(false);
  expect(meshes[0].isPickable).toBe(false);
  expect(meshes[0].instances).toHaveLength(2);
  expect(meshes[0].instances[0].isPickable).toBe(false);
  expect(meshes[0].instances[1].position.set).toHaveBeenCalledWith(3, 0.1, 4);
  expect(first.triangles).toBeGreaterThan(0);
  expect(second.triangles).toBe(first.triangles);

  first.dispose();
  expect(meshes[0].instances[0].dispose).toHaveBeenCalled();
  expect(meshes[0].instances[1].dispose).not.toHaveBeenCalled();
});

test("glass parts go into a separate transparent mesh", () => {
  meshes.length = 0;
  const renderer = createFarmRenderer({} as Scene, 1);
  const model = renderer.create("AgroIndustrial", { x: 0, z: 0 });
  expect(meshes).toHaveLength(2);
  expect(meshes[0].material?.alpha).toBe(1);
  expect(meshes[1].material?.alpha).toBe(0.4);
  expect(model.triangles).toBeGreaterThan(0);
  model.dispose();
  expect(meshes[1].instances[0].dispose).toHaveBeenCalled();
});

test("the apartment building is built from code with one opaque mesh", () => {
  meshes.length = 0;
  const renderer = createFarmRenderer({} as Scene, 1);
  const model = renderer.create("AppartmentBuilding", { x: 0, z: 0 });
  expect(meshes).toHaveLength(1);
  expect(model.triangles).toBeGreaterThan(0);
  expect(model.triangles).toBeLessThanOrEqual(1000);
});

test("isModelType accepts the farms and the apartment building only", () => {
  expect(isModelType("Farm")).toBe(true);
  expect(isModelType("AppartmentBuilding")).toBe(true);
  expect(isModelType("Forest")).toBe(false);
});
