import { FarmPalette, rotateY, type FarmPart, type PartShape } from "./farms";

type Vec = [number, number, number];
type Triangle = [Vec, Vec, Vec];

export type Geometry = {
  positions: number[];
  normals: number[];
  colors: number[]; // rgba per vertex
  indices: number[];
};

const SEGMENTS = 8;
const PHI = (1 + Math.sqrt(5)) / 2;

// the triangles of the shapes fit into the box [-0.5, 0.5]^3
function boxFaces(withBottom: boolean): Triangle[] {
  const c = (x: number, y: number, z: number): Vec => [
    x - 0.5,
    y - 0.5,
    z - 0.5,
  ];
  const quad = (a: Vec, b: Vec, d: Vec, e: Vec): Triangle[] => [
    [a, b, d],
    [a, d, e],
  ];
  return [
    ...quad(c(0, 0, 0), c(1, 0, 0), c(1, 1, 0), c(0, 1, 0)),
    ...quad(c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)),
    ...quad(c(0, 0, 0), c(0, 0, 1), c(0, 1, 1), c(0, 1, 0)),
    ...quad(c(1, 0, 0), c(1, 0, 1), c(1, 1, 1), c(1, 1, 0)),
    ...(withBottom ? quad(c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)) : []),
    ...quad(c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)),
  ];
}

const box = () => boxFaces(true);

// box without the bottom face, e.g. for glass lying on the ground
const openBox = () => boxFaces(false);

// triangular prism, the ridge runs along X
function prism(): Triangle[] {
  const apex = (x: number): Vec => [x, 0.5, 0];
  const left = (x: number): Vec => [x, -0.5, -0.5];
  const right = (x: number): Vec => [x, -0.5, 0.5];
  return [
    [apex(-0.5), left(-0.5), right(-0.5)],
    [apex(0.5), left(0.5), right(0.5)],
    [apex(-0.5), apex(0.5), left(0.5)],
    [apex(-0.5), left(0.5), left(-0.5)],
    [apex(-0.5), apex(0.5), right(0.5)],
    [apex(-0.5), right(0.5), right(-0.5)],
    [left(-0.5), left(0.5), right(0.5)],
    [left(-0.5), right(0.5), right(-0.5)],
  ];
}

// cylinder, or a cone when the top radius is 0
function round(topRadius: number): Triangle[] {
  const ring = (y: number, radius: number, i: number): Vec => {
    const angle = (2 * Math.PI * i) / SEGMENTS;
    return [0.5 * radius * Math.cos(angle), y, 0.5 * radius * Math.sin(angle)];
  };
  const triangles: Triangle[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = ring(-0.5, 1, i);
    const b = ring(-0.5, 1, i + 1);
    const c = ring(0.5, topRadius, i);
    const d = ring(0.5, topRadius, i + 1);
    triangles.push([a, b, c], [a, b, [0, -0.5, 0]]);
    if (topRadius > 0) {
      triangles.push([b, d, c], [c, d, [0, 0.5, 0]]);
    }
  }
  return triangles;
}

// icosahedron
function sphere(): Triangle[] {
  const v = (x: number, y: number, z: number): Vec => {
    const length = Math.hypot(x, y, z) * 2;
    return [x / length, y / length, z / length];
  };
  const p = [
    v(-1, PHI, 0),
    v(1, PHI, 0),
    v(-1, -PHI, 0),
    v(1, -PHI, 0),
    v(0, -1, PHI),
    v(0, 1, PHI),
    v(0, -1, -PHI),
    v(0, 1, -PHI),
    v(PHI, 0, -1),
    v(PHI, 0, 1),
    v(-PHI, 0, -1),
    v(-PHI, 0, 1),
  ];
  const faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  return faces.map(([a, b, c]) => [p[a], p[b], p[c]]);
}

const SHAPES: Record<PartShape, () => Triangle[]> = {
  box,
  openBox,
  prism,
  cylinder: () => round(1),
  cone: () => round(0),
  sphere,
};

function transform(part: FarmPart, [x, y, z]: Vec): Vec {
  const scaled = [x * part.width, y * part.height, z * part.depth];
  // tilt around X
  const cos = Math.cos(part.tilt);
  const sin = Math.sin(part.tilt);
  const tilted: Vec = [
    scaled[0],
    scaled[1] * cos - scaled[2] * sin,
    scaled[1] * sin + scaled[2] * cos,
  ];
  const turned = rotateY({ x: tilted[0], z: tilted[2] }, part.rotation);
  return [turned.x + part.x, tilted[1] + part.y, turned.z + part.z];
}

// Flat shaded triangles (3 vertices each) with the color of every part.
export function buildGeometry(parts: FarmPart[]): Geometry {
  const geometry: Geometry = {
    positions: [],
    normals: [],
    colors: [],
    indices: [],
  };
  for (const part of parts) {
    const color = FarmPalette[part.color];
    for (const triangle of SHAPES[part.shape]()) {
      const [a, b, c] = triangle.map((vertex) => transform(part, vertex));
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let normal = [
        u[1] * w[2] - u[2] * w[1],
        u[2] * w[0] - u[0] * w[2],
        u[0] * w[1] - u[1] * w[0],
      ];
      // all shapes are convex around their center: point the normal outwards
      const outward =
        normal[0] * (a[0] + b[0] + c[0] - 3 * part.x) +
        normal[1] * (a[1] + b[1] + c[1] - 3 * part.y) +
        normal[2] * (a[2] + b[2] + c[2] - 3 * part.z);
      const length = Math.hypot(...normal);
      normal = normal.map((n) => (outward < 0 ? -n : n) / length);
      for (const vertex of outward < 0 ? [a, c, b] : [a, b, c]) {
        geometry.indices.push(geometry.positions.length / 3);
        geometry.positions.push(...vertex);
        geometry.normals.push(...normal);
        geometry.colors.push(...color, 1);
      }
    }
  }
  return geometry;
}
