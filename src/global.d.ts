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
      getModelCount(coords: HexCoordinates): number;
      getModelTriangleCount(coords: HexCoordinates): number;
      getTreeCount(coords: HexCoordinates): number;
      // material name of the fill at corner 0..5 of a tile, undefined without fill
      getCornerMaterial(
        coords: HexCoordinates,
        corner: number,
      ): string | undefined;
      addResources(resources: Partial<Resources>): void;
      // places a finished wood storage (free) without any checks
      addWoodStorage(coords: HexCoordinates): void;
      // finishes all construction sites at once
      finishConstruction(): void;
    };
  }
}
