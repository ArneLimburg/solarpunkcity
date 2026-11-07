import { expect, test, vi } from "vitest";
import type { CornerRenderer } from "../src/CornerRenderer";
import type { FarmRenderer } from "../src/FarmRenderer";
import type { ForestRenderer } from "../src/ForestRenderer";
import type { GroundMaterials, TileMeshes } from "../src/TileRenderer";
import { hexToPixel } from "../src/hexGeometry";

const setFootprintGround = vi.hoisted(() => vi.fn());
vi.mock("../src/TileRenderer", () => ({ setFootprintGround }));
vi.mock("@babylonjs/core", () => ({
  Vector3: class {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  },
}));

import { placeBuilding, type PlacedModel } from "../src/placeBuilding";

function setup() {
  const dispose = vi.fn();
  const model: PlacedModel = { dispose, triangles: 5 };
  const clearTile = vi.fn();
  const create = vi.fn(() => model);
  const models: Record<string, PlacedModel> = {};
  const tileMeshes = {} as TileMeshes;
  const materials = {} as GroundMaterials;
  const update = vi.fn();
  const parts = {
    corners: { update } as unknown as CornerRenderer,
    forest: { clearTile } as unknown as ForestRenderer,
    farms: { create } as unknown as FarmRenderer,
    tileMeshes,
    materials,
    models,
  };
  return { parts, dispose, model, clearTile, create, models, update };
}

test("a model building clears the footprint and shows its model", () => {
  const { parts, clearTile, create, models, model, update } = setup();
  placeBuilding({ q: 0, r: 0 }, "Farm", parts);
  expect(clearTile).toHaveBeenCalledTimes(7);
  expect(update).toHaveBeenCalledTimes(1);
  expect(update.mock.calls[0][0]).toHaveLength(7);
  expect(setFootprintGround).toHaveBeenCalledWith(
    parts.tileMeshes,
    parts.materials,
    { q: 0, r: 0 },
    "Farm",
    false,
  );
  expect(create).toHaveBeenCalledWith("Farm", hexToPixel(0, 0));
  expect(models["0,0"]).toBe(model);
});

test("a construction site shows bare soil and no model", () => {
  const { parts, clearTile, create, models, update } = setup();
  placeBuilding({ q: 0, r: 0 }, "Farm", parts, true);
  expect(clearTile).toHaveBeenCalledTimes(7);
  expect(update).toHaveBeenCalledTimes(1);
  expect(setFootprintGround).toHaveBeenLastCalledWith(
    parts.tileMeshes,
    parts.materials,
    { q: 0, r: 0 },
    "Farm",
    true,
  );
  expect(create).not.toHaveBeenCalled();
  expect(models).toEqual({});
});

test("previous models on the footprint are disposed", () => {
  const { parts, dispose, models, model } = setup();
  models["1,0"] = model;
  placeBuilding({ q: 0, r: 0 }, "Farm", parts);
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(models["1,0"]).toBeUndefined();
});

test("a building without a model only changes trees and ground", () => {
  const { parts, clearTile, create, models } = setup();
  placeBuilding({ q: 0, r: 0 }, "Forest", parts);
  expect(clearTile).toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  expect(models).toEqual({});
});
