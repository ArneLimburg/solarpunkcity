import {
  Color3,
  Mesh,
  StandardMaterial,
  VertexData,
  type Scene,
} from "@babylonjs/core";
import { GRID_RADIUS, getRiverCourse } from "./board";
import {
  BEACH_Y,
  SEA_Y,
  getBeachPolygons,
  SEA_CENTER,
  SEA_RADIUS,
  getMouthChannel,
  getSeaRings,
  type Polygon,
} from "./sea";
import { WATER_COLOR } from "./TileRenderer";

const SAND_COLOR = new Color3(0.93, 0.87, 0.68);
const DEEP_COLOR = new Color3(0.02, 0.15, 0.45);

export type SeaRenderer = {
  // the two meshes: sea (with the river mouth) and beach
  meshes: Mesh[];
  setVisible: (visible: boolean) => void;
};

// builds one mesh from convex polygons at the given height; each polygon is a triangle fan
function createMesh(
  name: string,
  polygons: {
    points: Polygon;
    y: number;
    color?: (x: number, z: number) => [number, number, number];
  }[],
  material: StandardMaterial,
  scene: Scene,
): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (const { points, y, color } of polygons) {
    const first = positions.length / 3;
    for (const { x, z } of points) {
      positions.push(x, y, z);
      normals.push(0, 1, 0);
      if (color) colors.push(...color(x, z), 1);
    }
    for (let i = 1; i < points.length - 1; i++) {
      indices.push(first, first + i, first + i + 1);
    }
  }
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.indices = indices;
  if (colors.length > 0) data.colors = colors;
  data.applyToMesh(mesh);
  mesh.material = material;
  mesh.isPickable = false;
  return mesh;
}

// The sea beyond the sea edge of the board, its beach and the river mouth: pure scenery,
// two meshes (two draw calls), created once.
export function createSeaRenderer(scene: Scene): SeaRenderer {
  const course = getRiverCourse(GRID_RADIUS);
  const river: [number, number, number] = [
    WATER_COLOR.r,
    WATER_COLOR.g,
    WATER_COLOR.b,
  ];
  const deep: [number, number, number] = [
    DEEP_COLOR.r,
    DEEP_COLOR.g,
    DEEP_COLOR.b,
  ];
  // turquoise at the round shore, deep blue at the centre of the semicircle
  const gradient = (x: number, z: number) => {
    const t = Math.min(
      Math.hypot(x - SEA_CENTER.x, z - SEA_CENTER.z) / SEA_RADIUS,
      1,
    );
    return river.map((c, i) => c + (deep[i] - c) * (1 - t)) as [
      number,
      number,
      number,
    ];
  };
  const plain = () => river;

  const water = new StandardMaterial("seaMaterial", scene);
  water.specularColor = new Color3(0.25, 0.25, 0.25); // slight highlight
  water.backFaceCulling = false;
  const sand = new StandardMaterial("beachMaterial", scene);
  sand.diffuseColor = SAND_COLOR;
  sand.specularColor = Color3.Black();
  sand.backFaceCulling = false;

  const sea = createMesh(
    "sea",
    [
      ...getSeaRings().map((points) => ({ points, y: SEA_Y, color: gradient })),
      ...getMouthChannel(GRID_RADIUS, course).map((points) => ({
        points,
        y: SEA_Y,
        color: plain,
      })),
    ],
    water,
    scene,
  );
  const beach = createMesh(
    "beach",
    getBeachPolygons(GRID_RADIUS, course).map((points) => ({
      points,
      y: BEACH_Y,
    })),
    sand,
    scene,
  );
  const meshes = [sea, beach];
  return {
    meshes,
    setVisible: (visible) =>
      meshes.forEach((mesh) => (mesh.isVisible = visible)),
  };
}
