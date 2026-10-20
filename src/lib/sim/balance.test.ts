import { describe, expect, it } from "vitest";
import { COUNTRIES, allClubs, clubsOf } from "./data";
import {
  applyDecision,
  createInitialState,
  decisionOptionIds,
  environmentValue,
  signWithClub,
  simulateChunk,
  STATE_VERSION,
} from "./engine";

import { makeGamble, resolveGamble, validEffect } from "./gamble";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

function profile(seed: number, over: Partial<Profile> = {}): Profile {
  return {
    name: `Balance ${seed}`,
    birthDate: `2008-0${1 + (seed % 9)}-1${seed % 9}`,
    height: 172 + (seed % 18),
    weight: 66 + (seed % 20),
    nat1: "DE",
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: `preset:${seed % 6}`,
    pace: 1 as Pace,
    seed,
    ...over,
  };
}

/**
 * Karriere bei einem festen Verein als regelmäßiger Spieler; es wird immer die
 * neutrale Option (0 OVR) gewählt, damit nur die Saisonentwicklung zählt.
 */
function playAt(seed: number, clubId: string, startAt = 68, maxSeasons = 40): GameState {
  let s = createInitialState(profile(seed));
  s = signWithClub(s, clubId);
  s.player.ovr = startAt;
  s.peakOvr = startAt;
  let guard = 0;
  while (s.phase !== "end" && guard++ < 200 && s.seasons.length < maxSeasons) {
    if (s.pending) {
      const ids = decisionOptionIds(s.pending);
      // Neutral wählen und – wenn möglich – beim Verein bleiben, damit nur das
      // Vereinsumfeld die Entwicklung erklärt.
      const pick = s.pending.kind === "ovr" ? ids[1]! : (ids.includes("stay") ? "stay" : ids[0]!);
      s = applyDecision(s, pick);
      continue;

    }
    s = simulateChunk(s);
  }
  return s;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const ovrAt = (states: GameState[], from: number, to: number) =>
  states
    .map((s) => s.seasons.filter((x) => x.age >= from && x.age <= to).map((x) => x.endOvr))
    .filter((x) => x.length > 0)
    .map((x) => Math.max(...x));

const leverkusen = clubsOf("DE", 1).find((c) => c.name.includes("Leverkusen"))!;
const weakClub = allClubs()
  .filter((c) => c.country === "DE" && c.strength <= 64)
  .sort((a, b) => a.strength - b.strength)[0]!;

/* ---------------------------------------------------- A) Saisonentwicklung */

describe("Saisonale OVR-Entwicklung", () => {
  const seeds = Array.from({ length: 60 }, (_, i) => 9100 + i);
  const top = seeds.map((seed) => playAt(seed, leverkusen.id));
  const weak = seeds.map((seed) => playAt(seed, weakClub.id));

  it("kennt Leverkusen als Topclub und einen klar schwächeren Vergleichsverein", () => {
    expect(leverkusen.strength).toBeGreaterThanOrEqual(72);
    expect(weakClub.strength).toBeLessThanOrEqual(65);
  });

  it("lässt regelmäßige Topclub-Spieler bis Mitte/Ende 20 klar über Start wachsen", () => {
    const peaks = ovrAt(top, 24, 28);
    expect(peaks.length).toBeGreaterThan(30);
    const med = median(peaks);
    expect(med).toBeGreaterThanOrEqual(74);
    // Kein Massenstau im oberen 60er-Band
    expect(peaks.filter((v) => v <= 69).length / peaks.length).toBeLessThan(0.3);
  });

  it("wächst bei einem schwachen Verein messbar langsamer", () => {
    const medTop = median(ovrAt(top, 24, 28));
    const medWeak = median(ovrAt(weak, 24, 28));
    expect(medWeak).toBeLessThan(medTop);
    expect(medTop - medWeak).toBeGreaterThanOrEqual(2);
  });

  it("gewichtet Teamstärke und echte Spielzeit im Umfeldwert", () => {
    expect(environmentValue(85, 0.8)).toBeGreaterThan(environmentValue(60, 0.8));
    expect(environmentValue(85, 0.8)).toBeGreaterThan(environmentValue(85, 0.05));
  });

  it("dämpft den Abbau ab 35 im Topclub, bleibt ab 40 aber negativ", () => {
    const drops = (states: GameState[], from: number, to: number) =>
      states.flatMap((s) => s.seasons.filter((x) => x.age >= from && x.age <= to).map((x) => x.endOvr - x.startOvr));
    const topLate = drops(top, 35, 37);
    const weakLate = drops(weak, 35, 37);
    if (topLate.length > 8 && weakLate.length > 8) {
      const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
      expect(avg(topLate)).toBeGreaterThan(avg(weakLate) - 0.01);
    }
    for (const s of [...top, ...weak]) {
      for (const season of s.seasons) {
        // Eine komplett verpasste Saison entwickelt gar nichts – sonst gilt Abbau.
        // Ab 40 ist die reine Saisonentwicklung vor jeder Entscheidung strikt
        // negativ; ein Leihbonus darf diesen Abbau nie ausgleichen.
        if (season.age >= 40 && season.startOvr > 50 && !season.missedSeason) {
          expect(season.seasonalDelta).toBeLessThan(0);
          expect(season.preDecisionOvr!).toBeLessThan(season.startOvr);
        }
      }
    }

  });

  it("hält die Anti-Inflations-Grenzen ein", () => {
    const early90 = top.flatMap((s) => s.seasons).filter((x) => x.age < 23 && x.endOvr >= 90).length;
    const young = top.flatMap((s) => s.seasons).filter((x) => x.age < 23).length;
    expect(early90 / Math.max(1, young)).toBeLessThan(0.05);
    for (const s of [...top, ...weak]) {
      for (const season of s.seasons) {
        expect(season.endOvr).toBeGreaterThanOrEqual(50);
        expect(season.endOvr).toBeLessThanOrEqual(99);
        expect(season.endOvr - season.startOvr).toBeLessThanOrEqual(8);
      }
    }
  });
});

/* ------------------------------------------------- B/C) Gamble-System */

describe("OVR-Gamble", () => {
  it("erfüllt die harten Regeln über viele Ziehungen", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 4000; i++) {
      const g = makeGamble(i, `dec-${i % 9}`, `opt-${i % 3}`, i % 25);
      expect(validEffect(g)).toBe(true);
      // Fairere Gambles: Verlust ist nie größer als der mögliche Gewinn.
      expect(g.loss).toBeLessThanOrEqual(-1);
      expect(Math.abs(g.loss)).toBeLessThanOrEqual(g.gain);
      expect(g.successChance + (100 - g.successChance)).toBe(100);
      expect(g.successChance).toBeGreaterThanOrEqual(48);
      expect(g.successChance).toBeLessThanOrEqual(75);
      seen.add(g.gain);
      const res = resolveGamble(i, `dec-${i % 9}`, `opt-${i % 3}`, i % 25, g);
      expect([g.gain, g.loss]).toContain(res.delta);
      expect(resolveGamble(i, `dec-${i % 9}`, `opt-${i % 3}`, i % 25, g).delta).toBe(res.delta);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("gibt jeder OVR-Entscheidung exakt zwei Optionen – eine Gamble, eine neutrale", () => {
    let checked = 0;
    for (const seed of [5, 41, 108, 777, 2401, 3120]) {
      let s = createInitialState(profile(seed, { nat2: "ENG" }));
      s = signWithClub(s, s.offers[0]!.clubId);
      let guard = 0;
      while (s.phase !== "end" && guard++ < 120) {
        s = simulateChunk(s);
        if (!s.pending) continue;
        if (s.pending.kind !== "ovr") {
          s = applyDecision(s, decisionOptionIds(s.pending)[0]!);
          continue;
        }
        const opts = s.pending.options;
        expect(opts.length).toBe(2);
        expect(opts.filter((o) => o.ovrEffect.type === "gamble").length).toBe(1);
        expect(opts.filter((o) => o.ovrEffect.type === "neutral").length).toBe(1);
        for (const o of opts) expect(validEffect(o.ovrEffect)).toBe(true);
        checked++;
        s = applyDecision(s, opts[guard % 2]!.id);
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it("verändert den OVR bei neutraler Wahl nicht und bei Gamble exakt um gain oder loss", () => {
    let neutralChecks = 0;
    let gambleChecks = 0;
    for (const seed of [12, 64, 251, 909, 1337, 4242]) {
      for (const takeGamble of [false, true]) {
        let s = createInitialState(profile(seed));
        s = signWithClub(s, leverkusen.id);
        let guard = 0;
        while (s.phase !== "end" && guard++ < 90) {
          s = simulateChunk(s);
          if (!s.pending) continue;
          if (s.pending.kind !== "ovr") {
            s = applyDecision(s, decisionOptionIds(s.pending)[0]!);
            continue;
          }
          const option = s.pending.options[takeGamble ? 0 : 1]!;
          const before = s.player.ovr;
          const eff = option.ovrEffect;
          s = applyDecision(s, option.id);
          const delta = s.player.ovr - before;
          if (eff.type === "neutral") {
            expect(delta).toBe(0);
            neutralChecks++;
          } else if (before + eff.loss >= 50 && before + eff.gain <= 99) {
            expect([eff.gain, eff.loss]).toContain(delta);
            gambleChecks++;
          }
        }
      }
    }
    expect(neutralChecks).toBeGreaterThan(20);
    expect(gambleChecks).toBeGreaterThan(20);
  }, 120_000);

  it("addiert Saisonentwicklung und Gamble im letzten SeasonRecord", () => {
    let s = createInitialState(profile(4711));
    s = signWithClub(s, leverkusen.id);
    let guard = 0;
    while (guard++ < 40) {
      if (s.pending?.kind === "ovr") break;
      if (s.pending) {
        s = applyDecision(s, decisionOptionIds(s.pending)[0]!);
        continue;
      }
      s = simulateChunk(s);
    }
    expect(s.pending?.kind).toBe("ovr");
    const option = (s.pending as { options: { id: string; ovrEffect: { type: string } }[] }).options[0]!;
    const last = s.seasons[s.seasons.length - 1]!;
    const seasonDelta = last.endOvr - last.startOvr;
    s = applyDecision(s, option.id);

    const after = s.seasons[s.seasons.length - 1]!;
    if (option.ovrEffect.type === "gamble") {
      const total = after.endOvr - after.startOvr;
      expect(total).not.toBe(undefined);
      expect(Math.abs(total - seasonDelta)).toBeLessThanOrEqual(6);
    }
    expect(after.endOvr).toBe(s.player.ovr);
  });

  it("kennt keine versteckten OVR-Änderungen in Event-Storyfolgen", () => {
    for (const s of [playAt(31, leverkusen.id), playAt(88, weakClub.id, 62)]) {
      for (const d of s.decisions) {
        const ovrDeltas = d.deltas.filter((x) => x.startsWith("OVR"));
        expect(ovrDeltas.length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("Speicherstand-Version", () => {
  it("liegt bei 14", () => {
    expect(STATE_VERSION).toBe(14);
    expect(COUNTRIES.length).toBe(211);
  });
});
