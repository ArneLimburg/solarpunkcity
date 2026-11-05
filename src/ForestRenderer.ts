import {
  Color3,
  Matrix,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { HexCoordinates } from "./board";
import { getTreePlacements, type TreeKind } from "./forest";

const TILE_TOP = 0.2; // y of the top surface of a hex tile
const TRUNK_HEIGHT = 0.3;
const HIDDEN = Matrix.Compose(
  Vector3.Zero(),
  Quaternion.Identity(),
  Vector3.Zero(),
);
const TRUNK_COLOR = new Color3(0.4, 0.26, 0.13);
const CONIFER_COLOR = new Color3(0.1, 0.4, 0.2);
const DECIDUOUS_COLOR = new Color3(0.45, 0.75, 0.3);

type Center = { x: number; z: number };

// one thin instance of a base mesh (index into its matrix buffer)
type Instance = { mesh: Mesh; index: number };

// the matrix buffers of a base mesh, 16 floats per instance
type Buffer = { mesh: Mesh; matrices: number[] };

export type ForestRenderer = {
  // hides all trees of a tile for good
  clearTile: (coords: HexCoordinates) => void;
  // number of visible trees of a tile
  getTreeCount: (coords: HexCoordinates) => number;
};

function makeMaterial(name: string, color: Color3, scene: Scene) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = Color3.Black();
  return material;
}

function createBaseMesh(mesh: Mesh, color: Color3, scene: Scene): Buffer {
  mesh.material = makeMaterial(`${mesh.name}Material`, color, scene);
  mesh.isPickable = false;
  return { mesh, matrices: [] };
}

// Draws a forest of 5 trees on each given tile with exactly 3 base meshes
// (trunk, cone crown, sphere crown) that use thin instances.
export function createForest(
  scene: Scene,
  tiles: HexCoordinates[],
  hexSize: number,
  getCenter: (coords: HexCoordinates) => Center,
): ForestRenderer {
  const trunk = createBaseMesh(
    MeshBuilder.CreateCylinder(
      "treeTrunk",
      { height: TRUNK_HEIGHT, diameter: 0.1, tessellation: 6 },
      scene,
    ),
    TRUNK_COLOR,
    scene,
  );
  const crowns: Record<TreeKind, Buffer & { height: number }> = {
    conifer: {
      ...createBaseMesh(
        MeshBuilder.CreateCylinder(
          "treeConifer",
          { height: 0.5, diameterTop: 0, diameterBottom: 0.4, tessellation: 6 },
          scene,
        ),
        CONIFER_COLOR,
        scene,
      ),
      height: 0.5,
    },
    deciduous: {
      ...createBaseMesh(
        MeshBuilder.CreateIcoSphere(
          "treeDeciduous",
          { radius: 0.22, subdivisions: 1, flat: true },
          scene,
        ),
        DECIDUOUS_COLOR,
        scene,
      ),
      height: 0.44,
    },
  };

  const trees: Record<string, Instance[]> = {};
  const visible: Record<string, number> = {};
  const key = (coords: HexCoordinates) => `${coords.q},${coords.r}`;

  const addInstance = (
    buffer: Buffer,
    tile: string,
    center: Center,
    offset: number, // height of the mesh center above the tile top
    placement: { x: number; z: number; rotation: number; scale: number },
  ) => {
    const matrix = Matrix.Compose(
      new Vector3(placement.scale, placement.scale, placement.scale),
      Quaternion.RotationAxis(Vector3.Up(), placement.rotation),
      new Vector3(
        center.x + placement.x,
        TILE_TOP + offset * placement.scale,
        center.z + placement.z,
      ),
    );
    trees[tile].push({ mesh: buffer.mesh, index: buffer.matrices.length / 16 });
    buffer.matrices.push(...matrix.asArray());
  };

  for (const coords of tiles) {
    const tile = key(coords);
    trees[tile] = [];
    const center = getCenter(coords);
    for (const placement of getTreePlacements(coords, hexSize)) {
      const crown = crowns[placement.kind];
      addInstance(trunk, tile, center, TRUNK_HEIGHT / 2, placement);
      addInstance(
        crown,
        tile,
        center,
        TRUNK_HEIGHT + crown.height / 2,
        placement,
      );
    }
    visible[tile] = trees[tile].length / 2;
  }

  const buffers = [trunk, crowns.conifer, crowns.deciduous];
  for (const { mesh, matrices } of buffers) {
    mesh.thinInstanceSetBuffer("matrix", new Float32Array(matrices), 16, false);
    mesh.thinInstanceRefreshBoundingInfo(true);
  }

  return {
    clearTile: (coords) => {
      const tile = key(coords);
      const touched = new Set<Mesh>();
      for (const { mesh, index } of trees[tile] ?? []) {
        // a matrix scaled to 0 is invisible
        mesh.thinInstanceSetMatrixAt(index, HIDDEN, false);
        touched.add(mesh);
      }
      trees[tile] = [];
      visible[tile] = 0;
      touched.forEach((mesh) => mesh.thinInstanceBufferUpdated("matrix"));
    },
    getTreeCount: (coords) => visible[key(coords)] ?? 0,
  };
}
