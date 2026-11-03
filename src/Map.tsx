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
import "@babylonjs/loaders"; // ensures loaders are initialized (if you later import models)
import {
  GRID_RADIUS,
  getBuilding,
  isOnBoard,
  type HexCoordinates,
} from "./board";
import { grantResources } from "./game";
import type { Model } from "./gameDefinitions";
import { loadCachedModel, preloadModels } from "./ModelLoader";

const HEX_SIZE = 1; // side length of hex (in scene units)

export const Map = forwardRef<
  { addBuilding: (coords: HexCoordinates, model: Model) => void },
  { onSelected: (coordinates: HexCoordinates) => void }
>(({ onSelected }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  // number of placed building models per tile ("q,r"), used by the e2e tests
  const modelCountsRef = useRef<Record<string, number>>({});

  useImperativeHandle(ref, () => ({
    addBuilding: (coords: HexCoordinates, model: Model) => {
      if (sceneRef.current) {
        const position = hexToPixel(coords.q, coords.r);
        position.y += 0.1;
        loadModel(model, sceneRef.current, position).then(() => {
          const key = `${coords.q},${coords.r}`;
          const counts = modelCountsRef.current;
          counts[key] = (counts[key] ?? 0) + 1;
        });
      }
    },
  }));

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
    engineRef.current = engine;
    sceneRef.current = scene;
    preloadModels(scene);
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
    camera.attachControl(canvasRef.current, true);
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
    const highlightMaterial = makeMaterial(
      "hexHighlight",
      Color3.Black(),
      scene,
    );
    highlightMaterial.alpha = 0.1;

    // store created hex meshes so we can interact with them
    const hexMeshes: Mesh[] = [];

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
        }
      }
    }
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
      createPointerHandler(scene, ring, onSelected),
    );
    const canvas = canvasRef.current;
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
        getModelCount: (coords) =>
          modelCountsRef.current[`${coords.q},${coords.r}`] ?? 0,
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
      if (import.meta.env.DEV) {
        delete window.__solarpunk;
      }
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

async function loadModel(model: Model, scene: Scene, position: Vector3) {
  const instance = await loadCachedModel(model, scene, position);
  return instance;
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
  tile: HexCoordinates | null;
  show: (coordinates: HexCoordinates) => void;
  hide: () => void;
};

function createRing(mesh: Mesh): Ring {
  mesh.setEnabled(false);
  const ring: Ring = {
    tile: null,
    show: (coordinates) => {
      const center = hexToPixel(coordinates.q, coordinates.r);
      mesh.position.set(center.x, 0.1, center.z);
      mesh.setEnabled(true);
      ring.tile = { q: coordinates.q, r: coordinates.r };
    },
    hide: () => {
      mesh.setEnabled(false);
      ring.tile = null;
    },
  };
  return ring;
}

function createPointerHandler(
  scene: Scene,
  ring: Ring,
  onSelected: (coordinates: HexCoordinates) => void,
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
      ring.show(coordinates);
      return;
    }

    const ringIsHere =
      ring.tile?.q === coordinates.q && ring.tile?.r === coordinates.r;
    ring.show(coordinates);
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
