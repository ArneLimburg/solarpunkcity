import {
  Color3,
  Matrix,
  MeshBuilder,
  Quaternion,
  Vector3,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { HexCoordinates } from "./board";
import {
  createCornerPiece,
  getCornerRotation,
  getTileCorners,
  getVertexCorners,
  getVertexFill,
  type TileCorner,
} from "./hexCorners";
import { HEX_SIZE, TILE_TOP, hexToPixel, tileKey } from "./hexGeometry";
import { makeMaterial, type GroundMaterials } from "./TileRenderer";

const MIXED_COLOR = new Color3(0.25, 0.2, 0.15);
const MIXED = "cornerMixed";

export type CornerRenderer = {
  // re-evaluates all vertices of the given tiles
  update: (tiles: HexCoordinates[]) => void;
  // name of the material that fills the vertex of a tile corner
  getMaterialName: (corner: TileCorner) => string | undefined;
};

const pieceKey = ({ tile, corner }: TileCorner) => `${tileKey(tile)}:${corner}`;

// Fills the gaps that the rounded corners of the hex tiles leave: one base mesh per material,
// the pieces are thin instances of it.
export function createCornerRenderer(
  scene: Scene,
  materials: GroundMaterials,
  tiles: HexCoordinates[],
  getGround: (coords: HexCoordinates) => string,
): CornerRenderer {
  const shape = createCornerPiece(HEX_SIZE).map(
    (point) => new Vector3(point.x, 0, point.z),
  );
  const meshes: Record<string, Mesh> = {};
  for (const material of [
    ...Object.values(materials),
    makeMaterial(MIXED, MIXED_COLOR, scene),
  ]) {
    const mesh = MeshBuilder.ExtrudePolygon(
      `corner_${material.name}`,
      { shape, depth: 0.2 },
      scene,
    );
    mesh.material = material;
    mesh.isPickable = false;
    meshes[material.name] = mesh;
  }

  // the matrix of every piece, and the material that currently fills it
  const matrices: Record<string, number[]> = {};
  const fills: Record<string, string | undefined> = {};
  for (const tile of tiles) {
    const center = hexToPixel(tile.q, tile.r);
    for (const corner of getTileCorners(tile)) {
      matrices[pieceKey(corner)] = Matrix.Compose(
        Vector3.One(),
        Quaternion.RotationAxis(Vector3.Up(), getCornerRotation(corner.corner)),
        new Vector3(center.x, TILE_TOP, center.z),
      ).asArray() as number[];
    }
  }

  const evaluate = (corner: TileCorner) =>
    getVertexFill(
      getVertexCorners(corner).map((shared) => getGround(shared.tile)),
      MIXED,
    );

  const refresh = () => {
    for (const [name, mesh] of Object.entries(meshes)) {
      const buffer: number[] = [];
      for (const [key, fill] of Object.entries(fills)) {
        if (fill === name) buffer.push(...matrices[key]);
      }
      // without instances the buffer is removed, there are no bounds to compute
      mesh.thinInstanceSetBuffer(
        "matrix",
        buffer.length > 0 ? new Float32Array(buffer) : null,
        16,
        false,
      );
      if (buffer.length > 0) mesh.thinInstanceRefreshBoundingInfo(true);
    }
  };

  for (const tile of tiles) {
    for (const corner of getTileCorners(tile)) {
      fills[pieceKey(corner)] = evaluate(corner);
    }
  }
  refresh();

  return {
    update: (changed) => {
      for (const tile of changed) {
        for (const corner of getTileCorners(tile)) {
          for (const shared of getVertexCorners(corner)) {
            fills[pieceKey(shared)] = evaluate(shared);
          }
        }
      }
      refresh();
    },
    getMaterialName: (corner) => fills[pieceKey(corner)],
  };
}
