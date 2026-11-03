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
  expect(resources.wood).toBeCloseTo(11); // 10 start + 2 forests * 0.5
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
  expect(resources.wood).toBeCloseTo(10.5);
  expectNoNegative(resources);
});

test("farm without enough labor does not produce", () => {
  board.setBuilding({ q: 0, r: 0 }, definitions.BuildingDefinition.Farm);
  const { resources, population } = game.calculateWeek();
  expect(population).toBe(2);
  expect(resources.wood).toBeCloseTo(11);
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
  expect(resources.wood).toBeCloseTo(11);
  expectNoNegative(resources);
});

test("canBuild is true on a recyclable tile when recycling pays for it", () => {
  game.grantResources({ wood: -10 }); // no start wood, only recycling
  // OrganicHomestead costs 4 wood, the forest recycles only 3 wood
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(false);
  game.grantResources({ wood: 1 });
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(true);
});

test("canBuild is false when there are not enough resources", () => {
  // AgroIndustrial costs 20 wood, only 10 + 3 (recycling) are available
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(false);
});

test("canBuild is false on an occupied tile without recycling", () => {
  board.setBuilding({ q: 0, r: 0 }, testBuilding({}));
  game.grantResources({ wood: 100 });
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(false);
});

test("grantResources makes a building affordable", () => {
  game.grantResources({ wood: 7 });
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(true);
});

test("build recycles the old building", () => {
  game.grantResources({ wood: 10 });
  game.build("Farm", { q: 1, r: 0 });
  expect(board.getBuilding({ q: 1, r: 0 })).toBe(
    definitions.BuildingDefinition.Farm,
  );
  // 10 + 10 (granted) + 3 (recycling) - 10 (cost) + 1 (forests)
  expect(game.calculateWeek().resources.wood).toBeCloseTo(14);
});

test("build without recycling only pays the cost", () => {
  board.setBuilding({ q: 1, r: 0 }, testBuilding({}));
  game.grantResources({ wood: 10 });
  game.build("OrganicHomestead", { q: 1, r: 0 });
  expect(board.getBuilding({ q: 1, r: 0 })).toBe(
    definitions.BuildingDefinition.OrganicHomestead,
  );
  // 10 + 10 (granted) - 4 (cost) + 0.5 (forest)
  expect(game.calculateWeek().resources.wood).toBeCloseTo(16.5);
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
  expect(state.resources.wood).toBe(10);
  expect(state.ecology).toBe(100);
  expect(state.satisfaction).toBe(100);
});

test("a fresh game starts with 10 wood", () => {
  expect(game.INITIAL_RESOURCES.wood).toBe(10);
});

test("clearing a forest yields 3 wood, a forest produces 0.5 wood", () => {
  const forest = definitions.BuildingDefinition.Forest;
  expect(forest.produces.wood).toBe(0.5);
  expect(forest.consumes.labor).toBe(1);
  game.build("OrganicHomestead", { q: 0, r: 0 });
  // 10 + 3 (recycling) - 4 (cost)
  expect(game.getState().resources.wood).toBe(9);
});

function replaceTiles(count: number, building: Building) {
  let replaced = 0;
  for (let q = -30; q <= 30 && replaced < count; q++) {
    for (let r = -30; r <= 30 && replaced < count; r++) {
      if (board.isOnBoard({ q, r })) {
        board.setBuilding({ q, r }, building);
        replaced++;
      }
    }
  }
}

test("ecology drops when forest is replaced", () => {
  const tiles = board.getBuildings().length;
  replaceTiles(10, definitions.BuildingDefinition.AgroIndustrial);
  // 10 tiles with -5 instead of 1
  const expected = ((tiles - 10 + 10 * -5) / tiles) * 100;
  expect(game.getState().ecology).toBeCloseTo(expected);
  expect(game.getState().satisfaction).toBeCloseTo(expected);
});

test("ecology of a homestead is 0.5 per tile", () => {
  const tiles = board.getBuildings().length;
  replaceTiles(10, definitions.BuildingDefinition.OrganicHomestead);
  expect(game.getState().ecology).toBeCloseTo(((tiles - 5) / tiles) * 100);
});

test("ecology is clamped to 0 %", () => {
  replaceTiles(
    board.getBuildings().length,
    definitions.BuildingDefinition.AgroIndustrial,
  );
  expect(game.getState().ecology).toBe(0);
});

test("ecology is clamped to 100 %", () => {
  replaceTiles(board.getBuildings().length, testBuilding({ ecology: 2 }));
  expect(game.getState().ecology).toBe(100);
});

// all tiles have the given ecology (in percent / 100); tile 0,0 produces food
function fillBoard(ecology: number, food: number) {
  replaceTiles(board.getBuildings().length, testBuilding({ ecology }));
  const forest = definitions.BuildingDefinition.Forest;
  board.setBuilding(
    { q: 0, r: 0 },
    testBuilding({
      ecology,
      resident: 100,
      produces: { ...forest.produces, wood: 0, food },
      consumes: { ...forest.consumes, labor: 0 },
    }),
  );
}

function grow(ecology: number, weeks: number): number {
  fillBoard(ecology, 1000);
  let population = 0;
  for (let week = 0; week < weeks; week++) {
    population = game.calculateWeek().population;
  }
  return population;
}

function foodCap(ecology: number): number {
  fillBoard(ecology, 12);
  let population = 0;
  for (let week = 0; week < 60; week++) {
    population = game.calculateWeek().population;
  }
  return population;
}

test("harvest factor is 1 at 90 % ecology and above", () => {
  expect(foodCap(1)).toBe(12);
});

test("harvest factor is 1 at exactly 90 % ecology", () => {
  expect(foodCap(0.9)).toBe(12);
});

test("harvest factor is 0.75 at 70 % ecology", () => {
  expect(foodCap(0.7)).toBeCloseTo(9); // 12 * 0.75
});

test("harvest factor is 0.5 at 50 % ecology and below", () => {
  expect(foodCap(0.5)).toBe(6);
  expect(foodCap(0)).toBe(6);
});

test("labor for food uses the harvest factor", () => {
  const laborLeft = (ecology: number) => {
    replaceTiles(board.getBuildings().length, testBuilding({ ecology }));
    const forest = definitions.BuildingDefinition.Forest;
    const farm = testBuilding({
      ecology,
      produces: { ...forest.produces, wood: 0, food: 2 },
      consumes: { ...forest.consumes, labor: 1 },
    });
    board.setBuilding({ q: 0, r: 0 }, farm);
    board.setBuilding({ q: 1, r: 0 }, farm);
    return game.calculateWeek().resources.labor;
  };
  expect(laborLeft(1)).toBe(1); // one building produces the 2 food needed
  expect(laborLeft(0.5)).toBe(0); // both are needed at factor 0.5
});

test("population growth is scaled by satisfaction", () => {
  // growth is ceil(population * 0.1 * satisfaction / 100)
  expect(grow(1, 10)).toBe(13);
});

test("population growth is halved at satisfaction 50", () => {
  expect(grow(0.5, 10)).toBe(12);
});

test("population does not grow with satisfaction 0", () => {
  expect(grow(0, 10)).toBe(2);
});

test("getState reflects a build", () => {
  game.grantResources({ wood: 100 });
  const before = game.getState();
  game.build("AppartmentBuilding", { q: 0, r: 0 });
  const after = game.getState();
  expect(after.resources.wood).toBeLessThan(before.resources.wood);
  expect(after.housing).toBeGreaterThan(before.housing);
});
