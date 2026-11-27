import { beforeEach, expect, test, vi } from "vitest";
import {
  BuildingCategories,
  BuildingDefinition,
  BuildingTypes,
} from "../src/gameDefinitions";
import { emptyResources } from "../src/resources";

let game: typeof import("../src/game");
let board: typeof import("../src/board");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  game = await import("../src/game");
});

const tile = { q: 1, r: 0 };

test("the definition of the community garden", () => {
  expect(BuildingCategories.LEISURE).toEqual({
    name: "LEISURE",
    buildable: false,
  });
  expect(BuildingTypes.CommunityGarden).toEqual({
    category: "LEISURE",
    icon: "leisure/community-garden.svg",
  });
  expect(BuildingDefinition.CommunityGarden).toEqual({
    name: "Community garden",
    type: "CommunityGarden",
    description: "A place where settlers tend raised beds in their free time",
    size: 1,
    resident: 0,
    ecology: 0.5,
    cost: { ...emptyResources, wood: 4, labor: 12 },
    maxBuilders: 2,
    produces: emptyResources,
    consumes: emptyResources,
    recycling: { ...emptyResources, wood: 2 },
  });
  expect(BuildingDefinition.CommunityGarden.storage).toBeUndefined();
});

test("a garden is built on a forest tile in 6 weeks with at most 2 builders", () => {
  game.grantResources({ wood: 10 });
  expect(game.canBuild("CommunityGarden", tile)).toBe(true);
  game.build("CommunityGarden", tile);
  expect(board.getBuilding(tile)?.type).toBe("CommunityGarden");
  expect(board.isUnderConstruction(tile)).toBe(true);
  expect(game.getConstructionReport(tile)).toMatchObject({
    remainingWork: 12,
    builders: 0,
  });
  game.calculateWeek();
  expect(game.getConstructionReport(tile)).toMatchObject({
    remainingWork: 10,
    builders: 2,
    weeks: 5,
  });
  for (let week = 1; week < 6; week++) {
    expect(board.isUnderConstruction(tile)).toBe(true);
    game.calculateWeek();
  }
  expect(board.isUnderConstruction(tile)).toBe(false);
});

test("a finished garden changes no resource, labor or residents apart from the ecology", async () => {
  // the reference is a week on the untouched board
  const week = () => {
    game.grantResources({ wood: 10, food: 10 });
    return game.calculateWeek();
  };
  const reference = week();
  vi.resetModules();
  game = await import("../src/game");
  game.grantResources({ wood: 10 });
  game.build("CommunityGarden", tile);
  game.finishConstruction();
  const withGarden = week();
  const garden = BuildingDefinition.CommunityGarden;
  // the garden itself neither produces nor consumes anything
  expect(garden.produces).toEqual(emptyResources);
  expect(garden.consumes).toEqual(emptyResources);
  expect(withGarden.population).toBe(reference.population);
  expect(withGarden.residents).toHaveLength(reference.residents.length);
  expect(withGarden.housing).toBe(reference.housing);
  expect(withGarden.ecology).toBeLessThan(reference.ecology);
});
