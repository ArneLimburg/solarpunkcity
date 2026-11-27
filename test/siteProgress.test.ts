import { beforeEach, expect, test, vi } from "vitest";

let game: typeof import("../src/game");

beforeEach(async () => {
  vi.resetModules();
  game = await import("../src/game");
});

const first = { q: 1, r: 0 };
const second = { q: 2, r: 0 };

test("a new site is at 0 % and waits for builders", () => {
  game.build("OrganicHomestead", first);
  expect(game.getConstructionReport(first)).toEqual({
    percent: 0,
    remainingWork: 32,
    builders: 0,
  });
});

test("the progress changes with the completed work only", () => {
  game.build("OrganicHomestead", first);
  game.grantResources({ wood: 10 });
  game.calculateWeek(); // 2 builders of 32 worker-weeks
  expect(game.getConstructionReport(first)).toEqual({
    percent: 6,
    remainingWork: 30,
    builders: 2,
    weeks: 15,
  });
  for (let week = 1; week < 16; week++) {
    expect(game.getConstructionReport(first)).toBeDefined();
    game.calculateWeek();
  }
  expect(game.getConstructionReport(first)).toBeUndefined(); // finished
});

test("a site without builders stays where it is", () => {
  game.build("OrganicHomestead", first);
  game.build("OrganicHomestead", second);
  game.grantResources({ wood: 10 });
  game.calculateWeek(); // the older site takes both builders
  expect(game.getConstructionReport(second)).toEqual({
    percent: 0,
    remainingWork: 32,
    builders: 0,
  });
});

test("finished buildings and empty tiles have no construction report", () => {
  expect(game.getConstructionReport({ q: 0, r: 0 })).toBeUndefined();
  expect(game.getConstructionReport({ q: 99, r: 0 })).toBeUndefined();
});

test("the wood stock fills the storages in placement order", () => {
  game.build("WoodStorage", first);
  game.build("WoodStorage", second);
  game.grantResources({ wood: 144 }); // 6 cleared + 144
  expect(game.getStoredWood(first)).toBe(100);
  expect(game.getStoredWood(second)).toBe(50);
  expect(game.getStoredWood({ q: 3, r: 0 })).toBe(0);
  expect(game.getStoredWood(first) + game.getStoredWood(second)).toBe(
    game.getState().resources.wood,
  );
});

test("wood above all capacities stays with the last storage", () => {
  game.build("WoodStorage", first);
  game.build("WoodStorage", second);
  game.grantResources({ wood: 244 });
  expect(game.getStoredWood(first)).toBe(100);
  expect(game.getStoredWood(second)).toBe(150);
});

test("the field efficiency is the harvest factor in percent", () => {
  expect(game.getFieldEfficiency()).toBe(100);
});
