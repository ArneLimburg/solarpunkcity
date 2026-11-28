import {
  ArcRotateCamera,
  CubeTexture,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import {
  clampCameraTarget,
  MAX_CAMERA_BETA,
  maxCameraBeta,
} from "./cameraLimits";
import { FOREST_FLOOR_COLOR, makeMaterial } from "./TileRenderer";

const SKYBOX_FILES = [
  "skybox/daylight-box-right.png",
  "skybox/daylight-box-top.png",
  "skybox/daylight-box-front.png",
  "skybox/daylight-box-left.png",
  "skybox/daylight-box-bottom.png",
  "skybox/daylight-box-back.png",
];

export function createSkybox(scene: Scene) {
  const skybox = MeshBuilder.CreateBox("skyBox", { size: 200.0 }, scene);

  // Create the skybox material
  const skyboxMaterial = new StandardMaterial("skyBoxMaterial", scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.disableLighting = true;

  // Create a CubeTexture with explicit file list
  const reflectionTexture = CubeTexture.CreateFromImages(SKYBOX_FILES, scene);
  reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;

  skyboxMaterial.reflectionTexture = reflectionTexture;
  skybox.material = skyboxMaterial;
  skybox.isPickable = false;
}

// engine, scene, camera, light, skybox and background ground, render loop and resizing
export function setupScene(canvas: HTMLCanvasElement) {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  createSkybox(scene);

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
  camera.upperRadiusLimit = 90;
  camera.lowerBetaLimit = 0;
  camera.upperBetaLimit = MAX_CAMERA_BETA;
  camera.minZ = 0.1;
  // all layers, also the one of the selection marker that the preview leaves out
  camera.layerMask = 0xffffffff;

  // keep the camera inside the skybox and above the ground: clamp the pan target and beta
  scene.onBeforeRenderObservable.add(() => {
    const maxBeta = maxCameraBeta(camera.radius);
    if (camera.beta > maxBeta) {
      camera.beta = maxBeta;
    }
    const { target, radius } = camera;
    const clamped = clampCameraTarget(target, radius);
    if (
      clamped.x !== target.x ||
      clamped.y !== target.y ||
      clamped.z !== target.z
    ) {
      // keep alpha, beta and radius, so the camera moves with the target
      camera.setTarget(
        new Vector3(clamped.x, clamped.y, clamped.z),
        false,
        false,
        true,
      );
    }
  });

  new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 1000, height: 1000 },
    scene,
  );
  ground.material = makeMaterial("land", FOREST_FLOOR_COLOR, scene);
  ground.isPickable = false;

  engine.runRenderLoop(() => {
    // Cached texture bindings can go stale in the embedded browser.
    engine.resetTextureCache();
    scene.render();
  });

  const resizeObserver = new ResizeObserver(() => engine.resize());
  resizeObserver.observe(canvas);

  const dispose = () => {
    resizeObserver.disconnect();
    try {
      scene.dispose();
      engine.dispose();
    } catch (e) {
      console.error(e);
      // swallow errors during fast HMR / dev shutdown
    }
  };
  return { engine, scene, camera, dispose };
}
