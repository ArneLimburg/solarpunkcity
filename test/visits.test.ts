import { afterEach, expect, test } from "vitest";
import { placeBuilding, setBuilding } from "../src/board";
import { BuildingDefinition } from "../src/gameDefinitions";
import {
  assignVisits,
  getGardens,
  type Garden,
  type Visit,
  type VisitResident,
} from "../src/visits";

const garden = (q: number, r: number): Garden => ({
  key: `${q},${r}`,
  center: { q, r },
  tiles: [{ q, r }],
});
const near = garden(2, 0);
const far = garden(-6, 3);

const resident = (
  id: number,
  overrides: Partial<VisitResident> = {},
): VisitResident => ({
  id,
  gardener: true,
  hasTask: false,
  ready: true,
  tile: { q: 0, r: 0 },
  ...overrides,
});

const none = new Map<number, Visit>();

test("only idle, ready gardeners get a spot", () => {
  const visits = assignVisits(
    none,
    [
      resident(1),
      resident(2, { gardener: false }), // a nature watcher
      resident(3, { hasTask: true }),
      resident(4, { ready: false }), // cooldown
    ],
    [near],
  );
  expect([...visits.keys()]).toEqual([1]);
  expect(visits.get(1)).toEqual({ garden: "2,0", spot: 0 });
});

test("a garden has two spots: of three gardeners at most two get one", () => {
  const visits = assignVisits(
    none,
    [resident(1), resident(2), resident(3)],
    [near],
  );
  expect([...visits]).toEqual([
    [1, { garden: "2,0", spot: 0 }],
    [2, { garden: "2,0", spot: 1 }],
  ]);
});

test("the nearest garden with a free spot comes first, ties by garden key", () => {
  const visits = assignVisits(
    none,
    [resident(1), resident(2), resident(3)],
    [far, near],
  );
  expect(visits.get(1)).toEqual({ garden: "2,0", spot: 0 });
  expect(visits.get(2)).toEqual({ garden: "2,0", spot: 1 });
  expect(visits.get(3)).toEqual({ garden: "-6,3", spot: 0 });

  // from where the settler stands, not from the camp
  const west = assignVisits(
    none,
    [resident(1, { tile: { q: -5, r: 3 } })],
    [near, far],
  );
  expect(west.get(1)?.garden).toBe("-6,3");

  // the same distance: the smaller key
  const tie = assignVisits(none, [resident(1)], [garden(0, 2), garden(0, -2)]);
  expect(tie.get(1)?.garden).toBe("0,-2");
  const reversed = assignVisits(
    none,
    [resident(1)],
    [garden(0, -2), garden(0, 2)],
  );
  expect(reversed.get(1)?.garden).toBe("0,-2");
});

test("an unchanged assignment is kept across ticks", () => {
  const residents = [resident(1), resident(2), resident(3)];
  const first = assignVisits(none, residents, [near, far]);
  const second = assignVisits(first, residents, [far, near]);
  expect(second).toEqual(first);
  // even if a visitor is not ready: the cooldown only blocks new visits
  const third = assignVisits(
    first,
    [resident(1, { ready: false }), resident(2), resident(3)],
    [near, far],
  );
  expect(third).toEqual(first);
});

test("a task, leaving the population and demolition free the spot", () => {
  const residents = [resident(1), resident(2), resident(3)];
  const first = assignVisits(none, residents, [near]);
  expect(first.size).toBe(2);

  const task = assignVisits(
    first,
    [resident(1, { hasTask: true }), resident(2), resident(3)],
    [near],
  );
  expect([...task]).toEqual([
    [2, { garden: "2,0", spot: 1 }],
    [3, { garden: "2,0", spot: 0 }],
  ]);

  const left = assignVisits(first, [resident(2), resident(3)], [near]);
  expect(left.get(2)).toEqual({ garden: "2,0", spot: 1 });
  expect(left.get(3)).toEqual({ garden: "2,0", spot: 0 });
  expect(left.has(1)).toBe(false);

  const demolished = assignVisits(first, residents, []);
  expect(demolished.size).toBe(0);
  const moved = assignVisits(first, residents, [far]);
  expect(moved.get(1)).toEqual({ garden: "-6,3", spot: 0 });

  // a gardener who changed to nature watching (cannot happen, but is free)
  const changed = assignVisits(
    first,
    [resident(1, { gardener: false }), resident(2), resident(3)],
    [near],
  );
  expect(changed.has(1)).toBe(false);
});

test("a spot that two visits claim goes to the first", () => {
  const same = new Map<number, Visit>([
    [1, { garden: "2,0", spot: 1 }],
    [2, { garden: "2,0", spot: 1 }],
  ]);
  const visits = assignVisits(same, [resident(1), resident(2)], [near]);
  expect(visits.get(1)).toEqual({ garden: "2,0", spot: 1 });
  expect(visits.get(2)).toEqual({ garden: "2,0", spot: 0 });
});

const FINISHED = { q: -9, r: 5 };
const SITE = { q: -9, r: 7 };

afterEach(() => {
  setBuilding(FINISHED, BuildingDefinition.Forest);
  setBuilding(SITE, BuildingDefinition.Forest);
});

test("only finished gardens are visited, construction sites are not", () => {
  placeBuilding(FINISHED, BuildingDefinition.CommunityGarden);
  placeBuilding(SITE, BuildingDefinition.CommunityGarden, 12);
  placeBuilding({ q: -9, r: 9 }, BuildingDefinition.WoodStorage);
  expect(getGardens()).toEqual([
    { key: "-9,5", center: FINISHED, tiles: [FINISHED] },
  ]);
  setBuilding({ q: -9, r: 9 }, BuildingDefinition.Forest);
});
