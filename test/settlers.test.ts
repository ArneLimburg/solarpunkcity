import { beforeEach, expect, test, vi } from "vitest";
import type { HexCoordinates } from "../src/board";
import type { Walker } from "../src/settlers";
import { ageInWeek } from "../src/calendar";
import { hexToPixel, pixelToHex } from "../src/hexGeometry";

let board: typeof import("../src/board");
let settlers: typeof import("../src/settlers");
let definitions: typeof import("../src/gameDefinitions");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  settlers = await import("../src/settlers");
  definitions = await import("../src/gameDefinitions");
});

test("removeResidents removes by ID and keeps the others", () => {
  const roster = settlers.createRoster(1);
  settlers.syncRoster(roster, 4);
  const [a, b, c, d] = roster.residents;
  settlers.removeResidents(roster, [b.id, c.id]);
  expect(roster.residents).toEqual([a, d]);
  settlers.syncRoster(roster, 3);
  expect(roster.residents.map(({ id }) => id)).toEqual([a.id, d.id, 5]);
});

const ORIGIN = { q: 0, r: 0 };

function areaTiles(): HexCoordinates[] {
  const tiles: HexCoordinates[] = [];
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (settlers.hexDistance({ q, r }, ORIGIN) <= 3) {
        tiles.push({ q, r });
      }
    }
  }
  return tiles;
}

const same = (a: HexCoordinates, b: HexCoordinates) =>
  a.q === b.q && a.r === b.r;

// turns every tile near the camp into a river (not walkable, not built, so the
// settlement area does not grow), except the camp and the given ones
function blockAllExcept(free: HexCoordinates[]) {
  for (const tile of areaTiles()) {
    if (!free.some((other) => same(other, tile)) && !same(tile, ORIGIN)) {
      block(tile);
    }
  }
}

function block(tile: HexCoordinates) {
  board.setBuilding(tile, definitions.BuildingDefinition.River);
}

function inArea(tile: HexCoordinates): boolean {
  return settlers.getUsableTiles().some((other) => same(other, tile));
}

// plans the walk of the walker like the renderer does (through its queue)
function plan(walker: Walker) {
  if (walker.needsRoute) {
    settlers.planWalk(walker);
  }
}

// advances in frames of 1/30 s and plans every route that is asked for; calls
// `onFrame` after each frame
function run(walker: Walker, seconds: number, onFrame = () => {}) {
  for (let i = 0; i < seconds * 30; i++) {
    plan(walker);
    settlers.advanceWalker(walker, 1 / 30);
    onFrame();
  }
}

// the destinations of the walker in the order it chooses them
function destinations(walker: Walker, seconds: number): HexCoordinates[] {
  const seen: HexCoordinates[] = [];
  run(walker, seconds, () => {
    const [destination] = walker.destination;
    if (destination && !same(destination, seen.at(-1) ?? ORIGIN)) {
      seen.push(destination);
    }
  });
  return seen;
}

// ---- residents ----

test("a roster grows, shrinks the newest first and never reuses an ID", () => {
  const roster = settlers.createRoster(42);
  const first = settlers.syncRoster(roster, 5);
  expect(first.map((resident) => resident.id)).toEqual([1, 2, 3, 4, 5]);
  for (const { clothing, skin } of first) {
    expect(settlers.CLOTHING_COLORS).toContain(clothing);
    expect(settlers.SKIN_TONES).toContain(skin);
  }

  const shrunk = settlers.syncRoster(roster, 2);
  expect(shrunk).toEqual(first.slice(0, 2));

  const regrown = settlers.syncRoster(roster, 4);
  expect(regrown.slice(0, 2)).toEqual(first.slice(0, 2));
  expect(regrown.map((resident) => resident.id)).toEqual([1, 2, 6, 7]);
});

test("a roster is reproducible from its seed and uses the whole palettes", () => {
  const a = settlers.syncRoster(settlers.createRoster(7), 200);
  const b = settlers.syncRoster(settlers.createRoster(7), 200);
  expect(a).toEqual(b);
  expect(new Set(a.map((resident) => resident.clothing)).size).toBe(
    settlers.CLOTHING_COLORS.length,
  );
  expect(new Set(a.map((resident) => resident.skin)).size).toBe(
    settlers.SKIN_TONES.length,
  );
});

