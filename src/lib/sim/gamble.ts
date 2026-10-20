/**
 * Zentrales, transparentes OVR-Gamble-System.
 *
 * Jede Entscheidung hat exakt zwei Optionen: eine riskante (Gewinn +1..+3,
 * Verlust -1..-3, sichtbare Erfolgs-%) und eine neutrale (garantiert 0 OVR).
 * Der Verlust ist nie größer als der mögliche Gewinn. Ergebnisse sind
 * deterministisch aus Seed + Decision-ID + Option + Saison.
 */
import { subRng } from "./rng";
import type { GambleEffect, NeutralEffect, OvrEffect } from "./types";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Normaler Korridor der Erfolgschance. */
export const CHANCE_MIN = 48;
export const CHANCE_MAX = 75;
/** Obergrenze mit aktivem Pechsträhnen-Schutz. */
export const CHANCE_STREAK_MAX = 92;

/** Ab so vielen verlorenen Gambles in Folge greift der Pechsträhnen-Schutz. */
export const STREAK_THRESHOLD = 2;

export const NEUTRAL: NeutralEffect = { type: "neutral", delta: 0 };

export function neutralEffect(): NeutralEffect {
  return { type: "neutral", delta: 0 };
}

/** Zusätzliche Prozentpunkte nach verlorenen Gambles in Folge. */
export function streakBonus(lossStreak: number): number {
  if (lossStreak < STREAK_THRESHOLD) return 0;
  return Math.min(24, 16 + (lossStreak - STREAK_THRESHOLD) * 4);
}

/**
 * Baut eine Gamble-Option. `bias` verschiebt die Erfolgschance (Prozentpunkte,
 * z. B. aus Form/Mentalität/Event), `lossStreak` aktiviert den
 * Pechsträhnen-Schutz.
 */
export function makeGamble(
  seed: number,
  decisionId: string,
  optionId: string,
  seasonIndex: number,
  bias = 0,
  lossStreak = 0,
): GambleEffect {
  const rng = subRng(seed, "gamble-shape", decisionId, optionId, seasonIndex);
  const gain = rng.weighted<1 | 2 | 3>([
    [1, 42],
    [2, 38],
    [3, 20],
  ]);
  // Verlust variiert, bleibt aber höchstens so groß wie der mögliche Gewinn.
  const loss = -rng.int(1, gain) as -1 | -2 | -3;
  // Größere Gewinne sind etwas seltener erfolgreich.
  const base = rng.int(52, 74) - (gain - 1) * 4;
  const bonus = streakBonus(lossStreak);
  const max = bonus > 0 ? CHANCE_STREAK_MAX : CHANCE_MAX;
  const successChance = clamp(Math.round(base + bias + bonus), CHANCE_MIN, max);
  return { type: "gamble", gain, loss, successChance };
}

export interface GambleResult {
  success: boolean;
  delta: number;
}

/** Löst eine Gamble-Option deterministisch auf – genau einer der zwei Werte. */
export function resolveGamble(
  seed: number,
  decisionId: string,
  optionId: string,
  seasonIndex: number,
  effect: GambleEffect,
): GambleResult {
  const rng = subRng(seed, "gamble-roll", decisionId, optionId, seasonIndex);
  const success = rng.next() * 100 < effect.successChance;
  return { success, delta: success ? effect.gain : effect.loss };
}

export function isGamble(effect: OvrEffect | undefined): effect is GambleEffect {
  return effect?.type === "gamble";
}

/** Prüft die harten Regeln eines Effekts. */
export function validEffect(effect: OvrEffect): boolean {
  if (effect.type === "neutral") return effect.delta === 0;
  return (
    effect.gain >= 1 &&
    effect.gain <= 3 &&
    effect.loss <= -1 &&
    effect.loss >= -3 &&
    Math.abs(effect.loss) <= effect.gain &&
    effect.successChance >= CHANCE_MIN &&
    effect.successChance <= CHANCE_STREAK_MAX
  );
}
