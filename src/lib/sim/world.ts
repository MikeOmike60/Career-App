/**
 * Dynamische Clubwelt: konsistente Ligatabellen, Auf-/Abstieg, Pokal und
 * kontinentale Wettbewerbe. Alles deterministisch aus Seed + Saisonindex.
 *
 * Modell: die aktuelle Stärke ist der wichtigste Tabellenfaktor. Historie ist
 * keine Unverwundbarkeit, dämpft aber die Saisonstreuung nach unten. Ein
 * Abstieg eines Giganten verlangt eine sich über Jahre aufbauende Krise.
 */
import type { ClubWorld, CountryWorld, ClubWorldEntry, Club } from "./types";
import { COUNTRY_BY_CODE, clubsOf, getClub, FEEDER_COUNTRIES } from "./data";
import { subRng, type Rng } from "./rng";
import {
  clubProfile,
  crisisShield,
  crisisShockRisk,
  relegationRiskFactor,
  type ClubProfile,
} from "./club-profile";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const PROFILE_BY_ID = new Map<string, ClubProfile>();

/** Profil eines Vereins (kalibrierte Basis, Tradition, Stabilität). */
export function profileOf(clubId: string): ClubProfile {
  const cached = PROFILE_BY_ID.get(clubId);
  if (cached) return cached;
  const club = getClub(clubId);
  const profile = clubProfile({
    name: club.name,
    country: club.country,
    division: club.division,
    fallbackStrength: club.strength,
    isReal: club.isReal,
  });
  PROFILE_BY_ID.set(clubId, profile);
  return profile;
}

/** Kalibrierte Zielstärke eines Vereins in seiner Ursprungsebene. */
function baselineStrength(clubId: string, profile: ClubProfile): number {
  return profile.curated ? profile.baseStrength : getClub(clubId).strength;
}

/** Optionaler Spieler-Einfluss dieser Saison: clubId -> Bonus (0..8). */
export type SeasonBoosts = Record<string, number>;


/** Absteiger pro Division (Index 0 = Liga 1). Letzte modellierte Ebene: 0. */
const RELEGATION: Record<string, number[]> = {
  DE: [2, 3, 4, 3],
  ENG: [3, 3, 4, 4],
  ES: [3, 4, 4],
  IT: [3, 3, 4],
  JP: [3, 3, 3],
  FR: [2, 2],
  PT: [2, 2],
  AT: [1, 2],
  CH: [1, 2],
  SCO: [1, 2],
};

const CONTINENTAL: Record<string, string[]> = {
  UEFA: ["UEFA Champions League", "UEFA Europa League", "UEFA Conference League"],
  AFC: ["AFC Champions League Elite", "AFC Champions League Two"],
  CONCACAF: ["CONCACAF Champions Cup"],
};

const UEFA_CORE = ["DE", "ENG", "ES", "IT", "FR", "PT", "AT", "CH", "SCO"];

export function confederationOf(code: string): string {
  if (code === "JP") return "AFC";
  if (code === "US") return "CONCACAF";
  return "UEFA";
}

/** Nur die US-Franchiseligen (MLS/USL) sind geschlossen – alle anderen Verbände haben Auf-/Abstieg. */
export function isClosedLeague(code: string): boolean {
  return !FEEDER_COUNTRIES.includes(code);
}

export function emptyWorld(): ClubWorld {
  return { countries: {} };
}

/** Maximale modellierte Ebene inkl. prozeduralem Feeder-Tier. */
export function maxDivision(code: string): number {
  const tiers = COUNTRY_BY_CODE.get(code)?.tiers ?? 1;
  return isClosedLeague(code) ? tiers : tiers + 1;
}

export function ensureCountryWorld(world: ClubWorld, code: string): CountryWorld {
  let cw = world.countries[code];
  if (!cw) {
    cw = { code, clubs: {}, lastSeason: -1 };
    world.countries[code] = cw;
  }
  for (const club of clubsOf(code)) {
    if (!cw.clubs[club.id]) cw.clubs[club.id] = { division: club.division, strength: club.strength };
  }
  return cw;
}

export function worldEntry(world: ClubWorld, clubId: string): ClubWorldEntry {
  const club = getClub(clubId);
  const cw = ensureCountryWorld(world, club.country);
  return cw.clubs[clubId] ?? { division: club.division, strength: club.strength };
}