test("every resident has a hobby, resident 1 gardens and the hobby never changes", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const roster = settlers.createRoster(seed);
    expect(settlers.syncRoster(roster, 1)[0].hobby).toBe("Gardening");
  }
  const roster = settlers.createRoster(11);
  const first = settlers.syncRoster(roster, 50);
  for (const { hobby } of first) {
    expect(["Gardening", "Nature watching"]).toContain(hobby);
  }
  expect(new Set(first.map((resident) => resident.hobby)).size).toBe(2);
  settlers.syncRoster(roster, 10);
  const regrown = settlers.syncRoster(roster, 30);
  expect(regrown.slice(0, 10)).toEqual(first.slice(0, 10));
  const again = settlers.syncRoster(settlers.createRoster(11), 50);
  expect(again.map((resident) => resident.hobby)).toEqual(
    first.map((resident) => resident.hobby),
  );
});

test("a pausing settler follows the hobby", () => {
  for (const [hobby, activity] of [
    ["Gardening", "Gardening"],
    ["Nature watching", "Observing a butterfly"],
  ] as const) {
    const walker = settlers.createWalker(1, 3, hobby);
    walker.pause = 1;
    walker.walking = false;
    expect(settlers.getActivity(walker)).toBe(activity);
  }
});

test("residents get a name and a starting age once, for good", () => {
  const roster = settlers.createRoster(5);
  const first = settlers.syncRoster(roster, 30);
  for (const { name, age } of first) {
    const [given, family, ...rest] = name.split(" ");
    expect(settlers.FIRST_NAMES).toContain(given);
    expect(settlers.LAST_NAMES).toContain(family);
    expect(rest).toEqual([]);
    expect(Number.isInteger(age)).toBe(true);
    expect(age).toBeGreaterThanOrEqual(settlers.MIN_AGE);
    expect(age).toBeLessThanOrEqual(settlers.MAX_AGE);
  }
  expect(new Set(first.map(({ name }) => name)).size).toBeGreaterThan(10);
  expect(new Set(first.map(({ age }) => age)).size).toBeGreaterThan(5);
  // they stay the same when others leave and arrive
  settlers.syncRoster(roster, 10);
  expect(settlers.syncRoster(roster, 30).slice(0, 10)).toEqual(
    first.slice(0, 10),
  );
});

test("residents are as old as generated on the day of joining, starting settlers and newcomers", () => {
  const roster = settlers.createRoster(11);
  const starters = settlers.syncRoster(roster, 20, 0);
  for (const { age, birthDate } of starters) {
    expect(ageInWeek(birthDate, 0)).toBe(age);
  }
  const all = settlers.syncRoster(roster, 40, 37);
  for (const { age, birthDate } of all.slice(20)) {
    expect(ageInWeek(birthDate, 37)).toBe(age);
  }
});

test("birth dates are deterministic for a seed and do not change over ticks", () => {
  const a = settlers.syncRoster(settlers.createRoster(9), 30, 5);
  const b = settlers.syncRoster(settlers.createRoster(9), 30, 5);
  expect(a.map(({ birthDate }) => birthDate)).toEqual(
    b.map(({ birthDate }) => birthDate),
  );
  expect(new Set(a.map(({ birthDate }) => birthDate)).size).toBeGreaterThan(20);
  const roster = settlers.createRoster(9);
  const first = settlers.syncRoster(roster, 10, 0);
  const later = settlers.syncRoster(roster, 10, 99);
  expect(later).toEqual(first);
});

test("random numbers are in [0, 1) and differ per seed", () => {
  const owner = { seed: 1 };
  const values = Array.from({ length: 100 }, () => settlers.random(owner));
  expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...values)).toBeLessThan(1);
  expect(settlers.random({ seed: 1 })).not.toBe(settlers.random({ seed: 2 }));
});

// ---- walkability ----

