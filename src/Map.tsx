import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import type { Observer, PointerInfo } from "@babylonjs/core";
import type { HexCoordinates } from "./board";
import type { BuildingType } from "./gameDefinitions";
import { createCornerRenderer, type CornerRenderer } from "./CornerRenderer";
import { createFarmRenderer, type FarmRenderer } from "./FarmRenderer";
import { createForest, type ForestRenderer } from "./ForestRenderer";
import { HEX_SIZE, hexToPixel } from "./hexGeometry";
import {
  createGroundMaterials,
  createTiles,
  getForestTiles,
  getTileMaterialName,
  type GroundMaterials,
  type TileMeshes,
} from "./TileRenderer";
import {
  createLeaveHandler,
  createPointerHandler,
  createPreview,
  createRing,
} from "./SelectionRing";
import { setupScene } from "./sceneSetup";
import { createDevHooks } from "./devHooks";
import { placeBuilding, type PlacedModel } from "./placeBuilding";

export const Map = forwardRef<
  {
    addBuilding: (
      coords: HexCoordinates,
      type: BuildingType,
      underConstruction?: boolean,
    ) => void;
  },
  {
    onSelected: (coordinates: HexCoordinates) => void;
    previewType?: BuildingType;
  }
>(({ onSelected, previewType }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // the model currently shown on a tile ("q,r")
  const modelsRef = useRef<Record<string, PlacedModel>>({});
  const forestRef = useRef<ForestRenderer | null>(null);
  const farmsRef = useRef<FarmRenderer | null>(null);
  const cornersRef = useRef<CornerRenderer | null>(null);

  // hex meshes per tile ("q,r") and the ground materials
  const tileMeshesRef = useRef<TileMeshes>({});
  const materialsRef = useRef<GroundMaterials | null>(null);
  // mirrors the prop so that the stable pointer handler can read it
  const previewTypeRef = useRef(previewType);
  previewTypeRef.current = previewType;

  const place = (
    coords: HexCoordinates,
    type: BuildingType,
    underConstruction?: boolean,
  ) =>
    placeBuilding(
      coords,
      type,
      {
        forest: forestRef.current!,
        farms: farmsRef.current!,
        tileMeshes: tileMeshesRef.current,
        materials: materialsRef.current!,
        corners: cornersRef.current!,
        models: modelsRef.current,
      },
      underConstruction,
    );

  useImperativeHandle(ref, () => ({ addBuilding: place }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const { engine, scene, camera, dispose } = setupScene(canvas);

    const materials = createGroundMaterials(scene);
    materialsRef.current = materials;
    const tiles = createTiles(scene, materials.forestFloor);
    tileMeshesRef.current = tiles.meshes;
    cornersRef.current = createCornerRenderer(
      scene,
      materials,
      tiles.coordinates,
      (coords) => getTileMaterialName(tiles.meshes, coords)!,
    );
    forestRef.current = createForest(
      scene,
      getForestTiles(tiles.coordinates),
      HEX_SIZE,
      (tile) => hexToPixel(tile.q, tile.r),
    );
    farmsRef.current = createFarmRenderer(scene, HEX_SIZE);
    // the game starts with the settlers' camp in the middle of the board
    place({ q: 0, r: 0 }, "SettlersCamp");

    const ring = createRing(scene);
    const preview = createPreview(() => previewTypeRef.current);
    const pointerObserver: Observer<PointerInfo> =
      scene.onPointerObservable.add(
        createPointerHandler(
          scene,
          ring,
          onSelected,
          preview.getRadius,
          preview.isBlocked,
        ),
      );
    const hideOnLeave = createLeaveHandler(ring);
    canvas.addEventListener("pointerleave", hideOnLeave);

    // DEV only; e2e runs against the dev server, so a plain `if` would leave
    // its else branch uncovered
    [import.meta.env.DEV].filter(Boolean).forEach(() => {
      window.__solarpunk = createDevHooks({
        engine,
        scene,
        camera,
        canvas,
        ring,
        tileMeshes: tileMeshesRef.current,
        models: modelsRef.current,
        getTreeCount: (coords) => forestRef.current!.getTreeCount(coords),
        getCornerMaterial: (coords, corner) =>
          cornersRef.current!.getMaterialName({ tile: coords, corner }),
        showBuilding: (coords, type) => place(coords, type, false),
      });
    });

    return () => {
      canvas.removeEventListener("pointerleave", hideOnLeave);
      delete window.__solarpunk;
      scene.onPointerObservable.remove(pointerObserver);
      dispose();
    };
  }, []);

  return <canvas ref={canvasRef} />;
});
