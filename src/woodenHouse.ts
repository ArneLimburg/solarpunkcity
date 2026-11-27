import { deciduousTree, part, type FarmPart } from "./farms";

// one-story wooden house with its own solar panels, wind turbine and garden
const HOUSE_X = -0.2;
const HOUSE_Z = 0.05;
const WIDTH = 0.45;
const DEPTH = 0.35;
const WALL_HEIGHT = 0.17;
const ROOF_HEIGHT = 0.12;
const ROOF_RUN = DEPTH / 2 + 0.02;
const ROOF_TILT = Math.atan(ROOF_HEIGHT / ROOF_RUN);
const FRONT = HOUSE_Z + DEPTH / 2 + 0.005; // z of the front facade details
const BACK = HOUSE_Z - DEPTH / 2 - 0.005;
const LEFT = HOUSE_X - WIDTH / 2 - 0.005;
const RIGHT = HOUSE_X + WIDTH / 2 + 0.005;
const WINDOW_Y = 0.1;

const MAST_X = 0.4;
const MAST_Z = -0.15;
const MAST_HEIGHT = 0.6;
const BLADE_LENGTH = 0.15;

function openings(): FarmPart[] {
  return [
    part("box", "darkWood", [HOUSE_X + 0.12, 0.065, FRONT], [0.09, 0.13, 0.02]),
    part(
      "box",
      "darkGlass",
      [HOUSE_X - 0.1, WINDOW_Y, FRONT],
      [0.1, 0.07, 0.02],
    ),
    part(
      "box",
      "darkGlass",
      [HOUSE_X - 0.1, WINDOW_Y, BACK],
      [0.1, 0.07, 0.02],
    ),
    part(
      "box",
      "darkGlass",
      [HOUSE_X + 0.1, WINDOW_Y, BACK],
      [0.1, 0.07, 0.02],
    ),
    part("box", "darkGlass", [LEFT, WINDOW_Y, HOUSE_Z], [0.02, 0.07, 0.1]),
    part("box", "darkGlass", [RIGHT, WINDOW_Y, HOUSE_Z], [0.02, 0.07, 0.1]),
  ];
}

// gable roof with two solar panels lying on the +Z slope
function roof(): FarmPart[] {
  const sin = Math.sin(ROOF_TILT);
  const cos = Math.cos(ROOF_TILT);
  const y = WALL_HEIGHT + ROOF_HEIGHT / 2;
  return [
    part(
      "prism",
      "roof",
      [HOUSE_X, y, HOUSE_Z],
      [WIDTH + 0.04, ROOF_HEIGHT, DEPTH + 0.04],
    ),
    ...[-0.1, 0.1].map((dx) =>
      part(
        "box",
        "solar",
        [HOUSE_X + dx, y + 0.012 * cos, HOUSE_Z + ROOF_RUN / 2 + 0.012 * sin],
        [0.18, 0.02, 0.18],
        0,
        ROOF_TILT,
      ),
    ),
  ];
}

// slender mast, nacelle and three static blades 120° apart
function windTurbine(): FarmPart[] {
  const blades = [0, 1, 2].map((i) => {
    const angle = (i * 2 * Math.PI) / 3;
    return part(
      "box",
      "concrete",
      [
        MAST_X + 0.04,
        MAST_HEIGHT + (Math.cos(angle) * BLADE_LENGTH) / 2,
        MAST_Z + (Math.sin(angle) * BLADE_LENGTH) / 2,
      ],
      [0.01, BLADE_LENGTH, 0.03],
      0,
      angle,
    );
  });
  return [
    part(
      "cylinder",
      "concrete",
      [MAST_X, MAST_HEIGHT / 2, MAST_Z],
      [0.03, MAST_HEIGHT, 0.03],
    ),
    part("box", "concrete", [MAST_X, MAST_HEIGHT, MAST_Z], [0.07, 0.04, 0.04]),
    ...blades,
  ];
}

function garden(): FarmPart[] {
  return [
    part("box", "soil", [-0.2, 0.025, 0.4], [0.4, 0.05, 0.14]),
    part("box", "plant", [-0.2, 0.07, 0.4], [0.36, 0.04, 0.1]),
    ...deciduousTree(0.15, 0, 0.35),
  ];
}

// Parts of the wooden house relative to its tile. Pure and deterministic.
// hexSize is the side length of a hex; the parts are designed for 1.
export function getWoodenHouseLayout(hexSize: number): FarmPart[] {
  const parts = [
    part(
      "box",
      "wood",
      [HOUSE_X, WALL_HEIGHT / 2, HOUSE_Z],
      [WIDTH, WALL_HEIGHT, DEPTH],
    ),
    ...openings(),
    ...roof(),
    ...windTurbine(),
    ...garden(),
  ];
  return parts.map((p) => ({
    ...p,
    x: p.x * hexSize,
    y: p.y * hexSize,
    z: p.z * hexSize,
    width: p.width * hexSize,
    height: p.height * hexSize,
    depth: p.depth * hexSize,
  }));
}
