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

function addSupermarket(coords = { q: 10, r: 0 }) {
  board.setBuilding(coords, definitions.BuildingDefinition.Supermarket);
}

function workersOfFarm() {
  return game.getBuildingReport({ q: 0, r: 0 })!.workers;
}

test("the supermarket is a storage building with the specified values", () => {
  const supermarket = definitions.BuildingDefinition.Supermarket;
  expect(definitions.BuildingTypes.Supermarket).toEqual({
    category: "STORAGE",
    icon: "storage/supermarket.svg",
    label: "Supermarket",
  });
  expect(supermarket.name).toBe("Supermarket");
  expect(supermarket.description).toBe(
    "Keeps up to 100 food in stock as a reserve against bad harvests",
  );
  expect(supermarket.size).toBe(1);
  expect(supermarket.resident).toBe(0);
  expect(supermarket.ecology).toBe(0);
  expect(supermarket.cost.wood).toBe(10);
  expect(supermarket.cost.labor).toBe(39);
  expect(supermarket.maxBuilders).toBe(3);
  expect(supermarket.storage?.food).toBe(100);
  expect(supermarket.recycling?.wood).toBe(5);
});

test("a new game has no food capacity, each supermarket adds 100", () => {
  expect(game.getState().capacity.food).toBe(0);
  addSupermarket({ q: 10, r: 0 });
  expect(game.getState().capacity.food).toBe(100);
  addSupermarket({ q: 12, r: 0 });
  expect(game.getState().capacity.food).toBe(200);
});

test("a supermarket under construction adds no capacity", () => {
  game.grantResources({ wood: 10 });
  game.build("Supermarket", { q: 10, r: 0 });
  expect(game.getState().capacity.food).toBe(0);
});

test("without a supermarket the food stock stays 0, the surplus is lost", () => {
  board.setBuilding({ q: 0, r: 0 }, definitions.BuildingDefinition.Farm);
  const state = game.calculateWeek();
  expect(state.resources.food).toBe(0);
  expect(state.foodBalance).toBeGreaterThan(0);
});

test("without a supermarket food buildings only cover the demand", () => {
  board.setBuilding({ q: 0, r: 0 }, definitions.BuildingDefinition.Farm);
  game.calculateWeek();
  expect(workersOfFarm()).toBe(1); // 5 food per worker, 2 residents
});

test("with a supermarket food buildings are staffed to fill it", () => {
  addSupermarket();
  board.setBuilding({ q: 0, r: 0 }, definitions.BuildingDefinition.Farm);
  const state = game.calculateWeek();
  expect(workersOfFarm()).toBe(2); // all labor, before the forests
  expect(state.resources.food).toBe(8); // 10 produced, 2 eaten
  expect(state.workforce?.forestry).toBe(0);
});

test("staffing stops once the stock reaches the capacity", () => {
  addSupermarket();
  board.setBuilding({ q: 0, r: 0 }, definitions.BuildingDefinition.Farm);
  game.grantResources({ food: 100 });
  game.calculateWeek();
  expect(workersOfFarm()).toBe(1); // the stock is full: only the demand
  expect(game.getState().resources.food).toBe(100); // capped
});

test("the food above the capacity is lost after the weekly tick", () => {
  addSupermarket();
  game.grantResources({ food: 500 });
  expect(game.calculateWeek().resources.food).toBeLessThanOrEqual(100);
});

test("growth uses the food before capping", () => {
  board.setBuilding(
    { q: 0, r: 0 },
    definitions.BuildingDefinition.AppartmentBuilding,
  );
  board.setBuilding({ q: 5, r: 0 }, definitions.BuildingDefinition.Farm);
  const state = game.calculateWeek();
  expect(state.resources.food).toBe(0); // capacity 0
  expect(state.population).toBe(3);
});

test("building over a supermarket drops the capacity, the food and gives wood", () => {
  addSupermarket({ q: 0, r: 0 });
  game.grantResources({ food: 100 });
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(true);
  game.build("OrganicHomestead", { q: 0, r: 0 });
  const state = game.getState();
  expect(state.capacity.food).toBe(0);
  expect(state.resources.food).toBe(0);
  // 5 recycled wood: 4 into the site (cost 4), the remaining wood has no room
  expect(board.getConstructionSites()[0].siteWood).toBe(4);
  expect(state.resources.wood).toBe(0);
});

test("building elsewhere keeps the food of a supermarket", () => {
  addSupermarket();
  game.grantResources({ food: 40 });
  game.grantResources({ wood: 10 });
  game.build("OrganicHomestead", { q: 0, r: 0 });
  expect(game.getState().resources.food).toBe(40);
});
