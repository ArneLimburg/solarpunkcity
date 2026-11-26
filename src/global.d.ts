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
      getModelCount(coords: HexCoordinates): number;
      getModelTriangleCount(coords: HexCoordinates): number;
      getTreeCount(coords: HexCoordinates): number;
      // material name of the fill at corner 0..5 of a tile, undefined without fill
      getCornerMaterial(
        coords: HexCoordinates,
        corner: number,
      ): string | undefined;
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
      getSettlerStats(): {
        count: number;
        trianglesPerFigure: number;
        meshes: number;
        drawCalls: number; // of the last frame, all meshes
      };
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
      addResources(resources: Partial<Resources>): void;
      // places a finished wood storage (free) without any checks
      addWoodStorage(coords: HexCoordinates): void;
      // finishes all construction sites at once
      finishConstruction(): void;
    };
  }
}
