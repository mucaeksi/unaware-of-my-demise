import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Each suite creates its own disposable database (test/db.ts); run the files one after another.
    fileParallelism: false,
  },
});
