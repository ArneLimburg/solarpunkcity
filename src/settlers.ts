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

export type Hobby = "Gardening" | "Nature watching";

export type Resident = {
  id: number; // unique within a game, never reused
  clothing: string; // "#rrggbb"
  skin: string; // "#rrggbb"
  hobby: Hobby; // drawn once when the resident joins
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
    const drawn: Hobby = random(roster) < 0.5 ? "Gardening" : "Nature watching";
    // the first resident always gardens, so every game has a gardener
    const hobby: Hobby = id === 1 ? "Gardening" : drawn;
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
      hobby,
      name: `${first} ${last}`,
      age,
      birthDate: birthTime(week, age, dayOffset),
    });
  }
  roster.residents.length = population;
  return [...roster.residents];
}

// Removes the residents with the given IDs; the others keep their IDs.
export function removeResidents(roster: Roster, ids: number[]) {
  const gone = new Set(ids);
  roster.residents = roster.residents.filter(({ id }) => !gone.has(id));
}

// ---- walkable tiles ----

export const SETTLEMENT_BELT = 3; // hex distance to the nearest built tile

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

function isSame(a: HexCoordinates, b: HexCoordinates): boolean {
  return a.q === b.q && a.r === b.r;
}

// ---- walking ----

export const WALK_SPEED = 0.5; // scene units per second
export const TURN_SPEED = 6; // radians per second
export const BOB_FREQUENCY = 9; // radians per second of walking
export const BOB_HEIGHT = 0.012;
export const PAUSE_MIN = 1;
export const PAUSE_MAX = 3; // seconds

export type Walker = {
  id: number;
  hobby: Hobby; // decides what the settler does during pauses
  seed: number; // own random numbers: movement does not depend on the frame rate
  rest: HexCoordinates; // tile of a walker without route
  pause: number; // remaining seconds of standing still
  x: number;
  z: number;
  heading: number; // radians around the y axis, 0 looks to +z
  phase: number; // bobbing, radians
  walking: boolean;
  bob: number; // current height above the ground
  // The task: the workplace the settler walks to and works in (key of the
  // workplace, its tiles). A settler without task and visit walks randomly
  // from one tile of the settlement area to the next (`destination` is then
  // the tile it walks to or rested on last).
  task: string | undefined;
  destination: HexCoordinates[];
  path: HexCoordinates[]; // planned route, from the tile it started on
  step: number; // index of the tile of the path the settler walks to
  needsRoute: boolean; // the route is searched in one of the next frames
  blocked: boolean; // no route: the settler waits until the map changes
  working: boolean; // arrived at the workplace
  // The visit: the community garden (key) the settler walks to (route, then
  // the spot) and tends a bed in; it shares the route machinery of the task.
  visit: VisitPlan | undefined;
  visitStage: "route" | "spot" | "tending";
  visitLeft: number; // seconds of tending that are left
  cooldown: number; // seconds until the next visit may start
};

export const VISIT_DURATION = 20; // seconds of real time at the bed
export const VISIT_COOLDOWN = 30; // seconds after a visit before the next one

export type VisitPlan = {
  garden: string;
  x: number; // scene coordinates of the spot
  z: number;
  heading: number; // facing the bed
};

export type Activity =
  | "Walking"
  | "Walking to the community garden"
  | "Tending the community garden"
  | "Working"
  | "Gardening"
  | "Observing a butterfly"
  | "Idle";

const SQRT3 = Math.sqrt(3);

// scene position of a tile center (same as hexToPixel with HEX_SIZE 1)
export function tileX(tile: HexCoordinates): number {
  return SQRT3 * tile.q + (SQRT3 / 2) * tile.r;
}

export function tileZ(tile: HexCoordinates): number {
  return 1.5 * tile.r;
}

function stay(walker: Walker, tile: HexCoordinates) {
  walker.rest = tile;
  walker.pause = 0;
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
  return walker.rest;
}

