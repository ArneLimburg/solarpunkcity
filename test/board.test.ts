import { describe, expect, test } from "vitest";
import {
  getBuilding,
  getBuildings,
  getFootprint,
  getFootprintRadius,
  getTileBuildings,
  isOnBoard,
  placeBuilding,
  setBuilding,
} from "../src/board";
import { BuildingDefinition } from "../src/gameDefinitions";

describe("isOnBoard", () => {
  test.each([
    { q: 0, r: 0 },
    { q: 30, r: 0 },
    { q: 30, r: -30 },
    { q: -15, r: -15 },
  ])("is true for %o", (coords) => {
    expect(isOnBoard(coords)).toBe(true);
  });

  test.each([
    { q: 31, r: -1 },
    { q: -1, r: 31 },
    { q: 20, r: 20 },
  ])("is false for %o", (coords) => {
    expect(isOnBoard(coords)).toBe(false);
  });
});

test("getBuilding and setBuilding", () => {
  const location = { q: 2, r: -1 };
  expect(getBuilding(location)).toBe(BuildingDefinition.Forest);
  setBuilding(location, BuildingDefinition.Farm);
  expect(getBuilding(location)).toBe(BuildingDefinition.Farm);
  expect(getBuilding({ q: 99, r: 99 })).toBeUndefined();
});

test("board has 2791 tiles", () => {
  expect(getBuildings().length).toBe(2791);
  expect(getTileBuildings().length).toBe(2791);
});

test.each([
  [0, 1],
  [1, 7],
  [2, 19],
])("footprint of radius %i has %i tiles", (radius, count) => {
  const center = { q: 3, r: -2 };
  const footprint = getFootprint(center, radius);
  expect(footprint.length).toBe(count);
  for (const tile of footprint) {
    const dq = tile.q - center.q;
    const dr = tile.r - center.r;
    expect(
      Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)),
    ).toBeLessThanOrEqual(radius);
  }
});

test("sizes map to footprint radii", () => {
  expect(getFootprintRadius(1)).toBe(0);
  expect(getFootprintRadius(7)).toBe(1);
  expect(getFootprintRadius(19)).toBe(2);
});

test("every building definition has a size of 1, 7 or 19", () => {
  for (const definition of Object.values(BuildingDefinition)) {
    expect([1, 7, 19]).toContain(definition.size);
  }
});

test("a placed building is counted once but occupies all its tiles", () => {
  placeBuilding({ q: 0, r: 0 }, BuildingDefinition.Farm);
  expect(getBuildings().length).toBe(2791 - 6);
  expect(getTileBuildings().length).toBe(2791);
  expect(getBuilding({ q: 1, r: -1 })).toBe(BuildingDefinition.Farm);
});
