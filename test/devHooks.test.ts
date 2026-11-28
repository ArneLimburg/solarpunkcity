import { expect, test, vi } from "vitest";
import type { ArcRotateCamera, Engine, Scene } from "@babylonjs/core";

const project = vi.hoisted(() => vi.fn());

vi.mock("@babylonjs/core", () => {
  class Vector3 {
    static Project = project;
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }
  return { Vector3, Matrix: { IdentityReadOnly: {} } };
});

import { GRID_RADIUS, getRiverCourse } from "../src/board";
import { build } from "../src/game";
import { createDevHooks } from "../src/devHooks";

function setup() {
  const showBuilding = vi.fn();
  const showSettlers = vi.fn();
  const assignWork = vi.fn();
  const toGlobal = vi.fn(() => "viewport");
  const backdrop = {
    meshes: [
      { name: "sea", isPickable: false },
      { name: "beach", isPickable: false },
    ] as never[],
    setVisible: vi.fn(),
  };
  const frame = {
    drawCalls: 0,
    beforeRender: () => {},
    afterRender: () => {},
    beginFrame: () => {},
    endFrame: () => {},
  };
  const originalRegisterView = vi.fn();
  const engine = {
    getRenderWidth: () => 200,
    getRenderHeight: () => 100,
    registerView: originalRegisterView,
    views: [{}, {}] as unknown[] | undefined,
    onBeginFrameObservable: {
      add: (callback: () => void) => {
        frame.beginFrame = callback;
      },
    },
    onEndFrameObservable: {
      add: (callback: () => void) => {
        frame.endFrame = callback;
      },
    },
    _drawCalls: {
      get current() {
        return frame.drawCalls;
      },
    },
  };
  const cameras: {
    name: string;
    layerMask: number;
    getTarget: () => unknown;
  }[] = [];
  const hooks = createDevHooks({
    engine: engine as unknown as Engine,
    scene: {
      cameras,
      onBeforeRenderObservable: {
        observers: [1, 2],
        add: (callback: () => void) => {
          frame.beforeRender = callback;
        },
      },
      onAfterRenderObservable: {
        observers: [3],
        add: (callback: () => void) => {
          frame.afterRender = callback;
        },
      },
      getTransformMatrix: () => "matrix",
    } as unknown as Scene,
    settlers: {
      sync: vi.fn(),
      boardChanged: vi.fn(),
      getPose: vi.fn(),
      getSettlers: () =>
        [
          { id: 1, x: 0, z: 0 },
          { id: 2, x: 1, z: 1 },
        ] as never,
      pick: vi.fn(),
      select: vi.fn(),
      getMarker: () => ({ id: 2, visible: true }),
      getActivity: () => "Idle",
      assignWork,
      getRoute: () => ({ visible: false, tiles: [] }),
      getTriangleCount: () => 164,
      getMeshCount: () => 2,
    },
    showSettlers,
    backdrop,
    camera: {
      viewport: { toGlobal },
      alpha: 1,
      beta: 2,
      radius: 3,
      target: { x: 4, y: 5, z: 6 },
      layerMask: 0xffffffff,
    } as unknown as ArcRotateCamera,
    canvas: { clientWidth: 100, clientHeight: 50 } as HTMLCanvasElement,
    ring: {
      tile: { q: 1, r: 1 },
      tiles: [{ q: 1, r: 1 }],
      blocked: true,
      show: vi.fn(),
      hide: vi.fn(),
    },
    getTileMaterial: (coords) => (coords.q === 0 ? "meadow" : undefined),
    getTileInstanceStats: () => ({ instances: 7, finiteMatrices: 7 }),
    getMountainStats: () => ({
      meshes: 1,
      triangles: 5,
      pickable: false,
      inView: true,
    }),
    models: { "0,0": { triangles: 42 } },
    sites: { "1,0": { getFill: () => 0.5 } },
    getTreeCount: () => 3,
    getCornerMaterial: (_coords, corner) =>
      corner === 2 ? "meadow" : undefined,
    showBuilding,
    getProgressLabel: () => "40%",
    getRotorMatrix: (coords) => (coords.q === 4 ? [1] : undefined),
  });
  return {
    hooks,
    toGlobal,
    showBuilding,
    showSettlers,
    assignWork,
    frame,
    backdrop,
    engine,
    cameras,
    originalRegisterView,
  };
}

test("the frame stats count the passes and draw calls of the whole frame", () => {
  const { hooks, frame } = setup();
  frame.beginFrame();
  frame.afterRender();
  frame.afterRender();
  frame.drawCalls = 30;
  frame.endFrame();
  expect(hooks.getFrameStats()).toEqual({ passes: 2, drawCalls: 30 });
});

