import type {
  GameState,
  Profile,
  SeasonRecord,
  Trophy,
  AcademyOffer,
  PendingDecision,
  PendingOvrDecision,
  PendingClubDecision,
  PendingNationDecision,
  DecisionOption,
  ClubOffer,
  PlayerRole,
  TalentArchetype,
  PlayerState,
  Club,
} from "./types";
import { subRng, type Rng } from "./rng";
import {
  COUNTRY_BY_CODE,
  getClub,
  clubsOf,
  clubsOfRegion,
  allClubs,
  leagueQuality,
  countryName,
} from "./data";
import { isTop5, isValidRegion, regionName } from "./regions";
import { neighborCountries } from "./neighbors";
import { EVENTS, eventById, logDecision, adjust } from "./events";
import { makeGamble, neutralEffect, resolveGamble } from "./gamble";
import { relationBetween, relationsOf } from "./club-relations";
import {
  breakdownChance,
  canComeback,
  canPlayAnotherSeason,
  isBodyFinished,
  nextBodyWear,
  extensionWear,
} from "./body";
import {
  STAGNATION_COOLDOWN_MAX,
  STAGNATION_COOLDOWN_MIN,
  stagnationInputOf,
  stagnationTargetRange,
  stagnationTriggered,
} from "./stagnation";

import { buildRetirementDecision } from "./retirement";
import { buildInvestorDecision, formatInvestorMoney } from "./investor";
import { marketValue, weeklyWage } from "./economy";
import { hasTrait, traitWeight, type Trait } from "./personality";
import {
  applyLingeringReputation,
  betrayalTier,
  clubWillCall,
  currentTenure,
  makeBetrayal,
  offerWarning,
  rivalHits,
  rivalSeverity,
} from "./reputation";
import { buildLegendMoment } from "./legend";

import {
  AWARD_BY_ID,
  CONTINENTAL_CLUB_COMPETITIONS,
  competitionVariant,
  confederationFor,
  nationalCups,
  tournamentsForYear,
  type CompetitionDef,
} from "./competitions";
import {
  emptyWorld,
  ensureCountryWorld,
  dynamicDivision,
  dynamicStrength,
  adjustClubStrength,
  leagueLabelFor,
  simulateWorldSeason,
  divisionLabel,
} from "./world";

export const STATE_VERSION = 14;


/* --------------------------------------------------------- Club-Impact */
/** Nur schwache Vereine bis zu dieser dynamischen Stärke profitieren. */
export const CLUB_IMPACT_MAX_BASE = 72;
/** Absolute Obergrenze der dynamischen Clubstärke durch Spieler-Impact. */
export const CLUB_IMPACT_CAP = 88;
/** Mindesteinsätze für einen Impact (oder äquivalente Einsatzzeit). */
export const CLUB_IMPACT_MIN_APPS = 18;
/** Mindestnote für einen Impact. */
export const CLUB_IMPACT_MIN_RATING = 7.3;

export interface ClubImpactInput {
  /** Dynamische Teamstärke zum Saisonstart (entscheidet über die Berechtigung). */
  clubStrength: number;
  /** Aktuelle dynamische Teamstärke (entscheidet über den verbleibenden Spielraum). */
  currentStrength: number;
  apps: number;
  /** Anteil gespielter Minuten 0..1. */
  minutes: number;
  rating: number;
  missedSeason?: boolean;
  /** Titel, Aufstieg, internationaler Wettbewerb oder Note >= 8.0. */
  exceptional?: boolean;
}

/**
 * Einzige Quelle der Club-Impact-Regel – wird von simulateSeason benutzt.
 * Gibt den tatsächlich anzuwendenden Schub (0, +1 oder +2) zurück.
 */
export function clubImpactForSeason(input: ClubImpactInput): number {
  const { clubStrength, currentStrength, apps, minutes, rating, missedSeason, exceptional } = input;
  if (missedSeason) return 0;
  if (rating < CLUB_IMPACT_MIN_RATING) return 0;
  if (clubStrength > CLUB_IMPACT_MAX_BASE) return 0;
  if (apps < CLUB_IMPACT_MIN_APPS && minutes < 0.6) return 0;
  const wanted = exceptional ? 2 : 1;
  const room = Math.max(0, CLUB_IMPACT_CAP - Math.round(currentStrength));
  return Math.min(wanted, room);
}


export interface TeamBoostInput {
  ovr: number;
  teamStrength: number;
  /** Anteil gespielter Minuten 0..1. */
  minutes: number;
  rating: number;
  missedSeason?: boolean;
}

/**
 * Sofortwirkung des Spielers auf sein Team in DERSELBEN Saison (0..8).
 * Ein überragender Spieler zieht eine schwache Mannschaft in der Tabelle nach
 * oben, ohne die dauerhafte Teamstärke zu verändern (das macht clubImpact).
 */
