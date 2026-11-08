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
  expect(state.resources.food).toBe(10);
  expect(state.capacity.wood).toBe(0);
});

test("a homestead cannot clear forest at game start, a wood storage can", () => {
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(false);
  expect(game.canBuild("WoodStorage", { q: 0, r: 0 })).toBe(true);
  placeStorage({ q: 0, r: 0 });
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

test("clearing is limited by the capacity", () => {
  placeStorage();
  const homestead = definitions.BuildingDefinition.OrganicHomestead;
  homestead.cost = { ...homestead.cost, wood: 1 }; // clearing leaves 2 wood
  game.grantResources({ wood: 95 }); // 98 wood: 98 + 3 - 1 = 100 fits
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(true);
  game.grantResources({ wood: 1 }); // 99 + 3 - 1 = 101 does not fit
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(false);
});

test("a wood storage adds its capacity before the limit is checked", () => {
  placeStorage();
  game.grantResources({ wood: 97 }); // 100 wood, full
  expect(game.canBuild("WoodStorage", { q: 0, r: 0 })).toBe(true);
  placeStorage({ q: 0, r: 0 });
  expect(game.getState().resources.wood).toBe(103);
  expect(game.getState().capacity.wood).toBe(200);
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
