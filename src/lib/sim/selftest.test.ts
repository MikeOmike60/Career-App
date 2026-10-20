import { describe, expect, it } from "vitest";
import { COUNTRIES, COUNTRY_BY_CODE, allClubs, clubsOf, getClub, REAL_COUNTRY_CODES, REAL_DATA_INFO } from "./data";
import { applyDecision, createInitialState, decisionOptionIds, signWithClub, simulateChunk } from "./engine";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

const DEPTHS: Record<string, number> = {
  DE: 4,
  ENG: 4,
  ES: 3,
  IT: 3,
  JP: 3,
  FR: 2,
  PT: 2,
  AT: 2,
  CH: 2,
  SCO: 2,
  US: 2,
};

const PACES: Pace[] = [1, 2, 5];

function profile(seed: number): Profile {
  return {
    name: `Testspieler ${seed}`,
    birthDate: `${1985 + (seed % 40)}-0${1 + (seed % 9)}-1${seed % 9}`,
    height: 165 + (seed % 30),
    weight: 58 + (seed % 40),
    nat1: COUNTRIES[seed % COUNTRIES.length]!.code,
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: `preset:${seed % 6}`,
    pace: PACES[seed % 3]!,
    seed,
  };
}

describe("Länderkatalog", () => {
  it("umfasst 211 Verbände mit eindeutigen Codes", () => {
    expect(COUNTRIES.length).toBe(211);
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(211);
  });

  it("hält die vorgegebenen Ligatiefen ein", () => {
    for (const c of COUNTRIES) {
      expect(`${c.code}:${c.tiers}`).toBe(`${c.code}:${DEPTHS[c.code] ?? 1}`);
    }
  });

  it("erzeugt für jede Liga jedes Landes genügend eindeutige Clubs", () => {
    for (const c of COUNTRIES) {
      for (let d = 1; d <= c.tiers; d++) {
        const clubs = clubsOf(c.code, d);
        expect(clubs.length).toBeGreaterThanOrEqual(10);
        expect(new Set(clubs.map((x) => x.name)).size).toBe(clubs.length);
      }
    }
  });

  it("vergibt weltweit eindeutige Club-IDs", () => {
    const all = allClubs();
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
  });
});

function playThrough(seed: number): GameState {
  let s = createInitialState(profile(seed));
  s = signWithClub(s, s.offers[0]!.clubId);
  let guard = 0;
  while (s.phase !== "end" && guard++ < 500) {
    if (s.pending) {
      const ids = decisionOptionIds(s.pending);
      s = applyDecision(s, ids[seed % ids.length]!);
      continue;
    }
    s = simulateChunk(s);
  }
  return s;
}

describe("Karriere-Invarianten (1000 Seeds)", () => {
  it("liefert plausible Karrieren ohne Regelverstöße", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const p = profile(seed);
      const state = playThrough(seed);
      expect(state.phase).toBe("end");
      expect(state.seasons.length).toBeGreaterThan(0);

      const birthYear = Number(p.birthDate.slice(0, 4));
      const startAge = state.seasons[0]!.age;
      expect(startAge).toBeGreaterThanOrEqual(14);
      expect(startAge).toBeLessThanOrEqual(16);
      expect(Number(state.seasons[0]!.seasonLabel.slice(0, 4))).toBe(birthYear + startAge);

      for (const s of state.seasons) {
        expect(s.startOvr).toBeGreaterThanOrEqual(50);
        expect(s.startOvr).toBeLessThanOrEqual(99);
        expect(s.endOvr).toBeGreaterThanOrEqual(50);
        expect(s.endOvr).toBeLessThanOrEqual(99);
        // Saisonentwicklung + Entscheidungs-Gamble zusammen nie über +8
        expect(s.endOvr - s.startOvr).toBeLessThanOrEqual(8);
        expect(s.apps).toBeGreaterThanOrEqual(0);
        expect(s.goals).toBeGreaterThanOrEqual(0);
        expect(s.assists).toBeGreaterThanOrEqual(0);
        expect(s.rating).toBeGreaterThan(0);
        expect(Number.isFinite(s.rating)).toBe(true);
        expect(s.leagueLabel.length).toBeGreaterThan(0);
      }

      const last = state.seasons[state.seasons.length - 1]!;
      expect(last.age).toBeLessThanOrEqual(50);
      expect(state.peakOvr).toBeGreaterThanOrEqual(last.endOvr);
    }
  }, 300_000);

  it("ist deterministisch für denselben Seed", () => {
    const a = playThrough(42);
    const b = playThrough(42);
    expect(JSON.stringify(a.seasons)).toBe(JSON.stringify(b.seasons));
  }, 900_000);
});

