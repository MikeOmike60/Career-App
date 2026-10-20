/**
 * Sportliche Sackgasse: Ein guter Spieler bei einem guten Verein, der nichts
 * gewinnt. Agent oder Familie melden sich – datengetrieben aus den letzten
 * abgeschlossenen Saisons beim SELBEN Club, mit eigenem Cooldown gegen Spam.
 */
import type { GameState } from "./types";
import { dynamicStrength } from "./world";

/** Ab diesem OVR gilt der Spieler als „zu gut für Titellosigkeit“. */
export const STAGNATION_MIN_OVR = 78;
/** Ab dieser dynamischen Teamstärke gilt der Verein als „gut genug“. */
export const STAGNATION_MIN_CLUB_STRENGTH = 78;
/** Reguläre Serie ohne Titel, die den Trigger allein auslöst. */
export const STAGNATION_TROPHYLESS_SEASONS = 3;
/** Mindesteinsatzzeit, damit die Nachricht glaubwürdig ist. */
export const STAGNATION_MIN_MINUTES = 0.5;
/** Cooldown-Spanne in Saisons. */
export const STAGNATION_COOLDOWN_MIN = 3;
export const STAGNATION_COOLDOWN_MAX = 5;
/** Zielkorridor der Angebotsstärke relativ zum OVR. */
export const STAGNATION_TARGET_MIN_OFFSET = -5;
export const STAGNATION_TARGET_MAX_OFFSET = 7;

export interface StagnationInput {
  ovr: number;
  /** Dynamische Stärke des aktuellen Vereins. */
  clubStrength: number;
  /** Abgeschlossene Saisons in Folge beim selben Club ohne Titel. */
  trophylessSeasons: number;
  /** Anzahl klar enttäuschender Platzierungen trotz Weltklasse-Kader. */
  disappointingSeasons: number;
  /** Die letzte Saison endete mit dem Abstieg dieses guten Teams. */
  relegated: boolean;
  loan: boolean;
  /** Einsatzzeitanteil der letzten Saison 0..1. */
  minutes: number;
  /** true = in dieser Saison wurde ein großer Titel gewonnen. */
  wonMajorThisSeason: boolean;
  /** true = eigener Cooldown ist noch aktiv. */
  cooldownActive: boolean;
}

/**
 * Reine Regel – einzige Quelle des Triggers. Keine Zufallskomponente, damit
 * das Verhalten vollständig testbar bleibt.
 */
export function stagnationTriggered(input: StagnationInput): boolean {
  if (input.loan) return false;
  if (input.cooldownActive) return false;
  // Ein frischer großer Titel setzt die Serie zurück – niemand rät dann zum Wechsel.
  if (input.wonMajorThisSeason) return false;
  if (input.ovr < STAGNATION_MIN_OVR) return false;
  if (input.clubStrength < STAGNATION_MIN_CLUB_STRENGTH) return false;
  if (input.minutes < STAGNATION_MIN_MINUTES) return false;

  // Ein echter Abstieg mit diesem Kader ist sofort ein Trigger – nicht erst
  // nach zwei weiteren titellosen Saisons.
  if (input.relegated) return true;
  if (input.trophylessSeasons >= STAGNATION_TROPHYLESS_SEASONS) return true;
  // Zwei klar enttäuschende Platzierungen trotz Weltklasse-Kader genügen.
  if (input.disappointingSeasons >= 2) return true;
  return false;
}

/**
 * Liest die Trigger-Eingaben deterministisch aus dem Spielstand. Betrachtet nur
 * abgeschlossene Saisons beim aktuellen Verein.
 */
export function stagnationInputOf(state: GameState): StagnationInput {
  const p = state.player;
  const clubId = p.clubId;
  const seasons = state.seasons;
  const last = seasons[seasons.length - 1];
  const clubStrength = dynamicStrength(state.world, clubId);

  let trophylessSeasons = 0;
  let disappointingSeasons = 0;
  for (let i = seasons.length - 1; i >= 0; i--) {
    const s = seasons[i]!;
    if (s.clubId !== clubId || s.loan) break;
    if (s.trophies.some((t) => t.kind === "club")) break;
    trophylessSeasons += 1;
    // Weltklasse-Kader (Stärke >= Schwelle), aber Platz 5 oder schlechter.
    if (s.tablePosition >= 5) disappointingSeasons += 1;
  }

  const wonMajorThisSeason = Boolean(last && last.clubId === clubId && last.trophies.some((t) => t.kind === "club"));
  const minutes = last ? Math.min(1, last.apps / 34) : 0;

  return {
    ovr: p.ovr,
    clubStrength,
    trophylessSeasons,
    disappointingSeasons,
    relegated: Boolean(last && last.clubId === clubId && last.relegated),
    loan: p.loan,
    minutes,
    wonMajorThisSeason,
    cooldownActive: (state.cooldowns["stagnation"] ?? -1) > state.seasonIndex,
  };
}

/** Zielkorridor der Angebotsstärke für einen Spieler mit diesem OVR. */
export function stagnationTargetRange(ovr: number): [number, number] {
  return [ovr + STAGNATION_TARGET_MIN_OFFSET, ovr + STAGNATION_TARGET_MAX_OFFSET];
}
