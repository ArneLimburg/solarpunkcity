import { beforeEach, expect, test, vi } from "vitest";
import type { HexCoordinates } from "../src/board";
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

// turns every tile of the settlement area into a storage, except the given ones
function blockAllExcept(free: HexCoordinates[]) {
  for (const tile of areaTiles()) {
    if (!free.some((other) => same(other, tile))) {
      board.setBuilding(tile, definitions.BuildingDefinition.WoodStorage);
    }
  }
}

function block(tile: HexCoordinates) {
  board.setBuilding(tile, definitions.BuildingDefinition.WoodStorage);
}

function expectValidLoop(loop: HexCoordinates[]) {
  expect(loop.length).toBeGreaterThanOrEqual(3);
  expect(loop.length).toBeLessThanOrEqual(6);
  for (let i = 0; i < loop.length; i++) {
    expect(settlers.hexDistance(loop[i], loop[(i + 1) % loop.length])).toBe(1);
    expect(settlers.hexDistance(loop[i], ORIGIN)).toBeLessThanOrEqual(3);
    expect(settlers.isWalkable(loop[i])).toBe(true);
  }
  expect(new Set(loop.map((tile) => `${tile.q},${tile.r}`)).size).toBe(
    loop.length,
  );
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

test("the settlement area holds the walkable tiles within 3 tiles", () => {
  const tiles = settlers.getUsableTiles();
  // 37 tiles minus the camp
  expect(tiles).toHaveLength(36);
  expect(tiles.some((tile) => same(tile, ORIGIN))).toBe(false);
  block({ q: 1, r: 0 });
  expect(settlers.getUsableTiles()).toHaveLength(35);
});

test("the scene coordinates match the hex geometry", () => {
  for (const tile of areaTiles()) {
    const pixel = hexToPixel(tile.q, tile.r);
    expect(settlers.tileX(tile)).toBeCloseTo(pixel.x);
    expect(settlers.tileZ(tile)).toBeCloseTo(pixel.z);
  }
});

// ---- loops ----

test("every loop has 3 to 6 adjacent walkable tiles and returns to its start", () => {
  const owner = { seed: 5 };
  const lengths = new Set<number>();
  for (let i = 0; i < 100; i++) {
    const start = settlers.getUsableTiles()[i % 36];
    const loop = settlers.findLoop(start, owner)!;
    expect(loop[0]).toEqual(start);
    expectValidLoop(loop);
    lengths.add(loop.length);
  }
  expect(lengths.size).toBeGreaterThan(1);
});

test("there is no loop on a path without a way back", () => {
  blockAllExcept([
    { q: 1, r: 0 },
    { q: 2, r: 0 },
    { q: 3, r: 0 },
  ]);
  expect(settlers.findLoop({ q: 1, r: 0 }, { seed: 1 })).toBeUndefined();
});

// ---- walkers ----

test("settlers start on loops near the camp with their own positions and phases", () => {
  const walkers = [1, 2, 3, 4].map((id) => settlers.createWalker(id, id * 77));
  for (const walker of walkers) {
    expectValidLoop(walker.loop);
    expect(
      settlers.hexDistance(settlers.getStandingTile(walker), ORIGIN),
    ).toBeLessThanOrEqual(3);
  }
  expect(new Set(walkers.map((walker) => walker.x)).size).toBe(4);
  expect(new Set(walkers.map((walker) => walker.phase)).size).toBe(4);
  // the same seed gives the same settler
  expect(settlers.createWalker(1, 77)).toEqual(walkers[0]);
});

test("a settler walks along the loop, turns, bobs and pauses", () => {
  const walker = settlers.createWalker(1, 3);
  const start = { x: walker.x, z: walker.z };
  const headings = new Set<number>();
  let paused = 0;
  let walked = 0;
  let bobbed = false;
  for (let i = 0; i < 6000; i++) {
    settlers.advanceWalker(walker, 1 / 60);
    headings.add(Math.round(walker.heading * 10));
    if (!walker.walking) {
      paused++;
      expect(walker.bob).toBe(0);
    } else {
      walked++;
      bobbed ||= walker.bob > 0;
    }
  }
  expect(Math.hypot(walker.x - start.x, walker.z - start.z)).toBeLessThan(5);
  expect(headings.size).toBeGreaterThan(3);
  expect(paused).toBeGreaterThan(0);
  expect(walked).toBeGreaterThan(paused);
  expect(bobbed).toBe(true);
  expect(walker.bob).toBeLessThanOrEqual(settlers.BOB_HEIGHT);
});

test("the heading turns the short way at a limited speed", () => {
  const walker = settlers.createWalker(1, 3);
  walker.pause = 100; // stands still and turns to the next tile
  walker.heading = settlers.createWalker(1, 3).heading + 3;
  const before = walker.heading;
  settlers.advanceWalker(walker, 0.01);
  expect(Math.abs(walker.heading - before)).toBeCloseTo(
    settlers.TURN_SPEED * 0.01,
  );
  walker.heading = 100; // many turns away: still the short way
  settlers.advanceWalker(walker, 0.01);
  expect(Math.abs(walker.heading - 100)).toBeCloseTo(
    settlers.TURN_SPEED * 0.01,
  );
  settlers.advanceWalker(walker, 100);
  expect(walker.pause).toBe(0);
});

test("the same elapsed time gives the same movement at any frame rate", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const walkers = [10, 30, 60, 144].map(() => settlers.createWalker(1, seed));
    [10, 30, 60, 144].forEach((fps, i) => {
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
    for (let i = 0; i < 3000; i++) {
      settlers.advanceWalker(walker, 0.05);
      const tile = pixelToHex(walker);
      expect(settlers.isWalkable(tile)).toBe(true);
      expect(settlers.hexDistance(tile, ORIGIN)).toBeLessThanOrEqual(3);
      expect(walker.loop.some((other) => same(other, tile))).toBe(true);
    }
  }
});

test("a loop that is blocked by a building is replaced", () => {
  const walker = settlers.createWalker(1, 9);
  const blocked = walker.loop[1];
  block(blocked);
  settlers.updateWalkers([walker]);
  expectValidLoop(walker.loop);
  expect(walker.loop.some((tile) => same(tile, blocked))).toBe(false);
  // an unaffected settler keeps its loop
  const loop = walker.loop;
  settlers.updateWalkers([walker]);
  expect(walker.loop).toBe(loop);
});

test("a settler on a tile that became blocked moves to the nearest walkable tile", () => {
  const walker = settlers.createWalker(1, 9);
  const standing = walker.loop[0];
  walker.segment = 0;
  walker.progress = 0;
  block(standing);
  settlers.updateWalkers([walker]);
  expectValidLoop(walker.loop);
  const now = settlers.getStandingTile(walker);
  expect(settlers.isWalkable(now)).toBe(true);
  expect(settlers.hexDistance(now, standing)).toBeLessThanOrEqual(2);
  expect(walker.x).toBeCloseTo(settlers.tileX(walker.loop[0]));
  expect(walker.walking).toBe(false);
});

test("a settler stands on the half of the segment it is closer to", () => {
  const walker = settlers.createWalker(1, 9);
  walker.segment = 0;
  walker.progress = 0.1;
  expect(settlers.getStandingTile(walker)).toBe(walker.loop[0]);
  walker.progress = 1.5;
  expect(settlers.getStandingTile(walker)).toBe(walker.loop[1]);
});

test("without any loop a settler pauses on the nearest walkable tile and resumes later", () => {
  const walker = settlers.createWalker(1, 9);
  const free = [
    { q: 1, r: 0 },
    { q: 2, r: 0 },
  ];
  blockAllExcept(free);
  settlers.updateWalkers([walker]);
  expect(walker.loop).toEqual([]);
  const rest = settlers.getStandingTile(walker);
  expect(free.some((tile) => same(tile, rest))).toBe(true);
  expect(walker.x).toBeCloseTo(settlers.tileX(rest));
  const { x, z } = walker;
  settlers.advanceWalker(walker, 10);
  expect(walker).toMatchObject({ x, z, walking: false });
  // still without loop: nothing changes, it tries again
  settlers.updateWalkers([walker]);
  expect(walker.loop).toEqual([]);

  // a free place makes a loop possible again
  board.setBuilding({ q: 1, r: 1 }, definitions.BuildingDefinition.Forest);
  board.setBuilding({ q: 2, r: -1 }, definitions.BuildingDefinition.Forest);
  settlers.updateWalkers([walker]);
  expectValidLoop(walker.loop);
});

test("a loop may be found elsewhere in the area", () => {
  const walker = settlers.createWalker(1, 9);
  // a triangle far from the walker is the only loop that is left
  const triangle = [
    { q: 3, r: -3 },
    { q: 2, r: -2 },
    { q: 2, r: -3 },
  ];
  blockAllExcept([...triangle, { q: -3, r: 3 }]);
  walker.segment = 0;
  walker.progress = 0;
  settlers.updateWalkers([walker]);
  expectValidLoop(walker.loop);
  expect(walker.loop.every((tile) => triangle.some((t) => same(t, tile)))).toBe(
    true,
  );
});

test("without any walkable tile in the area a settler stays where it is", () => {
  const walker = settlers.createWalker(1, 9);
  blockAllExcept([]);
  const { x, z } = walker;
  settlers.updateWalkers([walker]);
  expect(walker.loop).toEqual([]);
  expect(walker).toMatchObject({ x, z, walking: false });
  expect(settlers.createWalker(2, 5)).toMatchObject({ loop: [], x: 0, z: 0 });
});

test("a new settler without a loop rests on a walkable tile", () => {
  blockAllExcept([
    { q: 1, r: 0 },
    { q: 2, r: 0 },
  ]);
  const walker = settlers.createWalker(1, 9);
  expect(walker.loop).toEqual([]);
  expect(settlers.isWalkable(settlers.getStandingTile(walker))).toBe(true);
});
