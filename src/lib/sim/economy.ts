/**
 * Marktwert und Gehalt – angelehnt an reale Größenordnungen:
 * OVR 60 ≈ 1 Mio., 70 ≈ 7 Mio., 80 ≈ 38 Mio., 85 ≈ 75 Mio., 90 ≈ 135 Mio. €
 * (Spieler Mitte 20, normale Reputation, mehrjähriger Vertrag).
 */

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Stützpunkte OVR → Basiswert in €; dazwischen logarithmisch interpoliert. */
const VALUE_CURVE: Array<[number, number]> = [
  [50, 150_000],
  [55, 400_000],
  [60, 1_000_000],
  [65, 2_800_000],
  [70, 7_000_000],
  [75, 17_000_000],
  [80, 38_000_000],
  [85, 75_000_000],
  [90, 135_000_000],
  [95, 190_000_000],
  [99, 230_000_000],
];

export function baseValue(ovr: number): number {
  const o = clamp(ovr, 50, 99);
  for (let i = 1; i < VALUE_CURVE.length; i++) {
    const [o1, v1] = VALUE_CURVE[i]!;
    const [o0, v0] = VALUE_CURVE[i - 1]!;
    if (o <= o1) {
      const t = (o - o0) / (o1 - o0);
      return Math.exp(Math.log(v0) + t * (Math.log(v1) - Math.log(v0)));
    }
  }
  return VALUE_CURVE[VALUE_CURVE.length - 1]![1];
}

/** Alterskurve: Talente teuer, ab Anfang 30 deutlicher Abschlag. */
export function ageValueFactor(age: number): number {
  if (age <= 19) return 1.25;
  if (age <= 23) return 1.35;
  if (age <= 26) return 1.15;
  if (age <= 28) return 1.0;
  if (age <= 30) return 0.8;
  if (age <= 32) return 0.55;
  if (age <= 34) return 0.3;
  return 0.15;
}

export interface ValueInput {
  ovr: number;
  age: number;
  reputation: number;
  contractYears: number;
}

/** Marktwert in €, auf sinnvolle Stufen gerundet. */
export function marketValue({ ovr, age, reputation, contractYears }: ValueInput): number {
  const rep = 0.85 + clamp(reputation, 0, 100) / 330; // 0.85 … 1.15
  const contract = contractYears <= 0 ? 0.6 : contractYears === 1 ? 0.8 : 1;
  const raw = baseValue(ovr) * ageValueFactor(age) * rep * contract;
  const step = raw >= 10_000_000 ? 500_000 : raw >= 1_000_000 ? 100_000 : 25_000;
  return Math.max(25_000, Math.round(raw / step) * step);
}

/**
 * Wochengehalt in €: grob 1/400 des Basiswerts, skaliert mit den Finanzen
 * des Vereins (0–100). Bundesliga-Stammspieler ≈ 30–80 Tsd., Weltklasse ≈ 250 Tsd.+
 */
export function weeklyWage(ovr: number, finances: number): number {
  const raw = (baseValue(ovr) / 400) * (0.55 + clamp(finances, 0, 100) / 110);
  const step = raw >= 10_000 ? 1_000 : 100;
  return Math.max(600, Math.round(raw / step) * step);
}
