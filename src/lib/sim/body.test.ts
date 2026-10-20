import { describe, expect, it } from "vitest";
import {
  BODY_WEAR_LIMIT,
  BODY_WEAR_MIN_GAIN,
  ageWearFactor,
  bodyWearGain,
  canComeback,
  canPlayAnotherSeason,
  extensionWear,
  isBodyFinished,
  maxCareerAge,
  MAX_CAREER_AGE,
  MAX_CAREER_AGE_ABSOLUTE,
  nextBodyWear,
} from "./body";

/** Idealer Verlauf: extrem robust, topfit, keine Verletzungen. */
function idealSeason(age: number, bodyWear: number) {
  return {
    age,
    bodyWear,
    minutes: 0.95,
    monthsOut: 0,
    majorInjuries: 0,
    injuryProneness: 8,
    fitness: 99,
    longevity: 1,
  };
}

/** Normaler Profialltag: durchschnittliche Robustheit, kleine Ausfälle. */
function normalSeason(age: number, bodyWear: number, majorInjuries: number) {
  return {
    age,
    bodyWear,
    minutes: 0.85,
    monthsOut: 1,
    majorInjuries,
    injuryProneness: 42,
    fitness: 72,
    longevity: 0.3,
  };
}

function runCareer(
  make: (age: number, wear: number) => Parameters<typeof nextBodyWear>[0],
  toAge: number,
): { age: number; wear: number } {
  let wear = 0;
  let age = 16;
  while (age < toAge && wear < BODY_WEAR_LIMIT) {
    wear = nextBodyWear(make(age, wear));
    age += 1;
  }
  return { age, wear };
}

describe("Körperverschleiß und Höchstalter", () => {
  it("wächst streng monoton und nie um weniger als den Mindestzuwachs", () => {
    let wear = 0;
    for (let age = 16; age <= 60; age++) {
      const gain = bodyWearGain(idealSeason(age, wear));
      expect(gain).toBeGreaterThanOrEqual(BODY_WEAR_MIN_GAIN);
      const next = nextBodyWear(idealSeason(age, wear));
      expect(next).toBeGreaterThan(wear - 1e-9);
      if (next < BODY_WEAR_LIMIT) expect(next).toBeGreaterThan(wear);
      wear = next;
    }
  });

  it("kennt keine Sprünge in der Alterskurve, steigt aber spät progressiv", () => {
    for (let age = 17; age <= 55; age++) {
      expect(ageWearFactor(age)).toBeGreaterThanOrEqual(ageWearFactor(age - 1));
    }
    expect(ageWearFactor(48) - ageWearFactor(47)).toBeGreaterThan(ageWearFactor(30) - ageWearFactor(29));
  });

  it("beendet die Karriere bei Verschleiß 100 endgültig", () => {
    expect(isBodyFinished(BODY_WEAR_LIMIT)).toBe(true);
    expect(canPlayAnotherSeason(BODY_WEAR_LIMIT)).toBe(false);
    expect(canComeback(BODY_WEAR_LIMIT, undefined)).toBe(false);
  });

  it("lässt einen alten Spieler mit Verschleiß unter 100 weiterspielen", () => {
    expect(canPlayAnotherSeason(97.4)).toBe(true);
    expect(isBodyFinished(97.4)).toBe(false);
  });

  it("lässt einen extrem robusten, verletzungsfreien Verlauf körperlich bis zum Höchstalter durchhalten", () => {
    const { age, wear } = runCareer(idealSeason, MAX_CAREER_AGE);
    expect(age).toBe(MAX_CAREER_AGE);
    expect(wear).toBeLessThan(BODY_WEAR_LIMIT);
    expect(canPlayAnotherSeason(wear)).toBe(true);
  });

  it("verschleißt einen normal belasteten Verlauf klar schneller", () => {
    let wear = 0;
    let injuries = 0;
    for (let age = 16; age < MAX_CAREER_AGE; age++) {
      if (age % 4 === 0) injuries += 1;
      wear = nextBodyWear(normalSeason(age, wear, injuries));
      if (wear >= BODY_WEAR_LIMIT) break;
    }
    const ideal = runCareer(idealSeason, MAX_CAREER_AGE).wear;
    expect(wear).toBeGreaterThan(ideal + 20);
  });

  it("beendet eine normale Karriere mit hoher Last deutlich vor 50", () => {
    let wear = 0;
    let injuries = 1;
    let endAge = 50;
    for (let age = 16; age < 60; age++) {
      injuries += age % 3 === 0 ? 1 : 0;
      wear = nextBodyWear({ ...normalSeason(age, wear, injuries), monthsOut: 2, fitness: 66 });
      if (wear >= BODY_WEAR_LIMIT) {
        endAge = age;
        break;
      }
    }
    expect(endAge).toBeLessThan(45);
  });

  it("setzt ein realistisches Höchstalter – Torhüter und Legenden etwas später", () => {
    const field = maxCareerAge({ goalkeeper: false, longevity: 0.5, legend: false });
    expect(field).toBe(MAX_CAREER_AGE);
    expect(maxCareerAge({ goalkeeper: true, longevity: 0.5, legend: false })).toBeGreaterThan(field);
    expect(maxCareerAge({ goalkeeper: true, longevity: 1, legend: true })).toBeLessThanOrEqual(MAX_CAREER_AGE_ABSOLUTE);
  });

  it("verhindert ein Comeback nach körperlichem Karriereende", () => {
    expect(canComeback(40, "body")).toBe(false);
    expect(canComeback(40, "choice")).toBe(true);
  });

  it("macht Zusatzverschleiß beim Verlängern robustheitsabhängig, aber nie gratis", () => {
    const robust = extensionWear(4, 1);
    const fragile = extensionWear(4, 0);
    expect(robust).toBeLessThan(fragile);
    expect(robust).toBeGreaterThan(0);
  });
});
