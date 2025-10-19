import {
  type Scene,
  type AssetContainer,
  LoadAssetContainerAsync,
  AbstractMesh,
  Vector3,
} from "@babylonjs/core";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { BuildingTypes } from "../gameDefinitions";

registerBuiltInLoaders();

const cache = new Map<string, AssetContainer>();
let preloadDone = false;

export async function preloadModels(scene: Scene) {
  if (preloadDone) {
    return;
  }
  preloadDone = true;

  for (const building of Object.values(BuildingTypes)) {
    const result = await LoadAssetContainerAsync(building.model, scene);
    cache.set(building.model, result);
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
