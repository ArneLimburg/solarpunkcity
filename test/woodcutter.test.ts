import { beforeEach, expect, test, vi } from "vitest";
import {
  BuildingDefinition,
  BuildingTypes,
  isInBuildMenu,
} from "../src/gameDefinitions";
import { emptyResources } from "../src/resources";
import { getWoodOutput } from "../src/woodcutter";

let game: typeof import("../src/game");
let board: typeof import("../src/board");
let woodcutter: typeof import("../src/woodcutter");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  game = await import("../src/game");
  woodcutter = await import("../src/woodcutter");
});

// far from the river and the camp, every tile in reach is forest
const HOME = { q: -20, r: 5 };
const STORAGE = { q: -20, r: -10 };
const OTHER = { q: -20, r: -5 };

function place(type: "Woodcutter" | "WoodStorage" | "Sawmill", at = HOME) {
  game.build(type, at);
  game.finishConstruction();
  return board.getPlacedBuilding(at)!;
}

// builds wood storages on all tiles in reach of a center but `keep` of them
function blockAllBut(center: { q: number; r: number }, keep: number) {
  const tiles = board
    .getFootprint(center, 3)
    .filter(({ q, r }) => q !== center.q || r !== center.r)
    .filter(board.isOnBoard);
  for (const tile of tiles.slice(keep)) {
    place("WoodStorage", tile);
  }
}

const woodStock = () => game.getState().resources.wood;

test("the definition of the woodcutter", () => {
  expect(BuildingTypes.Woodcutter.category).toBe("PRODUCTION");
  expect(BuildingDefinition.Woodcutter).toEqual({
    name: "Woodcutter",
    type: "Woodcutter",
    description: "Harvests the forest around it",
    size: 1,
    resident: 0,
    ecology: 0.3,
    cost: { ...emptyResources, wood: 3, labor: 8 },
    maxBuilders: 1,
    produces: emptyResources,
    consumes: { ...emptyResources, labor: 2 },
    recycling: { ...emptyResources, wood: 1 },
  });
  expect(isInBuildMenu("Woodcutter")).toBe(false);
  expect(isInBuildMenu("Sawmill")).toBe(true);
});

test("a woodcutter is finished from the clearing wood without any stock", () => {
  expect(game.canBuild("Woodcutter", HOME)).toBe(true);
  game.build("Woodcutter", HOME);
  expect(board.getConstructionSites()[0].siteWood).toBe(3);
  for (let week = 0; week < 8; week++) {
    expect(board.isUnderConstruction(HOME)).toBe(true);
    game.calculateWeek();
    expect(woodStock()).toBe(0);
  }
  expect(board.isUnderConstruction(HOME)).toBe(false);
});

test("the harvest area is the forest within 3 hexes without its own tile", () => {
  const cutter = place("Woodcutter");
  place("WoodStorage", { q: HOME.q + 1, r: HOME.r });
  const tiles = woodcutter.assignHarvestTiles([cutter]).get(cutter)!;
  // 36 tiles in reach minus the built one
  expect(tiles).toHaveLength(35);
  expect(tiles).not.toContainEqual(HOME);
  expect(tiles).not.toContainEqual({ q: HOME.q + 1, r: HOME.r });
  expect(tiles).not.toContainEqual({ q: HOME.q + 4, r: HOME.r });
});

test("tiles off the board do not count", () => {
  const corner = place("Woodcutter", { q: 30, r: 0 });
  expect(woodcutter.assignHarvestTiles([corner]).get(corner)).toHaveLength(15);
});

test("with enough capacity a woodcutter delivers 4 wood with two workers", () => {
  place("WoodStorage", STORAGE);
  const cutter = place("Woodcutter");
  const before = woodStock();
  game.calculateWeek();
  expect(woodStock() - before).toBe(4);
  expect(game.getBuildingReport(cutter.center)).toEqual({
    workers: 2,
    produced: { ...emptyResources, wood: 4 },
    consumed: { ...emptyResources, labor: 2 },
  });
  expect(game.getState().workforce).toMatchObject({ forestry: 2, free: 0 });
});