/* ------------------------------------------------- Reale Datenqualität */

const MARKUP = /[[\]{}|]|''|<[^>]+>|https?:\/\//;
const VENUE = /\b(Stadium|Stadion|Complex|Coliseum|Estadio|Ballpark|Fairgrounds)\b/i;
const REAL_DEPTH: Record<string, number> = {
  DE: 4, ENG: 4, ES: 3, IT: 3, JP: 3, FR: 2, PT: 2, AT: 2, CH: 2, SCO: 2, US: 2,
};

describe("reale Vereinsdaten", () => {
  it("dokumentiert 11 Verbände und 681 reale Vereine", () => {
    expect(REAL_DATA_INFO.realNamesCountries).toBe(11);
    expect(REAL_DATA_INFO.realClubs).toBe(681);
    expect(REAL_COUNTRY_CODES.sort()).toEqual(Object.keys(REAL_DEPTH).sort());
  });

  it("nutzt die realen Namen in jeder Ebene der Kernverbände", () => {
    for (const [code, depth] of Object.entries(REAL_DEPTH)) {
      for (let d = 1; d <= depth; d++) {
        const clubs = clubsOf(code, d);
        expect(clubs.length).toBeGreaterThanOrEqual(10);
        expect(clubs.every((c) => c.isReal)).toBe(true);
        expect(clubs.every((c) => Boolean(c.officialName) && Boolean(c.season))).toBe(true);
      }
      expect(COUNTRY_BY_CODE.get(code)!.tiers).toBe(depth);
    }
  });

  it("bildet Staffeln und geschlossene Systeme korrekt ab", () => {
    const groups = (code: string, d: number) =>
      new Set(clubsOf(code, d).map((c) => c.group ?? "-"));
    expect(groups("DE", 4).size).toBe(5);
    expect(groups("ES", 3).size).toBe(2);
    expect(groups("IT", 3).size).toBe(3);
    expect(clubsOf("US").every((c) => c.promotionSystem === "closed")).toBe(true);
    expect(clubsOf("DE").every((c) => c.promotionSystem === "pyramid")).toBe(true);
  });

  it("enthält keine kaputten, leeren oder doppelten Namen", () => {
    const real = allClubs().filter((c) => c.isReal);
    expect(real.length).toBe(681);
    for (const c of real) {
      expect(c.name.trim().length).toBeGreaterThan(2);
      expect(MARKUP.test(c.name)).toBe(false);
      expect(VENUE.test(c.name)).toBe(false);
      expect(c.name).toBe(c.name.trim());
    }
    for (const code of REAL_COUNTRY_CODES) {
      const names = clubsOf(code).map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("enthält die bekannten Topklubs", () => {
    const names = new Set(allClubs().map((c) => c.name));
    for (const n of [
      "FC Bayern München",
      "Borussia Dortmund",
      "FC Arsenal",
      "Manchester City",
      "Real Madrid",
      "FC Barcelona",
      "Inter Mailand",
      "Paris Saint-Germain",
    ]) {
      expect(names.has(n)).toBe(true);
    }
  });

  it("löst unbekannte Club-IDs auf einen echten Verein auf", () => {
    const club = getClub("DE-1-999");
    expect(club.country).toBe("DE");
    expect(club.name).not.toBe("Unbekannter Verein");
    expect(getClub("XX-9-9").name).not.toBe("Unbekannter Verein");
  });
});
