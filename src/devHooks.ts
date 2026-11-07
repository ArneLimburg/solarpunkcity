// makes the Window.__solarpunk type known to the unit test project as well
import type {} from "./global";
import {
  Matrix,
  Vector3,
  type ArcRotateCamera,
  type Engine,
  type Scene,
} from "@babylonjs/core";
import { getBuilding, isUnderConstruction, type HexCoordinates } from "./board";
import type { BuildingType } from "./gameDefinitions";
import { finishConstruction, grantResources } from "./game";
import { hexToPixel, tileKey } from "./hexGeometry";
import type { Ring } from "./SelectionRing";
import { getTileMaterialName, type TileMeshes } from "./TileRenderer";

type DevHooks = NonNullable<Window["__solarpunk"]>;

type DevHookSources = {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  canvas: HTMLCanvasElement;
  ring: Ring;
  tileMeshes: TileMeshes;
  // the model currently shown on a tile ("q,r")
  models: Record<string, { triangles: number }>;
  getTreeCount: DevHooks["getTreeCount"];
  getCornerMaterial: DevHooks["getCornerMaterial"];
  // shows the model of a finished building
  showBuilding: (coords: HexCoordinates, type: BuildingType) => void;
};

// the window.__solarpunk API used by the e2e tests
export function createDevHooks({
  engine,
  scene,
  camera,
  canvas,
  ring,
  tileMeshes,
  models,
  getTreeCount,
  getCornerMaterial,
  showBuilding,
}: DevHookSources): DevHooks {
  return {
    tileToScreen: (coords) => {
      const world = hexToPixel(coords.q, coords.r);
      world.y = 0.1;
      const width = engine.getRenderWidth();
      const height = engine.getRenderHeight();
      const projected = Vector3.Project(
        world,
        Matrix.IdentityReadOnly,
        scene.getTransformMatrix(),
        camera.viewport.toGlobal(width, height),
      );
      if (
        projected.z < 0 ||
        projected.z > 1 ||
        projected.x < 0 ||
        projected.x > width ||
        projected.y < 0 ||
        projected.y > height
      ) {
        return null;
      }
      return {
        x: (projected.x * canvas.clientWidth) / width,
        y: (projected.y * canvas.clientHeight) / height,
      };
    },
    getBuildingType: (coords) => getBuilding(coords)?.type,
    isUnderConstruction,
    getRingTile: () => ring.tile,
    getRingTiles: () => [...ring.tiles],
    isRingBlocked: () => ring.blocked,
    getTileMaterial: (coords) => getTileMaterialName(tileMeshes, coords),
    getModelCount: (coords) => (models[tileKey(coords)] ? 1 : 0),
    getModelTriangleCount: (coords) => models[tileKey(coords)]?.triangles ?? 0,
    getTreeCount,
    getCornerMaterial,
    addResources: grantResources,
    finishConstruction: () =>
      finishConstruction().forEach(({ coords, type }) =>
        showBuilding(coords, type),
      ),
  };
}
