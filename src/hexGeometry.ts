import { Vector3 } from "@babylonjs/core";
import type { HexCoordinates } from "./board";

export const HEX_SIZE = 1; // side length of hex (in scene units)

export const tileKey = (coords: HexCoordinates) => `${coords.q},${coords.r}`;

// corners of the hex polygon (flat top) used for the tiles
export function createHexCorners(): Vector3[] {
  const corners: Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + 30); // +30 for flat-top orientation
    corners.push(
      new Vector3(HEX_SIZE * Math.cos(angle), 0, HEX_SIZE * Math.sin(angle)),
    );
  }
  return corners;
}

export function pixelToHex(position: { x: number; z: number }): HexCoordinates {
  const qf =
    ((Math.sqrt(3) / 3) * position.x - (1 / 3) * position.z) / HEX_SIZE;
  const rf = ((2 / 3) * position.z) / HEX_SIZE;

  // cube coords
  const xCube = qf;
  const zCube = rf;
  const yCube = -xCube - zCube;

  // round to nearest cube
  let rx = Math.round(xCube);
  let ry = Math.round(yCube);
  let rz = Math.round(zCube);

  const dx = Math.abs(rx - xCube);
  const dy = Math.abs(ry - yCube);
  const dz = Math.abs(rz - zCube);

  if (dx > dy && dx > dz) {
    rx = -ry - rz;
  } else if (dy > dz) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

export function hexToPixel(q: number, r: number): Vector3 {
  const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const z = HEX_SIZE * (1.5 * r);
  return new Vector3(x, 0, z);
}
