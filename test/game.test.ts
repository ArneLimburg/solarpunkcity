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
  game.grantResources({ wood: 10 });
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

test("canBuild is true on a recyclable tile when recycling pays for it", () => {
  game.grantResources({ wood: -10 }); // no start wood, only recycling
  // OrganicHomestead costs 4 wood, the forest recycles only 3 wood
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(false);
  game.grantResources({ wood: 1 });
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(true);
});

test("canBuild is false when there are not enough resources", () => {
  // AgroIndustrial costs 65 wood, only 7 + 19 * 3 (recycling) are available
  game.grantResources({ wood: -3 });
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(false);
});

test("canBuild depends on cost minus recycling of the whole footprint", () => {
  // Farm costs 25 wood, 7 forests recycle 21 wood
  game.grantResources({ wood: -6 }); // 4 + 21 = 25
  expect(game.canBuild("Farm", { q: 0, r: 0 })).toBe(true);
  game.grantResources({ wood: -1 });
  expect(game.canBuild("Farm", { q: 0, r: 0 })).toBe(false);
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

test("grantResources makes a building affordable", () => {
  game.grantResources({ wood: -4 });
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(false);
  game.grantResources({ wood: 2 }); // 8 + 57 = 65
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(true);
});

test("Farm costs 25 wood and AgroIndustrial 65 wood", () => {
  expect(definitions.BuildingDefinition.Farm.cost.wood).toBe(25);
  expect(definitions.BuildingDefinition.AgroIndustrial.cost.wood).toBe(65);
});

test("build recycles all footprint tiles of the old buildings", () => {
  const before = game.getState().resources.wood;
  game.build("Farm", { q: 1, r: 0 });
  const footprint = board.getFootprint({ q: 1, r: 0 }, 1);
  expect(footprint.length).toBe(7);
  for (const tile of footprint) {
    expect(board.getBuilding(tile)).toBe(definitions.BuildingDefinition.Farm);
  }
  expect(game.getState().resources.wood).toBe(before + 7 * 3 - 25);
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
  board.setBuilding({ q: 1, r: 0 }, testBuilding({}));
  game.grantResources({ wood: 10 });
  game.build("OrganicHomestead", { q: 1, r: 0 });
  expect(board.getBuilding({ q: 1, r: 0 })).toBe(
    definitions.BuildingDefinition.OrganicHomestead,
  );
  // 10 + 10 (granted) - 4 (cost) + 0.5 (forest)
  expect(game.calculateWeek().resources.wood).toBeCloseTo(16);
});

test("build recycles the old building", () => {
  game.grantResources({ wood: 10 });
  game.build("OrganicHomestead", { q: 1, r: 0 });
  // 10 + 10 (granted) + 3 (recycling) - 4 (cost); the homestead takes the labor
  expect(game.calculateWeek().resources.wood).toBeCloseTo(19);
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

test("a fresh game starts with 10 food and a balance of 0", () => {
  expect(game.INITIAL_RESOURCES.food).toBe(10);
  expect(game.getState().resources.food).toBe(10);
  expect(game.getState().foodBalance).toBe(0);
});

function farm(food: number, labor: number) {
  const forest = definitions.BuildingDefinition.Forest;
  return testBuilding({
    produces: { ...forest.produces, wood: 0, food },
    consumes: { ...forest.consumes, labor },
  });
}

test("residents eat population x 1 food per week", () => {
  const { resources, foodBalance } = game.calculateWeek();
  expect(resources.food).toBe(8);
  expect(foodBalance).toBe(-2);
});

test("farms produce at full capacity into the stock", () => {
  board.setBuilding({ q: 0, r: 0 }, farm(5, 1));
  const { resources, foodBalance } = game.calculateWeek();
  expect(resources.food).toBe(13); // 10 + 5 - 2
  expect(foodBalance).toBe(3);
});

test("farm output depends on the harvest factor", () => {
  replaceTiles(board.getBuildings().length, testBuilding({ ecology: 0.5 }));
  board.setBuilding({ q: 0, r: 0 }, { ...farm(4, 1), ecology: 0.5 });
  const { resources, foodBalance } = game.calculateWeek();
  expect(resources.food).toBe(10); // 10 + 4 * 0.5 - 2
  expect(foodBalance).toBe(0);
});

test("a farm only takes the workers needed for the demand", () => {
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
  board.setBuilding(
    { q: 0, r: 0 },
    testBuilding({ resident: 100, ecology: 0 }),
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

test("a fresh game starts with 0 wood", () => {
  expect(game.INITIAL_RESOURCES.wood).toBe(0);
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
  expect(after.constructionSites).toBe(before.constructionSites + 1);
});

test("the labor of the cost is not paid from the stock", () => {
  game.build("Farm", { q: 0, r: 0 });
  expect(game.getState().resources.labor).toBe(0);
  expect(game.getState().resources.wood).toBe(10 + 7 * 3 - 25);
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
