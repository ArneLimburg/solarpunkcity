import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Linter } from "eslint";
import { expect, test } from "vitest";
// @ts-expect-error plain JavaScript ESLint rule without type declarations
import plugin from "../eslint-rules/no-case-collision.js";

const lintFile = (dir: string, file: string) =>
  new Linter({ cwd: dir }).verify(
    "",
    [
      {
        files: ["**/*.ts"],
        plugins: { local: plugin },
        rules: { "local/no-case-collision": "error" },
      },
    ],
    { filename: join(dir, file) },
  );

test("reports files that differ only in casing and names both", () => {
  const dir = mkdtempSync(join(tmpdir(), "case-"));
  try {
    writeFileSync(join(dir, "board.ts"), "");
    writeFileSync(join(dir, "Board.ts"), "");
    writeFileSync(join(dir, "board.test.ts"), "");
    const messages = lintFile(dir, "Board.ts");
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain('"Board.ts"');
    expect(messages[0].message).toContain('"board.ts"');
    expect(lintFile(dir, "board.ts")).toHaveLength(1);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("accepts files with identical stems and unrelated names", () => {
  const dir = mkdtempSync(join(tmpdir(), "case-"));
  try {
    writeFileSync(join(dir, "farms.ts"), "");
    writeFileSync(join(dir, "farms.tsx"), "");
    writeFileSync(join(dir, "farms.test.ts"), "");
    expect(lintFile(dir, "farms.ts")).toHaveLength(0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
