import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  PointerInfo,
  PointerEventTypes,
  Matrix,
  Observer,
  CubeTexture,
  Texture,
} from "@babylonjs/core";
import {
  GRID_RADIUS,
  getBuilding,
  getFootprint,
  getFootprintRadius,
  isOnBoard,
  type HexCoordinates,
} from "./board";
import { grantResources } from "./game";
import {
  BuildingDefinition,
  BuildingTypes,
  type BuildingType,
} from "./gameDefinitions";
import {
  createFarmRenderer,
  isModelType,
  type FarmRenderer,
} from "./FarmRenderer";
import { createForest, type ForestRenderer } from "./ForestRenderer";

const HEX_SIZE = 1; // side length of hex (in scene units)

const FARMLAND_COLOR = new Color3(0.55, 0.45, 0.3);

// the model shown on a tile
type PlacedModel = { dispose: () => void; triangles: number };

const tileKey = (coords: HexCoordinates) => `${coords.q},${coords.r}`;

export const Map = forwardRef<
  { addBuilding: (coords: HexCoordinates, type: BuildingType) => void },
  {
    onSelected: (coordinates: HexCoordinates) => void;
    // footprint radius of the selected building type, 0 without selection
    previewRadius: number;
  }
>(({ onSelected, previewRadius }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  // the model currently shown on a tile ("q,r")
  const modelsRef = useRef<Record<string, PlacedModel>>({});
  const forestRef = useRef<ForestRenderer | null>(null);
  const farmsRef = useRef<FarmRenderer | null>(null);

  // hex meshes per tile ("q,r") and the farmland material
  const tileMeshesRef = useRef<Record<string, Mesh>>({});
  const farmlandRef = useRef<StandardMaterial | null>(null);
  // mirrors the prop so that the stable pointer handler can read it
  const previewRadiusRef = useRef(previewRadius);
  previewRadiusRef.current = previewRadius;

  useImperativeHandle(ref, () => ({
    addBuilding: (coords: HexCoordinates, type: BuildingType) => {
      const radius = getFootprintRadius(BuildingDefinition[type].size);
      // the building replaces trees and previous models on its whole footprint
      for (const tile of getFootprint(coords, radius)) {
        forestRef.current!.clearTile(tile);
        modelsRef.current[tileKey(tile)]?.dispose();
        delete modelsRef.current[tileKey(tile)];
      }
      const position = hexToPixel(coords.q, coords.r);
      const farmland =
        BuildingTypes[type].category === "FARM"
          ? getFootprint(coords, radius)
          : [];
      for (const tile of farmland) {
        tileMeshesRef.current[tileKey(tile)].material = farmlandRef.current;
      }
      if (isModelType(type)) {
        // models are built from code at scale 1
        modelsRef.current[tileKey(coords)] = farmsRef.current!.create(
          type,
          position,
        );
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    engineRef.current = engine;
    sceneRef.current = scene;
    //scene.clearColor = new Color4(0.4, 0.8, 0.5);
    createSkybox(scene);

    // Camera
    const camera = new ArcRotateCamera(
      "camera",
      Math.PI / 4,
      Math.PI / 3,
      30,
      Vector3.Zero(),
      scene,
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 120;
    camera.lowerBetaLimit = 0;
    camera.upperBetaLimit = 1.5;

    // Light
    new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

    const baseMaterial = makeMaterial(
      "hexBase",
      new Color3(0.6, 0.8, 0.6),
      scene,
    );
    const altMaterial = makeMaterial(
      "hexAlt",
      new Color3(0.5, 0.7, 0.9),
      scene,
    );
    farmlandRef.current = makeMaterial("farmland", FARMLAND_COLOR, scene);
    const highlightMaterial = makeMaterial(
      "hexHighlight",
      Color3.Black(),
      scene,
    );
    highlightMaterial.alpha = 0.1;

    // store created hex meshes so we can interact with them
    const hexMeshes: Mesh[] = [];
    const hexTiles: HexCoordinates[] = [];

    const ground = MeshBuilder.CreateGround(
      "ground",
      {
        width: 1000,
        height: 1000,
      },
      scene,
    );
    ground.material = altMaterial;
    // generate grid (axial coordinates)
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
      for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
        if (isOnBoard({ q, r })) {
          const useAlt = ((q + r) & 1) === 0;

          const hex = createHexTile(
            q,
            r,
            scene,
            useAlt ? altMaterial : baseMaterial,
          );
          hexMeshes.push(hex);
          hexTiles.push({ q, r });
          tileMeshesRef.current[tileKey({ q, r })] = hex;
        }
      }
    }
    forestRef.current = createForest(
      scene,
      hexTiles.filter((tile) => getBuilding(tile)?.type === "Forest"),
      HEX_SIZE,
      (tile) => hexToPixel(tile.q, tile.r),
    );
    farmsRef.current = createFarmRenderer(scene, HEX_SIZE);
    console.log("fields: " + hexMeshes.length);

    // Picking / Highlight logic
    const selectedMesh = MeshBuilder.CreateTorus(
      "ring",
      { thickness: 0.1, diameter: 2, tessellation: 64 },
      scene,
    );
    selectedMesh.position.y = 0.01;
    selectedMesh.material = highlightMaterial;
    selectedMesh.isPickable = false;
    const ring = createRing(selectedMesh);

    const pointerObserver = scene.onPointerObservable.add(
      createPointerHandler(
        scene,
        ring,
        onSelected,
        () => previewRadiusRef.current,
      ),
    );
    const hideOnLeave = (event: PointerEvent) => {
      // a touch pointer always leaves the canvas after the finger is lifted
      if (event.pointerType !== "touch") {
        ring.hide();
      }
    };
    canvas.addEventListener("pointerleave", hideOnLeave);

    if (import.meta.env.DEV) {
      window.__solarpunk = {
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
        getRingTile: () => ring.tile,
        getRingTiles: () => [...ring.tiles],
        getTileMaterial: (coords) =>
          tileMeshesRef.current[tileKey(coords)].material!.name,
        getModelCount: (coords) => (modelsRef.current[tileKey(coords)] ? 1 : 0),
        getModelTriangleCount: (coords) =>
          modelsRef.current[tileKey(coords)]?.triangles ?? 0,
        getTreeCount: (coords) => forestRef.current!.getTreeCount(coords),
        addResources: grantResources,
      };
    }

    // render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // resize handling
    const handle = () => engine.resize();
    window.addEventListener("resize", handle);

    const cleanup = createCleanupMethod(engine, scene, pointerObserver, handle);
    return () => {
      canvas.removeEventListener("pointerleave", hideOnLeave);
      delete window.__solarpunk;
      cleanup();
    };
  }, []);

  return <canvas ref={canvasRef} />;
});

function createSkybox(scene: Scene) {
  const skybox = MeshBuilder.CreateBox("skyBox", { size: 200.0 }, scene);

  // Create the skybox material
  const skyboxMaterial = new StandardMaterial("skyBoxMaterial", scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.disableLighting = true;

  // Create a CubeTexture with explicit file list
  const files = [
    "skybox/daylight-box-right.png",
    "skybox/daylight-box-top.png",
    "skybox/daylight-box-front.png",
    "skybox/daylight-box-left.png",
    "skybox/daylight-box-bottom.png",
    "skybox/daylight-box-back.png",
  ];

  const reflectionTexture = CubeTexture.CreateFromImages(files, scene);
  reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;

  skyboxMaterial.reflectionTexture = reflectionTexture;
  skybox.material = skyboxMaterial;
}

function makeMaterial(name: string, color: Color3, scene: Scene) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = Color3.Black();
  return m;
}

function createHexTile(
  q: number,
  r: number,
  scene: Scene,
  material: StandardMaterial,
) {
  // build hex polygon corners (flat top)
  const corners: Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + 30); // +30 for flat-top orientation
    corners.push(
      new Vector3(HEX_SIZE * Math.cos(angle), 0, HEX_SIZE * Math.sin(angle)),
    );
  }

  const name = `hex_${q}_${r}`;
  const hex = MeshBuilder.ExtrudePolygon(
    name,
    { shape: corners, depth: 0.2 },
    scene,
  );
  hex.position = hexToPixel(q, r);
  hex.position.y = 0.1;
  hex.material = material;

  return hex;
}

