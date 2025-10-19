import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useState,
  type ForwardedRef,
  type RefObject,
} from "react";
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
  Observer,
  CubeTexture,
  Texture,
} from "@babylonjs/core";
import "@babylonjs/loaders"; // Basisloader
import { type HexCoordinates } from "../board";
import type { Model } from "../gameDefinitions";
import { loadCachedModel, preloadModels } from "./ModelLoader";

const HEX_SIZE = 1;

export const Map = forwardRef<
  { addBuilding: (coords: HexCoordinates, model: Model) => void },
  {
    onPreloadingFinished: () => void;
    onSelected: (coordinates: HexCoordinates) => void;
  }
>(({ onPreloadingFinished, onSelected }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [preloading, setPreloading] = useState(true);

  useAddBuilding(ref, sceneRef);
  usePreloadModules(
    canvasRef,
    engineRef,
    sceneRef,
    setPreloading,
    onPreloadingFinished,
  );

  useEffect(() => {
    if (engineRef.current && sceneRef.current && !preloading) {
      console.log("Preloading finished, initializing scene");
      const engine = engineRef.current;
      const scene = sceneRef.current;

      createSkybox(scene);

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

      new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

      const ground = MeshBuilder.CreateGround(
        "ground",
        { width: 1000, height: 1000 },
        scene,
      );
      const groundMaterial = new StandardMaterial("groundMat", scene);
      const grassTexture = new Texture("textures/grass.png", scene);
      grassTexture.uScale = 200;
      grassTexture.vScale = 200;
      groundMaterial.diffuseTexture = grassTexture;
      groundMaterial.opacityTexture = new Texture(
        "textures/transparent-circle.png",
        scene,
      );
      groundMaterial.backFaceCulling = false;
      ground.material = groundMaterial;

      const highlightMaterial = makeMaterial(
        "highlightRing",
        Color3.Black(),
        scene,
      );
      const selectedMesh = MeshBuilder.CreateTorus(
        "ring",
        { thickness: 0.1, diameter: 2, tessellation: 64 },
        scene,
      );
      selectedMesh.position.y = 0.01;
      selectedMesh.material = highlightMaterial;

      const pointerObserver = scene.onPointerObservable.add(
        createPointerHandler(selectedMesh, onSelected),
      );

      engine.runRenderLoop(() => {
        if (!scene.isDisposed()) scene.render();
      });

      const handle = () => engine.resize();
      window.addEventListener("resize", handle);

      return createCleanupMethod(engine, scene, pointerObserver, handle);
    }
  }, [preloading, onSelected]);

  return <canvas ref={canvasRef} />;
});

/**
 * Initialisiert Engine & Scene, wartet explizit auf Babylon Loader & Engine-Readiness.
 */
function usePreloadModules(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  engineRef: RefObject<Engine | null>,
  sceneRef: RefObject<Scene | null>,
  setPreloading: (preloading: boolean) => void,
  onPreloadingFinished: () => void,
) {
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
    engineRef.current = engine;
    sceneRef.current = scene;

    (async () => {
      console.log("Preloading Babylon loaders and models...");

      // ✅ Sicherstellen, dass glTF-Loader vollständig geladen ist
      await import("@babylonjs/loaders/glTF");

      // ✅ Warten, bis Engine intern fertig ist
      await scene.whenReadyAsync();

      // ✅ Modelle vorladen
      await preloadModels(scene);

      console.log("Preloading complete.");
      setPreloading(false);
      onPreloadingFinished();
    })();

    return () => {
      try {
        engine.stopRenderLoop();
        scene.dispose();
        engine.dispose();
      } catch {}
    };
  }, []);
}

/**
 * Externe Methode für parent-Komponenten, um Gebäude hinzuzufügen.
 */
function useAddBuilding(
  ref: ForwardedRef<{
    addBuilding: (coords: HexCoordinates, model: Model) => void;
  }>,
  sceneRef: RefObject<Scene | null>,
) {
  useImperativeHandle(ref, () => ({
    addBuilding: async (coords: HexCoordinates, model: Model) => {
      if (!sceneRef.current) {
        console.error("No scene available to add building.");
        return;
      }

      const position = hexToPixel(coords.q, coords.r);
      position.y += 0.1;

      // ✅ Absichern, dass Loader vor Modell-Import geladen ist
      await import("@babylonjs/loaders/glTF");

      await loadModel(model, sceneRef.current, position);
    },
  }));
}

function createSkybox(scene: Scene) {
  const skybox = MeshBuilder.CreateBox("skyBox", { size: 200.0 }, scene);
  const skyboxMaterial = new StandardMaterial("skyBoxMaterial", scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.disableLighting = true;

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
  // ✅ Falls ModelLoader intern auf SceneLoader basiert, ist hier alles ready
  const instance = await loadCachedModel(model, scene, position);
  return instance;
}

function createPointerHandler(
  selectedMesh: Mesh,
  onSelected: (coordinates: HexCoordinates) => void,
): (pointerInfo: PointerInfo) => void {
  return (pointerInfo: PointerInfo) => {
    const pick = pointerInfo.pickInfo;
    if (!pick?.hit || !pick.pickedPoint) return;

    const coordinates = pixelToHex(pick.pickedPoint);
    const center = hexToPixel(coordinates.q, coordinates.r);

    selectedMesh.position.set(center.x, 0.1, center.z);
    onSelected(coordinates);
  };
}

function pixelToHex(position: Vector3) {
  const qf =
    ((Math.sqrt(3) / 3) * position.x - (1 / 3) * position.z) / HEX_SIZE;
  const rf = ((2 / 3) * position.z) / HEX_SIZE;

  const xCube = qf;
  const zCube = rf;
  const yCube = -xCube - zCube;

  let rx = Math.round(xCube);
  let ry = Math.round(yCube);
  let rz = Math.round(zCube);

  const dx = Math.abs(rx - xCube);
  const dy = Math.abs(ry - yCube);
  const dz = Math.abs(rz - zCube);

  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;

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
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  };
}
