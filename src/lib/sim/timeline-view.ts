/**
 * Reines Viewmodel der Karriere-Timeline. Enthält keine React-Abhängigkeit und
 * ist damit direkt testbar: feste Alterszeilen, Nationalmannschafts-Summenreihe,
 * Maskieren/Enthüllen derselben Zeile und automatisches Blättern.
 */
import type { GameState, SeasonRecord } from "./types";

export const TIMELINE_WINDOW = 11;

export type TimelineRowState = "season" | "signature" | "open" | "empty";

export interface TimelineAgeRow {
  age: number;
  state: TimelineRowState;
  /** Nur bei state === "season". */
  season?: SeasonRecord | undefined;
  /** Verein der Signaturzeile ("Vertrag unterschrieben"). */
  clubId?: string | undefined;
  /** OVR, der in dieser Zeile angezeigt wird ("?" wenn undefined). */
  ovr?: number | undefined;
  note?: string | undefined;
}

export interface TimelineNationalRow {
  code?: string | undefined;
  committed: boolean;
  caps: number;
  goals: number;
}

export interface TimelineView {
  national: TimelineNationalRow;
  rows: TimelineAgeRow[];
  /** Angezeigte Seite (0-basiert) und Gesamtseiten. */
  page: number;
  pageCount: number;
  /** Seite, auf der das aktuelle/offene Alter liegt. */
  autoPage: number;
  from: number;
  to: number;
  startAge: number;
  endAge: number;
  /** Alter der Zeile, die gerade "To be written…" zeigt (falls vorhanden). */
  openAge: number | null;
  /** Alter der Zeile, die durch eine offene OVR-Entscheidung maskiert ist. */
  maskedAge: number | null;
  focusAge: number;
}

/** Alter, dem das Fenster folgt: maskierte Saison, sonst das aktuelle Alter. */
export function focusAgeOf(state: GameState): number {
  const seasons = state.seasons;
  const lastSeasonAge = seasons.length ? seasons[seasons.length - 1]!.age : null;
  if (state.pending?.kind === "ovr" && lastSeasonAge !== null) return lastSeasonAge;
  return state.player.age;
}

export function buildTimelineView(state: GameState, page?: number | null): TimelineView {
  const seasons = state.seasons;
  const startAge = seasons[0]?.age ?? state.player.age;
  const lastSeasonAge = seasons.length ? seasons[seasons.length - 1]!.age : null;
  const currentAge = state.player.age;
  const endAge = Math.max(startAge + TIMELINE_WINDOW - 1, currentAge + 2, (lastSeasonAge ?? startAge) + 2);

  const byAge = new Map<number, SeasonRecord>();
  for (const s of seasons) byAge.set(s.age, s);

  // Nur eine offene OVR-Entscheidung maskiert exakt ihre eigene Saisonzeile.
  const maskedAge = state.pending?.kind === "ovr" && lastSeasonAge !== null ? lastSeasonAge : null;

  const signatureAge = state.phase === "career" && seasons.length === 0 ? currentAge : null;
  const openAge =
    maskedAge !== null
      ? maskedAge
      : signatureAge !== null
        ? null
        : byAge.has(currentAge)
          ? null
          : currentAge;

  const focusAge = focusAgeOf(state);
  const total = endAge - startAge + 1;
  const pageCount = Math.max(1, Math.ceil(total / TIMELINE_WINDOW));
  const autoPage = Math.min(pageCount - 1, Math.max(0, Math.floor((focusAge - startAge) / TIMELINE_WINDOW)));
  const activePage = Math.min(pageCount - 1, Math.max(0, page ?? autoPage));

  const from = startAge + activePage * TIMELINE_WINDOW;
  const to = Math.min(endAge, from + TIMELINE_WINDOW - 1);

  const rows: TimelineAgeRow[] = [];
  for (let age = from; age <= to; age++) {
    if (age === maskedAge) {
      rows.push({ age, state: "open" });
      continue;
    }
    const season = byAge.get(age);
    if (season) {
      rows.push({ age, state: "season", season, ovr: season.endOvr, clubId: season.clubId });
      continue;
    }
    if (age === signatureAge) {
      rows.push({
        age,
        state: "signature",
        clubId: state.player.clubId,
        ovr: state.player.ovr,
        note: "Vertrag unterschrieben",
      });
      continue;
    }
    if (age === openAge) {
      rows.push({ age, state: "open" });
      continue;
    }
    rows.push({ age, state: "empty" });
  }

  const national: TimelineNationalRow = {
    code: state.national.committed ?? state.profile.nat1,
    committed: Boolean(state.national.committed),
    caps: state.national.caps,
    goals: state.national.goals,
  };

  return {
    national,
    rows,
    page: activePage,
    pageCount,
    autoPage,
    from,
    to,
    startAge,
    endAge,
    openAge: maskedAge ?? openAge,
    maskedAge,
    focusAge,
  };
}
