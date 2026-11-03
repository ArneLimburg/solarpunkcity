import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { BuildingCategories, BuildingTypes } from "../src/gameDefinitions";

const exists = (icon: string) => existsSync(join("public", icon));

test("every buildable category icon refers to an existing file", () => {
  for (const category of Object.values(BuildingCategories)) {
    if (category.buildable) {
      expect(exists(category.icon), category.icon).toBe(true);
    }
  }
});

test("every building type icon refers to an existing file", () => {
  for (const { icon } of Object.values(BuildingTypes)) {
    expect(exists(icon), icon).toBe(true);
  }
});
