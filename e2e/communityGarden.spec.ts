import { test, expect } from "./fixtures";
import { buildingAt } from "./helpers";

test("the community garden is not offered in the menu and the game keeps running", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const garden = { q: -2, r: 3 };
  await page.evaluate((c) => window.__solarpunk?.addCommunityGarden(c), garden);
  expect(await buildingAt(page, garden)).toBe("CommunityGarden");
  expect(
    await page.evaluate(
      (c) => window.__solarpunk?.isUnderConstruction(c),
      garden,
    ),
  ).toBe(false);
  // no model yet
  expect(
    await page.evaluate((c) => window.__solarpunk?.getModelCount(c), garden),
  ).toBe(0);
  await page.getByRole("button", { name: /^Build/ }).click();
  await expect(page.getByRole("tab", { name: "Leisure" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /community garden/i }),
  ).toHaveCount(0);
  // the weekly tick keeps running
  const week = page.getByTestId("hud-date-button");
  const before = await week.textContent();
  await expect.poll(() => week.textContent()).not.toBe(before);
  expect(await buildingAt(page, garden)).toBe("CommunityGarden");
  expect(errors).toEqual([]);
});
