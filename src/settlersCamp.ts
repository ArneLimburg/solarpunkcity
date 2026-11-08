import { part, type FarmPart } from "./farms";

const STONES = 6;
const FIRE = { x: 0.28, z: -0.05 };
const FIRE_RADIUS = 0.08;
const BED_ROWS = [0.37, 0.45, 0.53];
const BED_PLANTS = [-0.15, -0.05, 0.05, 0.15];

// trampled earth below the camp
function ground(): FarmPart[] {
  return [
    part("box", "earth", [0, 0.005, 0], [0.9, 0.01, 0.9], 0.3),
    ...[
      [-0.5, -0.45],
      [0.5, -0.4],
      [-0.55, 0.3],
      [0.55, 0.45],
    ].map(([x, z]) => part("cone", "plant", [x, 0.04, z], [0.06, 0.08, 0.06])),
  ];
}

// two ridge tents of light canvas, slightly rotated
function tents(): FarmPart[] {
  return [
    part("prism", "canvas", [-0.3, 0.07, -0.22], [0.22, 0.14, 0.18], 0.3),
    part("prism", "canvas", [-0.22, 0.07, 0.1], [0.22, 0.14, 0.18], -0.35),
  ];
}

// a ring of stones around three crossed logs
function firePlace(): FarmPart[] {
  const stones = Array.from({ length: STONES }, (_, i) => {
    const angle = (i * 2 * Math.PI) / STONES;
    return part(
      "box",
      "stone",
      [
        FIRE.x + FIRE_RADIUS * Math.cos(angle),
        0.015,
        FIRE.z + FIRE_RADIUS * Math.sin(angle),
      ],
      [0.04, 0.03, 0.04],
      angle,
    );
  });
  const logs = [0, 1, 2].map((i) =>
    part(
      "box",
      "wood",
      [FIRE.x, 0.03 + i * 0.02, FIRE.z],
      [0.12, 0.02, 0.025],
      (i * Math.PI) / 3,
    ),
  );
  return [...stones, ...logs];
}

// a small bed with rows of plant bumps
function vegetableBed(): FarmPart[] {
  return [
    part("box", "soil", [0, 0.02, 0.45], [0.5, 0.04, 0.3]),
    ...BED_ROWS.flatMap((z) =>
      BED_PLANTS.map((x) =>
        part("sphere", "plant", [x, 0.06, z], [0.07, 0.07, 0.07]),
      ),
    ),
  ];
}

// Parts of the settlers' camp relative to its tile. Pure and deterministic.
// hexSize is the side length of a hex; the parts are designed for 1.
export function getSettlersCampLayout(hexSize: number): FarmPart[] {
  return [...ground(), ...tents(), ...firePlace(), ...vegetableBed()].map(
    (p) => ({
      ...p,
      x: p.x * hexSize,
      y: p.y * hexSize,
      z: p.z * hexSize,
      width: p.width * hexSize,
      height: p.height * hexSize,
      depth: p.depth * hexSize,
    }),
  );
}
