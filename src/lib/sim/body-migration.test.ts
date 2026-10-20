import { describe, expect, it } from "vitest";
import { migrateState } from "./storage";
import { STATE_VERSION, applyDecision, createInitialState, signWithClub } from "./engine";
import { buildRetirementDecision } from "./retirement";
import { BODY_WEAR_LIMIT } from "./body";
import { clubsOf } from "./data";
import { subRng } from "./rng";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

function profile(seed: number): Profile {
  return {
    name: `Migration ${seed}`,
    birthDate: "2008-02-02",
    height: 181,
    weight: 76,
    nat1: "DE",
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: "preset:1",
    pace: 1 as Pace,
    seed,
  };
}

/** Laufende Karriere im Format v12: ohne bodyWear und retirementExtensions. */
function v12State(age: number, majorInjuries: number): Record<string, unknown> {
  let s = createInitialState(profile(9));
  s = signWithClub(s, clubsOf("DE", 1)[0]!.id);
  s.player.age = age;
  s.player.majorInjuries = majorInjuries;
  s.player.injuryProneness = 30;
  const raw = JSON.parse(JSON.stringify({ ...s, version: 12 })) as Record<string, unknown>;
  const player = raw["player"] as Record<string, unknown>;
  delete player["bodyWear"];
  delete player["retirementExtensions"];
  return raw;
}

describe("v12 → v13 Migration", () => {
  it("leitet bodyWear plausibel ab und setzt retirementExtensions", () => {
    const migrated = migrateState(v12State(34, 2) as Partial<GameState>);
    expect(migrated).toBeTruthy();
    expect(migrated!.version).toBe(STATE_VERSION);
    expect(migrated!.player.retirementExtensions).toBe(0);
    expect(migrated!.player.bodyWear).toBeGreaterThan(0);
    // Nie sofortiges Karriereende durch die Migration.
    expect(migrated!.player.bodyWear).toBeLessThan(BODY_WEAR_LIMIT);
  });

  it("verschleißt ältere und verletzungsgeplagte Spielstände stärker", () => {
    const young = migrateState(v12State(22, 0) as Partial<GameState>)!;
    const old = migrateState(v12State(38, 4) as Partial<GameState>)!;
    expect(old.player.bodyWear).toBeGreaterThan(young.player.bodyWear);
  });

  it("übernimmt einen vorhandenen bodyWear-Wert unverändert", () => {
    const raw = v12State(30, 1);
    (raw["player"] as Record<string, unknown>)["bodyWear"] = 61.5;
    expect(migrateState(raw as Partial<GameState>)!.player.bodyWear).toBe(61.5);
  });

  it("bewahrt eine gültige retirement-Entscheidung beim Laden", () => {
    let s = createInitialState(profile(31));
    s = signWithClub(s, clubsOf("DE", 1)[0]!.id);
    s.player.age = 37;
    s.player.bodyWear = 70;
    s.pending = buildRetirementDecision(s, subRng(31, "retire"));
    const raw = JSON.parse(JSON.stringify(s)) as Partial<GameState>;
    const migrated = migrateState(raw);
    expect(migrated!.pending?.kind).toBe("retirement");
    if (migrated!.pending?.kind !== "retirement") return;
    expect(migrated!.pending.options.map((o) => o.id)).toEqual(["retire-continue", "retire-stop"]);
    // Und sie bleibt anwendbar.
    const next = applyDecision(migrated!, "retire-stop");
    expect(next.retired).toBe(true);
  });

  it("verwirft eine kaputte retirement-Entscheidung, behält aber die Karriere", () => {
    let s = createInitialState(profile(32));
    s = signWithClub(s, clubsOf("DE", 1)[0]!.id);
    s.pending = buildRetirementDecision(s, subRng(32, "retire"));
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    (raw["pending"] as Record<string, unknown>)["options"] = [];
    const migrated = migrateState(raw as Partial<GameState>);
    expect(migrated).toBeTruthy();
    expect(migrated!.pending).toBeUndefined();
    expect(migrated!.player.clubId).toBe(s.player.clubId);
  });
});