test("only forest tiles on the board are walkable", () => {
  expect(settlers.isWalkable({ q: 5, r: 0 })).toBe(true);
  // camp
  expect(settlers.isWalkable(ORIGIN)).toBe(false);
  // placed building
  board.placeBuilding({ q: 10, r: 0 }, definitions.BuildingDefinition.Farm);
  expect(settlers.isWalkable({ q: 10, r: 0 })).toBe(false);
  expect(settlers.isWalkable({ q: 11, r: 0 })).toBe(false); // footprint
  // construction site
  board.placeBuilding(
    { q: -10, r: 0 },
    definitions.BuildingDefinition.OrganicHomestead,
    4,
    0,
  );
  expect(settlers.isWalkable({ q: -10, r: 0 })).toBe(false);
  // off the board
  expect(settlers.isWalkable({ q: 31, r: 0 })).toBe(false);
  expect(settlers.isWalkable({ q: board.GRID_RADIUS, r: 1 })).toBe(false);
});

test("on the initial board the settlement area holds the walkable tiles within 3 of the camp", () => {
  const tiles = settlers.getUsableTiles();
  // 37 tiles minus the camp
  expect(tiles).toHaveLength(36);
  expect(tiles.some((tile) => same(tile, ORIGIN))).toBe(false);
  const expected = areaTiles().filter(settlers.isWalkable);
  expect(tiles).toHaveLength(expected.length);
  expect(expected.every(inArea)).toBe(true);
  block({ q: 1, r: 0 });
  expect(settlers.getUsableTiles()).toHaveLength(35);
});

test("the settlement area is a belt of 3 tiles around every built tile", () => {
  const farm = definitions.BuildingDefinition.Farm;
  // single tile at distance 3 (in), 4 (out)
  board.setBuilding(
    { q: 20, r: 0 },
    definitions.BuildingDefinition.WoodStorage,
  );
  expect(inArea({ q: 17, r: 0 })).toBe(true);
  expect(inArea({ q: 16, r: 0 })).toBe(false);
  // the built tile itself
  expect(inArea({ q: 20, r: 0 })).toBe(false);
  // a river tile next to a building
  block({ q: 19, r: 0 });
  expect(inArea({ q: 19, r: 0 })).toBe(false);
  expect(inArea({ q: 18, r: 0 })).toBe(true);
  // a construction site counts
  board.placeBuilding({ q: -20, r: 0 }, farm, 4, 0);
  expect(inArea({ q: -24, r: 0 })).toBe(true);
  expect(inArea({ q: -25, r: 0 })).toBe(false);
  // one tile of a multi-tile footprint is enough
  board.placeBuilding({ q: 0, r: 20 }, farm);
  const edge = { q: 1 + 3, r: 20 };
  expect(inArea(edge)).toBe(true);
  expect(inArea({ q: edge.q + 1, r: 20 })).toBe(false);
  // two far buildings: both belts, not the gap
  expect(inArea({ q: 17, r: 0 })).toBe(true);
  expect(inArea({ q: -24, r: 0 })).toBe(true);
  expect(inArea({ q: -10, r: 0 })).toBe(false);
  // the area is cached until the board changes
  expect(settlers.getUsableTiles()).toEqual(settlers.getUsableTiles());
  expect(board.getBoardVersion()).toBeGreaterThan(0);
});

test("the scene coordinates match the hex geometry", () => {
  for (const tile of areaTiles()) {
    const pixel = hexToPixel(tile.q, tile.r);
    expect(settlers.tileX(tile)).toBeCloseTo(pixel.x);
    expect(settlers.tileZ(tile)).toBeCloseTo(pixel.z);
  }
});

// ---- walkers ----

