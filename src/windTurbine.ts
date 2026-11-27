import type { HexCoordinates } from "./board";
import { part, type FarmPart } from "./farms";
import { TILE_TOP } from "./hexGeometry";

// All wind turbines face the same wind: the rotor axis runs along +X, like the
// rooftop turbine of the apartment building.
export const WIND_DIRECTION = { x: 1, z: 0 } as const;

// 30 rotations per minute, in real time
export const ROTOR_RPM = 30;

export const HUB_HEIGHT = 1.7; // about 30 m
export const ROTOR_RADIUS = 0.55; // about 10 m, stays within the hex

const HUB_X = 0.19; // the hub sits in front of the nacelle, facing the wind
const HUB_RADIUS = 0.06;
const BLADE_START = 0.05;
const BLADE_LENGTH = 0.48;
const BLADE_WIDTH = 0.05;
const BLADE_THICKNESS = 0.015;
const FOUNDATION_HEIGHT = 0.06;
// the tapering tower: diameters of the stacked segments, from bottom to top
const TOWER_DIAMETERS = [0.17, 0.14, 0.11, 0.08];

const scale = (parts: FarmPart[], hexSize: number): FarmPart[] =>
  parts.map((p) => ({
    ...p,
    x: p.x * hexSize,
    y: p.y * hexSize,
    z: p.z * hexSize,
    width: p.width * hexSize,
    height: p.height * hexSize,
    depth: p.depth * hexSize,
  }));

// The hub of the rotor relative to the tile top.
export function getHubPosition(hexSize: number) {
  return { x: HUB_X * hexSize, y: HUB_HEIGHT * hexSize, z: 0 };
}

// Static parts of the wind turbine relative to its tile: a square concrete
// foundation slab, a tower of wood that tapers towards the top and a light
// nacelle on top. Pure and deterministic. hexSize is the side length of a hex;
// the parts are designed for 1.
export function getWindTurbineLayout(hexSize: number): FarmPart[] {
  const segment =
    (HUB_HEIGHT - FOUNDATION_HEIGHT - 0.04) / TOWER_DIAMETERS.length;
  return scale(
    [
      part(
        "box",
        "concrete",
        [0, FOUNDATION_HEIGHT / 2, 0],
        [0.5, FOUNDATION_HEIGHT, 0.5],
      ),
      ...TOWER_DIAMETERS.map((diameter, i) =>
        part(
          "cylinder",
          "wood",
          [0, FOUNDATION_HEIGHT + segment * (i + 0.5), 0],
          [diameter, segment, diameter],
        ),
      ),
      part("box", "white", [0, HUB_HEIGHT, 0], [0.3, 0.14, 0.12]),
    ],
    hexSize,
  );
}

// The rotor at the hub: a hub and three blades in the plane across the wind
// (Y and Z), at angle 0. Pure and deterministic.
export function getWindTurbineRotorLayout(hexSize: number): FarmPart[] {
  const blades = [0, 1, 2].map((i) => {
    const angle = (i * 2 * Math.PI) / 3;
    const middle = BLADE_START + BLADE_LENGTH / 2;
    return part(
      "box",
      "white",
      [HUB_X, HUB_HEIGHT + Math.cos(angle) * middle, Math.sin(angle) * middle],
      [BLADE_THICKNESS, BLADE_LENGTH, BLADE_WIDTH],
      0,
      angle,
    );
  });
  return scale(
    [
      part(
        "sphere",
        "white",
        [HUB_X, HUB_HEIGHT, 0],
        [HUB_RADIUS * 2, HUB_RADIUS * 2, HUB_RADIUS * 2],
      ),
      ...blades,
    ],
    hexSize,
  );
}

// Start angle of the rotor on a tile, so that the rotors do not turn in sync.
export function getRotorStartAngle(coords: HexCoordinates): number {
  const degrees = (((coords.q * 73 + coords.r * 151) % 360) + 360) % 360;
  return (degrees * Math.PI) / 180;
}

// Angle of the rotor around its axis after the given seconds.
export function getRotorAngle(
  coords: HexCoordinates,
  seconds: number,
  rpm = ROTOR_RPM,
): number {
  const turns = (seconds * rpm) / 60;
  return (getRotorStartAngle(coords) + turns * 2 * Math.PI) % (2 * Math.PI);
}

// The matrix (16 values, Babylon's row-vector layout) that places the rotor of
// a turbine on the given center and turns it by angle around its axis.
export function getRotorMatrix(
  center: { x: number; z: number },
  angle: number,
  hexSize: number,
  // the axis (parallel to X) through the hub: its height and Z offset
  hub: { y: number; z: number } = getHubPosition(hexSize),
): number[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // rotation around the axis through the hub, then the move to the tile
  return [
    1,
    0,
    0,
    0,
    0,
    cos,
    sin,
    0,
    0,
    -sin,
    cos,
    0,
    center.x,
    TILE_TOP + hub.y - (hub.y * cos - hub.z * sin),
    center.z + hub.z - (hub.y * sin + hub.z * cos),
    1,
  ];
}
