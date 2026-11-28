import { beforeEach, expect, test, vi } from "vitest";
import { weekToMonth } from "../src/calendar";
import { SEASONAL_SUN, expectedTypeFactor, getWeather } from "../src/weather";

// Math.random() = 0.5 gives the game seed 2 ** 31
const SEED = 2 ** 31;

let board: typeof import("../src/board");
let game: typeof import("../src/game");
let definitions: typeof import("../src/gameDefinitions");

beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  board = await import("../src/board");
  game = await import("../src/game");
  definitions = await import("../src/gameDefinitions");
});

const findWeek = (matches: (week: number) => boolean) =>
  Array.from({ length: 2000 }, (_, week) => week).find(matches)!;

function place(type: "SolarField" | "WindTurbine" | "HydroPowerPlant") {
  const center =
    type === "HydroPowerPlant"
      ? board.getRiverCourse(board.GRID_RADIUS).find(({ r }) => r === -10)!
      : { q: 1, r: 1 };
  board.placeBuilding(center, definitions.BuildingDefinition[type]);
}

test("a storm week gives wind turbines no energy", () => {
  const week = findWeek((w) => getWeather(SEED, w).type === "Storm");
  place("WindTurbine");
  expect(game.distributeEnergy(week).produced).toBe(0);
});

test("a sunny June week boosts solar fields", () => {
  const week = findWeek(
    (w) => weekToMonth(w) === 5 && getWeather(SEED, w).type === "Sunny",
  );
  place("SolarField");
  expect(game.distributeEnergy(week).produced).toBeCloseTo(
    (2 * SEASONAL_SUN[5] * 1.3) / expectedTypeFactor(5, "sun"),
    3,
  );
  // the listed June value 1.6 is scaled so that the yearly mean is 1
  expect(SEASONAL_SUN[5]).toBeCloseTo(1.6 / (11.9 / 12), 10);
});

test("hydro output is not affected by the weather", () => {
  place("HydroPowerPlant");
  for (let week = 0; week < 60; week++) {
    expect(game.distributeEnergy(week).produced).toBe(10);
  }
});

test("the state exposes the weather of the current week", () => {
  expect(game.getState().weather).toEqual(getWeather(SEED, 0));
  game.calculateWeek();
  expect(game.getState().weather).toEqual(getWeather(SEED, 1));
});
