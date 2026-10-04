// Helpers that give the battle port the Python semantics it depends on (port of core/battle/battle_util.gd plus the
// GDScript Variant conversions the battle files use): stable sorting with tuple keys (`sorted(key=...)`), first-minimum
// selection (`min(..., key=...)`), `list.remove` with deep equality, Python truthiness, and `dict.get(key, default)`
// that returns a stored null.
import { Frac } from "../frac";

/** An authored or event dictionary (status payloads, shields, modifiers, events). Keys are never integer-like. */
export type Dict = Record<string, unknown>;

export type SortKey = readonly unknown[];

export const isDict = (value: unknown): value is Dict =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

/** GDScript `dict.get(key, default)`: the stored value (even null) when the key exists. */
export function dget(map: Dict, key: string, fallback: unknown = null): unknown {
  return Object.hasOwn(map, key) ? map[key] : fallback;
}

/** `dict.get(key, {})` as a Dict (a stored non-Dict reads as empty, like a typed GDScript cast would fail closed). */
export function dgetDict(map: Dict, key: string): Dict {
  const value = dget(map, key, null);
  return isDict(value) ? value : {};
}

/** `dict.get(key, [])` as an array. */
export function dgetArray(map: Dict, key: string): unknown[] {
  const value = dget(map, key, null);
  return Array.isArray(value) ? value : [];
}

/** GDScript `float(x)`. */
export function toFloat(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

/** GDScript `int(x)`: truncation toward zero. */
export const toInt = (value: unknown): number => Math.trunc(toFloat(value));

/** GDScript `bool(x)`. */
export function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return truthy(value);
}

/** GDScript `str(x)` for the values the battle code stringifies (ids, status ids, authored names). */
export function str(value: unknown): string {
  if (value === null || value === undefined) return "<null>";
  return String(value);
}

/** Python truthiness (`_truthy` in the GDScript files). */
export function truthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string" || Array.isArray(value)) return value.length > 0;
  if (value instanceof Map) return value.size > 0;
  if (isDict(value)) return Object.keys(value).length > 0;
  return true;
}

/** Lexicographic "less than" of two key tuples (numbers by value, strings by code point, Fracs exactly). */
export function keyLess(a: SortKey, b: SortKey): boolean {
  const count = Math.min(a.length, b.length);
  for (let index = 0; index < count; index++) {
    const left = a[index];
    const right = b[index];
    if (left instanceof Frac && right instanceof Frac) {
      const order = left.compare(right);
      if (order !== 0) return order < 0;
    } else if (left !== right) {
      return (left as number) < (right as number);
    }
  }
  return a.length < b.length;
}

/** Stable sort by `keyFn(item)` (a tuple), like Python's `sorted(items, key=...)`. */
export function sortedBy<T>(items: readonly T[], keyFn: (item: T) => SortKey): T[] {
  const keyed = items.map((item) => ({ key: keyFn(item), item }));
  // Insertion sort, as the GDScript port: stable, and the collections are tiny.
  for (let index = 1; index < keyed.length; index++) {
    const current = keyed[index]!;
    let position = index - 1;
    while (position >= 0 && keyLess(current.key, keyed[position]!.key)) {
      keyed[position + 1] = keyed[position]!;
      position--;
    }
    keyed[position + 1] = current;
  }
  return keyed.map((entry) => entry.item);
}

/** The first item whose key is minimal (Python's `min(items, key=...)`); null for an empty collection. */
export function minBy<T>(items: readonly T[], keyFn: (item: T) => SortKey): T | null {
  let best: T | null = null;
  let bestKey: SortKey = [];
  let first = true;
  for (const item of items) {
    const key = keyFn(item);
    if (first || keyLess(key, bestKey)) {
      best = item;
      bestKey = key;
      first = false;
    }
  }
  return best;
}

/** Keys as a sorted list (`tuple(sorted(mapping))`). */
export function sortedKeys(map: ReadonlyMap<string, unknown> | Dict): string[] {
  const keys = map instanceof Map ? [...map.keys()] : Object.keys(map);
  return keys.sort();
}

/** Godot's `==` on Variants: numbers by value, arrays and dictionaries by content (recursively). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isDict(a) && isDict(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
  }
  if (a instanceof Frac && b instanceof Frac) return a.equals(b);
  return false;
}

/** `list.remove(x)`: removes the first element identical or equal to `value`. */
export function removeFirstEqual<T>(items: T[], value: T): boolean {
  for (let index = 0; index < items.length; index++) {
    if (items[index] === value || deepEqual(items[index], value)) {
      items.splice(index, 1);
      return true;
    }
  }
  return false;
}

/** Keys in insertion order (`tuple(mapping)`). */
export const keysInOrder = (map: ReadonlyMap<string, unknown>): string[] => [...map.keys()];

/** Appends `item` unless already present (the GDScript `Array[String]` used as a set). */
export function addUnique(items: string[], item: string): void {
  if (!items.includes(item)) items.push(item);
}
