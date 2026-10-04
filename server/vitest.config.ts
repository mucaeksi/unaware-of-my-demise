import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Each suite creates its own disposable database (test/db.ts); run the files one after another.
    fileParallelism: false,
    // The one-line request logs (INF-011) of every API test would drown the output; their content is tested in observability.test.ts.
    onConsoleLog: (log) => !log.startsWith('{"event":"request"'),
  },
});
