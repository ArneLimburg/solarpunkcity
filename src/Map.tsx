import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  type Observer,
  type PointerInfo,
} from "@babylonjs/core";
import type { HexCoordinates } from "./board";
import type { BuildingType } from "./gameDefinitions";
import { createCornerRenderer, type CornerRenderer } from "./CornerRenderer";
import { createFarmRenderer, type FarmRenderer } from "./FarmRenderer";
import {
  createWoodStorageRenderer,
  type WoodStorageRenderer,
} from "./WoodStorageRenderer";
import {
  createWindTurbineRenderer,
  type WindTurbineRenderer,
} from "./WindTurbineRenderer";
import { APARTMENT_ROTOR_RPM, getApartmentHubPosition } from "./apartment";
import { ROTOR_RPM, getHubPosition } from "./windTurbine";
import { createMountainRenderer } from "./MountainRenderer";
import { createForest, type ForestRenderer } from "./ForestRenderer";
import {
  createConstructionRenderer,
  type ConstructionRenderer,
  type ConstructionSite,
} from "./ConstructionRenderer";
import { HEX_SIZE, hexToPixel, tileKey } from "./hexGeometry";
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
  isPrimaryTap,
} from "./SelectionRing";
import { createHologram } from "./Hologram";
import { createSeaRenderer } from "./SeaRenderer";
import { createSettlerRenderer, type SettlerRenderer } from "./SettlerRenderer";
import {
  createRoster,
  syncRoster,
  type Activity,
  type Resident,
} from "./settlers";
import type { WorkSlot } from "./tasks";
import { setupScene } from "./sceneSetup";
import { createDevHooks } from "./devHooks";
import { placeBuilding, type PlacedModel } from "./placeBuilding";

const ignore = () => {};

type Progress = { center: HexCoordinates; percent: number };

export const Map = forwardRef<
  {
    addBuilding: (
      coords: HexCoordinates,
      type: BuildingType,
      underConstruction?: boolean,
    ) => void;
    // fills the blueprint of the construction site at the center
    setProgress: (center: HexCoordinates, percent: number) => void;
    getSettlerActivity: (id: number) => Activity | undefined;
    assignWork: (slots: WorkSlot[]) => void;
  },
  {
    onSelected: (coordinates: HexCoordinates) => void;
    previewType?: BuildingType;
    residents: Resident[];
    // a tap on a settler outside the build mode
    onSettlerSelected: (id: number) => void;
    selectedSettler?: number;
    // the selected construction site and how far it is
    progress?: Progress;
  }
