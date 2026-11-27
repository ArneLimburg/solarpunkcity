import { test, expect } from "./fixtures";
import {
  buildingAt,
  finishConstruction,
  grantWood,
  selectBuilding,
  tilePosition,
} from "./helpers";

test("the menu offers the wind turbine under Energy and builds it on a forest tile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await selectBuilding(page, "Energy", "Wind turbine");
  await expect(page.getByTestId("build-cost-WindTurbine")).toHaveText(/10$/);
  const tile = { q: -2, r: -2 };
  const { x, y } = await tilePosition(page, tile);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, tile)).toBe("WindTurbine");
  // the rotor of a construction site stands still: it has no turning rotor
  await page.waitForTimeout(300);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getRotorMatrix(c), tile),
  ).toBeUndefined();
  await finishConstruction(page);
  await expect
    .poll(() =>
      page.evaluate((c) => window.__solarpunk?.getRotorMatrix(c), tile),
    )
    .toHaveLength(16);
  expect(errors).toEqual([]);
});

test("a finished wind turbine shows a model and its rotor turns", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const first = { q: -3, r: 1 };
  const second = { q: -4, r: 1 };
  await page.evaluate(
    ([a, b]) => {
      window.__solarpunk?.addWindTurbine(a);
      window.__solarpunk?.addWindTurbine(b);
    },
    [first, second],
  );
  for (const tile of [first, second]) {
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
  const matrix = (tile: typeof first) =>
    page.evaluate((c) => window.__solarpunk?.getRotorMatrix(c), tile);
  const before = await matrix(first);
  expect(before).toHaveLength(16);
  // the rotor turns between two frames
  await expect
    .poll(async () => (await matrix(first))?.join())
    .not.toBe(before?.join());
  // the rotors do not turn in sync
  expect((await matrix(first))?.join()).not.toBe(
    (await matrix(second))?.join(),
  );
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