// a settler on a random tile of the settlement area (uniformly) that waits
// for the route of its first walk
export function createWalker(
  id: number,
  seed: number,
  hobby: Hobby = "Gardening",
): Walker {
  const walker: Walker = {
    id,
    hobby,
    seed,
    rest: ORIGIN,
    pause: 0,
    x: tileX(ORIGIN),
    z: tileZ(ORIGIN),
    heading: 0,
    phase: 0,
    walking: false,
    bob: 0,
    task: undefined,
    destination: [],
    path: [],
    step: 0,
    needsRoute: true,
    blocked: false,
    working: false,
    visit: undefined,
    visitStage: "route",
    visitLeft: 0,
    cooldown: 0,
  };
  walker.phase = random(walker) * Math.PI * 2;
  const tiles = getUsableTiles();
  if (tiles.length > 0) {
    const tile = tiles[Math.floor(random(walker) * tiles.length)];
    stay(walker, tile);
    walker.x = tileX(tile);
    walker.z = tileZ(tile);
  }
  return walker;
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
  return walkToPoint(walker, tileX(goal), tileZ(goal), seconds);
}

function walkToPoint(
  walker: Walker,
  goalX: number,
  goalZ: number,
  seconds: number,
): number {
  const dx = goalX - walker.x;
  const dz = goalZ - walker.z;
  const distance = Math.hypot(dx, dz);
  const step = Math.min(seconds, distance / WALK_SPEED);
  const fraction = (step * WALK_SPEED) / distance;
  walker.walking ||= step > 0;
  walker.x += dx * fraction;
  walker.z += dz * fraction;
  walker.phase += step * BOB_FREQUENCY;
  turn(walker, Math.atan2(dx, dz), step);
  if (step * WALK_SPEED >= distance - 1e-9) {
    walker.x = goalX;
    walker.z = goalZ;
  }
  return seconds - step;
}

function isAt(walker: Walker, tile: HexCoordinates): boolean {
  return walker.x === tileX(tile) && walker.z === tileZ(tile);
}

// Walks along the planned route; returns the seconds that are left and whether
// the settler arrived at its end (the route is then used up).
function followPath(walker: Walker, seconds: number): [number, boolean] {
  let remaining = seconds;
  while (remaining > 0 && walker.step < walker.path.length) {
    const goal = walker.path[walker.step];
    remaining = walkToward(walker, goal, remaining);
    if (isAt(walker, goal)) {
      walker.step++;
    }
  }
  const arrived = walker.path.length > 0 && walker.step >= walker.path.length;
  if (arrived) {
    walker.rest = walker.path[walker.path.length - 1];
    walker.path = [];
    walker.step = 0;
  }
  return [remaining, arrived];
}

function setBob(walker: Walker) {
  walker.bob = walker.walking
    ? Math.abs(Math.sin(walker.phase)) * BOB_HEIGHT
    : 0;
}

// Walks along the planned route; arriving at its end means working.
function advanceTask(walker: Walker, seconds: number) {
  walker.working ||= followPath(walker, seconds)[1];
  setBob(walker);
}

// Walks the route to the garden, then to the visitor spot, and tends the bed
// there until the visit time is over (the renderer ends the visit).
function advanceVisit(walker: Walker, visit: VisitPlan, seconds: number) {
  let remaining = seconds;
  if (walker.visitStage === "route") {
    const [left, arrived] = followPath(walker, remaining);
    remaining = left;
    if (arrived) {
      walker.visitStage = "spot";
    }
  }
  if (walker.visitStage === "spot") {
    remaining = walkToPoint(walker, visit.x, visit.z, remaining);
    if (walker.x === visit.x && walker.z === visit.z) {
      walker.visitStage = "tending";
      walker.visitLeft = VISIT_DURATION;
    }
  }
  if (walker.visitStage === "tending") {
    turn(walker, visit.heading, remaining);
    walker.visitLeft = Math.max(0, walker.visitLeft - remaining);
  }
  setBob(walker);
}

// Walks the planned route to the destination, pauses there and then asks for
// the next route (needsRoute; the renderer plans it through its queue). Without
// a route (waiting or blocked) the settler stands still.
function advanceWalk(walker: Walker, seconds: number) {
  let remaining = seconds;
  while (remaining > 0) {
    if (walker.path.length > 0) {
      const [left, arrived] = followPath(walker, remaining);
      remaining = left;
      if (!arrived) {
        break;
      }
      walker.pause = PAUSE_MIN + random(walker) * (PAUSE_MAX - PAUSE_MIN);
    } else if (walker.pause > 0) {
      const step = Math.min(walker.pause, remaining);
      walker.pause -= step;
      remaining -= step;
      walker.needsRoute = walker.pause <= 0;
    } else {
      break;
    }
  }
  setBob(walker);
}

