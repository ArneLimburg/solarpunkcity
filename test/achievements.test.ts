import { beforeEach, expect, test, vi } from "vitest";
import {
  INITIAL_ACHIEVED,
  getLockReason,
  getProducedResources,
  getRequiredResources,
  isUnlocked,
  type Resource,
} from "../src/achievements";
import type { BuildingType } from "../src/gameDefinitions";

let board: typeof import("../src/board");
let game: typeof import("../src/game");
let definitions: typeof import("../src/gameDefinitions");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  game = await import("../src/game");
  definitions = await import("../src/gameDefinitions");
});

const start = new Set<Resource>(INITIAL_ACHIEVED);

test("the required resources come from cost and consumption", () => {
  expect(getRequiredResources("AppartmentBuilding")).toEqual([
    "labor",
    "planks",
  ]);
  expect(getRequiredResources("Sawmill")).toEqual(["labor", "wood", "energy"]);
  expect(getProducedResources("Sawmill")).toEqual(["planks"]);
  expect(getProducedResources("SolarField")).toEqual(["energy"]);
});

test("at the start only apartment building, sawmill and agro-industrial farm are locked", () => {
  const types = Object.keys(definitions.BuildingTypes) as BuildingType[];
  expect(types.filter((type) => !isUnlocked(type, start))).toEqual([
    "AgroIndustrial",
    "AppartmentBuilding",
    "Sawmill",
  ]);
  expect(getLockReason("AppartmentBuilding", start)).toBe("Needs a sawmill");
  expect(getLockReason("Sawmill", start)).toBe("Needs a power plant");
  expect(getLockReason("AgroIndustrial", start)).toBe(
    "Needs a sawmill and a power plant",
  );
  expect(getLockReason("WoodenHouse", start)).toBeUndefined();
});

test("a finished solar field unlocks the sawmill, a finished sawmill the rest", () => {
  const { BuildingDefinition } = definitions;
  expect(game.getState().achieved).toEqual(INITIAL_ACHIEVED);
  board.setBuilding({ q: 1, r: 0 }, BuildingDefinition.SolarField);
  expect(game.canBuild("Sawmill", { q: 0, r: 0 })).toBe(true);
  expect(game.canBuild("AppartmentBuilding", { q: 0, r: 0 })).toBe(false);
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(false);
  board.setBuilding({ q: 2, r: 0 }, BuildingDefinition.Sawmill);
  expect(game.canBuild("AppartmentBuilding", { q: 0, r: 0 })).toBe(true);
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(true);
  expect(game.getState().achieved).toContain("planks");
  expect(game.getState().achieved).toContain("energy");
});

test("construction sites of a power plant or sawmill unlock nothing", () => {
  game.build("SolarField", { q: 1, r: 0 });
  expect(game.getState().achieved).toEqual(INITIAL_ACHIEVED);
  expect(game.canBuild("Sawmill", { q: 0, r: 0 })).toBe(false);
  game.finishConstruction();
  expect(game.getState().achieved).toContain("energy");
  expect(game.canBuild("Sawmill", { q: 0, r: 0 })).toBe(true);
  game.build("Sawmill", { q: 2, r: 0 });
  expect(game.getState().achieved).not.toContain("planks");
  expect(game.canBuild("AppartmentBuilding", { q: 0, r: 0 })).toBe(false);
});

test("achievements stay after the producer is demolished or replaced", () => {
  const { BuildingDefinition } = definitions;
  board.setBuilding({ q: 1, r: 0 }, BuildingDefinition.SolarField);
  board.setBuilding({ q: 2, r: 0 }, BuildingDefinition.Sawmill);
  game.build("WoodenHouse", { q: 2, r: 0 }); // replaces the only sawmill
  game.build("WoodenHouse", { q: 1, r: 0 }); // replaces the only power plant
  expect(game.getState().achieved).toContain("planks");
  expect(game.getState().achieved).toContain("energy");
  expect(game.canBuild("AppartmentBuilding", { q: 0, r: 0 })).toBe(true);
});

test("unlockAll achieves every resource", () => {
  game.unlockAll();
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(true);
});
