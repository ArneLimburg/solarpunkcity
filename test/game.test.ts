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
  // these tests assume an all-forest board; the settlers' camp has its own
  // tests in settlersCamp.test.ts
  board.setBuilding({ q: 0, r: 0 }, definitions.BuildingDefinition.Forest);
  // a game starts without wood and without storage; these tests are about
  // other rules, so they start with 10 wood and plenty of room for it
  // (the storage rules are covered in storage.test.ts)
  board.setBuilding(
    { q: 0, r: -30 },
    testBuilding({
      ecology: 1,
      storage: {
        ...definitions.BuildingDefinition.Forest.produces,
        wood: 1000,
      },
    }),
  );
  // a game also starts without food; most of these tests assume 10 food
  game.grantResources({ wood: 10, food: 10 });
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

// replaces the storage of the setup by one that also holds the given food;
// food is only kept up to the capacity, a game starts without any
function storeFood(food: number, ecology = 1) {
  board.setBuilding(
    { q: 0, r: -30 },
    testBuilding({
      ecology,
      storage: {
        ...definitions.BuildingDefinition.Forest.produces,
        wood: 1000,
        food,
      },
    }),
  );
}

function expectNoNegative(resources: Resources) {
  for (const value of Object.values(resources)) {
    expect(value).toBeGreaterThanOrEqual(0);
  }
}

test("cannot build outside the board", () => {
  expect(game.canBuild("Forest", { q: 31, r: -1 })).toBe(false);
});

test("cannot build on or over the river", () => {
  const tile = board
    .getRiverCourse(board.GRID_RADIUS)
    .find(({ r }) => r === -10)!;
  expect(game.canBuild("OrganicHomestead", tile)).toBe(false);
  // a farm next to the river touches it
  expect(game.canBuild("Farm", { q: tile.q - 1, r: tile.r })).toBe(false);
  expect(game.canBuild("Farm", { q: tile.q - 4, r: tile.r })).toBe(true);
});

test("the river does not change the ecology at game start", () => {
  expect(game.getState().ecology).toBe(100);
});

test("fresh game", () => {
  const { resources, population } = game.calculateWeek();
  expect(population).toBe(2);
  expect(resources.wood).toBeCloseTo(11); // 10 start + 2 forests * 0.5
  expect(resources.labor).toBe(0);
  expectNoNegative(resources);
});

test("the week is 0 initially and increases by 1 per calculateWeek", () => {
  expect(game.getState().week).toBe(0);
  expect(game.getState().week).toBe(0); // reading does not change it
  expect(game.calculateWeek().week).toBe(1);
  expect(game.calculateWeek().week).toBe(2);
  expect(game.getState().week).toBe(2);
});

