import { describe, expect, test } from "vitest";
import {
  completeSites,
  getBuilding,
  getBuildings,
  getConstructionSites,
  getFootprint,
  getFootprintRadius,
  getRiverCourse,
  getTileBuildings,
  GRID_RADIUS,
  isOnBoard,
  isUnderConstruction,
  placeBuilding,
  setBuilding,
  workOnSite,
  type HexCoordinates,
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

describe("river", () => {
  const course = getRiverCourse(GRID_RADIUS);
  const distance = (a: HexCoordinates, b: HexCoordinates) =>
    Math.max(
      Math.abs(a.q - b.q),
      Math.abs(a.r - b.r),
      Math.abs(a.q + a.r - b.q - b.r),
    );

  test("has one tile per row from the mountain to the sea edge", () => {
    expect(course).toHaveLength(2 * GRID_RADIUS + 1);
    expect(course.map((tile) => tile.r)).toEqual(
      Array.from({ length: 2 * GRID_RADIUS + 1 }, (_, i) => i - GRID_RADIUS),
    );
    expect(course[0]).toEqual({ q: 19, r: -30 });
    expect(course.every(isOnBoard)).toBe(true);
  });

  test("every tile is adjacent to the previous one", () => {
    for (let i = 1; i < course.length; i++) {
      expect(distance(course[i - 1], course[i])).toBe(1);
    }
  });

  test("passes the camp a few tiles to the east", () => {
    expect(course.find((tile) => tile.r === 0)).toEqual({ q: 4, r: 0 });
    for (const tile of getFootprint({ q: 0, r: 0 }, 1)) {
      expect(course).not.toContainEqual(tile);
    }
  });

  test("the board holds the river and nothing else changed", () => {
    for (const tile of course) {
      expect(getBuilding(tile)).toBe(BuildingDefinition.River);
    }
    expect(getBuilding({ q: 10, r: 10 })).toBe(BuildingDefinition.Forest);
    // ecology is the same as of forest
    expect(BuildingDefinition.River.ecology).toBe(
      BuildingDefinition.Forest.ecology,
    );
  });
});

test("construction sites are tracked in placement order until completed", () => {
  const farm = BuildingDefinition.Farm;
  placeBuilding({ q: 10, r: 0 }, farm, 3);
  placeBuilding({ q: -10, r: 0 }, farm, 5);
  setBuilding({ q: 0, r: 10 }, farm);
  expect(isUnderConstruction({ q: 10, r: 1 })).toBe(true);
  expect(isUnderConstruction({ q: 0, r: 10 })).toBe(false);
  expect(isUnderConstruction({ q: 99, r: 99 })).toBe(false);
  expect(getConstructionSites().map((site) => site.remainingWork)).toEqual([
    3, 5,
  ]);
  // sites are no buildings, their tiles count with ecology 0
  expect(getBuildings().length).toBe(2791 - 6 - 2 * 7);
  expect(
    getTileBuildings().filter((building) => building.ecology === 0),
  ).toHaveLength(14);

  workOnSite(getConstructionSites()[0], 3);
  workOnSite(getConstructionSites()[1], 2);
  const completed = completeSites();
  expect(completed.map((site) => site.center)).toEqual([{ q: 10, r: 0 }]);
  expect(isUnderConstruction({ q: 10, r: 0 })).toBe(false);
  expect(isUnderConstruction({ q: -10, r: 0 })).toBe(true);
  expect(getConstructionSites()).toHaveLength(1);
});
