import {
  Color3,
  Mesh,
  StandardMaterial,
  VertexData,
  type Scene,
} from "@babylonjs/core";
import { GRID_RADIUS, getRiverCourse } from "./board";
import { createMountainData } from "./mountains";

export type MountainRenderer = {
  getStats: () => {
    meshes: number; // meshes named "mountains" in the scene
    triangles: number;
    pickable: boolean;
    inView: boolean; // inside the frustum of the active camera
  };
};

// Builds the mountains beyond the mountain edge once: one mesh, one material, not pickable.
export function createMountainRenderer(scene: Scene): MountainRenderer {
  const { positions, normals, colors, indices } = createMountainData(
    GRID_RADIUS,
    getRiverCourse(GRID_RADIUS),
  );
  const mesh = new Mesh("mountains", scene);
  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.colors = colors;
  data.indices = indices;
  data.applyToMesh(mesh);
  const material = new StandardMaterial("mountainsMaterial", scene);
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.isPickable = false;
  return {
    getStats: () => ({
      meshes: scene.meshes.filter((other) => other.name === "mountains").length,
      triangles: indices.length / 3,
      pickable: mesh.isPickable,
      inView: scene.activeCamera!.isInFrustum(mesh),
    }),
  };
}
