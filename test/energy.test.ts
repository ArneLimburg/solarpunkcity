import { beforeEach, expect, test, vi } from "vitest";
import type { Building } from "../src/gameDefinitions";

let board: typeof import("../src/board");
let game: typeof import("../src/game");
let definitions: typeof import("../src/gameDefinitions");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  game = await import("../src/game");
  definitions = await import("../src/gameDefinitions");
  board.setBuilding({ q: 0, r: 0 }, definitions.BuildingDefinition.Forest);
  game.grantResources({ wood: 10, food: 10 });
});

const riverTile = () =>
  board.getRiverCourse(board.GRID_RADIUS).find(({ r }) => r === -10)!;

function placeHydro() {
  const tile = riverTile();
  board.placeBuilding(tile, definitions.BuildingDefinition.HydroPowerPlant);
  return tile;
}

// a building that only consumes energy (and optionally produces food)
function consumer(
  energy: number,
  overrides: Partial<Building> = {},
  labor = 0,
): Building {
  const { Forest } = definitions.BuildingDefinition;
  return {
    ...Forest,
    name: "Consumer",
    produces: { ...Forest.produces, wood: 0 },
    consumes: { ...Forest.consumes, labor, energy },
    recycling: undefined,
    ...overrides,
  };
}

function place(q: number, building: Building) {
  const center = { q, r: 5 };
  board.placeBuilding(center, building);
  return board.getPlacedBuilding(center)!;
}

test("a hydro power plant can only be placed on the river", () => {
  const tile = riverTile();
  expect(game.canPlace("HydroPowerPlant", tile)).toBe(true);
  game.grantResources({ wood: 100 });
  expect(game.canBuild("HydroPowerPlant", tile)).toBe(true);
  expect(game.canBuild("HydroPowerPlant", { q: 1, r: 1 })).toBe(false);
  expect(game.canPlace("HydroPowerPlant", { q: 31, r: 0 })).toBe(false);
  board.setBuilding(
    { q: 2, r: 2 },
    definitions.BuildingDefinition.SettlersCamp,
  );
  expect(game.canPlace("HydroPowerPlant", { q: 2, r: 2 })).toBe(false);
  board.setBuilding({ q: 3, r: 3 }, definitions.BuildingDefinition.Sawmill);
  expect(game.canPlace("HydroPowerPlant", { q: 3, r: 3 })).toBe(false);
});

test("no other building can be placed on the river or over the plant", () => {
  const tile = riverTile();
  for (const type of Object.keys(definitions.BuildingDefinition)) {
    expect(
      game.canPlace(type as never, tile) && type !== "HydroPowerPlant",
    ).toBe(false);
  }
  placeHydro();
  expect(game.canPlace("HydroPowerPlant", tile)).toBe(false);
  expect(game.canPlace("Sawmill", tile)).toBe(false);
});

test("the plant is built as a wood site", () => {
  const tile = riverTile();
  game.build("HydroPowerPlant", tile);
  expect(game.getState().constructionSites).toBe(1);
  expect(board.getBuilding(tile)?.type).toBe("HydroPowerPlant");
  game.calculateWeek();
  expect(game.getState().energyProduced).toBe(0);
});

test("a finished plant yields energy without labor", () => {
  const tile = placeHydro();
  const state = game.calculateWeek();
  expect(state.energyProduced).toBe(10);
  expect(state.energyUsed).toBe(0);
  expect(state.buildingsWithoutEnergy).toBe(0);
  expect(state.resources.energy).toBe(10);
  expect(state.workforce).toMatchObject({ production: 0, forestry: 0 });
  expect(game.getBuildingReport(tile)).toEqual({
    workers: 0,
    produced: { ...definitions.BuildingDefinition.HydroPowerPlant.produces },
    consumed: { ...definitions.BuildingDefinition.HydroPowerPlant.consumes },
  });
});

