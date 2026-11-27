import { expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

type FakeInstance = {
  position: { set: ReturnType<typeof vi.fn> };
  rotation: { y: number };
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
        rotation: { y: 0 },
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

test("all wooden houses share the opaque and glass meshes within the budget", () => {
  meshes.length = 0;
  const renderer = createFarmRenderer({} as Scene, 1);
  const first = renderer.create("WoodenHouse", { x: 0, z: 0 });
  const second = renderer.create("WoodenHouse", { x: 5, z: 5 });
  const third = renderer.create("WoodenHouse", { x: 9, z: 9 });
  expect(meshes.length).toBeLessThanOrEqual(2);
  expect(meshes[0].instances).toHaveLength(3);
  expect(first.triangles).toBeGreaterThan(0);
  expect(first.triangles).toBeLessThan(1000);
  expect(second.triangles).toBe(first.triangles);
  expect(third.triangles).toBe(first.triangles);
});

test("the settlers' camp is built from code with one opaque mesh", () => {
  meshes.length = 0;
  const renderer = createFarmRenderer({} as Scene, 1);
  const model = renderer.create("SettlersCamp", { x: 0, z: 0 });
  expect(meshes).toHaveLength(1);
  expect(model.triangles).toBeGreaterThan(0);
  expect(model.triangles).toBeLessThan(1000);
});

test("all sawmills share one opaque mesh with vertex colors", () => {
  meshes.length = 0;
  const renderer = createFarmRenderer({} as Scene, 1);
  const first = renderer.create("Sawmill", { x: 0, z: 0 });
  const second = renderer.create("Sawmill", { x: 5, z: 5 });
  expect(meshes).toHaveLength(1);
  expect(meshes[0].instances).toHaveLength(2);
  expect(first.triangles).toBeGreaterThan(0);
  expect(first.triangles).toBeLessThan(1000);
  expect(second.triangles).toBe(first.triangles);
});

test("all supermarkets share an opaque and a glass mesh", () => {
  meshes.length = 0;
  const renderer = createFarmRenderer({} as Scene, 1);
  const first = renderer.create("Supermarket", { x: 0, z: 0 });
  const second = renderer.create("Supermarket", { x: 5, z: 5 });
  expect(meshes).toHaveLength(2);
  expect(meshes[0].instances).toHaveLength(2);
  expect(first.triangles).toBeGreaterThan(0);
  expect(first.triangles).toBeLessThan(1000);
  expect(second.triangles).toBe(first.triangles);
});

test("all hydro power plants share one opaque mesh and are turned to the river", () => {
  meshes.length = 0;
  const renderer = createFarmRenderer({} as Scene, 1);
  const first = renderer.create("HydroPowerPlant", { x: 0, z: 0 }, 0.5);
  const second = renderer.create("HydroPowerPlant", { x: 5, z: 5 });
  expect(meshes).toHaveLength(1);
  expect(meshes[0].instances).toHaveLength(2);
  expect(meshes[0].instances[0].rotation.y).toBe(0.5);
  expect(meshes[0].instances[1].rotation.y).toBe(0);
  expect(first.triangles).toBeGreaterThan(0);
  expect(first.triangles).toBeLessThan(1000);
  expect(second.triangles).toBe(first.triangles);
});

test("the template meshes of a type are exposed and built once", () => {
  meshes.length = 0;
  const renderer = createFarmRenderer({} as Scene, 1);
  const templates = renderer.getMeshes("Farm");
  expect(templates).toHaveLength(1);
  expect(renderer.getMeshes("Farm")).toBe(templates);
  expect(meshes).toHaveLength(1);
});

test("isModelType accepts the farms, the apartment building, the camp and the sawmill only", () => {
  expect(isModelType("Sawmill")).toBe(true);
  expect(isModelType("Supermarket")).toBe(true);
  expect(isModelType("Farm")).toBe(true);
  expect(isModelType("AppartmentBuilding")).toBe(true);
  expect(isModelType("WoodenHouse")).toBe(true);
  expect(isModelType("SettlersCamp")).toBe(true);
  expect(isModelType("HydroPowerPlant")).toBe(true);
  expect(isModelType("Forest")).toBe(false);
});
