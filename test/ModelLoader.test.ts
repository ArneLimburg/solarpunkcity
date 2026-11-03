import { beforeEach, expect, test, vi } from "vitest";
import type { Scene } from "@babylonjs/core";

const loadAssetContainer = vi.fn();

vi.mock("@babylonjs/core", () => ({
  LoadAssetContainerAsync: (...args: unknown[]) => loadAssetContainer(...args),
  AbstractMesh: class {},
  Vector3: class {},
}));
vi.mock("@babylonjs/loaders/dynamic", () => ({
  registerBuiltInLoaders: vi.fn(),
}));

let loader: typeof import("../src/ModelLoader");

function fakeContainer(rootNodes: unknown[] = []) {
  return {
    instantiateModelsToScene: vi.fn((rename: (name: string) => string) => ({
      rootNodes,
      names: [rename("x")],
    })),
  };
}

function fakeScene(isDisposed = false) {
  return { isDisposed } as unknown as Scene;
}

beforeEach(async () => {
  vi.resetModules();
  loadAssetContainer.mockReset();
  loadAssetContainer.mockImplementation(async () => fakeContainer());
  loader = await import("../src/ModelLoader");
});

test("preloading loads each model of a buildable category once", async () => {
  await loader.preloadModels(fakeScene());
  const urls = loadAssetContainer.mock.calls.map((call) => call[0]);
  expect(urls.sort()).toEqual(["farm/farm.glb", "residential/residential.glb"]);
});

test("preloading the same scene twice does nothing", async () => {
  const scene = fakeScene();
  await loader.preloadModels(scene);
  const calls = loadAssetContainer.mock.calls.length;
  await loader.preloadModels(scene);
  expect(loadAssetContainer.mock.calls.length).toBe(calls);
});

test("preloading another scene reuses cached models", async () => {
  await loader.preloadModels(fakeScene());
  const calls = loadAssetContainer.mock.calls.length;
  await loader.preloadModels(fakeScene());
  expect(loadAssetContainer.mock.calls.length).toBe(calls);
});

test("an error during preloading is swallowed if the scene is disposed", async () => {
  loadAssetContainer.mockRejectedValue(new Error("boom"));
  await expect(loader.preloadModels(fakeScene(true))).resolves.toBeUndefined();
});

test("an error during preloading is rethrown otherwise", async () => {
  loadAssetContainer.mockRejectedValue(new Error("boom"));
  await expect(loader.preloadModels(fakeScene())).rejects.toThrow("boom");
});

test("loadCachedModel loads and caches an uncached model", async () => {
  const container = fakeContainer();
  loadAssetContainer.mockResolvedValue(container);
  const scene = fakeScene();

  const first = await loader.loadCachedModel("a.glb", scene);
  expect(loadAssetContainer).toHaveBeenCalledWith("a.glb", scene);
  expect(container.instantiateModelsToScene).toHaveBeenCalledTimes(1);
  expect(first).toMatchObject({ names: ["x_instance"] });

  const second = await loader.loadCachedModel("a.glb", scene);
  expect(loadAssetContainer).toHaveBeenCalledTimes(1);
  expect(container.instantiateModelsToScene).toHaveBeenCalledTimes(2);
  expect(second).toMatchObject({ names: ["x_clone"] });
});

test("root nodes are positioned only when a position is given", async () => {
  const set = vi.fn();
  loadAssetContainer.mockResolvedValue(
    fakeContainer([{ position: { set } }, {}]),
  );
  const scene = fakeScene();
  const position = { x: 1, y: 2, z: 3 } as never;

  await loader.loadCachedModel("b.glb", scene);
  expect(set).not.toHaveBeenCalled();

  await loader.loadCachedModel("b.glb", scene, position); // cached
  expect(set).toHaveBeenCalledWith(1, 2, 3);
  expect(set).toHaveBeenCalledTimes(1);

  await loader.loadCachedModel("c.glb", scene, position); // uncached
  expect(set).toHaveBeenCalledTimes(2);
});
