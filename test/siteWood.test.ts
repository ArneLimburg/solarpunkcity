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
  // a game starts without food; these tests are about wood and need the
  // residents to survive without the camp
  game.grantResources({ food: 10 });
});

// a construction site that gets no builders, so only its wood supply changes
function placeIdleSite(
  center: { q: number; r: number },
  wood: number,
  supply = 0,
) {
  const homestead = definitions.BuildingDefinition.OrganicHomestead;
  const building: Building = {
    ...homestead,
    cost: { ...homestead.cost, wood, labor: 10 },
    maxBuilders: 0,
  };
  board.placeBuilding(center, building, 10, supply);
}

// a wood storage and an empty stock
function addStorage() {
  game.build("WoodStorage", { q: 10, r: 0 });
  game.grantResources({ wood: -3 });
  expect(game.getState().resources.wood).toBe(0);
}

test("a farm is placed without any wood: the cleared wood goes into the site", () => {
  expect(game.getState().capacity.wood).toBe(0);
  expect(game.canBuild("Farm", { q: -5, r: 0 })).toBe(true);
  game.build("Farm", { q: -5, r: 0 });
  const [site] = board.getConstructionSites();
  expect(site.siteWood).toBe(21);
  expect(site.remainingWood).toBe(25);
  expect(game.getState().resources.wood).toBe(0);
});

test("a farm without storage is finished after forestry delivered the missing wood", () => {
  game.build("Farm", { q: -5, r: 0 });
  let weeks = 0;
  let waited = false;
  while (board.getConstructionSites().length > 0 && weeks < 100) {
    const state = game.calculateWeek();
    weeks++;
    waited ||= state.sitesWaitingForWood > 0;
    for (const site of board.getConstructionSites()) {
      expect(site.siteWood).toBeGreaterThanOrEqual(-1e-9);
      expect(site.remainingWood).toBeGreaterThanOrEqual(-1e-9);
    }
    expect(state.resources.wood).toBe(0); // nothing reaches the stock
  }
  expect(board.getConstructionSites()).toEqual([]);
  expect(game.takeCompletedBuildings()).toEqual([
    { coords: { q: -5, r: 0 }, type: "Farm" },
  ]);
  expect(waited).toBe(true);
  expect(weeks).toBeGreaterThan(12); // 24 worker-weeks with 2 builders
});

test("a site without wood gets no workers, uses no labor and waits for wood", () => {
  game.build("OrganicHomestead", { q: 0, r: 0 }); // the camp gives no wood
  const state = game.calculateWeek();
  expect(state.sitesWaitingForWood).toBe(1);
  expect(board.getConstructionSites()[0].remainingWork).toBe(4);
  // the free labor works in forests, their wood goes into the site
  expect(board.getConstructionSites()[0].siteWood).toBe(1);
  expect(state.resources.wood).toBe(0);
  expect(state.resources.labor).toBe(0);
  // the delivered wood is used from the next week on
  const next = game.calculateWeek();
  expect(next.sitesWaitingForWood).toBe(0);
  expect(board.getConstructionSites()[0].remainingWork).toBe(3);
});

test("workers are limited by the wood per worker-week", () => {
  game.build("OrganicHomestead", { q: 0, r: 0 });
  board.getConstructionSites()[0].siteWood = 1.9;
  game.calculateWeek();
  // floor(1.9 / 1) = 1 worker
  expect(board.getConstructionSites()[0].remainingWork).toBe(3);
  expect(board.getConstructionSites()[0].siteWood).toBeCloseTo(0.9 + 0.5);
});

test("the wood stock is only used for the work of the week", () => {
  game.build("OrganicHomestead", { q: 0, r: 0 });
  game.grantResources({ wood: 5 });
  const state = game.calculateWeek();
  expect(state.resources.wood).toBe(3); // 2 builders use 2 wood
  expect(board.getConstructionSites()[0].siteWood).toBe(0);
  expect(state.sitesWaitingForWood).toBe(0);
});

