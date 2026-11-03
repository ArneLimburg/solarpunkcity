import {
  type Scene,
  type AssetContainer,
  LoadAssetContainerAsync,
  AbstractMesh,
  type Node,
  Vector3,
} from "@babylonjs/core";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { BuildingTypes } from "./gameDefinitions";

registerBuiltInLoaders();

const cache = new Map<string, AssetContainer>();
const preloadedScenes = new WeakSet<Scene>();

export async function preloadModels(scene: Scene) {
  if (preloadedScenes.has(scene)) {
    return;
  }
  preloadedScenes.add(scene);

  for (const building of Object.values(BuildingTypes)) {
    // the forest has no model file, it is drawn from code
    const model = "model" in building ? building.model : undefined;
    if (!model || cache.has(model)) {
      continue;
    }
    try {
      const result = await LoadAssetContainerAsync(model, scene);
      cache.set(model, result);
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
    positionRootNodes(instance.rootNodes, position);
    return instance;
  }

  const container = await LoadAssetContainerAsync(url, scene);
  cache.set(url, container);

  const instance = container.instantiateModelsToScene(
    (name) => `${name}_instance`,
    true,
  );
  positionRootNodes(instance.rootNodes, position);
  return instance;
}

function positionRootNodes(rootNodes: Node[], position?: Vector3) {
  if (!position) {
    return;
  }
  rootNodes.forEach((node) => {
    const mesh = node as AbstractMesh;
    if (mesh.position) {
      mesh.position.set(position.x, position.y, position.z);
    }
  });
}
