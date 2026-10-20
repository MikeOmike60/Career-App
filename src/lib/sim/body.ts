/**
 * Körperverschleiß – die einzige echte Karrieregrenze.
 *
 * Es gibt bewusst KEIN festes Alterslimit. Ein fitter, robuster Spieler darf
 * auch mit Ende 40 oder 50 weiterspielen – nur über das menschenmögliche
 * Alter (HUMAN_AGE_LIMIT) geht es nicht hinaus. Weil der Verschleiß pro Saison strikt
 * monoton steigt (Mindestzuwachs > 0), erreicht jede Karriere in endlich vielen
 * Saisons das körperliche Limit – deterministisch und ohne Endlosschleife.
 */

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Bei diesem Wert ist die Karriere körperlich endgültig vorbei. */
export const BODY_WEAR_LIMIT = 100;
/** Ab hier wird ein Comeback körperlich unverantwortlich. */
export const BODY_WEAR_COMEBACK_MAX = 86;
/**
 * Menschenmöglicher Rahmen: Der älteste Profi der Welt stand mit Ende 50 noch
 * auf dem Platz. Darüber hinaus spielt auch in diesem Spiel niemand.
 */
export const HUMAN_AGE_LIMIT = 58;
/** Garantierter Mindestzuwachs pro Saison – sichert die Terminierung. */
export const BODY_WEAR_MIN_GAIN = 0.5;

export interface BodyWearInput {
  age: number;
  bodyWear: number;
  /** Anteil gespielter Minuten 0..1. */
  minutes: number;
  /** Ausfallmonate der Saison. */
  monthsOut: number;
  majorInjuries: number;
  injuryProneness: number;
  fitness: number;
  /**
   * Verdeckte Robustheit 0..1. Schützt echt, aber nie vollständig: Sie senkt den
   * Verschleiß maximal um 35 % und kann ihn nie auf 0 drücken.
   */
  longevity?: number | undefined;
}

/** Schutzfaktor der verdeckten Robustheit – bewusst begrenzt. */
export const LONGEVITY_MAX_PROTECTION = 0.35;

export function longevityFactor(longevity: number | undefined): number {
  return 1 - clamp(longevity ?? 0, 0, 1) * LONGEVITY_MAX_PROTECTION;
}

/**
 * Altersanteil des Verschleißes. Flach in der Blütezeit, ab 43 progressiv –
 * ohne Sprung und ohne Altersschwelle, die eine Karriere allein beendet.
 */
export function ageWearFactor(age: number): number {
  if (age <= 23) return 0.5;
  if (age <= 27) return 0.8;
  if (age <= 30) return 1.1;
  if (age <= 33) return 1.5;
  if (age <= 36) return 2;
  if (age <= 39) return 2.6;
  if (age <= 42) return 3.3;
  return 3.3 + Math.pow(age - 42, 1.6) * 0.5;
}

/** Zuwachs des Körperverschleißes einer Saison – immer strikt positiv. */
export function bodyWearGain(input: BodyWearInput): number {
  const load = clamp(input.minutes, 0, 1) * 0.9;
  const injury = clamp(input.monthsOut, 0, 12) * 0.85 + clamp(input.majorInjuries, 0, 20) * 0.5;
  const prone = clamp(input.injuryProneness, 0, 100) / 70;
  // Regeneration bremst den Zuwachs, macht ihn aber nie negativ.
  const recovery = clamp((input.fitness - 58) / 42, 0, 1) * 1.1;
  const raw = (ageWearFactor(input.age) + load + injury + prone) * longevityFactor(input.longevity) - recovery;
  return round1(Math.max(BODY_WEAR_MIN_GAIN, raw));
}

/** Neuer Verschleißwert nach einer Saison (0..100, monoton steigend). */
export function nextBodyWear(input: BodyWearInput): number {
  return clamp(round1(input.bodyWear + bodyWearGain(input)), 0, BODY_WEAR_LIMIT);
}

/**
 * Zusatzverschleiß für ein freiwillig angehängtes Jahr („Noch eine Saison“).
 * Robuste Spieler zahlen weniger, aber immer mehr als nichts.
 */
export function extensionWear(base: number, longevity: number | undefined): number {
  return round1(Math.max(0.8, base * longevityFactor(longevity)));
}

/**
 * Wahrscheinlichkeit, dass der Körper endgültig aufgibt. Steigt graduell mit
 * dem Verschleiß; Alter allein erzeugt keine faktische Grenze. Bei erreichtem
 * Limit ist sie 1 – deshalb endet jede Karriere zuverlässig.
 */
export function breakdownChance(
  bodyWear: number,
  age: number,
  majorInjuries: number,
  longevity?: number | undefined,
): number {
  if (bodyWear >= BODY_WEAR_LIMIT) return 1;
  const wear = clamp((bodyWear - 60) / 40, 0, 1);
  const base = wear * wear * 0.75 * longevityFactor(longevity);
  return clamp(base + majorInjuries * 0.01 + Math.max(0, age - 44) * 0.01, 0, 0.9);
}

/** true = körperlich endgültig vorbei; kein Comeback, keine „weitermachen“-Option. */
export function isBodyFinished(bodyWear: number): boolean {
  return bodyWear >= BODY_WEAR_LIMIT;
}

/** true = der Körper trägt noch eine weitere Saison. */
export function canPlayAnotherSeason(bodyWear: number): boolean {
  return bodyWear < BODY_WEAR_LIMIT;
}

/** true = ein Comeback ist körperlich noch vertretbar. */
export function canComeback(bodyWear: number, cause: string | undefined): boolean {
  return cause !== "body" && bodyWear <= BODY_WEAR_COMEBACK_MAX;
}

export function bodyWearLabel(bodyWear: number): string {
  if (bodyWear >= 92) return "am Limit";
  if (bodyWear >= 78) return "stark verschlissen";
  if (bodyWear >= 60) return "deutlich belastet";
  if (bodyWear >= 38) return "belastet";
  return "frisch";
}

/**
 * Plausibler Verschleiß für migrierte Spielstände (v4–v12). Deckelt bewusst bei
 * 70, damit eine laufende Karriere durch die Migration nie sofort endet.
 */
export function derivedBodyWear(age: number, majorInjuries: number, injuryProneness: number): number {
  const raw = Math.max(0, age - 17) * 2.2 + clamp(majorInjuries, 0, 20) * 4 + clamp(injuryProneness, 0, 100) / 5;
  return clamp(Math.round(raw), 0, 70);
}
