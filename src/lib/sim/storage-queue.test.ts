import { describe, expect, it } from "vitest";
import { migrateState } from "./storage";
import { STATE_VERSION, applyDecision, createInitialState, decisionOptionIds, signWithClub, simulateChunk } from "./engine";
import { COUNTRIES } from "./data";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

function profile(seed: number): Profile {
  return {
    name: `Queue ${seed}`,
    birthDate: "2008-04-11",
    height: 180,
    weight: 75,
    nat1: COUNTRIES[seed % COUNTRIES.length]!.code,
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: "preset:1",
    pace: 1 as Pace,
    seed,
  };
}

/** Baut einen Spielstand mit offener OVR-Entscheidung und mindestens einem Queue-Eintrag. */
function stateWithQueue(): GameState {
  for (let seed = 300; seed < 400; seed++) {
    let s = createInitialState(profile(seed));
    s = signWithClub(s, s.offers[0]!.clubId);
    let guard = 0;
    while (guard++ < 60 && s.phase !== "end") {
      if (!s.pending) {
        s = simulateChunk(s);
        continue;
      }
      if (s.pending.kind === "ovr" && s.queue.length > 0) return s;
      s = applyDecision(s, decisionOptionIds(s.pending)[0]!);
    }
  }
  throw new Error("kein Spielstand mit Queue gefunden");
}

describe("Queue-Persistenz", () => {
  it("bewahrt gültige Queue-Einträge beim Laden eines v10-Stands", () => {
    const s = stateWithQueue();
    const kinds = s.queue.map((q) => q.kind);
    const loaded = migrateState(JSON.parse(JSON.stringify(s)) as GameState)!;
    expect(loaded.version).toBe(STATE_VERSION);
    expect(loaded.queue.map((q) => q.kind)).toEqual(kinds);

    const after = applyDecision(loaded, decisionOptionIds(loaded.pending!)[0]!);
    expect(after.pending?.kind).toBe(kinds[0]);
  });

  it("bewahrt die Queue auch bei einem v9-Stand", () => {
    const s = stateWithQueue();
    const raw = JSON.parse(JSON.stringify({ ...s, version: 9 })) as GameState;
    const loaded = migrateState(raw)!;
    expect(loaded.queue.length).toBe(s.queue.length);
  });

  it("verwirft nur ungültige Queue-Einträge und behält gültige", () => {
    const s = stateWithQueue();
    const raw = JSON.parse(JSON.stringify(s)) as GameState;
    raw.queue = [{ kind: "club", id: "kaputt", title: "x", intro: "y", forced: false, offers: [] } as never, ...raw.queue];
    const loaded = migrateState(raw)!;
    expect(loaded.queue.length).toBe(s.queue.length);
    expect(loaded.seasons.length).toBe(s.seasons.length);
  });

  it("setzt die Queue für alte Stände (v8) leer", () => {
    const s = stateWithQueue();
    const raw = JSON.parse(JSON.stringify({ ...s, version: 8 })) as GameState;
    const loaded = migrateState(raw)!;
    expect(loaded.queue).toEqual([]);
  });
});

describe("Rücktrittssaison", () => {
  it("zeigt für JEDE neue Saison zuerst eine OVR-Entscheidung – auch in der Rücktrittssaison", () => {
    let retirementSeasonsChecked = 0;
    for (let seed = 500; seed < 540; seed++) {
      let s = createInitialState(profile(seed));
      s = signWithClub(s, s.offers[0]!.clubId);
      let guard = 0;
      while (guard++ < 400 && s.phase !== "end") {
        if (!s.pending) {
          const before = s.seasons.length;
          const wasRetired = s.retired;
          s = simulateChunk(s);
          if (s.seasons.length > before) {
            expect(s.pending?.kind).toBe("ovr");
            if (s.retired && !wasRetired) retirementSeasonsChecked++;
          }
          continue;
        }
        s = applyDecision(s, decisionOptionIds(s.pending)[0]!);
      }
    }
    expect(retirementSeasonsChecked).toBeGreaterThan(0);
  }, 60000);
});