test("homestead lets the population grow", () => {
  board.setBuilding(
    { q: 0, r: 0 },
    definitions.BuildingDefinition.OrganicHomestead,
  );
  const { resources, population } = game.calculateWeek();
  expect(population).toBe(3);
  // the homestead uses the labor of the old population, no forest works
  expect(resources.wood).toBeCloseTo(10);
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

test("canBuild does not check the wood stock", () => {
  game.grantResources({ wood: -10 }); // no wood at all
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(true);
  expect(game.canBuild("Farm", { q: 0, r: 0 })).toBe(true);
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(true);
});

test("canBuild is false when other resources are missing", () => {
  const homestead = definitions.BuildingDefinition.OrganicHomestead;
  homestead.cost = { ...homestead.cost, ore: 5 };
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(false);
  game.grantResources({ ore: 5 });
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(true);
});

test("a full storage does not stop building", () => {
  game.grantResources({ wood: 990 }); // the storage of 1000 is full
  expect(game.canBuild("Farm", { q: 0, r: 0 })).toBe(true);
  const homestead = definitions.BuildingDefinition.OrganicHomestead;
  homestead.cost = { ...homestead.cost, wood: 1 }; // 2 of the 3 wood are left
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(true);
});

test("canBuild is false if the footprint reaches over the board edge", () => {
  game.grantResources({ wood: 100 });
  expect(game.canBuild("Farm", { q: 29, r: 0 })).toBe(true);
  expect(game.canBuild("Farm", { q: 30, r: 0 })).toBe(false);
});

test("canBuild is false if the footprint overlaps an existing building", () => {
  game.grantResources({ wood: 100 });
  board.setBuilding({ q: 2, r: 0 }, testBuilding({}));
  expect(game.canBuild("Farm", { q: 0, r: 0 })).toBe(true);
  expect(game.canBuild("Farm", { q: 1, r: 0 })).toBe(false);
});

test("canBuild is false on an occupied tile without recycling", () => {
  board.setBuilding({ q: 0, r: 0 }, testBuilding({}));
  game.grantResources({ wood: 100 });
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(false);
});

test("canPlace ignores resources and allows forest tiles", () => {
  game.grantResources({ wood: -100 });
  expect(game.canPlace("Farm", { q: 0, r: 0 })).toBe(true);
});

test("canPlace is false off the board and on non-recyclable buildings", () => {
  expect(game.canPlace("Farm", { q: 29, r: 0 })).toBe(true);
  expect(game.canPlace("Farm", { q: 30, r: 0 })).toBe(false);
  board.setBuilding({ q: 2, r: 0 }, testBuilding({}));
  expect(game.canPlace("Farm", { q: 1, r: 0 })).toBe(false);
  expect(game.canPlace("Farm", { q: 0, r: 0 })).toBe(true);
});

test("Farm costs 25 wood and AgroIndustrial 40 planks", () => {
  expect(definitions.BuildingDefinition.Farm.cost.wood).toBe(25);
  expect(definitions.BuildingDefinition.AgroIndustrial.cost.planks).toBe(40);
});

test("build recycles all footprint tiles of the old buildings", () => {
  const before = game.getState().resources.wood;
  game.build("Farm", { q: 1, r: 0 });
  const footprint = board.getFootprint({ q: 1, r: 0 }, 1);
  expect(footprint.length).toBe(7);
  for (const tile of footprint) {
    expect(board.getBuilding(tile)).toBe(definitions.BuildingDefinition.Farm);
  }
  // the recycled wood goes into the supply of the site, nothing is paid
  expect(game.getState().resources.wood).toBe(before);
  expect(board.getConstructionSites()[0].siteWood).toBe(7 * 3);
});

test("a farm produces and houses once, not once per tile", () => {
  board.placeBuilding({ q: 0, r: 0 }, definitions.BuildingDefinition.Farm);
  expect(game.getState().housing).toBe(2);
  expect(board.getBuildings().length).toBe(board.getTileBuildings().length - 6);
});

test("a large building produces its food once, not once per tile", () => {
  const forest = definitions.BuildingDefinition.Forest;
  board.placeBuilding(
    { q: 0, r: 0 },
    testBuilding({
      size: 7,
      resident: 100,
      produces: { ...forest.produces, wood: 0, food: 12 },
    }),
  );
  let population = 0;
  for (let week = 0; week < 40; week++) {
    population = game.calculateWeek().population;
  }
  expect(population).toBe(12);
});

test("ecology counts every footprint tile", () => {
  game.grantResources({ wood: 100 });
  const tiles = board.getTileBuildings().length;
  board.placeBuilding(
    { q: 0, r: 0 },
    definitions.BuildingDefinition.AgroIndustrial,
  );
  const expected = ((tiles - 19 + 19 * -5) / tiles) * 100;
  expect(game.getState().ecology).toBeCloseTo(expected);
});

test("build without recycling only pays the cost", () => {
  storeFood(10);
  board.setBuilding({ q: 1, r: 0 }, testBuilding({}));
  game.grantResources({ wood: 10 });
  game.build("OrganicHomestead", { q: 1, r: 0 });
  expect(board.getBuilding({ q: 1, r: 0 })).toBe(
    definitions.BuildingDefinition.OrganicHomestead,
  );
  // 10 + 10 (granted) - 2 (wood used by the 2 builders this week)
  expect(game.calculateWeek().resources.wood).toBeCloseTo(18);
});

test("build recycles the old building", () => {
  storeFood(10);
  game.grantResources({ wood: 10 });
  game.build("OrganicHomestead", { q: 1, r: 0 });
  // the recycled 3 wood are in the site; the 2 builders use 2 of them
  expect(game.calculateWeek().resources.wood).toBeCloseTo(20);
  expect(board.getConstructionSites()[0].siteWood).toBeCloseTo(1);
});

test("population does not grow when no food remains after eating", () => {
  board.setBuilding(
    { q: 0, r: 0 },
    definitions.BuildingDefinition.AppartmentBuilding,
  );
  game.grantResources({ food: -8 }); // exactly what 2 residents eat
  const { population, resources } = game.calculateWeek();
  expect(population).toBe(2);
  expect(resources.food).toBe(0);
});

test("a fresh game starts with 0 food and a balance of 0", () => {
  expect(game.INITIAL_RESOURCES.food).toBe(0);
  game.grantResources({ food: -10 });
  expect(game.getState().resources.food).toBe(0);
  expect(game.getState().foodBalance).toBe(0);
});

test("food buildings are staffed for the possible growth without stock", () => {
  game.grantResources({ food: -10 });
  storeFood(3);
  board.setBuilding({ q: 0, r: 0 }, { ...farm(20, 4), resident: 5 });
  // demand 2 + possible growth 1 = 3 food, 5 per worker -> 1 worker;
  // the farm produces 5, 3 are left after eating: growth 1, stock 3
  const { resources, population, foodBalance } = game.calculateWeek();
  expect(foodBalance).toBeCloseTo(3);
  expect(population).toBe(3);
  expect(resources.food).toBeCloseTo(3);
});

test("a stock that covers the possible growth needs no extra workers", () => {
  game.grantResources({ food: -9 }); // 1 food covers the growth of 1
  board.setBuilding({ q: 0, r: 0 }, { ...farm(4, 4), resident: 5 });
  // target: demand 2 -> 2 workers (1 food each)
  const { foodBalance, population } = game.calculateWeek();
  expect(foodBalance).toBeCloseTo(0);
  expect(population).toBe(3);
});

test("growth uses the food left after eating, not the stock", () => {
  game.grantResources({ food: -10 });
  board.setBuilding({ q: 0, r: 0 }, { ...farm(2, 0), resident: 5 });
  // no stock, 2 produced, 2 eaten: nothing is left, so nobody moves in
  expect(game.calculateWeek().population).toBe(2);
});

function farm(food: number, labor: number) {
  const forest = definitions.BuildingDefinition.Forest;
  return testBuilding({
    produces: { ...forest.produces, wood: 0, food },
    consumes: { ...forest.consumes, labor },
  });
}

test("residents eat population x 1 food per week", () => {
  storeFood(10);
  const { resources, foodBalance } = game.calculateWeek();
  expect(resources.food).toBe(8);
  expect(foodBalance).toBe(-2);
});

test("farms produce at full capacity into the stock", () => {
  storeFood(13);
  board.setBuilding({ q: 0, r: 0 }, farm(5, 1));
  const { resources, foodBalance } = game.calculateWeek();
  expect(resources.food).toBe(13); // 10 + 5 - 2
  expect(foodBalance).toBe(3);
});

test("farm output depends on the harvest factor", () => {
  replaceTiles(board.getBuildings().length, testBuilding({ ecology: 0.5 }));
  storeFood(10, 0.5);
  board.setBuilding({ q: 0, r: 0 }, { ...farm(4, 1), ecology: 0.5 });
  const { resources, foodBalance } = game.calculateWeek();
  expect(resources.food).toBe(10); // 10 + 4 * 0.5 - 2
  expect(foodBalance).toBe(0);
});

test("a farm only takes the workers needed for the demand", () => {
  storeFood(13);
  board.setBuilding({ q: 0, r: 0 }, farm(20, 4));
  // demand 2, 5 food per worker -> 1 worker; the other one works in a forest
  const { resources, foodBalance } = game.calculateWeek();
  expect(foodBalance).toBeCloseTo(3);
  expect(resources.food).toBeCloseTo(13);
  expect(resources.wood).toBeCloseTo(10.5);
  expect(resources.labor).toBe(0);
});

test("a farm with 3 of 4 workers produces 3 of 4 of its food", () => {
  board.setBuilding({ q: 0, r: 0 }, { ...farm(4, 4), resident: 3 });
  game.calculateWeek(); // 2 workers, population grows to 3
  const { foodBalance } = game.calculateWeek();
  expect(foodBalance).toBeCloseTo(0); // 3 workers produce 3 of 4 food
});

test("food buildings are staffed by efficiency", () => {
  storeFood(15.5);
  board.setBuilding({ q: -1, r: 0 }, farm(3, 2));
  board.setBuilding({ q: 1, r: 0 }, farm(7.5, 1));
  // the efficient building needs 1 worker and covers the demand alone
  const { foodBalance, resources } = game.calculateWeek();
  expect(foodBalance).toBeCloseTo(5.5);
  expect(resources.food).toBeCloseTo(15.5);
  expect(resources.wood).toBeCloseTo(10.5);
});

test("the harvest factor is taken into account for the worker count", () => {
  replaceTiles(board.getBuildings().length, testBuilding({ ecology: 0 }));
  board.setBuilding({ q: 0, r: 0 }, { ...farm(4, 2), ecology: 0 });
  // factor 0.5 -> 1 food per worker, demand 2 -> 2 workers
  const { foodBalance, resources } = game.calculateWeek();
  expect(foodBalance).toBeCloseTo(0);
  expect(resources.labor).toBe(0);
});

test("food buildings that cannot cover the demand take all labor they use", () => {
  storeFood(10);
  board.setBuilding({ q: 0, r: 0 }, farm(1, 4));
  const { foodBalance, resources } = game.calculateWeek();
  expect(foodBalance).toBeCloseTo(-1.5); // 2 of 4 workers: 0.5 food
  expect(resources.food).toBeCloseTo(8.5);
  expect(resources.wood).toBeCloseTo(10);
});

test("homestead, farm and agro-industrial farm with population 3", () => {
  const { BuildingDefinition } = definitions;
  board.setBuilding({ q: -10, r: 0 }, BuildingDefinition.OrganicHomestead);
  board.setBuilding({ q: 0, r: 0 }, BuildingDefinition.Farm);
  board.setBuilding({ q: 10, r: 0 }, BuildingDefinition.AgroIndustrial);
  board.placeBuilding(
    board.getRiverCourse(board.GRID_RADIUS).find(({ r }) => r === -10)!,
    BuildingDefinition.HydroPowerPlant,
  );
  expect(game.calculateWeek().population).toBe(3);
  const { foodBalance, resources } = game.calculateWeek();
  expect(foodBalance).toBeCloseTo(4.5); // 1 worker on the agro-industrial farm
  expect(resources.wood).toBeCloseTo(10 + 0.5 + 1); // 1 + 2 workers in forests
  for (let week = 0; week < 6; week++) {
    game.calculateWeek();
  }
  expect(game.getState().population).toBe(5);
});

test("hunger empties the stock and shrinks the population", () => {
  game.grantResources({ food: -8.3 }); // 1.7 food for 2 residents
  const { population, resources, foodBalance } = game.calculateWeek();
  expect(resources.food).toBe(0);
  expect(population).toBe(1); // floor(1.7)
  expect(foodBalance).toBe(-2);
});

test("hunger shrinks a large population to the floored food", () => {
  board.setBuilding({ q: 0, r: 0 }, { ...farm(1000, 0), resident: 100 });
  for (let week = 0; week < 10; week++) {
    game.calculateWeek();
  }
  expect(game.getState().population).toBeGreaterThan(5);
  board.setBuilding({ q: 0, r: 0 }, testBuilding({ resident: 100 }));
  game.grantResources({ food: 4.7 - game.getState().resources.food });
  const result = game.calculateWeek();
  expect(result.population).toBe(4);
  expect(result.resources.food).toBe(0);
});

test("the population never shrinks below 1", () => {
  game.grantResources({ food: -10 });
  const { population, resources } = game.calculateWeek();
  expect(population).toBe(1);
  expect(resources.food).toBe(0);
  expect(game.calculateWeek().population).toBe(1);
});

test("growth is limited by the remaining food stock", () => {
  board.setBuilding({ q: 0, r: 0 }, testBuilding({ resident: 100 }));
  game.grantResources({ food: -7.5 }); // 2.5 food, 0.5 left after eating
  expect(game.calculateWeek().population).toBe(2);
});

test("growth is limited by housing", () => {
  board.setBuilding({ q: 0, r: 0 }, testBuilding({ resident: 3 }));
  expect(game.calculateWeek().population).toBe(3);
});

test("growth is limited by satisfaction", () => {
  replaceTiles(board.getBuildings().length, testBuilding({ ecology: 0 }));
  storeFood(10, 0);
  board.setBuilding(
    { q: 0, r: 0 },
    testBuilding({ resident: 100, ecology: 0 }),
  );
  game.calculateWeek(); // the first week still has the labor factor 100
  expect(game.calculateWeek().population).toBe(3);
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

test("a fresh game starts with 0 wood", () => {
  expect(game.INITIAL_RESOURCES.wood).toBe(0);
});

test("clearing a forest yields 3 wood, a forest produces 0.5 wood", () => {
  const forest = definitions.BuildingDefinition.Forest;
  expect(forest.produces.wood).toBe(0.5);
  expect(forest.consumes.labor).toBe(1);
  game.build("OrganicHomestead", { q: 0, r: 0 });
  // the 3 wood of the cleared forest go into the site, not into the stock
  expect(game.getState().resources.wood).toBe(10);
  expect(board.getConstructionSites()[0].siteWood).toBe(3);
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
  // satisfaction is the average of ecology and the labor factor (100 at start)
  expect(game.getState().satisfaction).toBeCloseTo((expected + 100) / 2);
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

test("population growth is scaled by satisfaction", () => {
  // growth is ceil(population * 0.1 * satisfaction / 100); all labor is free
  // here, so the labor factor is 0 after the first week
  expect(grow(1, 10)).toBe(12);
});

test("population growth is halved at satisfaction 50", () => {
  expect(grow(0.5, 10)).toBe(12);
});

test("population does not grow with satisfaction 0", () => {
  // only the first week has the labor factor 100
  expect(grow(0, 10)).toBe(3);
});

test("the labor factor follows the free labor share", () => {
  expect(game.getLaborFactor(0)).toBe(50);
  expect(game.getLaborFactor(0.05)).toBeCloseTo(75);
  expect(game.getLaborFactor(0.1)).toBe(100);
  expect(game.getLaborFactor(0.25)).toBe(100);
  expect(game.getLaborFactor(0.5)).toBeCloseTo(50);
  expect(game.getLaborFactor(0.75)).toBe(0);
  expect(game.getLaborFactor(1)).toBe(0);
});

test("a game starts with labor factor 100 and no free labor share", () => {
  const state = game.getState();
  expect(state.laborFactor).toBe(100);
  expect(state.freeLaborShare).toBe(0);
  expect(state.satisfaction).toBe(state.ecology / 2 + 50);
});

test("satisfaction uses the labor factor of the last week", () => {
  // the 2 residents work in forests: no free labor, factor 50
  const state = game.calculateWeek();
  expect(state.freeLaborShare).toBe(0);
  expect(state.laborFactor).toBe(50);
  expect(state.satisfaction).toBeCloseTo((state.ecology + 50) / 2);
});

test("half of the labor free gives the labor factor 50", () => {
  replaceTiles(board.getBuildings().length, testBuilding({ ecology: 1 }));
  board.setBuilding(
    { q: 0, r: 0 },
    testBuilding({
      ecology: 1,
      consumes: { ...definitions.BuildingDefinition.Forest.consumes, labor: 1 },
    }),
  );
  const state = game.calculateWeek();
  expect(state.freeLaborShare).toBe(50);
  expect(state.laborFactor).toBeCloseTo(50);
});

test("the labor factor of a week is used by the next growth", () => {
  // a free share of 100 % gives the labor factor 0: satisfaction = ecology / 2
  fillBoard(1, 1000);
  expect(game.calculateWeek().laborFactor).toBe(0);
  expect(game.getState().satisfaction).toBeCloseTo(50);
});

test("getState reflects a build", () => {
  game.grantResources({ wood: 100 });
  const before = game.getState();
  game.build("AppartmentBuilding", { q: 0, r: 0 });
  const after = game.getState();
  // the apartment needs planks, the recycled wood of the forest goes to the stock
  expect(after.resources.wood).toBe(before.resources.wood + 3);
  expect(after.constructionSites).toBe(before.constructionSites + 1);
});

test("the labor of the cost is not paid from the stock", () => {
  game.build("Farm", { q: 0, r: 0 });
  expect(game.getState().resources.labor).toBe(0);
  expect(game.getState().resources.wood).toBe(10);
});

test("canBuild does not check labor", () => {
  expect(game.getState().resources.labor).toBe(0);
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(true);
});

test("a construction site gives no housing, no ecology and cannot be built over", () => {
  game.grantResources({ wood: 100 });
  const ecology = game.getState().ecology;
  game.build("AppartmentBuilding", { q: 0, r: 0 });
  expect(game.getState().housing).toBe(0);
  expect(game.getState().ecology).toBeLessThan(ecology);
  expect(board.isUnderConstruction({ q: 0, r: 0 })).toBe(true);
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(false);
  expect(game.canPlace("OrganicHomestead", { q: 0, r: 0 })).toBe(false);
});

test("an organic homestead is finished after 2 weeks and produces from week 3", () => {
  storeFood(10);
  game.build("OrganicHomestead", { q: 0, r: 0 });
  const week1 = game.calculateWeek();
  expect(week1.constructionSites).toBe(1);
  expect(week1.foodBalance).toBe(-2);
  expect(game.takeCompletedBuildings()).toEqual([]);
  const week2 = game.calculateWeek();
  expect(week2.constructionSites).toBe(0);
  expect(week2.foodBalance).toBe(-2); // not produced in the week it is finished
  expect(game.takeCompletedBuildings()).toEqual([
    { coords: { q: 0, r: 0 }, type: "OrganicHomestead" },
  ]);
  expect(game.takeCompletedBuildings()).toEqual([]);
  expect(board.isUnderConstruction({ q: 0, r: 0 })).toBe(false);
  expect(game.calculateWeek().foodBalance).toBe(1); // 2 workers: 3 food
});

test("a single worker finishes a farm after 24 weeks", () => {
  game.build("Farm", { q: 0, r: 0 });
  game.grantResources({ food: -10 }); // hunger: the population shrinks to 1
  expect(game.calculateWeek().population).toBe(1);
  game.grantResources({ food: 1000 });
  for (let week = 1; week < 23; week++) {
    expect(game.calculateWeek().constructionSites).toBe(1);
  }
  const state = game.calculateWeek(); // housing 0: the population stays 1
  expect(state.population).toBe(1);
  expect(state.constructionSites).toBe(0);
});

test("sites get at most maxBuilders workers, the oldest first, the rest to forests", () => {
  board.placeBuilding({ q: 0, r: 0 }, testBuilding({ maxBuilders: 1 }), 10);
  board.placeBuilding({ q: 5, r: 0 }, testBuilding({ maxBuilders: 5 }), 10);
  game.grantResources({ food: 100 });
  const remaining = () =>
    board.getConstructionSites().map((site) => site.remainingWork);
  game.calculateWeek(); // 2 workers: 1 on the oldest site, 1 on the next
  expect(remaining()).toEqual([9, 9]);
});

test("leftover labor goes to the next site and then to other productions", () => {
  board.placeBuilding(
    { q: 0, r: 0 },
    testBuilding({ maxBuilders: 5 }),
    1, // needs a single worker
  );
  board.placeBuilding({ q: 5, r: 0 }, testBuilding({ maxBuilders: 5 }), 10);
  const week = game.calculateWeek(); // population 2
  // the first site is finished, the second one gets the leftover worker
  expect(board.getConstructionSites().map((s) => s.remainingWork)).toEqual([9]);
  expect(week.resources.labor).toBe(0);
});

test("food buildings are staffed before sites, sites before forests", () => {
  board.setBuilding({ q: 0, r: 0 }, farm(2, 1));
  board.placeBuilding({ q: 5, r: 0 }, testBuilding({ maxBuilders: 5 }), 10);
  // food demand 2, farm needs 1 worker (2 food); the other worker builds
  const { resources } = game.calculateWeek();
  expect(board.getConstructionSites()[0].remainingWork).toBe(9);
  expect(resources.wood).toBeCloseTo(10);
});

test("a site that is finished with less labor than maxBuilders only uses its remaining work", () => {
  board.placeBuilding({ q: 0, r: 0 }, testBuilding({ maxBuilders: 5 }), 1);
  const { resources } = game.calculateWeek();
  expect(board.getConstructionSites()).toEqual([]);
  // 1 worker builds, the other one works in a forest
  expect(resources.wood).toBeCloseTo(10.5);
  expect(resources.labor).toBe(0);
});

type Workforce = NonNullable<ReturnType<typeof game.getState>["workforce"]>;

function workforceSum(workforce: Workforce) {
  return (
    workforce.food +
    workforce.construction +
    workforce.production +
    workforce.forestry +
    workforce.free
  );
}

test("the workforce is undefined before the first tick", () => {
  expect(game.getState().workforce).toBeUndefined();
});

test("the workforce splits the workers into food, construction, forestry and free", () => {
  board.setBuilding({ q: 20, r: 0 }, farm(1, 1)); // 1 worker for 1 food
  board.placeBuilding({ q: 5, r: 0 }, testBuilding({ maxBuilders: 1 }), 10);
  const { workforce, resources } = game.calculateWeek(); // 2 workers
  expect(workforce).toEqual({
    food: 1,
    construction: 1,
    production: 0,
    forestry: 0,
    free: 0,
  });
  expect(workforce!.free).toBe(resources.labor);
});

test("the workforce counts the workers in forests", () => {
  const { workforce, resources } = game.calculateWeek(); // 2 workers
  expect(workforce).toEqual({
    food: 0,
    construction: 0,
    production: 0,
    forestry: 2,
    free: 0,
  });
  expect(workforce!.free).toBe(resources.labor);
});

test("the workforce reports workers without a job as free", () => {
  game.grantResources({ food: 100 });
  board.setBuilding({ q: 0, r: 0 }, testBuilding({ resident: 100 }));
  // the board is full of forests: remove their labor demand by making wood full
  game.grantResources({ wood: 2000 }); // storage 1000: forestry has no room
  const { workforce, resources } = game.calculateWeek();
  expect(workforce!.free).toBe(2);
  expect(workforce!.free).toBe(resources.labor);
});

test("the workforce adds up to the remaining workers after hunger", () => {
  game.grantResources({ food: -8.3 });
  const { workforce, population } = game.calculateWeek();
  expect(population).toBe(1);
  expect(workforceSum(workforce!)).toBe(1);
});
