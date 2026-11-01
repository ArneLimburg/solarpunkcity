import {
  type Scene,
  type AssetContainer,
  LoadAssetContainerAsync,
  AbstractMesh,
  Vector3,
} from "@babylonjs/core";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { BuildingCategories, BuildingTypes } from "./gameDefinitions";

registerBuiltInLoaders();

const cache = new Map<string, AssetContainer>();
const preloadedScenes = new WeakSet<Scene>();

export async function preloadModels(scene: Scene) {
  if (preloadedScenes.has(scene)) {
    return;
  }
  preloadedScenes.add(scene);

  for (const building of Object.values(BuildingTypes)) {
    // Not buildable categories (forest) have no model file yet
    if (
      !BuildingCategories[building.category].buildable ||
      cache.has(building.model)
    ) {
      continue;
    }
    try {
      const result = await LoadAssetContainerAsync(building.model, scene);
      cache.set(building.model, result);
    } catch (error) {
      // The scene may be disposed while loading (e.g. React StrictMode remount)
      if (scene.isDisposed) {
        return;
      }
      throw error;
    }
  }
}

export async function loadCachedModel(
  url: string,
  scene: Scene,
  position?: Vector3,
) {
  if (cache.has(url)) {
    const container = cache.get(url)!;
    const instance = container.instantiateModelsToScene(
      (name) => `${name}_clone`,
      true,
    );
    if (position) {
      instance.rootNodes.forEach((node) => {
        const mesh = node as AbstractMesh;
        if (mesh.position) {
          mesh.position.set(position.x, position.y, position.z);
        }
      });
    }
    return instance;
  }

  const container = await LoadAssetContainerAsync(url, scene);
  cache.set(url, container);

  const instance = container.instantiateModelsToScene(
    (name) => `${name}_instance`,
    true,
  );
  if (position) {
    instance.rootNodes.forEach((node) => {
      const mesh = node as AbstractMesh;
      if (mesh.position) {
        mesh.position.set(position.x, position.y, position.z);
      }
    });
  }
  return instance;
}
