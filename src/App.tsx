import React, { useRef, useEffect } from "react";
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
} from "@babylonjs/core";
import "@babylonjs/loaders"; // ensures loaders are initialized (if you later import models)

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
    console.log("Komponente")

  useEffect(() => {
    console.log("useEffect")
    if (!canvasRef.current) return;

    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);

    // Camera
    const camera = new ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 30, Vector3.Zero(), scene);
    camera.attachControl(canvasRef.current, true);
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 120;

    // Light
    new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

    // Hex parameters
    const HEX_SIZE = 1; // side length of hex (in scene units)
    const GRID_RADIUS = 6; // how many rings around center

    // helper: axial to pixel (flat-topped hexes)
    function hexToPixel(q: number, r: number): Vector3 {
      const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
      const z = HEX_SIZE * (1.5 * r);
      return new Vector3(x, 0, z);
    }

    // create a material factory to avoid creating many materials
    function makeMaterial(name: string, color: Color3) {
      const m = new StandardMaterial(name, scene);
      m.diffuseColor = color;
      m.specularColor = Color3.Black();
      return m;
    }

    const baseMaterial = makeMaterial("hexBase", new Color3(0.6, 0.8, 0.6));
    const altMaterial = makeMaterial("hexAlt", new Color3(0.5, 0.7, 0.9));
    const highlightMaterial = makeMaterial("hexHighlight", new Color3(1, 0.8, 0.2));

    // store created hex meshes so we can interact with them
    const hexMeshes: Mesh[] = [];

    function createHexTile(q: number, r: number) {
      // build hex polygon corners (flat top)
      const corners: Vector3[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i + 30); // +30 for flat-top orientation
        corners.push(new Vector3(HEX_SIZE * Math.cos(angle), 0, HEX_SIZE * Math.sin(angle)));
      }

      const name = `hex_${q}_${r}`;
      const hex = MeshBuilder.ExtrudePolygon(name, { shape: corners, depth: 0.2 }, scene);
      hex.position = hexToPixel(q, r);

      // assign alternating material for readability
      const useAlt = ((q + r) & 1) === 0;
      hex.material = useAlt ? altMaterial : baseMaterial;

      // store axial coords on the mesh for convenience
      (hex as any).axial = { q, r };

      hexMeshes.push(hex);
      return hex;
    }

    // generate grid (axial coordinates)
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
      for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
        if (Math.abs(q + r) <= GRID_RADIUS) {
          createHexTile(q, r);
        }
      }
    }

    // Picking / Highlight logic
    let selectedMesh: Mesh | null = null;
    let originalMaterial: StandardMaterial | null = null;

    const pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
      // pickInfo is filled when pointer intersects scene geometry
      const pick = (pointerInfo as any).pickInfo;
      if (!pick || !pick.hit) return;

      const picked = pick.pickedMesh as Mesh | null;
      if (!picked || !picked.name?.startsWith("hex_")) return;

      // reset previous
      if (selectedMesh && !selectedMesh.isDisposed()) {
        (selectedMesh as any).material = originalMaterial || (selectedMesh as any).material;
      }

      // set new
      selectedMesh = picked;
      originalMaterial = (picked as any).material as StandardMaterial;
      (picked as any).material = highlightMaterial;

      // for demo: log axial coords
      const axial = (picked as any).axial;
      // eslint-disable-next-line no-console
      console.log("Picked hex:", axial);
    });

    // render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // resize handling
    const handle = () => engine.resize();
    window.addEventListener("resize", handle);

    // cleanup on unmount
    return () => {
      window.removeEventListener("resize", handle);
      scene.onPointerObservable.remove(pointerObserver);
      try {
        scene.dispose();
        engine.dispose();
      } catch (e) {
        // swallow errors during fast HMR / dev shutdown
      }
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
