import { describe, expect, it } from "vitest";
import {
  applyDecision,
  createInitialState,
  decisionOptionIds,
  signWithClub,
  simulateChunk,
} from "./engine";
import { allClubs, clubsOf } from "./data";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

function profile(seed: number, over: Partial<Profile> = {}): Profile {
  return {
    name: `Dist ${seed}`,
    birthDate: "2008-03-14",
    height: 180,
    weight: 75,
    nat1: "DE",
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: "preset:1",
    pace: 1 as Pace,
    seed,
    ...over,
  };
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const share = (values: number[], test: (v: number) => boolean) =>
  values.filter(test).length / Math.max(1, values.length);

const leverkusen = clubsOf("DE", 1).find((c) => c.name.includes("Leverkusen"))!;
const weakClub = allClubs()
  .filter((c) => c.country === "DE" && c.strength <= 64)
  .sort((a, b) => a.strength - b.strength)[0]!;

/** Karriere bei festem Verein, immer neutrale OVR-Wahl, immer bleiben. */
function neutralCareerAt(seed: number, clubId: string, startOvrValue?: number): GameState {
  let s = createInitialState(profile(seed));
  s = signWithClub(s, clubId);
  if (startOvrValue !== undefined) {
    s.player.ovr = startOvrValue;
    s.peakOvr = startOvrValue;
  }
  let guard = 0;
  while (s.phase !== "end" && guard++ < 220) {
    if (s.pending) {
      const ids = decisionOptionIds(s.pending);
      const pick =
        s.pending.kind === "ovr"
          ? s.pending.options.find((o) => o.ovrEffect.type === "neutral")!.id
          : ids.includes("stay")
            ? "stay"
            : ids[0]!;
      s = applyDecision(s, pick);
      continue;
    }
    s = simulateChunk(s);
  }
  return s;
}

/** Echte Karriere ab generiertem Start mit sportlich vernünftigen Wahlen. */
function favorableCareer(seed: number): GameState {
  let s = createInitialState(profile(seed));
  s = signWithClub(s, s.offers[0]!.clubId);
  let guard = 0;
  while (s.phase !== "end" && guard++ < 320) {
    if (s.pending) {
      const pending = s.pending;
      const ids = decisionOptionIds(pending);
      let pick = ids[0]!;
      if (pending.kind === "ovr") {
        const gamble = pending.options.find((o) => o.ovrEffect.type === "gamble")!;
        const neutral = pending.options.find((o) => o.ovrEffect.type === "neutral")!;
        pick =
          gamble.ovrEffect.type === "gamble" && gamble.ovrEffect.successChance >= 60 ? gamble.id : neutral.id;
      } else if (pending.kind === "club") {
        pick = ids.includes("stay") ? "stay" : ids[0]!;
      }
      s = applyDecision(s, pick);
      continue;
    }
    s = simulateChunk(s);
  }
  return s;
}

/* ------------------------------------------------------------- Start-OVR */

describe("Verteilung der Start-OVR", () => {
  const starts = Array.from({ length: 1200 }, (_, i) => createInitialState(profile(30000 + i)).player.ovr);

  it("hat den Median im 50er-Bereich", () => {
    const med = median(starts);
    expect(med).toBeGreaterThanOrEqual(50);
    expect(med).toBeLessThan(60);
  });

  it("hält mindestens 75 Prozent unter 60", () => {
    expect(share(starts, (v) => v < 60)).toBeGreaterThanOrEqual(0.75);
  });

  it("lässt 70+ als seltene Ausnahme zu (>0, aber höchstens 2 Prozent)", () => {
    const high = share(starts, (v) => v >= 70);
    expect(high).toBeGreaterThan(0);
    expect(high).toBeLessThanOrEqual(0.02);
  });
});

/* ----------------------------------------------- Topclub-Entwicklung */

describe("Topclub-Entwicklung ab etabliertem Niveau", () => {
  const peaks: number[] = [];
  for (let i = 0; i < 200; i++) {
    const s = neutralCareerAt(41000 + i, leverkusen.id, 66 + (i % 5));
    const window = s.seasons.filter((x) => x.age >= 25 && x.age <= 30).map((x) => x.endOvr);
    if (window.length) peaks.push(Math.max(...window));
  }

  it("nutzt eine große Stichprobe", () => {
    expect(peaks.length).toBeGreaterThanOrEqual(180);
  });

  it("erreicht im Peakfenster 25–30 mindestens Median 79", () => {
    expect(median(peaks)).toBeGreaterThanOrEqual(79);
  });

  it("bringt mindestens 45 Prozent auf 80+", () => {
    expect(share(peaks, (v) => v >= 80)).toBeGreaterThanOrEqual(0.45);
  });
});

/* --------------------------------------------------- Weltklasse-Korridor */

describe("Weltklasse bleibt erreichbar, aber besonders", () => {
  const peaks: number[] = [];
  const early90: boolean[] = [];
  for (let i = 0; i < 300; i++) {
    const s = favorableCareer(70000 + i);
    peaks.push(s.peakOvr);
    early90.push(s.seasons.some((x) => x.age < 23 && x.endOvr >= 90));
  }

  it("erreicht mit guten Entscheidungen einen kleinen, klar nicht-null Anteil 90+", () => {
    const elite = share(peaks, (v) => v >= 90);
    expect(elite).toBeGreaterThanOrEqual(0.02);
    expect(elite).toBeLessThanOrEqual(0.12);
  });

  it("hält 90+ vor 23 unter 5 Prozent", () => {
    expect(share(early90.map((v) => (v ? 1 : 0)), (v) => v === 1)).toBeLessThan(0.05);
  });

  it("erreicht 90+ mit schwachem Umfeld praktisch nie", () => {
    const poor: number[] = [];
    for (let i = 0; i < 200; i++) poor.push(neutralCareerAt(88000 + i, weakClub.id).peakOvr);
    expect(share(poor, (v) => v >= 90)).toBeLessThan(0.02);
    expect(median(poor)).toBeLessThan(median(peaks));
  }, 120000);
});

/* ------------------------------------------------------------ Altersabbau */

describe("Altersabbau", () => {
  const top = Array.from({ length: 40 }, (_, i) => neutralCareerAt(52000 + i, leverkusen.id, 74));
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const deltas = (from: number, to: number) =>
    top.flatMap((s) =>
      s.seasons.filter((x) => x.age >= from && x.age <= to && !x.missedSeason).map((x) => x.seasonalDelta ?? 0),
    );

  it("sinkt nach dem Peak deutlich", () => {
    const late = deltas(34, 38);
    expect(late.length).toBeGreaterThan(20);
    expect(avg(late)).toBeLessThan(-0.5);
  });

  it("bleibt ab 40 saisonal negativ", () => {
    for (const s of top) {
      for (const season of s.seasons) {
        if (season.age >= 40 && season.startOvr > 50 && !season.missedSeason) {
          expect(season.seasonalDelta!).toBeLessThan(0);
        }
      }
    }
  });
});
