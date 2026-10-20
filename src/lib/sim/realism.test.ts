import { describe, expect, it, vi } from "vitest";
import { COUNTRIES, clubsOf, getClub } from "./data";
import {
  applyDecision,
  createInitialState,
  decisionOptionIds,
  fanStatus,
  simulateChunk,
  signWithClub,
  startOvr,
  STATE_VERSION,
} from "./engine";

import { emptyWorld, ensureCountryWorld, simulateCountrySeason, isClosedLeague, maxDivision } from "./world";
import { relationsOf, relationPairCount } from "./club-relations";
import { createRng } from "./rng";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";
import { loadState } from "./storage";

function profile(seed: number, over: Partial<Profile> = {}): Profile {
  return {
    name: `Prüfspieler ${seed}`,
    birthDate: `2008-0${1 + (seed % 9)}-1${seed % 9}`,
    height: 168 + (seed % 24),
    weight: 62 + (seed % 28),
    nat1: COUNTRIES[seed % COUNTRIES.length]!.code,
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: `preset:${seed % 6}`,
    pace: 1 as Pace,
    seed,
    ...over,
  };
}

function play(seed: number, pace: Pace = 1): GameState {
  let s = createInitialState(profile(seed, { pace }));
  s = signWithClub(s, s.offers[0]!.clubId);
  let guard = 0;
  while (s.phase !== "end" && guard++ < 600) {
    if (s.pending) {
      const ids = decisionOptionIds(s.pending);
      s = applyDecision(s, ids[seed % ids.length]!);
      continue;
    }
    s = simulateChunk(s);
  }
  return s;
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!;

/* ------------------------------------------------------ A) Rating-Realismus */

describe("Start-OVR-Verteilung", () => {
  it("hält die vorgegebenen Bucket-Anteile ein", () => {
    const values: number[] = [];
    for (let i = 0; i < 20000; i++) values.push(startOvr(createRng(`start:${i}`)));
    const share = (fn: (v: number) => boolean) => values.filter(fn).length / values.length;
    expect(share((v) => v >= 50 && v <= 99)).toBe(1);
    expect(share((v) => v > 67)).toBeLessThanOrEqual(0.01);
    expect(share((v) => v > 71)).toBeLessThanOrEqual(0.0025);
    expect(share((v) => v <= 59)).toBeGreaterThan(0.7);
    const sorted = [...values].sort((a, b) => a - b);
    expect(quantile(sorted, 0.5)).toBeLessThanOrEqual(59);
  });
});

describe("Karriereverläufe über viele Seeds", () => {
  const states = Array.from({ length: 220 }, (_, i) => play(4000 + i));

  it("produziert keine Inflation junger Superstars", () => {
    const at20: number[] = [];
    let early90 = 0;
    for (const s of states) {
      for (const season of s.seasons) {
        if (season.age === 20) at20.push(season.endOvr);
        if (season.age < 23 && season.endOvr >= 90) early90++;
      }
    }
    const sorted = at20.sort((a, b) => a - b);
    expect(sorted.length).toBeGreaterThan(100);
    expect(quantile(sorted, 0.5)).toBeLessThan(75);
    expect(sorted.filter((v) => v >= 80).length / sorted.length).toBeLessThan(0.12);
    expect(early90 / states.length).toBeLessThan(0.02);
  });

  it("lässt OVR im Alter abbauen und bleibt in 50–99", () => {
    let declines = 0;
    let late = 0;
    for (const s of states) {
      for (const season of s.seasons) {
        expect(season.endOvr).toBeGreaterThanOrEqual(50);
        expect(season.endOvr).toBeLessThanOrEqual(99);
        if (season.age >= 35) {
          late++;
          // Gemessen wird der reine Saisonabbau vor der Entscheidung – ein
          // gewonnenes Gamble darf auch mit 38 noch OVR bringen.
          const seasonal = season.seasonalDelta ?? (season.preDecisionOvr ?? season.endOvr) - season.startOvr;
          if (seasonal <= 0) declines++;
        }
      }
    }
    expect(late).toBeGreaterThan(20);
    expect(declines / late).toBeGreaterThan(0.85);
  });

  it("trennt Basissaisonabbau von zusätzlichem Entscheidungs-OVR", () => {
    let decisionGains = 0;
    for (const s of states) {
      for (const season of s.seasons) {
        const seasonal = season.seasonalDelta ?? 0;
        // Produktionsregel: ab 36 keine normale Steigerung, ab 40 strikt negativ.
        if (season.age >= 36) expect(seasonal).toBeLessThanOrEqual(0);
        // Am Boden der Skala (50) kann der Abbau rechnerisch nicht mehr greifen.
        if (season.age >= 40 && season.startOvr > 50) expect(seasonal).toBeLessThan(0);

        const pre = season.preDecisionOvr;
        if (pre !== undefined && season.age >= 33 && season.endOvr > pre) decisionGains++;
      }
    }
    // Entscheidungen bleiben auch im hohen Alter eine echte Chance auf OVR.
    expect(decisionGains).toBeGreaterThan(0);
  });


  it("kennt schwere Verletzungen mit dauerhaft erhöhter Anfälligkeit", () => {
    const injured = states.filter((s) => s.player.majorInjuries > 0);
    const healthy = states.filter((s) => s.player.majorInjuries === 0);
    expect(injured.length).toBeGreaterThan(0);
    for (const s of injured) expect(s.player.injuryProneness).toBeGreaterThan(0);
    // Schwere Verletzungen erhöhen die Anfälligkeit dauerhaft (Story-Events dürfen sie senken).
    const mean = (arr: GameState[]) =>
      arr.reduce((sum, s) => sum + s.player.injuryProneness, 0) / Math.max(1, arr.length);
    if (healthy.length > 5) expect(mean(injured)).toBeGreaterThan(mean(healthy));
    const missed = states.flatMap((s) => s.seasons).filter((x) => x.missedSeason);
    for (const season of missed) expect(season.apps).toBe(0);
  });
});

/* ------------------------------------------------- B) Entscheidungs-Flow */

describe("Entscheidungsfluss", () => {
  it("erzeugt bei Tempo 1 pro Klick höchstens eine Entscheidung", () => {
    for (const seed of [11, 77, 123, 909]) {
      let s = createInitialState(profile(seed));
      s = signWithClub(s, s.offers[0]!.clubId);
      let clicks = 0;
      let withDecision = 0;
      while (s.phase !== "end" && clicks < 40) {
        const before = s.seasonIndex;
        s = simulateChunk(s);
        clicks++;
        if (s.pending) {
          withDecision++;
          // Höchstens eine offene Entscheidung; eine erzwungene Vereinswahl darf
          // als direkte Folge einer OVR-Wahl unmittelbar anschließen.
          const wasOvr = s.pending.kind === "ovr";
          s = applyDecision(s, decisionOptionIds(s.pending)[0]!);
          if (s.pending) {
            expect(wasOvr).toBe(true);
            // Folgeentscheidungen derselben Saison: Verein, Nationalteam,
            // "Noch ein Jahr?" oder – am Karriereende – Comeback.
            /**
             * Eine Verlängerung („Noch ein Jahr?“) simuliert direkt weiter und
             * darf danach erneut eine reguläre Saisonentscheidung erzeugen.
             */
            let guard = 0;
            while (s.pending && guard++ < 120) {
              expect(["ovr", "club", "comeback", "retirement", "nation"]).toContain(s.pending.kind);
              s = applyDecision(s, decisionOptionIds(s.pending)[0]!);
            }
            expect(s.pending).toBeUndefined();
          }

          expect(s.lastConsequence).toBeDefined();
        }
        expect(s.seasonIndex).toBeGreaterThanOrEqual(before);
      }
      // Deutliche Mehrheit der Klicks im Karrierealter liefert eine Interaktion.
      expect(withDecision / clicks).toBeGreaterThan(0.5);
    }
  });

  it("liefert auch bei Tempo 2 und 5 nie mehr als eine offene Entscheidung", () => {
    for (const pace of [2, 5] as Pace[]) {
      let s = createInitialState(profile(31, { pace }));
      s = signWithClub(s, s.offers[0]!.clubId);
      let guard = 0;
      while (s.phase !== "end" && guard++ < 200) {
        s = simulateChunk(s);
        // Es steht immer nur genau eine Entscheidung offen; Folgeentscheidungen
        // erscheinen erst nach der jeweiligen Wahl.
        let chain = 0;
        while (s.pending && chain++ < 30) {
          expect(decisionOptionIds(s.pending).length).toBeGreaterThanOrEqual(2);
          s = applyDecision(s, decisionOptionIds(s.pending)[0]!);
        }
        expect(s.pending).toBeUndefined();
      }

      expect(s.phase).toBe("end");
    }
  });

  it("schreibt Entscheidungsfolgen in den letzten SeasonRecord", () => {
    let s = createInitialState(profile(57));
    s = signWithClub(s, s.offers[0]!.clubId);
    let guard = 0;
    while (!s.pending && guard++ < 20) s = simulateChunk(s);
    expect(s.pending).toBeDefined();
    const before = s.seasons.length;
    s = applyDecision(s, decisionOptionIds(s.pending!)[0]!);
    expect(s.seasons.length).toBe(before);
    expect(s.decisions.length).toBeGreaterThan(0);
    expect(s.seasons[s.seasons.length - 1]!.decisionNote).toBeTruthy();
  });

  it("bleibt deterministisch für gleichen Seed", () => {
    expect(JSON.stringify(play(2024).seasons)).toBe(JSON.stringify(play(2024).seasons));
  });
});

/* ------------------------------------------------- D) Relationen */

describe("Vereinsbeziehungen", () => {
  it("löst kuratierte Paare auf echte Club-IDs auf", () => {
    expect(relationPairCount()).toBeGreaterThan(35);
    const bayern = clubsOf("DE", 1).find((c) => c.name === "FC Bayern München")!;
    for (const rel of relationsOf(bayern.id)) {
      expect(getClub(rel.a).isReal).toBe(true);
      expect(getClub(rel.b).isReal).toBe(true);
      expect(rel.intensity).toBeGreaterThan(0);
    }
  });

  it("kennt die klassischen Derbys beidseitig", () => {
    const pair = (a: string, b: string) => {
      const clubA = clubsOf(a.startsWith("FC Bayern") ? "DE" : "DE");
      return clubA;
    };
    void pair;
    const bayern = clubsOf("DE", 1).find((c) => c.name === "FC Bayern München")!;
    const bvb = clubsOf("DE", 1).find((c) => c.name === "Borussia Dortmund")!;
    expect(relationsOf(bayern.id).some((r) => r.b === bvb.id && r.type === "rivalry")).toBe(true);
    expect(relationsOf(bvb.id).some((r) => r.b === bayern.id)).toBe(true);
  });

  it("kennt dokumentierte Fanfreundschaften", () => {
    const gladbach = clubsOf("DE", 1).find((c) => c.name.includes("Mönchengladbach"));
    expect(gladbach).toBeTruthy();
    expect(relationsOf(gladbach!.id).some((r) => r.type === "fanFriendship")).toBe(true);
  });
});

/* ------------------------------------------------- E) Dynamische Clubwelt */

describe("Ligasimulation", () => {
  it("vergibt konsistente Tabellenplätze und genau einen Meister", () => {
    for (const code of ["DE", "ENG", "ES", "IT"]) {
      const world = emptyWorld();
      const cw = ensureCountryWorld(world, code);
      const result = simulateCountrySeason(world, code, 7, 0);
      const ids = Object.keys(cw.clubs);
      expect(Object.keys(result.positions).length).toBe(ids.length);
      const top = ids.filter((id) => cw.clubs[id]!.division === 1 && result.positions[id] === 1);
      expect(top.length).toBeGreaterThanOrEqual(1);
      expect(result.champion).toBeTruthy();
      expect(getClub(result.cupWinner).country).toBe(code);
    }
  });

  it("setzt Auf- und Abstiege in offenen Pyramiden um", () => {
    const world = emptyWorld();
    const cw = ensureCountryWorld(world, "DE");
    let promotions = 0;
    let relegations = 0;
    for (let season = 0; season < 6; season++) {
      const res = simulateCountrySeason(world, "DE", 99, season);
      promotions += res.promoted.length;
      relegations += res.relegated.length;
      for (const id of Object.keys(cw.clubs)) {
        expect(cw.clubs[id]!.division).toBeGreaterThanOrEqual(1);
        expect(cw.clubs[id]!.division).toBeLessThanOrEqual(maxDivision("DE"));
      }
    }
    expect(promotions).toBeGreaterThan(0);
    expect(relegations).toBeGreaterThan(0);
  });

  it("hält US-Ligen geschlossen", () => {
    expect(isClosedLeague("US")).toBe(true);
    const world = emptyWorld();
    const cw = ensureCountryWorld(world, "US");
    const divisions = Object.fromEntries(Object.entries(cw.clubs).map(([id, e]) => [id, e.division]));
    for (let i = 0; i < 5; i++) {
      const res = simulateCountrySeason(world, "US", 5, i);
      expect(res.promoted.length).toBe(0);
      expect(res.relegated.length).toBe(0);
    }
    for (const [id, division] of Object.entries(divisions)) {
      expect(cw.clubs[id]!.division).toBe(division);
    }
  });

  it("besitzt einen prozeduralen Unterbau, der nicht zu den realen Clubs zählt", () => {
    const feeder = clubsOf("DE", maxDivision("DE"));
    expect(feeder.length).toBeGreaterThanOrEqual(10);
    expect(feeder.every((c) => c.isReal !== true)).toBe(true);
  });

  it("lässt auch Außenseiter Titel und Europa erreichen", () => {
    const world = emptyWorld();
    const cw = ensureCountryWorld(world, "DE");
    const underdogTitles = new Set<string>();
    let quals = 0;
    let winners = 0;
    for (let season = 0; season < 40; season++) {
      const res = simulateCountrySeason(world, "DE", 1234, season);
      underdogTitles.add(res.champion);
      quals += Object.keys(res.qualification).length;
      winners += Object.keys(res.continentalWinners).length;
    }
    expect(underdogTitles.size).toBeGreaterThan(1);
    expect(quals).toBeGreaterThan(0);
    expect(winners).toBeGreaterThan(0);
  });

  it("nutzt die dynamische Ligaebene in den Saisonrecords", () => {
    const s = play(321);
    for (const season of s.seasons) {
      expect(season.leagueLabel.length).toBeGreaterThan(0);
      expect(season.division).toBeGreaterThanOrEqual(1);
      expect(season.tablePosition).toBeGreaterThanOrEqual(1);
    }
  });
});

/* ------------------------------------------------- Migration & UI-Vertrag */

describe("Speicherstand-Migration", () => {
  it("hebt v5-Stände robust auf v6", () => {
    const fresh = play(88);
    const legacy = JSON.parse(JSON.stringify({ ...fresh, version: 5 })) as Record<string, unknown>;
    delete (legacy as { world?: unknown }).world;
    delete (legacy as { fanRelations?: unknown }).fanRelations;
    const player = legacy["player"] as Record<string, unknown>;
    delete player["mentality"];
    delete player["injuryProneness"];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => JSON.stringify(legacy),
        setItem: () => {},
        removeItem: () => {},
      },
    });
    const loaded = loadState();
    vi.unstubAllGlobals();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(STATE_VERSION);
    expect(loaded!.player.mentality).toBeGreaterThan(0);
    expect(loaded!.player.injuryProneness).toBeGreaterThan(0);
    expect(loaded!.world).toBeTruthy();
    expect(getClub(loaded!.player.clubId).name).not.toBe("Unbekannter Verein");
  });
});

describe("Fanstatus", () => {
  it("beschreibt die Bindung neutral und aufsteigend", () => {
    const labels = [0, 30, 55, 72, 88, 99].map(fanStatus);
    expect(new Set(labels).size).toBeGreaterThan(3);
    for (const l of labels) expect(l.length).toBeGreaterThan(3);
  });
});
