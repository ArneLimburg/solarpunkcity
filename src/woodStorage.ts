import { rotateY } from "./farms";

// a log lies on the tile: its axis runs along X before the rotation
export type Log = {
  x: number;
  y: number; // center of the log, measured from the top of the tile
  z: number;
  length: number;
  radius: number;
  rotation: number; // around Y, in radians
};

export type LogGeometry = {
  positions: number[];
  normals: number[];
  indices: number[];
};

export const LOG_SEGMENTS = 6;
export const LOG_ROWS = 4; // rows of a pile: 4-3-2-1 logs

const LOG_LENGTH = 0.5; // about half the hex side length
const LOG_RADIUS = 0.05;

// pile centers (x, z) and rotations around Y
const PILES = [
  { x: 0, z: -0.5, rotation: 0 },
  { x: -0.35, z: 0.28, rotation: 0.2 },
  { x: 0.35, z: 0.28, rotation: -0.2 },
] as const;

// deterministic variation of -0.1 .. +0.1 per log
const variation = (index: number, salt: number) =>
  (((index * 7 + salt * 13) % 5) - 2) / 20;

// The 30 logs of the three piles (4-3-2-1 logs each) relative to the center
// tile. Pure and deterministic. hexSize is the side length of a hex; the
// logs are designed for 1.
export function getWoodStorageLogs(hexSize: number): Log[] {
  const logs: Log[] = [];
  for (const pile of PILES) {
    for (let row = 0; row < LOG_ROWS; row++) {
      const count = LOG_ROWS - row;
      for (let i = 0; i < count; i++) {
        const index = logs.length;
        const local = {
          x: 0,
          z: (i - (count - 1) / 2) * 2 * LOG_RADIUS,
        };
        const moved = rotateY(local, pile.rotation);
        logs.push({
          x: (pile.x + moved.x) * hexSize,
          y: (LOG_RADIUS + row * LOG_RADIUS * Math.sqrt(3)) * hexSize,
          z: (pile.z + moved.z) * hexSize,
          length: LOG_LENGTH * (1 + variation(index, 1)) * hexSize,
          radius: LOG_RADIUS * (1 + variation(index, 2)) * hexSize,
          rotation: pile.rotation + variation(index, 3),
        });
      }
    }
  }
  return logs;
}

function addVertex(
  geometry: LogGeometry,
  position: [number, number, number],
  normal: [number, number, number],
): number {
  geometry.positions.push(...position);
  geometry.normals.push(...normal);
  return geometry.positions.length / 3 - 1;
}

// Bark (the 6 sides, 12 triangles) and end grain (the 2 caps, 12 triangles)
// of all logs as separate geometries, so that each gets its own material.
export function buildLogGeometry(logs: Log[]): {
  bark: LogGeometry;
  endGrain: LogGeometry;
} {
  const bark: LogGeometry = { positions: [], normals: [], indices: [] };
  const endGrain: LogGeometry = { positions: [], normals: [], indices: [] };
  for (const log of logs) {
    // maps a point of the log (axis along X) to the tile
    const toTile = (x: number, y: number, z: number) => {
      const turned = rotateY({ x, z }, log.rotation);
      return [turned.x + log.x, y + log.y, turned.z + log.z] as [
        number,
        number,
        number,
      ];
    };
    const direction = (x: number, y: number, z: number) => {
      const turned = rotateY({ x, z }, log.rotation);
      return [turned.x, y, turned.z] as [number, number, number];
    };
    const half = log.length / 2;
    const angle = (i: number) => (2 * Math.PI * i) / LOG_SEGMENTS;
    const barkIndex = [-1, 1].map((side) =>
      Array.from({ length: LOG_SEGMENTS }, (_, i) =>
        addVertex(
          bark,
          toTile(
            side * half,
            log.radius * Math.sin(angle(i)),
            log.radius * Math.cos(angle(i)),
          ),
          direction(0, Math.sin(angle(i)), Math.cos(angle(i))),
        ),
      ),
    );
    for (let i = 0; i < LOG_SEGMENTS; i++) {
      const next = (i + 1) % LOG_SEGMENTS;
      const [a, b] = [barkIndex[0][i], barkIndex[0][next]];
      const [c, d] = [barkIndex[1][i], barkIndex[1][next]];
      bark.indices.push(a, b, c, b, d, c);
    }
    for (const side of [-1, 1]) {
      const normal = direction(side, 0, 0);
      const center = addVertex(endGrain, toTile(side * half, 0, 0), normal);
      const ring = Array.from({ length: LOG_SEGMENTS }, (_, i) =>
        addVertex(
          endGrain,
          toTile(
            side * half,
            log.radius * Math.sin(angle(i)),
            log.radius * Math.cos(angle(i)),
          ),
          normal,
        ),
      );
      for (let i = 0; i < LOG_SEGMENTS; i++) {
        endGrain.indices.push(center, ring[i], ring[(i + 1) % LOG_SEGMENTS]);
      }
    }
  }
  return { bark, endGrain };
}
