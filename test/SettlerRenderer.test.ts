import { beforeEach, expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

type FakeMesh = {
  name: string;
  material?: unknown;
  isPickable: boolean;
  alwaysSelectAsActiveMesh: boolean;
  thinInstanceCount: number;
  enabled: boolean;
  buffers: Record<string, Float32Array>;
  setEnabled: (enabled: boolean) => void;
  thinInstanceSetBuffer: ReturnType<typeof vi.fn>;
  thinInstanceBufferUpdated: ReturnType<typeof vi.fn>;
  getTotalIndices: () => number;
  thinInstanceEnablePicking: boolean;
  thinInstanceRefreshBoundingInfo: ReturnType<typeof vi.fn>;
  thinInstanceGetWorldMatrices: () => unknown[];
  position: { x: number; y: number; z: number; set: (...a: number[]) => void };
  isEnabled: () => boolean;
  dispose: ReturnType<typeof vi.fn>;
  layerMask?: number;
  color?: unknown;
  alpha?: number;
  points?: unknown[];
};

const meshes: FakeMesh[] = [];
const refresh = vi.hoisted(() => vi.fn());
// the world matrices Babylon picks with
const cache = [{ id: "first" }, { id: "second" }, { id: "third" }];

function fakeMesh(name: string, indices: number): FakeMesh {
  const mesh: FakeMesh = {
    name,
    isPickable: true,
    alwaysSelectAsActiveMesh: false,
    thinInstanceCount: 0,
    enabled: true,
    buffers: {},
    setEnabled: (enabled) => {
      mesh.enabled = enabled;
    },
    thinInstanceSetBuffer: vi.fn((kind: string, data: Float32Array) => {
      mesh.buffers[kind] = data;
    }),
    thinInstanceBufferUpdated: vi.fn(),
    getTotalIndices: () => indices,
    thinInstanceEnablePicking: false,
    thinInstanceRefreshBoundingInfo: vi.fn(),
    thinInstanceGetWorldMatrices: () => cache,
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: (x, y, z) => Object.assign(mesh.position, { x, y, z }),
    },
    isEnabled: () => mesh.enabled,
    dispose: vi.fn(),
  };
  meshes.push(mesh);
  return mesh;
}

vi.mock("@babylonjs/core", () => {
  class Vector3 {}
  class Color3 {
    static White = () => new Color3();
    static Black = () => new Color3();
  }
  class StandardMaterial {}
  const Matrix = { FromArrayToRef: refresh };
  return {
    Vector3,
    Color3,
    Matrix,
    StandardMaterial,
    MeshBuilder: {
      CreateSphere: (name: string) =>
        fakeMesh(name, name === "settlerBody" ? 300 : 192),
      CreateCylinder: (name: string) => fakeMesh(name, 60),
      CreateLines: (name: string, options: { points: unknown[] }) =>
        Object.assign(fakeMesh(name, 0), { points: options.points }),
    },
  };
});

import {
  DEFAULT_LAYER_MASK,
  MARKER_LAYER_MASK,
  ROUTES_PER_FRAME,
  createSettlerRenderer,
} from "../src/SettlerRenderer";
import {
  CLOTHING_COLORS,
  SKIN_TONES,
  createRoster,
  syncRoster,
} from "../src/settlers";

const frame = {
  seconds: 0.1,
  render: () => {},
  activeView: null as unknown,
};
const pick = vi.fn();

function createScene(): Scene {
  return {
    pick,
    onBeforeRenderObservable: {
      add: (callback: () => void) => {
        frame.render = callback;
      },
    },
    getEngine: () => ({
      getDeltaTime: () => frame.seconds * 1000,
      get activeView() {
        return frame.activeView;
      },
    }),
  } as unknown as Scene;
}

beforeEach(async () => {
  // an apartment from another test would let settlers start across the river,
  // where no route leads to the west
  const { setBuilding } = await import("../src/board");
  const { BuildingDefinition } = await import("../src/gameDefinitions");
  setBuilding({ q: 5, r: 5 }, BuildingDefinition.Forest);
  meshes.length = 0;
  frame.seconds = 0.1;
  frame.activeView = null;
  pick.mockReset();
  refresh.mockReset();
});

