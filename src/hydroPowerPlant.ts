import { GRID_RADIUS, getRiverCourse, type HexCoordinates } from "./board";
import { part, type FarmPart } from "./farms";
import { hexToPixel } from "./hexGeometry";

const WEIR_LENGTH = 1.6; // across the river, stays within the hex (inradius 0.87)
const WEIR_DEPTH = 0.1; // along the flow
const WEIR_HEIGHT = 0.16; // reaches below the water surface and above the tile top
const HOUSE_X = 0.62; // the turbine house stands on the bank end of the weir

// Rotation around Y that turns the model (built for a river flowing along +Z,
// weir along X) to the course of the river on the given tile: the flow runs
// from the previous to the next tile of the course (at the ends from or to the
// tile itself). 0 for tiles off the course.
export function getHydroPowerPlantRotation(
  coords: HexCoordinates,
  course: HexCoordinates[] = getRiverCourse(GRID_RADIUS),
): number {
  const index = course.findIndex(
    (tile) => tile.q === coords.q && tile.r === coords.r,
  );
  if (index < 0) {
    return 0;
  }
  const previous = hexToPixel(
    course[Math.max(index - 1, 0)].q,
    course[Math.max(index - 1, 0)].r,
  );
  const next = hexToPixel(
    course[Math.min(index + 1, course.length - 1)].q,
    course[Math.min(index + 1, course.length - 1)].r,
  );
  return Math.atan2(next.x - previous.x, next.z - previous.z);
}

// Parts of the hydro power plant relative to its tile, for a river flowing
// along +Z: a low weir of light concrete across the whole tile, a foam strip
// on its downstream side and a turbine house with a planted flat roof on a
// concrete pier at the +X end. Pure and deterministic. hexSize is the side
// length of a hex; the parts are designed for 1.
export function getHydroPowerPlantLayout(hexSize: number): FarmPart[] {
  return [
    part("box", "concrete", [0, 0, 0], [WEIR_LENGTH, WEIR_HEIGHT, WEIR_DEPTH]),
    // pier below the house, reaching from the weir to the bank
    part("box", "concrete", [HOUSE_X, 0, 0], [0.4, WEIR_HEIGHT, 0.34]),
    // 6 x 5 m: 5 m across the river, 6 m along it
    part("box", "stone", [HOUSE_X, 0.19, 0], [0.28, 0.22, 0.33]),
    part("box", "plant", [HOUSE_X, 0.32, 0], [0.32, 0.04, 0.37]),
    // just above the water surface, downstream of the weir
    part("box", "foam", [-0.2, -0.035, 0.14], [0.9, 0.02, 0.12]),
  ].map((p) => ({
    ...p,
    x: p.x * hexSize,
    y: p.y * hexSize,
    z: p.z * hexSize,
    width: p.width * hexSize,
    height: p.height * hexSize,
    depth: p.depth * hexSize,
  }));
}
