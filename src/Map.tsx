import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import type { Observer, PointerInfo } from "@babylonjs/core";
import type { HexCoordinates } from "./board";
import type { BuildingType } from "./gameDefinitions";
import { createCornerRenderer, type CornerRenderer } from "./CornerRenderer";
import { createFarmRenderer, type FarmRenderer } from "./FarmRenderer";
import {
  createWoodStorageRenderer,
  type WoodStorageRenderer,
} from "./WoodStorageRenderer";
import { createMountainRenderer } from "./MountainRenderer";
import { createForest, type ForestRenderer } from "./ForestRenderer";
import { HEX_SIZE, hexToPixel } from "./hexGeometry";
import {
  createGroundMaterials,
  createTileRenderer,
  getForestTiles,
  getRiverTiles,
  type GroundMaterials,
  type TileRenderer,
} from "./TileRenderer";
import {
  createLeaveHandler,
  createPointerHandler,
  createPreview,
  createRing,
} from "./SelectionRing";
import { createSeaRenderer } from "./SeaRenderer";
import { createSettlerRenderer, type SettlerRenderer } from "./SettlerRenderer";
import { createRoster, syncRoster, type Resident } from "./settlers";
import { setupScene } from "./sceneSetup";
import { createDevHooks } from "./devHooks";
import { placeBuilding, type PlacedModel } from "./placeBuilding";

const ignore = () => {};

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
    residents: Resident[];
  }
>(({ onSelected, previewType, residents }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // the model currently shown on a tile ("q,r")
  const modelsRef = useRef<Record<string, PlacedModel>>({});
  const forestRef = useRef<ForestRenderer | null>(null);
  const farmsRef = useRef<FarmRenderer | null>(null);
  const woodStorageRef = useRef<WoodStorageRenderer | null>(null);
  const cornersRef = useRef<CornerRenderer | null>(null);
  const settlersRef = useRef<SettlerRenderer | null>(null);
  // the residents to show; DEV benchmarks replace them with generated ones
  const residentsRef = useRef(residents);
  residentsRef.current = residents;
  // what a change of the residents does: nothing before the scene exists and
  // while generated settlers are shown, otherwise it syncs the settlers
  const applyResidentsRef = useRef<(residents: Resident[]) => void>(ignore);

  // the tile renderer and the ground materials
  const tilesRef = useRef<TileRenderer | null>(null);
  const materialsRef = useRef<GroundMaterials | null>(null);
  // mirrors the prop so that the stable pointer handler can read it
  const previewTypeRef = useRef(previewType);
  previewTypeRef.current = previewType;

  const place = (
    coords: HexCoordinates,
    type: BuildingType,
    underConstruction?: boolean,
  ) => {
    placeBuilding(
      coords,
      type,
      {
        forest: forestRef.current!,
        farms: farmsRef.current!,
        woodStorage: woodStorageRef.current!,
        tiles: tilesRef.current!,
        materials: materialsRef.current!,
        corners: cornersRef.current!,
        models: modelsRef.current,
      },
      underConstruction,
    );
    // settlers whose way is blocked now pick another one
    settlersRef.current!.boardChanged();
  };

  useEffect(() => {
    applyResidentsRef.current(residents);
  }, [residents]);

  useImperativeHandle(ref, () => ({ addBuilding: place }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const { engine, scene, camera, dispose } = setupScene(canvas);

    const materials = createGroundMaterials(scene);
    materialsRef.current = materials;
    const backdrop = createSeaRenderer(scene);
    const tiles = createTileRenderer(scene, materials);
    tilesRef.current = tiles;
    tiles.setGrounds(getRiverTiles(tiles.tiles), materials.water);
    const mountains = createMountainRenderer(scene);
    cornersRef.current = createCornerRenderer(
      scene,
      materials,
      tiles.tiles,
      (coords) => tiles.getGround(coords)!,
    );
    forestRef.current = createForest(
      scene,
      getForestTiles(tiles.tiles),
      HEX_SIZE,
      (tile) => hexToPixel(tile.q, tile.r),
    );
    farmsRef.current = createFarmRenderer(scene, HEX_SIZE);
    woodStorageRef.current = createWoodStorageRenderer(scene, HEX_SIZE);
    const settlers = createSettlerRenderer(
      scene,
      Math.floor(Math.random() * 2 ** 32),
    );
    settlersRef.current = settlers;
    const follow = (current: Resident[]) => settlers.sync(current);
    applyResidentsRef.current = follow;
    // the game starts with the settlers' camp in the middle of the board
    place({ q: 0, r: 0 }, "SettlersCamp");
    follow(residentsRef.current);

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
        getTileMaterial: (coords) => tiles.getGround(coords),
        getTileInstanceStats: tiles.getInstanceStats,
        getMountainStats: mountains.getStats,
        models: modelsRef.current,
        getTreeCount: (coords) => forestRef.current!.getTreeCount(coords),
        getCornerMaterial: (coords, corner) =>
          cornersRef.current!.getMaterialName({ tile: coords, corner }),
        showBuilding: (coords, type) => place(coords, type, false),
        settlers,
        backdrop,
        // shows generated residents instead of the roster; undefined goes back
        showSettlers: (count) => {
          applyResidentsRef.current = count === undefined ? follow : ignore;
          settlers.sync(
            count === undefined
              ? residentsRef.current
              : syncRoster(createRoster(1), count),
          );
        },
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
