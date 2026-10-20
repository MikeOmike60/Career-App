/**
 * Zentrale, datengetriebene Registry aller Wettbewerbe, Nationalturniere und
 * individuellen Auszeichnungen. Ersetzt verstreute String-Prüfungen: jede
 * Trophäe trägt eine Registry-ID und eine Icon-Variante.
 */
import type { Region } from "./countries";

export type TrophyVariant =
  | "cup"
  | "cup-big"
  | "shield"
  | "boot"
  | "globe"
  | "star"
  | "glove"
  | "ball"
  | "medal";

export interface CompetitionDef {
  id: string;
  name: string;
  variant: TrophyVariant;
}

export type Confederation = "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";

/* ------------------------------------------------------- Konföderationen */

const CONFEDERATION_OVERRIDES: Record<string, Confederation> = {
  IL: "UEFA",
  TR: "UEFA",
  AM: "UEFA",
  AZ: "UEFA",
  GE: "UEFA",
  KZ: "UEFA",
  CY: "UEFA",
  RU: "UEFA",
  AU: "AFC",
  GY: "CONCACAF",
  SR: "CONCACAF",
};

const REGION_CONFEDERATION: Record<Region, Confederation> = {
  "eu-west": "UEFA",
  "eu-north": "UEFA",
  "eu-south": "UEFA",
  "eu-east": "UEFA",
  sam: "CONMEBOL",
  cam: "CONCACAF",
  carib: "CONCACAF",
  "afr-north": "CAF",
  "afr-west": "CAF",
  "afr-east": "CAF",
  "afr-south": "CAF",
  "asia-west": "AFC",
  "asia-south": "AFC",
  "asia-east": "AFC",
  oce: "OFC",
};

export function confederationFor(code: string, region: Region): Confederation {
  return CONFEDERATION_OVERRIDES[code] ?? REGION_CONFEDERATION[region];
}

/* --------------------------------------------- Kontinentale Vereinstitel */

export const CONTINENTAL_CLUB_COMPETITIONS: Record<Confederation, CompetitionDef[]> = {
  UEFA: [
    { id: "ucl", name: "UEFA Champions League", variant: "cup-big" },
    { id: "uel", name: "UEFA Europa League", variant: "cup" },
    { id: "uecl", name: "UEFA Conference League", variant: "cup" },
  ],
  CONMEBOL: [
    { id: "libertadores", name: "Copa Libertadores", variant: "cup-big" },
    { id: "sudamericana", name: "Copa Sudamericana", variant: "cup" },
  ],
  CONCACAF: [{ id: "concacaf-cc", name: "Concacaf Champions Cup", variant: "cup-big" }],
  AFC: [
    { id: "acl-elite", name: "AFC Champions League Elite", variant: "cup-big" },
    { id: "acl-two", name: "AFC Champions League Two", variant: "cup" },
  ],
  CAF: [
    { id: "caf-cl", name: "CAF Champions League", variant: "cup-big" },
    { id: "caf-confed", name: "CAF Confederation Cup", variant: "cup" },
  ],
  OFC: [{ id: "ofc-cl", name: "OFC Men's Champions League", variant: "cup-big" }],
};

export const CLUB_WORLD_CUP: CompetitionDef = {
  id: "fifa-cwc",
  name: "FIFA Club World Cup",
  variant: "globe",
};

/* --------------------------------------------------- Nationale Pokale */

export const NATIONAL_CUPS: Record<string, CompetitionDef[]> = {
  DE: [{ id: "cup-de-dfb", name: "DFB-Pokal", variant: "cup" }],
  ENG: [
    { id: "cup-eng-fa", name: "FA Cup", variant: "cup" },
    { id: "cup-eng-efl", name: "EFL Cup", variant: "cup" },
  ],
  ES: [{ id: "cup-es-rey", name: "Copa del Rey", variant: "cup" }],
  IT: [{ id: "cup-it-coppa", name: "Coppa Italia", variant: "cup" }],
  FR: [{ id: "cup-fr-coupe", name: "Coupe de France", variant: "cup" }],
  PT: [
    { id: "cup-pt-taca", name: "Taça de Portugal", variant: "cup" },
    { id: "cup-pt-liga", name: "Taça da Liga", variant: "cup" },
  ],
  AT: [{ id: "cup-at-oefb", name: "ÖFB-Cup", variant: "cup" }],
  CH: [{ id: "cup-ch-swiss", name: "Swiss Cup", variant: "cup" }],
  SCO: [
    { id: "cup-sco-scottish", name: "Scottish Cup", variant: "cup" },
    { id: "cup-sco-league", name: "Scottish League Cup", variant: "cup" },
  ],
  JP: [
    { id: "cup-jp-emperor", name: "Emperor's Cup", variant: "cup" },
    { id: "cup-jp-league", name: "J.League Cup", variant: "cup" },
  ],
  US: [
    { id: "cup-us-open", name: "U.S. Open Cup", variant: "cup" },
    { id: "cup-us-mls", name: "MLS Cup", variant: "cup-big" },
  ],
};

