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

// one power plant on the river powers all sawmills of these tests
function addHydroPowerPlant() {
  const tile = board
    .getRiverCourse(board.GRID_RADIUS)
    .find(({ r }) => r === -10)!;
  if (board.getBuilding(tile)?.type !== "HydroPowerPlant") {
    board.placeBuilding(tile, definitions.BuildingDefinition.HydroPowerPlant);
  }
}

function addSawmill(coords = SAWMILL) {
  addHydroPowerPlant();
  board.setBuilding(coords, definitions.BuildingDefinition.Sawmill);
}

// a wood storage, so that forestry has room for wood
function addWoodStorage() {
  board.setBuilding(
    { q: 10, r: 0 },
    definitions.BuildingDefinition.WoodStorage,
  );
}

test("a sawmill turns 4 wood and 2 labor into 2 planks", () => {
  addSawmill();
  addWoodStorage();
  game.grantResources({ wood: 4 });
  const state = game.calculateWeek();
  expect(state.resources.wood).toBe(0);
  expect(state.resources.planks).toBe(2);
  expect(state.resources.labor).toBe(0);
  expect(game.getBuildingReport(SAWMILL)).toMatchObject({
    workers: 2,
    produced: { planks: 2 },
    consumed: { wood: 4, labor: 2 },
  });
});

test("sawmills work before forestry: the forests get no labor", () => {
  addSawmill();
  addWoodStorage();
  game.grantResources({ wood: 4 });
  const { workforce, resources } = game.calculateWeek();
  expect(workforce).toEqual({
    food: 0,
    construction: 0,
    production: 2,
    forestry: 0,
    free: 0,
  });
  // forestry would have produced wood
  expect(resources.wood).toBe(0);
});

test("a sawmill with less than 4 wood does not work and consumes nothing", () => {
  addSawmill();
  addWoodStorage();
  game.grantResources({ wood: 3 });
  const { resources, workforce } = game.calculateWeek();
  expect(resources.planks).toBe(0);
  expect(workforce!.production).toBe(0);
  // the 2 workers cut 1 wood in the forests, it goes into the sawmill supply
  expect(resources.wood).toBeCloseTo(3);
  expect(board.getPlacedBuilding(SAWMILL)!.sawmillWood).toBeCloseTo(1);
  expect(game.getBuildingReport(SAWMILL)).toMatchObject({
    workers: 0,
    status: "missing-resources",
  });
});

test("sawmills work in placement order and only with free labor", () => {
  addSawmill(SAWMILL);
  addSawmill(SECOND_SAWMILL);
  addWoodStorage();
  game.grantResources({ wood: 8 });
  // 2 workers: one sawmill
  const state = game.calculateWeek();
  expect(state.resources.wood).toBe(4);
  expect(state.resources.planks).toBe(2);
  expect(game.getBuildingReport(SAWMILL)!.workers).toBe(2);
  expect(game.getBuildingReport(SECOND_SAWMILL)!.workers).toBe(0);
  expect(game.getBuildingReport(SECOND_SAWMILL)!.status).toBe(
    "missing-resources",
  );
});

test("a sawmill with a full plank storage and no plank site does not work", () => {
  addSawmill();
  addWoodStorage();
  game.grantResources({ wood: 4, planks: 20 });
  const { resources, workforce } = game.calculateWeek();
  expect(resources.planks).toBe(20);
  expect(workforce!.production).toBe(0);
  // the labor went to the forests, the wood was not consumed; the new wood
  // went into the sawmill supply
  expect(resources.wood).toBeCloseTo(4);
  expect(board.getPlacedBuilding(SAWMILL)!.sawmillWood).toBeCloseTo(1);
});

test("the plank stock never exceeds the capacity", () => {
  addSawmill();
  addWoodStorage();
  game.grantResources({ wood: 4, planks: 19 });
  const { resources, capacity } = game.calculateWeek();
  expect(capacity.planks).toBe(20);
  expect(resources.planks).toBe(20); // 1 of the 2 planks is lost
});

test("the plank capacity is 20 per finished sawmill", () => {
  expect(game.getState().capacity.planks).toBe(0);
  addSawmill(SAWMILL);
  expect(game.getState().capacity.planks).toBe(20);
  addSawmill(SECOND_SAWMILL);
  expect(game.getState().capacity.planks).toBe(40);
  // a sawmill under construction has no storage yet
  game.build("Sawmill", { q: -7, r: 3 });
  expect(game.getState().capacity.planks).toBe(40);
});

// sites without builders, so only their supply changes
function placeIdleApartment(supply = 0) {
  const apartment = definitions.BuildingDefinition.AppartmentBuilding;
  board.placeBuilding(SITE, { ...apartment, maxBuilders: 0 }, 20, supply);
}

test("planks fill the supply of plank sites before the storage", () => {
  addSawmill();
  addWoodStorage();
  game.grantResources({ wood: 4 });
  placeIdleApartment(5); // free space 1
  const homestead = definitions.BuildingDefinition.OrganicHomestead;
  // a wood site gets no planks
  board.placeBuilding({ q: -9, r: 3 }, { ...homestead, maxBuilders: 0 }, 4);
  const [apartment, woodSite] = board.getConstructionSites();
  game.calculateWeek();
  expect(apartment.siteWood).toBe(6);
  expect(game.getState().resources.planks).toBe(1);
  expect(woodSite.siteWood).toBe(0);
});

