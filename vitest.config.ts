import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // les tests ne chargent pas .env : secret dédié, jamais celui de production
    env: { SESSION_SECRET: "test-only-secret-32-characters-min" },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