export function teamBoostForSeason(input: TeamBoostInput): number {
  const { ovr, teamStrength, minutes, rating, missedSeason } = input;
  if (missedSeason || minutes < 0.15) return 0;
  const edge = (ovr - teamStrength) / 3.2;
  const form = (rating - 6.9) * 1.6;
  const raw = (edge + form) * Math.min(1, minutes / 0.6);
  return Math.round(clamp(raw, 0, 8) * 10) / 10;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const round = Math.round;




export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function seasonLabel(startYear: number, index: number): string {
  const y = startYear + index;
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ Setup */

/** Geburtsjahr aus dem Profil – Fallback: plausible 16-jährige Person. */
export function birthYearOf(birthDate: string): number {
  const year = new Date(birthDate).getFullYear();
  if (!Number.isFinite(year) || year < 1900 || year > 2200) {
    return new Date().getFullYear() - 16;
  }
  return year;
}

function startAge(rng: Rng): number {
  return rng.weighted([
    [16, 88],
    [15, 9],
    [14, 3],
  ]);
}

/** Explizite, deterministische Buckets – hohe Startwerte sind echte Ausnahmen. */
export function startOvr(rng: Rng): number {
  const bucket = rng.weighted<[number, number]>([
    [[50, 54], 450],
    [[55, 59], 370],
    [[60, 63], 140],
    [[64, 67], 30],
    [[68, 71], 8],
    [[72, 75], 2],
  ]);
  return rng.int(bucket[0], bucket[1]);
}

/** Verdeckter Talent-Archetyp – Weltklasse ist extrem selten. */
export function rollArchetype(rng: Rng): TalentArchetype {
  return rng.weighted<TalentArchetype>([
    ["normal", 760],
    ["strong", 180],
    ["elite", 50],
    ["worldclass", 9],
    ["generational", 1],
  ]);
}

const ARCHETYPE_CEILING: Record<TalentArchetype, [number, number]> = {
  normal: [70, 82],
  strong: [78, 88],
  elite: [85, 94],
  worldclass: [92, 97],
  generational: [96, 99],
};

/**
 * Harte Obergrenze, die auch Breakout-Saisons nicht überschreiten dürfen.
 * Ohne diese Grenze würde jede lange Karriere ihr Potenzial bis 99 hochziehen
 * und Weltklasse wäre kein Ausnahmefall mehr.
 */
export const ARCHETYPE_HARD_CAP: Record<TalentArchetype, number> = {
  normal: 84,
  strong: 88,
  elite: 95,
  worldclass: 98,
  generational: 99,
};

export function potentialHardCap(archetype: TalentArchetype): number {
  return ARCHETYPE_HARD_CAP[archetype];
}

function rollPotential(rng: Rng, ovr: number, archetype: TalentArchetype): number {
  const [lo, hi] = ARCHETYPE_CEILING[archetype];
  const value = rng.int(lo, hi);
  return clamp(Math.max(value, ovr + rng.int(1, 3)), ovr + 1, ARCHETYPE_HARD_CAP[archetype]);
}


export function newPlayerState(rng: Rng, age: number, ovr: number): PlayerState {
  const archetype = rollArchetype(rng);
  const longevity = archetype === "generational" || archetype === "worldclass" ? rng.float(0.4, 1) : rng.float(0, 0.7);
  return {
    age,
    ovr,
    potential: rollPotential(rng, ovr, archetype),
    form: rng.int(45, 65),
    morale: rng.int(60, 80),
    fitness: rng.int(80, 98),
    reputation: rng.int(3, 12),
    clubId: "",
    contractYears: 3,
    wage: 900,
    value: 100000,
    declineAge: rng.int(30, 34),
    retireAge: rng.int(34, 39),
    bodyWear: 0,
    retirementExtensions: 0,
    loan: false,
    loanSeasonsLeft: 0,


    relationship: 60,
    injuryRisk: rng.int(6, 20),
    mentality: rng.int(42, 70),
    role: "Talent",
    playtimeModifier: 1,
    injuryProneness: rng.int(8, 26),
    monthsOut: 0,
    majorInjuries: 0,
    archetype,
    longevity,
  };
}

export function createInitialState(profile: Profile): GameState {
  const rng = subRng(profile.seed, "init", profile.name, profile.nat1, profile.pos);
  const age = startAge(rng);
  const ovr = startOvr(rng);
  const startYear = birthYearOf(profile.birthDate) + age;
  const state: GameState = {
    version: STATE_VERSION,
    phase: "offers",
    profile,
    startYear,
    seasonIndex: 0,
    player: newPlayerState(rng, age, ovr),
    seasons: [],
    decisions: [],
    trophies: [],
    national: { locked: false, switchOffered: false, caps: 0, goals: 0, majorTitles: 0 },
    offers: [],
    rerolls: 0,
    retired: false,
    comebacks: 0,
    comebackChecked: false,
    peakOvr: ovr,
    eventsSeen: [],
    chunkRemaining: 0,
    chunkEventUsed: false,
    queue: [],
    fanRelations: {},
    gambleLossStreak: 0,
    clubImpact: {},
    cooldowns: {},
    world: emptyWorld(),


  };
  state.offers = generateOffers(state);
  return state;
}

/* ----------------------------------------------------------- Fanbindung */

export function fanValue(state: GameState, clubId: string): number {
  return state.fanRelations[clubId] ?? 50;
}

export function setFanValue(state: GameState, clubId: string, value: number): void {
  state.fanRelations[clubId] = clamp(round(value), 0, 100);
}

export function fanStatus(value: number): string {
  if (value >= 90) return "Legende";
  if (value >= 75) return "Vereinsikone";
  if (value >= 55) return "Fanliebling";
  if (value >= 35) return "anerkannt";
  return "skeptisch";
}

/* --------------------------------------------------------------- Angebote */

/** true, wenn der Verein in einer sichtbaren (nicht prozeduralen Feeder-)Ebene startet. */
export function visibleTier(club: Club): boolean {
  const tiers = COUNTRY_BY_CODE.get(club.country)?.tiers ?? 1;
  return club.division <= tiers;
}

/** Sichtbare Vereine eines Landes; bei Realdaten-Verbänden bevorzugt reale Clubs. */
function offerPool(code: string): Club[] {
  const visible = clubsOf(code).filter(visibleTier);
  const real = visible.filter((c) => c.isReal);
  return real.length >= 6 ? real : visible;
}

/**
 * Kandidatenpool der drei Startangebote. Bei Top-5-Verbänden mit gewählter
 * Herkunftsregion kommen die Angebote AUSSCHLIESSLICH aus dieser Region und
 * dem primären Herkunftsland – niemals aus der zweiten Nationalität.
 */
export function academyPool(profile: Profile): Club[] {
  if (isTop5(profile.nat1) && isValidRegion(profile.nat1, profile.region)) {
    const regional = clubsOfRegion(profile.nat1, profile.region!);
    if (regional.length >= 3) return regional;
  }
  const codes = [profile.nat1, profile.nat2].filter(Boolean) as string[];
  const pool = codes.flatMap((code) => offerPool(code));
  return pool.length >= 6 ? pool : [...pool, ...offerPool("DE"), ...offerPool("ENG")];
}

export function generateOffers(state: GameState): AcademyOffer[] {
  const rng = subRng(state.profile.seed, "offers", state.rerolls);
  const extended = academyPool(state.profile);
  const target = state.player.ovr;
  const scored = extended
    .map((club) => ({ club, distance: Math.abs(club.strength - (target + 8)) + rng.float(0, 14) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.max(3, Math.min(14, extended.length)));
  const chosen = rng.shuffle(scored).slice(0, 3);

  return chosen.map(({ club }) => {
    const gap = club.strength - target;
    const playtime =
      gap > 18 ? "Sehr gering" : gap > 10 ? "Gering" : gap > 3 ? "Ausbaufähig" : gap > -6 ? "Gut" : "Sehr hoch";
    const texts = [
      `Ein Ausbildungsverein mit Geduld: ${club.name} lässt Talente zwei Jahre reifen, bevor Druck entsteht.`,
      `${club.name} sucht offensiv nach Jugendspielern und traut dir früh Minuten zu.`,
      `Bei ${club.name} ist die Konkurrenz groß, aber das Trainingsniveau ist bemerkenswert.`,
      `Die Scouts von ${club.name} beobachten dich seit zwei Jahren und sind überzeugt von deinem Profil.`,
    ];
    return {
      clubId: club.id,
      playtime,
      scoutText: rng.pick(texts),
      country: club.country,
      region: club.region,
      regionLabel: club.region ? regionName(club.country, club.region) : undefined,
    } satisfies AcademyOffer;
  });
}


export function rerollOffers(state: GameState): GameState {
  const s = clone(state);
  s.rerolls += 1;
  s.offers = generateOffers(s);
  return s;
}

export function signWithClub(state: GameState, clubId: string): GameState {
  const s = clone(state);
  const club = getClub(clubId);
  s.player.clubId = clubId;
  s.heartClub = clubId;
  s.player.contractYears = 3;
  s.player.wage = round(300 + club.finances * 22);
  s.player.value = round(40000 + club.prestige * 4200);
  s.phase = "career";
  s.chunkRemaining = 0;
  ensureCountryWorld(s.world, club.country);
  setFanValue(s, clubId, 55);
  return s;
}

/* ------------------------------------------------------------ Saisonlogik */

const GK = (pos: string) => pos === "TW";

function playtimeFactor(ovr: number, clubStrength: number, form: number, fitness: number): number {
  const gap = ovr - clubStrength;
  const base = 1 / (1 + Math.exp(-(gap + 4) / 4.2));
  return clamp(base * (0.65 + form / 300 + fitness / 400), 0.05, 1);
}

function attackOutput(pos: string): { g: number; a: number } {
  switch (pos) {
    case "ST":
      return { g: 0.62, a: 0.18 };
    case "LF":
    case "RF":
      return { g: 0.45, a: 0.3 };
    case "ZOM":
      return { g: 0.3, a: 0.4 };
    case "LM":
    case "RM":
      return { g: 0.22, a: 0.33 };
    case "ZM":
      return { g: 0.16, a: 0.24 };
    case "ZDM":
      return { g: 0.07, a: 0.12 };
    case "LV":
    case "RV":
      return { g: 0.06, a: 0.18 };
    case "IV":
      return { g: 0.07, a: 0.04 };
    default:
      return { g: 0, a: 0.01 };
  }
}

function nextForm(prev: number, rng: Rng, morale: number, fitness: number): number {
  const memory = prev * 0.6;
  const drift = (morale + fitness) / 2 - 50;
  const noise = rng.float(-22, 24);
  return clamp(round(memory + 20 + drift * 0.25 + noise), 5, 100);
}

/** Gewichtete Auswahl eines OVR-Deltas; Score und Umfeld verschieben die Verteilung. */
function pickDelta(rng: Rng, table: Array<[number, number]>, score: number, env: number): number {
  const shaped = table.map(([value, weight]) => {
    const factor =
      value > 0 ? (0.3 + 2.1 * score) * (0.55 + 1.05 * env) : value < 0 ? (1.8 - 1.35 * score) * (1.15 - 0.55 * env) : 1;
    return [value, Math.max(0.0001, weight * factor)] as const;
  });
  return rng.weighted(shaped);
}

/** Ausnahmestatus für Langlebigkeit à la Jahrhundertkarriere. */
export function hasLongevityException(state: GameState): boolean {
  const p = state.player;
  const centuryCareer =
    state.peakOvr >= 93 && state.trophies.some((t) => t.name === "Weltfußballer" || t.name === "Spieler der Saison");
  return p.longevity >= 0.93 && centuryCareer;
}

/** Umfeldwert 0..1 aus Teamstärke und echter Spielzeit – Bank ist kein Gratiswachstum. */
export function environmentValue(strength: number, minutesFactor: number): number {
  const tier = strength >= 80 ? 1 : strength >= 72 ? 0.72 : strength >= 64 ? 0.42 : 0.18;
  const starter = clamp((minutesFactor - 0.12) / 0.5, 0, 1);
  return clamp(tier * (0.25 + 0.75 * starter), 0, 1);
}

function developmentDelta(
  state: GameState,
  rng: Rng,
  minutesFactor: number,
  rating: number,
  monthsOut: number,
): number {
  const p = state.player;
  const club = getClub(p.clubId);
  const division = dynamicDivision(state.world, p.clubId);
  const strength = dynamicStrength(state.world, p.clubId);
  const lq = leagueQuality(club.country, division);
  const headroom = p.potential - p.ovr;

  /**
   * Talente unter 22 trainieren im Profi- und Nachwuchsbereich mit und spielen
   * in der zweiten Mannschaft – Bank im Profikader ist dort kein Entwicklungsstopp.
   */
  const reserveFloor = p.age <= 21 ? clamp((club.youth + strength) / 260, 0.28, 0.6) : 0;
  const effMinutes = Math.max(minutesFactor, reserveFloor);

  /* --------- Leistungsscore 0..1 */
  let score = 0;
  score += clamp(effMinutes, 0, 1) * 0.26;
  score += clamp((rating - 6.1) / 1.8, 0, 1) * 0.22;
  score += clamp((strength - 60) / 30, 0, 1) * 0.18;
  score += clamp(p.morale / 100, 0, 1) * 0.08;
  score += clamp(p.mentality / 100, 0, 1) * 0.1;
  score += clamp(p.fitness / 100, 0, 1) * 0.06;
  const training = clamp((lq + club.youth / 2) / 140, 0, 1);
  score += effMinutes >= 0.4 ? training * 0.1 : 0;
  if (effMinutes < 0.22) score -= 0.14; // Bank bleibt Stagnation
  score -= clamp(monthsOut / 12, 0, 1) * 0.3;
  score -= clamp(p.injuryProneness / 100, 0, 1) * 0.05;
  score = clamp(score, 0, 1);

  const env = environmentValue(strength, effMinutes);
  const topClub = strength >= 78;
  const age = p.age;
  let delta: number;
  if (age <= 18) {
    delta = pickDelta(rng, [[1, 420], [2, 340], [3, 130], [4, 22], [0, 190], [-1, 18]], score, env);
  } else if (age <= 23) {
    delta = pickDelta(rng, [[1, 410], [2, 300], [3, 95], [4, 10], [0, 250], [-1, 50], [-2, 6]], score, env);
  } else if (age <= 27) {
    delta = pickDelta(rng, [[1, 390], [2, 215], [3, 45], [0, 350], [-1, 100], [-2, 10]], score, env);
  } else if (age <= 31) {
    delta = pickDelta(rng, [[0, 380], [1, 320], [2, 80], [-1, 225], [-2, 32]], score, env);
  } else if (age <= 34) {
    delta = pickDelta(rng, [[0, 380], [-1, 330], [1, 145], [-2, 130], [-3, 30]], score, env);
  } else if (age <= 37) {
    delta = pickDelta(rng, [[-1, 430], [-2, 400], [-3, 150], [0, 15], [1, 5]], score, env);
  } else if (age < 40) {
    delta = pickDelta(rng, [[-2, 430], [-3, 360], [-1, 180], [-4, 180]], score, env);
  } else {
    delta = pickDelta(rng, [[-1, 240], [-2, 320], [-3, 250], [-4, 180]], score, env);
  }

  /**
   * Leistung öffnet verstecktes Potenzial: Eine starke Breakout-Saison hebt die
   * Potenzialdecke um +1, eine außergewöhnliche um bis zu +2 – unabhängig von
   * der Clubgröße, damit auch kleine Vereine Weltkarrieren hervorbringen können.
   */
  if (age <= 33 && monthsOut < 5 && rating >= 7.2 && effMinutes >= 0.45) {
    const exceptional = rating >= 7.9 && effMinutes >= 0.68;
    const chance = clamp(0.2 + (rating - 7.2) * 0.42 + score * 0.3 + (headroom <= 2 ? 0.15 : 0), 0, 0.86);
    if (rng.chance(chance)) {
      const step = exceptional && rng.chance(0.34) ? 2 : 1;
      p.potential = clamp(p.potential + step, p.potential, ARCHETYPE_HARD_CAP[p.archetype]);
    }
  }

  /**
   * Überperformance über dem verdeckten Potenzial (z. B. durch gewonnene
   * Gambles) hält selten dauerhaft: Sie wird über die Saisons zurückgeholt.
   */
  if (p.ovr > p.potential) {
    const over = p.ovr - p.potential;
    const back = rng.chance(clamp(0.62 + over * 0.14, 0, 0.96)) ? -Math.min(2, 1 + Math.floor(over / 3)) : 0;
    delta = Math.min(delta, back);
  }

  /* --------- Kontextkorrekturen */

  if (delta > 0) {
    if (monthsOut >= 5) delta = Math.min(delta, 0);
    if (effMinutes < 0.15) delta = Math.min(delta, rng.chance(0.2) ? 1 : 0);
    if (strength <= 65 && rating < 7.2 && rng.chance(0.45)) delta = Math.max(0, delta - 1);
    if (lq < 55) {
      const dominant = rating >= 7.4 && minutesFactor >= 0.6;
      if (!dominant && p.age > 21) delta = Math.min(delta, 1);
    }
    if (p.fitness < 58) delta = Math.min(delta, 1);
    if (p.form < 25) delta = Math.min(delta, 1);
    // Das Umfeld entscheidet, wie viel vom verdeckten Potenzial wirklich
    // abgerufen wird: schwache Vereine lassen die letzten Prozente liegen.
    const envBase = Math.min(strength, club.strength + 6);
    const envCeilingLoss = envBase >= 78 ? 0 : envBase >= 72 ? 1 : envBase >= 66 ? 2 : 4;
    const effPotential = Math.max(p.potential - envCeilingLoss, Math.min(p.potential, p.ovr));
    const room = effPotential - p.ovr;
    if (room <= 0) delta = 0;
    else delta = Math.min(delta, room);


  } else if (delta < 0) {
    // Topclub dämpft den Abbau durch Training und Belastungssteuerung – nie ganz.
    if (age >= 35 && topClub && p.fitness >= 62 && monthsOut < 4 && rng.chance(0.55)) delta += 1;
    if (age >= 32 && age < 40 && hasLongevityException(state) && rng.chance(0.55)) delta = Math.max(delta, -1);
    if (p.fitness > 88 && age < 35 && rng.chance(0.3)) delta = Math.min(0, delta + 1);
    if (p.monthsOut >= 6 || monthsOut >= 6) delta = Math.min(delta, -1);
  }
  // Ab 36 gibt es keine echte Steigerung mehr, ab 40 ist die Saison strikt negativ.
  if (age >= 36) delta = Math.min(delta, 0);
  if (age >= 40) delta = Math.min(delta, -1);


  return clamp(delta, -5, 5);
}

/**
 * Legt eine Trophäe aus der zentralen Registry an. Doppelte Titel je Saison
 * und Registry-ID werden verhindert; Icon-Variante kommt aus der Registry.
 */
function makeTrophy(
  state: GameState,
  kind: Trophy["kind"],
  comp: CompetitionDef,
  description: string,
  clubId?: string,
  country?: string,
): Trophy | null {
  const season = state.startYear + state.seasonIndex;
  if (state.trophies.some((t) => t.refId === comp.id && t.season === season)) return null;
  const t: Trophy = {
    id: `${comp.id}-${state.seasonIndex}-${state.trophies.length}`,
    kind,
    name: comp.name,
    season,
    age: state.player.age,
    clubId,
    country,
    description,
    refId: comp.id,
    variant: comp.variant,
  };
  state.trophies.push(t);
  return t;
}

/** Hilfsfunktion: Trophäe anlegen und – falls neu – in die Saisonliste legen. */
function award(
  state: GameState,
  list: Trophy[],
  kind: Trophy["kind"],
  comp: CompetitionDef,
  description: string,
  clubId?: string,
  country?: string,
): void {
  const t = makeTrophy(state, kind, comp, description, clubId, country);
  if (t) list.push(t);
}


/* -------------------------------------------------------- Körperdaten */

export interface PhysicalEffect {
  bmi: number;
  minutesMod: number; // multiplikativ, moderat
  defenseMod: number; // multiplikativ auf Zu-Null/Paraden
  injuryMod: number; // additiv auf die Verletzungswahrscheinlichkeit
  note?: string | undefined;
}

/** Moderates, positionsabhängiges Physical-Profile aus Größe und Gewicht. */
export function physicalEffect(profile: Profile): PhysicalEffect {
  const h = clamp(profile.height, 150, 215);
  const w = clamp(profile.weight, 45, 130);
  const bmi = w / Math.pow(h / 100, 2);
  const tall = (h - 183) / 100;
  const aerial = profile.pos === "TW" || profile.pos === "IV";
  const minutesMod = clamp(1 + (aerial ? clamp(tall, -0.035, 0.045) : clamp(tall * 0.4, -0.015, 0.015)), 0.95, 1.05);
  const defenseMod = clamp(1 + (aerial ? clamp(tall * 1.6, -0.06, 0.07) : 0), 0.94, 1.07);
  const deviation = Math.abs(bmi - 22.5);
  const injuryMod = clamp((deviation - 2.4) * 0.012, 0, 0.05);

  const notes: string[] = [];
  if (aerial && Math.abs(h - 183) >= 6) {
    notes.push(
      h > 183
        ? `Deine Körpergröße (${h} cm) machte sich in der Defensivarbeit bemerkbar.`
        : `Bei ${h} cm musstest du Defensivduelle stärker über Stellungsspiel lösen.`,
    );
  }
  if (deviation > 2.4) {
    notes.push(`Dein Körperbau (BMI ${bmi.toFixed(1)}) erhöhte die Belastung leicht und damit das Verletzungsrisiko.`);
  }
  return { bmi, minutesMod, defenseMod, injuryMod, note: notes.length ? notes.join(" ") : undefined };
}

/* ------------------------------------------------------- Verletzungen */

const MAJOR_INJURIES = [
  "Kreuzbandriss",
  "Achillessehnenriss",
  "komplizierter Wadenbeinbruch",
  "Syndesmosebandriss",
  "Meniskusriss mit Komplikationen",
];
const MINOR_INJURIES = ["Muskelfaserriss", "Bänderdehnung", "Knieprellung", "Adduktorenprobleme", "Ermüdungsbruch"];

function rollInjury(
  p: PlayerState,
  rng: Rng,
  physInjury: number,
): { text?: string; monthsOut: number; major: boolean } {
  // Bewusst selten: etwa jede 6.–8. Saison eine nennenswerte Verletzung,
  // bei anfälligen oder älteren Spielern spürbar öfter.
  const base = 0.05 + p.injuryRisk / 700 + p.injuryProneness / 800 + physInjury * 0.6 + Math.max(0, p.age - 31) / 220;
  if (!rng.chance(clamp(base, 0.03, 0.32))) return { monthsOut: 0, major: false };
  const majorChance = clamp(0.03 + p.injuryProneness / 700 + Math.max(0, p.age - 32) / 300, 0.02, 0.14);
  if (rng.chance(majorChance)) {
    const months = rng.int(5, 12);
    return { text: `${rng.pick(MAJOR_INJURIES)} – ${months} Monate Ausfall`, monthsOut: months, major: true };
  }
  const weeks = rng.int(2, 14);
  return { text: `${rng.pick(MINOR_INJURIES)} – ${weeks} Wochen Ausfall`, monthsOut: weeks / 4.3, major: false };
}

/* ------------------------------------------------------- Saison spielen */

function simulateSeason(state: GameState): SeasonRecord {
  const s = state;
  const p = s.player;
  const club = getClub(p.clubId);
  const rng = subRng(s.profile.seed, "season", s.seasonIndex, p.clubId, s.comebacks);
  ensureCountryWorld(s.world, club.country);
  const division = dynamicDivision(s.world, p.clubId);
  const strength = dynamicStrength(s.world, p.clubId);
  const lq = leagueQuality(club.country, division);
  const startOvrValue = p.ovr;
  const phys = physicalEffect(s.profile);

  p.form = nextForm(p.form, rng, p.morale, p.fitness);

  // Verletzung zuerst – sie bestimmt die Verfügbarkeit
  const injury = rollInjury(p, rng, phys.injuryMod);
  const injuries: string[] = injury.text ? [injury.text] : [];
  const monthsOut = injury.monthsOut;
  const missedSeason = monthsOut >= 9.5;
  if (injury.major) {
    p.majorInjuries += 1;
    p.injuryProneness = clamp(p.injuryProneness + rng.int(9, 18), 0, 100);
    p.injuryRisk = clamp(p.injuryRisk + rng.int(6, 12), 0, 100);
    p.mentality = clamp(p.mentality - rng.int(2, 8), 0, 100);
  }
  p.monthsOut = round(monthsOut * 10) / 10;
  const availability = clamp(1 - monthsOut / 10, 0, 1);

  const rawMinutes = clamp(
    playtimeFactor(p.ovr, strength, p.form, p.fitness) * phys.minutesMod * p.playtimeModifier,
    0.03,
    1,
  );
  const minutes = clamp(rawMinutes * availability, 0, 1);
  p.role = minutes > 0.75 ? "Leistungsträger" : minutes > 0.5 ? "Stammspieler" : minutes > 0.2 ? "Rotation" : "Talent";
  const maxApps = division === 1 ? 42 : 38;
  const apps = clamp(round(maxApps * minutes * rng.float(0.8, 1.06)), 0, maxApps + 12);

  const isGk = GK(s.profile.pos);
  const out = attackOutput(s.profile.pos);
  const quality =
    (p.ovr / 78) * (0.65 + p.form / 220) * (0.75 + strength / 320) * ((60 / Math.max(45, lq)) * 0.55 + 0.5);
  const goals = isGk ? 0 : Math.max(0, round(apps * out.g * quality * rng.float(0.7, 1.3)));
  const assists = isGk ? 0 : Math.max(0, round(apps * out.a * quality * rng.float(0.6, 1.35)));
  const cleanSheets = isGk
    ? Math.max(0, round(apps * (0.12 + (strength - 55) / 130) * phys.defenseMod * rng.float(0.7, 1.25)))
    : 0;
  const saves = isGk ? Math.max(0, round(apps * rng.float(2.2, 4.4) * (1.25 - strength / 200))) : 0;

  const contribution = isGk
    ? (cleanSheets / Math.max(1, apps)) * 2.4
    : ((goals + assists) / Math.max(1, apps)) * 1.6;
  const rating = clamp(
    Number(
      (5.6 + p.ovr / 42 + contribution + p.form / 260 - (minutes < 0.3 ? 0.5 : 0) + rng.float(-0.3, 0.3)).toFixed(2),
    ),
    4.5,
    9.7,
  );

  /* ---------- Einfluss des Spielers auf seine Mannschaft in DIESER Saison */
  const teamSeasonBoost = teamBoostForSeason({
    ovr: p.ovr,
    teamStrength: strength,
    minutes,
    rating,
    missedSeason: minutes < 0.05,
  });

  /* ---------- Gemeinsame Ligasaison der gesamten Clubwelt */
  const worldSeason = simulateWorldSeason(
    s.world,
    s.profile.seed,
    s.seasonIndex,
    [club.country],
    teamSeasonBoost > 0 ? { [club.id]: teamSeasonBoost } : {},
  );
  const worldResult = worldSeason.byCountry[club.country]!;
  const position = worldResult.positions[club.id] ?? 10;
  const promoted = worldResult.promoted.includes(club.id);
  const relegated = worldResult.relegated.includes(club.id);
  const qualification = worldResult.qualification[club.id];
  const continental = worldResult.continental[club.id];
  const leagueLabelValue = `${divisionLabel(club.country, division)} · D${division}`;

  const conf = confederationFor(club.country, COUNTRY_BY_CODE.get(club.country)?.region ?? "eu-west");
  const cups = nationalCups(club.country);
  const trophies: Trophy[] = [];
  const competitions = [divisionLabel(club.country, division), ...cups.map((c) => c.name)];
  if (continental) competitions.push(continental.split(":")[0]!.trim());

  const involved = minutes >= 0.1;
  if (worldResult.champion === club.id && involved) {
    award(
      state,
      trophies,
      "club",
      { id: `league-${club.country}-${division}`, name: `Meisterschaft ${divisionLabel(club.country, division)}`, variant: "shield" },
      `Titelgewinn mit ${club.name}.`,
      club.id,
      club.country,
    );
  }
  if (worldResult.cupWinner === club.id && involved) {
    // Mehrere Pokale eines Landes werden separat und plausibel gezogen.
    cups.forEach((cup, i) => {
      if (i === 0 || rng.chance(0.35)) {
        award(state, trophies, "club", cup, `Pokalsieg mit ${club.name}: ${cup.name}.`, club.id, club.country);
      }
    });
  }
  if (continental?.endsWith("Titel") && involved) {
    const compName = continental.split(":")[0]!.trim();
    const comp =
      CONTINENTAL_CLUB_COMPETITIONS[conf].find((c) => c.name === compName) ??
      ({ id: `cont-${conf.toLowerCase()}`, name: compName, variant: "cup-big" } as CompetitionDef);
    const underdog = strength < 78;
    award(
      state,
      trophies,
      "club",
      comp,
      underdog
        ? `Der größte Vereinstitel – als Außenseiter gewonnen mit ${club.name}.`
        : `Kontinentaler Titel mit ${club.name}.`,
      club.id,
      club.country,
    );
    if (underdog) {
      p.reputation = clamp(p.reputation + 12, 0, 100);
      setFanValue(s, club.id, fanValue(s, club.id) + 14);
    }
  }

  /* ---------- Individuelle Auszeichnungen */
  const awardOf = (id: string) => AWARD_BY_ID.get(id)!;
  if (!isGk && goals >= 22 && rng.chance(0.35 + (p.ovr - 80) / 90)) {
    award(state, trophies, "award", awardOf("top-scorer"), `${goals} Tore in ${club.league}.`, club.id, club.country);
  }
  if (!isGk && goals >= 26 && p.ovr >= 86 && rng.chance(0.2)) {
    award(state, trophies, "award", awardOf("golden-shoe"), `${goals} Ligatore – europaweite Bestmarke.`, club.id, club.country);
  }
  if (!isGk && goals >= 12 && rng.chance(0.06)) {
    award(state, trophies, "award", awardOf("puskas"), "Das schönste Tor des Jahres.", club.id, club.country);
  }
  if (isGk && cleanSheets >= 14 && rng.chance(0.4)) {
    award(state, trophies, "award", awardOf("keeper-of-the-season"), `${cleanSheets} Spiele ohne Gegentor.`, club.id, club.country);
  }
  if (isGk && cleanSheets >= 18 && p.ovr >= 87 && rng.chance(0.18)) {
    award(state, trophies, "award", awardOf("yashin"), `Weltbester Torhüter des Jahres (${cleanSheets} Zu-Null-Spiele).`, club.id, club.country);
  }
  if (rating >= 7.8 && rng.chance(0.22 + (p.ovr - 82) / 110)) {
    award(state, trophies, "award", awardOf("player-of-the-season"), `Durchschnittsnote ${rating}.`, club.id, club.country);
  }
  if (p.ovr >= 88 && rating >= 7.9 && trophies.length >= 1 && rng.chance(0.14)) {
    award(state, trophies, "award", awardOf("player-of-the-year"), `Note ${rating} und Titel – die Saison des Jahres.`, club.id, club.country);
  }
  if (p.ovr >= 90 && rating >= 8 && rng.chance(0.16)) {
    award(state, trophies, "award", awardOf("world-player"), "Die höchste individuelle Auszeichnung des Jahres.", club.id, club.country);
  }
  // Ballon d'Or: extrem selten und nur bei echter Weltklasse-Saison mit Titeln.
  if (p.ovr >= 92 && rating >= 8.2 && trophies.some((t) => t.kind === "club") && rng.chance(0.07)) {
    award(state, trophies, "award", awardOf("ballon-dor"), `OVR ${p.ovr}, Note ${rating} und Titel – die beste Saison der Welt.`, club.id, club.country);
  }
  if (p.age <= 21 && rating >= 7.2 && rng.chance(0.25)) {
    award(state, trophies, "award", awardOf("young-player"), "Auszeichnung als bester Nachwuchsspieler.", club.id, club.country);
  }
  if (p.age <= 21 && rating >= 7.7 && p.ovr >= 80 && rng.chance(0.12)) {
    award(state, trophies, "award", awardOf("kopa"), "Bester Spieler unter 21 Jahren.", club.id, club.country);
  }

  /* ---------- Nationalmannschaft */
  let natApps = 0;
  let natGoals = 0;
  let nationalNote: string | undefined;
  let legendMoment: string | undefined;
  let legendMomentRef: string | undefined;

  const natCode = s.national.committed;
  if (natCode) {
    const nat = COUNTRY_BY_CODE.get(natCode);
    const bar = (nat?.strength ?? 60) - 12;
    if (p.ovr >= bar && p.age >= 17 && availability > 0.4) {
      natApps = clamp(round(rng.float(4, 12) * (0.5 + minutes)), 1, 16);
      natGoals = isGk ? 0 : Math.max(0, round(natApps * out.g * quality * rng.float(0.5, 1.1)));
      s.national.caps += natApps;
      s.national.goals += natGoals;
      nationalNote = `${natApps} Länderspiele für ${countryName(natCode)}.`;
      // Turnierjahr = Kalenderjahr am Saisonende (Saison 2027/28 → 2028).
      const natConf = confederationFor(natCode, nat?.region ?? "eu-west");
      const tournamentYear = s.startYear + s.seasonIndex + 1;
      for (const t of tournamentsForYear(natConf, tournamentYear)) {
        const winChance = clamp(0.02 + Math.max(0, (nat?.strength ?? 60) - 74) / 90, 0.01, 0.3);
        if (natApps >= 4 && rng.chance(winChance)) {
          s.national.majorTitles += 1;
          award(state, trophies, "national", t, `${t.name} ${tournamentYear}: Turniersieg mit ${countryName(natCode)}.`, undefined, natCode);
          nationalNote += ` ${t.name} ${tournamentYear} gewonnen!`;
          /**
           * Legendäre Finalszene – nur bei echter Turnierbeteiligung, seeded und
           * positionsgerecht. Sie bleibt dauerhaft im Saisondatensatz.
           */
          if (!legendMoment) {
            const momentRng = subRng(s.profile.seed, "moment", t.id, tournamentYear, s.profile.pos);
            legendMoment = buildLegendMoment(momentRng, {
              pos: s.profile.pos,
              tournament: t.name,
              year: tournamentYear,
              nationName: countryName(natCode),
              playerName: s.profile.name,
            });
            legendMomentRef = `${t.name} ${tournamentYear}`;
          }
        }
      }

    } else {
      nationalNote = `Keine Nominierung für ${countryName(natCode)} in dieser Saison.`;
    }
  }

  if (!injury.text) {
    p.fitness = clamp(p.fitness + rng.int(1, 6) - (p.age > 31 ? 4 : 0), 40, 100);
  } else {
    p.fitness = clamp(p.fitness - round(monthsOut * 3), 40, 100);
  }

  /* ---------- Entwicklung */
  const delta = developmentDelta(s, rng, minutes, rating, monthsOut);
  p.ovr = clamp(p.ovr + delta, 50, 99);

  /* ---------- Leihbonus: viel Einsatzzeit auf Leihe entwickelt garantiert */
  const wasLoan = p.loan;
  const parentIdBefore = p.parentClubId;
  let loanBonus = 0;
  let loanNote: string | undefined;
  if (wasLoan) {
    const parent = getClub(parentIdBefore ?? p.clubId);
    const heavyUse = apps >= 20 && minutes >= 0.55;
    if (heavyUse && p.ovr < 99) {
      // Staffelung nach Qualität des Leihumfelds – besseres Umfeld nie schlechter.
      const env = strength;
      loanBonus = env >= 78 ? 3 : env >= 68 ? 2 : 1;
      loanBonus = Math.min(loanBonus, 99 - p.ovr);
      /**
       * Ab 36 bleibt die Saison netto höchstens neutral, ab 40 strikt negativ –
       * ein Leihbonus gleicht den Altersabbau nie aus.
       */
      if (p.age >= 36) {
        const cap = startOvrValue - (p.age >= 40 ? 1 : 0) - p.ovr;
        loanBonus = Math.max(0, Math.min(loanBonus, cap));
      }
      p.ovr = clamp(p.ovr + loanBonus, 50, 99);

      loanNote = `Leihe bei ${club.name} (Stammverein ${parent.name}) · ${apps} Einsätze`;

    } else {
      loanNote = `Leihe bei ${club.name} (Stammverein ${parent.name}) · wenig Spielzeit`;
    }
    p.loanSeasonsLeft = Math.max(0, p.loanSeasonsLeft - 1);
  }
  s.peakOvr = Math.max(s.peakOvr, p.ovr);

  /**
   * ---------- Körperverschleiß
   * Ersetzt jedes Alterslimit: Der Verschleiß steigt jede Saison strikt monoton
   * und entscheidet – nicht eine Zahl im Geburtsdatum –, wann Schluss ist.
   */
  const wearBefore = p.bodyWear;
  p.bodyWear = nextBodyWear({
    age: p.age,
    bodyWear: p.bodyWear,
    minutes,
    monthsOut,
    majorInjuries: p.majorInjuries,
    injuryProneness: p.injuryProneness,
    fitness: p.fitness,
    longevity: p.longevity,
  });
  const bodyBroken =
    isBodyFinished(p.bodyWear) || rng.chance(breakdownChance(p.bodyWear, p.age, p.majorInjuries, p.longevity));
  let bodyNote: string | undefined;
  if (bodyBroken) {
    p.bodyWear = 100;
    s.retirementCause = "body";
    bodyNote = injury.major
      ? `Der Körper kann nicht mehr: Nach dieser Verletzung ist keine weitere Saison möglich.`
      : `Der Körper kann nicht mehr – nach ${p.age} Jahren ist körperlich Schluss.`;
  } else if (p.bodyWear >= 78 && wearBefore < 78) {
    bodyNote = "Der Körper meldet sich deutlich: Jede weitere Saison kostet dich mehr.";
  }


  /* ---------- Moral, Mentalität, Fans */
  p.morale = clamp(round(p.morale + (rating - 6.9) * 12 + (position <= 3 ? 6 : 0) - (minutes < 0.3 ? 8 : 0)), 5, 100);
  p.mentality = clamp(
    round(p.mentality + (rating - 6.9) * 3 + (trophies.length ? 3 : 0) - (missedSeason ? 6 : 0) + rng.int(-2, 3)),
    0,
    100,
  );
  p.relationship = clamp(round(p.relationship + (rating - 6.8) * 8), 5, 100);
  p.reputation = clamp(round(p.reputation + (p.ovr - 60) / 12 + trophies.length * 3 + (minutes > 0.6 ? 2 : 0)), 0, 100);
  const fanDelta = (rating - 6.8) * 6 + trophies.length * 5 + (promoted ? 6 : 0) - (relegated ? 4 : 0) - (minutes < 0.2 ? 3 : 0);
  setFanValue(s, club.id, fanValue(s, club.id) + fanDelta);

  /* ---------- Wert & Vertrag */
  p.wage = weeklyWage(p.ovr, club.finances);
  p.contractYears = Math.max(0, p.contractYears - 1);
  p.value = marketValue({ ovr: p.ovr, age: p.age, reputation: p.reputation, contractYears: p.contractYears });
  p.playtimeModifier = clamp(p.playtimeModifier + (1 - p.playtimeModifier) * 0.5, 0.5, 1.35);
  p.age += 1;

  /**
   * Club-Impact: Nur ein echter Leistungsträger in einem schwachen Kader hebt
   * das Niveau seines Vereins – dauerhaft. Ein einmal verdienter Schub wird in
   * einer schwächeren Folgesaison nie wieder abgezogen.
   */
  const clubImpact = clubImpactForSeason({
    clubStrength: strength,
    currentStrength: dynamicStrength(s.world, club.id),
    apps,
    minutes,
    rating,
    missedSeason,
    exceptional: rating >= 8.0 || promoted || trophies.length > 0 || Boolean(continental),
  });
  if (clubImpact > 0) {
    adjustClubStrength(s.world, club.id, clubImpact, CLUB_IMPACT_CAP);
    s.clubImpact[club.id] = (s.clubImpact[club.id] ?? 0) + clubImpact;
  }
  const clubImpactNote =
    clubImpact > 0
      ? `Du hebst das Niveau von ${club.name} spürbar an (+${clubImpact} Teamstärke).`
      : undefined;



  const record: SeasonRecord = {
    index: s.seasonIndex,
    age: p.age - 1,
    seasonLabel: seasonLabel(s.startYear, s.seasonIndex),
    clubId: club.id,
    leagueLabel: leagueLabelValue,
    apps,
    goals,
    assists,
    cleanSheets,
    saves,
    rating,
    form: p.form,
    startOvr: startOvrValue,
    endOvr: p.ovr,
    seasonalDelta: p.ovr - startOvrValue,
    preDecisionOvr: p.ovr,

    tablePosition: position,
    competitions,
    trophies,
    injuries,
    natApps,
    natGoals,
    nationalNote,
    loan: wasLoan,
    parentClubId: wasLoan ? parentIdBefore : undefined,
    loanBonus: loanBonus || undefined,
    loanNote,
    division,
    promoted,
    relegated,
    qualification,
    continental,
    worldNote: worldResult.note,
    monthsOut: p.monthsOut,
    missedSeason,
    clubImpact: clubImpact || undefined,
    clubImpactNote,
    teamSeasonBoost: teamSeasonBoost || undefined,
    legendMoment,
    legendMomentRef,
    physicalNote: [
      phys.note && apps > 0 && (injuries.length > 0 || s.profile.pos === "TW" || s.profile.pos === "IV")
        ? phys.note
        : undefined,
      bodyNote,
    ]
      .filter(Boolean)
      .join(" ") || undefined,
  };
  if (missedSeason) record.eventNote = "Saison verletzungsbedingt nahezu komplett verpasst.";
  applyLingeringReputation(s, record);

  s.seasons.push(record);
  s.seasonIndex += 1;
  return record;
}


/**
 * Hält die Timeline lückenlos: Entscheidungsfolgen wandern in die letzte Saison.
 * Saisonentwicklung und Gamble addieren sich – daher Spielraum bis +8.
 */
function syncTimeline(s: GameState): void {
  const last = s.seasons[s.seasons.length - 1];
  if (!last) return;
  const capped = clamp(s.player.ovr, Math.max(50, last.startOvr - 14), Math.min(99, last.startOvr + 8));
  s.player.ovr = capped;
  last.endOvr = capped;


  s.peakOvr = Math.max(s.peakOvr, capped);
}

/* ------------------------------------------------- Entscheidungs-Auswahl */

/** Kleiner Bonus/Malus auf die Erfolgschance aus Mentalität und Form. */
function gambleBias(state: GameState): number {
  const p = state.player;
  const trait = (hasTrait(state, "professional") ? 3 : 0) + (hasTrait(state, "ambitious") ? 2 : 0) - (hasTrait(state, "showman") ? 1 : 0);
  return clamp(Math.round((p.mentality - 55) / 6 + (p.form - 55) / 12) + trait, -8, 10);
}

function gambleFor(state: GameState, decisionId: string, optionId: string) {
  return makeGamble(
    state.profile.seed,
    decisionId,
    optionId,
    state.seasonIndex,
    gambleBias(state),
    state.gambleLossStreak ?? 0,
  );
}

/* ------------------------------------------------------- Vereinsangebote */

function expectedRoleFor(ovr: number, strength: number): PlayerRole {
  const gap = ovr - strength;
  if (gap >= 6) return "Leistungsträger";
  if (gap >= 0) return "Stammspieler";
  if (gap >= -6) return "Rotation";
  return "Talent";
}

function playtimeLabelFor(role: PlayerRole): string {
  switch (role) {
    case "Leistungsträger":
      return "Sehr hohe Spielzeit (Stammkraft)";
    case "Stammspieler":
      return "Hohe Spielzeit";
    case "Rotation":
      return "Rotationsminuten";
    default:
      return "Wenig Spielzeit, viel Training";
  }
}

/** Kandidatenländer: aktuelles Land, Nationalitäten und bereits initialisierte Welten. */
function candidateClubs(state: GameState): Club[] {
  const club = getClub(state.player.clubId);
  const codes = [
    ...new Set([club.country, state.profile.nat1, state.profile.nat2, ...Object.keys(state.world.countries)]),
  ].filter(Boolean) as string[];
  for (const code of codes) ensureCountryWorld(state.world, code);
  return codes.flatMap((code) => clubsOf(code)).filter((c) => visibleTier(c));
}

/**
 * Welche Leih-Route ist plausibel?
 * "playtime" = klassische Spielpraxis-Leihe (jung oder zu wenig Minuten) bei
 *              einem Verein, der deutlich über dem eigenen Niveau liegt.
 * "step-up"  = ein junger Spieler überragt seinen schwächeren Verein und wird
 *              von einem stärkeren/renommierteren Club befristet geliehen.
 * "none"     = regulärer Transfermarkt.
 */
export type LoanRoute = "none" | "playtime" | "step-up";

export function loanRouteFor(state: GameState): LoanRoute {
  const p = state.player;
  const last = state.seasons[state.seasons.length - 1];
  const home = getClub(p.parentClubId ?? p.clubId);
  const homeStrength = dynamicStrength(state.world, home.id);
  const gap = homeStrength - p.ovr;
  const lowMinutes = !!last && last.apps <= 14;
  if ((p.age <= 23 || lowMinutes) && gap >= 3) return "playtime";
  /**
   * Zweite Route: jung, bereits über dem Niveau des eigenen (schwächeren)
   * Vereins und mit belegter Saisonleistung. Kein Automatismus – ohne Minuten
   * oder ohne Note bleibt es beim normalen Transferfenster. Keine Leihe aus
   * einer laufenden Leihe heraus.
   */
  const performed = !!last && last.apps >= 18 && last.rating >= 7.0 && !last.missedSeason;
  const outgrown = p.ovr >= homeStrength + 2;
  if (!p.parentClubId && p.age <= 22 && outgrown && performed) return "step-up";
  return "none";
}

/** true, wenn eine Leihe der realistische Weg ist. */
export function loanEligible(state: GameState): boolean {
  return loanRouteFor(state) !== "none";
}


/**
 * Erzeugt exakt drei unterschiedliche Zielclubs. Kein Angebot trägt einen
 * OVR-Effekt – ein Vereinswechsel ist niemals eine OVR-Lotterie.
 */
function buildOffers(state: GameState, rng: Rng, loan: boolean, route: LoanRoute = "none"): ClubOffer[] {
  const p = state.player;
  const currentId = p.clubId;
  const parentId = p.parentClubId;
  const stepUp = loan && route === "step-up";
  const homeStrength = dynamicStrength(state.world, getClub(parentId ?? currentId).id);
  // Verbrannte Brücken: Vereine, die du verraten hast, rufen nicht mehr an.
  let pool = candidateClubs(state).filter((c) => c.id !== currentId && c.id !== parentId && clubWillCall(state, c.id));
  if (stepUp) {
    /**
     * Ein Leihangebot „nach oben“ muss vom Zielclub her plausibel sein: er ist
     * spürbar stärker als der aktuelle Verein, aber kein Sprung ins Absurde.
     * Aus 50 OVR wird so kein Weltklasseclub.
     */
    const min = Math.max(homeStrength + 4, p.ovr + 3);
    const max = p.ovr + 12;
    const filtered = pool.filter((c) => {
      const s = dynamicStrength(state.world, c.id);
      return s >= min && s <= max;
    });
    if (filtered.length < 3) return [];
    pool = filtered;
  }
  if (pool.length < 3) return [];

  const target = stepUp ? p.ovr + 8 : p.ovr + (loan ? -2 : 3);
  const scored = pool
    .map((c) => {
      const strength = dynamicStrength(state.world, c.id);
      const division = dynamicDivision(state.world, c.id);
      const role = expectedRoleFor(p.ovr, strength);
      // Leihe: realistische Spielzeit zählt mehr als reine Clubstärke.
      const playFit = loan && !stepUp ? (role === "Talent" ? 26 : role === "Rotation" ? 8 : 0) : 0;
      const prestigePull = stepUp ? -c.prestige / 20 : 0;
      const distance = Math.abs(strength - target) + playFit + prestigePull + rng.float(0, 9);
      return { club: c, strength, division, role, distance };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12);

  const picks: typeof scored = [];
  for (const cand of rng.shuffle(scored)) {
    if (picks.length >= 3) break;
    if (picks.some((x) => x.club.id === cand.club.id)) continue;
    picks.push(cand);
  }
  if (picks.length < 3) return [];

  /**
   * Lockruf des Rivalen: Ab und zu meldet sich ausgerechnet der Erzrivale.
   * Wer sich als geldorientiert oder ehrgeizig beschreibt, hört öfter davon.
   */
  let lure: string | undefined;
  if (!loan) {
    const lureChance = 0.22 * traitWeight(state, { greedy: 1.5, ambitious: 1.3, hothead: 1.2, loyal: 1.3 });
    if (rng.chance(Math.min(0.5, lureChance))) {
      const rivals = relationsOf(currentId)
        .filter((r) => r.type === "rivalry")
        .map((r) => getClub(r.b))
        .filter((c) => {
          if (picks.some((x) => x.club.id === c.id) || !clubWillCall(state, c.id)) return false;
          const st = dynamicStrength(state.world, c.id);
          return st >= p.ovr - 12 && st <= p.ovr + 10;
        });
      if (rivals.length) {
        const c = rng.pick(rivals);
        ensureCountryWorld(state.world, c.country);
        const strength = dynamicStrength(state.world, c.id);
        picks[picks.length - 1] = {
          club: c,
          strength,
          division: dynamicDivision(state.world, c.id),
          role: expectedRoleFor(p.ovr, strength),
          distance: 0,
        };
        lure = c.id;
      }
    }
  }

  return picks.map(({ club, strength, division, role }) => {
    const rel = relationBetween(currentId, club.id);
    const warning = offerWarning(state, club.id);
    const reason =
      club.id === lure
        ? `Lockruf vom Rivalen: ${club.name} will dich unbedingt – und bietet mehr, als du je verdient hast. Die Frage ist nur, was du dafür verlierst.`
        : club.id === state.heartClub
        ? "Herzensverein – dort begann alles."
        : rel?.type === "rivalry"
          ? `${rel.label} – ein Schritt mit Sprengkraft.`
          : rel?.type === "fanFriendship"
            ? `${rel.label} – die Kurven sind sich freundlich gesinnt.`
            : stepUp
              ? `${club.name} beobachtet dich seit Monaten und will dich für eine Saison ausleihen – dein Vertrag bleibt beim Stammverein.`
              : loan
                ? `${club.name} sucht genau dein Profil und verspricht Einsatzzeit.`
                : `${club.name} plant mittelfristig mit dir als ${role}.`;
    const offer: ClubOffer = {
      id: `${loan ? "loan" : "transfer"}:${club.id}`,
      clubId: club.id,
      deal: loan ? "loan" : "transfer",
      leagueLabel: leagueLabelFor(state.world, club.id),
      division,
      strength: Math.round(strength),
      expectedRole: role,
      playtime: playtimeLabelFor(role),
      reason,
      country: club.country,
      loanRoute: loan ? (stepUp ? "step-up" : "playtime") : undefined,
      warning,
    };
    return offer;
  });
}

export function buildClubDecision(state: GameState, rng: Rng, forced: boolean): PendingClubDecision | null {
  const p = state.player;
  const club = getClub(p.clubId);
  /**
   * Jede gespielte Saison bekommt ein echtes Transferfenster. Es gibt keine
   * Zufallssperre und keinen Cooldown mehr – die Priorisierung
   * (loan-return → stagnation → forced → Fenster) verhindert weiterhin, dass
   * in derselben Saison zwei Vereinsentscheidungen entstehen.
   */
  const route = loanRouteFor(state);
  let loan = route !== "none";
  let stepUp = route === "step-up";
  let offers = buildOffers(state, rng, loan, route);
  /**
   * Reicht der Leih-Pool nicht für drei plausible Ziele (z. B. sehr hohes OVR
   * oder kleiner Markt), fällt das Fenster auf den regulären Transfermarkt
   * zurück. Ein Leihfenster wird niemals mit schwächeren Clubs aufgefüllt –
   * stattdessen entstehen ehrliche feste Wechselangebote.
   */
  if (offers.length !== 3 && loan) {
    offers = buildOffers(state, rng, false, "none");
    loan = false;
    stepUp = false;
  }
  if (offers.length !== 3) return null;
  return {
    kind: "club",
    id: `club-${forced ? "forced" : "window"}-${state.seasonIndex}`,
    title: loan ? (stepUp ? "Leihangebote von oben" : "Leihangebote") : "Transferfenster",
    intro: forced
      ? `Bei ${club.name} bist du derzeit klar unter dem Niveau des Kaders. Dein Berater hat drei konkrete Ziele vorbereitet – eine Entscheidung ist nötig.`
      : stepUp
        ? `Du bist bei ${club.name} über das Niveau des Kaders hinausgewachsen. Drei stärkere Vereine wollen dich für eine Saison ausleihen – Vertragsinhaber bleibt ${club.name}.`
        : `Dein Berater legt dir drei konkrete Optionen auf den Tisch. Aktuell stehst du bei ${club.name} unter Vertrag${p.contractYears <= 0 ? " – der Vertrag läuft aus" : ` (noch ${p.contractYears} Jahre)`}.`,
    forced,
    variant: "window",
    offers,
  };
}



/* --------------------------------------------- Sportliche Sackgasse */

/**
 * Drei Transferziele, deren dynamische Stärke plausibel zum OVR passt
 * (Korridor OVR-5 bis OVR+7). Bei 85 OVR taucht kein 60er-Club auf.
 */
export function buildStagnationOffers(state: GameState, rng: Rng): ClubOffer[] {
  const p = state.player;
  const [min, max] = stagnationTargetRange(p.ovr);
  const pool = candidateClubs(state)
    .filter((c) => c.id !== p.clubId && c.id !== p.parentClubId)
    .map((c) => ({ club: c, strength: dynamicStrength(state.world, c.id), division: dynamicDivision(state.world, c.id) }))
    // Nur echte Erstligisten sind plausible Ziele für einen Topspieler.
    .filter((x) => x.division === 1);
  /**
   * Bei 95–99 OVR ist der enge Korridor oft leer. Dann wird die Untergrenze
   * kontrolliert gesenkt, bis drei Kandidaten existieren – die Obergrenze
   * bleibt, damit keine unrealistisch starken Fantasieclubs entstehen.
   */
  let floor = min;
  let inRange = pool.filter((x) => x.strength >= floor && x.strength <= max);
  while (inRange.length < 3 && floor > 55) {
    floor -= 2;
    inRange = pool.filter((x) => x.strength >= floor && x.strength <= max);
  }
  const scored = inRange
    // Prestige und Ligaebene entscheiden über die Attraktivität des Ziels.
    .map((x) => ({
      ...x,
      distance: Math.abs(x.strength - (p.ovr + 2)) + (x.division - 1) * 4 - x.club.prestige / 22 + rng.float(0, 6),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12);
  const picks: typeof scored = [];
  // Bei knapper Auswahl bleibt die Reihenfolge nach Attraktivität erhalten.
  for (const cand of scored.length > 3 ? rng.shuffle(scored) : scored) {
    if (picks.length >= 3) break;
    if (picks.some((x) => x.club.id === cand.club.id)) continue;
    picks.push(cand);
  }
  if (picks.length < 3) return [];
  return picks.map(({ club, strength, division }) => {
    const role = expectedRoleFor(p.ovr, strength);
    return {
      id: `transfer:${club.id}`,
      clubId: club.id,
      deal: "transfer" as const,
      leagueLabel: leagueLabelFor(state.world, club.id),
      division,
      strength: Math.round(strength),
      expectedRole: role,
      playtime: playtimeLabelFor(role),
      reason: `${club.name} will mit dir Titel gewinnen – konkret, nicht irgendwann.`,
      country: club.country,
    } satisfies ClubOffer;
  });
}

/**
 * Nachricht von Agent oder Familie bei sportlicher Sackgasse. Kein
 * vorgeschalteter Ja/Nein-Dialog: es entsteht direkt eine separate Vereinswahl
 * mit drei passenden Zielen plus „Beim aktuellen Verein bleiben“.
 */
export function buildStagnationDecision(state: GameState, rng: Rng): PendingClubDecision | null {
  const input = stagnationInputOf(state);
  if (!stagnationTriggered(input)) return null;
  const offers = buildStagnationOffers(state, rng);
  if (offers.length !== 3) return null;
  const club = getClub(state.player.clubId);
  const fromAgent = rng.chance(0.55);
  const years = input.trophylessSeasons;
  const reason = input.relegated
    ? `der Abstieg mit einem Kader dieser Qualität ist nicht mehr zu erklären`
    : input.disappointingSeasons >= 2
      ? `${years} Jahre ohne Titel und dazu Platzierungen, die zu diesem Kader nicht passen`
      : `${years} Jahre bei ${club.name}, ${years} Jahre ohne Titel`;
  const intro = fromAgent
    ? `Dein Agent ruft an, ohne Umschweife: „${reason.charAt(0).toUpperCase()}${reason.slice(1)}. Du bist ${state.player.ovr} OVR und verschenkst deine besten Jahre. Ich habe drei Vereine, die sofort mit dir arbeiten wollen.“`
    : `Deine Familie sitzt abends mit dir am Tisch. Niemand macht Vorwürfe, aber der Satz fällt trotzdem: „${reason.charAt(0).toUpperCase()}${reason.slice(1)}. Willst du das wirklich noch länger?“ Drei Vereine haben angefragt.`;
  return {
    kind: "club",
    id: `stagnation-${state.seasonIndex}`,
    title: fromAgent ? "Dein Agent wird deutlich" : "Deine Familie fragt nach",
    intro,
    forced: false,
    variant: "stagnation",
    offers,
  };
}


/**
 * Erzwungenes Fenster: nur bei eindeutigem Gap aus Clubstärke, OVR, Rolle und
 * tatsächlicher Spielzeit – nicht nach einem einzigen knapp schwachen Jahr.
 */
function buildForcedClubDecision(state: GameState, rng: Rng): PendingClubDecision | null {
  const p = state.player;
  if (p.loan) return null;
  const last = state.seasons[state.seasons.length - 1];
  if (!last) return null;
  const gap = dynamicStrength(state.world, p.clubId) - p.ovr;
  const barelyPlayed = last.apps <= 9 && !last.missedSeason;
  const clearlyTooWeak = gap >= 10 || (gap >= 7 && barelyPlayed);
  if (!clearlyTooWeak) return null;
  return buildClubDecision(state, rng, true);
}

/**
 * Geordnete Rückkehr aus der Leihe. Ist der Spieler weiterhin nicht bereit,
 * erscheint direkt ein neues, separates Fenster mit drei neuen Leihzielen.
 */
function resolveLoanReturn(state: GameState, rng: Rng): PendingClubDecision | null {
  const p = state.player;
  if (!p.loan || p.loanSeasonsLeft > 0) return null;
  const parentId = p.parentClubId ?? p.clubId;
  const parent = getClub(parentId);
  p.clubId = parentId;
  p.loan = false;
  p.parentClubId = undefined;
  p.loanSeasonsLeft = 0;
  ensureCountryWorld(state.world, parent.country);
  const last = state.seasons[state.seasons.length - 1];
  if (last) last.loanNote = `${last.loanNote ? `${last.loanNote} · ` : ""}Rückkehr zu ${parent.name}`;
  const ready = p.ovr >= dynamicStrength(state.world, parentId) - 4;
  if (ready) return null;
  const decision = buildClubDecision(state, rng, true);
  if (!decision) return null;
  decision.intro = `Du kehrst zu ${parent.name} zurück, bist für diesen Kader aber noch nicht bereit. Drei Vereine wollen dich für eine weitere Saison.`;
  return decision;
}

function buildNationDecision(state: GameState, rng: Rng): PendingNationDecision | null {
  const p = state.player;
  const { nat1, nat2 } = state.profile;
  const n = state.national;
  if (n.locked) return null;
  if (p.age < 18 || p.ovr < 66) return null;

  if (!n.committed) {
    if (!nat2) {
      if (rng.chance(0.7)) n.committed = nat1;
      return null;
    }
    const a = COUNTRY_BY_CODE.get(nat1)!;
    const b = COUNTRY_BY_CODE.get(nat2)!;
    const strong = a.strength >= b.strength ? a : b;
    const other = a.strength >= b.strength ? b : a;
    return {
      kind: "nation",
      id: "nation-first",
      title: "Zwei Pässe, eine Entscheidung",
      intro: `${strong.flag} ${strong.name} beobachtet dich, hält sich aber bedeckt. ${other.flag} ${other.name} bietet dir sofort eine feste Rolle im Kader. Beide Wege sind ehrenwert.`,
      options: [
        {
          id: `nation:${strong.code}`,
          code: strong.code,
          label: `Für ${strong.name} spielen`,
          hint: "Härterer Konkurrenzkampf, größere Bühne",
        },
        {
          id: `nation:${other.code}`,
          code: other.code,
          label: `Für ${other.name} spielen`,
          hint: "Sofortige Rolle, klare Verantwortung",
        },
      ],
    };
  }

  if (nat2 && !n.switchOffered && p.age >= 23 && p.age <= 30 && rng.chance(0.2)) {
    const otherCode = n.committed === nat1 ? nat2 : nat1;
    const other = COUNTRY_BY_CODE.get(otherCode)!;
    n.switchOffered = true;
    return {
      kind: "nation",
      id: "nation-switch",
      title: "Ein letztes Angebot vom zweiten Verband",
      intro: `${other.flag} ${other.name} fragt offiziell an. Es wäre die letzte Möglichkeit zu wechseln – danach ist die Entscheidung endgültig.`,
      options: [
        {
          id: `nation:${otherCode}`,
          code: otherCode,
          label: `Zu ${other.name} wechseln`,
          hint: "Neue Rolle, geteilte Fanreaktionen",
        },
        {
          id: `nation:${n.committed}`,
          code: n.committed,
          label: `Bei ${countryName(n.committed)} bleiben`,
          hint: "Treue zur bisherigen Wahl",
        },
      ],
    };
  }
  return null;
}

/** Charakterzüge verschieben, welche bestehenden Ereignisse auftauchen. */
const EVENT_TRAITS: Record<string, Partial<Record<Trait, number>>> = {
  captain: { leader: 2.5, humble: 0.7 },
  mentor: { leader: 2, humble: 1.3 },
  media: { showman: 2, hothead: 1.5, humble: 0.5 },
  moneymove: { greedy: 2.5, loyal: 0.6 },
  agent: { greedy: 1.5 },
  "contract-dispute": { greedy: 2, loyal: 0.6 },
  burnout: { professional: 0.6, showman: 1.3 },
  injury: { professional: 0.6 },
  "social-media": { showman: 2.5, humble: 0.4 },
  "away-whistles": { hothead: 1.5 },
  "derby-pressure": { hothead: 1.5, leader: 1.3 },
  "fan-protest": { hothead: 1.4 },
  "form-crisis": { professional: 0.7 },
  "mental-block": { professional: 0.7 },
  youngster: { leader: 1.4 },
  "youth-competition": { leader: 1.4 },
  family: { loyal: 1.5, humble: 1.4 },
  "fan-favourite": { humble: 1.5, loyal: 1.4 },
  "derby-shirt": { loyal: 1.6 },
};

function buildEventDecision(state: GameState, rng: Rng): PendingOvrDecision | null {
  const pool = EVENTS.filter(
    (e) =>
      e.when(state) &&
      !(e.once && state.eventsSeen.includes(e.id)) &&
      (state.cooldowns[e.id] ?? -1) <= state.seasonIndex,
  );
  if (!pool.length) return null;
  const def = rng.weighted(pool.map((e) => [e, e.weight * traitWeight(state, e.traits ?? EVENT_TRAITS[e.id])] as const));
  // Option 0 ist stets der mutige Weg (Gamble), Option 1 der sichere.
  const risky = def.options[0]!;
  const safe = def.options[1] ?? def.options[0]!;
  return {
    kind: "ovr",
    id: def.id,
    title: def.title,
    intro: def.intro(state),
    options: [
      { id: risky.id, label: risky.label, hint: risky.hint, ovrEffect: gambleFor(state, def.id, risky.id) },
      { id: safe.id, label: safe.label, hint: safe.hint, ovrEffect: neutralEffect() },
    ],
  };
}


/* ------------------------------------------------------------- Simulation */

/**
 * Ruhestandsabwägung – ausdrücklich KEIN Alterslimit. Es gibt keine Alterszahl,
 * die eine Karriere beendet; `retireAge` ist nur der Zeitpunkt der nächsten
 * Abwägung. Das echte Ende liefert der Körperverschleiß (siehe body.ts).
 */
export function checkRetirement(state: GameState, rng: Rng): boolean {
  const p = state.player;
  if (p.age < 32) return false;
  let pressure = (p.age - p.retireAge) * 0.3;
  pressure += (60 - p.ovr) / 90;
  pressure += (70 - p.fitness) / 120;
  pressure += (60 - p.morale) / 160;
  pressure += p.majorInjuries * 0.05;
  // Verschleiß wirkt graduell, nicht abrupt.
  pressure += Math.max(0, p.bodyWear - 55) / 55;
  if (hasLongevityException(state) && p.age < 41) pressure -= 0.4;
  return rng.chance(clamp(pressure, 0, 0.97));
}


export interface AdvanceOptions {
  /**
   * true = die zuletzt erzeugte Konsequenz bleibt über die automatische
   * Simulation hinweg erhalten (Auto-Flow nach einer Entscheidung).
   */
  keepConsequence?: boolean;
}

export function simulateChunk(state: GameState, opts: AdvanceOptions = {}): GameState {
  let s = clone(state);
  if (s.pending || s.retired) return s;
  if (!opts.keepConsequence) s.lastConsequence = undefined;
  s.queue = [];
  if (s.chunkRemaining <= 0) {
    s.chunkRemaining = s.profile.pace;
    s.chunkEventUsed = false;
  }
  s = runSimulation(s);
  return s;
}

/**
 * Rückfall, falls kein Event-Pool passt: jede gespielte Saison bekommt
 * garantiert genau eine OVR-Entscheidung mit Gamble- und Neutral-Option.
 */
function fallbackOvrDecision(state: GameState, _rng: Rng): PendingOvrDecision {
  const id = `season-focus-${state.seasonIndex}`;
  const club = getClub(state.player.clubId);
  return {
    kind: "ovr",
    id,
    title: "Der Fokus der nächsten Monate",
    intro: `Die Saison bei ${club.name} ist abgehakt. Wie gehst du die kommenden Wochen an?`,
    options: [
      {
        id: "focus-push",
        label: "Alles auf Entwicklung setzen",
        hint: "Zusatzeinheiten, hohe Belastung, echtes Risiko",
        ovrEffect: gambleFor(state, id, "focus-push"),
      },
      {
        id: "focus-hold",
        label: "Kontrolliert weiterarbeiten",
        hint: "Regeneration und Stabilität statt Risiko",
        ovrEffect: neutralEffect(),
      },
    ],
  };
}

/** Nachgelagerte Entscheidungen derselben Saison – nie anstelle der OVR-Wahl. */
function buildFollowUps(s: GameState, rng: Rng): PendingDecision[] {
  const list: PendingDecision[] = [];
  // Geordnete Rückkehr aus der Leihe hat Vorrang vor allen anderen Wechseln.
  const loanReturn = resolveLoanReturn(s, rng);
  if (loanReturn) list.push(loanReturn);
  else {
    // Sportliche Sackgasse geht dem regulären Transferfenster vor.
    const stagnation = buildStagnationDecision(s, rng);
    if (stagnation) {
      s.cooldowns["stagnation"] =
        s.seasonIndex + rng.int(STAGNATION_COOLDOWN_MIN, STAGNATION_COOLDOWN_MAX);
      list.push(stagnation);
    } else {
      /**
       * Reihenfolge: Zwang → einmaliges Investoren-Projekt → normales Fenster.
       * Das Projekt entsteht nur, wenn kein vorrangiges Fenster nötig ist; es
       * ersetzt in dieser Saison das gewöhnliche Transferfenster.
       */
      const forced = buildForcedClubDecision(s, rng);
      const clubDecision =
        forced ??
        buildInvestorDecision(s, rng, seasonLabel(s.startYear, s.seasonIndex)) ??
        buildClubDecision(s, rng, false);
      if (clubDecision) list.push(clubDecision);
    }
  }
  const nation = buildNationDecision(s, rng);
  if (nation) list.push(nation);
  return list;
}

function runSimulation(s: GameState): GameState {
  while (s.chunkRemaining > 0 && !s.retired && !s.pending) {
    simulateSeason(s);
    s.chunkRemaining -= 1;
    const rng = subRng(s.profile.seed, "decide", s.seasonIndex, s.comebacks);

    /**
     * Zwei streng getrennte Fälle:
     * 1. Körperlich endgültig vorbei -> sofortiges Karriereende, keine Option.
     * 2. Normale Abwägung -> eigene „Noch ein Jahr?“-Entscheidung nach der OVR-Wahl.
     */
    const bodyDone = s.retirementCause === "body" || isBodyFinished(s.player.bodyWear);
    if (bodyDone) {
      s.retired = true;
      s.retirementCause = "body";
      s.chunkRemaining = 0;
    }
    const softRetire = !bodyDone && checkRetirement(s, rng) && canPlayAnotherSeason(s.player.bodyWear);

    if (s.player.contractYears <= 0) s.player.contractYears = 2;

    // Jede gespielte Saison bekommt zuerst genau eine OVR-Entscheidung …
    s.pending = buildEventDecision(s, rng) ?? fallbackOvrDecision(s, rng);
    s.chunkEventUsed = true;
    // … danach folgt entweder „Noch ein Jahr?“ oder Verein/Leihe/Nationalteam.
    s.queue = bodyDone
      ? []
      : softRetire
        ? [buildRetirementDecision(s, rng)]
        : buildFollowUps(s, rng);
    if (softRetire) s.chunkRemaining = 0;
    break;

  }
  if (s.retired && !s.pending) {
    s = finishCareer(s);
  }
  return s;
}




/**
 * Erlaubtes Länderset für ein Comeback: ausschließlich die primäre
 * Heimatnationalität samt datengetriebener Nachbarn – und, falls im Profil
 * gesetzt, die zweite Nationalität samt deren Nachbarn. Das Land des letzten
 * Vereins zählt nur, wenn es ohnehin darin vorkommt.
 */
export function comebackCountries(profile: Profile): string[] {
  const codes = [...neighborCountries(profile.nat1)];
  if (profile.nat2) codes.push(...neighborCountries(profile.nat2));
  return [...new Set(codes)].filter(Boolean);
}

/**
 * Drei Comeback-Angebote aus dem Heimatland oder direkten Nachbarländern.
 * Das reduzierte Comeback-OVR bestimmt das realistische Niveau der Clubs.
 */
function buildComebackOffers(s: GameState, rng: Rng, comebackOvr: number): ClubOffer[] {
  const codes = comebackCountries(s.profile);
  for (const code of codes) ensureCountryWorld(s.world, code);
  const pool = codes.flatMap((code) => clubsOf(code)).filter(visibleTier);
  if (pool.length < 3) return [];
  const scored = pool
    .map((club) => {
      const strength = dynamicStrength(s.world, club.id);
      const division = dynamicDivision(s.world, club.id);
      const nearHome = club.country === s.profile.nat1 ? 0 : club.country === s.profile.nat2 ? 3 : 7;
      return {
        club,
        strength,
        division,
        distance: Math.abs(strength - (comebackOvr - 2)) + nearHome + rng.float(0, 8),
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);
  const picks = rng.shuffle(scored).slice(0, 3);
  if (picks.length < 3) return [];
  return picks.map(({ club, strength, division }) => {
    const role = expectedRoleFor(comebackOvr, strength);
    return {
      id: `comeback:${club.id}`,
      clubId: club.id,
      deal: "transfer" as const,
      leagueLabel: leagueLabelFor(s.world, club.id),
      division,
      strength: Math.round(strength),
      expectedRole: role,
      playtime: playtimeLabelFor(role),
      reason: `${club.name} (${countryName(club.country)}) holt dich zurück auf den Platz.`,
      country: club.country,
    };
  });
}


/**
 * Baut die Comeback-Entscheidung deterministisch. Öffentlich, damit der
 * komplette Comeback-Flow (Angebote, Auswahl, Ablehnung) testbar ist.
 */
export function buildComebackDecision(
  s: GameState,
  years: number,
  comebackOvr: number,
  rng: Rng,
): PendingDecision | null {
  const offers = buildComebackOffers(s, rng, comebackOvr);
  if (offers.length !== 3) return null;
  return {
    kind: "comeback",
    id: `comeback:${years}`,
    title: "Noch einmal zurück?",
    intro: `Seit ${years} ${years === 1 ? "Jahr" : "Jahren"} bist du raus. Drei Vereine aus deiner Nähe fragen an. Dein Körper ist nicht mehr der alte – dein Name schon.`,
    years,
    comebackOvr,
    offers,
  };
}

function finishCareer(s: GameState): GameState {
  const rng = subRng(s.profile.seed, "comeback", s.comebacks, s.seasonIndex);
  /**
   * Kein Altersfenster mehr: ein Comeback scheitert nur am Körper. Nach einem
   * körperlichen Zusammenbruch gibt es keine Rückkehr.
   */
  if (!s.comebackChecked && s.comebacks < 1 && canComeback(s.player.bodyWear, s.retirementCause) && rng.chance(0.28)) {
    s.comebackChecked = true;
    const years = rng.int(1, 3);
    const comebackOvr = clamp(s.player.ovr - years * 2 - rng.int(0, 2), 40, 99);
    const decision = buildComebackDecision(s, years, comebackOvr, rng);
    if (decision) {
      s.pending = decision;
      return s;
    }
  }


  s.phase = "end";
  return s;
}



/* -------------------------------------------------- Entscheidung anwenden */

/**
 * Zentrale, einzige Quelle für Entscheidungs-OVR: Gamble liefert exakt einen
 * der zwei angezeigten Werte, neutral garantiert 0. Verändert ausschließlich
 * Spielerwerte – niemals clubId oder parentClubId.
 */
function applyOvrEffect(
  s: GameState,
  pending: PendingOvrDecision,
  chosen: DecisionOption | undefined,
  seasonIndex: number,
): void {
  if (!chosen) return;
  const eff = chosen.ovrEffect;
  let line: string;
  if (eff.type === "gamble") {
    const res = resolveGamble(s.profile.seed, pending.id, chosen.id, seasonIndex, eff);
    s.player.ovr = clamp(s.player.ovr + res.delta, 50, 99);
    s.peakOvr = Math.max(s.peakOvr, s.player.ovr);
    line = res.success ? `Gamble gewonnen: +${eff.gain} OVR` : `Gamble verloren: ${eff.loss} OVR`;
    // Pechsträhnen-Schutz: verlorene Gambles in Folge erhöhen die nächste Chance.
    s.gambleLossStreak = res.success ? 0 : (s.gambleLossStreak ?? 0) + 1;
    if (s.lastConsequence) {
      s.lastConsequence.deltas.push(`OVR ${res.delta > 0 ? "+" : ""}${res.delta}`);
      // Strukturiertes Ergebnis: die UI muss keinen Text parsen.
      s.lastConsequence.gamble = {
        outcome: res.success ? "win" : "loss",
        delta: res.delta,
        gain: eff.gain,
        loss: eff.loss,
        successChance: eff.successChance,
      };
    }
  } else {
    line = "Sicherer Weg: 0 OVR";
    // Der neutrale Weg beendet eine Pechsträhne ebenfalls.
    s.gambleLossStreak = 0;
  }
  if (s.lastConsequence) {
    s.lastConsequence.kind = "ovr";
    s.lastConsequence.optionId = chosen.id;
    s.lastConsequence.consequence = `${s.lastConsequence.consequence} ${line} · Gesamt-OVR ${s.player.ovr}.`;
  }
}


/** Führt einen echten Vereinswechsel bzw. eine Leihe aus – ohne jeden OVR-Gamble. */
function applyClubMove(s: GameState, offer: ClubOffer, rng: Rng): string {
  const oldId = s.player.clubId;
  const oldClub = getClub(oldId);
  const club = getClub(offer.clubId);
  const last = s.seasons[s.seasons.length - 1];
  const rel = relationBetween(oldId, offer.clubId);
  const isHeart = offer.clubId === s.heartClub;
  // Vor dem Vereinswechsel prüfen: welche Ex-Klubs wären verraten?
  const hits = rivalHits(s, offer.clubId);
  const tenure = currentTenure(s);
  const oldStrength = dynamicStrength(s.world, oldId);

  if (offer.deal === "loan") {
    // Stammverein bleibt erhalten, nur der Einsatzort wechselt.
    s.player.parentClubId = s.player.parentClubId ?? oldId;
    s.player.clubId = offer.clubId;
    s.player.loan = true;
    s.player.loanSeasonsLeft = 1;
    ensureCountryWorld(s.world, club.country);
    s.player.role = offer.expectedRole;
    s.player.playtimeModifier = clamp(s.player.playtimeModifier + 0.15, 0.5, 1.35);
    const parent = getClub(s.player.parentClubId);
    const consequence = `Leihe zu ${club.name} (${offer.leagueLabel}). Dein Vertrag bei ${parent.name} bleibt bestehen – du sollst Spielpraxis sammeln.`;
    if (last) last.loanNote = `Leihe zu ${club.name} vereinbart`;
    adjust(s, { morale: 6, form: -2 });
    return consequence;
  }

  s.player.parentClubId = undefined;
  s.player.loan = false;
  s.player.loanSeasonsLeft = 0;
  s.player.clubId = offer.clubId;
  ensureCountryWorld(s.world, club.country);
  s.player.contractYears = rng.int(3, 5);
  s.player.relationship = isHeart ? 90 : 55;
  s.player.role = offer.expectedRole;

  let consequence: string;
  const earlier = s.betrayals?.length ?? 0;
  const severity = hits.length ? rivalSeverity(s, hits) : 0;
  const tier = betrayalTier(severity, hits.length, earlier);
  if (tier > 0) {
    // Jeder verratene Ex-Klub verliert dich – je heftiger, desto dauerhafter.
    for (const h of hits) {
      setFanValue(s, h.clubId, fanValue(s, h.clubId) - (14 + h.intensity * 7) * (tier >= 2 ? 1.4 : 1));
    }
    setFanValue(s, offer.clubId, clamp(36 - severity * 1.5, 8, 40));
    adjust(s, {
      morale: -(5 + tier * 4),
      form: -(4 + tier * 3),
      relationship: -10,
      reputation: tier === 1 ? 3 : tier === 2 ? -4 : -10,
    });
    s.player.mentality = clamp(s.player.mentality - rng.int(2, 5) * tier, 0, 100);
    s.betrayals = [...(s.betrayals ?? []), makeBetrayal(s, offer.clubId, hits, severity)];
    const names = hits.map((h) => getClub(h.clubId).name);
    const main = hits[0]!;
    if (tier === 1) {
      consequence = `${main.label}: Du wechselst von ${oldClub.name} zu ${club.name}. Bei ${names[0]} wird dein Trikot aus dem Fanshop genommen, bei ${club.name} pfeifen sie dich beim ersten Training aus. Nur Leistung kann das drehen – vielleicht.`;
    } else if (tier === 2) {
      consequence =
        hits.length > 1
          ? `Doppelverrat! Mit dem Wechsel zu ${club.name} bringst du gleich ${names.join(" und ")} gegen dich auf. Die Boulevardpresse titelt „Der Mann ohne Wappen“, beide Kurven zeigen dasselbe Spruchband: „Nie wieder“.`
          : `Schon wieder. Nach deinem ersten Rivalen-Wechsel gehst du jetzt auch noch zu ${club.name} – ${main.label} gegen ${names[0]}. Die Fanclubs veröffentlichen ein gemeinsames Statement. Darin kommt dein Name nicht mehr vor.`;
    } else {
      consequence = `Die Fußballwelt steht kopf. ${club.name} – Erzrivale von ${names.join(", ")}. Fanclubs lösen sich auf, dein Wandbild vor dem alten Stadion wird übermalt, beim ersten Auswärtsspiel brauchst du Begleitschutz bis zum Bus. Du bist jetzt offiziell die meistgehasste Figur dieser Rivalität.`;
    }
    if (hasTrait(s, "loyal")) {
      consequence += ` Und das Schlimmste: Du hast dich selbst immer als loyal beschrieben. Jedes Interview von früher wird jetzt gegen dich zitiert.`;
    }
    if (last) last.relationNote = tier >= 2 ? `${hits.length > 1 ? "Doppelverrat" : "Wiederholungstäter"}: Wechsel zu ${club.name}` : `${main.label}: Wechsel zum Rivalen ${club.name}`;
  } else if (rel?.type === "fanFriendship") {
    setFanValue(s, offer.clubId, 65);
    adjust(s, { morale: 10, reputation: 4 });
    consequence = `${rel.label}: Beide Kurven begrüßen den Schritt. Bei ${club.name} wirst du herzlich empfangen.`;
    if (last) last.relationNote = rel.label;
  } else if (isHeart) {
    setFanValue(s, offer.clubId, Math.max(70, fanValue(s, offer.clubId)));
    adjust(s, { morale: 16, form: -4, reputation: club.prestige > 70 ? 6 : 0 });
    consequence = `Die Rückkehr zu ${club.name} ist keine sportliche, sondern eine emotionale Entscheidung. Das Stadion steht.`;
  } else {
    setFanValue(s, offer.clubId, 50);
    adjust(s, { morale: 8, form: -4, reputation: club.prestige > 70 ? 6 : 0 });
    consequence = `Du unterschreibst bei ${club.name} in der ${club.league}.`;
  }

  // Persönlichkeit: Treue, Ehrgeiz und Geld färben jeden Wechsel.
  if (!isHeart && hasTrait(s, "loyal") && tenure > 0 && tenure < 3) {
    adjust(s, { morale: -10, mentality: -5 });
    setFanValue(s, oldId, fanValue(s, oldId) - 15);
    consequence += ` Nach nur ${tenure} ${tenure === 1 ? "Saison" : "Saisons"} bei ${oldClub.name} gehst du schon wieder – ausgerechnet du, der sich als treue Seele sieht. Das Gewissen spielt ab jetzt mit.`;
  } else if (!isHeart && hasTrait(s, "loyal") && tenure >= 6) {
    adjust(s, { morale: -6 });
    consequence += ` Nach ${tenure} Jahren bei ${oldClub.name} ist es ein Abschied unter Tränen – auf beiden Seiten.`;
  }
  if (hasTrait(s, "ambitious") && dynamicStrength(s.world, offer.clubId) >= oldStrength + 4) {
    adjust(s, { morale: 6, form: 3 });
    consequence += " Endlich ein Schritt nach oben – genau dafür trainierst du.";
  }
  if (hasTrait(s, "greedy") && club.finances >= getClub(oldId).finances + 15) {
    adjust(s, { morale: 5, fans: -6 });
    consequence += " Das Gehalt hat bei der Entscheidung sicher nicht geschadet – das wissen auch die Fans.";
  }
  if (last) last.transferNote = `Wechsel zu ${club.name} (${leagueLabelFor(s.world, club.id)})`;
  return consequence;
}

/**
 * Alle wählbaren Options-IDs einer offenen Entscheidung – unabhängig vom Typ.
 * Wird von Tests und Automatisierung genutzt, damit niemand `options` rät.
 */
export function decisionOptionIds(pending: PendingDecision): string[] {
  switch (pending.kind) {
    case "ovr":
    case "nation":
      return pending.options.map((o) => o.id);
    case "club":
      return [...pending.offers.map((o) => o.id), ...(pending.forced ? [] : ["stay"])];
    case "comeback":
      return [...pending.offers.map((o) => o.id), "comeback-no"];
    case "retirement":
      return pending.options.map((o) => o.id);
  }

}

export function applyDecision(state: GameState, optionId: string): GameState {

  const s = clone(state);
  const pending = s.pending;
  if (!pending) return s;
  s.pending = undefined;
  const decisionSeason = s.seasonIndex;
  const rng = subRng(s.profile.seed, "apply", pending.id, optionId, s.seasonIndex);
  const last = s.seasons[s.seasons.length - 1];

  if (pending.kind === "ovr") {
    const chosen = pending.options.find((o) => o.id === optionId);
    const label = chosen?.label ?? optionId;
    const def = eventById(pending.id);
    const option = def?.options.find((o) => o.id === optionId);
    if (def && option) {
      const result = option.apply(s, rng);
      if (!s.eventsSeen.includes(def.id)) s.eventsSeen.push(def.id);
      // Längere Pause, damit sich Ereignisse nicht ständig wiederholen.
      s.cooldowns[def.id] = s.seasonIndex + 6;
      s.lastConsequence = logDecision(s, def.title, option.label, result.consequence, result.deltas);
      if (last) last.decisionNote = `${def.title}: ${option.label}`;
    } else {
      s.lastConsequence = logDecision(s, pending.title, label, "Du triffst deine Wahl.", []);
    }
    applyOvrEffect(s, pending, chosen, decisionSeason);
    syncTimeline(s);
    // Eine deutlich negative Folge kann eine separate Vereinswahl erzwingen –
    // sie reiht sich vor die bereits geplanten Folgeentscheidungen.
    if (!s.queue.some((q) => q.kind === "club")) {
      const forced = buildForcedClubDecision(s, rng);
      if (forced) s.queue.unshift(forced);
    }

  } else if (pending.kind === "club") {
    s.cooldowns["club"] = s.seasonIndex + 1;
    const investor = pending.variant === "investor" ? (pending.project ?? s.investorProject) : undefined;
    if (investor) {
      /**
       * Investoren-Projekt: genau zwei Wege. Beide lassen die Übernahme in der
       * Welt bestehen; es gibt keinen OVR-Bonus, nur Geld, Rolle und Risiko.
       */
      const project = s.investorProject?.id === investor.id ? s.investorProject : investor;
      const club = getClub(project.clubId);
      if (optionId === "stay") {
        project.accepted = false;
        s.investorProject = project;
        const deltas = adjust(s, { morale: 4, relationship: 12 });
        setFanValue(s, s.player.clubId, fanValue(s, s.player.clubId) + 10);
        s.lastConsequence = logDecision(
          s,
          pending.title,
          `Absage – bei ${getClub(s.player.clubId).name} bleiben`,
          `Du sagst ${club.name} ab. Das Projekt läuft trotzdem weiter: ${project.investorName} baut dort eine Mannschaft auf – mit oder ohne dich. Diese Gelegenheit kommt nicht zurück.`,
          [...deltas, "Fanbindung +10"],
        );
        if (last) last.investorNote = `Investoren-Projekt ${club.name} abgelehnt`;
      } else {
        const offer = pending.offers[0]!;
        const consequence = applyClubMove(s, offer, rng);
        s.player.contractYears = project.contractYears;
        s.player.wage = Math.round(project.wage);
        s.player.role = project.role;
        project.accepted = true;
        project.joinedSeason = s.seasonIndex;
        s.investorProject = project;
        const wealth = s.wealth ?? { careerEarnings: 0, financiallySecure: false };
        wealth.careerEarnings += project.firstYearGuarantee;
        wealth.financiallySecure = true;
        wealth.securedSeason = s.seasonIndex;
        wealth.securedLabel = seasonLabel(s.startYear, s.seasonIndex);
        wealth.source = `${club.name} · ${project.investorName}`;
        s.wealth = wealth;
        const deltas = adjust(s, { morale: 14, reputation: 8 });
        s.lastConsequence = logDecision(
          s,
          pending.title,
          `Projekt bei ${club.name} annehmen`,
          `${consequence} Garantiert im ersten Jahr: ${formatInvestorMoney(project.firstYearGuarantee)}. Damit bist du finanziell für den Rest deines Lebens abgesichert. Dein Rating ändert das nicht – Titel musst du auf dem Platz holen.`,
          [
            ...deltas,
            `Wochengehalt ${formatInvestorMoney(project.wage)}`,
            `Vertrag ${project.contractYears} Jahre`,
          ],
        );
        if (last) last.investorNote = `Investoren-Projekt ${club.name}: unterschrieben`;
      }
    } else if (optionId === "stay") {
      const loyal = pending.variant === "stagnation";
      s.player.contractYears = loyal ? rng.int(3, 5) : rng.int(2, 4);
      /**
       * Bleiben trotz Sackgassen-Warnung ist ein echtes Treuebekenntnis und
       * wirkt deutlich stärker als ein normales Verlängern.
       */
      const deltas = adjust(
        s,
        loyal ? { morale: 8, relationship: 20, mentality: 4 } : { morale: 5, relationship: 8 },
      );
      setFanValue(s, s.player.clubId, fanValue(s, s.player.clubId) + (loyal ? 16 : 6));
      if (loyal) deltas.push("Fanbindung +16", "Treuebekenntnis");
      if (hasTrait(s, "loyal")) {
        deltas.push(...adjust(s, { morale: 6, fans: 6 }));
      } else if (hasTrait(s, "ambitious") && dynamicStrength(s.world, s.player.clubId) < s.player.ovr - 4) {
        deltas.push(...adjust(s, { morale: -6 }));
      }
      s.lastConsequence = logDecision(
        s,
        pending.title,
        `Bei ${getClub(s.player.clubId).name} bleiben`,
        loyal
          ? `Du bleibst bei ${getClub(s.player.clubId).name} – gegen den Rat von außen. Die Fans und der Verein rechnen dir diese Treue hoch an: Du bist hier jetzt einer von ihnen.`
          : `Du bleibst bei ${getClub(s.player.clubId).name} und kämpfst dort um deinen Platz.`,
        deltas,
      );
    } else {
      const offer = pending.offers.find((o) => o.id === optionId) ?? pending.offers[0]!;
      const club = getClub(offer.clubId);
      const consequence = applyClubMove(s, offer, rng);
      s.lastConsequence = logDecision(
        s,
        pending.title,
        `${offer.deal === "loan" ? "Leihe zu" : "Wechsel zu"} ${club.name}`,
        consequence,
        [`Rolle ${offer.expectedRole}`, offer.leagueLabel],
      );
    }
  } else if (pending.kind === "nation") {
    const chosen = pending.options.find((o) => o.id === optionId);
    const label = chosen?.label ?? optionId;
    const code = optionId.replace("nation:", "");
    const previous = s.national.committed;
    s.national.committed = code;
    if (pending.id === "nation-switch") s.national.locked = true;
    const country = COUNTRY_BY_CODE.get(code);
    const deltas = adjust(s, { morale: 8, reputation: previous && previous !== code ? -5 : 4 });
    s.lastConsequence = logDecision(
      s,
      pending.title,
      label,
      previous && previous !== code
        ? `Du spielst künftig für ${country?.name ?? countryName(code)}. Ein Teil der Fans versteht es, ein Teil nicht – deine Einsatzchance steigt spürbar.`
        : `Du entscheidest dich für ${country?.name ?? countryName(code)} und wirst in den Kader berufen.`,
      deltas,
    );
  } else if (pending.kind === "retirement") {
    const chosen = pending.options.find((o) => o.id === optionId);
    if (optionId === "retire-continue") {
      /**
       * Weitermachen ist immer erlaubt, solange der Körper trägt – ohne
       * Altersgrenze. Der Preis ist zusätzlicher Verschleiß.
       */
      s.player.retirementExtensions += 1;
      s.player.retireAge = s.player.age + 1;
      s.player.bodyWear = clamp(
        s.player.bodyWear + extensionWear(rng.int(2, 5), s.player.longevity),
        0,
        100,
      );
      s.retired = false;
      s.retirementCause = undefined;
      s.chunkRemaining = Math.max(1, s.chunkRemaining);
      const deltas = adjust(s, { morale: 6, mentality: 3, fitness: -3 });
      s.lastConsequence = logDecision(
        s,
        pending.title,
        chosen?.label ?? "Noch eine Saison",
        `Du hängst mit ${s.player.age} Jahren eine weitere Saison dran. Verschleiß ${Math.round(s.player.bodyWear)}/100.`,
        [...deltas, `Verlängerung ${s.player.retirementExtensions}`],
      );
      // Verein/Nationalteam folgen wie gewohnt nach der Verlängerung.
      s.queue = buildFollowUps(s, rng);
    } else {
      s.retired = true;
      s.retirementCause = "choice";
      s.chunkRemaining = 0;
      s.queue = [];
      s.lastConsequence = logDecision(
        s,
        pending.title,
        chosen?.label ?? "Jetzt aufhören",
        `Du beendest deine Karriere mit ${s.player.age} Jahren – bewusst und zu deinen Bedingungen.`,
        [],
      );
    }
  } else {
    // comeback – der Spieler wählt direkt einen der drei nahen Vereine

    const offer = pending.offers.find((o) => o.id === optionId);
    if (offer) {
      const gap = pending.years;
      s.player.age += gap;
      s.player.ovr = clamp(pending.comebackOvr, 50, 99);
      s.player.fitness = clamp(s.player.fitness - 10, 40, 100);
      // Kein Alterscap: der nächste Abwägungszeitpunkt ergibt sich rein relativ.
      s.player.retireAge = s.player.age + rng.int(1, 4);

      s.player.declineAge = Math.min(s.player.declineAge, s.player.age);
      s.retired = false;
      s.comebacks += 1;
      s.seasonIndex += gap;
      s.chunkRemaining = 0;
      s.phase = "career";
      s.player.loan = false;
      s.player.parentClubId = undefined;
      s.player.loanSeasonsLeft = 0;
      s.queue = [];
      const target = getClub(offer.clubId);
      s.player.clubId = target.id;
      s.player.contractYears = 2;
      ensureCountryWorld(s.world, target.country);
      s.lastConsequence = logDecision(
        s,
        "Comeback",
        `Comeback bei ${target.name}`,
        `Du kehrst mit ${s.player.age} Jahren zurück – bei ${target.name} (${offer.leagueLabel}). Der Körper ist langsamer, das Spielverständnis geblieben.`,
        [`OVR ${s.player.ovr}`],
      );
      return s;
    }
    s.lastConsequence = logDecision(s, "Comeback", "Es dabei belassen", "Du bleibst bei deiner Entscheidung. Die Karriere ist abgeschlossen.", []);
    s.queue = [];
    s.phase = "end";
    return s;
  }


  syncTimeline(s);

  if (s.lastConsequence) {
    s.lastConsequence.kind = s.lastConsequence.kind ?? pending.kind;
    s.lastConsequence.optionId = s.lastConsequence.optionId ?? optionId;
    s.lastConsequence.ovrAfter = s.player.ovr;
  }

  // Folgeentscheidungen derselben Saison kommen nacheinander – ohne neue Saison.
  const next = s.queue.shift();
  if (next) {
    s.pending = next;
    return s;
  }

  if (s.chunkRemaining > 0 && !s.retired) {
    return runSimulation(s);
  }
  if (s.retired) return finishCareer(s);
  return s;
}



/**
 * Simuliert ohne weiteren Klick weiter, bis die nächste Entscheidung ansteht
 * oder die Karriere endet. Ersetzt den früheren "Weiter"-Rhythmus.
 */
export function advanceToNextDecision(state: GameState, opts: AdvanceOptions = {}): GameState {
  let s = state;
  let guard = 0;
  while (guard++ < 80 && !s.pending && !s.retired && s.phase === "career") {
    const before = s.seasonIndex;
    s = simulateChunk(s, opts);
    if (s.seasonIndex === before && !s.pending) break;
  }
  return s;
}

/** Entscheidung anwenden und direkt bis zur nächsten Entscheidung weiterspielen. */
export function applyDecisionAndAdvance(state: GameState, optionId: string): GameState {
  // Die frisch erzeugte Konsequenz überlebt die automatische Weitersimulation.
  return advanceToNextDecision(applyDecision(state, optionId), { keepConsequence: true });
}

/** Vertrag unterschreiben und sofort bis zur ersten Entscheidung simulieren. */
export function signAndAdvance(state: GameState, clubId: string): GameState {
  return advanceToNextDecision(signWithClub(state, clubId));
}

/* ------------------------------------------------------------- Aggregate */

export function careerTotals(state: GameState) {
  const t = state.seasons.reduce(
    (acc, s) => {
      acc.apps += s.apps;
      acc.goals += s.goals;
      acc.assists += s.assists;
      acc.cleanSheets += s.cleanSheets;
      acc.saves += s.saves;
      acc.ratingSum += s.rating;
      acc.best = Math.max(acc.best, s.rating);
      acc.bestGoals = Math.max(acc.bestGoals, s.goals);
      return acc;
    },
    { apps: 0, goals: 0, assists: 0, cleanSheets: 0, saves: 0, ratingSum: 0, best: 0, bestGoals: 0 },
  );
  const seasons = state.seasons.length || 1;
  return {
    ...t,
    seasons: state.seasons.length,
    avgRating: Number((t.ratingSum / seasons).toFixed(2)),
    clubTrophies: state.trophies.filter((x) => x.kind === "club").length,
    nationalTrophies: state.trophies.filter((x) => x.kind === "national").length,
    awards: state.trophies.filter((x) => x.kind === "award").length,
  };
}

export function clubHistory(state: GameState): string[] {
  const ids: string[] = [];
  for (const s of state.seasons) if (!ids.includes(s.clubId)) ids.push(s.clubId);
  return ids;
}

export { leagueLabelFor, dynamicDivision, dynamicStrength };
