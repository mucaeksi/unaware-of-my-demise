import { describe, expect, it } from "vitest";
import { crc32Bytes, crc32Text } from "../../src/engine/crc32";
import { Frac } from "../../src/engine/frac";
import { loadFixture } from "./fixtures";

const crc = loadFixture<{ cases: { input_hex: string; crc32: number }[] }>("crc32");

describe("crc32 against parity/fixtures/crc32.json", () => {
  it("matches every recorded input", () => {
    expect(crc.cases.length).toBeGreaterThan(0);
    for (const { input_hex, crc32 } of crc.cases) expect(crc32Bytes(Buffer.from(input_hex, "hex")), input_hex).toBe(crc32);
  });

  it("hashes text as UTF-8 and continues from a previous value", () => {
    expect(crc32Text("abc")).toBe(891568578);
    expect(crc32Bytes(Buffer.from("c"), crc32Text("ab"))).toBe(crc32Text("abc"));
  });
});

describe("Frac (Python fractions.Fraction semantics)", () => {
  it("stays reduced with a positive denominator", () => {
    expect(Frac.of(6, -8).toString()).toBe("-3/4");
    expect(Frac.of(10, 5).toString()).toBe("2");
    expect(() => Frac.of(1, 0)).toThrow(RangeError);
  });

  it("reads a JSON number as the decimal it is written as", () => {
    expect(Frac.fromNumber(0.3).toString()).toBe("3/10");
    expect(Frac.fromNumber(2.75).toString()).toBe("11/4");
    expect(Frac.fromNumber(0.00001).toString()).toBe("1/100000");
    expect(Frac.fromNumber(-1.5e21).toString()).toBe("-1500000000000000000000");
    expect(Frac.fromNumber(120).toString()).toBe("120");
  });

  it("does exact arithmetic and ordering", () => {
    const third = Frac.of(1, 3);
    expect(third.add(Frac.of(1, 6)).toString()).toBe("1/2");
    expect(third.sub(Frac.of(1, 2)).toString()).toBe("-1/6");
    expect(third.mul(Frac.of(3, 4)).toString()).toBe("1/4");
    expect(third.mulInt(6).toString()).toBe("2");
    expect(third.divInt(-2).toString()).toBe("-1/6");
    expect(Frac.of(2, 6).equals(third)).toBe(true);
    expect(third.compare(Frac.of(1, 2))).toBe(-1);
    expect(Frac.minimum(third, Frac.of(1, 4)).toString()).toBe("1/4");
    expect(Frac.maximum(third, Frac.of(1, 4)).toString()).toBe("1/3");
  });

  it("floors and ceils like math.floor / math.ceil", () => {
    expect(Frac.of(7, 2).floor()).toBe(3n);
    expect(Frac.of(7, 2).ceil()).toBe(4n);
    expect(Frac.of(-7, 2).floor()).toBe(-4n);
    expect(Frac.of(-7, 2).ceil()).toBe(-3n);
    expect(Frac.of(4).ceil()).toBe(4n);
  });
});