test("a new settlement has no energy", () => {
  const state = game.getState();
  expect(state).toMatchObject({
    energyProduced: 0,
    energyUsed: 0,
    buildingsWithoutEnergy: 0,
  });
  expect(state.resources.energy).toBe(0);
});

test("energy goes to food producers first, then in placement order", () => {
  placeHydro();
  const s1 = place(1, consumer(6));
  const s2 = place(2, consumer(6));
  const food = place(
    3,
    consumer(3, { produces: { ...consumer(0).produces, food: 1 } }),
  );
  const small = place(4, consumer(1));
  const result = game.distributeEnergy();
  expect(result).toMatchObject({
    produced: 10,
    used: 10,
    surplus: 0,
    deficit: 6,
  });
  expect([...result.unpowered]).toEqual([s2]);
  expect(result.unpowered.has(s1)).toBe(false);
  expect(result.unpowered.has(food)).toBe(false);
  expect(result.unpowered.has(small)).toBe(false);
  const state = game.calculateWeek();
  expect(state).toMatchObject({
    energyProduced: 10,
    energyUsed: 10,
    buildingsWithoutEnergy: 1,
  });
  expect(state.resources.energy).toBe(0);
});

test("a food producer is supplied before an earlier sawmill", () => {
  const { Sawmill } = definitions.BuildingDefinition;
  placeHydro();
  const sawmill = place(1, {
    ...Sawmill,
    consumes: { ...Sawmill.consumes, energy: 8 },
  });
  const food = place(
    2,
    consumer(5, { produces: { ...consumer(0).produces, food: 1 } }),
  );
  const result = game.distributeEnergy();
  expect(result).toMatchObject({
    produced: 10,
    used: 5,
    surplus: 5,
    deficit: 8,
  });
  expect([...result.unpowered]).toEqual([sawmill]);
  expect(result.unpowered.has(food)).toBe(false);
});

test("energy does not carry over", () => {
  placeHydro();
  place(1, consumer(4));
  game.calculateWeek();
  const state = game.calculateWeek();
  expect(state.resources.energy).toBe(6);
  expect(state.energyUsed).toBe(4);
});

test("a food producer without energy produces no food", () => {
  placeHydro();
  const { Forest } = definitions.BuildingDefinition;
  const food = (amount: number, energy: number) =>
    consumer(energy, {
      produces: { ...Forest.produces, wood: 0, food: amount },
      consumes: { ...Forest.consumes, labor: 2, energy },
    });
  const unpowered = place(1, food(6, 20));
  const other = place(2, food(4, 0));
  const state = game.calculateWeek();
  expect(state.buildingsWithoutEnergy).toBe(1);
  expect(game.getBuildingReport(unpowered.center)).toEqual({
    workers: 0,
    produced: { ...Forest.produces, wood: 0 },
    consumed: { ...Forest.produces, wood: 0 },
    status: "missing-resources",
  });
  expect(game.getBuildingReport(other.center)?.workers).toBe(1);
});

test("a sawmill without energy does not work and keeps its workers free", () => {
  const { Sawmill } = definitions.BuildingDefinition;
  const sawmill = place(1, {
    ...Sawmill,
    consumes: { ...Sawmill.consumes, energy: 5 },
  });
  const state = game.calculateWeek();
  expect(state.buildingsWithoutEnergy).toBe(1);
  expect(state.resources.planks).toBe(0);
  expect(state.workforce?.production).toBe(0);
  expect(game.getBuildingReport(sawmill.center)).toMatchObject({
    workers: 0,
    status: "missing-resources",
  });
});

test("a sawmill with energy works", () => {
  placeHydro();
  const { Sawmill } = definitions.BuildingDefinition;
  place(1, { ...Sawmill, consumes: { ...Sawmill.consumes, energy: 5 } });
  const state = game.calculateWeek();
  expect(state.resources.planks).toBe(2);
  expect(state.resources.energy).toBe(5);
  expect(state.workforce?.production).toBe(2);
});
