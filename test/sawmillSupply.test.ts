import { beforeEach, expect, test, vi } from "vitest";

let board: typeof import("../src/board");
let game: typeof import("../src/game");
let definitions: typeof import("../src/gameDefinitions");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  game = await import("../src/game");
  definitions = await import("../src/gameDefinitions");
});

const SAWMILL = { q: -5, r: 3 };
const SECOND_SAWMILL = { q: -6, r: 3 };
const SITE = { q: -8, r: 3 };

function addSawmill(coords = SAWMILL) {
  board.setBuilding(coords, definitions.BuildingDefinition.Sawmill);
  return board.getPlacedBuilding(coords)!;
}

function addWoodStorage() {
  board.setBuilding(
    { q: 10, r: 0 },
    definitions.BuildingDefinition.WoodStorage,
  );
}

test("forestry fills the supply of a sawmill without wood storage, then it saws", () => {
  const sawmill = addSawmill();
  for (let week = 1; week <= 4; week++) {
    game.calculateWeek();
    expect(sawmill.sawmillWood).toBe(week);
  }
  expect(game.getState().resources.wood).toBe(0);
  const state = game.calculateWeek();
  expect(state.resources.planks).toBe(2);
  expect(game.getBuildingReport(SAWMILL)).toMatchObject({
    workers: 2,
    consumed: { wood: 4, labor: 2 },
  });
  expect(sawmill.sawmillWood).toBe(0);
});

test("forestry stops when sites, supplies and stock are full", () => {
  const sawmill = addSawmill();
  sawmill.sawmillWood = 4;
  // planks are full, so the sawmill does not work
  game.grantResources({ planks: 20 });
  const { workforce } = game.calculateWeek();
  expect(workforce!.forestry).toBe(0);
  expect(sawmill.sawmillWood).toBe(4);
  expect(game.getState().resources.wood).toBe(0);
});

test("the supply never exceeds the consumption of a week", () => {
  const sawmill = addSawmill();
  sawmill.sawmillWood = 3.5;
  game.grantResources({ planks: 20 });
  game.calculateWeek();
  expect(sawmill.sawmillWood).toBe(4);
});

test("construction sites are supplied before sawmills, sawmills before the stock", () => {
  const first = addSawmill(SAWMILL);
  const second = addSawmill(SECOND_SAWMILL);
  addWoodStorage();
  const homestead = definitions.BuildingDefinition.OrganicHomestead;
  board.placeBuilding(SITE, { ...homestead, maxBuilders: 0 }, 4, 3.5);
  // plank storage is full: sawmills do not work, forestry works
  game.grantResources({ planks: 40 });
  first.sawmillWood = 3.75;
  second.sawmillWood = 0;
  game.calculateWeek(); // 2 workers deliver 1 wood in total
  const [site] = board.getConstructionSites();
  expect(site.siteWood).toBeCloseTo(4);
  expect(first.sawmillWood).toBeCloseTo(4);
  expect(second.sawmillWood).toBeCloseTo(0.25);
  expect(game.getState().resources.wood).toBe(0);
});

test("a sawmill below its consumption consumes nothing and keeps its supply", () => {
  const sawmill = addSawmill();
  addWoodStorage();
  sawmill.sawmillWood = 1;
  game.grantResources({ wood: 2 });
  game.calculateWeek();
  expect(game.getBuildingReport(SAWMILL)).toMatchObject({
    workers: 0,
    status: "missing-resources",
  });
  // forestry delivered 1 wood into the supply; the stock stays
  expect(sawmill.sawmillWood).toBe(2);
  expect(game.getState().resources.wood).toBe(2);
});

test("a sawmill uses its supply before the stock", () => {
  const sawmill = addSawmill();
  addWoodStorage();
  sawmill.sawmillWood = 3;
  game.grantResources({ wood: 5 });
  const { resources } = game.calculateWeek();
  expect(resources.planks).toBe(2);
  expect(resources.wood).toBe(4);
  expect(sawmill.sawmillWood).toBe(0);
  expect(game.getBuildingReport(SAWMILL)!.consumed.wood).toBe(4);
});

test("replacing a sawmill discards its supply", () => {
  const sawmill = addSawmill();
  sawmill.sawmillWood = 4;
  game.build("OrganicHomestead", SAWMILL);
  const replaced = board.getPlacedBuilding(SAWMILL)!;
  expect(replaced).not.toBe(sawmill);
  expect(replaced.sawmillWood).toBeUndefined();
});
