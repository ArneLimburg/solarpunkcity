import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getCommunityGardenLayout,
  getVisitorSpots,
} from "../src/communityGarden";
import { buildGeometry } from "../src/farmGeometry";
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
    buildable: true,
    icon: "leisure/leisure.svg",
    label: "Leisure",
  });
  expect(BuildingTypes.CommunityGarden).toEqual({
    category: "LEISURE",
    icon: "leisure/community-garden.svg",
    label: "Community garden",
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

test("the construction site needs 4 wood", () => {
  game.build("CommunityGarden", tile);
  const [site] = board.getConstructionSites();
  expect(site.remainingWood).toBe(4);
  expect(site.remainingWork).toBe(12);
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
  // the garden takes no workers; food is not compared because it depends on
  // the ecology through the harvest
  expect(withGarden.workforce).toEqual(reference.workforce);
  expect(withGarden.freeLaborShare).toBe(reference.freeLaborShare);
  expect(withGarden.laborFactor).toBe(reference.laborFactor);
  expect(withGarden.resources.labor).toBe(reference.resources.labor);
  expect(withGarden.population).toBe(reference.population);
  expect(withGarden.residents).toHaveLength(reference.residents.length);
  expect(withGarden.housing).toBe(reference.housing);
  expect(withGarden.ecology).toBeLessThan(reference.ecology);
});

describe("the model", () => {
  const parts = () => getCommunityGardenLayout(1);
  const byColor = (color: string) => parts().filter((p) => p.color === color);
  const inHex = ({ x, z }: { x: number; z: number }) =>
    Math.abs(x) <= Math.sqrt(3) / 2 + 1e-9 &&
    Math.abs(x) / Math.sqrt(3) + Math.abs(z) <= 1 + 1e-9;
  const frames = () => byColor("wood").filter((p) => p.shape === "box");
  const path = () => byColor("gravel")[0];

  test("four beds, two on each side of the path", () => {
    expect(frames()).toHaveLength(4);
    expect(byColor("soil")).toHaveLength(4);
    expect(frames().filter((p) => p.z < path().z)).toHaveLength(2);
    expect(frames().filter((p) => p.z > path().z)).toHaveLength(2);
    for (const bed of frames()) {
      expect(bed.width).toBeCloseTo(0.25);
      expect(bed.depth).toBeCloseTo(0.12);
      expect(bed.height).toBeCloseTo(0.05);
      // clear of the path
      expect(Math.abs(bed.z) - bed.depth / 2).toBeGreaterThan(path().depth / 2);
    }
    expect(byColor("plant").length).toBeGreaterThan(0);
  });

  test("the path crosses the hex through its center", () => {
    expect(path()).toMatchObject({ x: 0, z: 0 });
    expect(path().depth).toBeLessThan(0.15);
  });

  test("flowers come in at least three colors and there is a barrel", () => {
    const flowers = parts().filter((p) =>
      ["poppy", "sunflower", "lavender"].includes(p.color),
    );
    expect(new Set(flowers.map((p) => p.color)).size).toBeGreaterThanOrEqual(3);
    expect(parts().filter((p) => p.shape === "cylinder")).toHaveLength(1);
  });

  test("two visitor spots in front of different beds", () => {
    const spots = getVisitorSpots(1);
    expect(spots).toHaveLength(2);
    const nearest = spots.map((spot) =>
      frames().findIndex(
        (bed) =>
          Math.abs(bed.x - spot.x) < bed.width / 2 &&
          Math.abs(bed.z - spot.z) < 0.2,
      ),
    );
    expect(nearest.every((index) => index >= 0)).toBe(true);
    expect(nearest[0]).not.toBe(nearest[1]);
    expect(getVisitorSpots(2)[0].x).toBe(spots[0].x * 2);
  });

  test("every part lies within the hex and the beds do not overlap", () => {
    for (const p of parts()) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          expect(
            inHex({ x: p.x + (sx * p.width) / 2, z: p.z + (sz * p.depth) / 2 }),
          ).toBe(true);
        }
      }
    }
    const beds = frames();
    for (const a of beds) {
      for (const b of beds.filter((other) => other !== a)) {
        const apart =
          Math.abs(a.x - b.x) >= (a.width + b.width) / 2 ||
          Math.abs(a.z - b.z) >= (a.depth + b.depth) / 2;
        expect(apart).toBe(true);
      }
    }
  });

  test("the model stays below 1,000 triangles and scales with the hex size", () => {
    const triangles = buildGeometry(parts()).indices.length / 3;
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThan(1000);
    expect(getCommunityGardenLayout(2)[0].width).toBe(parts()[0].width * 2);
  });
});
