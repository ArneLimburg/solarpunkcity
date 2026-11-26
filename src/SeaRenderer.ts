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
  getCoastZ,
  getMouthChannel,
  getOuterZ,
  getSeaPolygon,
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
  polygons: { points: Polygon; y: number }[],
  colorAt: ((z: number) => [number, number, number]) | undefined,
  material: StandardMaterial,
  scene: Scene,
): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (const { points, y } of polygons) {
    const first = positions.length / 3;
    for (const { x, z } of points) {
      positions.push(x, y, z);
      normals.push(0, 1, 0);
      if (colorAt) colors.push(...colorAt(z), 1);
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
  if (colorAt) data.colors = colors;
  data.applyToMesh(mesh);
  mesh.material = material;
  mesh.isPickable = false;
  return mesh;
}

// The sea beyond the sea edge of the board, its beach and the river mouth: pure scenery,
// two meshes (two draw calls), created once.
export function createSeaRenderer(scene: Scene): SeaRenderer {
  const course = getRiverCourse(GRID_RADIUS);
  const coast = getCoastZ(GRID_RADIUS);
  const outer = getOuterZ(GRID_RADIUS);
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
  // turquoise at the coast, deep blue at the outer end
  const gradient = (z: number) => {
    const t = Math.min(Math.max((z - coast) / (outer - coast), 0), 1);
    return river.map((c, i) => c + (deep[i] - c) * t) as [
      number,
      number,
      number,
    ];
  };

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
      { points: getSeaPolygon(GRID_RADIUS), y: SEA_Y },
      { points: getMouthChannel(GRID_RADIUS, course), y: SEA_Y },
    ],
    gradient,
    water,
    scene,
  );
  const beach = createMesh(
    "beach",
    getBeachPolygons(GRID_RADIUS, course).map((points) => ({
      points,
      y: BEACH_Y,
    })),
    undefined,
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
