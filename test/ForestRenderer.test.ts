import { expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

type FakeMesh = {
  name: string;
  material?: unknown;
  isPickable: boolean;
  thinInstanceSetBuffer: ReturnType<typeof vi.fn>;
  thinInstanceRefreshBoundingInfo: ReturnType<typeof vi.fn>;
  thinInstanceSetMatrixAt: ReturnType<typeof vi.fn>;
  thinInstanceBufferUpdated: ReturnType<typeof vi.fn>;
};

const meshes: FakeMesh[] = [];

function fakeMesh(name: string): FakeMesh {
  const mesh: FakeMesh = {
    name,
    isPickable: true,
    thinInstanceSetBuffer: vi.fn(),
    thinInstanceRefreshBoundingInfo: vi.fn(),
    thinInstanceSetMatrixAt: vi.fn(),
    thinInstanceBufferUpdated: vi.fn(),
  };
  meshes.push(mesh);
  return mesh;
}

vi.mock("@babylonjs/core", () => {
  class Vector3 {
    static Zero = () => new Vector3();
    static Up = () => new Vector3();
  }
  class Color3 {
    static Black = () => new Color3();
  }
  class StandardMaterial {}
  return {
    Vector3,
    Color3,
    StandardMaterial,
    Quaternion: {
      Identity: () => ({}),
      RotationAxis: () => ({}),
    },
    Matrix: {
      Compose: () => ({ asArray: () => new Array(16).fill(0) }),
    },
    MeshBuilder: {
      CreateCylinder: (name: string) => fakeMesh(name),
      CreateIcoSphere: (name: string) => fakeMesh(name),
    },
  };
});

import { createForest } from "../src/ForestRenderer";

test("the forest uses 3 unpickable base meshes with thin instances", () => {
  const forest = createForest(
    {} as Scene,
    [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    ],
    1,
    (tile) => ({ x: tile.q, z: tile.r }),
  );
  expect(meshes).toHaveLength(3);
  for (const mesh of meshes) {
    expect(mesh.isPickable).toBe(false);
    expect(mesh.thinInstanceSetBuffer).toHaveBeenCalledTimes(1);
  }
  // one trunk per tree
  const trunkBuffer = meshes[0].thinInstanceSetBuffer.mock.calls[0][1];
  expect(trunkBuffer).toHaveLength(10 * 16);
  expect(forest.getTreeCount({ q: 0, r: 0 })).toBe(5);
  expect(forest.getTreeCount({ q: 1, r: 0 })).toBe(5);
  expect(forest.getTreeCount({ q: 5, r: 5 })).toBe(0);
});

test("clearing a tile hides its trees and leaves other tiles alone", () => {
  meshes.length = 0;
  const forest = createForest(
    {} as Scene,
    [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    ],
    1,
    () => ({ x: 0, z: 0 }),
  );
  forest.clearTile({ q: 0, r: 0 });
  expect(forest.getTreeCount({ q: 0, r: 0 })).toBe(0);
  expect(forest.getTreeCount({ q: 1, r: 0 })).toBe(5);
  const hidden = meshes.reduce(
    (sum, mesh) => sum + mesh.thinInstanceSetMatrixAt.mock.calls.length,
    0,
  );
  expect(hidden).toBe(10); // trunk and crown of 5 trees
  expect(meshes[0].thinInstanceBufferUpdated).toHaveBeenCalledWith("matrix");

  // clearing again or clearing an unknown tile does nothing
  forest.clearTile({ q: 0, r: 0 });
  forest.clearTile({ q: 9, r: 9 });
  const hiddenAfter = meshes.reduce(
    (sum, mesh) => sum + mesh.thinInstanceSetMatrixAt.mock.calls.length,
    0,
  );
  expect(hiddenAfter).toBe(10);
});
