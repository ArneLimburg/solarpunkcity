import { expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

vi.mock("@babylonjs/core", () => {
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
  class Color3 {
    static Black = () => new Color3(0, 0, 0);
    r: number;
    g: number;
    b: number;
    constructor(r = 0, g = 0, b = 0) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  }
  class StandardMaterial {
    diffuseColor?: Color3;
    specularColor?: Color3;
    diffuseTexture?: unknown;
    name: string;
    constructor(name: string) {
      this.name = name;
    }
  }
  return {
    Vector3,
    Color3,
    StandardMaterial,
    Texture: { BILINEAR_SAMPLINGMODE: 3 },
    RawTexture: {
      CreateRGBATexture: (...args: unknown[]) => ({ texture: args }),
    },
    MeshBuilder: {
      ExtrudePolygon: (name: string, options: { shape: unknown[] }) => ({
        name,
        shape: options.shape,
        position: new Vector3(),
        rotation: { y: 0 },
        material: undefined,
      }),
    },
  };
});

import { GRID_RADIUS, isOnBoard } from "../src/board";
import {
  createGroundMaterials,
  createTiles,
  getTileMaterialName,
  makeMaterial,
  setFootprintGround,
} from "../src/TileRenderer";

const scene = {} as Scene;

test("makeMaterial creates a named material without specular highlights", () => {
  const color = { r: 1, g: 0, b: 0 };
  const material = makeMaterial("test", color as never, scene);
  expect(material.name).toBe("test");
  expect(material.diffuseColor).toBe(color);
  expect(material.specularColor).toEqual({ r: 0, g: 0, b: 0 });
});

test("the ground materials keep their names and the forest floor is textured", () => {
  const materials = createGroundMaterials(scene);
  expect(materials.forestFloor.name).toBe("forestFloor");
  expect(materials.meadow.name).toBe("meadow");
  expect(materials.farmland.name).toBe("farmland");
  expect(materials.forestFloor.diffuseTexture).toBeDefined();
  expect(materials.meadow.diffuseTexture).toBeUndefined();
});

test("a hex tile is created for every tile of the board", () => {
  const { forestFloor } = createGroundMaterials(scene);
  const { meshes, coordinates } = createTiles(scene, forestFloor);
  expect(coordinates.length).toBe(3 * GRID_RADIUS * (GRID_RADIUS + 1) + 1);
  expect(Object.keys(meshes)).toHaveLength(coordinates.length);
  expect(coordinates.every(isOnBoard)).toBe(true);

  const mesh = meshes["1,-1"] as never as {
    name: string;
    shape: unknown[];
    position: { y: number };
    material: unknown;
  };
  expect(mesh.name).toBe("hex_1_-1");
  expect(mesh.shape).toHaveLength(6);
  expect(mesh.position.y).toBe(0.1);
  expect(mesh.material).toBe(forestFloor);
  expect(getTileMaterialName(meshes, { q: 1, r: -1 })).toBe("forestFloor");
});

test("farms get farmland and other buildings a meadow on their footprint", () => {
  const materials = createGroundMaterials(scene);
  const { meshes } = createTiles(scene, materials.forestFloor);

  setFootprintGround(meshes, materials, { q: 0, r: 0 }, "Farm");
  expect(getTileMaterialName(meshes, { q: 0, r: 0 })).toBe("farmland");

  expect(getTileMaterialName(meshes, { q: 1, r: 0 })).toBe("farmland");
  expect(getTileMaterialName(meshes, { q: 2, r: 0 })).toBe("forestFloor");

  setFootprintGround(meshes, materials, { q: 0, r: 0 }, "AppartmentBuilding");
  expect(getTileMaterialName(meshes, { q: 0, r: 0 })).toBe("meadow");
  expect(getTileMaterialName(meshes, { q: 1, r: 0 })).toBe("farmland");
});
