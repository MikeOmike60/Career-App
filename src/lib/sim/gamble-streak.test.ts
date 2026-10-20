import { describe, expect, it } from "vitest";
import {
  applyDecision,
  createInitialState,
  decisionOptionIds,
  signWithClub,
  simulateChunk,
} from "./engine";
import { CHANCE_STREAK_MAX, makeGamble, resolveGamble } from "./gamble";
import { migrateState } from "./storage";
import { clubsOf } from "./data";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

function profile(seed: number): Profile {
  return {
    name: `Streak ${seed}`,
    birthDate: "2008-03-14",
    height: 180,
    weight: 75,
    nat1: "DE",
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: "preset:1",
    pace: 1 as Pace,
    seed,
  };
}

const leverkusen = clubsOf("DE", 1).find((c) => c.name.includes("Leverkusen"))!;

/** Läuft bis zur nächsten OVR-Entscheidung. */
function toOvrDecision(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (s.phase !== "end" && guard++ < 80) {
    if (s.pending?.kind === "ovr") return s;
    if (s.pending) {
      const ids = decisionOptionIds(s.pending);
      s = applyDecision(s, ids.includes("stay") ? "stay" : ids[0]!);
      continue;
    }
    s = simulateChunk(s);
  }
  return s;
}

/** Spielt so lange Gambles, bis zwei Verluste in Folge aufgelaufen sind. */
function findTwoLosses(): GameState | undefined {
  for (let seed = 500; seed < 640; seed++) {
    let s: GameState = createInitialState(profile(seed));
    s = signWithClub(s, leverkusen.id);
    let guard = 0;
    while (s.phase !== "end" && guard++ < 60) {
      s = toOvrDecision(s);
      if (s.pending?.kind !== "ovr") break;
      const gamble = s.pending.options.find((o) => o.ovrEffect.type === "gamble")!;
      s = applyDecision(s, gamble.id);
      if ((s.gambleLossStreak ?? 0) >= 2) return s;
    }
  }
  return undefined;
}

describe("Gamble-Streak im echten Flow", () => {
  it("findet deterministisch zwei Verluste in Folge und bepreist den nächsten Gamble höher", () => {
    const s = findTwoLosses();
    expect(s).toBeTruthy();
    expect(s!.gambleLossStreak).toBeGreaterThanOrEqual(2);

    const next = toOvrDecision({ ...s!, pending: undefined });
    expect(next.pending?.kind).toBe("ovr");
    if (next.pending?.kind !== "ovr") return;
    const option = next.pending.options.find((o) => o.ovrEffect.type === "gamble")!;
    const withStreak = option.ovrEffect;
    expect(withStreak.type).toBe("gamble");
    if (withStreak.type !== "gamble") return;

    // Derselbe Gamble ohne Pechsträhne ist niedriger bepreist.
    const withoutStreak = makeGamble(next.profile.seed, next.pending.id, option.id, next.seasonIndex, 0, 0);
    expect(withStreak.successChance).toBeGreaterThan(withoutStreak.successChance);
    expect(withStreak.successChance).toBeLessThanOrEqual(CHANCE_STREAK_MAX);

    // Angezeigte Chance ist exakt die, mit der aufgelöst wird.
    const shown = withStreak.successChance;
    const forced = resolveGamble(next.profile.seed, next.pending.id, option.id, next.seasonIndex, {
      ...withStreak,
      successChance: 0,
    });
    const always = resolveGamble(next.profile.seed, next.pending.id, option.id, next.seasonIndex, {
      ...withStreak,
      successChance: 100,
    });
    expect(forced.success).toBe(false);
    expect(always.success).toBe(true);
    const before = next.player.ovr;
    const real = resolveGamble(next.profile.seed, next.pending.id, option.id, next.seasonIndex, withStreak);
    const applied = applyDecision(next, option.id);
    expect(applied.player.ovr - before).toBe(real.delta);
    expect(shown).toBe(withStreak.successChance);
    // Gewinn setzt die Strähne zurück, Verlust zählt weiter.
    expect(applied.gambleLossStreak).toBe(real.success ? 0 : (next.gambleLossStreak ?? 0) + 1);
  });

  it("setzt die Strähne bei neutraler Wahl auf 0", () => {
    let s = signWithClub(createInitialState(profile(91)), leverkusen.id);
    s = toOvrDecision(s);
    expect(s.pending?.kind).toBe("ovr");
    if (s.pending?.kind !== "ovr") return;
    s.gambleLossStreak = 3;
    const neutral = s.pending.options.find((o) => o.ovrEffect.type === "neutral")!;
    expect(applyDecision(s, neutral.id).gambleLossStreak).toBe(0);
  });

  it("migriert alte Spielstände ohne Strähnenwert auf 0", () => {
    let s = signWithClub(createInitialState(profile(17)), leverkusen.id);
    s = toOvrDecision(s);
    const legacy = JSON.parse(JSON.stringify({ ...s, version: 10, gambleLossStreak: undefined }));
    delete legacy.gambleLossStreak;
    const migrated = migrateState(legacy) as GameState;
    expect(migrated.gambleLossStreak).toBe(0);
  });
});
