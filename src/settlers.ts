import { getBuilding, isOnBoard, type HexCoordinates } from "./board";
import { BuildingTypes } from "./gameDefinitions";

// Residents (one record per person) and the walking settlers (pure movement
// rules, no React and no Babylon).

// muted and bright shades of clothing
export const CLOTHING_COLORS = [
  "#c0392b",
  "#e67e22",
  "#f1c40f",
  "#27ae60",
  "#16a085",
  "#2980b9",
  "#8e44ad",
  "#d35498",
  "#7f8c8d",
  "#a0522d",
  "#556b2f",
  "#708090",
  "#e8d5a3",
  "#4a6fa5",
  "#b5651d",
  "#ffffff",
];

// from light beige to deep brown
export const SKIN_TONES = [
  "#f5deb3",
  "#f1c27d",
  "#e0ac69",
  "#c68642",
  "#8d5524",
  "#5c3a21",
  "#3b2219",
];

export type Resident = {
  id: number; // unique within a game, never reused
  clothing: string; // "#rrggbb"
  skin: string; // "#rrggbb"
};

export type Roster = {
  residents: Resident[]; // oldest first
  nextId: number;
  seed: number;
};

// mulberry32; advances the seed of the owner and returns a number in [0, 1)
export function random(owner: { seed: number }): number {
  owner.seed = (owner.seed + 0x6d2b79f5) | 0;
  let t = owner.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createRoster(seed: number): Roster {
  return { residents: [], nextId: 1, seed };
}

// Adds residents with new IDs and colors, or removes the newest residents,
// until the roster has the population's size. Returns the residents.
export function syncRoster(roster: Roster, population: number): Resident[] {
  while (roster.residents.length < population) {
    roster.residents.push({
      id: roster.nextId++,
      clothing:
        CLOTHING_COLORS[Math.floor(random(roster) * CLOTHING_COLORS.length)],
      skin: SKIN_TONES[Math.floor(random(roster) * SKIN_TONES.length)],
    });
  }
  roster.residents.length = population;
  return [...roster.residents];
}

// ---- walkable tiles ----

export const SETTLEMENT_RADIUS = 3; // hex distance from (0, 0)
export const MIN_LOOP_TILES = 3;
export const MAX_LOOP_TILES = 6;

const ORIGIN: HexCoordinates = { q: 0, r: 0 };
const DIRECTIONS: readonly HexCoordinates[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexDistance(a: HexCoordinates, b: HexCoordinates): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

// A tile is walkable iff it is on the board and holds a building of the
// category FOREST. Camp, buildings, construction sites (and rivers) are not.
export function isWalkable(coords: HexCoordinates): boolean {
  return (
    isOnBoard(coords) &&
    BuildingTypes[getBuilding(coords)!.type].category === "FOREST"
  );
}

// walkable and inside the settlement area
function isUsable(coords: HexCoordinates): boolean {
  return hexDistance(coords, ORIGIN) <= SETTLEMENT_RADIUS && isWalkable(coords);
}

export function getUsableTiles(): HexCoordinates[] {
  const tiles: HexCoordinates[] = [];
  for (let q = -SETTLEMENT_RADIUS; q <= SETTLEMENT_RADIUS; q++) {
    for (let r = -SETTLEMENT_RADIUS; r <= SETTLEMENT_RADIUS; r++) {
      if (isUsable({ q, r })) {
        tiles.push({ q, r });
      }
    }
  }
  return tiles;
}

function shuffle<T>(items: T[], owner: { seed: number }): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(owner) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function isSame(a: HexCoordinates, b: HexCoordinates): boolean {
  return a.q === b.q && a.r === b.r;
}

// extends the path to a cycle of the given length
function closeLoop(
  path: HexCoordinates[],
  length: number,
  owner: { seed: number },
): HexCoordinates[] | undefined {
  const last = path[path.length - 1];
  if (path.length === length) {
    return hexDistance(last, path[0]) === 1 ? path : undefined;
  }
  for (const direction of shuffle([...DIRECTIONS], owner)) {
    const next = { q: last.q + direction.q, r: last.r + direction.r };
    if (isUsable(next) && !path.some((tile) => isSame(tile, next))) {
      const loop = closeLoop([...path, next], length, owner);
      if (loop) {
        return loop;
      }
    }
  }
  return undefined;
}

// A loop of 3 to 6 usable tiles, each adjacent to the previous one and the
// last adjacent to the start (which the walker reaches again).
export function findLoop(
  start: HexCoordinates,
  owner: { seed: number },
): HexCoordinates[] | undefined {
  const lengths: number[] = [];
  for (let n = MIN_LOOP_TILES; n <= MAX_LOOP_TILES; n++) {
    lengths.push(n);
  }
  for (const length of shuffle(lengths, owner)) {
    const loop = closeLoop([start], length, owner);
    if (loop) {
      return loop;
    }
  }
  return undefined;
}

// ---- walking ----

export const WALK_SPEED = 0.5; // scene units per second
export const TURN_SPEED = 6; // radians per second
export const BOB_FREQUENCY = 9; // radians per second of walking
export const BOB_HEIGHT = 0.012;
export const PAUSE_CHANCE = 0.3; // after reaching a tile of the loop
export const PAUSE_MIN = 1;
export const PAUSE_MAX = 3; // seconds

export type Walker = {
  id: number;
  seed: number; // own random numbers: movement does not depend on the frame rate
  loop: HexCoordinates[]; // empty: the walker stays where it is
  loopX: number[]; // scene coordinates of the loop's tiles
  loopZ: number[];
  rest: HexCoordinates; // tile of a walker without loop
  segment: number; // index of the tile the walker comes from
  progress: number; // distance walked on the segment
  pause: number; // remaining seconds of standing still
  x: number;
  z: number;
  heading: number; // radians around the y axis, 0 looks to +z
  phase: number; // bobbing, radians
  walking: boolean;
  bob: number; // current height above the ground
};

const SQRT3 = Math.sqrt(3);

// scene position of a tile center (same as hexToPixel with HEX_SIZE 1)
export function tileX(tile: HexCoordinates): number {
  return SQRT3 * tile.q + (SQRT3 / 2) * tile.r;
}

export function tileZ(tile: HexCoordinates): number {
  return 1.5 * tile.r;
}

function segmentLength(walker: Walker, from: number, to: number): number {
  return Math.hypot(
    walker.loopX[to] - walker.loopX[from],
    walker.loopZ[to] - walker.loopZ[from],
  );
}

function nextIndex(walker: Walker, index: number): number {
  return (index + 1) % walker.loop.length;
}

// the position on the loop from segment and progress
function updatePosition(walker: Walker) {
  const from = walker.segment;
  const to = nextIndex(walker, from);
  const fraction = walker.progress / segmentLength(walker, from, to);
  walker.x =
    walker.loopX[from] + (walker.loopX[to] - walker.loopX[from]) * fraction;
  walker.z =
    walker.loopZ[from] + (walker.loopZ[to] - walker.loopZ[from]) * fraction;
}

function setLoop(walker: Walker, loop: HexCoordinates[]) {
  walker.loop = loop;
  walker.loopX = loop.map(tileX);
  walker.loopZ = loop.map(tileZ);
  walker.rest = loop[0];
  walker.segment = 0;
  walker.progress = 0;
  walker.pause = 0;
  walker.x = walker.loopX[0];
  walker.z = walker.loopZ[0];
}

function stay(walker: Walker, tile: HexCoordinates) {
  walker.loop = [];
  walker.loopX = [];
  walker.loopZ = [];
  walker.rest = tile;
  walker.walking = false;
  walker.bob = 0;
}

// the tile the walker is standing on
export function getStandingTile(walker: Walker): HexCoordinates {
  if (walker.loop.length === 0) {
    return walker.rest;
  }
  const from = walker.segment;
  const half = segmentLength(walker, from, nextIndex(walker, from)) / 2;
  return walker.loop[walker.progress < half ? from : nextIndex(walker, from)];
}

// a settler on a random usable tile near the camp, on a random spot of its loop
export function createWalker(id: number, seed: number): Walker {
  const walker: Walker = {
    id,
    seed,
    loop: [],
    loopX: [],
    loopZ: [],
    rest: ORIGIN,
    segment: 0,
    progress: 0,
    pause: 0,
    x: tileX(ORIGIN),
    z: tileZ(ORIGIN),
    heading: 0,
    phase: 0,
    walking: false,
    bob: 0,
  };
  walker.phase = random(walker) * Math.PI * 2;
  const tiles = getUsableTiles();
  if (tiles.length === 0) {
    return walker;
  }
  const loop = findAnyLoop(walker, tiles);
  if (!loop) {
    stayAt(walker, tiles[0]);
    return walker;
  }
  setLoop(walker, loop);
  walker.segment = Math.floor(random(walker) * loop.length);
  walker.progress =
    random(walker) *
    segmentLength(walker, walker.segment, nextIndex(walker, walker.segment));
  updatePosition(walker);
  walker.heading = getHeading(walker);
  return walker;
}

// the loop of the first of the tiles (in random order) that has one
function findAnyLoop(
  walker: Walker,
  tiles: HexCoordinates[],
): HexCoordinates[] | undefined {
  for (const tile of shuffle([...tiles], walker)) {
    const loop = findLoop(tile, walker);
    if (loop) {
      return loop;
    }
  }
  return undefined;
}

function stayAt(walker: Walker, tile: HexCoordinates) {
  stay(walker, tile);
  walker.x = tileX(tile);
  walker.z = tileZ(tile);
}

function getHeading(walker: Walker): number {
  const from = walker.segment;
  const to = nextIndex(walker, from);
  return Math.atan2(
    walker.loopX[to] - walker.loopX[from],
    walker.loopZ[to] - walker.loopZ[from],
  );
}

function turn(walker: Walker, target: number, seconds: number) {
  let delta = target - walker.heading;
  delta -= Math.PI * 2 * Math.round(delta / (Math.PI * 2));
  const maxTurn = TURN_SPEED * seconds;
  walker.heading += Math.max(-maxTurn, Math.min(maxTurn, delta));
}

// Moves the walker along its loop by the elapsed seconds. Random numbers are
// only drawn when a tile is reached, so the result hardly depends on how the
// time is split into frames. Allocates nothing.
export function advanceWalker(walker: Walker, seconds: number) {
  if (walker.loop.length === 0) {
    return;
  }
  let remaining = seconds;
  walker.walking = false;
  while (remaining > 0) {
    const from = walker.segment;
    const to = nextIndex(walker, from);
    const target = getHeading(walker);
    if (walker.pause > 0) {
      const step = Math.min(walker.pause, remaining);
      walker.pause -= step;
      remaining -= step;
      turn(walker, target, step);
      continue;
    }
    walker.walking = true;
    const length = segmentLength(walker, from, to);
    const step = Math.min(remaining, (length - walker.progress) / WALK_SPEED);
    walker.progress += step * WALK_SPEED;
    walker.phase += step * BOB_FREQUENCY;
    remaining -= step;
    turn(walker, target, step);
    if (walker.progress >= length - 1e-9) {
      walker.segment = to;
      walker.progress = 0;
      if (random(walker) < PAUSE_CHANCE) {
        walker.pause = PAUSE_MIN + random(walker) * (PAUSE_MAX - PAUSE_MIN);
      }
    }
  }
  updatePosition(walker);
  walker.bob = walker.walking
    ? Math.abs(Math.sin(walker.phase)) * BOB_HEIGHT
    : 0;
}

function nearestTile(
  tiles: HexCoordinates[],
  from: HexCoordinates,
): HexCoordinates {
  return tiles.reduce((best, tile) =>
    hexDistance(tile, from) < hexDistance(best, from) ? tile : best,
  );
}

// whether the board changed so that the walker has to find another way
function isAffected(walker: Walker): boolean {
  return walker.loop.length === 0 || !walker.loop.every(isUsable);
}

// Picks another loop for walkers whose loop (or standing tile) is no longer
// usable. A walker on a tile that became unusable first moves to the nearest
// usable tile. Without any loop it rests; without any usable tile it stays.
export function updateWalkers(walkers: Walker[]) {
  const affected = walkers.filter(isAffected);
  if (affected.length === 0) {
    return;
  }
  const tiles = getUsableTiles();
  for (const walker of affected) {
    const standing = getStandingTile(walker);
    if (tiles.length === 0) {
      stay(walker, standing);
      continue;
    }
    const start = isUsable(standing) ? standing : nearestTile(tiles, standing);
    const loop = findLoop(start, walker) ?? findAnyLoop(walker, tiles);
    if (loop) {
      setLoop(walker, loop);
    } else {
      stayAt(walker, start);
    }
    walker.bob = 0;
    walker.walking = false;
  }
}
