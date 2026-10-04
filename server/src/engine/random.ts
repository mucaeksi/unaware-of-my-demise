// Bit-exact port of CPython's `random.Random` (MT19937) for the calls the game uses (DEC-0013).
// Third implementation next to LEGACY Python and game/scripts/core/rng/cpython_random.gd; all three reproduce
// parity/fixtures/rng.json draw for draw. Reference: CPython 3.11-3.13 Modules/_randommodule.c and Lib/random.py.
//
// The generator works on 32-bit words held in plain numbers (`>>> 0`, Math.imul). Seeds and draws wider than 53 bits use
// BigInt: `seedBig`, `getrandbitsBig`, `randbelowBig`, `randrangeBig`. The number variants are for safe integers.

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;
const TWO_POW_53 = 9007199254740992;
const TWO_POW_32 = 4294967296;

/** abs(value) as 32-bit little-endian words ([0] for 0): the key CPython's init_by_array receives. */
export function wordsFromBig(value: bigint): number[] {
  let rest = value < 0n ? -value : value;
  const words: number[] = [];
  while (rest > 0n) {
    words.push(Number(rest & 0xffffffffn));
    rest >>= 32n;
  }
  return words.length > 0 ? words : [0];
}

const bitLength = (value: bigint): number => (value <= 0n ? 0 : value.toString(2).length);

export class CpythonRandom {
  private readonly mt = new Uint32Array(N);
  private index = N;

  constructor(seed: bigint | number = 0n) {
    this.seedBig(BigInt(seed));
  }

  /** `random.Random(value)`: abs(value), any width. */
  seedBig(value: bigint): void {
    this.seedWords(wordsFromBig(value));
  }

  /** init_by_array with 32-bit little-endian key words; an empty key is [0]. */
  seedWords(words: readonly number[]): void {
    const key = words.length > 0 ? words : [0];
    const mt = this.mt;
    mt[0] = 19650218;
    for (let i = 1; i < N; i++) {
      const prev = mt[i - 1]!;
      mt[i] = (Math.imul(1812433253, (prev ^ (prev >>> 30)) >>> 0) + i) >>> 0;
    }
    let i = 1;
    let j = 0;
    for (let k = Math.max(N, key.length); k > 0; k--) {
      const prev = mt[i - 1]!;
      mt[i] = ((mt[i]! ^ Math.imul((prev ^ (prev >>> 30)) >>> 0, 1664525)) >>> 0) + (key[j]! >>> 0) + j;
      i++;
      j++;
      if (i >= N) {
        mt[0] = mt[N - 1]!;
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = N - 1; k > 0; k--) {
      const prev = mt[i - 1]!;
      mt[i] = (((mt[i]! ^ Math.imul((prev ^ (prev >>> 30)) >>> 0, 1566083941)) >>> 0) - i) >>> 0;
      i++;
      if (i >= N) {
        mt[0] = mt[N - 1]!;
        i = 1;
      }
    }
    mt[0] = 0x80000000;
    this.index = N;
  }

  private twist(): void {
    const mt = this.mt;
    for (let kk = 0; kk < N; kk++) {
      const y = (mt[kk]! & UPPER_MASK) | (mt[(kk + 1) % N]! & LOWER_MASK);
      mt[kk] = mt[(kk + M) % N]! ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
    }
    this.index = 0;
  }

  /** One tempered 32-bit output word (`genrand_uint32`). */
  nextU32(): number {
    if (this.index >= N) this.twist();
    let y = this.mt[this.index++]!;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** The exact 53-bit numerator of `random()`. */
  randomU53(): number {
    const a = this.nextU32() >>> 5;
    const b = this.nextU32() >>> 6;
    return a * 67108864 + b;
  }

  /** `random.random()`. */
  random(): number {
    return this.randomU53() / TWO_POW_53;
  }

  /** `random.getrandbits(k)`, any k >= 0 (first word generated = lowest bits). */
  getrandbitsBig(bits: number): bigint {
    if (!Number.isInteger(bits) || bits < 0) throw new RangeError("number of bits must be non-negative");
    let result = 0n;
    let shift = 0n;
    for (let remaining = bits; remaining > 0; remaining -= 32) {
      let word = this.nextU32();
      if (remaining < 32) word >>>= 32 - remaining;
      result |= BigInt(word) << shift;
      shift += 32n;
    }
    return result;
  }

  /** `random.getrandbits(k)` for 0 <= k <= 32. */
  getrandbits(bits: number): number {
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) throw new RangeError("getrandbits(number) takes 0..32 bits");
    return bits === 0 ? 0 : this.nextU32() >>> (32 - bits);
  }

  /** `Random._randbelow_with_getrandbits(n)`, n >= 1: uniform in [0, n). */
  randbelowBig(limit: bigint): bigint {
    if (limit < 1n) throw new RangeError("randbelow needs n >= 1");
    const bits = bitLength(limit);
    let value = this.getrandbitsBig(bits);
    while (value >= limit) value = this.getrandbitsBig(bits);
    return value;
  }

  /** `randbelow` for a safe-integer bound (a 32-bit fast path for bounds below 2^32). */
  randbelow(limit: number): number {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("randbelow needs a safe integer n >= 1");
    if (limit >= TWO_POW_32) return Number(this.randbelowBig(BigInt(limit)));
    const bits = 32 - Math.clz32(limit);
    let value = this.getrandbits(bits);
    while (value >= limit) value = this.getrandbits(bits);
    return value;
  }

  /** `random.randrange(start, stop, step)`; Python's ValueError cases throw RangeError. */
  randrangeBig(start: bigint, stop?: bigint, step = 1n): bigint {
    if (stop === undefined) {
      if (start <= 0n) throw new RangeError("empty range for randrange()");
      return this.randbelowBig(start);
    }
    const width = stop - start;
    if (step === 1n) {
      if (width <= 0n) throw new RangeError("empty range for randrange()");
      return start + this.randbelowBig(width);
    }
    if (step === 0n) throw new RangeError("zero step for randrange()");
    // Python's floor division of (width + step -/+ 1) by step.
    const numerator = step > 0n ? width + step - 1n : width + step + 1n;
    const count = numerator / step - (numerator % step !== 0n && (numerator < 0n) !== (step < 0n) ? 1n : 0n);
    if (count <= 0n) throw new RangeError("empty range for randrange()");
    return start + step * this.randbelowBig(count);
  }

  randrange(start: number, stop?: number, step = 1): number {
    return Number(this.randrangeBig(BigInt(start), stop === undefined ? undefined : BigInt(stop), BigInt(step)));
  }

  /** `random.randint(a, b)` = randrange(a, b + 1). */
  randint(low: number, high: number): number {
    return this.randrange(low, high + 1);
  }

  /** The index `random.choice(seq)` picks for a sequence of `length` items. */
  choiceIndex(length: number): number {
    if (length < 1) throw new RangeError("Cannot choose from an empty sequence");
    return this.randbelow(length);
  }

  choice<T>(items: readonly T[]): T {
    return items[this.choiceIndex(items.length)]!;
  }

  /** `random.shuffle(x)` in place (Fisher-Yates from the end, CPython's exact loop). */
  shuffle<T>(items: T[]): void {
    for (let position = items.length - 1; position > 0; position--) {
      const other = this.randbelow(position + 1);
      [items[position], items[other]] = [items[other]!, items[position]!];
    }
  }

  /** The state in the shape parity/fixtures/rng.json records it (tests). */
  stateWords(): { index: number; words: Uint32Array } {
    return { index: this.index, words: this.mt.slice() };
  }
}
