import { part, type FarmPart } from "./farms";

const POST_HEIGHT = 0.28;
const POST_X = [-0.22, 0.22];
const POST_Z = [-0.14, 0.14];
const LOG_DIAMETER = 0.08;

// four posts (open sides) carrying a sloped roof of dark planks; the shelter
// is about 0.55 x 0.36, the ridge runs along X
function shelter(): FarmPart[] {
  return [
    ...POST_X.flatMap((x) =>
      POST_Z.map((z) =>
        part("box", "wood", [x, POST_HEIGHT / 2, z], [0.04, POST_HEIGHT, 0.04]),
      ),
    ),
    part("prism", "darkWood", [0, POST_HEIGHT + 0.07, 0], [0.6, 0.14, 0.38]),
  ];
}

// a chopping block with a log lying across the shelter floor
function choppingBlock(): FarmPart[] {
  return [
    part("box", "wood", [0, 0.07, 0], [0.12, 0.14, 0.12]),
    part(
      "log",
      "bark",
      [0, LOG_DIAMETER / 2, 0.08],
      [LOG_DIAMETER, 0.3, LOG_DIAMETER],
      Math.PI / 2,
      Math.PI / 2,
    ),
  ];
}

// three logs below and one on top beside the shelter, axes along X
function logStack(): FarmPart[] {
  const log = (y: number, z: number) =>
    part(
      "log",
      "bark",
      [0, y, z],
      [LOG_DIAMETER, 0.4, LOG_DIAMETER],
      Math.PI / 2,
      Math.PI / 2,
    );
  return [
    log(LOG_DIAMETER / 2, 0.38),
    log(LOG_DIAMETER / 2, 0.38 + LOG_DIAMETER),
    log(LOG_DIAMETER / 2, 0.38 + 2 * LOG_DIAMETER),
    log(LOG_DIAMETER / 2 + 0.07, 0.38 + LOG_DIAMETER),
  ];
}

// Parts of the woodcutter relative to its tile: an open timber shelter with a
// chopping block and a stack of logs beside it. Pure and deterministic.
// hexSize is the side length of a hex; the parts are designed for 1.
export function getWoodcutterLayout(hexSize: number): FarmPart[] {
  return [...shelter(), ...choppingBlock(), ...logStack()].map((p) => ({
    ...p,
    x: p.x * hexSize,
    y: p.y * hexSize,
    z: p.z * hexSize,
    width: p.width * hexSize,
    height: p.height * hexSize,
    depth: p.depth * hexSize,
  }));
}
