import { expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";
import type { FarmRenderer } from "../src/FarmRenderer";
import { createWindTurbineRenderer } from "../src/WindTurbineRenderer";
import { getRotorAngle, getRotorMatrix } from "../src/windTurbine";

function setup() {
  const instances: {
    position: { set: ReturnType<typeof vi.fn> };
    isPickable: boolean;
    dispose: ReturnType<typeof vi.fn>;
  }[] = [];
  const tower = {
    name: "WindTurbine",
    createInstance: vi.fn(() => {
      const instance = {
        position: { set: vi.fn() },
        isPickable: true,
        dispose: vi.fn(),
      };
      instances.push(instance);
      return instance;
    }),
  };
  const rotor = {
    isVisible: true,
    isPickable: true,
    alwaysSelectAsActiveMesh: false,
    thinInstanceSetBuffer: vi.fn(),
    thinInstanceBufferUpdated: vi.fn(),
  };
  const rotorTemplate = { clone: vi.fn(() => rotor) };
  const farms = {
    getMeshes: vi.fn(() => [tower, rotorTemplate]),
    getTriangles: vi.fn(() => 200),
  } as unknown as FarmRenderer;
  const frames: (() => void)[] = [];
  const scene = {
    onBeforeRenderObservable: {
      add: (frame: () => void) => frames.push(frame),
    },
  } as unknown as Scene;
  let time = 0;
  const renderer = createWindTurbineRenderer(scene, farms, 1, () => time);
  return {
    renderer,
    tower,
    rotor,
    rotorTemplate,
    instances,
    frame: (seconds: number) => {
      time = seconds;
      frames.forEach((frame) => frame());
    },
  };
}

test("all towers share the template and all rotors one thin-instanced mesh", () => {
  const { renderer, tower, rotor, rotorTemplate, instances } = setup();
  expect(rotorTemplate.clone).toHaveBeenCalledTimes(1);
  expect(rotor.isPickable).toBe(false);
  expect(rotor.alwaysSelectAsActiveMesh).toBe(true);
  // nothing to show without turbines
  expect(rotor.isVisible).toBe(false);
  const first = renderer.create({ q: 0, r: 0 }, { x: 1, z: 2 });
  const second = renderer.create({ q: 1, r: 0 }, { x: 3, z: 4 });
  expect(rotorTemplate.clone).toHaveBeenCalledTimes(1);
  expect(tower.createInstance).toHaveBeenCalledTimes(2);
  expect(instances[0].position.set).toHaveBeenCalledWith(1, 0.1, 2);
  expect(instances[1].isPickable).toBe(false);
  expect(rotor.isVisible).toBe(true);
  expect(rotor.thinInstanceSetBuffer).toHaveBeenLastCalledWith(
    "matrix",
    expect.objectContaining({ length: 32 }),
    16,
    false,
  );
  expect(first.triangles).toBe(200);
  expect(second.triangles).toBe(200);

  first.dispose();
  expect(instances[0].dispose).toHaveBeenCalled();
  expect(instances[1].dispose).not.toHaveBeenCalled();
  expect(rotor.thinInstanceSetBuffer).toHaveBeenLastCalledWith(
    "matrix",
    expect.objectContaining({ length: 16 }),
    16,
    false,
  );
  second.dispose();
  expect(rotor.isVisible).toBe(false);
});

test("the rotors turn with the time and every frame updates the buffer", () => {
  const { renderer, rotor, frame } = setup();
  const a = { q: 0, r: 0 };
  const b = { q: 2, r: 1 };
  renderer.create(a, { x: 1, z: 2 });
  renderer.create(b, { x: 3, z: 4 });
  frame(0);
  const before = renderer.getRotorMatrix(a);
  expect(before).toEqual(
    Array.from(
      new Float32Array(getRotorMatrix({ x: 1, z: 2 }, getRotorAngle(a, 0), 1)),
    ),
  );
  const updates = rotor.thinInstanceBufferUpdated.mock.calls.length;
  frame(0.1);
  expect(rotor.thinInstanceBufferUpdated.mock.calls.length).toBe(updates + 1);
  expect(renderer.getRotorMatrix(a)).not.toEqual(before);
  expect(renderer.getRotorMatrix(b)).toHaveLength(16);
  expect(renderer.getRotorMatrix(a)).not.toEqual(renderer.getRotorMatrix(b));
});

test("without turbines a frame changes nothing and there is no rotor matrix", () => {
  const { renderer, rotor, frame } = setup();
  frame(1);
  expect(rotor.thinInstanceBufferUpdated).not.toHaveBeenCalled();
  expect(renderer.getRotorMatrix({ q: 0, r: 0 })).toBeUndefined();
});
