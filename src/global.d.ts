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
      getRingTile(): HexCoordinates | null;
      getRingTiles(): HexCoordinates[];
      getTileMaterial(coords: HexCoordinates): string | undefined;
      getModelCount(coords: HexCoordinates): number;
      getModelTriangleCount(coords: HexCoordinates): number;
      getTreeCount(coords: HexCoordinates): number;
      addResources(resources: Partial<Resources>): void;
    };
  }
}
