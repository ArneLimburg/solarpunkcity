import { expect, test } from "vitest";
import { resourceIcons, stockResources } from "../src/resourceIcons";
import { emptyResources } from "../src/resources";

test("every resource has an icon", () => {
  expect(Object.keys(resourceIcons).sort()).toEqual(
    Object.keys(emptyResources).sort(),
  );
  expect(resourceIcons.water).toBe("water_drop");
});

test("stock resources have icons", () => {
  for (const name of stockResources) {
    expect(resourceIcons[name]).toBeTruthy();
  }
});