export function nationalCups(code: string): CompetitionDef[] {
  return NATIONAL_CUPS[code] ?? [{ id: `cup-${code}`, name: "Nationalpokal", variant: "cup" }];
}

/* ------------------------------------------------ Nationalteam-Turniere */

export interface TournamentDef extends CompetitionDef {
  confederation: Confederation | "FIFA";
  /** Erstes Turnierjahr im Modell. */
  firstYear: number;
  /** Turnierrhythmus in Jahren. */
  period: number;
}

export const NATION_TOURNAMENTS: TournamentDef[] = [
  { id: "fifa-wc", name: "FIFA World Cup", variant: "globe", confederation: "FIFA", firstYear: 2026, period: 4 },
  { id: "uefa-euro", name: "UEFA EURO", variant: "star", confederation: "UEFA", firstYear: 2028, period: 4 },
  { id: "copa-america", name: "Copa América", variant: "star", confederation: "CONMEBOL", firstYear: 2028, period: 4 },
  { id: "afcon", name: "Africa Cup of Nations", variant: "star", confederation: "CAF", firstYear: 2027, period: 2 },
  { id: "afc-asian-cup", name: "AFC Asian Cup", variant: "star", confederation: "AFC", firstYear: 2027, period: 4 },
  { id: "gold-cup", name: "Concacaf Gold Cup", variant: "star", confederation: "CONCACAF", firstYear: 2027, period: 2 },
  { id: "ofc-nations", name: "OFC Nations Cup", variant: "star", confederation: "OFC", firstYear: 2028, period: 4 },
];

/** Turniere, die im angegebenen Kalenderjahr für diese Konföderation stattfinden. */
export function tournamentsForYear(conf: Confederation, year: number): TournamentDef[] {
  return NATION_TOURNAMENTS.filter(
    (t) =>
      (t.confederation === "FIFA" || t.confederation === conf) &&
      year >= t.firstYear &&
      (year - t.firstYear) % t.period === 0,
  );
}

/* ------------------------------------------------------------- Awards */

export interface AwardDef extends CompetitionDef {
  /** Nur für Torhüter (true) bzw. nur für Feldspieler (false); undefined = alle. */
  goalkeeper?: boolean;
}

export const AWARDS: AwardDef[] = [
  { id: "player-of-the-season", name: "Spieler der Saison", variant: "star" },
  { id: "player-of-the-year", name: "Player of the Year", variant: "star" },
  { id: "world-player", name: "Weltfußballer", variant: "globe" },
  { id: "ballon-dor", name: "Ballon d'Or", variant: "ball" },
  { id: "golden-shoe", name: "Goldener Schuh", variant: "boot" },
  { id: "top-scorer", name: "Torschützenkönig", variant: "boot", goalkeeper: false },
  { id: "puskas", name: "FIFA Puskás Award", variant: "ball", goalkeeper: false },
  { id: "keeper-of-the-season", name: "Torhüter der Saison", variant: "glove", goalkeeper: true },
  { id: "yashin", name: "Yashin Trophy", variant: "glove", goalkeeper: true },
  { id: "young-player", name: "Talent des Jahres", variant: "medal" },
  { id: "kopa", name: "Kopa Trophy", variant: "medal" },
];

export const AWARD_BY_ID = new Map(AWARDS.map((a) => [a.id, a]));

/* ------------------------------------------------------ Gesamtregister */

export const ALL_COMPETITIONS: CompetitionDef[] = [
  ...Object.values(CONTINENTAL_CLUB_COMPETITIONS).flat(),
  CLUB_WORLD_CUP,
  ...Object.values(NATIONAL_CUPS).flat(),
  { id: "cup-generic", name: "Nationalpokal", variant: "cup" },
  ...NATION_TOURNAMENTS,
  ...AWARDS,
  { id: "league-title", name: "Meisterschaft", variant: "shield" },
];

export const COMPETITION_BY_ID = new Map(ALL_COMPETITIONS.map((c) => [c.id, c]));

export function competitionVariant(id: string | undefined): TrophyVariant | undefined {
  if (!id) return undefined;
  if (id.startsWith("league-")) return "shield";
  return COMPETITION_BY_ID.get(id)?.variant;
}
