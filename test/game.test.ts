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
    recycling: undefined,
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

test("canBuild is true on a recyclable tile when recycling pays for it", () => {
  // OrganicHomestead costs 4 wood, the forest recycles 7 wood
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(true);
});

test("canBuild is false when there are not enough resources", () => {
  // Farm costs 10 wood, the forest recycles only 7 wood
  expect(game.canBuild("Farm", { q: 0, r: 0 })).toBe(false);
});

test("canBuild is false on an occupied tile without recycling", () => {
  board.setBuilding({ q: 0, r: 0 }, testBuilding({}));
  game.grantResources({ wood: 100 });
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(false);
});

test("grantResources makes a building affordable", () => {
  game.grantResources({ wood: 3 });
  expect(game.canBuild("Farm", { q: 0, r: 0 })).toBe(true);
});

test("build recycles the old building", () => {
  game.grantResources({ wood: 10 });
  game.build("Farm", { q: 1, r: 0 });
  expect(board.getBuilding({ q: 1, r: 0 })).toBe(
    definitions.BuildingDefinition.Farm,
  );
  // 10 + 7 (recycling) - 10 (cost) + 0.4 (forests)
  expect(game.calculateWeek().resources.wood).toBeCloseTo(7.4);
});

test("build without recycling only pays the cost", () => {
  board.setBuilding({ q: 1, r: 0 }, testBuilding({}));
  game.grantResources({ wood: 10 });
  game.build("OrganicHomestead", { q: 1, r: 0 });
  expect(board.getBuilding({ q: 1, r: 0 })).toBe(
    definitions.BuildingDefinition.OrganicHomestead,
  );
  // 10 - 4 (cost) + 0.2 (forest)
  expect(game.calculateWeek().resources.wood).toBeCloseTo(6.2);
});

test("population does not grow without food", () => {
  board.setBuilding(
    { q: 0, r: 0 },
    definitions.BuildingDefinition.AppartmentBuilding,
  );
  expect(game.calculateWeek().population).toBe(2);
});

function simulate(resident: number, food: number): number {
  const forest = definitions.BuildingDefinition.Forest;
  board.setBuilding(
    { q: 0, r: 0 },
    testBuilding({ resident, produces: { ...forest.produces, food } }),
  );
  let population = 0;
  for (let week = 0; week < 40; week++) {
    population = game.calculateWeek().population;
  }
  return population;
}

test("population growth is capped by housing", () => {
  expect(simulate(12, 100)).toBe(12);
});

test("population growth is capped by food", () => {
  expect(simulate(100, 12)).toBe(12);
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

test("getState returns the current values", () => {
  const state = game.getState();
  expect(state.population).toBe(2);
  expect(state.housing).toBe(0);
  expect(state.resources.wood).toBe(0);
});

test("getState reflects a build", () => {
  game.grantResources({ wood: 100 });
  const before = game.getState();
  game.build("AppartmentBuilding", { q: 0, r: 0 });
  const after = game.getState();
  expect(after.resources.wood).toBeLessThan(before.resources.wood);
  expect(after.housing).toBeGreaterThan(before.housing);
});
