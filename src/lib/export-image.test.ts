import { describe, expect, it } from "vitest";
import {
  DESKTOP_BUDGET,
  MIN_RATIO,
  MOBILE_BUDGET,
  aspectMatches,
  budgetFor,
  exportPixelRatio,
  fitsBudget,
  reducedRatio,
} from "./export-image";

const WIDTH = 1000;

describe("exportPixelRatio", () => {
  it("nutzt die volle Auflösung bei kurzen Karrieren", () => {
    expect(exportPixelRatio(WIDTH, 2000, MOBILE_BUDGET)).toBe(2);
  });

  it("hält das Pixelbudget bei mittellangen Karrieren ein", () => {
    const h = 6000;
    const r = exportPixelRatio(WIDTH, h, MOBILE_BUDGET);
    expect(WIDTH * r * h * r).toBeLessThanOrEqual(MOBILE_BUDGET.maxPixels);
    expect(r).toBeLessThan(2);
  });

  it("respektiert die maximale Kantenlänge auch bei kleinem Pixelprodukt", () => {
    const h = 30_000;
    const r = exportPixelRatio(WIDTH, h, MOBILE_BUDGET);
    expect(h * r).toBeLessThanOrEqual(MOBILE_BUDGET.maxDimension);
  });

  it("geht bei extrem langen Karrieren unter 1 statt abzuschneiden", () => {
    const r = exportPixelRatio(WIDTH, 40_000, MOBILE_BUDGET);
    expect(r).toBeLessThan(1);
    expect(r).toBeGreaterThan(0);
  });

  it("hält Kanten- und Pixelbudget bei beliebiger Höhe ein (Regression 100000)", () => {
    for (const h of [40_961, 100_000, 250_000, 1_000_000]) {
      for (const budget of [MOBILE_BUDGET, DESKTOP_BUDGET]) {
        const r = exportPixelRatio(WIDTH, h, budget);
        expect(r).toBeGreaterThan(0);
        expect(fitsBudget(WIDTH * r, h * r, budget)).toBe(true);
      }
    }
  });

  it("erlaubt auf dem Desktop mehr Pixel als mobil", () => {
    expect(exportPixelRatio(WIDTH, 12_000, DESKTOP_BUDGET)).toBeGreaterThan(
      exportPixelRatio(WIDTH, 12_000, MOBILE_BUDGET),
    );
  });

  it("wählt das Budget nach Viewportbreite und fällt ohne Angabe auf mobil zurück", () => {
    expect(budgetFor(1440)).toBe(DESKTOP_BUDGET);
    expect(budgetFor(390)).toBe(MOBILE_BUDGET);
    expect(budgetFor(undefined)).toBe(MOBILE_BUDGET);
  });
});

describe("reducedRatio", () => {
  it("verkleinert stufenweise und endet am Minimum", () => {
    let r: number | null = 2;
    const seen: number[] = [];
    while (r !== null) {
      seen.push(r);
      r = reducedRatio(r);
    }
    expect(seen.length).toBeGreaterThan(2);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeLessThan(seen[i - 1]!);
    expect(seen[seen.length - 1]!).toBeGreaterThanOrEqual(MIN_RATIO);
  });
});

describe("Validierung der tatsächlichen Bildmaße", () => {
  it("weist Nullmaße und Budgetüberschreitungen ab", () => {
    expect(fitsBudget(0, 100, MOBILE_BUDGET)).toBe(false);
    expect(fitsBudget(100, 0, MOBILE_BUDGET)).toBe(false);
    expect(fitsBudget(9000, 100, MOBILE_BUDGET)).toBe(false);
    expect(fitsBudget(5000, 5000, MOBILE_BUDGET)).toBe(false);
    expect(fitsBudget(1000, 8000, MOBILE_BUDGET)).toBe(true);
  });

  it("erkennt abgeschnittene Bilder am Seitenverhältnis", () => {
    expect(aspectMatches(1000, 20_000, 500, 10_000)).toBe(true);
    // Nur die halbe Höhe gerendert -> abgeschnitten.
    expect(aspectMatches(1000, 20_000, 500, 5_000)).toBe(false);
    expect(aspectMatches(1000, 20_000, 0, 0)).toBe(false);
  });
});