>(
  (
    {
      onSelected,
      previewType,
      residents,
      onSettlerSelected,
      selectedSettler,
      progress,
    },
    ref,
  ) => {
    const onSettlerSelectedRef = useRef(onSettlerSelected);
    onSettlerSelectedRef.current = onSettlerSelected;
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    // the model currently shown on a tile ("q,r")
    const modelsRef = useRef<Record<string, PlacedModel>>({});
    // the blueprint of each construction site by center tile ("q,r")
    const sitesRef = useRef<Record<string, ConstructionSite>>({});
    const constructionRef = useRef<ConstructionRenderer | null>(null);
    const forestRef = useRef<ForestRenderer | null>(null);
    const farmsRef = useRef<FarmRenderer | null>(null);
    const woodStorageRef = useRef<WoodStorageRenderer | null>(null);
    const windTurbinesRef = useRef<WindTurbineRenderer | null>(null);
    const apartmentRotorsRef = useRef<WindTurbineRenderer | null>(null);
    const cornersRef = useRef<CornerRenderer | null>(null);
    const settlersRef = useRef<SettlerRenderer | null>(null);
    // the residents to show; DEV benchmarks replace them with generated ones
    const residentsRef = useRef(residents);
    residentsRef.current = residents;
    // what a change of the residents does: nothing before the scene exists and
    // while generated settlers are shown, otherwise it syncs the settlers
    const applyResidentsRef = useRef<(residents: Resident[]) => void>(ignore);
    // the progress label above a construction site
    const showProgressRef =
      useRef<(progress: Progress | undefined) => void>(ignore);
    const progressRef = useRef(progress);
    progressRef.current = progress;

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
          windTurbines: windTurbinesRef.current!,
          apartmentRotors: apartmentRotorsRef.current!,
          tiles: tilesRef.current!,
          materials: materialsRef.current!,
          corners: cornersRef.current!,
          models: modelsRef.current,
          construction: constructionRef.current!,
          sites: sitesRef.current,
        },
        underConstruction,
      );
      // settlers whose way is blocked now pick another one
      settlersRef.current!.boardChanged();
    };

    useEffect(() => {
      applyResidentsRef.current(residents);
    }, [residents]);

    useImperativeHandle(ref, () => ({
      addBuilding: place,
      setProgress: (center, percent) =>
        sitesRef.current[tileKey(center)]?.setProgress(percent),
      getSettlerActivity: (id) => settlersRef.current!.getActivity(id),
      assignWork: (slots) => settlersRef.current!.assignWork(slots),
    }));

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
      windTurbinesRef.current = createWindTurbineRenderer(
        scene,
        farmsRef.current,
        HEX_SIZE,
        () => performance.now() / 1000,
        {
          type: "WindTurbine",
          rpm: ROTOR_RPM,
          hub: getHubPosition(HEX_SIZE),
        },
      );
      apartmentRotorsRef.current = createWindTurbineRenderer(
        scene,
        farmsRef.current,
        HEX_SIZE,
        () => performance.now() / 1000,
        {
          type: "AppartmentBuilding",
          rpm: APARTMENT_ROTOR_RPM,
          hub: getApartmentHubPosition(HEX_SIZE),
        },
      );
      constructionRef.current = createConstructionRenderer(
        scene,
        farmsRef.current,
        woodStorageRef.current,
      );
      const settlers = createSettlerRenderer(
        scene,
        Math.floor(Math.random() * 2 ** 32),
      );
      settlersRef.current = settlers;
      const selectSettler = (id: number | undefined) => {
        if (id !== undefined) {
          onSettlerSelectedRef.current(id);
        }
        return id !== undefined;
      };
      const follow = (current: Resident[]) => settlers.sync(current);
      applyResidentsRef.current = follow;
      // the game starts with the settlers' camp in the middle of the board
      place({ q: 0, r: 0 }, "SettlersCamp");
      follow(residentsRef.current);

      // the percentage above the selected construction site
      const labelTexture = new DynamicTexture(
        "progress-label",
        { width: 256, height: 128 },
        scene,
        false,
      );
      labelTexture.hasAlpha = true;
      const labelMaterial = new StandardMaterial("progress-label", scene);
      labelMaterial.diffuseTexture = labelTexture;
      labelMaterial.emissiveColor = Color3.White();
      labelMaterial.disableLighting = true;
      const labelMesh = MeshBuilder.CreatePlane(
        "progress-label",
        { width: 1.2, height: 0.6 },
        scene,
      );
      labelMesh.material = labelMaterial;
      labelMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      labelMesh.isPickable = false;
      labelMesh.setEnabled(false);
      let labelText: string | undefined;
      showProgressRef.current = (progress) => {
        labelText = progress && `${progress.percent}%`;
        labelMesh.setEnabled(progress !== undefined);
        if (progress) {
          const position = hexToPixel(progress.center.q, progress.center.r);
          labelMesh.position.set(position.x, 2, position.z);
          labelTexture.drawText(
            labelText!,
            null,
            90,
            "bold 70px sans-serif",
            "#ffffff",
            "#2e7d32",
          );
        }
      };
      showProgressRef.current(progressRef.current);

      const ring = createRing(scene);
      const preview = createPreview(() => previewTypeRef.current);
      const groundHandler = createPointerHandler(
        scene,
        ring,
        onSelected,
        preview.getRadius,
        preview.isBlocked,
      );
      const pointerObserver: Observer<PointerInfo> =
        scene.onPointerObservable.add((pointerInfo) => {
          // outside the build mode a tap on a figure selects the settler instead
          // of the tile below; the figures are not part of the ground picking
          if (
            !previewTypeRef.current &&
            isPrimaryTap(pointerInfo) &&
            selectSettler(settlers.pick(scene.pointerX, scene.pointerY))
          ) {
            return;
          }
          groundHandler(pointerInfo);
        });
      const hologram = createHologram(
        scene,
        farmsRef.current!,
        woodStorageRef.current!,
      );
      const hologramObserver = scene.onBeforeRenderObservable.add(() =>
        hologram.update(previewTypeRef.current, ring.tile),
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
          sites: sitesRef.current,
          getTreeCount: (coords) => forestRef.current!.getTreeCount(coords),
          getCornerMaterial: (coords, corner) =>
            cornersRef.current!.getMaterialName({ tile: coords, corner }),
          showBuilding: (coords, type) => place(coords, type, false),
          getProgressLabel: () => labelText,
          getRotorMatrix: (coords) =>
            windTurbinesRef.current!.getRotorMatrix(coords) ??
            apartmentRotorsRef.current!.getRotorMatrix(coords),
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
        scene.onBeforeRenderObservable.remove(hologramObserver);
        dispose();
      };
    }, []);

    // runs after the scene exists (effects run in order)
    useEffect(() => {
      settlersRef.current!.select(selectedSettler);
    }, [selectedSettler]);
    useEffect(() => {
      showProgressRef.current(progress);
    }, [progress]);

    return <canvas ref={canvasRef} />;
  },
);
