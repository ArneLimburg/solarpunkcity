import { part, type FarmPart } from "./farms";

const BED_X = [-0.2, 0.2];
const BED_Z = [-0.15, 0.15]; // one on each side of the path
const BED_SIZE = [0.25, 0.05, 0.12] as const;
const FLOWER_Z = 0.26; // along the outer edge of the beds on the +Z side
const FLOWER_COLORS = ["poppy", "sunflower", "lavender"] as const;
const FLOWER_X = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];

// where a visitor stands: on the path in front of a bed (tile-relative,
// hexSize 1; scaled like the parts)
export type VisitorSpot = { x: number; z: number };
export const VISITOR_SPOTS: readonly VisitorSpot[] = [
  { x: BED_X[0], z: 0 }, // in front of the bed at (-0.2, -0.15)
  { x: BED_X[1], z: 0 }, // in front of the bed at (0.2, 0.15)
];

const scale = (hexSize: number) => (p: FarmPart) => ({
  ...p,
  x: p.x * hexSize,
  y: p.y * hexSize,
  z: p.z * hexSize,
  width: p.width * hexSize,
  height: p.height * hexSize,
  depth: p.depth * hexSize,
});

// the visitor spots of a tile with the given hex size, relative to the tile
export function getVisitorSpots(hexSize: number): VisitorSpot[] {
  return VISITOR_SPOTS.map(({ x, z }) => ({ x: x * hexSize, z: z * hexSize }));
}

// Parts of the community garden relative to its tile: a gravel path along X,
// four raised beds (wooden frame, soil, plant clumps) on both sides of it, a
// strip of flowers and a rainwater barrel. Pure and deterministic.
// hexSize is the side length of a hex; the parts are designed for 1.
export function getCommunityGardenLayout(hexSize: number): FarmPart[] {
  const parts: FarmPart[] = [
    part("box", "gravel", [0, 0.005, 0], [1.4, 0.01, 0.1]),
  ];
  for (const z of BED_Z) {
    for (const x of BED_X) {
      const bedX = x;
      const [width, height, depth] = BED_SIZE;
      parts.push(
        part("box", "wood", [bedX, height / 2, z], [width, height, depth]),
        part(
          "box",
          "soil",
          [bedX, height, z],
          [width - 0.04, 0.02, depth - 0.04],
        ),
        part("sphere", "plant", [bedX - 0.05, 0.07, z], [0.05, 0.05, 0.05]),
        part("sphere", "plant", [bedX + 0.05, 0.07, z], [0.05, 0.05, 0.05]),
      );
    }
  }
  FLOWER_X.forEach((x, i) =>
    parts.push(
      part(
        "sphere",
        FLOWER_COLORS[i % FLOWER_COLORS.length],
        [x, 0.03, FLOWER_Z],
        [0.04, 0.06, 0.04],
      ),
    ),
  );
  parts.push(
    part("cylinder", "darkWood", [0.44, 0.07, -0.15], [0.12, 0.14, 0.12]),
  );
  return parts.map(scale(hexSize));
}
