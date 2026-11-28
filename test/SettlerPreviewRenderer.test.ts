import { beforeEach, expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

type FakeCamera = {
  name: string;
  minZ: number;
  maxZ: number;
  layerMask: number;
  position: { x: number; y: number; z: number; set: (...a: number[]) => void };
  target?: { x: number; y: number; z: number };
  setTarget: (target: { x: number; y: number; z: number }) => void;
  dispose: ReturnType<typeof vi.fn>;
};

const cameras: FakeCamera[] = [];

vi.mock("@babylonjs/core", () => {
  class Vector3 {
    static Zero = () => new Vector3();
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }
  class FreeCamera {
    minZ = 0;
    maxZ = 0;
    layerMask = 0;
    position = {
      x: 0,
      y: 0,
      z: 0,
      set: (x: number, y: number, z: number) =>
        Object.assign(this.position, { x, y, z }),
    };
    target?: { x: number; y: number; z: number };
    dispose = vi.fn();
    name: string;
    constructor(name: string) {
      this.name = name;
      cameras.push(this as unknown as FakeCamera);
    }
    setTarget(target: { x: number; y: number; z: number }) {
      this.target = target;
    }
  }
  return { Vector3, FreeCamera };
});

import { attachSettlerPreview } from "../src/SettlerPreviewRenderer";
import {
  PREVIEW_DISTANCE,
  PREVIEW_MAX_Z,
  PREVIEW_MIN_Z,
} from "../src/settlerPreview";
import { DEFAULT_LAYER_MASK } from "../src/SettlerRenderer";

type View = {
  target: unknown;
  enabled: boolean;
  customResize?: (canvas: HTMLCanvasElement) => void;
};

function createEngine() {
  const rendered: boolean[] = [];
  const engine = {
    views: [] as View[],
    seconds: 0.016,
    getDeltaTime() {
      return this.seconds * 1000;
    },
    registerView: vi.fn((canvas: unknown) => {
      const view: View = { target: canvas, enabled: true };
      engine.views.push(view);
      return view;
    }),
    unRegisterView: vi.fn((canvas: unknown) => {
      engine.views = engine.views.filter((view) => view.target !== canvas);
    }),
    setSize: vi.fn(),
    resize: vi.fn(),
    // the engine's own step: renders every enabled view
    _renderViews: vi.fn(function () {
      for (const view of engine.views) {
        if (view.enabled) {
          rendered.push(true);
        }
      }
      return engine.views.length > 0;
    }),
  };
  return { engine, rendered };
}

const pose = {
  x: 1,
  z: 2,
  bob: 0.01,
  heading: 0,
  pausing: false,
};

function setup() {
  const { engine, rendered } = createEngine();
  const scene = { getEngine: () => engine } as unknown as Scene;
  const settlers = {
    getPose: vi.fn((id: number) => (id === 7 ? pose : undefined)),
  };
  const canvas = { clientWidth: 640, clientHeight: 480 } as HTMLCanvasElement;
  return { engine, rendered, scene, settlers, canvas };
}

beforeEach(() => {
  cameras.length = 0;
  pose.x = 1;
  pose.heading = 0;
  pose.pausing = false;
});

test("the preview registers one view with a camera that follows from behind", () => {
  const { engine, scene, settlers, canvas } = setup();
  attachSettlerPreview(scene, settlers, canvas, 7);
  expect(engine.views).toHaveLength(1);
  expect(cameras).toHaveLength(1);
  const [camera] = cameras;
  expect(camera.minZ).toBeCloseTo(PREVIEW_MIN_Z);
  expect(camera.maxZ).toBe(PREVIEW_MAX_Z);
  expect(camera.layerMask).toBe(DEFAULT_LAYER_MASK);

  engine._renderViews();
  expect(camera.target).toMatchObject({ x: 1, z: 2 });
  expect(camera.target!.y).toBeCloseTo(0.1 + 0.12 + 0.01, 1);
  // behind a settler looking to +z: at smaller z, above, at the distance
  const dx = camera.position.x - camera.target!.x;
  const dy = camera.position.y - camera.target!.y;
  const dz = camera.position.z - camera.target!.z;
  expect(Math.hypot(dx, dy, dz)).toBeCloseTo(PREVIEW_DISTANCE);
  expect(dz).toBeLessThan(0);
  expect(dy).toBeCloseTo(-dz);
});

test("the camera follows the position at once and the heading smoothed", () => {
  const { engine, scene, settlers, canvas } = setup();
  attachSettlerPreview(scene, settlers, canvas, 7);
  const [camera] = cameras;
  engine._renderViews();
  engine._renderViews(); // skipped frame
  pose.x = 5;
  pose.heading = Math.PI / 2;
  engine.seconds = 0.5;
  engine._renderViews();
  expect(camera.target!.x).toBe(5);
  // the yaw has only partly turned: not yet directly behind (-x)
  expect(camera.position.x).toBeLessThan(5);
  expect(camera.position.z).toBeLessThan(2);
  // a pause keeps the yaw
  const held = { ...camera.position };
  engine._renderViews();
  pose.heading = -2;
  pose.pausing = true;
  engine._renderViews();
  expect(camera.position.x).toBeCloseTo(held.x);
  expect(camera.position.z).toBeCloseTo(held.z);
  pose.x = 1;
});

test("only every second frame renders the preview, the map always follows", () => {
  const { engine, rendered, scene, settlers, canvas } = setup();
  attachSettlerPreview(scene, settlers, canvas, 7);
  const results: boolean[] = [];
  for (let i = 0; i < 6; i++) {
    results.push(engine._renderViews());
  }
  expect(results).toEqual([false, false, false, false, false, false]);
  expect(rendered).toHaveLength(3);
  expect(engine.views[0].enabled).toBe(false); // the 6th frame is skipped
  // the map gets its size back after a rendered preview frame only
  expect(engine.resize).toHaveBeenCalledTimes(3);
});

test("a resident who is gone leaves the camera where it is", () => {
  const { engine, scene, settlers, canvas } = setup();
  attachSettlerPreview(scene, settlers, canvas, 99);
  engine._renderViews();
  expect(cameras[0].target).toBeUndefined();
});

test("the preview renders at most 320 × 240 pixels in the aspect of the canvas", () => {
  const { engine, scene, settlers, canvas } = setup();
  attachSettlerPreview(scene, settlers, canvas, 7);
  const target = { clientWidth: 240, clientHeight: 180 } as HTMLCanvasElement;
  engine.views[0].customResize!(target);
  expect(target.width).toBe(240);
  expect(target.height).toBe(180);
  expect(engine.setSize).toHaveBeenLastCalledWith(240, 180);
  const big = { clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement;
  engine.views[0].customResize!(big);
  expect([big.width, big.height]).toEqual([320, 240]);
});

test("removing the preview unregisters the view, disposes the camera and restores the engine", () => {
  const { engine, scene, settlers, canvas } = setup();
  const original = engine._renderViews;
  const remove = attachSettlerPreview(scene, settlers, canvas, 7);
  expect(engine._renderViews).not.toBe(original);
  remove();
  expect(engine.views).toHaveLength(0);
  expect(cameras[0].dispose).toHaveBeenCalled();
  expect(engine.unRegisterView).toHaveBeenCalledWith(canvas);
  expect(engine._renderViews).toBe(original);
});

test("switching removes the old preview before the new one: one view, one camera left", () => {
  const { engine, scene, settlers, canvas } = setup();
  for (let i = 0; i < 5; i++) {
    attachSettlerPreview(scene, settlers, canvas, 7)();
  }
  const last = attachSettlerPreview(scene, settlers, canvas, 7);
  expect(engine.views).toHaveLength(1);
  expect(
    cameras.filter((camera) => camera.dispose.mock.calls.length === 0),
  ).toHaveLength(1);
  last();
  expect(engine.views).toHaveLength(0);
});

test("a failing registration cleans up and throws", () => {
  const { engine, scene, settlers, canvas } = setup();
  engine.registerView.mockImplementation(() => {
    throw new Error("no views");
  });
  expect(() => attachSettlerPreview(scene, settlers, canvas, 7)).toThrow(
    "no views",
  );
  expect(cameras[0].dispose).toHaveBeenCalled();
  expect(engine.views).toHaveLength(0);
});