export function dynamicDivision(world: ClubWorld, clubId: string): number {
  return worldEntry(world, clubId).division;
}

export function dynamicStrength(world: ClubWorld, clubId: string): number {
  return worldEntry(world, clubId).strength;
}

/**
 * Verschiebt die Teamstärke eines Vereins dauerhaft (z. B. weil ein
 * überragender Spieler die Mannschaft trägt). Rückgabe: neue Stärke.
 * `cap` begrenzt die Obergrenze für diesen Aufruf (Standard 95).
 */
export function adjustClubStrength(world: ClubWorld, clubId: string, delta: number, cap = 95): number {
  const club = getClub(clubId);
  const cw = ensureCountryWorld(world, club.country);
  const entry = cw.clubs[clubId] ?? { division: club.division, strength: club.strength };
  const upper = Math.min(95, cap);
  const next = entry.strength + delta;
  // Ein Cap senkt nie eine bereits höhere Stärke – er verhindert nur Zuwachs darüber.
  entry.strength = Math.max(30, delta > 0 ? Math.min(Math.max(upper, entry.strength), next) : Math.min(95, next));
  cw.clubs[clubId] = entry;
  return entry.strength;
}



/* ------------------------------------------------------------ Ligalabels */

const GROUP_CACHE = new Map<string, string[]>();

function groupsOfDivision(code: string, division: number): string[] {
  const key = `${code}-${division}`;
  const cached = GROUP_CACHE.get(key);
  if (cached) return cached;
  const set = new Set<string>();
  for (const c of clubsOf(code, division)) if (c.group) set.add(c.group);
  const list = [...set].sort();
  GROUP_CACHE.set(key, list);
  return list;
}

const LABEL_CACHE = new Map<string, string>();

/** Basisname einer Ligaebene (ohne Staffel). */
export function divisionLabel(code: string, division: number): string {
  const key = `${code}-${division}`;
  const cached = LABEL_CACHE.get(key);
  if (cached) return cached;
  const country = COUNTRY_BY_CODE.get(code);
  const sample = clubsOf(code, division)[0];
  const label = sample
    ? sample.league.split(" · ")[0]!
    : `${country?.name ?? code} ${division}`;
  LABEL_CACHE.set(key, label);
  return label;
}

/** Vollständiges Ligalabel inkl. Staffel für einen Verein in seiner aktuellen Ebene. */
export function leagueLabelFor(world: ClubWorld, clubId: string): string {
  const club = getClub(clubId);
  const division = dynamicDivision(world, clubId);
  const base = divisionLabel(club.country, division);
  const groups = groupsOfDivision(club.country, division);
  if (!groups.length) return base;
  const group = groupFor(club, division, groups);
  return `${base} · ${group}`;
}

function groupFor(club: Club, division: number, groups: string[]): string {
  if (club.division === division && club.group) return club.group;
  let h = 0;
  for (let i = 0; i < club.id.length; i++) h = (h * 31 + club.id.charCodeAt(i)) >>> 0;
  return groups[h % groups.length]!;
}

/* --------------------------------------------------------------- Tabellen */

/**
 * Normalverteiltes Saisonrauschen (Summe dreier Gleichverteilungen).
 * Ersetzt das frühere Cauchy-Rauschen, das Extremausreißer wie einen
 * Serie-C-Absturz von Juventus überhaupt erst möglich machte.
 */
export function seasonNoise(rng: Rng, scale: number): number {
  const n = (rng.next() + rng.next() + rng.next() - 1.5) * 2 * scale;
  return clamp(n, -2.6 * scale, 2.6 * scale);
}

/** Streuung einer Saison: stabile Vereine schwanken deutlich weniger. */
export function noiseScale(profile: ClubProfile): number {
  return 3.6 + profile.volatility * 5.4;
}

/**
 * Die reine, testbare Bewertungsformel einer Saison.
 * `boost` ist der Einfluss des eigenen Spielers in genau dieser Saison.
 */
