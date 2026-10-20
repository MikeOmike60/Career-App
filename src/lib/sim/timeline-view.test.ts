import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./data";
import { applyDecision, createInitialState, decisionOptionIds, simulateChunk, signWithClub } from "./engine";
import { buildTimelineView, focusAgeOf, TIMELINE_WINDOW } from "./timeline-view";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

function profile(seed: number, over: Partial<Profile> = {}): Profile {
  return {
    name: `Timeline ${seed}`,
    birthDate: `2008-0${1 + (seed % 9)}-1${seed % 9}`,
    height: 170 + (seed % 20),
    weight: 65 + (seed % 20),
    nat1: COUNTRIES[seed % COUNTRIES.length]!.code,
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: "preset:1",
    pace: 1 as Pace,
    seed,
    ...over,
  };
}

const rowAt = (s: GameState, age: number, page?: number | null) =>
  buildTimelineView(s, page).rows.find((r) => r.age === age);

describe("Timeline-Viewmodel", () => {
  it("zeigt beim Akademie-Angebot bereits das Startalter als offene Zeile", () => {
    const s = createInitialState(profile(1));
    const view = buildTimelineView(s, null);
    expect(view.rows).toHaveLength(TIMELINE_WINDOW);
    expect(view.openAge).toBe(s.player.age);
    expect(rowAt(s, s.player.age)!.state).toBe("open");
    expect(rowAt(s, s.player.age + 1)!.state).toBe("empty");
  });

  it("zeigt direkt nach der Unterschrift die Signaturzeile mit Verein und OVR", () => {
    let s = createInitialState(profile(2));
    const clubId = s.offers[0]!.clubId;
    s = signWithClub(s, clubId);
    const row = rowAt(s, s.player.age)!;
    expect(row.state).toBe("signature");
    expect(row.clubId).toBe(clubId);
    expect(row.ovr).toBe(s.player.ovr);
  });

  it("maskiert genau die Saisonzeile mit offener OVR-Entscheidung und enthüllt sie nach einem Klick", () => {
    let s = createInitialState(profile(3));
    s = signWithClub(s, s.offers[0]!.clubId);
    s = simulateChunk(s);
    expect(s.pending?.kind).toBe("ovr");
    const seasonAge = s.seasons[s.seasons.length - 1]!.age;
    expect(buildTimelineView(s, null).maskedAge).toBe(seasonAge);
    expect(rowAt(s, seasonAge)!.state).toBe("open");

    const ids = decisionOptionIds(s.pending!);
    s = applyDecision(s, ids[0]!);
    const revealed = rowAt(s, seasonAge)!;
    expect(revealed.state).toBe("season");
    expect(buildTimelineView(s, null).maskedAge).toBeNull();
  });

  it("maskiert die enthüllte Zeile bei einer folgenden Vereinsentscheidung nicht erneut", () => {
    for (let seed = 10; seed < 60; seed++) {
      let s = createInitialState(profile(seed));
      s = signWithClub(s, s.offers[0]!.clubId);
      let guard = 0;
      while (guard++ < 40 && s.phase !== "end") {
        if (!s.pending) {
          s = simulateChunk(s);
          continue;
        }
        const kind = s.pending.kind;
        const ids = decisionOptionIds(s.pending);
        s = applyDecision(s, ids[0]!);
        if (kind === "ovr" && s.pending && s.pending.kind !== "ovr") {
          const seasonAge = s.seasons[s.seasons.length - 1]!.age;
          expect(buildTimelineView(s, null).maskedAge).toBeNull();
          expect(rowAt(s, seasonAge)!.state).toBe("season");
          return;
        }
      }
    }
    throw new Error("keine Folgeentscheidung gefunden");
  });

  it("blättert automatisch, sobald das offene Alter das 11er-Fenster verlässt", () => {
    for (let seed = 200; seed < 240; seed++) {
      let s = createInitialState(profile(seed));
      s = signWithClub(s, s.offers[0]!.clubId);
      const startAge = s.player.age;
      let guard = 0;
      while (focusAgeOf(s) < startAge + TIMELINE_WINDOW && guard++ < 300 && s.phase !== "end" && !s.retired) {
        if (s.pending) {
          const ids = decisionOptionIds(s.pending);
          s = applyDecision(s, ids[0]!);
        } else s = simulateChunk(s);
      }
      if (focusAgeOf(s) < startAge + TIMELINE_WINDOW) continue;
      const view = buildTimelineView(s, null);
      expect(view.autoPage).toBeGreaterThanOrEqual(1);
      expect(view.page).toBe(view.autoPage);
      expect(view.from).toBeGreaterThanOrEqual(startAge + TIMELINE_WINDOW);
      return;
    }
    throw new Error("keine Karriere über 11 Jahre gefunden");
  });

  it("führt eine Nationalmannschafts-Summenreihe", () => {
    const s = createInitialState(profile(5));
    const view = buildTimelineView(s, null);
    expect(view.national.code).toBe(s.profile.nat1);
    expect(view.national.caps).toBe(0);
  });
});

describe("Entscheidungsreihenfolge", () => {
  it("gibt jeder simulierten Saison zuerst eine OVR-Entscheidung und ändert dabei nie den Verein", () => {
    for (let seed = 100; seed < 106; seed++) {
      let s = createInitialState(profile(seed));
      s = signWithClub(s, s.offers[0]!.clubId);
      let guard = 0;
      let seasons = 0;
      while (guard++ < 80 && s.phase !== "end") {
        if (!s.pending) {
          const before = s.seasons.length;
          s = simulateChunk(s);
          if (s.seasons.length > before && !s.retired) {
            seasons++;
            expect(s.pending?.kind).toBe("ovr");
          }
          continue;
        }
        const kind = s.pending.kind;
        const clubBefore = s.player.clubId;
        const parentBefore = s.player.parentClubId;
        const ids = decisionOptionIds(s.pending);
        s = applyDecision(s, ids[0]!);
        if (kind === "ovr") {
          expect(s.player.clubId).toBe(clubBefore);
          expect(s.player.parentClubId).toBe(parentBefore);
        }
      }
      expect(seasons).toBeGreaterThan(0);
    }
  }, 30000);
});
