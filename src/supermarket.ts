import { part, type FarmPart } from "./farms";

const HALL_Z = -0.15; // center of the hall, the entrance faces +Z
const HALL_WIDTH = 0.55; // about 10 m, a hex side being 18 m
const HALL_DEPTH = 0.33; // about 6 m
const WALL_HEIGHT = 0.25;
const FRONT_Z = HALL_Z + HALL_DEPTH / 2;
const DOOR_X = 0.17;
const AWNING_STRIPES = 4;
const AWNING_STRIPE_WIDTH = 0.05;

// wooden walls with a timber frame (corner posts and a beam below the roof),
// a large front window and a door
function hall(): FarmPart[] {
  const posts = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) =>
      part(
        "box",
        "darkWood",
        [
          (sx * HALL_WIDTH) / 2,
          WALL_HEIGHT / 2,
          HALL_Z + (sz * HALL_DEPTH) / 2,
        ],
        [0.03, WALL_HEIGHT, 0.03],
      ),
    ),
  );
  return [
    part(
      "box",
      "wood",
      [0, WALL_HEIGHT / 2, HALL_Z],
      [HALL_WIDTH, WALL_HEIGHT, HALL_DEPTH],
    ),
    ...posts,
    part(
      "box",
      "darkWood",
      [0, WALL_HEIGHT - 0.01, FRONT_Z],
      [HALL_WIDTH + 0.02, 0.03, 0.02],
    ),
    part("openBox", "glass", [-0.1, 0.12, FRONT_Z + 0.005], [0.28, 0.14, 0.01]),
    part(
      "box",
      "darkWood",
      [DOOR_X, 0.085, FRONT_Z + 0.005],
      [0.1, 0.17, 0.01],
    ),
  ];
}

// a flat roof planted with greens
function greenRoof(): FarmPart[] {
  return [
    part(
      "box",
      "plant",
      [0, WALL_HEIGHT + 0.02, HALL_Z],
      [HALL_WIDTH + 0.06, 0.04, HALL_DEPTH + 0.06],
    ),
  ];
}

// alternating canvas and red stripes, sloping down over the entrance
function awning(): FarmPart[] {
  return Array.from({ length: AWNING_STRIPES }, (_, i) =>
    part(
      "box",
      i % 2 === 0 ? "awning" : "canvas",
      [
        DOOR_X + (i - (AWNING_STRIPES - 1) / 2) * AWNING_STRIPE_WIDTH,
        0.2,
        FRONT_Z + 0.06,
      ],
      [AWNING_STRIPE_WIDTH, 0.01, 0.14],
      0,
      0.4,
    ),
  );
}

// four crates of produce in front of the hall
function crates(): FarmPart[] {
  const crate = (x: number, z: number, produce: "grain" | "ochre") => [
    part("box", "plank", [x, 0.03, z], [0.09, 0.06, 0.09]),
    part("box", produce, [x, 0.065, z], [0.07, 0.015, 0.07]),
  ];
  return [
    ...crate(-0.2, 0.25, "grain"),
    ...crate(-0.08, 0.3, "ochre"),
    ...crate(0.05, 0.25, "grain"),
    ...crate(0.3, 0.3, "ochre"),
  ];
}

// the gravel forecourt in front of the entrance
function forecourt(): FarmPart[] {
  return [part("box", "gravel", [0, 0.005, 0.2], [0.8, 0.01, 0.42])];
}

// Parts of the supermarket relative to its tile: a small timber market hall
// with a green roof and a striped awning, produce crates on a gravel
// forecourt (the tile itself is meadow). Pure and deterministic. hexSize is
// the side length of a hex; the parts are designed for 1.
export function getSupermarketLayout(hexSize: number): FarmPart[] {
  return [
    ...forecourt(),
    ...hall(),
    ...greenRoof(),
    ...awning(),
    ...crates(),
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
