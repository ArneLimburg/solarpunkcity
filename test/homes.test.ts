import { beforeEach, expect, test, vi } from "vitest";

let board: typeof import("../src/board");
let game: typeof import("../src/game");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  game = await import("../src/game");
  // construction material for the sites
  game.build("WoodStorage", { q: 10, r: 0 });
  game.grantResources({ wood: 100 });
});

const camp = () => board.getPlacedBuilding({ q: 0, r: 0 })!;
const ids = (home: ReturnType<typeof camp>) =>
  game.getOccupants(home).map(({ id }) => id);

test("a new game houses both settlers in the camp", () => {
  const [first, second] = game.getState().residents;
  expect(ids(camp())).toEqual([first.id, second.id]);
  expect(game.getHome(first.id)).toBe(camp());
  expect(game.getHome(second.id)).toBe(camp());
});

test("a completed home leaves housed settlers in place", () => {
  game.build("OrganicHomestead", { q: 1, r: 0 });
  const site = board.getPlacedBuilding({ q: 1, r: 0 })!;
  expect(game.getOccupants(site)).toEqual([]); // a site takes nobody
  game.finishConstruction();
  expect(game.getOccupants(site)).toEqual([]);
  expect(game.getOccupants(camp())).toHaveLength(2);
});

test("building over the camp moves the settlers to spare housing", () => {
  game.build("OrganicHomestead", { q: 1, r: 0 });
  game.finishConstruction();
  const old = camp();
  game.build("OrganicHomestead", { q: 0, r: 0 });
  expect(game.getOccupants(old)).toEqual([]);
  const home = board.getPlacedBuilding({ q: 1, r: 0 })!;
  expect(game.getOccupants(home)).toHaveLength(2);
});

test("settlers without spare housing are unhoused until a home completes", () => {
  game.build("OrganicHomestead", { q: 0, r: 0 });
  const residents = game.getState().residents;
  for (const { id } of residents) {
    expect(game.getHome(id)).toBeUndefined();
  }
  // the replacement at the same coordinates is a site and takes nobody
  const replacement = board.getPlacedBuilding({ q: 0, r: 0 })!;
  expect(game.getOccupants(replacement)).toEqual([]);
  game.finishConstruction();
  expect(ids(replacement)).toEqual(residents.map(({ id }) => id));
});

test("a departed resident frees their place", () => {
  const [first, second] = game.getState().residents;
  game.grantResources({ food: -1000 });
  expect(game.calculateWeek().population).toBe(1);
  expect(ids(camp())).toEqual([first.id]);
  expect(game.getHome(second.id)).toBeUndefined();
});
