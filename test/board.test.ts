import { describe, expect, test } from "vitest";
import {
  getBuilding,
  getBuildings,
  isOnBoard,
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
});
