import { part, type FarmPart } from "./farms";

// all panels of the map face the same direction: −Z (tilt around X is negative
// so that the upper edge lies on the +Z side)
export const SOLAR_FIELD_FACING = { x: 0, z: -1 } as const;
export const PANEL_TILT = -(25 * Math.PI) / 180;
export const ROW_Z = [-0.42, 0, 0.42]; // pitch of the three rows
const ROW_LENGTH = 1.4; // along X, stays within the hex (inradius 0.87)
const PANEL_SLOPE = 0.22; // length of a panel along its slope
const PANEL_THICKNESS = 0.02;
const LOWER_EDGE = 0.06; // ~1 m above the ground
const POST_SIZE = 0.04;
const POST_X = [-0.65, 0, 0.65]; // both ends and the middle
const INVERTER_X = 0.78;

// Parts of the solar field relative to its tile: three rows of dark blue
// panels tilted 25° towards −Z, each on timber posts, and a small light grey
// inverter box at the +X end of the middle row. Pure and deterministic.
// hexSize is the side length of a hex; the parts are designed for 1.
export function getSolarFieldLayout(hexSize: number): FarmPart[] {
  const rise = PANEL_SLOPE * Math.sin(-PANEL_TILT);
  const panelY = LOWER_EDGE + rise / 2;
  const parts: FarmPart[] = [];
  for (const z of ROW_Z) {
    parts.push(
      part(
        "box",
        "solar",
        [0, panelY, z],
        [ROW_LENGTH, PANEL_THICKNESS, PANEL_SLOPE],
        0,
        PANEL_TILT,
      ),
    );
    for (const x of POST_X) {
      parts.push(
        part("box", "wood", [x, panelY / 2, z], [POST_SIZE, panelY, POST_SIZE]),
      );
    }
  }
  parts.push(part("box", "concrete", [INVERTER_X, 0.06, 0], [0.1, 0.12, 0.1]));
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