test("with one free worker a woodcutter delivers 2 wood", () => {
  place("WoodStorage", STORAGE);
  const cutter = place("Woodcutter");
  // a second woodcutter under construction takes one of the two workers
  game.build("Woodcutter", OTHER);
  const before = woodStock();
  game.calculateWeek();
  expect(woodStock() - before).toBe(2);
  expect(game.getBuildingReport(cutter.center)?.workers).toBe(1);
});

test("without a free worker a woodcutter reports no workers", () => {
  place("WoodStorage", STORAGE);
  const cutter = place("Woodcutter");
  game.build("Woodcutter", OTHER);
  game.build("Woodcutter", { q: -20, r: 20 });
  const before = woodStock();
  game.calculateWeek();
  expect(woodStock()).toBe(before);
  expect(game.getBuildingReport(cutter.center)).toMatchObject({
    workers: 0,
    status: "no-workers",
  });
});

test("with 4 eligible tiles a woodcutter delivers at most 2 wood", () => {
  place("WoodStorage", STORAGE);
  const cutter = place("Woodcutter");
  blockAllBut(HOME, 4);
  expect(woodcutter.assignHarvestTiles([cutter]).get(cutter)).toHaveLength(4);
  game.calculateWeek();
  expect(game.getBuildingReport(cutter.center)).toMatchObject({
    workers: 1,
    produced: { ...emptyResources, wood: 2 },
  });
});

test("a woodcutter without a forest in reach stays idle", () => {
  place("WoodStorage", STORAGE);
  const cutter = place("Woodcutter");
  blockAllBut(HOME, 0);
  game.calculateWeek();
  expect(game.getBuildingReport(cutter.center)).toMatchObject({
    workers: 0,
    status: "not-needed",
  });
});

test("overlapping woodcutters never count a tile twice, the nearer one gets it", () => {
  const first = place("Woodcutter");
  const second = place("Woodcutter", { q: HOME.q + 2, r: HOME.r });
  const assigned = woodcutter.assignHarvestTiles([second, first]);
  const all = [...assigned.get(first)!, ...assigned.get(second)!];
  expect(new Set(all.map(({ q, r }) => `${q},${r}`)).size).toBe(all.length);
  // 2 x 35 tiles in reach, 12 are shared
  expect(all.length).toBeLessThan(70);
  // nearer to the second
  expect(assigned.get(second)).toContainEqual({ q: HOME.q + 3, r: HOME.r });
  expect(assigned.get(first)).not.toContainEqual({ q: HOME.q + 3, r: HOME.r });
  // nearer to the first
  expect(assigned.get(first)).toContainEqual({ q: HOME.q - 1, r: HOME.r });
  expect(assigned.get(second)).not.toContainEqual({
    q: HOME.q - 1,
    r: HOME.r,
  });
});

test("placement order breaks a tie in the distance", () => {
  const second = place("Woodcutter", { q: HOME.q + 2, r: HOME.r });
  const first = place("Woodcutter");
  const shared = { q: HOME.q + 1, r: HOME.r };
  const assigned = woodcutter.assignHarvestTiles([first, second]);
  // the woodcutter at q + 2 is older although the other one was passed first
  expect(assigned.get(second)).toContainEqual(shared);
  expect(assigned.get(first)).not.toContainEqual(shared);
});

test("a full storage leaves the workers of the woodcutter free", () => {
  place("WoodStorage", STORAGE);
  const cutter = place("Woodcutter");
  game.grantResources({ wood: 100 - woodStock() });
  game.calculateWeek();
  expect(woodStock()).toBe(100);
  expect(game.getBuildingReport(cutter.center)).toMatchObject({
    workers: 0,
    status: "not-needed",
  });
  expect(game.getState().workforce?.free).toBe(2);
});

