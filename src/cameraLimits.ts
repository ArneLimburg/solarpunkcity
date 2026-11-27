import { GRID_RADIUS } from "./board";
import { HEX_SIZE } from "./hexGeometry";

// the camera position stays within this distance from the board center (skybox half size: 100)
export const CAMERA_MAX_DISTANCE = 95;
export const BOARD_EDGE = GRID_RADIUS * HEX_SIZE * Math.sqrt(3);

type Point = { x: number; y: number; z: number };

// Keeps the camera target on the ground and close enough to the board center
// that the camera (target + radius) stays inside the skybox.
export function clampCameraTarget(target: Point, radius: number): Point {
  const maxDistance = Math.min(BOARD_EDGE, CAMERA_MAX_DISTANCE - radius);
  const distance = Math.hypot(target.x, target.z);
  const scale = distance > maxDistance ? maxDistance / distance : 1;
  return { x: target.x * scale, y: 0, z: target.z * scale };
}
