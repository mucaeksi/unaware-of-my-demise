// The golden fixtures the Python reference wrote to <repo>/parity/fixtures (see parity/README.md), shared with the
// GDScript port (game/tests/parity/parity_fixtures.gd).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES = join(import.meta.dirname, "..", "..", "..", "parity", "fixtures");

export function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as T;
}
