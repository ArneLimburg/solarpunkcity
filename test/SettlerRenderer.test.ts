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
};

const meshes: FakeMesh[] = [];

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
  return {
    Vector3,
    Color3,
    StandardMaterial,
    MeshBuilder: {
      CreateSphere: (name: string) =>
        fakeMesh(name, name === "settlerBody" ? 300 : 192),
    },
  };
});

import { createSettlerRenderer } from "../src/SettlerRenderer";
import {
  CLOTHING_COLORS,
  SKIN_TONES,
  createRoster,
  syncRoster,
} from "../src/settlers";

const frame = { seconds: 0.1, render: () => {} };

function createScene(): Scene {
  return {
    onBeforeRenderObservable: {
      add: (callback: () => void) => {
        frame.render = callback;
      },
    },
    getEngine: () => ({ getDeltaTime: () => frame.seconds * 1000 }),
  } as unknown as Scene;
}

beforeEach(() => {
  meshes.length = 0;
  frame.seconds = 0.1;
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
  expect(meshes).toHaveLength(2);
  expect(renderer.getMeshCount()).toBe(2);
  expect(renderer.getTriangleCount()).toBe((300 + 192) / 3);
  for (const mesh of meshes) {
    expect(mesh.isPickable).toBe(false);
    expect(mesh.alwaysSelectAsActiveMesh).toBe(true);
    expect(mesh.enabled).toBe(false); // nobody there yet
  }

  const residents = syncRoster(createRoster(3), 2);
  renderer.sync(residents);
  expect(renderer.getSettlers()).toHaveLength(2);
  for (const mesh of meshes) {
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
  check(rebuilt, meshes[2], meshes[3]);
});

test("without residents nothing is drawn", () => {
  const renderer = createSettlerRenderer(createScene(), 1);
  const roster = createRoster(3);
  renderer.sync(syncRoster(roster, 3));
  renderer.sync(syncRoster(roster, 0));
  expect(renderer.getSettlers()).toEqual([]);
  expect(meshes.map((mesh) => mesh.enabled)).toEqual([false, false]);
  const updates = meshes[0].thinInstanceBufferUpdated.mock.calls.length;
  frame.render();
  renderer.boardChanged();
  expect(meshes[0].thinInstanceBufferUpdated).toHaveBeenCalledTimes(updates);
});

test("population, roster and figures agree through growth, shrinkage and regrowth", async () => {
  const board = await import("../src/board");
  const game = await import("../src/game");
  const { BuildingDefinition } = await import("../src/gameDefinitions");
  const { hexDistance, isWalkable } = await import("../src/settlers");
  board.setBuilding({ q: 5, r: 5 }, BuildingDefinition.AppartmentBuilding);
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
    // newcomers stand on walkable tiles near the camp
    for (const { tile } of renderer.getSettlers()) {
      expect(isWalkable(tile)).toBe(true);
      expect(hexDistance(tile, { q: 0, r: 0 })).toBeLessThanOrEqual(3);
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