test("a sawmill works if only a plank site has free supply space", () => {
  addSawmill();
  addWoodStorage();
  game.grantResources({ wood: 4, planks: 20 });
  placeIdleApartment();
  game.calculateWeek();
  expect(board.getConstructionSites()[0].siteWood).toBe(2);
  expect(game.getState().resources.planks).toBe(20);
});

test("an apartment site uses exactly 6 planks and 240 worker-weeks", () => {
  addSawmill(); // the plank capacity
  game.grantResources({ planks: 6 });
  game.build("AppartmentBuilding", SITE);
  const [site] = board.getConstructionSites();
  expect(site.remainingWood).toBe(6);
  expect(site.siteWood).toBe(0);
  let workerWeeks = 0;
  let weeks = 0;
  while (board.getConstructionSites().length > 0 && weeks < 400) {
    const before = game.getState().resources.planks;
    const work = site.remainingWork!;
    game.calculateWeek();
    const workers = work - (site.remainingWork ?? 0);
    expect(workers).toBeLessThanOrEqual(Math.floor(before / 0.025 + 1e-9));
    workerWeeks += workers;
    weeks++;
  }
  expect(workerWeeks).toBe(240);
  expect(game.getState().resources.planks).toBeCloseTo(0);
  expect(game.takeCompletedBuildings()).toEqual([
    { coords: SITE, type: "AppartmentBuilding" },
  ]);
});

test("workers are limited by the available planks", () => {
  game.build("AppartmentBuilding", SITE);
  const [site] = board.getConstructionSites();
  site.siteWood = 0.05; // floor(0.05 / 0.025) = 2 workers
  game.calculateWeek();
  expect(site.remainingWork).toBe(238);
  expect(site.siteWood).toBeCloseTo(0);
});

test("a site without planks waits for material", () => {
  game.build("AppartmentBuilding", SITE);
  const state = game.calculateWeek();
  expect(state.sitesWaitingForWood).toBe(1);
  expect(board.getConstructionSites()[0].remainingWork).toBe(240);
  // the labor went to the forests
  expect(state.workforce!.construction).toBe(0);
});

test("the plank stock is used after the own supply", () => {
  addSawmill(); // the plank capacity
  game.grantResources({ planks: 1 });
  game.build("AppartmentBuilding", SITE);
  board.getConstructionSites()[0].siteWood = 0.025;
  game.calculateWeek(); // 2 workers need 0.05 planks
  expect(board.getConstructionSites()[0].siteWood).toBeCloseTo(0);
  expect(game.getState().resources.planks).toBeCloseTo(0.975);
});

test("planks of a plank building do not go into the wood storage", () => {
  addWoodStorage();
  game.build("AgroIndustrial", { q: -15, r: 5 });
  // the recycled wood of the 19 forests goes to the stock, not into the site
  expect(game.getState().resources.wood).toBe(57);
  expect(board.getConstructionSites()[0].siteWood).toBe(0);
});

test("an agro-industrial farm on 19 forest tiles loses the wood that does not fit", () => {
  const farm = { q: -15, r: 5 };
  expect(game.canBuild("AgroIndustrial", farm)).toBe(true); // no storage
  game.build("AgroIndustrial", farm);
  expect(game.getState().resources.wood).toBe(0);
  addWoodStorage();
  game.grantResources({ wood: 44 });
  expect(game.canBuild("AgroIndustrial", { q: -15, r: -5 })).toBe(true);
  game.build("AgroIndustrial", { q: -15, r: -5 });
  expect(game.getState().resources.wood).toBe(100);
});

test("canBuild does not check the plank stock", () => {
  addWoodStorage();
  expect(game.getState().resources.planks).toBe(0);
  expect(game.canBuild("AppartmentBuilding", SITE)).toBe(true);
});

test("building over a sawmill recycles its wood and drops planks above the capacity", () => {
  addSawmill();
  addWoodStorage();
  game.grantResources({ planks: 15 });
  game.build("OrganicHomestead", SAWMILL);
  expect(game.getState().capacity.planks).toBe(0);
  expect(game.getState().resources.planks).toBe(0);
  // 7 wood: 4 into the site, 3 into the stock
  expect(game.getState().resources.wood).toBe(3);
});

test("a second sawmill keeps the planks of the first one", () => {
  addSawmill(SAWMILL);
  addSawmill(SECOND_SAWMILL);
  game.grantResources({ planks: 30 });
  game.build("OrganicHomestead", SAWMILL);
  expect(game.getState().resources.planks).toBe(20);
});

test("the workforce counts sawmill workers as production, not forestry", () => {
  // a growing town: an apartment building gives room for more workers
  board.setBuilding(
    { q: -10, r: 6 },
    definitions.BuildingDefinition.AppartmentBuilding,
  );
  addSawmill();
  addWoodStorage();
  // the food stock for the growth needs a supermarket
  board.setBuilding(
    { q: -10, r: 0 },
    definitions.BuildingDefinition.Supermarket,
  );
  game.grantResources({ food: 1000 });
  while (game.getState().population < 5) {
    game.calculateWeek();
  }
  game.grantResources({ wood: 4 });
  const workers = game.getState().population;
  const { workforce } = game.calculateWeek();
  expect(workforce!.production).toBe(2);
  expect(workforce!.forestry).toBeGreaterThan(0);
  expect(
    workforce!.food +
      workforce!.construction +
      workforce!.production +
      workforce!.forestry +
      workforce!.free,
  ).toBe(workers);
});
