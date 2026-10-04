// Exact rational number: the subset of Python's `fractions.Fraction` the Action Gauge needs (port of
// core/battle/frac.gd). Gauge maths must be exact because ties between units are decided by comparing overshoots
// (parity/fixtures/battle_*.json). BigInt keeps it exact at any size, like Python, so the GDScript port's int64 overflow
// guard has no counterpart here.

const abs = (value: bigint): bigint => (value < 0n ? -value : value);

function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

export class Frac {
  /** Always reduced, denominator positive. */
  private constructor(
    readonly num: bigint,
    readonly den: bigint,
  ) {}

  static of(numerator: bigint | number, denominator: bigint | number = 1n): Frac {
    let n = BigInt(numerator);
    let d = BigInt(denominator);
    if (d === 0n) throw new RangeError("Frac: zero denominator");
    if (d < 0n) [n, d] = [-n, -d];
    const divisor = gcd(n, d);
    return divisor > 1n ? new Frac(n / divisor, d / divisor) : new Frac(n, d);
  }

  /**
   * `Fraction(str(value))` for a JSON number: the exact decimal the number is written as (0.3 -> 3/10). JavaScript's
   * shortest round-trip formatting yields the same digits as Python's repr (only the exponent notation differs).
   */
  static fromNumber(value: number): Frac {
    if (!Number.isFinite(value)) throw new RangeError("Frac.fromNumber: not a finite number");
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(value));
    if (!match) throw new RangeError(`Frac.fromNumber: unexpected format ${String(value)}`);
    const [, sign, whole, fraction = "", exponent = "0"] = match;
    const scale = fraction.length - Number(exponent);
    let numerator = BigInt(whole! + fraction);
    if (sign) numerator = -numerator;
    return scale >= 0 ? Frac.of(numerator, 10n ** BigInt(scale)) : Frac.of(numerator * 10n ** BigInt(-scale));
  }

  add(other: Frac): Frac {
    return Frac.of(this.num * other.den + other.num * this.den, this.den * other.den);
  }

  sub(other: Frac): Frac {
    return this.add(other.neg());
  }

  neg(): Frac {
    return new Frac(-this.num, this.den);
  }

  mul(other: Frac): Frac {
    return Frac.of(this.num * other.num, this.den * other.den);
  }

  mulInt(factor: bigint | number): Frac {
    return Frac.of(this.num * BigInt(factor), this.den);
  }

  divInt(divisor: bigint | number): Frac {
    return Frac.of(this.num, this.den * BigInt(divisor));
  }

  compare(other: Frac): -1 | 0 | 1 {
    const left = this.num * other.den;
    const right = other.num * this.den;
    return left > right ? 1 : left < right ? -1 : 0;
  }

  lessThan(other: Frac): boolean {
    return this.compare(other) < 0;
  }

  lessOrEqual(other: Frac): boolean {
    return this.compare(other) <= 0;
  }

  greaterOrEqual(other: Frac): boolean {
    return this.compare(other) >= 0;
  }

  equals(other: Frac): boolean {
    return this.num === other.num && this.den === other.den;
  }

  isZero(): boolean {
    return this.num === 0n;
  }

  static minimum(a: Frac, b: Frac): Frac {
    return a.compare(b) <= 0 ? a : b;
  }

  static maximum(a: Frac, b: Frac): Frac {
    return a.compare(b) >= 0 ? a : b;
  }

  /** `math.floor(fraction)`. */
  floor(): bigint {
    const quotient = this.num / this.den;
    return this.num < 0n && quotient * this.den !== this.num ? quotient - 1n : quotient;
  }

  /** `math.ceil(fraction)`. */
  ceil(): bigint {
    const quotient = this.num / this.den;
    return this.num > 0n && quotient * this.den !== this.num ? quotient + 1n : quotient;
  }

  toNumber(): number {
    return Number(this.num) / Number(this.den);
  }

  /** Python's `str(Fraction)`: "3" or "3/7". */
  toString(): string {
    return this.den === 1n ? `${this.num}` : `${this.num}/${this.den}`;
  }
}
