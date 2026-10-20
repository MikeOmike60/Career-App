import { describe, expect, it } from "vitest";
import {
  BAND_TRAITS,
  clubProfile,
  crisisShield,
  crisisShockRisk,
  curatedCount,
  normalizeClubName,
  relegationRiskFactor,
} from "./club-profile";
import { allClubs, getClub } from "./data";
import {
  emptyWorld,
  ensureCountryWorld,
  dynamicDivision,
  noiseScale,
  profileOf,
  seasonNoise,
  seasonScore,
  simulateWorldSeason,
} from "./world";
import { createRng } from "./rng";
import { teamBoostForSeason, STATE_VERSION } from "./engine";

const byName = (name: string) => allClubs().find((c) => c.name === name);

describe("Namensnormalisierung", () => {
  it("räumt Präfixe, Jahreszahlen und Umlaute weg", () => {
    expect(normalizeClubName("1. FC Köln")).toBe("koeln");
    expect(normalizeClubName("Atlético Madrid")).toBe("atletico madrid");
    expect(normalizeClubName("FC Bayern München")).toBe("bayern muenchen");
    expect(normalizeClubName("Juventus Turin")).toBe("juventus turin");
  });

  it("kuratiert eine substanzielle Zahl an Vereinen", () => {
    expect(curatedCount()).toBeGreaterThan(200);
  });
});

describe("Kalibrierte Vereinsstärken", () => {
  it("stuft Juventus klar über Aufsteigern und Fahrstuhlclubs ein", () => {
    const juve = byName("Juventus Turin")!;
    const como = byName("Como 1907") ?? byName("Como");
    const elversberg = byName("SV Elversberg");
    expect(juve.strength).toBeGreaterThanOrEqual(84);
    if (como) expect(juve.strength).toBeGreaterThan(como.strength + 5);
    if (elversberg) expect(juve.strength).toBeGreaterThan(elversberg.strength + 15);
  });

  it("hält die Spitze der großen Ligen plausibel beisammen", () => {
    for (const [name, min] of [
      ["FC Bayern München", 90],
      ["Real Madrid", 90],
      ["Manchester City", 88],
      ["Paris Saint-Germain", 88],
      ["Bayer 04 Leverkusen", 82],
    ] as const) {
      const club = byName(name);
      if (club) expect(club.strength, name).toBeGreaterThanOrEqual(min);
    }
  });

  it("deckelt Stärke nach Ligaebene, sodass kein Drittligist Weltklasse ist", () => {
    for (const club of allClubs()) {
      if (club.division >= 3) expect(club.strength, club.name).toBeLessThanOrEqual(75);
      if (club.division >= 2) expect(club.strength, club.name).toBeLessThanOrEqual(84);
    }
  });

  it("trennt Historie von aktueller Stärke", () => {
    const schalke = byName("FC Schalke 04");
    if (schalke) {
      const p = clubProfile({
        name: schalke.name,
        country: schalke.country,
        division: schalke.division,
        fallbackStrength: schalke.strength,
      });
      expect(p.band).toBe("historic-lower");
      expect(p.tradition).toBeGreaterThanOrEqual(80);
      expect(p.baseStrength).toBeLessThan(84);
    }
  });
});

describe("Saisonstreuung", () => {
  it("liefert kein Heavy-Tail mehr: 99,5 % der Ziehungen bleiben im engen Band", () => {
    const rng = createRng(4242);
    const values = Array.from({ length: 20000 }, () => seasonNoise(rng, 4));
    const extreme = values.filter((v) => Math.abs(v) > 12).length;
    expect(extreme).toBe(0);
    const sd = Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);
    expect(sd).toBeGreaterThan(2.5);
    expect(sd).toBeLessThan(5.5);
  });

  it("streut stabile Vereine deutlich weniger als Neulinge", () => {
    expect(noiseScale(clubProfileOf("global-giant"))).toBeLessThan(noiseScale(clubProfileOf("newcomer")) * 0.6);
  });

  it("dämpft Ausreißer nach unten nur, solange keine Krise besteht", () => {
    const profile = clubProfileOf("global-giant");
    const base = { strength: 92, division: 1, crisisLevel: 0, profile, boost: 0, noise: -10 };
    const healthy = seasonScore(base);
    const inCrisis = seasonScore({ ...base, crisisLevel: 4 });
    expect(healthy).toBeGreaterThan(inCrisis + 5);
    expect(crisisShield(0)).toBe(1);
    expect(crisisShield(4)).toBe(0);
  });
});

function clubProfileOf(band: "global-giant" | "newcomer") {
  return {
    band,
    baseStrength: 80,
    prestige: 80,
    finances: 80,
    curated: true,
    ...BAND_TRAITS[band],
  };
}

