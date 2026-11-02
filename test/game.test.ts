import { beforeEach, expect, test, vi } from "vitest";
import type { Building } from "../src/gameDefinitions";
import type { Resources } from "../src/resources";

let board: typeof import("../src/board");
let game: typeof import("../src/game");
let definitions: typeof import("../src/gameDefinitions");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  game = await import("../src/game");
  definitions = await import("../src/gameDefinitions");
});

function testBuilding(overrides: Partial<Building>): Building {
  const empty = definitions.BuildingDefinition.Forest;
  return {
    ...empty,
    name: "Test",
    produces: { ...definitions.BuildingDefinition.Forest.produces, wood: 0 },
    consumes: { ...definitions.BuildingDefinition.Forest.consumes, labor: 0 },
    ...overrides,
  };
}

function expectNoNegative(resources: Resources) {
  for (const value of Object.values(resources)) {
    expect(value).toBeGreaterThanOrEqual(0);
  }
}

test("cannot build outside the board", () => {
  expect(game.canBuild("Forest", { q: 31, r: -1 })).toBe(false);
});

test("fresh game", () => {
  const { resources, population } = game.calculateWeek();
  expect(population).toBe(2);
  expect(resources.wood).toBeCloseTo(0.4);
  expect(resources.labor).toBe(0);
  expectNoNegative(resources);
});

test("homestead lets the population grow", () => {
  board.setBuilding(
    { q: 0, r: 0 },
    definitions.BuildingDefinition.OrganicHomestead,
  );
  const { resources, population } = game.calculateWeek();
  expect(population).toBe(3);
  expect(resources.wood).toBeCloseTo(0.2);
  expectNoNegative(resources);
});

test("farm without enough labor does not produce", () => {
  board.setBuilding({ q: 0, r: 0 }, definitions.BuildingDefinition.Farm);
  const { resources, population } = game.calculateWeek();
  expect(population).toBe(2);
  expect(resources.wood).toBeCloseTo(0.4);
  expectNoNegative(resources);
});

test("building without its inputs produces nothing", () => {
  board.setBuilding(
    { q: 0, r: 0 },
    testBuilding({
      consumes: {
        ...definitions.BuildingDefinition.Forest.consumes,
        labor: 0,
        ore: 5,
      },
      produces: {
        ...definitions.BuildingDefinition.Forest.produces,
        wood: 0,
        steel: 1,
      },
    }),
  );
  const { resources } = game.calculateWeek();
  expect(resources.steel).toBe(0);
  expect(resources.ore).toBe(0);
  expectNoNegative(resources);
});

test("a building that cannot produce is skipped, the loop continues", () => {
  board.setBuilding(
    { q: -30, r: 0 },
    testBuilding({
      consumes: { ...definitions.BuildingDefinition.Forest.consumes, labor: 5 },
    }),
  );
  const { resources } = game.calculateWeek();
  expect(resources.wood).toBeCloseTo(0.4);
  expectNoNegative(resources);
});

test("labor is not stockpiled", () => {
  const empty = testBuilding({});
  for (let q = -30; q <= 30; q++) {
    for (let r = -30; r <= 30; r++) {
      if (board.isOnBoard({ q, r })) {
        board.setBuilding({ q, r }, empty);
      }
    }
  }
  expect(game.calculateWeek().resources.labor).toBe(2);

  board.setBuilding(
    { q: 0, r: 0 },
    testBuilding({
      resident: 0,
      produces: { ...empty.produces, food: 2 },
      consumes: { ...empty.consumes, labor: 2 },
    }),
  );
  const { resources } = game.calculateWeek();
  expect(resources.labor).toBe(0);
  expectNoNegative(resources);
});
