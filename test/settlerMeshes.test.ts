import { expect, test } from "vitest";
import { NullEngine, Scene, type Mesh } from "@babylonjs/core";
import { createSettlerRenderer } from "../src/SettlerRenderer";
import { createRoster, syncRoster } from "../src/settlers";

// with the real Babylon meshes (no GPU needed)
test("a figure has at most 200 triangles and 1,000 figures need two meshes", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const renderer = createSettlerRenderer(scene, 1);
  expect(renderer.getTriangleCount()).toBeGreaterThan(0);
  expect(renderer.getTriangleCount()).toBeLessThanOrEqual(200);

  renderer.sync(syncRoster(createRoster(1), 1000));
  expect(renderer.getSettlers()).toHaveLength(1000);
  const meshes = scene.meshes.filter((mesh) =>
    mesh.name.startsWith("settler"),
  ) as Mesh[];
  expect(meshes).toHaveLength(2);
  for (const mesh of meshes) {
    expect(mesh.thinInstanceCount).toBe(1000);
    expect(mesh.isPickable).toBe(false);
    expect(mesh.isEnabled()).toBe(true);
  }

  renderer.sync(syncRoster(createRoster(1), 3));
  expect(meshes.map((mesh) => mesh.thinInstanceCount)).toEqual([3, 3]);
  renderer.sync([]);
  expect(meshes.every((mesh) => !mesh.isEnabled())).toBe(true);
  scene.dispose();
  engine.dispose();
});