function colorOf(buffer: Float32Array, index: number) {
  const [r, g, b] = [0, 1, 2].map((i) =>
    Math.round(buffer[index * 4 + i] * 255)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${r}${g}${b}`;
}

test("two base meshes with thin instances draw all settlers", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  const [body, head] = meshes;
  expect(meshes).toHaveLength(3); // body, head and the selection marker
  expect(renderer.getMeshCount()).toBe(2);
  expect(renderer.getTriangleCount()).toBe((300 + 192) / 3);
  for (const mesh of meshes.slice(0, 2)) {
    expect(mesh.isPickable).toBe(false);
    expect(mesh.thinInstanceEnablePicking).toBe(true);
    expect(mesh.alwaysSelectAsActiveMesh).toBe(true);
  }
  for (const mesh of meshes) {
    expect(mesh.enabled).toBe(false); // nobody there yet
  }
  expect(meshes[2].isPickable).toBe(false);

  const residents = syncRoster(createRoster(3), 2);
  renderer.sync(residents);
  expect(renderer.getSettlers()).toHaveLength(2);
  for (const mesh of meshes.slice(0, 2)) {
    expect(mesh.enabled).toBe(true);
    expect(mesh.thinInstanceCount).toBe(2);
    expect(mesh.thinInstanceSetBuffer).toHaveBeenCalledTimes(2);
  }
  // clothing on the body, skin on the head, straight from the residents
  residents.forEach((resident, i) => {
    expect(colorOf(body.buffers.color, i)).toBe(resident.clothing);
    expect(colorOf(head.buffers.color, i)).toBe(resident.skin);
  });
  // translation of the first figure: on the ground, the head above the body
  const bodyMatrix = body.buffers.matrix;
  const headMatrix = head.buffers.matrix;
  expect(bodyMatrix[15]).toBe(1);
  expect(bodyMatrix[13]).toBeGreaterThan(0.1);
  expect(headMatrix[13]).toBeGreaterThan(bodyMatrix[13]);
  expect(headMatrix.every(Number.isFinite)).toBe(true);
});

test("the figures move every frame", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(syncRoster(createRoster(3), 2));
  const before = renderer.getSettlers();
  const updates = meshes[0].thinInstanceBufferUpdated.mock.calls.length;
  for (let i = 0; i < 20; i++) {
    frame.render();
  }
  const after = renderer.getSettlers();
  expect(after[0].x).not.toBe(before[0].x);
  expect(after.map((settler) => settler.id)).toEqual([1, 2]);
  expect(meshes[0].thinInstanceBufferUpdated.mock.calls.length).toBe(
    updates + 20,
  );
  expect(meshes[0].thinInstanceBufferUpdated).toHaveBeenCalledWith("matrix");
  // a long frame (hidden tab) is cut to a quarter of a second
  frame.seconds = 60;
  const x = after[0].x;
  const z = after[0].z;
  frame.render();
  const jumped = renderer.getSettlers()[0];
  expect(Math.hypot(jumped.x - x, jumped.z - z)).toBeLessThan(0.2);
});

test("a view's pass renders the figures without moving them again", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(syncRoster(createRoster(3), 2));
  const before = renderer.getSettlers();
  frame.activeView = {};
  for (let i = 0; i < 20; i++) {
    frame.render();
  }
  expect(renderer.getSettlers()).toEqual(before);
});

test("the pose of a resident is exposed, the marker has a layer of its own", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  expect(meshes[2].layerMask).toBe(MARKER_LAYER_MASK);
  expect(MARKER_LAYER_MASK & DEFAULT_LAYER_MASK).toBe(0);
  renderer.sync(syncRoster(createRoster(3), 2));
  for (let i = 0; i < 10; i++) {
    frame.render();
  }
  const [first] = renderer.getSettlers();
  const pose = renderer.getPose(first.id)!;
  expect(pose).toMatchObject({
    x: first.x,
    z: first.z,
    heading: first.heading,
    pausing: first.pausing,
  });
  expect(Number.isFinite(pose.bob)).toBe(true);
  expect(renderer.getPose(999)).toBeUndefined();
});

test("an unchanged roster changes nothing, a changed one keeps known figures", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  const roster = createRoster(3);
  renderer.sync(syncRoster(roster, 3));
  for (let i = 0; i < 10; i++) {
    frame.render();
  }
  const before = renderer.getSettlers();
  const setBuffer = meshes[0].thinInstanceSetBuffer.mock.calls.length;
  renderer.sync(syncRoster(roster, 3));
  expect(meshes[0].thinInstanceSetBuffer.mock.calls.length).toBe(setBuffer);

  // the newest leaves, the others keep their identity and place
  renderer.sync(syncRoster(roster, 2));
  expect(renderer.getSettlers()).toEqual(before.slice(0, 2));
  expect(meshes[0].thinInstanceCount).toBe(2);
  // newcomers
  renderer.sync(syncRoster(roster, 4));
  const regrown = renderer.getSettlers();
  expect(regrown.map((settler) => settler.id)).toEqual([1, 2, 4, 5]);
  expect(regrown.slice(0, 2)).toEqual(before.slice(0, 2));
});

test("colors stay the same through animation, shrinking, regrowth and rebuilds", () => {
  const roster = createRoster(11);
  const renderer = createSettlerRenderer(createScene(), 1);
  const expected = new Map<number, [string, string]>();
  const check = (r: typeof renderer, bodies: FakeMesh, heads: FakeMesh) =>
    r.getSettlers().forEach((settler, i) => {
      const colors = expected.get(settler.id)!;
      expect(colorOf(bodies.buffers.color, i)).toBe(colors[0]);
      expect(colorOf(heads.buffers.color, i)).toBe(colors[1]);
      expect(CLOTHING_COLORS).toContain(colors[0]);
      expect(SKIN_TONES).toContain(colors[1]);
    });
  const show = (count: number) => {
    const residents = syncRoster(roster, count);
    for (const { id, clothing, skin } of residents) {
      expected.set(id, expected.get(id) ?? [clothing, skin]);
    }
    renderer.sync(residents);
    return residents;
  };
  show(30); // more than the first buffer capacity: the buffers grow
  check(renderer, meshes[0], meshes[1]);
  frame.render();
  check(renderer, meshes[0], meshes[1]);
  show(5);
  frame.render();
  check(renderer, meshes[0], meshes[1]);
  const residents = show(40);
  expect(meshes[0].thinInstanceCount).toBe(40);
  check(renderer, meshes[0], meshes[1]);

  // a new renderer for the same residents draws the same colors
  const rebuilt = createSettlerRenderer(createScene(), 2);
  rebuilt.sync(residents);
  check(rebuilt, meshes[3], meshes[4]);
});

test("without residents nothing is drawn", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  const roster = createRoster(3);
  renderer.sync(syncRoster(roster, 3));
  renderer.sync(syncRoster(roster, 0));
  expect(renderer.getSettlers()).toEqual([]);
  expect(meshes.map((mesh) => mesh.enabled)).toEqual([false, false, false]);
  const updates = meshes[0].thinInstanceBufferUpdated.mock.calls.length;
  frame.render();
  renderer.boardChanged();
  expect(meshes[0].thinInstanceBufferUpdated).toHaveBeenCalledTimes(updates);
});

test("population, roster and figures agree through growth, shrinkage and regrowth", async () => {
  const board = await import("../src/board");
  const game = await import("../src/game");
  const { BuildingDefinition } = await import("../src/gameDefinitions");
  const { hexDistance, isWalkable, getUsableTiles } = await import(
    "../src/settlers"
  );
  board.setBuilding({ q: 5, r: 5 }, BuildingDefinition.AppartmentBuilding);
  // a supermarket keeps the food stock between the weeks
  board.setBuilding({ q: -5, r: 5 }, BuildingDefinition.Supermarket);
  const renderer = createSettlerRenderer(createScene(), 1);

  const everSeen = new Set<number>();
  const removed = new Set<number>();
  let previous = game.getState().residents;
  const week = () => {
    const state = game.calculateWeek();
    renderer.sync(state.residents);
    const ids = state.residents.map((resident) => resident.id);
    expect(state.residents).toHaveLength(state.population);
    expect(renderer.getSettlers().map((settler) => settler.id)).toEqual(ids);
    // survivors keep identity and colors, the newest leave first
    const common = Math.min(previous.length, state.residents.length);
    expect(state.residents.slice(0, common)).toEqual(previous.slice(0, common));
    for (const { id } of previous.slice(common)) {
      removed.add(id);
    }
    for (const id of ids) {
      expect(removed.has(id)).toBe(false); // IDs are never reused
      everSeen.add(id);
    }
    // newcomers stand on walkable tiles of the settlement area
    for (const { tile } of renderer.getSettlers()) {
      expect(isWalkable(tile)).toBe(true);
      expect(getUsableTiles().some((t) => hexDistance(t, tile) === 0)).toBe(
        true,
      );
    }
    previous = state.residents;
    return state.population;
  };

  expect(game.getState().population).toBe(2);
  renderer.sync(game.getState().residents);
  expect(renderer.getSettlers()).toHaveLength(2);

  game.grantResources({ food: 100 });
  const grown = [week(), week(), week(), week()];
  expect(grown).toEqual([3, 4, 5, 6]);

  game.grantResources({ food: -10000 }); // famine
  expect(week()).toBe(1);
  expect(renderer.getSettlers()).toHaveLength(1);
  expect(removed.size).toBe(5);

  game.grantResources({ food: 10000 });
  expect(week()).toBe(2);
  expect(week()).toBe(3);
  expect(renderer.getSettlers().map((settler) => settler.id)).toEqual([
    1, 7, 8,
  ]);
  expect(everSeen.size).toBe(8);
});

test("picking resolves the thin instance to the resident ID", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  const [body, head] = meshes;
  pick.mockReturnValue({ hit: true, thinInstanceIndex: 0 });
  expect(renderer.pick(5, 6)).toBeUndefined(); // nobody there
  expect(pick).not.toHaveBeenCalled();

  renderer.sync(syncRoster(createRoster(3), 2));
  pick.mockReturnValue({ hit: true, thinInstanceIndex: 1 });
  expect(renderer.pick(5, 6)).toBe(2);
  expect(pick).toHaveBeenCalledWith(5, 6, expect.any(Function));
  expect(body.thinInstanceRefreshBoundingInfo).toHaveBeenCalledWith(false);
  // the pick matrices follow the figures (2 settlers, 2 parts)
  expect(refresh).toHaveBeenCalledTimes(4);
  expect(refresh).toHaveBeenCalledWith(body.buffers.matrix, 16, cache[1]);
  const predicate = pick.mock.calls[0][2];
  expect(predicate(body)).toBe(true);
  expect(predicate(head)).toBe(true);
  expect(predicate(meshes[2])).toBe(false);

  pick.mockReturnValue({ hit: true, thinInstanceIndex: -1 });
  expect(renderer.pick(5, 6)).toBeUndefined();
  pick.mockReturnValue({ hit: false, thinInstanceIndex: -1 });
  expect(renderer.pick(5, 6)).toBeUndefined();
  pick.mockReturnValue(null);
  expect(renderer.pick(5, 6)).toBeUndefined();
});

test("the marker follows the selected settler and goes with the resident", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  const marker = meshes[2];
  const roster = createRoster(3);
  renderer.sync(syncRoster(roster, 3));
  expect(renderer.getMarker()).toEqual({ id: undefined, visible: false });

  renderer.select(2);
  expect(renderer.getMarker()).toEqual({ id: 2, visible: true });
  for (let i = 0; i < 5; i++) {
    frame.render();
    const settler = renderer.getSettlers()[1];
    expect(marker.position.x).toBe(settler.x);
    expect(marker.position.z).toBe(settler.z);
    expect(marker.position.y).toBeGreaterThan(0.3);
  }

  // other residents leaving and the figures reordering keep the link
  renderer.sync(syncRoster(roster, 2).slice(1));
  frame.render();
  expect(marker.position.x).toBe(renderer.getSettlers()[0].x);

  // the selected resident leaves
  renderer.sync(syncRoster(roster, 1));
  expect(renderer.getMarker()).toEqual({ id: 2, visible: false });
  renderer.select(undefined);
  expect(renderer.getMarker()).toEqual({ id: undefined, visible: false });
});

test("the activity of a settler without a task: Walking or a flavor activity, unknown for strangers", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(syncRoster(createRoster(3), 2));
  expect(renderer.getActivity(99)).toBeUndefined();
  const seen = new Set<string | undefined>();
  for (let i = 0; i < 1000; i++) {
    frame.render();
    seen.add(renderer.getActivity(1));
    seen.add(renderer.getActivity(2));
  }
  expect(seen.has("Walking")).toBe(true);
  expect(seen.has("Gardening") || seen.has("Observing a butterfly")).toBe(true);
  expect(seen.has("Working")).toBe(false);
});

const WORKPLACE = { q: -8, r: 2 }; // forest, far west of the camp (the river is east)
const slot = (workers: number, tile = WORKPLACE) => ({
  key: `${tile.q},${tile.r}`,
  tiles: [tile],
  workers,
});

function runFrames(count: number) {
  for (let i = 0; i < count; i++) {
    frame.render();
  }
}

test("settlers take the staffed places, walk there, work and go free again", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(syncRoster(createRoster(3), 3));
  renderer.select(1);
  renderer.assignWork([slot(2)]);
  expect(renderer.getActivity(1)).toBe("Walking"); // the route is still searched
  expect(renderer.getActivity(3)).not.toBe("Working");
  frame.render();
  expect(renderer.getRoute().visible).toBe(true);
  const route = renderer.getRoute().tiles;
  expect(route.length).toBeGreaterThan(1);
  expect(route.at(-1)).toEqual(WORKPLACE);
  const line = meshes.find((mesh) => mesh.name === "settlerRoute")!;
  expect(line.points).toHaveLength(route.length);
  expect(line.isPickable).toBe(false);

  // a new week with the same places changes nothing: the walk goes on
  renderer.assignWork([slot(2)]);
  expect(renderer.getActivity(1)).toBe("Walking");
  runFrames(3);
  expect(renderer.getRoute().tiles.at(-1)).toEqual(WORKPLACE);

  runFrames(1500);
  expect(renderer.getActivity(1)).toBe("Working");
  expect(renderer.getActivity(2)).toBe("Working");
  expect(renderer.getActivity(3)).not.toBe("Working");
  expect(renderer.getSettlers()[0].tile).toEqual(WORKPLACE);
  // arrived: the line is gone
  expect(renderer.getRoute()).toEqual({ visible: false, tiles: [] });
  expect(line.dispose).toHaveBeenCalled();

  // fewer places: the one that loses its place goes free
  renderer.assignWork([slot(1)]);
  expect(renderer.getActivity(1)).toBe("Working");
  expect(renderer.getActivity(2)).not.toBe("Working");
  renderer.assignWork([]);
  expect(renderer.getActivity(1)).not.toBe("Working");
  runFrames(5);
  expect(renderer.getSettlers()[0].walking).toBe(true);

  // deselecting and unknown selections have no line
  renderer.select(undefined);
  expect(renderer.getRoute()).toEqual({ visible: false, tiles: [] });
  renderer.select(99);
  expect(renderer.getRoute().visible).toBe(false);
});

test("movement leaves production, construction and the weekly results unchanged", async () => {
  const game = await import("../src/game");
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(game.getState().residents);
  const before = game.getState();
  const slots = game.getWorkSlots();
  renderer.assignWork([slot(2), ...slots]);
  runFrames(600);
  expect(game.getState()).toEqual(before);
  expect(game.getWorkSlots()).toEqual(slots);
});

test("route searches are spread across the frames", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(syncRoster(createRoster(3), 20));
  renderer.assignWork([slot(20)]);
  frame.render();
  const walking = () =>
    renderer.getSettlers().filter((settler) => settler.walking).length;
  expect(walking()).toBe(ROUTES_PER_FRAME);
  frame.render();
  expect(walking()).toBe(2 * ROUTES_PER_FRAME);
  runFrames(2);
  expect(walking()).toBe(20);
  // a task that is gone before its route was searched needs no search
  renderer.assignWork([]);
  renderer.assignWork([slot(20)]);
  renderer.assignWork([]);
  frame.render();
  expect(renderer.getActivity(1)).not.toBe("Working");
  // leaving residents leave the queue
  renderer.assignWork([]);
  renderer.assignWork([slot(20)]);
  renderer.sync(syncRoster(createRoster(3), 1));
  frame.render();
  expect(renderer.getSettlers()).toHaveLength(1);
});

test("a blocked route is searched again, none at all makes the settler wait", async () => {
  const board = await import("../src/board");
  const { BuildingDefinition } = await import("../src/gameDefinitions");
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(syncRoster(createRoster(3), 1));
  renderer.select(1);
  renderer.assignWork([slot(1)]);
  runFrames(2);
  const first = renderer.getRoute().tiles;
  const blocked = first[Math.floor(first.length / 2)];
  expect(blocked).not.toEqual(WORKPLACE);
  board.setBuilding(blocked, BuildingDefinition.WoodStorage);
  renderer.boardChanged();
  runFrames(1);
  const second = renderer.getRoute().tiles;
  expect(
    second.some((tile) => tile.q === blocked.q && tile.r === blocked.r),
  ).toBe(false);
  expect(second.at(-1)).toEqual(WORKPLACE);

  // the workplace is walled in: the settler waits where it is
  const around = [
    { q: -7, r: 2 },
    { q: -7, r: 1 },
    { q: -8, r: 1 },
    { q: -9, r: 2 },
    { q: -9, r: 3 },
    { q: -8, r: 3 },
  ];
  for (const tile of around) {
    board.setBuilding(tile, BuildingDefinition.WoodStorage);
  }
  renderer.boardChanged();
  runFrames(1);
  expect(renderer.getActivity(1)).toBe("Idle");
  expect(renderer.getSettlers()[0].walking).toBe(false);
  renderer.boardChanged(); // still nothing
  runFrames(1);
  expect(renderer.getActivity(1)).toBe("Idle");
  // a gap opens again
  board.setBuilding(around[3], BuildingDefinition.Forest);
  renderer.boardChanged();
  runFrames(1);
  expect(renderer.getActivity(1)).toBe("Walking");
  expect(renderer.getRoute().tiles.at(-1)).toEqual(WORKPLACE);

  for (const tile of [blocked, ...around]) {
    board.setBuilding(tile, BuildingDefinition.Forest);
  }
});

test("a changed board moves the affected figures to other ways", async () => {
  const board = await import("../src/board");
  const { BuildingDefinition } = await import("../src/gameDefinitions");
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(syncRoster(createRoster(3), 20));
  // everything around the camp becomes a storage
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 3) {
        board.setBuilding({ q, r }, BuildingDefinition.WoodStorage);
      }
    }
  }
  renderer.boardChanged();
  expect(renderer.getSettlers().every((settler) => !settler.walking)).toBe(
    true,
  );
  expect(meshes[0].thinInstanceBufferUpdated).toHaveBeenCalled();
});

const GARDEN = { q: -5, r: 2 }; // forest west of the camp, like the workplace
const DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];
const TO_GARDEN = "Walking to the community garden";
const TENDING = "Tending the community garden";

// n residents who all garden (the hobby is drawn per resident otherwise)
function gardeners(n: number) {
  return syncRoster(createRoster(3), n).map((resident) => ({
    ...resident,
    hobby: "Gardening" as const,
  }));
}

async function placeGarden(center = GARDEN, remainingWork = 0) {
  const board = await import("../src/board");
  const { BuildingDefinition } = await import("../src/gameDefinitions");
  board.placeBuilding(
    center,
    BuildingDefinition.CommunityGarden,
    remainingWork,
  );
}

async function restoreForest(tiles: { q: number; r: number }[]) {
  const board = await import("../src/board");
  const { BuildingDefinition } = await import("../src/gameDefinitions");
  for (const tile of tiles) {
    board.setBuilding(tile, BuildingDefinition.Forest);
  }
}

function runUntil(done: () => boolean, limit = 1000) {
  for (let i = 0; i < limit && !done(); i++) {
    frame.render();
  }
}

test("a gardener walks to the garden, tends a bed for 20 s and rests for 30 s", async () => {
  await placeGarden();
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(gardeners(1));
  renderer.select(1);
  renderer.assignWork([]);
  // the route goes through the shared queue: it is searched in the next frame
  expect(renderer.getActivity(1)).toBe(TO_GARDEN);
  expect(renderer.getRoute().tiles).toEqual([]);
  frame.render();
  expect(renderer.getRoute().tiles.at(-1)).toEqual(GARDEN);

  // the weekly tick keeps the walk going
  renderer.assignWork([]);
  runFrames(2);
  expect(renderer.getActivity(1)).toBe(TO_GARDEN);
  expect(renderer.getRoute().tiles.at(-1)).toEqual(GARDEN);

  runUntil(() => renderer.getActivity(1) === TENDING);
  expect(renderer.getActivity(1)).toBe(TENDING);
  runFrames(5);
  const [settler] = renderer.getSettlers();
  expect(settler.x).toBeCloseTo(
    Math.sqrt(3) * GARDEN.q + (Math.sqrt(3) / 2) * GARDEN.r - 0.2,
  );
  expect(settler.z).toBeCloseTo(1.5 * GARDEN.r);
  expect(Math.cos(settler.heading)).toBeCloseTo(-1); // faces the bed
  expect(settler.walking).toBe(false);

  // a new week does not restart the visit
  renderer.assignWork([]);
  runFrames(180);
  expect(renderer.getActivity(1)).toBe(TENDING);
  runFrames(30);
  expect(renderer.getActivity(1)).not.toBe(TENDING);
  expect(renderer.getActivity(1)).not.toBe(TO_GARDEN);

  // the cooldown: not before 30 s
  renderer.assignWork([]);
  expect(renderer.getActivity(1)).not.toBe(TO_GARDEN);
  runFrames(250);
  renderer.assignWork([]);
  expect(renderer.getActivity(1)).not.toBe(TO_GARDEN);
  runFrames(60);
  renderer.assignWork([]);
  expect(renderer.getActivity(1)).toBe(TO_GARDEN);
  await restoreForest([GARDEN]);
});

test("a garden takes two visitors, a task, leaving and demolition free spots", async () => {
  await placeGarden();
  const renderer = createSettlerRenderer(createScene(), 1);
  const residents = gardeners(3);
  renderer.sync(residents);
  renderer.assignWork([]);
  const visitors = () =>
    [1, 2, 3].filter((id) => renderer.getActivity(id) === TO_GARDEN);
  expect(visitors()).toEqual([1, 2]);
  runFrames(3);

  // work wins: the settler leaves, the third gardener takes the spot
  renderer.assignWork([slot(1)]);
  expect(renderer.getActivity(1)).toBe("Walking");
  expect(visitors()).toEqual([2, 3]);

  // a resident who leaves frees the spot at the next tick
  renderer.assignWork([]);
  renderer.sync(residents.filter(({ id }) => id !== 2));
  renderer.assignWork([]);
  expect(visitors()).toEqual([1, 3]);

  // demolition frees the spots at once
  await restoreForest([GARDEN]);
  renderer.boardChanged();
  expect(visitors()).toEqual([]);
  renderer.assignWork([]);
  expect(visitors()).toEqual([]);
});

test("construction sites are not visited", async () => {
  await placeGarden(GARDEN, 12);
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(gardeners(1));
  renderer.assignWork([]);
  expect(renderer.getActivity(1)).not.toBe(TO_GARDEN);
  await restoreForest([GARDEN]);
});

test("an unreachable garden frees the spot at once", async () => {
  const board = await import("../src/board");
  const { BuildingDefinition } = await import("../src/gameDefinitions");
  await placeGarden();
  const around = DIRECTIONS.map(({ q, r }) => ({
    q: GARDEN.q + q,
    r: GARDEN.r + r,
  }));
  for (const tile of around) {
    board.setBuilding(tile, BuildingDefinition.WoodStorage);
  }
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(gardeners(2));
  renderer.assignWork([]);
  expect(renderer.getActivity(1)).toBe(TO_GARDEN);
  frame.render();
  expect(renderer.getActivity(1)).not.toBe(TO_GARDEN);
  expect(renderer.getActivity(2)).not.toBe(TO_GARDEN);

  // the way opens again: the next tick sends them
  await restoreForest([around[0]]);
  renderer.boardChanged();
  renderer.assignWork([]);
  expect(renderer.getActivity(1)).toBe(TO_GARDEN);
  expect(renderer.getActivity(2)).toBe(TO_GARDEN);
  frame.render();
  expect(renderer.getActivity(1)).toBe(TO_GARDEN);

  // the way gets blocked again on the walk
  board.setBuilding(around[0], BuildingDefinition.WoodStorage);
  renderer.boardChanged();
  frame.render();
  expect(renderer.getActivity(1)).not.toBe(TO_GARDEN);
  await restoreForest([GARDEN, ...around]);
});

test("visits leave production, construction and the weekly results unchanged", async () => {
  const game = await import("../src/game");
  await placeGarden();
  const renderer = createSettlerRenderer(createScene(), 1);
  renderer.sync(gardeners(3));
  const before = game.calculateWeek();
  const slots = game.getWorkSlots();
  renderer.assignWork([]);
  runFrames(600);
  // the week's resources, workforce and satisfaction stay as they were
  expect(game.getState()).toEqual(before);
  expect(game.getWorkSlots()).toEqual(slots);
  await restoreForest([GARDEN]);
});