describe("Abstiegsrisiko", () => {
  it("ist für jeden Verein echt größer als null", () => {
    for (const band of Object.keys(BAND_TRAITS) as Array<keyof typeof BAND_TRAITS>) {
      const p = { ...clubProfileOf("newcomer"), ...BAND_TRAITS[band], band };
      expect(relegationRiskFactor(p, 0)).toBeGreaterThan(0);
      expect(crisisShockRisk(p)).toBeGreaterThan(0);
    }
  });

  it("steigt mit dem Krisenlevel", () => {
    const p = clubProfileOf("global-giant");
    expect(relegationRiskFactor(p, 4)).toBeGreaterThan(relegationRiskFactor(p, 0));
  });
});

describe("Langzeitstabilität der Clubwelt", () => {
  const giants = ["Juventus Turin", "FC Bayern München", "Real Madrid", "Manchester City", "Paris Saint-Germain"];

  it("lässt Giganten über 40 Saisons und 5 Seeds fast immer erstklassig bleiben", () => {
    let checks = 0;
    let belowSecond = 0;
    let outOfFirst = 0;
    for (const seed of [1, 77, 512, 90210, 314159]) {
      const world = emptyWorld();
      for (const code of ["DE", "IT", "ES", "ENG", "FR"]) ensureCountryWorld(world, code);
      for (let season = 0; season < 40; season++) {
        simulateWorldSeason(world, seed, season);
        for (const name of giants) {
          const club = byName(name);
          if (!club) continue;
          const div = dynamicDivision(world, club.id);
          checks++;
          if (div > 1) outOfFirst++;
          if (div > 2) belowSecond++;
        }
      }
    }
    expect(checks).toBeGreaterThan(500);
    // Ein Absturz unter Liga 2 (das gemeldete "Juventus in der Serie C") darf nicht vorkommen.
    expect(belowSecond).toBe(0);
    expect(outOfFirst / checks).toBeLessThan(0.03);
  });

  it("hält die Stärke der Giganten in einem realistischen Band", () => {
    const world = emptyWorld();
    for (let season = 0; season < 30; season++) simulateWorldSeason(world, 4711, season);
    for (const name of giants) {
      const club = byName(name);
      if (!club) continue;
      const entry = world.countries[club.country]!.clubs[club.id]!;
      expect(entry.strength, name).toBeGreaterThan(70);
      expect(entry.strength, name).toBeLessThanOrEqual(95);
    }
  });

  it("erlaubt trotzdem Bewegung: irgendwo steigt jemand auf und ab", () => {
    const world = emptyWorld();
    let moves = 0;
    for (let season = 0; season < 10; season++) {
      const res = simulateWorldSeason(world, 8080, season).byCountry["DE"]!;
      moves += res.promoted.length + res.relegated.length;
    }
    expect(moves).toBeGreaterThan(10);
  });

  it("bleibt deterministisch", () => {
    const a = emptyWorld();
    const b = emptyWorld();
    for (let season = 0; season < 6; season++) {
      simulateWorldSeason(a, 55, season);
      simulateWorldSeason(b, 55, season);
    }
    expect(JSON.stringify(a.countries["IT"])).toBe(JSON.stringify(b.countries["IT"]));
  });
});

describe("Spielereinfluss in derselben Saison", () => {
  it("wächst mit Klassenunterschied, Note und Einsatzzeit", () => {
    expect(teamBoostForSeason({ ovr: 90, teamStrength: 60, minutes: 0.9, rating: 8.2 })).toBeGreaterThan(6);
    expect(teamBoostForSeason({ ovr: 70, teamStrength: 70, minutes: 0.9, rating: 6.8 })).toBe(0);
    expect(teamBoostForSeason({ ovr: 90, teamStrength: 60, minutes: 0.1, rating: 8.2 })).toBe(0);
    expect(teamBoostForSeason({ ovr: 90, teamStrength: 60, minutes: 0.9, rating: 8.2, missedSeason: true })).toBe(0);
  });

  it("verbessert die Tabellenposition des eigenen Vereins spürbar", () => {
    const weak = allClubs()
      .filter((c) => c.country === "DE" && c.division === 2)
      .sort((a, b) => b.strength - a.strength)[3]!;
    const without = emptyWorld();
    const withBoost = emptyWorld();
    const a = simulateWorldSeason(without, 321, 0).byCountry["DE"]!.positions[weak.id]!;
    const b = simulateWorldSeason(withBoost, 321, 0, [], { [weak.id]: 8 }).byCountry["DE"]!.positions[weak.id]!;
    expect(b).toBeLessThanOrEqual(a);
    const profile = profileOf(weak.id);
    const args = { strength: 70, division: 2, crisisLevel: 0, profile, noise: 0 };
    expect(seasonScore({ ...args, boost: 8 })).toBeGreaterThan(seasonScore({ ...args, boost: 0 }));
    expect(getClub(weak.id).name.length).toBeGreaterThan(0);
    expect(profileOf(weak.id).baseStrength).toBeGreaterThan(0);
  });
});

describe("Speicherstand-Version", () => {
  it("liegt nach dem Investoren-Projekt bei 14", () => {
    expect(STATE_VERSION).toBe(14);
  });
});
