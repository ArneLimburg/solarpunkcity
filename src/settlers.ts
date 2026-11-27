import {
  getBoardVersion,
  getBuilding,
  getBuiltTiles,
  getFootprint,
  getFootprintRadius,
  getPlacedBuilding,
  isOnBoard,
  type HexCoordinates,
} from "./board";
import { birthTime } from "./calendar";
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

export const FIRST_NAMES = [
  "Amara",
  "Bruno",
  "Clara",
  "Dario",
  "Elif",
  "Finn",
  "Greta",
  "Hugo",
  "Ines",
  "Jonas",
  "Kira",
  "Leon",
  "Mila",
  "Nico",
  "Olga",
  "Pavel",
];

export const LAST_NAMES = [
  "Alder",
  "Brook",
  "Cedar",
  "Dale",
  "Elm",
  "Fern",
  "Grove",
  "Heath",
  "Ivy",
  "Juniper",
  "Moss",
  "Reed",
];

export const MIN_AGE = 18;
export const MAX_AGE = 65;

export type Resident = {
  id: number; // unique within a game, never reused
  clothing: string; // "#rrggbb"
  skin: string; // "#rrggbb"
  name: string; // generated once
  age: number; // age in whole years when the resident arrived
  birthDate: number; // UTC time of the birth, generated once
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
// until the roster has the population's size. Newcomers join in the given
// week. Returns the residents.
export function syncRoster(
  roster: Roster,
  population: number,
  week = 0,
): Resident[] {
  while (roster.residents.length < population) {
    const id = roster.nextId++;
    const clothing =
      CLOTHING_COLORS[Math.floor(random(roster) * CLOTHING_COLORS.length)];
    const skin = SKIN_TONES[Math.floor(random(roster) * SKIN_TONES.length)];
    // name and age use their own numbers: the colors above do not depend on them
    const own = { seed: roster.seed ^ Math.imul(id, 0x9e3779b1) };
    const first = FIRST_NAMES[Math.floor(random(own) * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(random(own) * LAST_NAMES.length)];
    const age = MIN_AGE + Math.floor(random(own) * (MAX_AGE - MIN_AGE + 1));
    const dayOffset = Math.floor(random(own) * 365);
    roster.residents.push({
      id,
      clothing,
      skin,
      name: `${first} ${last}`,
      age,
      birthDate: birthTime(week, age, dayOffset),
    });
  }
  roster.residents.length = population;
  return [...roster.residents];
}

// ---- walkable tiles ----

export const SETTLEMENT_BELT = 3; // hex distance to the nearest built tile
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

// The settlement area: the walkable tiles within SETTLEMENT_BELT tiles of a
// built tile (camp, building or construction site). Computed again only when
// the board changed.
let areaVersion = -1;
let areaTiles: HexCoordinates[] = [];
let areaKeys = new Set<string>();

function updateArea() {
  const version = getBoardVersion();
  if (version === areaVersion) {
    return;
  }
  const near = new Map<string, HexCoordinates>();
  for (const built of getBuiltTiles()) {
    for (const tile of getFootprint(built, SETTLEMENT_BELT)) {
      near.set(`${tile.q},${tile.r}`, tile);
    }
  }
  areaTiles = [...near.values()].filter(isWalkable);
  areaKeys = new Set(areaTiles.map((tile) => `${tile.q},${tile.r}`));
  areaVersion = version;
}

// walkable and inside the settlement area
function isUsable(coords: HexCoordinates): boolean {
  updateArea();
  return areaKeys.has(`${coords.q},${coords.r}`);
}

export function getUsableTiles(): HexCoordinates[] {
  updateArea();
  return [...areaTiles];
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
  // A walker first walks in a straight line from where it is to the first tile
  // of its new loop (or rest tile): after the board changed under it.
  approaching: boolean;
  from: HexCoordinates; // tile the approach started on
  goal: HexCoordinates; // tile the approach leads to
  approachLength: number; // scene units of the approach when it started
  // The task: the workplace the settler walks to and works in (key of the
  // workplace, its tiles). A settler with a task has no loop.
  task: string | undefined;
  destination: HexCoordinates[];
  path: HexCoordinates[]; // planned route, from the tile it started on
  step: number; // index of the tile of the path the settler walks to
  needsRoute: boolean; // the route is searched in one of the next frames
  blocked: boolean; // no route: the settler waits until the map changes
  working: boolean; // arrived at the workplace
};

export type Activity =
  | "Walking"
  | "Working"
  | "Gardening"
  | "Observing a butterfly"
  | "Idle";

const FLAVORS: Activity[] = ["Gardening", "Observing a butterfly"];

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
  walker.approaching = false;
}

function stay(walker: Walker, tile: HexCoordinates) {
  walker.approaching = false;
  walker.loop = [];
  walker.loopX = [];
  walker.loopZ = [];
  walker.rest = tile;
  walker.walking = false;
  walker.bob = 0;
}

// the tile the walker is standing on
export function getStandingTile(walker: Walker): HexCoordinates {
  if (walker.path.length > 0) {
    const next = walker.path[walker.step];
    const close =
      Math.hypot(tileX(next) - walker.x, tileZ(next) - walker.z) < SQRT3 / 2;
    return walker.step === 0 || close ? next : walker.path[walker.step - 1];
  }
  if (walker.approaching) {
    const left = Math.hypot(
      tileX(walker.goal) - walker.x,
      tileZ(walker.goal) - walker.z,
    );
    return left * 2 < walker.approachLength ? walker.goal : walker.from;
  }
  if (walker.loop.length === 0) {
    return walker.rest;
  }
  const from = walker.segment;
  const half = segmentLength(walker, from, nextIndex(walker, from)) / 2;
  return walker.loop[walker.progress < half ? from : nextIndex(walker, from)];
}

// a settler on a random tile of the settlement area (uniformly), on a random
// spot of its loop
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
    approaching: false,
    from: ORIGIN,
    goal: ORIGIN,
    approachLength: 0,
    task: undefined,
    destination: [],
    path: [],
    step: 0,
    needsRoute: false,
    blocked: false,
    working: false,
  };
  walker.phase = random(walker) * Math.PI * 2;
  const tiles = getUsableTiles();
  if (tiles.length === 0) {
    return walker;
  }
  const loop = findAnyLoop(walker, tiles);
  if (!loop) {
    stayAt(walker, tiles[Math.floor(random(walker) * tiles.length)]);
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

// Walks straight towards the center of the goal tile (and stands exactly on it
// when it arrives); returns the seconds that are left after arriving.
function walkToward(
  walker: Walker,
  goal: HexCoordinates,
  seconds: number,
): number {
  const dx = tileX(goal) - walker.x;
  const dz = tileZ(goal) - walker.z;
  const distance = Math.hypot(dx, dz);
  const step = Math.min(seconds, distance / WALK_SPEED);
  const fraction = (step * WALK_SPEED) / distance;
  walker.walking ||= step > 0;
  walker.x += dx * fraction;
  walker.z += dz * fraction;
  walker.phase += step * BOB_FREQUENCY;
  turn(walker, Math.atan2(dx, dz), step);
  if (step * WALK_SPEED >= distance - 1e-9) {
    walker.x = tileX(goal);
    walker.z = tileZ(goal);
  }
  return seconds - step;
}

function isAt(walker: Walker, tile: HexCoordinates): boolean {
  return walker.x === tileX(tile) && walker.z === tileZ(tile);
}

function approach(walker: Walker, seconds: number): number {
  const left = walkToward(walker, walker.goal, seconds);
  walker.approaching = !isAt(walker, walker.goal);
  return left;
}

// Walks along the planned route; arriving at its end means working.
function advanceTask(walker: Walker, seconds: number) {
  let remaining = seconds;
  while (remaining > 0 && walker.step < walker.path.length) {
    const goal = walker.path[walker.step];
    remaining = walkToward(walker, goal, remaining);
    if (isAt(walker, goal)) {
      walker.step++;
    }
  }
  if (walker.path.length > 0 && walker.step >= walker.path.length) {
    walker.rest = walker.path[walker.path.length - 1];
    walker.path = [];
    walker.step = 0;
    walker.working = true;
  }
  walker.bob = walker.walking
    ? Math.abs(Math.sin(walker.phase)) * BOB_HEIGHT
    : 0;
}

// Moves the walker along its loop by the elapsed seconds. Random numbers are
// only drawn when a tile is reached, so the result hardly depends on how the
// time is split into frames. Allocates nothing.
export function advanceWalker(walker: Walker, seconds: number) {
  let remaining = seconds;
  walker.walking = false;
  if (walker.task !== undefined) {
    advanceTask(walker, remaining);
    return;
  }
  if (walker.approaching) {
    remaining = approach(walker, remaining);
  }
  if (walker.approaching || walker.loop.length === 0) {
    walker.bob = walker.walking
      ? Math.abs(Math.sin(walker.phase)) * BOB_HEIGHT
      : 0;
    return;
  }
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
  return (
    walker.task === undefined &&
    (walker.loop.length === 0 || !walker.loop.every(isUsable))
  );
}

// ---- tasks and routes ----

// what the settler does now; Gardening and Observing a butterfly are flavor
// activities during the pauses of a loop (they change nothing in the game)
export function getActivity(walker: Walker): Activity {
  if (walker.working) {
    return "Working";
  }
  if (walker.walking || (walker.task !== undefined && !walker.blocked)) {
    return "Walking";
  }
  return walker.pause > 0
    ? FLAVORS[(walker.id + walker.segment) % FLAVORS.length]
    : "Idle";
}

// The shortest route (as tiles, from `from` to the first tile of the
// destination) over walkable tiles. The destination and the building the
// settler starts in may be entered, but other buildings may not. Undefined if
// there is none.
export function findRoute(
  from: HexCoordinates,
  destination: HexCoordinates[],
): HexCoordinates[] | undefined {
  const key = (tile: HexCoordinates) => `${tile.q},${tile.r}`;
  const enterable = new Set(destination.map(key));
  const start = getPlacedBuilding(from)!;
  for (const tile of getFootprint(
    start.center,
    getFootprintRadius(start.building.size),
  )) {
    enterable.add(key(tile));
  }
  const parents = new Map<string, HexCoordinates | undefined>();
  parents.set(key(from), undefined);
  const queue = [from];
  const goals = new Set(destination.map(key));
  for (let head = 0; head < queue.length; head++) {
    const tile = queue[head];
    if (goals.has(key(tile))) {
      const route = [tile];
      for (let p = parents.get(key(tile)); p; p = parents.get(key(p))) {
        route.unshift(p);
      }
      return route;
    }
    for (const direction of DIRECTIONS) {
      const next = { q: tile.q + direction.q, r: tile.r + direction.r };
      if (
        !parents.has(key(next)) &&
        isOnBoard(next) &&
        (isWalkable(next) || enterable.has(key(next)))
      ) {
        parents.set(key(next), tile);
        queue.push(next);
      }
    }
  }
  return undefined;
}

// Gives the settler a workplace: it leaves its loop and waits for its route.
export function startTask(
  walker: Walker,
  task: string,
  destination: HexCoordinates[],
) {
  stay(walker, getStandingTile(walker));
  walker.path = [];
  walker.step = 0;
  walker.task = task;
  walker.destination = destination;
  walker.working = false;
  walker.blocked = false;
  walker.needsRoute = true;
}

// Takes the workplace away; the settler picks another way like after a change
// of the board (updateWalkers).
export function clearTask(walker: Walker) {
  stay(walker, getStandingTile(walker));
  walker.path = [];
  walker.step = 0;
  walker.task = undefined;
  walker.destination = [];
  walker.working = false;
  walker.blocked = false;
  walker.needsRoute = false;
}

// Searches the route from the tile the settler is standing on. Without one the
// settler waits.
export function planRoute(walker: Walker) {
  walker.needsRoute = false;
  const route = findRoute(getStandingTile(walker), walker.destination);
  walker.blocked = route === undefined;
  walker.path = route ?? [];
  walker.step = 0;
}

// whether the rest of the planned route got blocked by the board
export function isRouteBlocked(walker: Walker): boolean {
  return walker.path
    .slice(walker.step)
    .some(
      (tile) =>
        !isWalkable(tile) &&
        !walker.destination.some((goal) => isSame(goal, tile)) &&
        !(getPlacedBuilding(tile) === getPlacedBuilding(walker.path[0])),
    );
}

// Stops where it is and asks for a new route from there.
export function replanRoute(walker: Walker) {
  stay(walker, getStandingTile(walker));
  walker.path = [];
  walker.step = 0;
  walker.working = false;
  walker.needsRoute = true;
}

export type Route = {
  start: HexCoordinates; // tile of the settlement area to walk to
  loop?: HexCoordinates[]; // loop that starts there; none: rest on the tile
};

// Chooses where a walker goes next, independent of how it gets there (the
// animation in advanceWalker): the tile of the settlement area nearest to
// `from` (that tile itself if it belongs to the area) and a loop starting
// there. Without a loop nearby the walker rests on that tile; it never picks a
// loop elsewhere. Undefined if the settlement area is empty.
export function pickRoute(
  walker: { seed: number },
  from: HexCoordinates,
): Route | undefined {
  const tiles = getUsableTiles();
  if (tiles.length === 0) {
    return undefined;
  }
  const start = isUsable(from) ? from : nearestTile(tiles, from);
  return { start, loop: findLoop(start, walker) };
}

// Sends walkers whose loop (or standing tile) is no longer usable to a new
// route. They walk there from where they are, they never jump. Without any
// usable tile they stay.
export function updateWalkers(walkers: Walker[]) {
  for (const walker of walkers.filter(isAffected)) {
    const standing = getStandingTile(walker);
    const route = pickRoute(walker, standing);
    if (!route) {
      stay(walker, standing);
      continue;
    }
    if (route.loop) {
      setLoop(walker, route.loop);
    } else {
      stay(walker, route.start);
    }
    walker.from = standing;
    walker.goal = route.start;
    walker.approachLength = Math.hypot(
      tileX(route.start) - walker.x,
      tileZ(route.start) - walker.z,
    );
    walker.approaching = walker.approachLength > 1e-9;
    walker.bob = 0;
    walker.walking = false;
  }
}
