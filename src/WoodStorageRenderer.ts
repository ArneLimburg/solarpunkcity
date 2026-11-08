import {
  Color3,
  Mesh,
  StandardMaterial,
  VertexData,
  type Scene,
} from "@babylonjs/core";
import {
  buildLogGeometry,
  getWoodStorageLogs,
  type LogGeometry,
} from "./woodStorage";

const TILE_TOP = 0.1; // y of the top surface of a hex tile
const BARK_COLOR = new Color3(0.25, 0.15, 0.08);
const END_GRAIN_COLOR = new Color3(0.85, 0.68, 0.45);

export type WoodStorageRenderer = {
  // shows a log yard on the given center tile
  create: (center: { x: number; z: number }) => {
    dispose: () => void;
    triangles: number;
  };
};

function createMesh(
  name: string,
  geometry: LogGeometry,
  color: Color3,
  scene: Scene,
): Mesh {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = geometry.positions;
  data.normals = geometry.normals;
  data.indices = geometry.indices;
  data.applyToMesh(mesh);
  const material = new StandardMaterial(`${name}Material`, scene);
  material.diffuseColor = color;
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.isPickable = false;
  // only the instances are shown
  mesh.isVisible = false;
  return mesh;
}

// Builds the logs once (a bark and an end grain mesh) and shows every log yard
// with instances that share the geometry.
export function createWoodStorageRenderer(
  scene: Scene,
  hexSize: number,
): WoodStorageRenderer {
  const { bark, endGrain } = buildLogGeometry(getWoodStorageLogs(hexSize));
  const meshes = [
    createMesh("WoodStorageBark", bark, BARK_COLOR, scene),
    createMesh("WoodStorageEndGrain", endGrain, END_GRAIN_COLOR, scene),
  ];
  const triangles = (bark.indices.length + endGrain.indices.length) / 3;
  return {
    create: (center) => {
      const instances = meshes.map((mesh) => {
        const instance = mesh.createInstance(`${mesh.name}_instance`);
        instance.position.set(center.x, TILE_TOP, center.z);
        instance.isPickable = false;
        return instance;
      });
      return {
        dispose: () => instances.forEach((instance) => instance.dispose()),
        triangles,
      };
    },
  };
}
