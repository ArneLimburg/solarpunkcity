import {
  Plane,
  TransformNode,
  type Mesh,
  type Scene,
  type StandardMaterial,
} from "@babylonjs/core";
import type { BuildingType } from "./gameDefinitions";
import { type ModelType, type FarmRenderer } from "./FarmRenderer";
import type { WoodStorageRenderer } from "./WoodStorageRenderer";
import { createHologramMaterial } from "./Hologram";
import { TILE_TOP } from "./hexGeometry";

export type ConstructionSite = {
  dispose: () => void;
  // fills the finished model from the ground up to the percentage (0 to 100)
  setProgress: (percent: number) => void;
  // the share of the model height that is filled (0 to 1)
  getFill: () => number;
};

export type ConstructionRenderer = {
  // shows the blueprint of the type on the center, turned around Y by rotation
  create: (
    type: BuildingType,
    center: { x: number; z: number },
    rotation: number,
  ) => ConstructionSite;
};

// Shows a construction site as the finished model below the progress line and
// the blue hologram above it. Every site has clones of the template meshes (they
// share the geometry, nothing is rebuilt) with its own materials, because a
// clipping plane belongs to the material: the finished part is clipped above the
// plane, the hologram below it. The plane only moves when the progress changes.
export function createConstructionRenderer(
  scene: Scene,
  farms: FarmRenderer,
  woodStorage: WoodStorageRenderer,
): ConstructionRenderer {
  const getTemplates = (type: BuildingType): Mesh[] =>
    type === "WoodStorage"
      ? woodStorage.meshes
      : farms.getMeshes(type as ModelType);

  return {
    create: (type, center, rotation) => {
      const templates = getTemplates(type);
      const height = Math.max(
        ...templates.map((mesh) => mesh.getBoundingInfo().maximum.y),
      );
      const root = new TransformNode(`${type}Site`, scene);
      root.position.set(center.x, TILE_TOP, center.z);
      root.rotation.y = rotation;
      const finished: StandardMaterial[] = [];
      const ghost = createHologramMaterial(`${type}SiteHologram`, scene);
      for (const template of templates) {
        const solid = template.clone(`${template.name}_site`, root);
        solid.isVisible = true;
        solid.isPickable = false;
        const material = template.material!.clone(
          `${template.name}_siteMaterial`,
        ) as StandardMaterial;
        solid.material = material;
        finished.push(material);
        const blueprint = template.clone(`${template.name}_blueprint`, root);
        blueprint.isVisible = true;
        blueprint.isPickable = false;
        blueprint.material = ghost;
      }
      let fill = Number.NaN;
      const setProgress = (percent: number) => {
        if (percent / 100 === fill) return;
        fill = percent / 100;
        const level = TILE_TOP + fill * height;
        // Babylon discards what lies on the positive side of a plane
        for (const material of finished) {
          material.clipPlane = new Plane(0, 1, 0, -level);
        }
        ghost.clipPlane = new Plane(0, -1, 0, level);
      };
      setProgress(0);
      return {
        dispose: () => {
          finished.forEach((material) => material.dispose());
          ghost.dispose();
          root.dispose();
        },
        setProgress,
        getFill: () => fill,
      };
    },
  };
}
