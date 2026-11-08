import { expect, test } from "vitest";
import { buildLogGeometry, getWoodStorageLogs } from "../src/woodStorage";

test("three piles of 4-3-2-1 logs make 30 logs", () => {
  expect(getWoodStorageLogs(1)).toHaveLength(30);
});

test("the layout is deterministic and scales with the hex size", () => {
  const logs = getWoodStorageLogs(1);
  expect(getWoodStorageLogs(1)).toEqual(logs);
  const doubled = getWoodStorageLogs(2);
  expect(doubled[5].x).toBeCloseTo(logs[5].x * 2);
  expect(doubled[5].length).toBeCloseTo(logs[5].length * 2);
  expect(doubled[5].radius).toBeCloseTo(logs[5].radius * 2);
});

test("logs are about half a hex side long and vary slightly", () => {
  const logs = getWoodStorageLogs(1);
  for (const log of logs) {
    expect(log.length).toBeGreaterThan(0.44);
    expect(log.length).toBeLessThan(0.56);
    expect(log.radius).toBeGreaterThan(0.044);
    expect(log.radius).toBeLessThan(0.056);
  }
  expect(new Set(logs.map((log) => log.length)).size).toBeGreaterThan(1);
  expect(new Set(logs.map((log) => log.radius)).size).toBeGreaterThan(1);
});

test("the piles are stacked pyramids on the ground within the tile", () => {
  const logs = getWoodStorageLogs(1);
  const firstPile = logs.slice(0, 10);
  expect(new Set(firstPile.map((log) => log.y)).size).toBe(4);
  expect(Math.min(...logs.map((log) => log.y))).toBeGreaterThan(0);
  for (const log of logs) {
    expect(Math.hypot(log.x, log.z)).toBeLessThan(0.866);
  }
});

test("a log is a 6-segment cylinder with 24 triangles", () => {
  const { bark, endGrain } = buildLogGeometry(
    getWoodStorageLogs(1).slice(0, 1),
  );
  expect(bark.indices.length / 3).toBe(12);
  expect(endGrain.indices.length / 3).toBe(12);
});

test("the whole yard stays below 1,000 triangles with valid indices", () => {
  const { bark, endGrain } = buildLogGeometry(getWoodStorageLogs(1));
  const triangles = (bark.indices.length + endGrain.indices.length) / 3;
  expect(triangles).toBe(720);
  for (const geometry of [bark, endGrain]) {
    expect(geometry.normals).toHaveLength(geometry.positions.length);
    const vertices = geometry.positions.length / 3;
    expect(Math.max(...geometry.indices)).toBe(vertices - 1);
    expect(Math.min(...geometry.indices)).toBe(0);
    for (let i = 0; i < geometry.normals.length; i += 3) {
      expect(
        Math.hypot(
          geometry.normals[i],
          geometry.normals[i + 1],
          geometry.normals[i + 2],
        ),
      ).toBeCloseTo(1);
    }
  }
});
