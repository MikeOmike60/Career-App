import { describe, expect, it } from "vitest";
import {
  CLUB_IMPACT_CAP,
  applyDecision,
  clubImpactForSeason,
  createInitialState,
  decisionOptionIds,
  signWithClub,
  simulateChunk,
} from "./engine";
import { allClubs } from "./data";
import { dynamicStrength } from "./world";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

const base = {
  clubStrength: 66,
  currentStrength: 66,
  apps: 18,
  minutes: 0.7,
  rating: 7.4,
  missedSeason: false,
  exceptional: false,
};

describe("clubImpactForSeason – die echte Regel", () => {
  it("Stärke 66 + 18 Einsätze + Note 7.4 ergibt +1", () => {
    expect(clubImpactForSeason(base)).toBe(1);
  });

  it("außergewöhnliche Saison ergibt +2", () => {
    expect(clubImpactForSeason({ ...base, exceptional: true })).toBe(2);
  });

  it("Note 7.2 ergibt 0", () => {
    expect(clubImpactForSeason({ ...base, rating: 7.2 })).toBe(0);
  });

  it("17 Einsätze ohne ausreichende Spielzeit ergibt 0", () => {
    expect(clubImpactForSeason({ ...base, apps: 17, minutes: 0.4 })).toBe(0);
  });

  it("Stärke 73 ergibt 0", () => {
    expect(clubImpactForSeason({ ...base, clubStrength: 73, currentStrength: 73 })).toBe(0);
  });

  it("bei aktueller Stärke 87 wird nur noch +1 angewendet", () => {
    expect(clubImpactForSeason({ ...base, currentStrength: 87, exceptional: true })).toBe(1);
  });

  it("bei aktueller Stärke 88 ergibt sich 0", () => {
    expect(clubImpactForSeason({ ...base, currentStrength: CLUB_IMPACT_CAP, exceptional: true })).toBe(0);
  });

  it("nimmt nie etwas zurück – der Wert ist nie negativ", () => {
    for (const rating of [5, 6.5, 7.29, 7.3, 8.5]) {
      for (const strength of [40, 66, 72, 73, 90]) {
        for (const current of [40, 87, 88, 95]) {
          const v = clubImpactForSeason({ ...base, rating, clubStrength: strength, currentStrength: current });
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it("eine verpasste Saison ergibt 0", () => {
    expect(clubImpactForSeason({ ...base, missedSeason: true, exceptional: true })).toBe(0);
  });
});

/* ------------------------------------------------------- Integrationstest */

function profile(seed: number): Profile {
  return {
    name: `Impact ${seed}`,
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

describe("Club-Impact im echten Saisonverlauf", () => {
  it("hebt dynamicStrength und schreibt clubImpact plus Note in den SeasonRecord", () => {
    const weak = allClubs()
      .filter((c) => c.country === "DE" && c.strength <= 64)
      .sort((a, b) => a.strength - b.strength)[0]!;
    let found: { before: number; after: number; state: GameState } | undefined;
    for (let seed = 1000; seed < 1080 && !found; seed++) {
      let s = createInitialState(profile(seed));
      s = signWithClub(s, weak.id);
      s.player.ovr = 78;
      s.peakOvr = 78;
      let guard = 0;
      while (s.phase !== "end" && guard++ < 60) {
        const before = dynamicStrength(s.world, weak.id);
        if (s.pending) {
          const ids = decisionOptionIds(s.pending);
          s = applyDecision(s, s.pending.kind === "ovr" ? ids[1]! : ids.includes("stay") ? "stay" : ids[0]!);
        } else {
          s = simulateChunk(s);
        }
        const season = s.seasons[s.seasons.length - 1];
        if (season?.clubImpact && s.player.clubId === weak.id) {
          found = { before, after: dynamicStrength(s.world, weak.id), state: s };
          break;
        }
      }
    }
    expect(found).toBeTruthy();
    const season = found!.state.seasons.find((x) => x.clubImpact)!;
    expect(season.clubImpact).toBeGreaterThanOrEqual(1);
    expect(season.clubImpactNote).toContain("Teamstärke");
    expect(found!.after).toBeGreaterThan(found!.before);
    expect(found!.after).toBeLessThanOrEqual(CLUB_IMPACT_CAP);
    expect(found!.state.clubImpact[weak.id]).toBeGreaterThanOrEqual(1);
  });
});