export function seasonScore(args: {
  strength: number;
  division: number;
  lastPosition?: number | undefined;
  crisisLevel: number;
  profile: ClubProfile;
  boost: number;
  noise: number;
}): number {
  const { strength, division, lastPosition, crisisLevel, profile, boost } = args;
  let noise = args.noise;
  if (noise < 0) {
    // Historie und Struktur federn schlechte Saisons ab – bis eine echte
    // Krise (crisisLevel) diesen Schutz Schritt für Schritt auflöst.
    const shield = profile.topFlightStability * crisisShield(crisisLevel) * (division === 1 ? 1 : 0.6);
    noise *= 1 - 0.6 * shield;
  }
  const trend = lastPosition ? (10 - Math.min(20, lastPosition)) * 0.35 : 0;
  const rebound = division > 1 ? profile.reboundBonus * 3.2 : 0;
  return strength + trend + rebound + boost + noise - crisisLevel * 2.2;
}

export interface CountrySeasonResult {
  /** clubId -> Tabellenplatz in der eigenen Staffel */
  positions: Record<string, number>;
  champion: string;
  cupWinner: string;
  promoted: string[];
  relegated: string[];
  /** clubId -> Wettbewerb der Folgesaison */
  qualification: Record<string, string>;
  /** clubId -> bestes kontinentales Abschneiden dieser Saison */
  continental: Record<string, string>;
  continentalWinners: Record<string, string>;
  note: string;
}

export interface TableRow {
  id: string;
  name: string;
  strength: number;
  score: number;
}

function buildTables(
  cw: CountryWorld,
  rng: Rng,
  boosts: SeasonBoosts,
): {
  tables: Map<string, TableRow[]>;
  positions: Record<string, number>;
  byDivision: Map<number, string[]>;
  expected: Record<string, number>;
} {
  const tables = new Map<string, TableRow[]>();
  const byDivision = new Map<number, string[]>();
  for (const [id, entry] of Object.entries(cw.clubs)) {
    const club = getClub(id);
    const groups = groupsOfDivision(cw.code, entry.division);
    const key = groups.length ? `${entry.division}|${groupFor(club, entry.division, groups)}` : `${entry.division}`;
    const profile = profileOf(id);
    const score = seasonScore({
      strength: entry.strength,
      division: entry.division,
      lastPosition: entry.lastPosition,
      crisisLevel: entry.crisisLevel ?? 0,
      profile,
      boost: boosts[id] ?? 0,
      noise: seasonNoise(rng, noiseScale(profile)),
    });
    const rows = tables.get(key) ?? [];
    rows.push({ id, name: club.name, strength: entry.strength, score });
    tables.set(key, rows);
    const list = byDivision.get(entry.division) ?? [];
    list.push(key);
    byDivision.set(entry.division, list);
  }
  const positions: Record<string, number> = {};
  const expected: Record<string, number> = {};
  for (const rows of tables.values()) {
    // Erwartungswert: Platzierung rein nach Stärke – Grundlage der Krisenlogik.
    [...rows]
      .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
      .forEach((r, i) => (expected[r.id] = i + 1));
    rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    rows.forEach((r, i) => (positions[r.id] = i + 1));
  }
  const divisionKeys = new Map<number, string[]>();
  for (const [div, keys] of byDivision) divisionKeys.set(div, [...new Set(keys)].sort());
  return { tables, positions, byDivision: divisionKeys, expected };
}


/* ------------------------------------------------------------------ Pokal */

function knockout(
  field: TableRow[],
  rng: Rng,
  roundNames: string[],
): { winner: TableRow; exit: Record<string, string> } {
  let alive = rng.shuffle(field);
  const exit: Record<string, string> = {};
  let round = 0;
  while (alive.length > 1) {
    const next: TableRow[] = [];
    const label = roundNames[Math.min(round, roundNames.length - 1)]!;
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i]!;
      const b = alive[i + 1];
      if (!b) {
        next.push(a);
        continue;
      }
      const diff = a.strength - b.strength;
      const pA = 1 / (1 + Math.pow(10, -diff / 22));
      const winner = rng.chance(clamp(pA, 0.06, 0.94)) ? a : b;
      const loser = winner === a ? b : a;
      exit[loser.id] = label;
      next.push(winner);
    }
    alive = next;
    round++;
  }
  const winner = alive[0]!;
  exit[winner.id] = "Sieg";
  return { winner, exit };
}