test("a partial capacity caps the delivery and the report", () => {
  place("WoodStorage", STORAGE);
  const cutter = place("Woodcutter");
  game.grantResources({ wood: 98 - woodStock() });
  game.calculateWeek();
  expect(woodStock()).toBe(100);
  expect(game.getBuildingReport(cutter.center)).toEqual({
    workers: 1,
    produced: { ...emptyResources, wood: 2 },
    consumed: { ...emptyResources, labor: 1 },
  });
});

// a woodcutter with one worker (2 wood) next to a construction site that has
// one worker too; the site is built over a finished building and so starts
// with only `recycled` of its 3 wood, and uses 0.375 of it in the first week
function sitesSawmillStorage(
  over: "Woodcutter" | "CommunityGarden",
  sawmillSupply: number,
) {
  place("WoodStorage", STORAGE);
  const sawmill = place("Sawmill", { q: -20, r: 10 });
  sawmill.sawmillWood = sawmillSupply;
  place("Woodcutter");
  game.build(over, OTHER);
  game.finishConstruction();
  game.build("Woodcutter", OTHER);
  const site = board.getConstructionSites()[0];
  const before = woodStock();
  game.calculateWeek();
  return { site, sawmill, before };
}

test("construction sites get wood before sawmills and storage", () => {
  // recycling 1 wood: the site is 2 wood short after its first week
  const { site, sawmill, before } = sitesSawmillStorage("Woodcutter", 0);
  expect(site.remainingWood! - site.siteWood!).toBeCloseTo(0);
  expect(sawmill.sawmillWood).toBe(0);
  expect(woodStock()).toBe(before);
});

test("sawmills get wood before the storage", () => {
  // recycling 2 wood: the site is 1 wood short after its first week
  const { site, sawmill, before } = sitesSawmillStorage("CommunityGarden", 0);
  expect(site.remainingWood! - site.siteWood!).toBeCloseTo(0);
  expect(sawmill.sawmillWood).toBeCloseTo(1);
  expect(woodStock()).toBe(before);
});

test("the storage gets what sites and sawmills cannot take", () => {
  const { site, sawmill, before } = sitesSawmillStorage("CommunityGarden", 4);
  expect(site.remainingWood! - site.siteWood!).toBeCloseTo(0);
  expect(sawmill.sawmillWood).toBe(4);
  expect(woodStock() - before).toBeCloseTo(1);
});

test("a harvested forest tile does not also produce passively", () => {
  place("WoodStorage", STORAGE);
  const west = { q: -29, r: 1 };
  const cutter = place("Woodcutter", west);
  // keep only (-30, 0), the first forest tile of the board
  const keep = { q: -30, r: 0 };
  for (const tile of board.getFootprint(west, 3)) {
    const isKept = tile.q === keep.q && tile.r === keep.r;
    const isCenter = tile.q === west.q && tile.r === west.r;
    if (board.isOnBoard(tile) && !isKept && !isCenter) {
      place("WoodStorage", tile);
    }
  }
  expect(woodcutter.assignHarvestTiles([cutter]).get(cutter)).toEqual([keep]);
  const before = woodStock();
  game.calculateWeek();
  // the woodcutter harvests 0.5 with one worker, one passive tile 0.5
  expect(woodStock() - before).toBeCloseTo(1);
  expect(game.getBuildingReport(keep)).toBeUndefined();
  const passive = board
    .getPlacedBuildings()
    .filter(({ building }) => building.type === "Forest")
    .filter(({ center }) => game.getBuildingReport(center)?.workers === 1);
  expect(passive).toHaveLength(1);
});

test("the wood output is limited by workers, tiles, capacity and 4", () => {
  expect(getWoodOutput(30, 2, 100)).toBe(4);
  expect(getWoodOutput(30, 1, 100)).toBe(2);
  expect(getWoodOutput(8, 2, 100)).toBe(4);
  expect(getWoodOutput(4, 2, 100)).toBe(2);
  expect(getWoodOutput(30, 2, 1.5)).toBe(1.5);
  expect(getWoodOutput(30, 2, -1)).toBe(0);
  expect(getWoodOutput(30, 0, 100)).toBe(0);
});
