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

function placeStorage(coords = { q: 10, r: 0 }) {
  game.build("WoodStorage", coords);
}

test("a new game has 0 wood and no capacity", () => {
  const state = game.getState();
  expect(state.resources.wood).toBe(0);
  expect(state.resources.food).toBe(0);
  expect(state.capacity.wood).toBe(0);
});

test("a wood storage can clear forest at game start, a homestead too", () => {
  expect(game.canBuild("OrganicHomestead", { q: 1, r: 0 })).toBe(true);
  expect(game.canBuild("WoodStorage", { q: 1, r: 0 })).toBe(true);
  placeStorage({ q: 1, r: 0 });
  const state = game.getState();
  expect(state.resources.wood).toBe(3);
  expect(state.capacity.wood).toBe(100);
  expect(state.constructionSites).toBe(0);
});

test("the capacity is 100 wood per wood storage", () => {
  placeStorage({ q: 1, r: 0 });
  placeStorage({ q: 5, r: 0 });
  expect(game.getState().capacity.wood).toBe(200);
  expect(game.getCapacity().food).toBe(0);
});

test("cleared wood that does not fit anywhere is lost", () => {
  board.setBuilding({ q: -5, r: 3 }, definitions.BuildingDefinition.Sawmill);
  const sawmill = board.getPlacedBuilding({ q: -5, r: 3 })!;
  game.unlockAll();
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(true);
  game.build("AgroIndustrial", { q: 0, r: 0 });
  expect(sawmill.sawmillWood).toBe(4);
  expect(game.getState().resources.wood).toBe(0);
});

test("a full storage does not stop building, the stock is capped", () => {
  placeStorage();
  game.grantResources({ wood: 47 }); // 50 wood
  game.unlockAll();
  expect(game.canBuild("AgroIndustrial", { q: 0, r: 0 })).toBe(true);
  game.build("AgroIndustrial", { q: 0, r: 0 });
  expect(game.getState().resources.wood).toBe(100);
});

test("cleared wood fills older sites and sawmills before the storage", () => {
  placeStorage();
  game.grantResources({ wood: -3 }); // empty stock (the storage site gave 3)
  board.setBuilding({ q: -5, r: 3 }, definitions.BuildingDefinition.Sawmill);
  const sawmill = board.getPlacedBuilding({ q: -5, r: 3 })!;
  const homestead = definitions.BuildingDefinition.OrganicHomestead;
  board.placeBuilding(
    { q: -8, r: 3 },
    { ...homestead, cost: { ...homestead.cost, wood: 10, labor: 10 } },
    10,
    0,
  );
  const [oldSite] = board.getConstructionSites();
  game.build("AgroIndustrial", { q: 0, r: 0 }); // the center tile gives none
  expect(oldSite.siteWood).toBe(10);
  expect(sawmill.sawmillWood).toBe(4);
  expect(game.getState().resources.wood).toBe(40);
});

test("replacing a wood storage caps the wood to the remaining capacity", () => {
  placeStorage({ q: 1, r: 0 });
  placeStorage({ q: 5, r: 0 });
  game.grantResources({ wood: 197 }); // 200 wood
  game.build("OrganicHomestead", { q: 1, r: 0 });
  expect(game.getState().capacity.wood).toBe(100);
  expect(game.getState().resources.wood).toBe(100);
});

test("without storage forests produce no wood and keep their labor free", () => {
  const week = game.calculateWeek();
  expect(week.resources.wood).toBe(0);
  expect(week.resources.labor).toBe(2);
});

test("forestry fills the storage week by week", () => {
  placeStorage();
  const week = game.calculateWeek();
  expect(week.resources.wood).toBeCloseTo(4); // 3 + 2 forests * 0.5
});

test("forestry never exceeds the capacity and stops when it is full", () => {
  placeStorage();
  game.grantResources({ wood: 96.7 }); // 99.7 wood
  const week = game.calculateWeek();
  expect(week.resources.wood).toBeCloseTo(100);
  expect(week.resources.labor).toBe(1); // the second forest did not work
  const full = game.calculateWeek();
  expect(full.resources.wood).toBeCloseTo(100);
  expect(full.resources.labor).toBe(2);
});

test("a building that produces something else does not touch the wood", () => {
  const forest = definitions.BuildingDefinition.Forest;
  board.setBuilding(
    { q: 20, r: 0 },
    {
      ...forest,
      produces: { ...forest.produces, wood: 0, ore: 1 },
      consumes: { ...forest.consumes, labor: 0 },
    },
  );
  game.grantResources({ wood: 5 }); // more wood than the capacity of 0
  const week = game.calculateWeek();
  expect(week.resources.ore).toBe(1);
  expect(week.resources.wood).toBe(5);
});
