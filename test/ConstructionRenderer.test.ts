import { expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

vi.mock("@babylonjs/core", () => {
  class Plane {
    a!: number;
    b!: number;
    c!: number;
    d!: number;
    constructor(a: number, b: number, c: number, d: number) {
      Object.assign(this, { a, b, c, d });
    }
  }
  class Color3 {
    static Black = () => ({});
  }
  class StandardMaterial {
    alpha = 1;
    clipPlane: unknown = null;
    dispose = vi.fn();
  }
  class TransformNode {
    position = {
      x: 0,
      y: 0,
      z: 0,
      set(x: number, y: number, z: number) {
        Object.assign(this, { x, y, z });
      },
    };
    rotation = { y: 0 };
    dispose = vi.fn();
  }
  return { Plane, Color3, StandardMaterial, TransformNode };
});

import { createConstructionRenderer } from "../src/ConstructionRenderer";
import type { FarmRenderer } from "../src/FarmRenderer";
import type { WoodStorageRenderer } from "../src/WoodStorageRenderer";
import { TILE_TOP } from "../src/hexGeometry";

type FakeMaterial = {
  clipPlane: { b: number; d: number } | null;
  dispose: ReturnType<typeof vi.fn>;
};
type Clone = {
  name: string;
  isVisible: boolean;
  isPickable: boolean;
  material?: FakeMaterial;
};

function fakeTemplate(name: string, height: number) {
  const clones: Clone[] = [];
  return {
    name,
    clones,
    material: {
      clone: (materialName: string): FakeMaterial & { name: string } => ({
        name: materialName,
        clipPlane: null,
        dispose: vi.fn(),
      }),
    },
    getBoundingInfo: () => ({ maximum: { y: height } }),
    clone: vi.fn((cloneName: string) => {
      const clone: Clone = {
        name: cloneName,
        isVisible: false,
        isPickable: true,
      };
      clones.push(clone);
      return clone;
    }),
  };
}

function setup() {
  const farm = fakeTemplate("Farm", 2);
  const glass = fakeTemplate("FarmGlass", 4);
  const log = fakeTemplate("Log", 1);
  const farms = {
    getMeshes: vi.fn(() => [farm, glass]),
  } as unknown as FarmRenderer;
  const woodStorage = { meshes: [log] } as unknown as WoodStorageRenderer;
  const renderer = createConstructionRenderer({} as Scene, farms, woodStorage);
  return { farm, glass, log, farms, renderer };
}

test("a site starts as a hologram and shares the template geometry", () => {
  const { farm, glass, farms, renderer } = setup();
  const site = renderer.create("Farm", { x: 1, z: 2 }, 0.5);
  expect(farms.getMeshes).toHaveBeenCalledWith("Farm");
  // a finished and a blueprint clone per template mesh
  expect(farm.clone).toHaveBeenCalledTimes(2);
  expect(glass.clone).toHaveBeenCalledTimes(2);
  const [solid, blueprint] = farm.clones;
  expect(solid).toMatchObject({ isVisible: true, isPickable: false });
  expect(blueprint).toMatchObject({ isVisible: true, isPickable: false });
  expect(blueprint.material).toMatchObject({ alpha: 0.45 });
  expect(solid.material).not.toBe(blueprint.material);
  expect(site.getFill()).toBe(0);
  // nothing of the finished model is visible, the whole hologram is
  expect(solid.material!.clipPlane).toMatchObject({ b: 1, d: -TILE_TOP });
  expect(blueprint.material!.clipPlane).toMatchObject({ b: -1, d: TILE_TOP });
});

test("the progress line rises with the percentage of the highest mesh", () => {
  const { farm, renderer } = setup();
  const site = renderer.create("Farm", { x: 0, z: 0 }, 0);
  site.setProgress(50);
  expect(site.getFill()).toBe(0.5);
  const [solid, blueprint] = farm.clones;
  const level = TILE_TOP + 2; // half of the height 4
  expect(solid.material!.clipPlane).toMatchObject({ b: 1, d: -level });
  expect(blueprint.material!.clipPlane).toMatchObject({ b: -1, d: level });
});

test("sites have their own materials and progress", () => {
  const { farm, renderer } = setup();
  const first = renderer.create("Farm", { x: 0, z: 0 }, 0);
  const second = renderer.create("Farm", { x: 3, z: 0 }, 0);
  first.setProgress(25);
  second.setProgress(75);
  expect(first.getFill()).toBe(0.25);
  expect(second.getFill()).toBe(0.75);
  const solid1 = farm.clones[0];
  const solid2 = farm.clones[2];
  expect(solid1.material).not.toBe(solid2.material);
  expect(solid1.material!.clipPlane).not.toEqual(solid2.material!.clipPlane);
});

test("the wood storage uses the log meshes", () => {
  const { log, farms, renderer } = setup();
  renderer.create("WoodStorage", { x: 0, z: 0 }, 0);
  expect(log.clone).toHaveBeenCalledTimes(2);
  expect(farms.getMeshes).not.toHaveBeenCalled();
});

test("disposing releases the materials and the node", () => {
  const { farm, renderer } = setup();
  const site = renderer.create("Farm", { x: 0, z: 0 }, 0);
  const solid = farm.clones[0].material!;
  const hologram = farm.clones[1].material!;
  site.dispose();
  expect(solid.dispose).toHaveBeenCalledTimes(1);
  expect(hologram.dispose).toHaveBeenCalledTimes(1);
});
