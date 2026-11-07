import { afterEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  renderLoop: undefined as undefined | (() => void),
  engine: undefined as undefined | Record<string, ReturnType<typeof vi.fn>>,
  scene: undefined as undefined | Record<string, ReturnType<typeof vi.fn>>,
  meshes: [] as { name: string; material?: unknown; isPickable: boolean }[],
}));

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
  class Engine {
    resize = vi.fn();
    dispose = vi.fn();
    runRenderLoop = vi.fn((loop: () => void) => {
      state.renderLoop = loop;
    });
    constructor() {
      state.engine = this as never;
    }
  }
  class Scene {
    render = vi.fn();
    dispose = vi.fn();
    constructor() {
      state.scene = this as never;
    }
  }
  class ArcRotateCamera {
    attachControl = vi.fn();
    lowerRadiusLimit = 0;
    upperRadiusLimit = 0;
    lowerBetaLimit = 0;
    upperBetaLimit = 0;
  }
  const mesh = (name: string) => {
    const result = { name, material: undefined, isPickable: true };
    state.meshes.push(result);
    return result;
  };
  return {
    Vector3,
    Engine,
    Scene,
    ArcRotateCamera,
    HemisphericLight: class {},
    Color3: class {},
    StandardMaterial: class {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
    },
    Texture: { SKYBOX_MODE: 5 },
    CubeTexture: { CreateFromImages: (files: string[]) => ({ files }) },
    MeshBuilder: {
      CreateBox: (name: string) => mesh(name),
      CreateGround: (name: string) => mesh(name),
    },
  };
});
vi.mock("../src/TileRenderer", () => ({
  makeMaterial: (name: string) => ({ name }),
}));

import { setupScene } from "../src/sceneSetup";

afterEach(() => {
  vi.restoreAllMocks();
  state.meshes.length = 0;
});

test("the scene has a skybox, a camera, a background ground and a render loop", () => {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  const canvas = {} as HTMLCanvasElement;
  const { camera, engine, scene } = setupScene(canvas);
  expect(camera.attachControl).toHaveBeenCalledWith(canvas, true);
  expect(camera.upperRadiusLimit).toBe(120);
  expect(state.meshes.map((mesh) => mesh.name)).toEqual(["skyBox", "ground"]);
  expect(state.meshes[1].material).toEqual({ name: "hexAlt" });
  // only the pick plane of the tile renderer is pickable
  expect(state.meshes.map((mesh) => mesh.isPickable)).toEqual([false, false]);

  state.renderLoop!();
  expect((scene as never as { render: unknown }).render).toHaveBeenCalled();
  expect(engine).toBe(state.engine);
  vi.unstubAllGlobals();
});

test("resizing resizes the engine until the scene is disposed", () => {
  const listeners: Record<string, () => void> = {};
  vi.stubGlobal("window", {
    addEventListener: (name: string, listener: () => void) => {
      listeners[name] = listener;
    },
    removeEventListener: vi.fn(),
  });
  const { dispose } = setupScene({} as HTMLCanvasElement);
  listeners.resize();
  expect(state.engine!.resize).toHaveBeenCalled();

  dispose();
  expect(window.removeEventListener).toHaveBeenCalledWith(
    "resize",
    listeners.resize,
  );
  expect(state.scene!.dispose).toHaveBeenCalled();
  expect(state.engine!.dispose).toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test("errors while disposing are logged and swallowed", () => {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { dispose } = setupScene({} as HTMLCanvasElement);
  const failure = new Error("boom");
  state.scene!.dispose.mockImplementation(() => {
    throw failure;
  });
  expect(() => dispose()).not.toThrow();
  expect(error).toHaveBeenCalledWith(failure);
  expect(state.engine!.dispose).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
