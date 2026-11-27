// makes the Window.__solarpunk type known to the unit test project as well
import type {} from "./global";
import {
  Matrix,
  Vector3,
  type ArcRotateCamera,
  type Engine,
  type Scene,
} from "@babylonjs/core";
import {
  getBuilding,
  getPlacedBuilding,
  isUnderConstruction,
  type HexCoordinates,
} from "./board";
import { BuildingDefinition, type BuildingType } from "./gameDefinitions";
import { build, finishConstruction, grantResources, toWorkSlot } from "./game";
import { TILE_TOP, hexToPixel, tileKey } from "./hexGeometry";
import type { Ring } from "./SelectionRing";
import type { SeaRenderer } from "./SeaRenderer";
import type { SettlerRenderer } from "./SettlerRenderer";

type DevHooks = NonNullable<Window["__solarpunk"]>;

type DevHookSources = {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  canvas: HTMLCanvasElement;
  ring: Ring;
  getTileMaterial: DevHooks["getTileMaterial"];
  getTileInstanceStats: DevHooks["getTileInstanceStats"];
  getMountainStats: DevHooks["getMountainStats"];
  // the model currently shown on a tile ("q,r")
  models: Record<string, { triangles: number }>;
  // the blueprint shown on the center tile of a construction site ("q,r")
  sites: Record<string, { getFill: () => number }>;
  getTreeCount: DevHooks["getTreeCount"];
  getCornerMaterial: DevHooks["getCornerMaterial"];
  // shows the model of a finished building
  showBuilding: (coords: HexCoordinates, type: BuildingType) => void;
  getProgressLabel: DevHooks["getProgressLabel"];
  getRotorMatrix: DevHooks["getRotorMatrix"];
  settlers: SettlerRenderer;
  backdrop: SeaRenderer;
  // shows the given number of generated residents; undefined: the real ones
  showSettlers: (count: number | undefined) => void;
};

// the window.__solarpunk API used by the e2e tests
export function createDevHooks({
  engine,
  scene,
  camera,
  canvas,
  ring,
  getTileMaterial,
  getTileInstanceStats,
  getMountainStats,
  models,
  sites,
  getTreeCount,
  getCornerMaterial,
  showBuilding,
  getProgressLabel,
  getRotorMatrix,
  settlers,
  backdrop,
  showSettlers,
}: DevHookSources): DevHooks {
  // the draw calls of the last frame (the engine's counter may keep running across frames)
  let drawCalls = 0;
  let before = 0;
  scene.onBeforeRenderObservable.add(() => {
    before = engine._drawCalls.current;
  });
  scene.onAfterRenderObservable.add(() => {
    drawCalls = engine._drawCalls.current - before;
  });
  // canvas position of a scene point, null outside the view
  const toScreen = (world: Vector3) => {
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
  };
  return {
    getSettlers: settlers.getSettlers,
    getSettlerStats: () => ({
      count: settlers.getSettlers().length,
      trianglesPerFigure: settlers.getTriangleCount(),
      meshes: settlers.getMeshCount(),
      drawCalls,
    }),
    showSettlers,
    // all settlers walk to the building at the tile (benchmark); undefined
    // sends them back to their loops
    sendSettlers: (coords) => {
      const placed = coords && getPlacedBuilding(coords);
      settlers.assignWork(placed ? [toWorkSlot(placed, Infinity)] : []);
    },
    getSettlerRoute: settlers.getRoute,
    getBackdropStats: () => ({
      meshes: backdrop.meshes.map((mesh) => mesh.name),
      pickable: backdrop.meshes.filter((mesh) => mesh.isPickable).length,
      drawCalls,
    }),
    setBackdropVisible: backdrop.setVisible,
    getSettlerMarker: settlers.getMarker,
    // page position (relative to the canvas) of the body (height 0.1) or head
    // (height 0.24) of a settler
    settlerToScreen: (id, part) => {
      const settler = settlers.getSettlers().find((s) => s.id === id)!;
      return toScreen(
        new Vector3(
          settler.x,
          TILE_TOP + (part === "head" ? 0.24 : 0.1),
          settler.z,
        ),
      );
    },
    tileToScreen: (coords) => {
      const world = hexToPixel(coords.q, coords.r);
      world.y = TILE_TOP;
      return toScreen(world);
    },
    getBuildingType: (coords) => getBuilding(coords)?.type,
    isUnderConstruction,
    getRingTile: () => ring.tile,
    getRingTiles: () => [...ring.tiles],
    isRingBlocked: () => ring.blocked,
    getTileMaterial,
    getTileInstanceStats,
    getMountainStats,
    getModelCount: (coords) => (models[tileKey(coords)] ? 1 : 0),
    getModelTriangleCount: (coords) => models[tileKey(coords)]?.triangles ?? 0,
    getSiteFill: (coords) => sites[tileKey(coords)]?.getFill(),
    getTreeCount,
    getCornerMaterial,
    getProgressLabel,
    addResources: grantResources,
    addWoodStorage: (coords) => {
      build("WoodStorage", coords);
      showBuilding(coords, "WoodStorage");
    },
    addHydroPowerPlant: (coords) => {
      build("HydroPowerPlant", coords);
      showBuilding(coords, "HydroPowerPlant");
    },
    addSolarField: (coords) => {
      build("SolarField", coords);
      showBuilding(coords, "SolarField");
    },
    addWindTurbine: (coords) => {
      build("WindTurbine", coords);
      showBuilding(coords, "WindTurbine");
    },
    getRotorMatrix,
    addCommunityGarden: (coords) => {
      // the wood pays for the garden, so the stock stays as it was
      grantResources({ wood: BuildingDefinition.CommunityGarden.cost.wood });
      build("CommunityGarden", coords);
      finishConstruction().forEach(({ coords, type }) =>
        showBuilding(coords, type),
      );
    },
    finishConstruction: () =>
      finishConstruction().forEach(({ coords, type }) =>
        showBuilding(coords, type),
      ),
  };
}
