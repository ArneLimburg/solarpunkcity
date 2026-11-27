import { afterEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  renderLoop: undefined as undefined | (() => void),
  beforeRender: undefined as undefined | (() => void),
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
    onBeforeRenderObservable = {
      add: vi.fn((callback: () => void) => {
        state.beforeRender = callback;
      }),
    };
    constructor() {
      state.scene = this as never;
    }
  }
  class ArcRotateCamera {
    attachControl = vi.fn();
    target = new Vector3();
    radius = 30;
    setTarget = vi.fn((target: Vector3) => {
      this.target = target;
    });
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
  makeMaterial: (name: string, color: unknown) => ({ name, color }),
  FOREST_FLOOR_COLOR: { forest: true },
}));

import { setupScene } from "../src/sceneSetup";

afterEach(() => {
  vi.restoreAllMocks();
  state.meshes.length = 0;
});

const observer = {
  callback: undefined as undefined | (() => void),
  observe: vi.fn(),
  disconnect: vi.fn(),
};

function stubResizeObserver() {
  observer.observe = vi.fn();
  observer.disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observer.callback = callback;
      }
      observe = observer.observe;
      disconnect = observer.disconnect;
    },
  );
}

test("the scene has a skybox, a camera, a background ground and a render loop", () => {
  stubResizeObserver();
  const canvas = {} as HTMLCanvasElement;
  const { camera, engine, scene } = setupScene(canvas);
  expect(camera.attachControl).toHaveBeenCalledWith(canvas, true);
  expect(camera.upperRadiusLimit).toBe(90);
  expect(state.meshes.map((mesh) => mesh.name)).toEqual(["skyBox", "ground"]);
  expect(state.meshes[1].material).toEqual({
    name: "land",
    color: { forest: true },
  });
  // only the pick plane of the tile renderer is pickable
  expect(state.meshes.map((mesh) => mesh.isPickable)).toEqual([false, false]);

  state.renderLoop!();
  expect((scene as never as { render: unknown }).render).toHaveBeenCalled();
  expect(engine).toBe(state.engine);
  vi.unstubAllGlobals();
});

test("the camera target is clamped before every render", () => {
  stubResizeObserver();
  const { camera } = setupScene({} as HTMLCanvasElement);
  const mock = camera as unknown as {
    target: { x: number; y: number; z: number };
    radius: number;
    setTarget: ReturnType<typeof vi.fn>;
  };

  // inside the limit: untouched
  mock.target = { x: 10, y: 0, z: 0 };
  state.beforeRender!();
  expect(mock.setTarget).not.toHaveBeenCalled();

  // far off-center at the maximum zoom: pulled toward the center, angles kept
  mock.target = { x: 200, y: 0, z: 0 };
  mock.radius = 90;
  state.beforeRender!();
  expect(mock.setTarget).toHaveBeenCalledWith(
    expect.objectContaining({ x: 5, y: 0, z: 0 }),
    false,
    false,
    true,
  );

  // off the ground: y is reset
  mock.setTarget.mockClear();
  mock.target = { x: 0, y: 3, z: 0 };
  state.beforeRender!();
  expect(mock.setTarget).toHaveBeenCalledWith(
    expect.objectContaining({ x: 0, y: 0, z: 0 }),
    false,
    false,
    true,
  );
  vi.unstubAllGlobals();
});

test("a canvas size change resizes the engine until the scene is disposed", () => {
  stubResizeObserver();
  const canvas = {} as HTMLCanvasElement;
  const { dispose } = setupScene(canvas);
  expect(observer.observe).toHaveBeenCalledWith(canvas);
  observer.callback!();
  expect(state.engine!.resize).toHaveBeenCalled();

  dispose();
  expect(observer.disconnect).toHaveBeenCalled();
  expect(state.scene!.dispose).toHaveBeenCalled();
  expect(state.engine!.dispose).toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test("errors while disposing are logged and swallowed", () => {
  stubResizeObserver();
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
