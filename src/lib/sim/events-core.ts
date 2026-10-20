import type { GameState, DecisionLog } from "./types";
import type { Rng } from "./rng";

export interface EventOptionDef {
  id: string;
  label: string;
  hint: string;
  apply: (state: GameState, rng: Rng) => { consequence: string; deltas: string[] };
}

export interface EventDef {
  id: string;
  title: string;
  intro: (state: GameState) => string;
  weight: number;
  when: (state: GameState) => boolean;
  once?: boolean;
  /** Gewichtsfaktoren je Charakterzug (z. B. { showman: 2 }). */
  traits?: Partial<Record<import("./personality").Trait, number>>;
  options: EventOptionDef[];
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Story-Folgen einer Entscheidung. OVR ist hier bewusst NICHT enthalten –
 * Rating-Änderungen laufen ausschließlich über das zentrale Gamble-System.
 */
export function adjust(
  state: GameState,
  changes: Partial<{
    form: number;
    morale: number;
    fitness: number;
    reputation: number;
    injuryRisk: number;
    relationship: number;
    mentality: number;
    fans: number;
    playtime: number;
    injuryProneness: number;
  }>,
): string[] {
  const p = state.player;
  const deltas: string[] = [];
  const push = (label: string, value: number) => {
    if (value) deltas.push(`${label} ${value > 0 ? "+" : ""}${Math.round(value)}`);
  };

  if (changes.form) {
    p.form = clamp(p.form + changes.form, 0, 100);
    push("Form", changes.form);
  }
  if (changes.morale) {
    p.morale = clamp(p.morale + changes.morale, 0, 100);
    push("Moral", changes.morale);
  }
  if (changes.fitness) {
    p.fitness = clamp(p.fitness + changes.fitness, 0, 100);
    push("Fitness", changes.fitness);
  }
  if (changes.reputation) {
    p.reputation = clamp(p.reputation + changes.reputation, 0, 100);
    push("Reputation", changes.reputation);
  }
  if (changes.injuryRisk) {
    p.injuryRisk = clamp(p.injuryRisk + changes.injuryRisk, 0, 100);
    push("Verletzungsrisiko", changes.injuryRisk);
  }
  if (changes.injuryProneness) {
    p.injuryProneness = clamp(p.injuryProneness + changes.injuryProneness, 0, 100);
    push("Anfälligkeit", changes.injuryProneness);
  }
  if (changes.relationship) {
    p.relationship = clamp(p.relationship + changes.relationship, 0, 100);
    push("Clubbeziehung", changes.relationship);
  }
  if (changes.mentality) {
    p.mentality = clamp(p.mentality + changes.mentality, 0, 100);
    push("Mentalität", changes.mentality);
  }
  if (changes.playtime) {
    p.playtimeModifier = clamp(p.playtimeModifier + changes.playtime / 100, 0.5, 1.35);
    push("Spielzeit", changes.playtime);
  }
  if (changes.fans) {
    const id = p.clubId;
    const current = state.fanRelations[id] ?? 50;
    state.fanRelations[id] = clamp(Math.round(current + changes.fans), 0, 100);
    push("Fanbindung", changes.fans);
  }
  return deltas;
}

export function logDecision(
  state: GameState,
  title: string,
  choice: string,
  consequence: string,
  deltas: string[],
): DecisionLog {
  const entry: DecisionLog = { age: state.player.age, title, choice, consequence, deltas };
  state.decisions.push(entry);
  return entry;
}

/** Verdeckte, gewichtete Ergebnisse – nie vorab sichtbar. */
export function outcome<T>(rng: Rng, entries: ReadonlyArray<readonly [T, number]>): T {
  return rng.weighted(entries);
}