test("the preview stats report views, cameras, target, main camera and layers", () => {
  const { hooks, engine, cameras } = setup();
  expect(hooks.getPreviewStats()).toEqual({
    views: 2,
    cameras: 0,
    observers: 3,
    target: undefined,
    mainCamera: { alpha: 1, beta: 2, radius: 3, target: { x: 4, y: 5, z: 6 } },
    markerOnPreview: false,
    markerOnMain: true,
    routeOnPreview: false,
    routeOnMain: true,
  });
  engine.views = undefined;
  cameras.push(
    { name: "other", layerMask: 0, getTarget: () => undefined },
    {
      name: "settlerPreviewCamera",
      layerMask: 0x0fffffff,
      getTarget: () => ({ x: 1, y: 2, z: 3 }),
    },
  );
  expect(hooks.getPreviewStats()).toMatchObject({
    views: 0,
    cameras: 1,
    target: { x: 1, y: 2, z: 3 },
    markerOnPreview: false,
    routeOnPreview: true,
  });
});

test("failPreviews makes registering a view throw until it is switched off", () => {
  const { hooks, engine, originalRegisterView } = setup();
  hooks.failPreviews(true);
  expect(() => engine.registerView({} as never, {} as never)).toThrow(
    "preview failed on purpose",
  );
  hooks.failPreviews(false);
  expect(engine.registerView).toBe(originalRegisterView);
});

test("sendSettlers sends everybody to the building at the tile, or nowhere", () => {
  const { hooks, assignWork } = setup();
  hooks.sendSettlers({ q: 0, r: 0 });
  expect(assignWork).toHaveBeenLastCalledWith([
    { key: "0,0", tiles: [{ q: 0, r: 0 }], workers: Infinity },
  ]);
  hooks.sendSettlers(undefined);
  expect(assignWork).toHaveBeenLastCalledWith([]);
  expect(hooks.getSettlerRoute()).toEqual({ visible: false, tiles: [] });
});

test("the backdrop hooks report the meshes and switch them", () => {
  const { hooks, frame, backdrop } = setup();
  frame.drawCalls = 5;
  frame.beforeRender();
  frame.drawCalls = 9;
  frame.afterRender();
  expect(hooks.getBackdropStats()).toEqual({
    meshes: ["sea", "beach"],
    pickable: 0,
    drawCalls: 4,
  });
  hooks.setBackdropVisible(false);
  expect(backdrop.setVisible).toHaveBeenCalledWith(false);
});

test("the settler hooks report figures, triangles and the last frame's draw calls", () => {
  const { hooks, frame, showSettlers } = setup();
  frame.drawCalls = 100; // the counter keeps running across frames
  frame.beforeRender();
  frame.drawCalls = 111;
  frame.afterRender();
  frame.drawCalls = 0;
  expect(hooks.getSettlers()).toHaveLength(2);
  expect(hooks.getSettlerStats()).toEqual({
    count: 2,
    trianglesPerFigure: 164,
    meshes: 2,
    drawCalls: 11,
  });
  hooks.showSettlers(5);
  expect(showSettlers).toHaveBeenCalledWith(5);
});

test("finishConstruction shows the models of the finished sites", () => {
  const { hooks, showBuilding } = setup();
  build("OrganicHomestead", { q: 7, r: 7 });
  hooks.finishConstruction();
  expect(showBuilding).toHaveBeenCalledWith({ q: 7, r: 7 }, "OrganicHomestead");
});

test("addWoodStorage builds a finished wood storage and shows it", () => {
  const { hooks, showBuilding } = setup();
  hooks.addWoodStorage({ q: 8, r: 8 });
  expect(showBuilding).toHaveBeenCalledWith({ q: 8, r: 8 }, "WoodStorage");
  expect(hooks.getBuildingType({ q: 8, r: 8 })).toBe("WoodStorage");
  expect(hooks.isUnderConstruction({ q: 8, r: 8 })).toBe(false);
});

test("addHydroPowerPlant builds the plant on a river tile and shows it", () => {
  const { hooks, showBuilding } = setup();
  const tile = getRiverCourse(GRID_RADIUS)[3];
  hooks.addHydroPowerPlant(tile);
  expect(showBuilding).toHaveBeenCalledWith(tile, "HydroPowerPlant");
  expect(hooks.getBuildingType(tile)).toBe("HydroPowerPlant");
});

test("addSolarField builds the field and shows it", () => {
  const { hooks, showBuilding } = setup();
  const tile = { q: 3, r: 3 };
  hooks.addSolarField(tile);
  expect(showBuilding).toHaveBeenCalledWith(tile, "SolarField");
  expect(hooks.getBuildingType(tile)).toBe("SolarField");
});

