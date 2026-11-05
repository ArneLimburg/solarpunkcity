import { beforeEach, expect, test, vi } from "vitest";
import type { PointerInfo, Scene } from "@babylonjs/core";

type FakeMesh = {
  name: string;
  enabled: boolean;
  isPickable: boolean;
  material?: unknown;
  position: { y: number; set: (x: number, y: number, z: number) => void };
  setEnabled: (enabled: boolean) => void;
  clone: (name: string) => FakeMesh;
};

const meshes: FakeMesh[] = [];

function fakeMesh(name: string): FakeMesh {
  const mesh: FakeMesh = {
    name,
    enabled: true,
    isPickable: true,
    position: {
      y: 0,
      set: (_x, y) => {
        mesh.position.y = y;
      },
    },
    setEnabled: (enabled) => {
      mesh.enabled = enabled;
    },
    clone: (cloneName) => fakeMesh(cloneName),
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
  Color3: { Black: () => ({}) },
  MeshBuilder: { CreateTorus: (name: string) => fakeMesh(name) },
  PointerEventTypes: {
    POINTERDOWN: 1,
    POINTERUP: 2,
    POINTERMOVE: 4,
    POINTERTAP: 16,
    POINTERDOUBLETAP: 32,
  },
}));
vi.mock("../src/TileRenderer", () => ({
  makeMaterial: (name: string) => ({ name, alpha: 1 }),
}));

import { PointerEventTypes } from "@babylonjs/core";
import { hexToPixel } from "../src/hexGeometry";
import {
  createLeaveHandler,
  createPointerHandler,
  createRing,
} from "../src/SelectionRing";

beforeEach(() => {
  meshes.length = 0;
});

test("the ring is a disabled unpickable torus with a transparent material", () => {
  createRing({} as Scene);
  expect(meshes).toHaveLength(1);
  expect(meshes[0].name).toBe("ring");
  expect(meshes[0].enabled).toBe(false);
  expect(meshes[0].isPickable).toBe(false);
  expect(meshes[0].material).toEqual({ name: "hexHighlight", alpha: 0.1 });
});

test("showing the ring enables one mesh per footprint tile on the board", () => {
  const ring = createRing({} as Scene);
  ring.show({ q: 0, r: 0 }, 1);
  expect(ring.tile).toEqual({ q: 0, r: 0 });
  expect(ring.tiles).toHaveLength(7);
  expect(meshes).toHaveLength(7);
  expect(meshes.every((mesh) => mesh.enabled)).toBe(true);

  ring.show({ q: 0, r: 0 }, 0);
  expect(ring.tiles).toEqual([{ q: 0, r: 0 }]);
  expect(meshes.filter((mesh) => mesh.enabled)).toHaveLength(1);

  ring.hide();
  expect(ring.tile).toBeNull();
  expect(ring.tiles).toEqual([]);
  expect(meshes.some((mesh) => mesh.enabled)).toBe(false);
});

test("leaving the canvas hides the ring except for touch pointers", () => {
  const ring = createRing({} as Scene);
  const onLeave = createLeaveHandler(ring);
  ring.show({ q: 0, r: 0 }, 0);
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
