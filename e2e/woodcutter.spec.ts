import { test, expect } from "./fixtures";

test("a woodcutter renders its model and a second one adds no draw calls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const first = { q: 3, r: -4 };
  const second = { q: -3, r: 4 };
  const drawCalls = async () => {
    await page.waitForTimeout(300);
    return page.evaluate(
      () => window.__solarpunk!.getBackdropStats().drawCalls,
    );
  };
  const before = await drawCalls();
  await page.evaluate((c) => window.__solarpunk?.addWoodcutter(c), first);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getBuildingType(c), first),
  ).toBe("Woodcutter");
  expect(
    await page.evaluate((c) => window.__solarpunk?.getModelCount(c), first),
  ).toBe(1);
  const triangles = await page.evaluate(
    (c) => window.__solarpunk?.getModelTriangleCount(c),
    first,
  );
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThanOrEqual(1000);
  const one = await drawCalls();
  expect(one - before).toBeLessThanOrEqual(3);
  await page.evaluate((c) => window.__solarpunk?.addWoodcutter(c), second);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getModelCount(c), second),
  ).toBe(1);
  expect(await drawCalls()).toBe(one);
  expect(errors).toEqual([]);
});
