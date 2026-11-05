import { beforeEach, expect, test, vi } from "vitest";
import type { PointerInfo, Scene } from "@babylonjs/core";

type FakeMesh = {
  name: string;
  enabled: boolean;
  isPickable: boolean;
  material?: unknown;
  diameter: number;
  position: {
    x: number;
    y: number;
    set: (x: number, y: number, z: number) => void;
  };
  setEnabled: (enabled: boolean) => void;
};

const meshes: FakeMesh[] = [];

function fakeMesh(name: string, diameter: number): FakeMesh {
  const mesh: FakeMesh = {
    name,
    enabled: true,
    isPickable: true,
    diameter,
    position: {
      x: 0,
      y: 0,
      set: (x, y) => {
        mesh.position.x = x;
        mesh.position.y = y;
      },
    },
    setEnabled: (enabled) => {
      mesh.enabled = enabled;
    },
  };
  meshes.push(mesh);
  return mesh;
}

vi.mock("@babylonjs/core", () => ({
  Vector3: class {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  },
  Color3: class {
    static Black = () => ({ black: true });
    r: number;
    g: number;
    b: number;
    constructor(r: number, g: number, b: number) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  },
  MeshBuilder: {
    CreateTorus: (name: string, options: { diameter: number }) =>
      fakeMesh(name, options.diameter),
  },
  PointerEventTypes: {
    POINTERDOWN: 1,
    POINTERUP: 2,
    POINTERMOVE: 4,
    POINTERTAP: 16,
    POINTERDOUBLETAP: 32,
  },
}));
vi.mock("../src/TileRenderer", () => ({
  makeMaterial: (name: string, color: unknown) => ({
    name,
    color,
    alpha: 1,
  }),
}));

import { PointerEventTypes } from "@babylonjs/core";
import { HEX_SIZE, hexToPixel } from "../src/hexGeometry";
import { build, grantResources } from "../src/game";
import {
  createLeaveHandler,
  createPointerHandler,
  createPreview,
  createRing,
} from "../src/SelectionRing";

beforeEach(() => {
  meshes.length = 0;
});

test("the ring creates its tori lazily", () => {
  const ring = createRing({} as Scene);
  expect(meshes).toHaveLength(0);
  ring.show({ q: 0, r: 0 }, 0, false);
  expect(meshes).toHaveLength(1);
  expect(meshes[0].isPickable).toBe(false);
  expect(meshes[0].material).toMatchObject({
    name: "hexHighlight",
    alpha: 0.1,
  });
});

test("one ring is enabled and sized by the footprint radius", () => {
  const ring = createRing({} as Scene);
  ring.show({ q: 0, r: 0 }, 1, false);
  expect(ring.tile).toEqual({ q: 0, r: 0 });
  expect(ring.tiles).toHaveLength(7);
  expect(meshes).toHaveLength(1);
  expect(meshes[0].diameter).toBeCloseTo(2 * HEX_SIZE * (Math.sqrt(3) + 1));

  ring.show({ q: 0, r: 0 }, 0, false);
  expect(ring.tiles).toEqual([{ q: 0, r: 0 }]);
  expect(meshes).toHaveLength(2);
  expect(meshes[1].diameter).toBe(2);
  expect(meshes.filter((mesh) => mesh.enabled)).toEqual([meshes[1]]);

  ring.show({ q: 0, r: 0 }, 1, false); // cached
  expect(meshes).toHaveLength(2);
  expect(meshes.filter((mesh) => mesh.enabled)).toEqual([meshes[0]]);

  ring.hide();
  expect(ring.tile).toBeNull();
  expect(ring.tiles).toEqual([]);
  expect(meshes.some((mesh) => mesh.enabled)).toBe(false);
});

test("the ring is drawn completely at the board edge", () => {
  const ring = createRing({} as Scene);
  ring.show({ q: 30, r: 0 }, 1, true);
  expect(ring.tiles).toHaveLength(4);
  expect(meshes[0].enabled).toBe(true);
  expect(meshes[0].position.x).toBe(hexToPixel(30, 0).x);
});

test("a blocked ring uses the red material", () => {
  const ring = createRing({} as Scene);
  ring.show({ q: 0, r: 0 }, 0, true);
  expect(ring.blocked).toBe(true);
  expect(meshes[0].material).toMatchObject({
    name: "hexBlocked",
    color: { r: 0.9, g: 0.2, b: 0.2 },
    alpha: 0.5,
  });
  ring.show({ q: 0, r: 0 }, 0, false);
  expect(ring.blocked).toBe(false);
  expect(meshes[0].material).toMatchObject({ name: "hexHighlight" });
  ring.show({ q: 0, r: 0 }, 0, true);
  ring.hide();
  expect(ring.blocked).toBe(false);
});

test("the preview follows the selected building type", () => {
  const selection: { type?: "Farm" } = {};
  const preview = createPreview(() => selection.type);
  expect(preview.getRadius()).toBe(0);
  expect(preview.isBlocked({ q: 30, r: 0 })).toBe(false);
  selection.type = "Farm";
  expect(preview.getRadius()).toBe(1);
  expect(preview.isBlocked({ q: 0, r: 0 })).toBe(false);
  expect(preview.isBlocked({ q: 30, r: 0 })).toBe(true);
  grantResources({ wood: 100 });
  build("Farm", { q: 0, r: 0 });
  expect(preview.isBlocked({ q: 1, r: 0 })).toBe(true);
});

