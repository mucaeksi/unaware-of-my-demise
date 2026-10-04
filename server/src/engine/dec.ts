// Exact decimal number, the subset of Python's `decimal.Decimal` the game uses (port of core/progression/dec.gd, which
// carries BigNat + FloatRepr; BigInt covers both here). Value = unscaled / 10^scale.
//
// The reference resolves stats with `Decimal(str(value))` and rounds half up (ties away from zero) at the end, so binary
// floats never decide a tie. Scale rules match Decimal: addition keeps the larger scale, multiplication adds the scales.

const pow10 = (exponent: number): bigint => 10n ** BigInt(exponent);
const abs = (value: bigint): bigint => (value < 0n ? -value : value);

export class Dec {
  private constructor(
    readonly unscaled: bigint,
    readonly scale: number,
  ) {}

  static of(unscaled: bigint | number, scale = 0): Dec {
    return new Dec(BigInt(unscaled), scale);
  }

  static fromInt(value: number | bigint): Dec {
    return new Dec(BigInt(value), 0);
  }

  /**
   * `Decimal(str(value))` for a double. JavaScript's shortest round-trip formatting prints the same digits as Python's
   * repr; a whole float such as 40.0 becomes 40 (scale 0), as in the GDScript port (same value, only the scale differs).
   */
  static fromNumber(value: number): Dec {
    if (!Number.isFinite(value)) throw new RangeError("Dec.fromNumber: value must be finite");
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(value));
    if (!match) throw new RangeError(`Dec.fromNumber: unexpected format ${String(value)}`);
    const [, sign, whole, fraction = "", exponent = "0"] = match;
    let unscaled = BigInt(whole! + fraction);
    if (sign) unscaled = -unscaled;
    const scale = fraction.length - Number(exponent);
    return scale >= 0 ? new Dec(unscaled, scale) : new Dec(unscaled * pow10(-scale), 0);
  }

  /** Parses "12", "-0.05", "3.10" exactly (null for anything else). */
  static parse(text: string): Dec | null {
    const match = /^\s*([+-]?)(\d*)(?:\.(\d*))?\s*$/.exec(text);
    if (!match || (match[2] === "" && (match[3] ?? "") === "")) return null;
    const fraction = match[3] ?? "";
    const unscaled = BigInt((match[2] || "0") + fraction);
    return new Dec(match[1] === "-" ? -unscaled : unscaled, fraction.length);
  }

  private at(scale: number): bigint {
    return scale >= this.scale ? this.unscaled * pow10(scale - this.scale) : this.unscaled / pow10(this.scale - scale);
  }

  add(other: Dec): Dec {
    const scale = Math.max(this.scale, other.scale);
    return new Dec(this.at(scale) + other.at(scale), scale);
  }

  sub(other: Dec): Dec {
    return this.add(other.neg());
  }

  neg(): Dec {
    return new Dec(-this.unscaled, this.scale);
  }

  mul(other: Dec): Dec {
    return new Dec(this.unscaled * other.unscaled, this.scale + other.scale);
  }

  mulInt(factor: number | bigint): Dec {
    return this.mul(Dec.fromInt(factor));
  }

  /** Numeric comparison, scale-independent. */
  compare(other: Dec): -1 | 0 | 1 {
    const scale = Math.max(this.scale, other.scale);
    const left = this.at(scale);
    const right = other.at(scale);
    return left > right ? 1 : left < right ? -1 : 0;
  }

  equals(other: Dec): boolean {
    return this.compare(other) === 0;
  }

  isZero(): boolean {
    return this.unscaled === 0n;
  }

  greaterThan(other: Dec): boolean {
    return this.compare(other) > 0;
  }

  /** `int(value)`: the integer part, truncating toward zero. */
  toIntTruncated(): number {
    return Number(this.scale > 0 ? this.unscaled / pow10(this.scale) : this.at(0));
  }

  /** `value.quantize(Decimal(10) ** -places, rounding=ROUND_HALF_UP)`: ties away from zero. */
  quantizeHalfUp(places: number): Dec {
    if (this.scale <= places) return new Dec(this.at(places), places);
    const divisor = pow10(this.scale - places);
    const magnitude = abs(this.unscaled);
    let quotient = magnitude / divisor;
    if ((magnitude % divisor) * 2n >= divisor) quotient += 1n;
    return new Dec(this.unscaled < 0n ? -quotient : quotient, places);
  }

  /** `int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))`. */
  roundHalfUp(): number {
    return Number(this.quantizeHalfUp(0).unscaled);
  }

  /** `float(Decimal)`: correctly rounded (via the exact decimal text). */
  toNumber(): number {
    return Number(this.toText());
  }

  /** Exact text like Python's `format(value, "f")` (keeps trailing zeros of the scale). */
  toText(): string {
    const negative = this.unscaled < 0n;
    let digits = abs(this.unscaled).toString();
    let text: string;
    if (this.scale <= 0) {
      text = digits === "0" ? "0" : digits + "0".repeat(-this.scale);
    } else {
      digits = digits.padStart(this.scale + 1, "0");
      text = `${digits.slice(0, digits.length - this.scale)}.${digits.slice(digits.length - this.scale)}`;
    }
    return negative ? `-${text}` : text;
  }
}
