import { expect, test } from "vitest";
import {
  formatEcology,
  formatTiles,
  nonZeroResources,
  unaffordableCosts,
  woodPerBuilderWeek,
} from "../src/buildingDetails";
import { BuildingDefinition } from "../src/gameDefinitions";
import { emptyResources } from "../src/resources";

test("nonZeroResources lists only non-zero values", () => {
  expect(nonZeroResources(emptyResources)).toEqual([]);
  expect(nonZeroResources({ ...emptyResources, wood: 4, labor: 2 })).toEqual([
    ["labor", 2],
    ["wood", 4],
  ]);
});

test("formatEcology adds a sign", () => {
  expect(formatEcology(0.5)).toBe("+0.5");
  expect(formatEcology(-5)).toBe("−5");
  expect(formatEcology(0)).toBe("0");
});

test("formatTiles uses singular and plural", () => {
  expect(formatTiles(1)).toBe("1 tile");
  expect(formatTiles(7)).toBe("7 tiles");
});

test("unaffordableCosts accounts for the best-case recycling", () => {
  const wood = (amount: number) => ({ ...emptyResources, wood: amount });
  // a building without construction work is paid in full when placed
  const storage = BuildingDefinition.WoodStorage;
  storage.cost = { ...emptyResources, wood: 4 };
  expect([...unaffordableCosts("WoodStorage", wood(0))]).toEqual(["wood"]);
  expect(unaffordableCosts("WoodStorage", wood(1)).size).toBe(0);
  storage.cost = { ...emptyResources, wood: 65 };
  expect([...unaffordableCosts("WoodStorage", wood(61))]).toEqual(["wood"]);
  expect(unaffordableCosts("WoodStorage", wood(62)).size).toBe(0);
});

test("unaffordableCosts never reports the wood of a construction site", () => {
  expect(unaffordableCosts("Farm", emptyResources).size).toBe(0);
  expect(unaffordableCosts("AgroIndustrial", emptyResources).size).toBe(0);
});

test("woodPerBuilderWeek is the wood cost per work", () => {
  expect(woodPerBuilderWeek("Farm")).toBeCloseTo(25 / 24);
  expect(woodPerBuilderWeek("WoodStorage")).toBe(0);
});

test("unaffordableCosts never reports the construction work", () => {
  expect(unaffordableCosts("Farm", { ...emptyResources, wood: 100 }).size).toBe(
    0,
  );
});