test("settlers start on tiles near the camp with their own positions and phases and wait for their first walk", () => {
  const walkers = [1, 2, 3, 4].map((id) => settlers.createWalker(id, id * 77));
  for (const walker of walkers) {
    expect(walker.needsRoute).toBe(true);
    expect(inArea(settlers.getStandingTile(walker))).toBe(true);
    expect(settlers.isRoaming(walker)).toBe(true);
  }
  expect(new Set(walkers.map((walker) => walker.x)).size).toBe(4);
  expect(new Set(walkers.map((walker) => walker.phase)).size).toBe(4);
  // the same seed gives the same settler
  expect(settlers.createWalker(1, 77)).toEqual(walkers[0]);
  // before the route is planned it stands still
  settlers.advanceWalker(walkers[0], 5);
  expect(walkers[0]).toMatchObject({ walking: false, bob: 0 });
});

test("a settler walks from destination to destination, turns, bobs and pauses 1 to 3 s at each", () => {
  const walker = settlers.createWalker(1, 3);
  const headings = new Set<number>();
  let paused = 0;
  let walked = 0;
  let bobbed = false;
  let pauseFrames = 0;
  const pauses: number[] = [];
  run(walker, 200, () => {
    headings.add(Math.round(walker.heading * 10));
    if (walker.walking) {
      walked++;
      bobbed ||= walker.bob > 0;
      if (pauseFrames > 0) {
        pauses.push(pauseFrames / 30);
        pauseFrames = 0;
      }
    } else {
      expect(walker.bob).toBe(0);
      paused++;
      pauseFrames += walker.pause > 0 ? 1 : 0;
    }
  });
  expect(headings.size).toBeGreaterThan(3);
  expect(paused).toBeGreaterThan(0);
  expect(walked).toBeGreaterThan(0);
  expect(bobbed).toBe(true);
  expect(walker.bob).toBeLessThanOrEqual(settlers.BOB_HEIGHT);
  expect(pauses.length).toBeGreaterThan(3);
  for (const pause of pauses) {
    expect(pause).toBeGreaterThanOrEqual(settlers.PAUSE_MIN - 0.1);
    expect(pause).toBeLessThanOrEqual(settlers.PAUSE_MAX + 0.1);
  }
});

test("over several walks a settler visits different destinations of the area, never its own tile or the last destination", () => {
  const walker = settlers.createWalker(1, 3);
  const seen = destinations(walker, 600);
  expect(seen.length).toBeGreaterThan(10);
  expect(
    new Set(seen.map((tile) => `${tile.q},${tile.r}`)).size,
  ).toBeGreaterThan(5);
  seen.forEach((tile, i) => {
    expect(inArea(tile)).toBe(true);
    if (i > 0) {
      expect(same(tile, seen[i - 1])).toBe(false);
    }
  });
  // planning directly: neither the standing tile nor the last destination
  for (let i = 0; i < 100; i++) {
    const standing = settlers.getStandingTile(walker);
    const last = walker.destination[0];
    settlers.planWalk(walker);
    const [next] = walker.destination;
    expect(same(next, standing)).toBe(false);
    expect(same(next, last)).toBe(false);
    expect(walker.path[0]).toEqual(standing);
    expect(walker.path.at(-1)).toEqual(next);
    expect(walker.needsRoute).toBe(false);
    expect(walker.blocked).toBe(false);
    walker.rest = next;
    walker.path = [];
  }
});

test("the previous destination is reused only when no other tile exists", () => {
  const free = [
    { q: 1, r: 0 },
    { q: 2, r: 0 },
  ];
  blockAllExcept(free);
  const walker = settlers.createWalker(1, 3);
  const standing = settlers.getStandingTile(walker);
  const other = free.find((tile) => !same(tile, standing))!;
  // the previous destination is the only other tile: it is reused
  walker.destination = [other];
  settlers.planWalk(walker);
  expect(walker.destination).toEqual([other]);
  // only the standing tile is left: nowhere to go
  blockAllExcept([standing]);
  walker.rest = standing;
  walker.path = [];
  settlers.planWalk(walker);
  expect(walker.blocked).toBe(true);
  expect(walker.path).toEqual([]);
});

