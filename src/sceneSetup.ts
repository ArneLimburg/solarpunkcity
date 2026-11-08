import {
  ArcRotateCamera,
  Color3,
  CubeTexture,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import { makeMaterial } from "./TileRenderer";

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
  camera.upperRadiusLimit = 120;
  camera.lowerBetaLimit = 0;
  camera.upperBetaLimit = 1.5;

  new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 1000, height: 1000 },
    scene,
  );
  ground.material = makeMaterial("hexAlt", new Color3(0.5, 0.7, 0.9), scene);
  ground.isPickable = false;

  engine.runRenderLoop(() => {
    scene.render();
  });

  const resize = () => engine.resize();
  window.addEventListener("resize", resize);

  const dispose = () => {
    window.removeEventListener("resize", resize);
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