type Ring = {
  tile: HexCoordinates | null; // the hovered center tile
  tiles: HexCoordinates[]; // all tiles with a ring (footprint on the board)
  show: (coordinates: HexCoordinates, radius: number) => void;
  hide: () => void;
};

function createRing(mesh: Mesh): Ring {
  mesh.setEnabled(false);
  const meshes = [mesh]; // one ring mesh per footprint tile, created on demand
  const ring: Ring = {
    tile: null,
    tiles: [],
    show: (coordinates, radius) => {
      const tiles = getFootprint(coordinates, radius).filter(isOnBoard);
      while (meshes.length < tiles.length) {
        meshes.push(mesh.clone(`ring_${meshes.length}`));
      }
      meshes.forEach((ringMesh, i) => ringMesh.setEnabled(i < tiles.length));
      tiles.forEach((tile, i) => {
        const center = hexToPixel(tile.q, tile.r);
        meshes[i].position.set(center.x, 0.1, center.z);
      });
      ring.tiles = tiles;
      ring.tile = { q: coordinates.q, r: coordinates.r };
    },
    hide: () => {
      meshes.forEach((ringMesh) => ringMesh.setEnabled(false));
      ring.tiles = [];
      ring.tile = null;
    },
  };
  return ring;
}

function createPointerHandler(
  scene: Scene,
  ring: Ring,
  onSelected: (coordinates: HexCoordinates) => void,
  getRadius: () => number,
): (pointerInfo: PointerInfo) => void {
  return (pointerInfo: PointerInfo) => {
    // Babylon sends a second tap within DoubleClickDelay only as POINTERDOUBLETAP
    const type =
      pointerInfo.type === PointerEventTypes.POINTERDOUBLETAP
        ? PointerEventTypes.POINTERTAP
        : pointerInfo.type;
    if (
      type !== PointerEventTypes.POINTERMOVE &&
      type !== PointerEventTypes.POINTERTAP
    ) {
      return;
    }
    const event = pointerInfo.event as PointerEvent;
    const isTouch = event.pointerType === "touch";
    if (type === PointerEventTypes.POINTERMOVE && isTouch) {
      return; // touch only moves the ring by tapping
    }
    if (type === PointerEventTypes.POINTERTAP && event.button !== 0) {
      return;
    }

    // Babylon does not pick on pointer move, so pick explicitly
    const pick =
      type === PointerEventTypes.POINTERMOVE
        ? scene.pick(scene.pointerX, scene.pointerY)
        : pointerInfo.pickInfo;
    const coordinates =
      pick && pick.hit && pick.pickedPoint
        ? pixelToHex(pick.pickedPoint)
        : undefined;
    if (!coordinates || !isOnBoard(coordinates)) {
      ring.hide();
      return;
    }

    if (type === PointerEventTypes.POINTERMOVE) {
      ring.show(coordinates, getRadius());
      return;
    }

    const ringIsHere =
      ring.tile?.q === coordinates.q && ring.tile?.r === coordinates.r;
    ring.show(coordinates, getRadius());
    if (!isTouch || ringIsHere) {
      onSelected(coordinates);
    }
  };
}