test("every step of a route is walkable, and it may leave the settlement area", () => {
  const walker = settlers.createWalker(1, 3);
  let outside = false;
  for (let i = 0; i < 200; i++) {
    settlers.planWalk(walker);
    for (const tile of walker.path) {
      expect(settlers.isWalkable(tile)).toBe(true);
      outside ||= !inArea(tile);
    }
    walker.rest = walker.destination[0];
    walker.path = [];
  }
  expect(outside).toBe(false); // on the initial board the area is convex
  // a route around a building on the way
  blockAllExcept([
    { q: 1, r: 0 },
    { q: 2, r: 0 },
    { q: 3, r: 0 },
    { q: 3, r: -1 },
  ]);
  board.setBuilding({ q: 4, r: 0 }, definitions.BuildingDefinition.Forest);
  board.setBuilding({ q: 4, r: -1 }, definitions.BuildingDefinition.Forest);
  const second = settlers.createWalker(2, 1);
  second.rest = { q: 1, r: 0 };
  for (let i = 0; i < 20; i++) {
    settlers.planWalk(second);
    for (const tile of second.path) {
      expect(settlers.isWalkable(tile)).toBe(true);
    }
    second.rest = second.path.at(-1)!;
    second.path = [];
  }
});

test("the heading turns the short way at a limited speed", () => {
  const walker = settlers.createWalker(1, 3);
  plan(walker);
  settlers.advanceWalker(walker, 0.01);
  const before = walker.heading;
  walker.heading = before + 3;
  const start = walker.heading;
  settlers.advanceWalker(walker, 0.01);
  expect(Math.abs(walker.heading - start)).toBeCloseTo(
    settlers.TURN_SPEED * 0.01,
  );
  walker.heading = 100; // many turns away: still the short way
  settlers.advanceWalker(walker, 0.01);
  expect(Math.abs(walker.heading - 100)).toBeCloseTo(
    settlers.TURN_SPEED * 0.01,
  );
});

test("the same elapsed time gives the same movement at any frame rate", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const walkers = [10, 30, 60, 144].map(() => settlers.createWalker(1, seed));
    [10, 30, 60, 144].forEach((fps, i) => {
      plan(walkers[i]);
      for (let frame = 0; frame < fps * 20; frame++) {
        settlers.advanceWalker(walkers[i], 1 / fps);
      }
    });
    for (const walker of walkers) {
      expect(walker.x).toBeCloseTo(walkers[0].x, 3);
      expect(walker.z).toBeCloseTo(walkers[0].z, 3);
      expect(walker.heading).toBeCloseTo(walkers[0].heading, 3);
    }
  }
});

test("settlers stay on walkable tiles of the board", () => {
  for (let id = 1; id <= 10; id++) {
    const walker = settlers.createWalker(id, id);
    run(walker, 100, () => {
      const tile = pixelToHex(walker);
      expect(settlers.isWalkable(tile)).toBe(true);
      expect(settlers.hexDistance(tile, ORIGIN)).toBeLessThanOrEqual(3);
    });
  }
});

test("a settler whose route is still walkable keeps it when a far building is placed", () => {
  const walker = settlers.createWalker(1, 9);
  settlers.planWalk(walker);
  const path = walker.path;
  expect(settlers.isWalkAffected(walker)).toBe(false);
  board.placeBuilding({ q: 0, r: -15 }, definitions.BuildingDefinition.Farm);
  expect(settlers.isWalkAffected(walker)).toBe(false);
  expect(walker.path).toBe(path);
});

test("a destination that leaves the area or a blocked route is replanned from the current tile", () => {
  const walker = settlers.createWalker(1, 9);
  settlers.planWalk(walker);
  walker.pause = 0;
  // a building on the route
  const middle = walker.path[Math.floor(walker.path.length / 2)];
  const [target] = walker.destination;
  if (!same(middle, walker.path[0]) && !same(middle, target)) {
    block(middle);
    expect(settlers.isWalkAffected(walker)).toBe(true);
  }
  // the destination is no walkable tile any more
  settlers.planWalk(walker);
  block(walker.destination[0]);
  expect(settlers.isWalkAffected(walker)).toBe(true);
  settlers.replanRoute(walker);
  expect(walker.path).toEqual([]);
  expect(walker.needsRoute).toBe(true);
  settlers.planWalk(walker);
  expect(walker.blocked).toBe(false);
  expect(walker.path.every(settlers.isWalkable)).toBe(true);
});