function cupRoundNames(): string[] {
  return ["1. Runde", "2. Runde", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"];
}

function powerOfTwoField(rows: TableRow[], rng: Rng, size: number): TableRow[] {
  if (rows.length <= size) return rows;
  const sorted = [...rows].sort((a, b) => b.strength - a.strength);
  const seeded = sorted.slice(0, Math.floor(size / 2));
  const rest = rng.shuffle(sorted.slice(Math.floor(size / 2)));
  return [...seeded, ...rest.slice(0, size - seeded.length)];
}

/* ------------------------------------------------- Kontinentalwettbewerbe */

function foreignField(code: string, comp: number, rng: Rng, count: number): TableRow[] {
  const rows: TableRow[] = [];
  const pool = confederationOf(code) === "UEFA" ? UEFA_CORE.filter((c) => c !== code) : [];
  for (const other of pool) {
    const clubs = clubsOf(other, 1)
      .slice()
      .sort((a, b) => b.strength - a.strength)
      .slice(comp * 3, comp * 3 + 4);
    for (const c of clubs) rows.push({ id: c.id, name: c.name, strength: c.strength, score: 0 });
  }
  return rng.shuffle(rows).slice(0, count);
}

const COMP_KEYS = ["UCL", "UEL", "UECL"] as const;

/**
 * Simuliert jeden kontinentalen Wettbewerb GENAU EINMAL aus dem Feld aller
 * qualifizierten Vereine der beteiligten Länder. Ergebnis gilt global.
 */
function runContinental(
  world: ClubWorld,
  codes: string[],
  seed: number,
  seasonIndex: number,
  boosts: SeasonBoosts = {},
): { results: Record<string, string>; winners: Record<string, string> } {
  const results: Record<string, string> = {};
  const winners: Record<string, string> = {};

  const byConf = new Map<string, string[]>();
  for (const code of codes) {
    const conf = confederationOf(code);
    const list = byConf.get(conf) ?? [];
    list.push(code);
    byConf.set(conf, list);
  }

  for (const [conf, confCodes] of byConf) {
    const comps = CONTINENTAL[conf];
    if (!comps) continue;
    comps.forEach((compName, ci) => {
      const rng = subRng(seed, "continental", conf, `${compName}|${seasonIndex}`);
      const key = COMP_KEYS[ci] ?? "UECL";
      const home: TableRow[] = [];
      for (const code of confCodes) {
        const cw = world.countries[code];
        if (!cw) continue;
        for (const [id, entry] of Object.entries(cw.clubs)) {
          if (entry.europe !== key) continue;
          home.push({ id, name: getClub(id).name, strength: entry.strength + (boosts[id] ?? 0), score: 0 });
        }
      }
      if (!home.length) return;
      const field = [...home, ...foreignField(confCodes[0]!, ci, rng, Math.max(0, 32 - home.length))];
      const padded = powerOfTwoField(field, rng, 32);
      const res = knockout(padded, rng, ["Ligaphase", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"]);
      winners[compName] = res.winner.name;
      for (const row of home) {
        const r = res.exit[row.id];
        if (r) results[row.id] = `${compName}: ${r === "Sieg" ? "Titel" : r}`;
      }
    });
  }
  return { results, winners };
}

/** Startfeld für Saison 0: stärkste Erstligisten je Land erhalten Europaplätze. */
function seedInitialQualification(world: ClubWorld, codes: string[]): void {
  for (const code of codes) {
    const cw = world.countries[code];
    if (!cw) continue;
    const any = Object.values(cw.clubs).some((e) => e.europe);
    if (any) continue;
    const quality = COUNTRY_BY_CODE.get(code)?.leagueQuality ?? 60;
    const uclSlots = quality >= 82 ? 4 : quality >= 72 ? 2 : 1;
    const uelSlots = quality >= 72 ? 2 : 1;
    const first = Object.entries(cw.clubs)
      .filter(([, e]) => e.division === 1)
      .sort((a, b) => b[1].strength - a[1].strength || a[0].localeCompare(b[0]));
    first.forEach(([, entry], i) => {
      if (i < uclSlots) entry.europe = "UCL";
      else if (i < uclSlots + uelSlots) entry.europe = "UEL";
      else if (i < uclSlots + uelSlots + 1) entry.europe = "UECL";
    });
  }
}


/* ----------------------------------------------------- Saison simulieren */

/**
 * Wählt die Absteiger einer Staffel. Grundlage bleibt die Tabelle; ein sehr
 * stabiler Verein ohne aufgebaute Krise kann sich aber – wie in der Realität –
 * noch retten, wenn ein Konkurrent unmittelbar darüber steht. Das Risiko ist
 * nie null: relegationRiskFactor liefert immer einen Wert > 0.
 */
export function pickRelegated(
  rows: TableRow[],
  count: number,
  cw: CountryWorld,
  rng: Rng,
  positions: Record<string, number>,
): string[] {
  const out: string[] = [];
  const saved: TableRow[] = [];
  let escapes = 0;
  // Monotoner Einzeldurchlauf von unten nach oben: jeder Verein wird genau
  // einmal geprüft, deshalb ist ein Ping-Pong-Tausch strukturell unmöglich.
  for (let cursor = rows.length - 1; cursor >= 0 && out.length < count; cursor--) {
    const row = rows[cursor]!;
    const entry = cw.clubs[row.id]!;
    const profile = profileOf(row.id);
    const crisis = entry.crisisLevel ?? 0;

    // Ein sehr stabiler Verein in einer unteren Liga stürzt ohne echte Krise
    // nicht weiter durch – genau das war der "Juventus in der Serie C"-Fehler.
    const hardGuard =
      entry.division > 1 && profile.topFlightStability >= 0.85 && crisis < 3;
    if (hardGuard) {
      saved.push(row);
      continue;
    }

    const risk = relegationRiskFactor(profile, crisis);
    if (escapes < 2 && !rng.chance(risk)) {
      escapes++;
      saved.push(row);
      continue;
    }

    out.push(row.id);
  }

  // Reichen die regulären Absteiger nicht, rücken die untersten geretteten
  // Vereine nach – der Abstiegspfad bleibt damit immer > 0.
  while (out.length < count && saved.length) {
    const forced = saved.shift()!;
    out.push(forced.id);
  }

  if (saved.length) {
    // Gerettete Vereine rücken über die Absteiger; Reihenfolge bleibt stabil.
    const relegatedSet = new Set(out);
    const savedSet = new Set(saved.map((r) => r.id));
    const keep = rows.filter((r) => !relegatedSet.has(r.id) && !savedSet.has(r.id));
    const reordered = [...keep, ...saved, ...rows.filter((r) => relegatedSet.has(r.id))];
    rows.length = 0;
    rows.push(...reordered);
  }
  // Tabellenplätze konsistent 1-basiert neu vergeben.
  rows.forEach((r, i) => {
    positions[r.id] = i + 1;
  });
  return out;
}


/** Vorab global simulierte Kontinentalergebnisse für ein Land. */
export interface ContinentalInput {
  /** clubId -> "Wettbewerb: Runde" */
  results: Record<string, string>;
  /** Wettbewerb -> Siegername (global identisch) */
  winners: Record<string, string>;
}


export function simulateCountrySeason(
  world: ClubWorld,
  code: string,
  seed: number,
  seasonIndex: number,
  pre?: ContinentalInput,
  boosts: SeasonBoosts = {},
): CountrySeasonResult {
  const cw = ensureCountryWorld(world, code);
  const rng = subRng(seed, "world", code, seasonIndex);
  const { tables, positions, byDivision, expected } = buildTables(cw, rng, boosts);
  const closed = isClosedLeague(code);
  const conf = confederationOf(code);
  const comps = CONTINENTAL[conf]!;

  const rowOf = (id: string): TableRow => {
    const e = cw.clubs[id]!;
    return { id, name: getClub(id).name, strength: e.strength + (boosts[id] ?? 0), score: 0 };
  };


  /* Meister */
  const d1Keys = byDivision.get(1) ?? [];
  const d1Rows = d1Keys.flatMap((k) => tables.get(k) ?? []);
  const championRow = d1Rows.find((r) => positions[r.id] === 1) ?? d1Rows[0]!;
  const champion = championRow.id;

  /* Pokal */
  const allRows = Object.keys(cw.clubs).map(rowOf);
  const cupField = powerOfTwoField(allRows, rng, 64);
  const cup = knockout(cupField, rng, cupRoundNames());
  const cupWinner = cup.winner.id;

  /* Kontinentale Wettbewerbe: global vorsimuliert (eine Saison = ein Sieger je Cup). */
  const continental: Record<string, string> = {};
  const continentalWinners: Record<string, string> = { ...(pre?.winners ?? {}) };
  if (pre) {
    for (const id of Object.keys(cw.clubs)) {
      const r = pre.results[id];
      if (r) continental[id] = r;
    }
  } else {
    const local = runContinental(world, [code], seed, seasonIndex, boosts);
    Object.assign(continentalWinners, local.winners);
    for (const id of Object.keys(cw.clubs)) {
      const r = local.results[id];
      if (r) continental[id] = r;
    }
  }


  /* Auf-/Abstieg */
  const promoted: string[] = [];
  const relegated: string[] = [];
  if (!closed) {
    const rel = RELEGATION[code] ?? [2, 2, 2, 2];
    const maxDiv = maxDivision(code);
    const relegatedByDiv = new Map<number, string[]>();
    for (let d = 1; d < maxDiv; d++) {
      const count = rel[d - 1] ?? 2;
      const keys = byDivision.get(d) ?? [];
      const out: string[] = [];
      for (const key of keys) {
        const rows = tables.get(key)!;
        const perGroup = keys.length > 1 ? Math.max(1, Math.round(count / keys.length)) : count;
        out.push(...pickRelegated(rows, perGroup, cw, rng, positions));
      }
      relegatedByDiv.set(d, out);
    }

    for (let d = 1; d < maxDiv; d++) {
      const raw = relegatedByDiv.get(d) ?? [];
      // Harte Untergrenze: ein Traditionsgigant fällt ohne echte Krise nie
      // unter Liga 2 ("Juventus in der Serie C" darf nicht passieren).
      const down = raw.filter((id) => {
        if (d + 1 <= 2) return true;
        const entry = cw.clubs[id]!;
        const profile = profileOf(id);
        const crisis = entry.crisisLevel ?? 0;
        return !(profile.topFlightStability >= 0.85 && crisis < 4);
      });
      const need = down.length;

      const keys = byDivision.get(d + 1) ?? [];
      const candidates: Array<{ id: string; pos: number; strength: number }> = [];
      for (const key of keys) {
        const rows = tables.get(key)!;
        rows.slice(0, 4).forEach((r, i) => candidates.push({ id: r.id, pos: i + 1, strength: r.strength }));
      }
      candidates.sort((a, b) => a.pos - b.pos || b.strength - a.strength);
      const up = candidates.slice(0, need).map((c) => c.id);
      for (const id of down) {
        cw.clubs[id]!.division = d + 1;
        relegated.push(id);
      }
      for (const id of up) {
        cw.clubs[id]!.division = d;
        promoted.push(id);
      }
    }
  }

  /* Qualifikation für die Folgesaison */
  const qualification: Record<string, string> = {};
  for (const entry of Object.values(cw.clubs)) entry.europe = undefined;
  const quality = COUNTRY_BY_CODE.get(code)?.leagueQuality ?? 60;
  const uclSlots = quality >= 82 ? 4 : quality >= 72 ? 2 : 1;
  const uelSlots = quality >= 72 ? 2 : 1;
  const ranked = d1Rows.slice().sort((a, b) => positions[a.id]! - positions[b.id]!);
  ranked.forEach((row, i) => {
    const entry = cw.clubs[row.id];
    if (!entry) return;
    let key: "UCL" | "UEL" | "UECL" | undefined;
    if (i < uclSlots) key = "UCL";
    else if (i < uclSlots + uelSlots) key = "UEL";
    else if (i < uclSlots + uelSlots + 1) key = "UECL";
    if (key && entry.division === 1) {
      entry.europe = key;
      qualification[row.id] = comps[key === "UCL" ? 0 : key === "UEL" ? 1 : 2] ?? comps[0]!;
    }
  });
  const cupEntry = cw.clubs[cupWinner];
  if (cupEntry && !cupEntry.europe && cupEntry.division === 1) {
    cupEntry.europe = "UEL";
    qualification[cupWinner] = comps[1] ?? comps[0]!;
  }

  /* Stärke-Drift, Krisenaufbau und Rückkehr zur kalibrierten Basis */
  for (const [id, entry] of Object.entries(cw.clubs)) {
    const pos = positions[id] ?? 10;
    const club = getClub(id);
    const profile = profileOf(id);
    const exp = expected[id] ?? pos;
    const diff = pos - exp;

    // Krisenmodell: erst wiederholte Enttäuschungen (oder ein seltener Schock)
    // bauen eine echte Krise auf, die den Historienschutz abträgt.
    let poor = entry.poorStreak ?? 0;
    let crisis = entry.crisisLevel ?? 0;
    if (diff >= 4) poor += 1;
    else if (diff <= 0) {
      poor = 0;
      // Eine Saison auf Normalniveau heilt die Krise wieder Schritt für Schritt.
      crisis -= 1;
    }
    if (poor >= 2) {
      crisis += 1;
      poor = 0;
    }
    if (rng.chance(crisisShockRisk(profile))) crisis += 2;
    entry.poorStreak = Math.max(0, poor);
    entry.crisisLevel = clamp(Math.round(crisis), 0, 6);

    const target = baselineStrength(id, profile) - (entry.division - 1) * 4;
    const revert = clamp((target - entry.strength) * 0.1 * (0.5 + profile.tradition / 140), -1.2, 1.4);
    const perf = clamp((exp - pos) * 0.14 + (club.finances - 55) / 90, -1.6, 1.6);
    const drag = entry.crisisLevel * 0.8;
    entry.strength = clamp(Math.round((entry.strength + perf + revert - drag) * 10) / 10, 42, 95);
    entry.lastPosition = pos;
    entry.seasonsInDivision = (entry.seasonsInDivision ?? 0) + 1;
  }
  for (const id of relegated) {
    const e = cw.clubs[id]!;
    e.seasonsInDivision = 0;
    e.lastMovement = -1;
  }
  for (const id of promoted) {
    const e = cw.clubs[id]!;
    e.seasonsInDivision = 0;
    e.lastMovement = 1;
  }

  cw.lastSeason = seasonIndex;
  cw.champion = champion;
  cw.cupWinner = cupWinner;
  cw.continentalWinners = continentalWinners;

  const surprise = ranked.find((r) => positions[r.id] === 1 && r.strength < 70);
  const note = [
    `Meister: ${getClub(champion).name}`,
    `Pokal: ${getClub(cupWinner).name}`,
    ...Object.entries(continentalWinners).map(([c, n]) => `${c}: ${n}`),
    surprise ? "Überraschungsmeister!" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    positions,
    champion,
    cupWinner,
    promoted,
    relegated,
    qualification,
    continental,
    continentalWinners,
    note,
  };
}

/* ------------------------------------------------ Globale Weltsimulation */

/** Verbände, die jede Saison zwingend mitsimuliert werden (reale Namen). */
export const CORE_WORLD_COUNTRIES = ["DE", "ENG", "ES", "IT", "JP", "FR", "PT", "AT", "CH", "SCO", "US"];

export interface WorldSeasonResult {
  seasonIndex: number;
  codes: string[];
  byCountry: Record<string, CountrySeasonResult>;
  /** Wettbewerb -> Sieger (global genau einer je Saison). */
  continentalWinners: Record<string, string>;
}

/** Verhindert Doppelsimulation derselben Saison auf demselben World-Objekt. */
const WORLD_MEMO = new WeakMap<ClubWorld, { key: string; result: WorldSeasonResult }>();

/**
 * Simuliert eine komplette Fußballsaison der gesamten modellierten Welt:
 * nationale Tabellen und Pokale je Land getrennt, kontinentale Wettbewerbe
 * genau einmal global. Mehrfachaufrufe mit demselben seasonIndex liefern
 * dasselbe Ergebnis ohne erneute Simulation.
 */
export function simulateWorldSeason(
  world: ClubWorld,
  seed: number,
  seasonIndex: number,
  extraCodes: string[] = [],
  boosts: SeasonBoosts = {},
): WorldSeasonResult {
  const codes = [
    ...new Set([...CORE_WORLD_COUNTRIES, ...Object.keys(world.countries), ...extraCodes]),
  ].sort();
  const boostKey = Object.entries(boosts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}:${Math.round(v * 10)}`)
    .join(",");
  const key = `${seed}|${seasonIndex}|${codes.join(",")}|${boostKey}`;
  const memo = WORLD_MEMO.get(world);
  if (memo && memo.key === key) return memo.result;

  for (const code of codes) ensureCountryWorld(world, code);
  seedInitialQualification(world, codes);
  const cont = runContinental(world, codes, seed, seasonIndex, boosts);

  const byCountry: Record<string, CountrySeasonResult> = {};
  for (const code of codes) {
    byCountry[code] = simulateCountrySeason(world, code, seed, seasonIndex, cont, boosts);
  }
  const result: WorldSeasonResult = {
    seasonIndex,
    codes,
    byCountry,
    continentalWinners: cont.winners,
  };
  WORLD_MEMO.set(world, { key, result });
  return result;
}
