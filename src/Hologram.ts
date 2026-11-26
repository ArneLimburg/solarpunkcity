import {
  Color3,
  StandardMaterial,
  TransformNode,
  type Scene,
} from "@babylonjs/core";
import type { BuildingType } from "./gameDefinitions";
import { isModelType, type FarmRenderer } from "./FarmRenderer";
import type { WoodStorageRenderer } from "./WoodStorageRenderer";
import { TILE_TOP, hexToPixel } from "./hexGeometry";
import type { HexCoordinates } from "./board";

export type Hologram = {
  // shows the translucent model of the type on the tile, or hides it when
  // there is no type or tile
  update: (type: BuildingType | undefined, tile: HexCoordinates | null) => void;
};

// A single translucent blue copy of the selected building that follows the
// cursor. The clones share the geometry of the building templates and are not
// pickable, so the map input passes through.
export function createHologram(
  scene: Scene,
  farms: FarmRenderer,
  woodStorage: WoodStorageRenderer,
): Hologram {
  const material = new StandardMaterial("hologram", scene);
  material.diffuseColor = new Color3(0.2, 0.55, 1);
  material.emissiveColor = new Color3(0.2, 0.55, 1);
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  material.alpha = 0.45;

  const roots: Partial<Record<BuildingType, TransformNode>> = {};
  let current: TransformNode | undefined;

  const getRoot = (type: BuildingType): TransformNode => {
    const existing = roots[type];
    if (existing) {
      return existing;
    }
    const root = new TransformNode(`${type}Hologram`, scene);
    root.setEnabled(false);
    const templates =
      type === "WoodStorage"
        ? woodStorage.meshes
        : isModelType(type)
          ? farms.getMeshes(type)
          : [];
    for (const template of templates) {
      const clone = template.clone(`${template.name}_hologram`, root);
      clone.isVisible = true;
      clone.isPickable = false;
      clone.material = material;
    }
    return (roots[type] = root);
  };

  return {
    update: (type, tile) => {
      const root = type && tile ? getRoot(type) : undefined;
      if (current !== root) {
        current?.setEnabled(false);
        root?.setEnabled(true);
        current = root;
      }
      if (root && tile) {
        const center = hexToPixel(tile.q, tile.r);
        root.position.set(center.x, TILE_TOP, center.z);
      }
    },
  };
}
