import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CpythonRandom, wordsFromBig } from "../../src/engine/random";
import { loadFixture } from "./fixtures";

// parity/fixtures/rng.json: CPython random.Random, recorded by the Python reference (integers are decimal strings).
interface RngCase {
  seed: string;
  seed_abs_words: (number | string)[];
  state_after_seed: { index: number; words_head: number[]; words_tail: number[]; words_sha256: string };
  random: { u53: number; value: number }[];
  getrandbits: { bits: number; values: string[]; values_hex: string[] }[];
  randrange: { args: string[]; values: string[] }[];
  randint: { args: string[]; values: string[] }[];
  choice: { length: number; values: string[] }[];
  shuffle: { length: number; first: number[]; second: number[] }[];
  script: { op: string; args: string[]; value: unknown }[];
}

const fixture = loadFixture<{ family: string; cases: RngCase[] }>("rng");
const rngFor = (rngCase: RngCase): CpythonRandom => new CpythonRandom(BigInt(rngCase.seed));
const range = (length: number): number[] => Array.from({ length }, (_, index) => index);

describe("CpythonRandom against parity/fixtures/rng.json", () => {
  it("covers all eleven seeds", () => {
    expect(fixture.family).toBe("rng");
    expect(fixture.cases.length).toBe(11);
  });

  for (const rngCase of fixture.cases) {
    describe(`seed ${rngCase.seed}`, () => {
      it("splits abs(seed) into the recorded key words and reaches the recorded state", () => {
        expect(wordsFromBig(BigInt(rngCase.seed))).toEqual(rngCase.seed_abs_words.map(Number));
        const { index, words } = rngFor(rngCase).stateWords();
        expect(index).toBe(rngCase.state_after_seed.index);
        expect(Array.from(words.slice(0, 8))).toEqual(rngCase.state_after_seed.words_head);
        expect(Array.from(words.slice(-4))).toEqual(rngCase.state_after_seed.words_tail);
        const littleEndian = Buffer.from(new Uint8Array(new Uint32Array(words).buffer));
        expect(createHash("sha256").update(littleEndian).digest("hex")).toBe(rngCase.state_after_seed.words_sha256);
      });

      it("random() reproduces the exact numerator and double", () => {
        const rng = rngFor(rngCase);
        for (const draw of rngCase.random) {
          const numerator = rng.randomU53();
          expect(numerator).toBe(draw.u53);
          expect(numerator / 2 ** 53).toBe(draw.value);
        }
      });

      it("getrandbits at every width", () => {
        for (const entry of rngCase.getrandbits) {
          const wide = rngFor(rngCase);
          const narrow = rngFor(rngCase);
          entry.values.forEach((value, position) => {
            expect(wide.getrandbitsBig(entry.bits), `getrandbits(${entry.bits}) #${position}`).toBe(BigInt(value));
            if (entry.bits <= 32) expect(narrow.getrandbits(entry.bits)).toBe(Number(value));
          });
        }
      });

      it("randrange and randint", () => {
        for (const entry of rngCase.randrange) {
          const rng = rngFor(rngCase);
          const [start, stop, step] = entry.args.map(BigInt);
          for (const value of entry.values) expect(rng.randrangeBig(start!, stop, step), `randrange(${entry.args})`).toBe(BigInt(value));
        }
        for (const entry of rngCase.randint) {
          const rng = rngFor(rngCase);
          const [low, high] = entry.args.map(BigInt);
          for (const value of entry.values) expect(rng.randrangeBig(low!, high! + 1n), `randint(${entry.args})`).toBe(BigInt(value));
        }
      });

      it("choice and shuffle", () => {
        for (const entry of rngCase.choice) {
          const rng = rngFor(rngCase);
          for (const value of entry.values) expect(rng.choiceIndex(entry.length)).toBe(Number(value));
        }
        for (const entry of rngCase.shuffle) {
          const rng = rngFor(rngCase);
          for (const expected of [entry.first, entry.second]) {
            const items = range(entry.length);
            rng.shuffle(items);
            expect(items).toEqual(expected);
          }
        }
      });

      it("a mixed script of calls stays in step", () => {
        const rng = rngFor(rngCase);
        for (const step of rngCase.script) {
          const args = step.args.map(Number);
          switch (step.op) {
            case "random":
              expect(rng.random()).toBe(step.value);
              break;
            case "getrandbits":
              expect(rng.getrandbitsBig(args[0]!)).toBe(BigInt(step.value as string));
              break;
            case "randrange":
              expect(rng.randrangeBig(...(step.args.map(BigInt) as [bigint, bigint?, bigint?]))).toBe(BigInt(step.value as string));
              break;
            case "randint":
              expect(rng.randint(args[0]!, args[1]!)).toBe(Number(step.value));
              break;
            case "choice":
              expect(rng.choiceIndex(args[0]!)).toBe(Number(step.value));
              break;
            case "shuffle": {
              const items = range(args[0]!);
              rng.shuffle(items);
              expect(items).toEqual(step.value);
              break;
            }
            default:
              throw new Error(`unknown script op ${step.op}`);
          }
        }
      });
    });
  }

  it("rejects what Python rejects", () => {
    const rng = new CpythonRandom(1);
    expect(() => rng.randrange(5, 5)).toThrow(RangeError);
    expect(() => rng.randrange(0, 10, 0)).toThrow(RangeError);
    expect(() => rng.choice([])).toThrow(RangeError);
  });
});
