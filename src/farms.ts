import type { BuildingType } from "./gameDefinitions";

export type FarmType = "OrganicHomestead" | "Farm" | "AgroIndustrial";

export type PartShape =
  | "box"
  | "openBox"
  | "cylinder"
  | "cone"
  | "prism"
  | "sphere";

// shared palette of all farm models (linear rgb, 0..1)
export const FarmPalette = {
  wood: [0.62, 0.45, 0.27],
  barn: [0.55, 0.22, 0.15],
  roof: [0.45, 0.2, 0.15],
  soil: [0.38, 0.26, 0.15],
  plant: [0.25, 0.65, 0.25],
  grain: [0.9, 0.75, 0.25],
  glass: [0.7, 0.9, 0.95],
  solar: [0.1, 0.18, 0.45],
  concrete: [0.8, 0.8, 0.78],
  ochre: [0.8, 0.6, 0.28],
  darkGlass: [0.12, 0.18, 0.22],
  canvas: [0.93, 0.89, 0.76],
  stone: [0.55, 0.55, 0.57],
  earth: [0.5, 0.4, 0.28],
} as const satisfies Record<string, readonly [number, number, number]>;
export type PaletteColor = keyof typeof FarmPalette;

// alpha of the glass material
export const GLASS_ALPHA = 0.4;

// Part of a model relative to the center tile. The shape fills a box of the
// given size around its position (y is measured from the top of the tile),
// is tilted around the X axis and then rotated around the Y axis.
export type FarmPart = {
  shape: PartShape;
  color: PaletteColor;
  x: number;
  y: number;
  z: number;
  width: number; // along X before rotation
  height: number; // along Y
  depth: number; // along Z before rotation
  rotation: number; // around Y, in radians
  tilt: number; // around X, in radians
};

const FARM_TYPES: readonly BuildingType[] = [
  "OrganicHomestead",
  "Farm",
  "AgroIndustrial",
];

// farm models are built from code like the apartment building
export function isFarmType(type: BuildingType): type is FarmType {
  return FARM_TYPES.includes(type);
}

type Offset = { x: number; z: number };

// rotates a point around the Y axis, same convention as the part rotation
export function rotateY({ x, z }: Offset, angle: number): Offset {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos + z * sin, z: -x * sin + z * cos };
}

export function part(
  shape: PartShape,
  color: PaletteColor,
  [x, y, z]: [number, number, number],
  [width, height, depth]: [number, number, number],
  rotation = 0,
  tilt = 0,
): FarmPart {
  return { shape, color, x, y, z, width, height, depth, rotation, tilt };
}

// moves the parts of a tile model (built around the tile center) to the tile
function place(parts: FarmPart[], offset: Offset, rotation: number) {
  return parts.map((p) => {
    const moved = rotateY(p, rotation);
    return {
      ...p,
      x: offset.x + moved.x,
      z: offset.z + moved.z,
      rotation: p.rotation + rotation,
    };
  });
}

function cropRows(color: PaletteColor): FarmPart[] {
  return [-0.36, -0.12, 0.12, 0.36].map((z) =>
    part("box", color, [0, 0.04, z], [1, 0.08, 0.14]),
  );
}

function house(): FarmPart[] {
  return [
    part("box", "wood", [0, 0.15, -0.25], [0.45, 0.3, 0.3]),
    part("prism", "roof", [0, 0.4, -0.25], [0.5, 0.2, 0.34]),
  ];
}

function vegetableBeds(): FarmPart[] {
  return [-0.35, 0, 0.35].flatMap((x) => [
    part("box", "soil", [x, 0.025, 0.35], [0.28, 0.05, 0.22]),
    part("box", "plant", [x, 0.08, 0.3], [0.24, 0.06, 0.05]),
    part("box", "plant", [x, 0.08, 0.4], [0.24, 0.06, 0.05]),
  ]);
}

// small deciduous tree: trunk and round crown, y is the foot of the trunk
export function deciduousTree(x: number, y: number, z: number): FarmPart[] {
  return [
    part("cylinder", "wood", [x, y + 0.1, z], [0.06, 0.2, 0.06]),
    part("sphere", "plant", [x, y + 0.3, z], [0.3, 0.3, 0.3]),
  ];
}

function fruitTree(): FarmPart[] {
  return deciduousTree(0.5, 0, -0.2);
}

function barnAndSilo(): FarmPart[] {
  return [
    part("box", "barn", [-0.2, 0.2, 0.1], [0.5, 0.4, 0.4]),
    part("prism", "roof", [-0.2, 0.5, 0.1], [0.54, 0.2, 0.44]),
    part("cylinder", "concrete", [0.3, 0.3, -0.1], [0.3, 0.6, 0.3]),
    part("cone", "roof", [0.3, 0.7, -0.1], [0.34, 0.2, 0.34]),
  ];
}

function verticalFarmTower(): FarmPart[] {
  const parts = [0.6, 0.5, 0.4].map((size, i) =>
    part("box", "concrete", [0, 0.41 + i * 0.82, 0], [size, 0.82, size]),
  );
  const bands = [0.41, 1.23, 2.05].map((y, i) =>
    part("box", "plant", [0, y, 0], [0.64 - i * 0.1, 0.1, 0.64 - i * 0.1]),
  );
  return [...parts, ...bands];
}

function greenhouse(): FarmPart[] {
  return [part("openBox", "glass", [0, 0.2, 0], [0.9, 0.4, 0.7])];
}

function solarArray(): FarmPart[] {
  return [-0.3, 0, 0.3].map((z) =>
    part("box", "solar", [0, 0.2, z], [0.8, 0.04, 0.22], 0, -0.5),
  );
}

// tile offsets (axial) at the given distance from the center, ordered by angle
function ring(distance: number) {
  const tiles: { dq: number; dr: number; x: number; z: number }[] = [];
  for (let dq = -distance; dq <= distance; dq++) {
    for (let dr = -distance; dr <= distance; dr++) {
      if (
        Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) !== distance
      ) {
        continue;
      }
      tiles.push({
        dq,
        dr,
        x: Math.sqrt(3) * dq + (Math.sqrt(3) / 2) * dr,
        z: 1.5 * dr,
      });
    }
  }
  return tiles.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
}

// The crop rows of a tile always run in the same direction, so a building
// looks the same wherever it is placed.
const rowDirection = (dq: number, dr: number) =>
  ((((dq - dr) % 3) + 3) % 3) * (Math.PI / 3);

// Parts of a farm type relative to its center tile. Pure and deterministic.
// hexSize is the side length of a hex; the parts are designed for 1.
export function getFarmLayout(type: FarmType, hexSize: number): FarmPart[] {
  const parts: FarmPart[] = [];
  const addRing = (distance: number, build: (index: number) => FarmPart[]) => {
    ring(distance).forEach((tile, index) => {
      const rotation = rowDirection(tile.dq, tile.dr);
      parts.push(...place(build(index), tile, rotation));
    });
  };
  const fields = (index: number) =>
    cropRows(index % 2 === 0 ? "grain" : "plant");

  if (type === "OrganicHomestead") {
    parts.push(...house(), ...vegetableBeds(), ...fruitTree());
  } else if (type === "Farm") {
    parts.push(...barnAndSilo());
    addRing(1, fields);
  } else {
    parts.push(...verticalFarmTower());
    addRing(1, (index) => (index % 2 === 0 ? greenhouse() : solarArray()));
    addRing(2, fields);
  }
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