test("addWindTurbine builds the turbine and shows it, the rotor matrix is passed on", () => {
  const { hooks, showBuilding } = setup();
  const tile = { q: 4, r: 4 };
  hooks.addWindTurbine(tile);
  expect(showBuilding).toHaveBeenCalledWith(tile, "WindTurbine");
  expect(hooks.getBuildingType(tile)).toBe("WindTurbine");
  expect(hooks.getRotorMatrix(tile)).toEqual([1]);
  expect(hooks.getRotorMatrix({ q: 0, r: 0 })).toBeUndefined();
});

test("addCommunityGarden places a finished garden and shows it", () => {
  const { hooks, showBuilding } = setup();
  hooks.addCommunityGarden({ q: 9, r: 9 });
  expect(showBuilding).toHaveBeenCalledWith({ q: 9, r: 9 }, "CommunityGarden");
  expect(hooks.getBuildingType({ q: 9, r: 9 })).toBe("CommunityGarden");
  expect(hooks.isUnderConstruction({ q: 9, r: 9 })).toBe(false);
});

test("tileToScreen scales projected positions to the canvas size", () => {
  const { hooks, toGlobal } = setup();
  project.mockReturnValue({ x: 100, y: 50, z: 0.5 });
  expect(hooks.tileToScreen({ q: 0, r: 0 })).toEqual({ x: 50, y: 25 });
  expect(project).toHaveBeenCalledWith(
    expect.objectContaining({ y: 0.1 }),
    {},
    "matrix",
    "viewport",
  );
  expect(toGlobal).toHaveBeenCalledWith(200, 100);
});

test("settlerToScreen projects the head or the body and the marker is reported", () => {
  const { hooks } = setup();
  project.mockReturnValue({ x: 100, y: 50, z: 0.5 });
  expect(hooks.settlerToScreen(2, "head")).toEqual({ x: 50, y: 25 });
  expect(project).toHaveBeenLastCalledWith(
    expect.objectContaining({ x: 1, y: 0.1 + 0.24, z: 1 }),
    {},
    "matrix",
    "viewport",
  );
  hooks.settlerToScreen(1, "body");
  expect(project).toHaveBeenLastCalledWith(
    expect.objectContaining({ x: 0, y: 0.1 + 0.1, z: 0 }),
    {},
    "matrix",
    "viewport",
  );
  expect(hooks.getSettlerMarker()).toEqual({ id: 2, visible: true });
});

test("tileToScreen returns null for tiles outside the view", () => {
  const { hooks } = setup();
  for (const point of [
    { x: 1, y: 1, z: -1 },
    { x: 1, y: 1, z: 2 },
    { x: -1, y: 1, z: 0.5 },
    { x: 201, y: 1, z: 0.5 },
    { x: 1, y: -1, z: 0.5 },
    { x: 1, y: 101, z: 0.5 },
  ]) {
    project.mockReturnValue(point);
    expect(hooks.tileToScreen({ q: 0, r: 0 })).toBeNull();
  }
});

test("the hooks expose ring, models, trees, material and buildings", () => {
  const { hooks } = setup();
  expect(hooks.getRingTile()).toEqual({ q: 1, r: 1 });
  const tiles = hooks.getRingTiles();
  expect(tiles).toEqual([{ q: 1, r: 1 }]);
  expect(tiles).not.toBe(hooks.getRingTiles());
  expect(hooks.isRingBlocked()).toBe(true);
  expect(hooks.getTileMaterial({ q: 0, r: 0 })).toBe("meadow");
  expect(hooks.getTileInstanceStats()).toEqual({
    instances: 7,
    finiteMatrices: 7,
  });
  expect(hooks.getMountainStats().triangles).toBe(5);
  expect(hooks.getModelCount({ q: 0, r: 0 })).toBe(1);
  expect(hooks.getModelCount({ q: 1, r: 0 })).toBe(0);
  expect(hooks.getModelTriangleCount({ q: 0, r: 0 })).toBe(42);
  expect(hooks.getModelTriangleCount({ q: 1, r: 0 })).toBe(0);
  expect(hooks.getSiteFill({ q: 1, r: 0 })).toBe(0.5);
  expect(hooks.getSiteFill({ q: 0, r: 0 })).toBeUndefined();
  expect(hooks.getTreeCount({ q: 0, r: 0 })).toBe(3);
  expect(hooks.getCornerMaterial({ q: 0, r: 0 }, 2)).toBe("meadow");
  expect(hooks.getCornerMaterial({ q: 0, r: 0 }, 0)).toBeUndefined();
  expect(hooks.getBuildingType({ q: 5, r: 5 })).toBe("Forest");
  expect(hooks.isUnderConstruction({ q: 5, r: 5 })).toBe(false);
  expect(typeof hooks.addResources).toBe("function");
  expect(build).toBeDefined();
});
