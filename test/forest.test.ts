import { expect, test } from "vitest";
import { GRID_RADIUS, isOnBoard } from "../src/board";
import {
  TREES_PER_TILE,
  TREE_RADIUS_FACTOR,
  getTreePlacements,
} from "../src/forest";

const HEX = 1;

function boardTiles() {
  const tiles = [];
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (isOnBoard({ q, r })) {
        tiles.push({ q, r });
      }
    }
  }
  return tiles;
}

test("every tile gets 3 trees within 70 % of the hex radius", () => {
  for (const tile of boardTiles()) {
    const trees = getTreePlacements(tile, HEX);
    expect(trees).toHaveLength(TREES_PER_TILE);
    for (const tree of trees) {
      expect(Math.hypot(tree.x, tree.z)).toBeLessThanOrEqual(
        TREE_RADIUS_FACTOR * HEX + 1e-9,
      );
      expect(tree.scale).toBeGreaterThanOrEqual(0.8);
      expect(tree.scale).toBeLessThanOrEqual(1.2);
      expect(tree.rotation).toBeGreaterThanOrEqual(0);
      expect(tree.rotation).toBeLessThan(2 * Math.PI);
    }
  }
});

test("the same tile always gets the same trees", () => {
  expect(getTreePlacements({ q: 3, r: -2 }, HEX)).toEqual(
    getTreePlacements({ q: 3, r: -2 }, HEX),
  );
  expect(getTreePlacements({ q: 3, r: -2 }, HEX)).not.toEqual(
    getTreePlacements({ q: -2, r: 3 }, HEX),
  );
});

test("both tree kinds occur roughly equally across the board", () => {
  const kinds = boardTiles().flatMap((tile) =>
    getTreePlacements(tile, HEX).map((tree) => tree.kind),
  );
  const conifers = kinds.filter((kind) => kind === "conifer").length;
  expect(conifers).toBeGreaterThan(kinds.length * 0.4);
  expect(conifers).toBeLessThan(kinds.length * 0.6);
});

test("the placements scale with the hex radius", () => {
  const small = getTreePlacements({ q: 1, r: 1 }, 1);
  const large = getTreePlacements({ q: 1, r: 1 }, 2);
  expect(large[0].x).toBeCloseTo(small[0].x * 2);
});
