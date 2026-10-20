import { describe, expect, it } from "vitest";
import {
  emptyWorld,
  ensureCountryWorld,
  isClosedLeague,
  maxDivision,
  simulateWorldSeason,
  worldEntry,
  leagueLabelFor,
  CORE_WORLD_COUNTRIES,
} from "./world";
import { relationResolution, declaredPairs, relationPairCount } from "./club-relations";
import { COUNTRIES, COUNTRY_BY_CODE, clubsOf, getClub } from "./data";

describe("Vereinsbeziehungen", () => {
  it("löst JEDE kuratierte Paarung zu echten Vereinen auf", () => {
    const res = relationResolution();
    expect(res.missing, JSON.stringify(res.missing, null, 2)).toEqual([]);
    expect(res.resolved).toBe(res.expected);
    expect(res.expected).toBe(declaredPairs().length);
    expect(relationPairCount()).toBe(res.expected);
  });

  it("enthält das korrigierte Saitama-Derby", () => {
    const pair = declaredPairs().find((p) => p.label === "Saitama Derby");
    expect(pair?.b).toBe("JP:RB Ōmiya Ardija");
  });
});

describe("Offene Pyramiden und Feeder-Ebenen", () => {
  it("kennzeichnet nur die USA als geschlossenes System", () => {
    const closed = COUNTRIES.filter((c) => isClosedLeague(c.code)).map((c) => c.code);
    expect(closed).toEqual(["US"]);
  });

  it("gibt jedem Nicht-US-Verband eine Feeder-Ebene unter den sichtbaren Ligen", () => {
    for (const code of ["DE", "BRA", "GHA", "NZL"]) {
      const country = COUNTRY_BY_CODE.get(code);
      if (!country) continue;
      expect(maxDivision(code)).toBe(country.tiers + 1);
      expect(clubsOf(code, country.tiers + 1).length).toBeGreaterThan(4);
    }
    expect(maxDivision("US")).toBe(COUNTRY_BY_CODE.get("US")!.tiers);
  });

  it("bewegt Vereine in einem Ein-Liga-Land auf und ab, in den USA nie", () => {
    const small = COUNTRIES.find((c) => c.tiers === 1 && c.code !== "US")!;
    const world = emptyWorld();
    ensureCountryWorld(world, small.code);
    const before = Object.fromEntries(
      Object.entries(world.countries[small.code]!.clubs).map(([id, e]) => [id, e.division]),
    );
    let moves = 0;
    for (let i = 0; i < 6; i++) {
      const res = simulateWorldSeason(world, 4242, i, [small.code]).byCountry[small.code]!;
      moves += res.promoted.length + res.relegated.length;
    }
    expect(moves).toBeGreaterThan(0);
    expect(Object.keys(before).length).toBeGreaterThan(0);

    const usWorld = emptyWorld();
    let usMoves = 0;
    for (let i = 0; i < 10; i++) {
      const res = simulateWorldSeason(usWorld, 99, i).byCountry["US"]!;
      usMoves += res.promoted.length + res.relegated.length;
    }
    expect(usMoves).toBe(0);
  });
});

describe("Gemeinsame Weltsaison", () => {
  it("simuliert alle Kernverbände in derselben Saison", () => {
    const world = emptyWorld();
    simulateWorldSeason(world, 7, 0);
    for (const code of CORE_WORLD_COUNTRIES) {
      expect(world.countries[code]!.lastSeason).toBe(0);
    }
    simulateWorldSeason(world, 7, 1);
    expect(world.countries["DE"]!.lastSeason).toBe(1);
    expect(world.countries["ENG"]!.lastSeason).toBe(1);
  });

  it("hat genau einen globalen Sieger je UEFA-Wettbewerb", () => {
    const world = emptyWorld();
    const res = simulateWorldSeason(world, 11, 0);
    for (const comp of ["UEFA Champions League", "UEFA Europa League", "UEFA Conference League"]) {
      const winner = res.continentalWinners[comp];
      expect(typeof winner).toBe("string");
      for (const code of ["DE", "ENG", "ES", "IT"]) {
        expect(res.byCountry[code]!.continentalWinners[comp]).toBe(winner);
      }
    }
  });

  it("simuliert dieselbe Saison nicht zweimal und bleibt deterministisch", () => {
    const world = emptyWorld();
    const a = simulateWorldSeason(world, 5, 0);
    const b = simulateWorldSeason(world, 5, 0);
    expect(b).toBe(a);

    const other = emptyWorld();
    const c = simulateWorldSeason(other, 5, 0);
    expect(c.byCountry["DE"]!.champion).toBe(a.byCountry["DE"]!.champion);
    expect(c.continentalWinners).toEqual(a.continentalWinners);
  });

  it("hat schon in Saison 0 europäische Teilnehmer", () => {
    const world = emptyWorld();
    const res = simulateWorldSeason(world, 21, 0);
    const entries = Object.values(res.byCountry["DE"]!.continental);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("vergibt in jeder Liga genau einen Meister und konsistente Plätze", () => {
    const world = emptyWorld();
    const res = simulateWorldSeason(world, 33, 0).byCountry["DE"]!;
    const firsts = clubsOf("DE", 1).filter((c) => res.positions[c.id] === 1);
    const groups = new Set(clubsOf("DE", 1).map((c) => c.group ?? "-"));
    expect(firsts.length).toBe(groups.size);
    expect(res.positions[res.champion]).toBe(1);
  });
});

describe("Dynamische Ligadaten", () => {
  it("zeigt einen abgestiegenen Großclub mit aktueller Liga", () => {
    const world = emptyWorld();
    ensureCountryWorld(world, "DE");
    const bayern = clubsOf("DE", 1).find((c) => c.name === "FC Bayern München")!;
    worldEntry(world, bayern.id).division = 3;
    world.countries["DE"]!.clubs[bayern.id]!.division = 3;
    const label = leagueLabelFor(world, bayern.id);
    expect(label).not.toBe(getClub(bayern.id).league);
    expect(label.length).toBeGreaterThan(0);
  });
});
