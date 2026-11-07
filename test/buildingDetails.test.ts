import { expect, test } from "vitest";
import {
  formatEcology,
  formatTiles,
  nonZeroResources,
  unaffordableCosts,
} from "../src/buildingDetails";
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
  expect([...unaffordableCosts("OrganicHomestead", wood(0))]).toEqual(["wood"]);
  expect(unaffordableCosts("OrganicHomestead", wood(1)).size).toBe(0);
  expect([...unaffordableCosts("AgroIndustrial", wood(7))]).toEqual(["wood"]);
  expect(unaffordableCosts("AgroIndustrial", wood(8)).size).toBe(0);
  expect([...unaffordableCosts("AppartmentBuilding", wood(6))]).toEqual([
    "wood",
  ]);
  expect(unaffordableCosts("AppartmentBuilding", wood(7)).size).toBe(0);
});

test("unaffordableCosts never reports the construction work", () => {
  expect(unaffordableCosts("Farm", { ...emptyResources, wood: 100 }).size).toBe(
    0,
  );
});