function pixelToHex(position: Vector3) {
  const qf =
    ((Math.sqrt(3) / 3) * position.x - (1 / 3) * position.z) / HEX_SIZE;
  const rf = ((2 / 3) * position.z) / HEX_SIZE;

  // cube coords
  const xCube = qf;
  const zCube = rf;
  const yCube = -xCube - zCube;

  // round to nearest cube
  let rx = Math.round(xCube);
  let ry = Math.round(yCube);
  let rz = Math.round(zCube);

  const dx = Math.abs(rx - xCube);
  const dy = Math.abs(ry - yCube);
  const dz = Math.abs(rz - zCube);

  if (dx > dy && dx > dz) {
    rx = -ry - rz;
  } else if (dy > dz) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

function hexToPixel(q: number, r: number): Vector3 {
  const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const z = HEX_SIZE * (1.5 * r);
  return new Vector3(x, 0, z);
}

function createCleanupMethod(
  engine: Engine,
  scene: Scene,
  pointerObserver: Observer<PointerInfo>,
  resizeListener: () => void,
) {
  return () => {
    window.removeEventListener("resize", resizeListener);
    scene.onPointerObservable.remove(pointerObserver);
    try {
      scene.dispose();
      engine.dispose();
    } catch (e) {
      console.error(e);
      // swallow errors during fast HMR / dev shutdown
    }
  };
}
