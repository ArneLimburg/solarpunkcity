import { expect, test } from "vitest";
import { GRID_RADIUS } from "../src/board";
import {
  CORNER_RADIUS_FACTOR,
  CORNER_SEGMENTS,
  createCornerPiece,
  createRoundedHexOutline,
  getCornerRotation,
  getTileCorners,
  getVertexCorners,
  getVertexFill,
} from "../src/hexCorners";

// pixel position of a tile center (same formula as hexToPixel, which needs Babylon)
const center = ({ q, r }: { q: number; r: number }) => ({
  x: Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r,
  z: 1.5 * r,
});

test("the rounded outline has 4 segments per corner and stays inside the hexagon", () => {
  const outline = createRoundedHexOutline(1);
  expect(outline).toHaveLength(6 * (CORNER_SEGMENTS + 1));
  for (const point of outline) {
    const distance = Math.hypot(point.x, point.z);
    expect(distance).toBeLessThan(1);
    // no point is nearer to the center than the edges of the hexagon
    expect(distance).toBeGreaterThan(Math.cos(Math.PI / 6) - 1e-9);
  }
});

test("the arc of a corner has the corner radius", () => {
  const size = 2;
  const outline = createRoundedHexOutline(size);
  const radius = CORNER_RADIUS_FACTOR * size;
  const arc = outline.slice(0, CORNER_SEGMENTS + 1);
  // all points of an arc have the same distance to the arc center
  const distance = size - radius / Math.sin(Math.PI / 3);
  const arcCenter = {
    x: distance * Math.cos(Math.PI / 6),
    z: distance * Math.sin(Math.PI / 6),
  };
  for (const point of arc) {
    expect(
      Math.hypot(point.x - arcCenter.x, point.z - arcCenter.z),
    ).toBeCloseTo(radius);
  }
});

test("the rounded outline touches the edges tangentially", () => {
  const outline = createRoundedHexOutline(1);
  // the last point of the arc of corner 0 and the first of corner 1 lie on the edge between
  // them, which has the distance cos(30°) from the center in the direction 60°
  for (const point of [
    outline[CORNER_SEGMENTS],
    outline[CORNER_SEGMENTS + 1],
  ]) {
    const along =
      point.x * Math.cos(Math.PI / 3) + point.z * Math.sin(Math.PI / 3);
    expect(along).toBeCloseTo(Math.cos(Math.PI / 6));
  }
});

test("the corner piece reaches from the sharp to the rounded corner", () => {
  const piece = createCornerPiece(1);
  expect(piece).toHaveLength(CORNER_SEGMENTS + 2);
  const sharp = piece[piece.length - 1];
  expect(sharp.x).toBeCloseTo(Math.cos(Math.PI / 6));
  expect(sharp.z).toBeCloseTo(Math.sin(Math.PI / 6));
  expect(piece.slice(0, -1)).toEqual(createRoundedHexOutline(1).slice(0, 5));
});

test("the corner rotation turns corner 0 clockwise in Babylon's convention", () => {
  expect(getCornerRotation(0)).toBeCloseTo(0);
  expect(getCornerRotation(3)).toBeCloseTo(-Math.PI);
  // Babylon rotates (x, z) to (x cos + z sin, -x sin + z cos)
  const angle = getCornerRotation(1);
  const sharp = { x: Math.cos(Math.PI / 6), z: Math.sin(Math.PI / 6) };
  const rotated = {
    x: sharp.x * Math.cos(angle) + sharp.z * Math.sin(angle),
    z: -sharp.x * Math.sin(angle) + sharp.z * Math.cos(angle),
  };
  expect(rotated.x).toBeCloseTo(Math.cos(Math.PI / 2));
  expect(rotated.z).toBeCloseTo(Math.sin(Math.PI / 2));
});

test("a tile has the 6 corners 0 to 5", () => {
  const tile = { q: 2, r: -1 };
  expect(getTileCorners(tile)).toEqual(
    [0, 1, 2, 3, 4, 5].map((corner) => ({ tile, corner })),
  );
});

test("the corners at a vertex meet at the same position", () => {
  const tile = { q: 3, r: -2 };
  for (const corner of getTileCorners(tile)) {
    const shared = getVertexCorners(corner);
    expect(shared).toHaveLength(3);
    const positions = shared.map((s) => {
      const angle = (Math.PI / 180) * (60 * s.corner + 30);
      const c = center(s.tile);
      return { x: c.x + Math.cos(angle), z: c.z + Math.sin(angle) };
    });
    for (const position of positions) {
      expect(position.x).toBeCloseTo(positions[0].x);
      expect(position.z).toBeCloseTo(positions[0].z);
    }
  }
});

test("off-board tiles do not share a vertex", () => {
  const tile = { q: GRID_RADIUS, r: 0 };
  // the outermost corner of the board belongs to one tile only
  expect(getVertexCorners({ tile, corner: 0 })).toEqual([{ tile, corner: 0 }]);
  // a corner at the board edge is shared by two tiles
  expect(getVertexCorners({ tile, corner: 4 })).toEqual([
    { tile, corner: 4 },
    { tile: { q: GRID_RADIUS, r: -1 }, corner: 0 },
  ]);
  // an off-board tile itself is not part of its vertices
  expect(
    getVertexCorners({ tile: { q: GRID_RADIUS + 1, r: 0 }, corner: 3 }),
  ).toEqual([{ tile: { q: GRID_RADIUS, r: 0 }, corner: 5 }]);
});

test("a vertex of three equal grounds gets that ground", () => {
  expect(getVertexFill(["a", "a", "a"], "mixed")).toBe("a");
});

test("a vertex of two equal and one different ground gets the majority", () => {
  expect(getVertexFill(["a", "a", "b"], "mixed")).toBe("a");
  expect(getVertexFill(["a", "b", "b"], "mixed")).toBe("b");
  expect(getVertexFill(["b", "a", "b"], "mixed")).toBe("b");
});

test("a vertex of three different grounds gets the mixed fill", () => {
  expect(getVertexFill(["a", "b", "c"], "mixed")).toBe("mixed");
});

test("a vertex at the board edge is filled only for equal grounds", () => {
  expect(getVertexFill(["a", "a"], "mixed")).toBe("a");
  expect(getVertexFill(["a", "b"], "mixed")).toBeUndefined();
});

test("an outermost vertex has no fill", () => {
  expect(getVertexFill(["a"], "mixed")).toBeUndefined();
  expect(getVertexFill([], "mixed")).toBeUndefined();
});