test("the own supply is used before the stock", () => {
  game.build("OrganicHomestead", { q: 1, r: 0 }); // 3 wood into the site
  game.grantResources({ wood: 5 });
  game.calculateWeek();
  expect(game.getState().resources.wood).toBe(5);
  expect(board.getConstructionSites()[0].siteWood).toBe(1);
  game.calculateWeek(); // 1 wood from the supply, 1 from the stock
  expect(game.getState().resources.wood).toBe(4);
  expect(board.getConstructionSites()).toEqual([]);
});

test("the last work week uses exactly the remaining wood", () => {
  game.build("OrganicHomestead", { q: 1, r: 0 });
  const site = board.getConstructionSites()[0];
  site.remainingWork = 1;
  site.remainingWood = 1;
  site.siteWood = 1 - 1e-12; // a floating point remainder must not block it
  game.grantResources({ wood: 5 });
  game.calculateWeek();
  expect(board.getConstructionSites()).toEqual([]);
  expect(game.getState().resources.wood).toBeCloseTo(5);
});

test("forestry fills the supplies of the sites oldest first before the storage", () => {
  addStorage();
  placeIdleSite({ q: 1, r: 0 }, 0.75, 0.25); // free space 0.5
  placeIdleSite({ q: 2, r: 0 }, 0.5, 0.25); // free space 0.25
  const state = game.calculateWeek(); // 2 forests produce 1 wood
  const [first, second] = board.getConstructionSites();
  expect(first.siteWood).toBe(0.75);
  expect(second.siteWood).toBe(0.5);
  expect(state.resources.wood).toBeCloseTo(0.25);
  expect(state.sitesWaitingForWood).toBe(0);
});

test("wood in site supplies does not count to the stock or the capacity", () => {
  addStorage();
  game.build("OrganicHomestead", { q: 1, r: 0 });
  expect(board.getConstructionSites()[0].siteWood).toBe(3);
  expect(game.getState().resources.wood).toBe(0);
  expect(game.getState().capacity.wood).toBe(100);
});

test("forests work without capacity if a site has free supply space", () => {
  placeIdleSite({ q: 1, r: 0 }, 5);
  const state = game.calculateWeek();
  expect(state.resources.labor).toBe(0);
  expect(board.getConstructionSites()[0].siteWood).toBe(1);
  expect(state.resources.wood).toBe(0);
});

test("forests do not work and keep their labor without free space anywhere", () => {
  placeIdleSite({ q: 1, r: 0 }, 5, 5);
  const state = game.calculateWeek();
  expect(state.resources.labor).toBe(2);
  expect(board.getConstructionSites()[0].siteWood).toBe(5);
  expect(state.resources.wood).toBe(0);
});

test("sites keep supply and progress, they only wait", () => {
  game.build("OrganicHomestead", { q: 0, r: 0 });
  const site = board.getConstructionSites()[0];
  site.remainingWork = 2;
  site.remainingWood = 2;
  for (let week = 0; week < 5; week++) {
    game.calculateWeek();
  }
  expect(board.getConstructionSites()).toEqual([]);
});

test("a site without wood cost needs no wood", () => {
  board.placeBuilding(
    { q: 1, r: 0 },
    {
      ...definitions.BuildingDefinition.OrganicHomestead,
      cost: {
        ...definitions.BuildingDefinition.OrganicHomestead.cost,
        wood: 0,
      },
    },
    4,
  );
  const state = game.calculateWeek();
  expect(state.sitesWaitingForWood).toBe(0);
  expect(board.getConstructionSites()[0].remainingWork).toBe(2);
});

test("a building with a wood cost but no labor is paid in full and finished", () => {
  const storage = definitions.BuildingDefinition.WoodStorage;
  storage.cost = { ...storage.cost, wood: 2 };
  game.grantResources({ wood: 3 });
  expect(game.canBuild("WoodStorage", { q: 10, r: 0 })).toBe(true);
  game.build("WoodStorage", { q: 10, r: 0 });
  expect(board.isUnderConstruction({ q: 10, r: 0 })).toBe(false);
  expect(game.getState().resources.wood).toBe(3 + 3 - 2);
});
