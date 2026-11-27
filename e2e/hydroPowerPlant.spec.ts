import { test, expect } from "./fixtures";
import { GRID_RADIUS, getRiverCourse } from "../src/board";

test("a hydro power plant shows its model and keeps the river water", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const course = getRiverCourse(GRID_RADIUS);
  // a bent and a straight part of the river
  const tiles = [course[4], course[10]];
  for (const tile of tiles) {
    expect(
      await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), tile),
    ).toBe("water");
    await page.evaluate((c) => window.__solarpunk?.addHydroPowerPlant(c), tile);
    expect(
      await page.evaluate((c) => window.__solarpunk?.getBuildingType(c), tile),
    ).toBe("HydroPowerPlant");
    expect(
      await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), tile),
    ).toBe("water");
    expect(
      await page.evaluate((c) => window.__solarpunk?.getModelCount(c), tile),
    ).toBe(1);
    const triangles = await page.evaluate(
      (c) => window.__solarpunk?.getModelTriangleCount(c),
      tile,
    );
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThan(1000);
  }
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