test("leaving the canvas hides the ring except for touch pointers", () => {
  const ring = createRing({} as Scene);
  const onLeave = createLeaveHandler(ring);
  ring.show({ q: 0, r: 0 }, 0, false);
  onLeave({ pointerType: "touch" } as PointerEvent);
  expect(ring.tile).toEqual({ q: 0, r: 0 });
  onLeave({ pointerType: "mouse" } as PointerEvent);
  expect(ring.tile).toBeNull();
});

function setup(radius = 0) {
  const ring = createRing({} as Scene);
  const target = hexToPixel(2, 1);
  const moved = { hit: true, pickedPoint: target };
  const scene = { pointerX: 1, pointerY: 2, pick: vi.fn(() => moved) };
  const onSelected = vi.fn();
  const handler = createPointerHandler(
    scene as unknown as Scene,
    ring,
    onSelected,
    () => radius,
    () => false,
  );
  const send = (
    type: number,
    event: Partial<PointerEvent>,
    pickInfo: unknown = moved,
  ) => handler({ type, event, pickInfo } as unknown as PointerInfo);
  return { ring, scene, onSelected, send };
}

test("a mouse move picks and shows the ring without selecting", () => {
  const { ring, scene, onSelected, send } = setup();
  send(PointerEventTypes.POINTERMOVE, { pointerType: "mouse" });
  expect(scene.pick).toHaveBeenCalledWith(1, 2);
  expect(ring.tile).toEqual({ q: 2, r: 1 });
  expect(onSelected).not.toHaveBeenCalled();
});

test("a mouse tap shows the ring and selects the tile", () => {
  const { ring, onSelected, send } = setup();
  send(PointerEventTypes.POINTERTAP, { pointerType: "mouse", button: 0 });
  expect(ring.tile).toEqual({ q: 2, r: 1 });
  expect(onSelected).toHaveBeenCalledWith({ q: 2, r: 1 });
});

test("a right click is ignored", () => {
  const { ring, onSelected, send } = setup();
  send(PointerEventTypes.POINTERTAP, { pointerType: "mouse", button: 2 });
  expect(ring.tile).toBeNull();
  expect(onSelected).not.toHaveBeenCalled();
});

test("other pointer events are ignored", () => {
  const { ring, onSelected, send } = setup();
  send(PointerEventTypes.POINTERDOWN, { pointerType: "mouse", button: 0 });
  expect(ring.tile).toBeNull();
  expect(onSelected).not.toHaveBeenCalled();
});

test("a touch move is ignored", () => {
  const { ring, scene, send } = setup();
  send(PointerEventTypes.POINTERMOVE, { pointerType: "touch" });
  expect(scene.pick).not.toHaveBeenCalled();
  expect(ring.tile).toBeNull();
});

test("the first touch tap only moves the ring, the second selects", () => {
  const { ring, onSelected, send } = setup();
  send(PointerEventTypes.POINTERTAP, { pointerType: "touch", button: 0 });
  expect(ring.tile).toEqual({ q: 2, r: 1 });
  expect(onSelected).not.toHaveBeenCalled();

  send(PointerEventTypes.POINTERTAP, { pointerType: "touch", button: 0 });
  expect(onSelected).toHaveBeenCalledWith({ q: 2, r: 1 });
});

test("a double tap counts as a tap", () => {
  const { onSelected, send } = setup();
  send(PointerEventTypes.POINTERTAP, { pointerType: "touch", button: 0 });
  send(PointerEventTypes.POINTERDOUBLETAP, { pointerType: "touch", button: 0 });
  expect(onSelected).toHaveBeenCalledTimes(1);
});

test("the ring uses the footprint radius of the selection", () => {
  const { ring, send } = setup(1);
  send(PointerEventTypes.POINTERMOVE, { pointerType: "mouse" });
  expect(ring.tiles).toHaveLength(7);
});

test("a pointer outside the board or without a hit hides the ring", () => {
  const { ring, onSelected, send } = setup();
  send(PointerEventTypes.POINTERMOVE, { pointerType: "mouse" });
  expect(ring.tile).not.toBeNull();

  const far = { hit: true, pickedPoint: hexToPixel(100, 0) };
  send(PointerEventTypes.POINTERTAP, { pointerType: "mouse", button: 0 }, far);
  expect(ring.tile).toBeNull();

  send(PointerEventTypes.POINTERMOVE, { pointerType: "mouse" });
  send(
    PointerEventTypes.POINTERTAP,
    { pointerType: "mouse", button: 0 },
    { hit: false, pickedPoint: null },
  );
  expect(ring.tile).toBeNull();

  send(PointerEventTypes.POINTERMOVE, { pointerType: "mouse" });
  send(
    PointerEventTypes.POINTERTAP,
    { pointerType: "mouse", button: 0 },
    { hit: true, pickedPoint: null },
  );
  expect(ring.tile).toBeNull();

  send(PointerEventTypes.POINTERMOVE, { pointerType: "mouse" });
  send(PointerEventTypes.POINTERTAP, { pointerType: "mouse", button: 0 }, null);
  expect(ring.tile).toBeNull();
  expect(onSelected).not.toHaveBeenCalled();
});
