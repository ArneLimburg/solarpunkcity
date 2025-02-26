import { useRef, useEffect, type FC } from "react";
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
import "@babylonjs/loaders"; // ensures loaders are initialized (if you later import models)
import type { HexCoordinates, HexLocation } from "./game";

const HEX_SIZE = 1; // side length of hex (in scene units)
const GRID_RADIUS = 6; // how many rings around center

export const Map: FC<{ onSelected: (coordinates: HexCoordinates) => void }> = ({
  onSelected,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
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
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 120;

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
      new Color3(1, 0.8, 0.2),
      scene,
    );

    // store created hex meshes so we can interact with them
    const hexMeshes: Mesh[] = [];

    /*
    const ground = MeshBuilder.CreateGround(
      "ground",
      {
        width: GRID_RADIUS * HEX_SIZE * 4,
        height: GRID_RADIUS * HEX_SIZE * 4,
      },
      scene,
    );
    ground.material = altMaterial;
    */
    // generate grid (axial coordinates)
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
      for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
        if (Math.abs(q + r) <= GRID_RADIUS) {
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

    // Picking / Highlight logic
    const selectedMesh = createHexTile(0, 0, scene, highlightMaterial);
    selectedMesh.position.y = 0.3;
    selectedMesh.material = highlightMaterial;

    const pointerObserver = scene.onPointerObservable.add(
      createPointerHandler(selectedMesh, onSelected),
    );

    // render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // resize handling
    const handle = () => engine.resize();
    window.addEventListener("resize", handle);

    return createCleanupMethod(engine, scene, pointerObserver, handle);
  }, [canvasRef, onSelected]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};

function createSkybox(scene: Scene) {
  const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);

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
  hex.position.y = 0.2;
  hex.material = material;

  // store axial coords on the mesh
  (hex as unknown as HexLocation).coordinates = { q, r };

  return hex;
}

function createPointerHandler(
  selectedMesh: Mesh,
  onSelected: (coordinates: HexCoordinates) => void,
): (pointerInfo: PointerInfo) => void {
  return (pointerInfo: PointerInfo) => {
    const pick = pointerInfo.pickInfo;
    if (!pick || !pick.hit) {
      return;
    }

    const picked = pick.pickedMesh as Mesh | null;
    if (!picked || !picked.name?.startsWith("hex_")) {
      // something else picked
      return;
    }

    selectedMesh.position.x = picked.position.x;
    selectedMesh.position.z = picked.position.z;

    const coordinates = (picked as unknown as HexLocation).coordinates;
    onSelected(coordinates);
  };
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
      // swallow errors during fast HMR / dev shutdown
    }
  };
}
