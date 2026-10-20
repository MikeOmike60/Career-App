import type { Club } from "./types";
import { subRng, hashString } from "./rng";
import {
  RAW_COUNTRIES,
  TIER_OVERRIDES,
  flagFor,
  proceduralCities,
  clubSuffixes,
  type Region,
} from "./countries";
import { CURATED } from "./curated";
import { isTop5, regionOfClubName, regionsOf } from "./regions";
import { clubProfile } from "./club-profile";

import FOOTBALL_DATA from "./football-data.json";



export interface Country {
  code: string;
  name: string;
  flag: string;
  region: Region;
  tiers: number;
  strength: number; // Nationalmannschaftsstärke 40-95
  leagueQuality: number; // 40-95
  cities: string[];
  clubNames?: string[]; // fiktive, benannte Vereine (Kernländer)
}

function buildCountries(): Country[] {
  const seen = new Set<string>();
  const list: Country[] = [];
  for (const [code, name, strength, leagueQuality, region] of RAW_COUNTRIES) {
    if (seen.has(code)) throw new Error(`Doppelter Ländercode: ${code}`);
    seen.add(code);
    const curated = CURATED[code];
    const cities = curated?.cities?.length ? curated.cities : proceduralCities(code, region);
    const entry: Country = {
      code,
      name,
      flag: flagFor(code),
      region,
      tiers: TIER_OVERRIDES[code] ?? 1,
      strength,
      leagueQuality,
      cities,
    };
    if (curated?.clubNames?.length) entry.clubNames = curated.clubNames;
    list.push(entry);
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export const COUNTRIES: Country[] = buildCountries();

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryName(code: string): string {
  return COUNTRY_BY_CODE.get(code)?.name ?? code;
}
export function countryFlag(code: string): string {
  return COUNTRY_BY_CODE.get(code)?.flag ?? "🏳️";
}
/** Textuelles Fallback, falls Farb-Emoji nicht gerendert werden können. */
export function countryFlagFallback(code: string): string {
  return code.slice(0, 3).toUpperCase();
}

export function leagueName(country: Country, division: number): string {
  const real = realLeague(country.code, division);
  if (real) return real.name;
  const roman = ["", "I", "II", "III", "IV"];
  return `${country.name} ${roman[division] ?? division}`;
}

/* ------------------------------------------------ Reale Daten (Manifest) */

interface RawLeague {
  division: number;
  name: string;
  officialName: string;
  season: string;
  promotionSystem: string;
  clubs: { name: string; group?: string | null }[];
}
interface RawCountry {
  country: string;
  leagues: RawLeague[];
}

const RAW = FOOTBALL_DATA as unknown as {
  generatedAt: string;
  source: string;
  note: string;
  countries: RawCountry[];
};

const REAL_LEAGUES = new Map<string, RawLeague>();
for (const c of RAW.countries) {
  for (const l of c.leagues) REAL_LEAGUES.set(`${c.country}-${l.division}`, l);
}

function realLeague(code: string, division: number): RawLeague | undefined {
  return REAL_LEAGUES.get(`${code}-${division}`);
}

/** Verbände mit realen Vereins- und Wettbewerbsnamen. */
export const REAL_COUNTRY_CODES: string[] = RAW.countries.map((c) => c.country);

export const REAL_DATA_INFO = {
  generatedAt: RAW.generatedAt,
  source: RAW.source,
  note: RAW.note,
  realNamesCountries: RAW.countries.length,
  realClubs: RAW.countries.reduce(
    (sum, c) => sum + c.leagues.reduce((n, l) => n + l.clubs.length, 0),
    0,
  ),
};

export function hasRealNames(code: string): boolean {
  return REAL_LEAGUES.has(`${code}-1`);
}

/** Geschlossene Ligasysteme ohne Auf-/Abstieg (Franchise-Modell). */
export const CLOSED_COUNTRIES = ["US"];

/** Verbände mit offener Pyramide und prozeduralem Unterbau (Feeder-Tier): alle außer US. */
export const FEEDER_COUNTRIES: string[] = COUNTRIES.map((c) => c.code).filter(
  (code) => !CLOSED_COUNTRIES.includes(code),
);
export const FEEDER_SIZE = 12;

/** 10–16 Vereine pro Liga (nur für den prozeduralen Fallback). */
function clubsPerDivision(division: number): number {
  return division === 1 ? 16 : 14;
}


/** Deterministische, global gecachte Clubwelt. */
let CLUB_CACHE: Map<string, Club> | null = null;
let CLUBS_LIST: Club[] | null = null;

function proceduralClubName(country: Country, index: number, division: number): string {
  const cities = country.cities;
  const suffixes = clubSuffixes(country.region);
  const city = cities[(index * 7 + division) % cities.length]!;
  const suffix = suffixes[(index * 3 + division * 5) % suffixes.length]!;
  const needsYear = index >= cities.length * suffixes.length;
  return `${city} ${suffix}${needsYear ? " " + (1900 + ((index * 13) % 99)) : ""}`;
}

function makeClub(args: {
  country: Country;
  division: number;
  index: number;
  name: string;
  real?: RawLeague | undefined;
  group?: string | undefined;
  /** Ranghinweis 0..1 innerhalb der Liga (0 = Spitze). */
  rank: number;
}): Club {
  const { country, division, index, name, real, group, rank } = args;
  const rng = subRng(hashString(country.code), "club", division, index);
  const topStrength = 52 + (country.leagueQuality - 45) * 0.62;
  const divisionPenalty = (division - 1) * 9;
  const spread = rng.float(-5, 8);
  const eliteBonus = rank < 0.18 ? rng.float(3, 9) : 0;
  const rankMalus = rank * 6;
  const fallbackStrength = Math.max(
    45,
    Math.min(95, Math.round(topStrength - divisionPenalty + spread + eliteBonus - rankMalus)),
  );
  // Kalibrierte Werte: Historie und aktuelle Stärke werden getrennt gehalten.
  const profile = clubProfile({
    name,
    country: country.code,
    division,
    fallbackStrength,
    isReal: Boolean(real),
  });
  const leagueLabel = real ? (group ? `${real.name} · ${group}` : real.name) : leagueName(country, division);
  const club: Club = {
    id: `${country.code}-${division}-${index}`,
    name,
    country: country.code,
    league: leagueLabel,
    division,
    strength: profile.baseStrength,
    prestige: profile.prestige,
    youth: rng.int(35, 92),
    finances: profile.finances,
  };

  if (real) {
    club.officialName = real.officialName;
    club.season = real.season;
    club.promotionSystem = real.promotionSystem === "closed" ? "closed" : "pyramid";
    club.isReal = true;
    if (group) club.group = group;
  } else {
    club.promotionSystem = "pyramid";
    club.isReal = false;
  }
  if (isTop5(country.code)) {
    const reg = regionOfClubName(country.code, name);
    if (reg) club.region = reg;
  }

  return club;

}

function buildWorld(): { map: Map<string, Club>; list: Club[] } {
  const list: Club[] = [];
  for (const country of COUNTRIES) {
    let nameIndex = 0;
    const used = new Set<string>();
    for (let division = 1; division <= country.tiers; division++) {
      const real = realLeague(country.code, division);
      if (real) {
        real.clubs.forEach((entry, i) => {
          list.push(
            makeClub({
              country,
              division,
              index: i,
              name: entry.name,
              real,
              group: entry.group ?? undefined,
              rank: real.clubs.length > 1 ? i / (real.clubs.length - 1) : 0,
            }),
          );
        });
        continue;
      }
      const count = clubsPerDivision(division);
      for (let i = 0; i < count; i++) {
        let name = country.clubNames?.[nameIndex] ?? proceduralClubName(country, nameIndex, division);
        let guard = 0;
        while (used.has(name) && guard < 50) {
          guard++;
          name = proceduralClubName(country, nameIndex + guard * 11, division);
        }
        used.add(name);
        nameIndex++;
        list.push({
          ...makeClub({
            country,
            division,
            index: i,
            name,
            rank: count > 1 ? i / (count - 1) : 0,
          }),
        });
      }
    }
    // Prozeduraler Unterbau (Feeder-Tier) für offene Pyramiden der Kernverbände.
    if (FEEDER_COUNTRIES.includes(country.code)) {
      const division = country.tiers + 1;
      const existing = new Set(list.filter((c) => c.country === country.code).map((c) => c.name));
      for (let i = 0; i < FEEDER_SIZE; i++) {
        let name = proceduralClubName(country, 500 + i, division);
        let guard = 0;
        while ((existing.has(name) || used.has(name)) && guard < 60) {
          guard++;
          name = proceduralClubName(country, 500 + i + guard * 17, division);
        }
        used.add(name);
        const club = makeClub({
          country,
          division,
          index: i,
          name,
          rank: i / (FEEDER_SIZE - 1),
        });
        club.league = `${country.name} Unterbau`;
        club.isReal = false;
        club.promotionSystem = "pyramid";
        list.push(club);
      }
    }

    // Regionale Nachwuchsvereine: jede Region eines Top-5-Verbands muss
    // mindestens drei eigene Startangebote liefern können.
    if (isTop5(country.code)) {
      const division = country.tiers + 1;
      const own = list.filter((c) => c.country === country.code);
      const counts = new Map<string, number>();
      for (const c of own) if (c.region) counts.set(c.region, (counts.get(c.region) ?? 0) + 1);
      const suffixes = ["Nachwuchsakademie", "Jugendsportverein", "Fußballschule"];
      regionsOf(country.code).forEach((region, ri) => {
        const missing = 3 - (counts.get(region.id) ?? 0);
        for (let i = 0; i < missing; i++) {
          const club = makeClub({
            country,
            division,
            index: 600 + ri * 5 + i,
            name: `${region.name} ${suffixes[i % suffixes.length]}`,
            rank: 0.8,
          });
          club.league = `${region.name} Nachwuchsliga`;
          club.isReal = false;
          club.promotionSystem = "pyramid";
          club.region = region.id;
          club.regionalAcademy = true;
          list.push(club);
        }
      });
    }
  }

  return { map: new Map(list.map((c) => [c.id, c])), list };
}


export function allClubs(): Club[] {
  if (!CLUBS_LIST) {
    const world = buildWorld();
    CLUBS_LIST = world.list;
    CLUB_CACHE = world.map;
  }
  return CLUBS_LIST;
}

/**
 * Löst eine Club-ID auf. Unbekannte IDs (z. B. aus älteren Spielständen mit
 * abweichender Ligagröße) werden deterministisch auf einen realen Verein
 * derselben Liga abgebildet – nie auf "Unbekannter Verein".
 */
export function getClub(id: string): Club {
  if (!CLUB_CACHE) allClubs();
  const hit = CLUB_CACHE!.get(id);
  if (hit) return hit;
  const m = /^([A-Z]{2,3})-(\d+)-(\d+)$/.exec(id);
  if (m) {
    const [, code, div, idx] = m;
    const pool = clubsOf(code!, Number(div));
    if (pool.length) return pool[Number(idx) % pool.length]!;
    const any = clubsOf(code!);
    if (any.length) return any[Number(idx) % any.length]!;
  }
  const fallback = allClubs();
  return fallback[hashString(id) % fallback.length]!;
}

let BY_COUNTRY: Map<string, Club[]> | null = null;

export function clubsOf(countryCode: string, division?: number): Club[] {
  if (!BY_COUNTRY) {
    BY_COUNTRY = new Map();
    for (const c of allClubs()) {
      const list = BY_COUNTRY.get(c.country) ?? [];
      list.push(c);
      BY_COUNTRY.set(c.country, list);
    }
  }
  const all = BY_COUNTRY.get(countryCode) ?? [];
  return division === undefined ? all : all.filter((c) => c.division === division);
}

/** Alle Vereine einer Herkunftsregion eines Top-5-Verbands. */
export function clubsOfRegion(countryCode: string, regionId: string): Club[] {
  return clubsOf(countryCode).filter((c) => c.region === regionId);
}



export function leagueQuality(countryCode: string, division: number): number {
  const c = COUNTRY_BY_CODE.get(countryCode);
  const base = c?.leagueQuality ?? 55;
  return Math.max(30, base - (division - 1) * 10);
}

