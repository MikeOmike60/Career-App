/** Deterministischer PRNG (mulberry32) + stabiler String-Hash. */

export type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  float: (min: number, max: number) => number;
  chance: (p: number) => boolean;
  pick: <T>(arr: readonly T[]) => T;
  shuffle: <T>(arr: readonly T[]) => T[];
  weighted: <T>(entries: ReadonlyArray<readonly [T, number]>) => T;
};

export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed: number | string): Rng {
  let a = (typeof seed === "string" ? hashString(seed) : seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const float = (min: number, max: number) => min + next() * (max - min);
  const int = (min: number, max: number) => Math.floor(float(min, max + 1 - 1e-9));
  return {
    next,
    float,
    int,
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)]!,
    shuffle: (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
    weighted: (entries) => {
      const total = entries.reduce((s, e) => s + e[1], 0);
      let r = next() * total;
      for (const [value, weight] of entries) {
        r -= weight;
        if (r <= 0) return value;
      }
      return entries[entries.length - 1]![0];
    },
  };
}

/** Erzeugt einen Sub-Zufallsstrom, damit Teilbereiche unabhängig reproduzierbar sind. */
export function subRng(seed: number, ...parts: Array<string | number>): Rng {
  return createRng(hashString(`${seed}|${parts.join("|")}`));
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 900000) + 100000;
}
