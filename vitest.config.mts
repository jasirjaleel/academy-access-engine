import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    tsconfigPaths: true,
    // "server-only" throws outside Next.js; it's a no-op in tests.
    alias: { "server-only": new URL("./tests/helpers/empty.ts", import.meta.url).pathname },
  },
});
