import earcut from "earcut";
import type { HexCoordinates } from "./board";
import type { BuildingType } from "./gameDefinitions";
import type { Resources } from "./resources";

type earcutType = typeof earcut;

declare global {
  interface Window {
    earcut: earcutType;
    // only available in dev mode, used by the e2e tests
    __solarpunk?: {
      tileToScreen(coords: HexCoordinates): { x: number; y: number } | null;
      getBuildingType(coords: HexCoordinates): BuildingType | undefined;
      isUnderConstruction(coords: HexCoordinates): boolean;
      getRingTile(): HexCoordinates | null;
      getRingTiles(): HexCoordinates[];
      isRingBlocked(): boolean;
      getTileMaterial(coords: HexCoordinates): string | undefined;
      // thin instances of all tile layers and how many of their matrices are finite
      getTileInstanceStats(): { instances: number; finiteMatrices: number };
      getMountainStats(): {
        meshes: number;
        triangles: number;
        pickable: boolean;
        inView: boolean;
      };
      getModelCount(coords: HexCoordinates): number;
      getModelTriangleCount(coords: HexCoordinates): number;
      getTreeCount(coords: HexCoordinates): number;
      // the share (0 to 1) of the blueprint of a construction site that shows
      // the finished model, undefined without a blueprint
      getSiteFill(coords: HexCoordinates): number | undefined;
      // material name of the fill at corner 0..5 of a tile, undefined without fill
      getCornerMaterial(
        coords: HexCoordinates,
        corner: number,
      ): string | undefined;
      // the text of the label above the selected construction site, undefined
      // while it is hidden
      getProgressLabel(): string | undefined;
      // the figures of the settlers (tile: where each one is standing)
      getSettlers(): {
        id: number;
        x: number;
        z: number;
        tile: HexCoordinates;
        heading: number;
        phase: number;
        walking: boolean;
        pausing: boolean;
      }[];
      // canvas position of the head or body of a settler, null outside the view
      settlerToScreen(
        id: number,
        part: "head" | "body",
      ): { x: number; y: number } | null;
      // the selection marker: whose, and whether it is shown
      getSettlerMarker(): { id: number | undefined; visible: boolean };
      getSettlerStats(): {
        count: number;
        trianglesPerFigure: number;
        meshes: number;
        drawCalls: number; // of the last frame, all meshes
      };
      // passes (scene renders) and draw calls of the whole last frame
      getFrameStats(): { passes: number; drawCalls: number };
      // the settler preview: registered views, preview cameras, observers of the
      // scene, the preview camera's target, the state of the main camera and
      // which camera draws the marker and the route line
      getPreviewStats(): {
        views: number;
        cameras: number;
        observers: number;
        target: { x: number; y: number; z: number } | undefined;
        mainCamera: {
          alpha: number;
          beta: number;
          radius: number;
          target: { x: number; y: number; z: number };
        };
        markerOnPreview: boolean;
        markerOnMain: boolean;
        routeOnPreview: boolean;
        routeOnMain: boolean;
      };
      // makes setting up a preview fail (or work again)
      failPreviews(fail: boolean): void;
      // the sea and beach meshes (names, how many are pickable); draw calls of the last frame
      getBackdropStats(): {
        meshes: string[];
        pickable: number;
        drawCalls: number;
      };
      setBackdropVisible(visible: boolean): void;
      // shows generated residents instead of the real ones (benchmark);
      // undefined goes back to the real ones
      showSettlers(count: number | undefined): void;
      // sends all settlers to the building at the tile (undefined: no task)
      sendSettlers(coords: HexCoordinates | undefined): void;
      // the route line of the selected settler: shown, remaining tiles
      getSettlerRoute(): { visible: boolean; tiles: HexCoordinates[] };
      addResources(resources: Partial<Resources>): void;
      // places a finished wood storage (free) without any checks
      addWoodStorage(coords: HexCoordinates): void;
      // shows the model of a hydro power plant on a river tile without any checks
      addHydroPowerPlant(coords: HexCoordinates): void;
      addSolarField(coords: HexCoordinates): void;
      // places a finished wind turbine (free) without any checks
      addWindTurbine(coords: HexCoordinates): void;
      // the current rotor matrix (16 values) of the finished wind turbine on a
      // tile; undefined without one, also on a construction site
      getRotorMatrix(coords: HexCoordinates): number[] | undefined;
      // places a finished community garden without any checks
      addCommunityGarden(coords: HexCoordinates): void;
      // finishes all construction sites at once
      finishConstruction(): void;
    };
  }
}
