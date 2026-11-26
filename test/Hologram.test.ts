import { expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

vi.mock("@babylonjs/core", () => {
  class StandardMaterial {
    alpha = 1;
  }
  class Color3 {
    static Black = () => ({});
  }
  class TransformNode {
    enabled = true;
    position = {
      x: 0,
      y: 0,
      z: 0,
      set(x: number, y: number, z: number) {
        Object.assign(this, { x, y, z });
      },
    };
    setEnabled(enabled: boolean) {
      this.enabled = enabled;
    }
  }
  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }
  return { StandardMaterial, Color3, TransformNode, Vector3 };
});

import { createHologram } from "../src/Hologram";
import type { FarmRenderer } from "../src/FarmRenderer";
import type { WoodStorageRenderer } from "../src/WoodStorageRenderer";

type FakeClone = {
  isVisible: boolean;
  isPickable: boolean;
  material?: unknown;
};

function fakeTemplate(name: string) {
  const clones: FakeClone[] = [];
  return {
    name,
    clones,
    clone: vi.fn(() => {
      const clone: FakeClone = { isVisible: false, isPickable: true };
      clones.push(clone);
      return clone;
    }),
  };
}

function setup() {
  const farmTemplate = fakeTemplate("Farm");
  const storageTemplate = fakeTemplate("Storage");
  const farms = {
    getMeshes: vi.fn(() => [farmTemplate]),
  } as unknown as FarmRenderer;
  const woodStorage = {
    meshes: [storageTemplate],
  } as unknown as WoodStorageRenderer;
  const hologram = createHologram({} as Scene, farms, woodStorage);
  return { farms, farmTemplate, storageTemplate, hologram };
}

test("the hologram clones the model once and follows the tile", () => {
  const { farms, farmTemplate, hologram } = setup();
  hologram.update("Farm", { q: 1, r: 0 });
  hologram.update("Farm", { q: 2, r: 0 });
  expect(farms.getMeshes).toHaveBeenCalledTimes(1);
  expect(farmTemplate.clone).toHaveBeenCalledTimes(1);
  expect(farmTemplate.clones[0]).toMatchObject({
    isVisible: true,
    isPickable: false,
  });
  expect(farmTemplate.clones[0].material).toMatchObject({ alpha: 0.45 });
});

test("the hologram of the wood storage uses the log meshes", () => {
  const { storageTemplate, hologram } = setup();
  hologram.update("WoodStorage", { q: 0, r: 0 });
  expect(storageTemplate.clone).toHaveBeenCalledTimes(1);
});

test("types without a model get an empty hologram", () => {
  const { farms, hologram } = setup();
  hologram.update("Forest", { q: 0, r: 0 });
  expect(farms.getMeshes).not.toHaveBeenCalled();
});

test("the hologram hides without type or tile and switches types", () => {
  const { farmTemplate, storageTemplate, hologram } = setup();
  hologram.update("Farm", { q: 1, r: 0 });
  hologram.update("WoodStorage", { q: 1, r: 0 });
  hologram.update(undefined, { q: 1, r: 0 });
  hologram.update("WoodStorage", null);
  hologram.update(undefined, null);
  // switching back and forth reuses the cached models
  hologram.update("Farm", { q: 1, r: 0 });
  expect(farmTemplate.clone).toHaveBeenCalledTimes(1);
  expect(storageTemplate.clone).toHaveBeenCalledTimes(1);
});