test("with no reachable destination the walker stands still and plans again after the next board change", () => {
  const walker = settlers.createWalker(1, 9);
  const standing = settlers.getStandingTile(walker);
  blockAllExcept([standing]);
  plan(walker);
  expect(walker.blocked).toBe(true);
  expect(settlers.isWalkAffected(walker)).toBe(true);
  const { x, z } = walker;
  run(walker, 20);
  expect(walker).toMatchObject({ x, z, walking: false });
  expect(walker.needsRoute).toBe(false); // it does not search again by itself
  // a free neighbor makes a walk possible again
  const free = [
    { q: standing.q + 1, r: standing.r },
    { q: standing.q - 1, r: standing.r },
    { q: standing.q, r: standing.r + 1 },
    { q: standing.q, r: standing.r - 1 },
  ].find(
    (tile) => !same(tile, ORIGIN) && settlers.hexDistance(tile, ORIGIN) <= 3,
  )!;
  board.setBuilding(free, definitions.BuildingDefinition.Forest);
  settlers.replanRoute(walker);
  settlers.planWalk(walker);
  expect(walker.blocked).toBe(false);
  expect(walker.destination).toEqual([free]);
});

test("a walker without any tile in the area stays at the origin and keeps asking", () => {
  blockAllExcept([]);
  const walker = settlers.createWalker(1, 5);
  expect(walker).toMatchObject({ x: 0, z: 0, needsRoute: true });
  plan(walker);
  expect(walker.blocked).toBe(true);
});

test("a task or a visit ends with a new walk", () => {
  const walker = settlers.createWalker(1, 9);
  const target = { q: 3, r: 0 };
  settlers.startTask(walker, "work", [target]);
  expect(settlers.isRoaming(walker)).toBe(false);
  settlers.planRoute(walker);
  expect(walker.path.at(-1)).toEqual(target);
  settlers.clearTask(walker);
  expect(settlers.isRoaming(walker)).toBe(true);
  expect(walker).toMatchObject({ needsRoute: true, path: [] });
  settlers.planWalk(walker);
  expect(walker.blocked).toBe(false);
  settlers.startVisit(walker, { garden: "g", x: 0, z: 0, heading: 0 }, [
    target,
  ]);
  settlers.endVisit(walker, true);
  expect(settlers.isRoaming(walker)).toBe(true);
  expect(walker.needsRoute).toBe(true);
});

test("newcomers spawn in the belt of a far building and nowhere else", () => {
  board.placeBuilding(
    { q: 0, r: -10 },
    definitions.BuildingDefinition.OrganicHomestead,
  );
  const area = settlers.getUsableTiles();
  expect(area.length).toBeGreaterThan(36);
  const far = new Set<number>();
  for (let id = 1; id <= 60; id++) {
    const walker = settlers.createWalker(id, id * 31);
    const tile = settlers.getStandingTile(walker);
    expect(inArea(tile)).toBe(true);
    if (settlers.hexDistance(tile, ORIGIN) > 3) {
      far.add(id);
    }
  }
  expect(far.size).toBeGreaterThan(0);
  expect(far.size).toBeLessThan(60);
});

test("a settler standing on a tile that became a building walks off it", () => {
  const walker = settlers.createWalker(1, 9);
  const standing = settlers.getStandingTile(walker);
  board.setBuilding(standing, definitions.BuildingDefinition.Farm);
  settlers.planWalk(walker);
  expect(walker.blocked).toBe(false);
  expect(walker.path[0]).toEqual(standing);
  expect(walker.path.slice(1).every(settlers.isWalkable)).toBe(true);
  const seconds = 1 / 30;
  for (let i = 0; i < 20 * 30; i++) {
    const { x, z } = walker;
    settlers.advanceWalker(walker, seconds);
    plan(walker);
    expect(Math.hypot(walker.x - x, walker.z - z)).toBeLessThanOrEqual(
      settlers.WALK_SPEED * seconds + 1e-6,
    );
  }
});
