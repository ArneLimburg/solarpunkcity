import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/solarpunkcity/",
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
