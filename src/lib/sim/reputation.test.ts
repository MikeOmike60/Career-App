import { describe, expect, it } from "vitest";
import { createInitialState, signWithClub, applyDecision } from "./engine";
import { clubsOf } from "./data";
import { relationBetween } from "./club-relations";
import { betrayalTier, clubWillCall, offerWarning, rivalHits, rivalSeverity } from "./reputation";
import { parseTraits } from "./personality";
import { marketValue } from "./economy";
import type { GameState, PendingClubDecision, Profile } from "./types";

const byName = (code: string, name: string) => clubsOf(code).find((c) => c.name === name)!;
const schalke = byName("DE", "FC Schalke 04");
const dortmund = byName("DE", "Borussia Dortmund");
const bayern = byName("DE", "FC Bayern München");
const bochum = byName("DE", "VfL Bochum");

function profile(personality?: string): Profile {
  return {
    name: "Test Rivale",
    birthDate: "2008-03-14",
    height: 180,
    weight: 75,
    nat1: "DE",
    pos: "ST",
    avatar: "preset:1",
    pace: 1,
    seed: 4711,
    ...(personality ? { personality } : {}),
  };
}

/** Spielstand mit einigen Saisons bei `clubId`. */
function stateAt(clubId: string, seasons: number, personality?: string): GameState {
  let s = signWithClub(createInitialState(profile(personality)), clubId);
  s = structuredClone(s);
  for (let i = 0; i < seasons; i++) {
    s.seasons.push({
      index: i, age: 18 + i, seasonLabel: `20${30 + i}/${31 + i}`, clubId, leagueLabel: "Bundesliga",
      apps: 30, goals: 10, assists: 5, cleanSheets: 0, saves: 0, rating: 7, form: 60, startOvr: 70, endOvr: 72,
      tablePosition: 5, competitions: [], trophies: [], injuries: [], natApps: 0, natGoals: 0, loan: false,
    });
  }
  s.player.ovr = 80;
  return s;
}

/** Wechsel über eine echte Vereinsentscheidung ausführen. */
function move(s: GameState, toId: string): GameState {
  const decision: PendingClubDecision = {
    kind: "club", id: `test-${toId}`, title: "Test", intro: "", forced: false,
    offers: [{ id: `transfer:${toId}`, clubId: toId, deal: "transfer", leagueLabel: "Bundesliga", division: 1, strength: 80, expectedRole: "Stammspieler", playtime: "hoch", reason: "" }],
  };
  return applyDecision({ ...s, pending: decision }, `transfer:${toId}`);
}

describe("Rivalitäten und Verrat", () => {
  it("kennt Revierderby und Klassiker", () => {
    expect(relationBetween(schalke.id, dortmund.id)?.type).toBe("rivalry");
    expect(relationBetween(dortmund.id, bayern.id)?.type).toBe("rivalry");
  });

  it("macht den zweiten Rivalen-Wechsel schlimmer als den ersten", () => {
    let s = stateAt(schalke.id, 4);
    const firstHits = rivalHits(s, dortmund.id);
    const first = rivalSeverity(s, firstHits);
    s = move(s, dortmund.id);
    expect(s.betrayals).toHaveLength(1);
    // Bochum ist Rivale von Schalke UND Dortmund – Doppelverrat.
    const hits = rivalHits(s, bochum.id);
    expect(hits.map((h) => h.clubId).sort()).toEqual([dortmund.id, schalke.id].sort());
    const second = rivalSeverity(s, hits);
    expect(second).toBeGreaterThan(first);
    expect(betrayalTier(second, hits.length, 1)).toBeGreaterThanOrEqual(2);
    expect(offerWarning(s, bochum.id)).toMatch(/Doppelverrat|ultimative Verrat/);
  });

  it("lässt verratene Vereine nicht mehr anrufen", () => {
    let s = stateAt(schalke.id, 4);
    s.fanRelations[schalke.id] = 70;
    s = move(s, dortmund.id);
    expect(s.fanRelations[schalke.id]).toBeLessThan(40);
    expect(clubWillCall(s, schalke.id)).toBe(false);
  });

  it("bestraft loyale Spieler härter", () => {
    const normal = stateAt(schalke.id, 4);
    const loyal = stateAt(schalke.id, 4, "Ich bin loyal");
    expect(rivalSeverity(loyal, rivalHits(loyal, dortmund.id))).toBeGreaterThan(rivalSeverity(normal, rivalHits(normal, dortmund.id)));
  });
});

describe("Persönlichkeit", () => {
  it("erkennt Züge und beachtet Verneinungen", () => {
    expect(parseTraits("Loyal und ehrgeizig")).toEqual(["loyal", "ambitious"]);
    expect(parseTraits("nicht loyal, will nur Kohle")).toEqual(["greedy"]);
    expect(parseTraits("stark im Kopfball")).toEqual([]);
  });
});

describe("Marktwert", () => {
  it("liegt bei OVR 80 im zweistelligen Millionenbereich", () => {
    expect(marketValue({ ovr: 80, age: 26, reputation: 50, contractYears: 3 })).toBeGreaterThan(25_000_000);
    expect(marketValue({ ovr: 90, age: 27, reputation: 70, contractYears: 3 })).toBeGreaterThan(100_000_000);
    expect(marketValue({ ovr: 80, age: 33, reputation: 50, contractYears: 3 })).toBeLessThan(marketValue({ ovr: 80, age: 25, reputation: 50, contractYears: 3 }));
  });
});
