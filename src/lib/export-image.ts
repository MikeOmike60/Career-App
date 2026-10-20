/**
 * Reine Hilfsfunktionen für den PNG-Export der Karrierekarte.
 * Bewusst ohne DOM-Zugriff, damit sie direkt testbar sind.
 */

/** Konservatives Budget, das auch auf Mobilgeräten (iOS Safari) hält. */
export const MOBILE_BUDGET = { maxPixels: 16_000_000, maxDimension: 8_192 };
/** Etwas großzügiger auf Desktop-Browsern. */
export const DESKTOP_BUDGET = { maxPixels: 40_000_000, maxDimension: 16_384 };

/** Unterhalb dieses Verhältnisses ist das Bild praktisch unlesbar. */
export const MIN_RATIO = 0.02;

export interface PixelBudget {
  maxPixels: number;
  maxDimension: number;
}

/**
 * Stufenloses Verhältnis: begrenzt Gesamtpixel UND längste Kante.
 * Für sehr lange Karrieren wird das Verhältnis bewusst kleiner als 1 –
 * lieber eine geringere Auflösung als abgeschnittene oder fehlende Saisons.
 *
 * Es gibt bewusst KEINE untere Klemmung: eine Untergrenze würde das Budget
 * bei extremen Höhen verletzen. Ist das Budget rechnerisch nicht mehr
 * einhaltbar (Verhältnis rundet auf 0), wird 0 zurückgegeben – der Aufrufer
 * muss dann ehrlich einen Fehler zeigen statt ein ungültiges Bild.
 */
export function exportPixelRatio(
  width: number,
  height: number,
  budget: PixelBudget,
  preferred = 2,
): number {
  if (!(width > 0) || !(height > 0)) return preferred;
  const byPixels = Math.sqrt(budget.maxPixels / (width * height));
  const byDimension = budget.maxDimension / Math.max(width, height);
  const raw = Math.min(preferred, byPixels, byDimension);
  // Abrunden (4 Nachkommastellen), damit das Budget nie überschritten wird.
  const ratio = Math.floor(raw * 10_000) / 10_000;
  return ratio > 0 ? ratio : 0;
}

/** Nächstkleinere Stufe für einen Wiederholungsversuch nach Renderfehlern. */
export function reducedRatio(ratio: number): number | null {
  const next = Math.floor(ratio * 0.7 * 10_000) / 10_000;
  return next >= MIN_RATIO ? next : null;
}

/** Standardbudget nach Gerätebreite (ohne window: mobil annehmen). */
export function budgetFor(viewportWidth: number | undefined): PixelBudget {
  return typeof viewportWidth === "number" && viewportWidth >= 1024 ? DESKTOP_BUDGET : MOBILE_BUDGET;
}

/** Prüft tatsächlich dekodierte Bildmaße gegen das Budget. */
export function fitsBudget(width: number, height: number, budget: PixelBudget): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  if (Math.max(width, height) > budget.maxDimension) return false;
  return width * height <= budget.maxPixels;
}

/**
 * Prüft, ob das dekodierte Bild wirklich die gesamte Vorlage zeigt.
 * Ein abgeschnittenes PNG hat ein anderes Seitenverhältnis als die Quelle.
 */
export function aspectMatches(
  sourceWidth: number,
  sourceHeight: number,
  actualWidth: number,
  actualHeight: number,
  tolerance = 0.02,
): boolean {
  if (!(sourceWidth > 0) || !(sourceHeight > 0) || !(actualWidth > 0) || !(actualHeight > 0)) return false;
  const want = sourceHeight / sourceWidth;
  const got = actualHeight / actualWidth;
  return Math.abs(got - want) / want <= tolerance;
}
