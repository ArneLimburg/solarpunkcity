import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import type { Observer, PointerInfo } from "@babylonjs/core";
import type { HexCoordinates } from "./board";
import type { BuildingType } from "./gameDefinitions";
import { createFarmRenderer, type FarmRenderer } from "./FarmRenderer";
import { createForest, type ForestRenderer } from "./ForestRenderer";
import { HEX_SIZE, hexToPixel } from "./hexGeometry";
import {
  createGroundMaterials,
  createTiles,
  getForestTiles,
  type GroundMaterials,
  type TileMeshes,
} from "./TileRenderer";
import {
  createLeaveHandler,
  createPointerHandler,
  createRing,
} from "./SelectionRing";
import { setupScene } from "./sceneSetup";
import { createDevHooks } from "./devHooks";
import { placeBuilding, type PlacedModel } from "./placeBuilding";

export const Map = forwardRef<
  { addBuilding: (coords: HexCoordinates, type: BuildingType) => void },
  {
    onSelected: (coordinates: HexCoordinates) => void;
    // footprint radius of the selected building type, 0 without selection
    previewRadius: number;
  }
>(({ onSelected, previewRadius }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // the model currently shown on a tile ("q,r")
  const modelsRef = useRef<Record<string, PlacedModel>>({});
  const forestRef = useRef<ForestRenderer | null>(null);
  const farmsRef = useRef<FarmRenderer | null>(null);

  // hex meshes per tile ("q,r") and the ground materials
  const tileMeshesRef = useRef<TileMeshes>({});
  const materialsRef = useRef<GroundMaterials | null>(null);
  // mirrors the prop so that the stable pointer handler can read it
  const previewRadiusRef = useRef(previewRadius);
  previewRadiusRef.current = previewRadius;

  useImperativeHandle(ref, () => ({
    addBuilding: (coords: HexCoordinates, type: BuildingType) =>
      placeBuilding(coords, type, {
        forest: forestRef.current!,
        farms: farmsRef.current!,
        tileMeshes: tileMeshesRef.current,
        materials: materialsRef.current!,
        models: modelsRef.current,
      }),
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const { engine, scene, camera, dispose } = setupScene(canvas);

    const materials = createGroundMaterials(scene);
    materialsRef.current = materials;
    const tiles = createTiles(scene, materials.forestFloor);
    tileMeshesRef.current = tiles.meshes;
    forestRef.current = createForest(
      scene,
      getForestTiles(tiles.coordinates),
      HEX_SIZE,
      (tile) => hexToPixel(tile.q, tile.r),
    );
    farmsRef.current = createFarmRenderer(scene, HEX_SIZE);

    const ring = createRing(scene);
    const pointerObserver: Observer<PointerInfo> =
      scene.onPointerObservable.add(
        createPointerHandler(
          scene,
          ring,
          onSelected,
          () => previewRadiusRef.current,
        ),
      );
    const hideOnLeave = createLeaveHandler(ring);
    canvas.addEventListener("pointerleave", hideOnLeave);

    if (import.meta.env.DEV) {
      window.__solarpunk = createDevHooks({
        engine,
        scene,
        camera,
        canvas,
        ring,
        tileMeshes: tileMeshesRef.current,
        models: modelsRef.current,
        getTreeCount: (coords) => forestRef.current!.getTreeCount(coords),
      });
    }

    return () => {
      canvas.removeEventListener("pointerleave", hideOnLeave);
      delete window.__solarpunk;
      scene.onPointerObservable.remove(pointerObserver);
      dispose();
    };
  }, []);

  return <canvas ref={canvasRef} />;
});
