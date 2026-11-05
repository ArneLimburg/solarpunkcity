import { expect, test } from "vitest";
import {
  formatEcology,
  formatTiles,
  nonZeroResources,
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
