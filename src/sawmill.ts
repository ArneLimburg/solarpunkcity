import { part, type FarmPart } from "./farms";

const POST_HEIGHT = 0.3;
const POST_X = [-0.3, 0, 0.3];
const POST_Z = [-0.15, 0.15];
const BENCH_HEIGHT = 0.16;
const LOG_DIAMETER = 0.08;

// six posts (open sides) carrying a gable roof of dark planks; the shed is
// about 0.67 x 0.33 (12 x 6 m), the ridge runs along X
function shed(): FarmPart[] {
  return [
    ...POST_X.flatMap((x) =>
      POST_Z.map((z) =>
        part("box", "wood", [x, POST_HEIGHT / 2, z], [0.04, POST_HEIGHT, 0.04]),
      ),
    ),
    part("prism", "darkWood", [0, POST_HEIGHT + 0.07, 0], [0.74, 0.14, 0.4]),
  ];
}

// a long table on two trestles with a log lying on it (axis along X)
function sawBench(): FarmPart[] {
  return [
    part("box", "wood", [0, BENCH_HEIGHT, 0], [0.56, 0.03, 0.1]),
    part(
      "box",
      "wood",
      [-0.2, BENCH_HEIGHT / 2, 0],
      [0.04, BENCH_HEIGHT, 0.12],
    ),
    part("box", "wood", [0.2, BENCH_HEIGHT / 2, 0], [0.04, BENCH_HEIGHT, 0.12]),
    part(
      "log",
      "bark",
      [0, BENCH_HEIGHT + 0.015 + LOG_DIAMETER / 2, 0],
      [LOG_DIAMETER, 0.5, LOG_DIAMETER],
      Math.PI / 2,
      Math.PI / 2,
    ),
  ];
}

// three layers of light planks next to the shed
function plankStack(): FarmPart[] {
  return [0, 1, 2].map((layer) =>
    part("box", "plank", [0, 0.02 + layer * 0.04, 0.4], [0.34, 0.04, 0.16]),
  );
}

// three logs below and one on top, axes along X
function logPile(): FarmPart[] {
  const log = (y: number, z: number) =>
    part(
      "log",
      "bark",
      [-0.1, y, z],
      [LOG_DIAMETER, 0.4, LOG_DIAMETER],
      Math.PI / 2,
      Math.PI / 2,
    );
  return [
    log(LOG_DIAMETER / 2, -0.5),
    log(LOG_DIAMETER / 2, -0.5 + LOG_DIAMETER),
    log(LOG_DIAMETER / 2, -0.5 + 2 * LOG_DIAMETER),
    log(LOG_DIAMETER / 2 + 0.07, -0.5 + LOG_DIAMETER),
  ];
}

// flat light patches on the bare ground
function sawdustPatches(): FarmPart[] {
  return [
    part("box", "sawdust", [0, 0.005, 0], [0.5, 0.01, 0.3]),
    part("box", "sawdust", [0.42, 0.005, 0.05], [0.2, 0.01, 0.16], 0.4),
    part("box", "sawdust", [-0.45, 0.005, 0.25], [0.18, 0.01, 0.14], -0.3),
  ];
}

// Parts of the sawmill relative to its tile: an open saw shed with a saw
// bench, a plank stack and a log pile on bare ground. Pure and deterministic.
// hexSize is the side length of a hex; the parts are designed for 1.
export function getSawmillLayout(hexSize: number): FarmPart[] {
  return [
    ...sawdustPatches(),
    ...shed(),
    ...sawBench(),
    ...plankStack(),
    ...logPile(),
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