// Moves the walker by the elapsed seconds. Random numbers are only drawn when
// a tile is reached, so the result hardly depends on how the time is split into
// frames. Allocates nothing.
export function advanceWalker(walker: Walker, seconds: number) {
  walker.walking = false;
  walker.cooldown = Math.max(0, walker.cooldown - seconds);
  if (walker.visit) {
    advanceVisit(walker, walker.visit, seconds);
  } else if (walker.task !== undefined) {
    advanceTask(walker, seconds);
  } else {
    advanceWalk(walker, seconds);
  }
}

// ---- tasks and routes ----

// what the settler does now; Gardening and Observing a butterfly are flavor
// activities during the pauses after a walk (they change nothing in the game)
export function getActivity(walker: Walker): Activity {
  if (walker.working) {
    return "Working";
  }
  if (walker.visit) {
    return walker.visitStage === "tending"
      ? "Tending the community garden"
      : "Walking to the community garden";
  }
  if (walker.walking || (walker.task !== undefined && !walker.blocked)) {
    return "Walking";
  }
  if (walker.pause > 0) {
    return walker.hobby === "Gardening" ? "Gardening" : "Observing a butterfly";
  }
  return "Idle";
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
  walker.visit = undefined; // work wins
  walker.destination = destination;
  walker.working = false;
  walker.blocked = false;
  walker.needsRoute = true;
}

// Sends the settler to a visitor spot of a garden: it leaves its loop and
// waits for its route to the garden tile.
export function startVisit(
  walker: Walker,
  plan: VisitPlan,
  destination: HexCoordinates[],
) {
  stay(walker, getStandingTile(walker));
  walker.path = [];
  walker.step = 0;
  walker.task = undefined;
  walker.visit = plan;
  walker.visitStage = "route";
  walker.destination = destination;
  walker.working = false;
  walker.blocked = false;
  walker.needsRoute = true;
}

// Ends the visit (or drops its plan); the settler continues with a random walk
// (it waits for its route). With `rest` the next visit has to wait for the
// cooldown.
export function endVisit(walker: Walker, rest: boolean) {
  stay(walker, getStandingTile(walker));
  walker.path = [];
  walker.step = 0;
  walker.visit = undefined;
  walker.destination = [];
  walker.blocked = false;
  walker.needsRoute = true;
  if (rest) {
    walker.cooldown = VISIT_COOLDOWN;
  }
}

// Takes the workplace away; the settler continues with a random walk (it
// waits for its route).
export function clearTask(walker: Walker) {
  stay(walker, getStandingTile(walker));
  walker.path = [];
  walker.step = 0;
  walker.task = undefined;
  walker.destination = [];
  walker.working = false;
  walker.blocked = false;
  walker.needsRoute = true;
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

// ---- random walks ----

// whether the settler has neither task nor visit and walks randomly
export function isRoaming(walker: Walker): boolean {
  return walker.task === undefined && walker.visit === undefined;
}

// Picks a random tile of the settlement area (not the one the settler stands
// on, not the last destination unless there is no other) and searches the
// route to it from the tile the settler is standing on; tiles without a route
// are skipped. Without any reachable tile the settler stands still (blocked)
// until the board changes.
export function planWalk(walker: Walker) {
  walker.needsRoute = false;
  walker.path = [];
  walker.step = 0;
  walker.blocked = true;
  const from = getStandingTile(walker);
  const last = walker.destination[0];
  const others = getUsableTiles().filter((tile) => !isSame(tile, from));
  const fresh = others.filter((tile) => !last || !isSame(tile, last));
  const candidates = fresh.length > 0 ? fresh : others;
  while (candidates.length > 0) {
    const index = Math.floor(random(walker) * candidates.length);
    const [target] = candidates.splice(index, 1);
    const route = findRoute(from, [target]);
    if (route) {
      walker.destination = [target];
      walker.path = route;
      walker.blocked = false;
      return;
    }
  }
}

// whether the board changed so that a random walk needs a new route: nothing
// was reachable, the destination left the settlement area or the rest of the
// route is not walkable any more
export function isWalkAffected(walker: Walker): boolean {
  return (
    walker.blocked ||
    (walker.path.length > 0 &&
      (!isUsable(walker.destination[0]) || isRouteBlocked(walker)))
  );
}
