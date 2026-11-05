import { expect, test } from "vitest";
import { GRID_RADIUS, isOnBoard } from "../src/board";
import {
  MIN_TREE_DISTANCE_FACTOR,
  TREES_PER_TILE,
  TREE_RADIUS_FACTOR,
  getTileRotation,
  getTreePlacements,
  pickTreePosition,
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

function minPairDistance(tile: { q: number; r: number }) {
  const trees = getTreePlacements(tile, HEX);
  let min = Infinity;
  for (let i = 0; i < trees.length; i++) {
    for (let j = i + 1; j < trees.length; j++) {
      min = Math.min(
        min,
        Math.hypot(trees[i].x - trees[j].x, trees[i].z - trees[j].z),
      );
    }
  }
  return min;
}

test("trees keep their distance on almost every tile", () => {
  const tiles = boardTiles();
  const tooClose = tiles.filter(
    (tile) => minPairDistance(tile) < MIN_TREE_DISTANCE_FACTOR * HEX,
  );
  // only tiles that needed the fallback may be too close
  expect(tooClose.length).toBeLessThanOrEqual(tiles.length * 0.02);
});

test("the last candidate is used when the distance cannot be kept", () => {
  const random = () => 0.5; // always the same candidate
  const first = pickTreePosition(random, HEX, []);
  const second = pickTreePosition(random, HEX, [first]);
  expect(second).toEqual(first);
});

test("a candidate with enough distance is used right away", () => {
  // the first candidate is at distance 0.7 and angle 180 degrees
  const values = [1, 0.5, 0.9, 0.9];
  const random = () => values.shift() ?? 0.5;
  const position = pickTreePosition(random, HEX, [{ x: 0.5, z: 0 }]);
  expect(position.x).toBeCloseTo(-0.7);
  expect(values).toHaveLength(2); // no second attempt
});

test("the tile rotation is a multiple of 60 degrees", () => {
  const values = new Set<number>();
  for (const tile of boardTiles()) {
    const rotation = getTileRotation(tile);
    expect(rotation).toBeGreaterThanOrEqual(0);
    expect(rotation).toBeLessThan(2 * Math.PI);
    const steps = rotation / (Math.PI / 3);
    expect(steps).toBeCloseTo(Math.round(steps));
    expect(getTileRotation(tile)).toBe(rotation);
    values.add(rotation);
  }
  expect(values.size).toBeGreaterThanOrEqual(4);
});

test("every tile gets 5 trees within 70 % of the hex radius", () => {
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
