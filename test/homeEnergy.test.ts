import { beforeEach, expect, test, vi } from "vitest";
import type { Building } from "../src/gameDefinitions";

let board: typeof import("../src/board");
let game: typeof import("../src/game");
let definitions: typeof import("../src/gameDefinitions");
let homeEnergy: typeof import("../src/homeEnergy");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  game = await import("../src/game");
  definitions = await import("../src/gameDefinitions");
  homeEnergy = await import("../src/homeEnergy");
  board.setBuilding({ q: 0, r: 0 }, definitions.BuildingDefinition.Forest);
  game.grantResources({ wood: 10, food: 10 });
});

// an apartment building with a different number of places
function apartment(resident: number): Building {
  return { ...definitions.BuildingDefinition.AppartmentBuilding, resident };
}

// a building that only consumes energy (and optionally produces food)
function consumer(energy: number, food = 0): Building {
  const { Forest } = definitions.BuildingDefinition;
  return {
    ...Forest,
    name: "Consumer",
    produces: { ...Forest.produces, wood: 0, food },
    consumes: { ...Forest.consumes, labor: 0, energy },
    recycling: undefined,
  };
}

function place(q: number, building: Building) {
  const center = { q, r: 5 };
  board.placeBuilding(center, building);
  game.finishConstruction(); // assigns the residents to their homes
  return board.getPlacedBuilding(center)!;
}

function placeHydro() {
  const tile = board
    .getRiverCourse(board.GRID_RADIUS)
    .find(({ r }) => r === -10)!;
  board.placeBuilding(tile, definitions.BuildingDefinition.HydroPowerPlant);
}

test("the grid request of an apartment building depends on its occupants", () => {
  expect(homeEnergy.getGridRequest(0)).toBe(0);
  expect(homeEnergy.getGridRequest(1)).toBe(13);
  expect(homeEnergy.getGridRequest(15)).toBe(335);
  expect(homeEnergy.getApartmentDemand(15)).toEqual({
    gross: 385,
    rooftop: 50,
  });
  expect(homeEnergy.getApartmentDemand(0)).toEqual({ gross: 40, rooftop: 40 });
  expect(
    homeEnergy.isApartment(definitions.BuildingDefinition.WoodenHouse),
  ).toBe(false);
  expect(homeEnergy.milli(0.013)).toBe(13);
});

test("an empty apartment building requests nothing from the grid", () => {
  const home = place(1, apartment(0));
  const result = game.distributeEnergy();
  expect(result.used).toBe(0);
  expect(result.deficit).toBe(0);
  expect(result.unpowered.has(home)).toBe(false);
  game.calculateWeek();
  expect(game.getHomeEnergyReport(home.center)).toEqual({
    demand: 0.04,
    rooftop: 0.04,
    grid: 0,
    unmet: 0,
  });
});

test("an apartment building with one resident requests 0.013", () => {
  placeHydro();
  const home = place(1, apartment(1));
  const state = game.calculateWeek();
  expect(game.getHomeEnergyReport(home.center)).toEqual({
    demand: 0.063,
    rooftop: 0.05,
    grid: 0.013,
    unmet: 0,
  });
  expect(state.energyUsed).toBe(0.013);
  expect(state.resources.energy).toBe(9.987);
  expect(state.buildingsWithoutEnergy).toBe(0);
});

test("a wooden house and an unfinished apartment building add no demand", () => {
  placeHydro();
  const house = place(1, definitions.BuildingDefinition.WoodenHouse);
  const site = { q: 2, r: 5 };
  board.placeBuilding(site, apartment(15), 240, 0);
  const result = game.distributeEnergy();
  expect(result.used).toBe(0);
  expect(result.homes.size).toBe(0);
  expect(game.getHomeEnergyReport(house.center)).toBeUndefined();
  expect(game.getHomeEnergyReport(site)).toBeUndefined();
  expect(game.calculateWeek().energyUsed).toBe(0);
});

test("food producers, apartments, then others get energy, oldest first", () => {
  placeHydro();
  const other = place(1, consumer(0.5));
  const first = place(2, apartment(1));
  const second = place(3, apartment(1));
  const food = place(4, consumer(9.98, 1));
  const result = game.distributeEnergy();
  expect(result).toMatchObject({
    produced: 10,
    used: 9.993,
    surplus: 0.007,
    deficit: 0.513,
  });
  expect(result.unpowered).toEqual(new Set([second, other]));
  expect(result.unpowered.has(first)).toBe(false);
  expect(result.unpowered.has(food)).toBe(false);
});

test("an unpowered apartment building keeps its residents", () => {
  const home = place(1, apartment(1));
  const state = game.calculateWeek();
  expect(state.buildingsWithoutEnergy).toBe(1);
  expect(state.population).toBe(2);
  expect(game.getOccupants(home)).toHaveLength(1);
  expect(game.getHomeEnergyReport(home.center)).toEqual({
    demand: 0.063,
    rooftop: 0.05,
    grid: 0,
    unmet: 0.013,
  });
});

test("moving residents changes the demand of the next weekly report", () => {
  const a = place(1, apartment(2));
  const b = place(2, apartment(2));
  game.calculateWeek();
  // both residents live in the older building
  expect(game.getHomeEnergyReport(a.center)?.demand).toBe(0.086);
  expect(game.getHomeEnergyReport(b.center)?.demand).toBe(0.04);
  // a smaller building replaces the first one: its residents move out
  const smaller = place(1, apartment(1));
  game.calculateWeek();
  const demands = [smaller, b].map(
    ({ center }) => game.getHomeEnergyReport(center)?.demand,
  );
  expect(demands[0]).not.toBe(0.086);
  expect(demands[1]).not.toBe(0.04);
});
