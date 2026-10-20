import type { GameState, PlayerState, Profile } from "./types";
import { STATE_VERSION } from "./engine";
import { getClub } from "./data";
import { emptyWorld, ensureCountryWorld } from "./world";
import { randomSeed } from "./rng";
import { derivedBodyWear } from "./body";


const KEY = "legendenweg:state:v3";

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/**
 * Migriert ältere Spielstände (v4–v8 -> v9). Club-IDs sind stabil
 * (COUNTRY-DIVISION-INDEX), daher behalten laufende Karrieren ihre realen
 * Vereinsnamen. Fehlende Felder werden robust ergänzt – nie "Unbekannter Verein".
 */
export function migrateState(parsed: Partial<GameState>): GameState | null {
  const version = typeof parsed.version === "number" ? parsed.version : 0;
  if (version < 4 || version > STATE_VERSION) return null;
  const state = { ...parsed, version: STATE_VERSION } as GameState;
  if (state.player?.clubId) state.player.clubId = getClub(state.player.clubId).id;
  if (state.heartClub) state.heartClub = getClub(state.heartClub).id;
  for (const season of state.seasons) {
    if (season.clubId) season.clubId = getClub(season.clubId).id;
    if (season.parentClubId) season.parentClubId = getClub(season.parentClubId).id;
  }
  for (const offer of state.offers ?? []) offer.clubId = getClub(offer.clubId).id;
  for (const trophy of state.trophies ?? []) {
    if (trophy.clubId) trophy.clubId = getClub(trophy.clubId).id;
  }

  // v6: Spielerzustand, Fanbindung, Cooldowns, dynamische Clubwelt
  const p = state.player as Partial<PlayerState> & PlayerState;
  p.mentality = num(p.mentality, 55);
  p.role = p.role ?? "Stammspieler";
  p.playtimeModifier = num(p.playtimeModifier, 1);
  p.injuryProneness = num(p.injuryProneness, 0) || num(p.injuryRisk, 0) || 15;
  p.monthsOut = num(p.monthsOut, 0);
  p.majorInjuries = num(p.majorInjuries, 0);
  p.archetype = p.archetype ?? "normal";
  p.longevity = num(p.longevity, 0.3);
  state.fanRelations = state.fanRelations ?? {};
  state.cooldowns = state.cooldowns ?? {};
  state.world = state.world && state.world.countries ? state.world : emptyWorld();
  if (state.player?.clubId) ensureCountryWorld(state.world, getClub(state.player.clubId).country);

  // v8: getrennte Leihdaten und Entscheidungstypen
  p.loan = p.loan === true;
  p.loanSeasonsLeft = num(p.loanSeasonsLeft, p.loan ? 1 : 0);
  if (p.parentClubId) p.parentClubId = getClub(p.parentClubId).id;
  if (!p.loan) {
    p.parentClubId = undefined;
    p.loanSeasonsLeft = 0;
  }

  // v9/v10: Entscheidungs-Warteschlange (Folgeentscheidungen derselben Saison).
  // Ältere Stände kennen keine Queue, neuere behalten alle gültigen Einträge.
  // v11: Pechsträhnen-Zähler und Club-Impact
  state.gambleLossStreak = num(state.gambleLossStreak, 0);
  state.clubImpact = state.clubImpact && typeof state.clubImpact === "object" ? state.clubImpact : {};

  /**
   * v13: Körperverschleiß statt Alterslimit. Alte Stände haben kein bodyWear –
   * es wird aus Alter, schweren Verletzungen und Anfälligkeit plausibel
   * abgeleitet, damit laufende Karrieren nicht plötzlich unverwundbar sind.
   */
  p.bodyWear =
    typeof p.bodyWear === "number" && Number.isFinite(p.bodyWear)
      ? Math.max(0, Math.min(100, p.bodyWear))
      : derivedBodyWear(num(p.age, 20), num(p.majorInjuries, 0), num(p.injuryProneness, 15));
  p.retirementExtensions = num(p.retirementExtensions, 0);

  /**
   * v14: Investoren-Projekt und dauerhafte finanzielle Lage. Alte Stände haben
   * beides nicht – die einmalige Gelegenheit bleibt für sie also offen.
   */
  state.investorOffered = state.investorOffered === true || Boolean(state.investorProject);
  if (state.investorProject?.clubId) {
    state.investorProject.clubId = getClub(state.investorProject.clubId).id;
    if (!Array.isArray(state.investorProject.stars)) state.investorProject.stars = [];
  } else {
    state.investorProject = undefined;
  }
  state.wealth = state.wealth
    ? {
        ...state.wealth,
        careerEarnings: num(state.wealth.careerEarnings, 0),
        financiallySecure: state.wealth.financiallySecure === true,
      }
    : undefined;

  state.queue = version >= 9 && Array.isArray(state.queue) ? state.queue.filter(isValidPending) : [];


  // Eine alte, unpassende pending-Entscheidung wird verworfen; die Karriere bleibt.
  if (state.pending && !isValidPending(state.pending)) state.pending = undefined;
  return state;
}

/** Validiert einen Eintrag der discriminated union – ungültige werden einzeln verworfen. */
function isValidPending(entry: unknown): entry is GameState["pending"] & object {
  const pending = entry as { kind?: string } | undefined;
  if (!pending || typeof pending !== "object") return false;
  if (pending.kind === "ovr") {
    const options = (pending as { options?: unknown[] }).options;
    if (!Array.isArray(options) || options.length !== 2) return false;
    const types = options.map((o) => (o as { id?: unknown; ovrEffect?: { type?: string } })?.ovrEffect?.type);
    const ids = options.map((o) => (o as { id?: unknown }).id);
    if (!ids.every((id) => typeof id === "string")) return false;
    return types.filter((t) => t === "gamble").length === 1 && types.filter((t) => t === "neutral").length === 1;
  }
  if (pending.kind === "club") {
    const club = pending as { offers?: unknown[]; variant?: string; project?: { clubId?: unknown } };
    const offers = club.offers;
    if (!Array.isArray(offers)) return false;
    const clubIds = offers.map((o) => (o as { clubId?: unknown }).clubId);
    if (!clubIds.every((id) => typeof id === "string")) return false;
    // v14: Das Investoren-Fenster hat bewusst genau EIN Projektangebot.
    if (club.variant === "investor") {
      return offers.length === 1 && typeof club.project?.clubId === "string";
    }
    if (offers.length !== 3) return false;
    return new Set(clubIds).size === 3;
  }
  if (pending.kind === "nation") {
    const options = (pending as { options?: unknown[] }).options;
    return Array.isArray(options) && options.length === 2;
  }
  // v13: „Noch ein Jahr?“ – genau zwei Optionen mit stabilen IDs.
  if (pending.kind === "retirement") {
    const options = (pending as { options?: unknown[] }).options;
    if (!Array.isArray(options) || options.length !== 2) return false;
    const ids = options.map((o) => (o as { id?: unknown }).id);
    return ids.includes("retire-continue") && ids.includes("retire-stop");
  }
  if (pending.kind === "comeback") {
    const p = pending as { years?: unknown; comebackOvr?: unknown; offers?: unknown[] };
    return typeof p.years === "number" && typeof p.comebackOvr === "number" && Array.isArray(p.offers) && p.offers.length === 3;
  }
  return false;
}





export function loadState(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (!parsed || !parsed.profile || !parsed.player || !Array.isArray(parsed.seasons)) return null;
    return migrateState(parsed);
  } catch {
    return null;
  }
}


export function saveState(state: GameState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Speicher voll oder gesperrt – Spiel läuft im Speicher weiter */
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignorieren */
  }
}


/* --------------------------------------------------------- Spielerprofile */

/**
 * Spielerprofile liegen in einem eigenen, versionierten Envelope und sind
 * strikt vom Spielstand-Key getrennt. Fehler werden nie still verschluckt,
 * sondern als sprechende Meldung zurückgegeben.
 */
const PROFILE_KEY = "legendenweg:profiles:v1";
export const PROFILES_VERSION = 1;
/** Mehr Profile speichern wir bewusst nicht – die Liste bleibt überschaubar. */
export const MAX_PROFILES = 12;

export interface StoredProfile {
  id: string;
  createdAt: number;
  updatedAt: number;
  profile: Profile;
}

export interface ProfilesEnvelope {
  version: number;
  profiles: StoredProfile[];
}

export interface ProfilesResult {
  profiles: StoredProfile[];
  /** Freundliche Fehlermeldung für die Inline-Anzeige im Setup. */
  error?: string | undefined;
}

const ERR_READ = "Gespeicherte Profile konnten nicht gelesen werden – die Daten waren beschädigt.";
const ERR_WRITE = "Profil konnte nicht gespeichert werden – der Browser-Speicher ist voll oder gesperrt.";
const ERR_NO_STORAGE = "Dieser Browser erlaubt kein lokales Speichern – Profile bleiben nur in dieser Sitzung.";
const ERR_INVALID = "Die Profildaten sind unvollständig und wurden nicht gespeichert.";

function storage(): Storage | null {
  try {
    const g = globalThis as { localStorage?: Storage };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

const str = (v: unknown, min = 1) => typeof v === "string" && v.trim().length >= min;

/** Strenge Schemaprüfung – nur vollständige Profile werden übernommen. */
export function isValidStoredProfile(entry: unknown): entry is StoredProfile {
  const e = entry as StoredProfile | undefined;
  if (!e || typeof e !== "object") return false;
  if (!str(e.id)) return false;
  const p = e.profile as Profile | undefined;
  if (!p || typeof p !== "object") return false;
  return (
    str(p.name, 2) &&
    str(p.birthDate) &&
    typeof p.height === "number" &&
    Number.isFinite(p.height) &&
    typeof p.weight === "number" &&
    Number.isFinite(p.weight) &&
    str(p.nat1) &&
    str(p.pos) &&
    str(p.avatar) &&
    typeof p.pace === "number" &&
    typeof p.seed === "number" &&
    Number.isFinite(p.seed) &&
    p.seed > 0
  );
}

function normalize(entry: StoredProfile): StoredProfile {
  const now = Date.now();
  return {
    ...entry,
    createdAt: typeof entry.createdAt === "number" ? entry.createdAt : now,
    updatedAt:
      typeof entry.updatedAt === "number"
        ? entry.updatedAt
        : typeof (entry as unknown as { savedAt?: number }).savedAt === "number"
          ? (entry as unknown as { savedAt: number }).savedAt
          : now,
  };
}

/** Liest alle Profile; migriert das alte reine Array-Format mit. */
export function loadProfiles(): ProfilesResult {
  const store = storage();
  if (!store) return { profiles: [] };
  let raw: string | null;
  try {
    raw = store.getItem(PROFILE_KEY);
  } catch {
    return { profiles: [], error: ERR_READ };
  }
  if (!raw) return { profiles: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { profiles: [], error: ERR_READ };
  }
  const list = Array.isArray(parsed)
    ? parsed // altes Format: reines Array
    : (parsed as ProfilesEnvelope | null)?.profiles;
  if (!Array.isArray(list)) return { profiles: [], error: ERR_READ };
  const valid = list.filter(isValidStoredProfile).map(normalize).slice(0, MAX_PROFILES);
  const partial = valid.length !== list.length;
  return { profiles: valid, ...(partial ? { error: ERR_READ } : {}) };
}

function writeProfiles(list: StoredProfile[], carry?: string | undefined): ProfilesResult {
  const store = storage();
  if (!store) return { profiles: list, error: ERR_NO_STORAGE };
  try {
    store.setItem(PROFILE_KEY, JSON.stringify({ version: PROFILES_VERSION, profiles: list } satisfies ProfilesEnvelope));
  } catch {
    return { profiles: list, error: ERR_WRITE };
  }
  return { profiles: list, ...(carry ? { error: carry } : {}) };
}

/** Erzeugt eine stabile, kollisionsarme Profil-ID. */
export function newProfileId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Speichert ein Profil. Ohne `id` entsteht ein neuer Eintrag mit stabiler ID,
 * mit `id` wird der vorhandene Eintrag unter derselben ID aktualisiert.
 */
export function saveProfile(profile: Profile, id?: string | undefined): ProfilesResult {
  const now = Date.now();
  const candidate: StoredProfile = {
    id: id ?? newProfileId(),
    createdAt: now,
    updatedAt: now,
    profile,
  };
  if (!isValidStoredProfile(candidate)) {
    const current = loadProfiles();
    return { profiles: current.profiles, error: ERR_INVALID };
  }
  const { profiles, error } = loadProfiles();
  const index = id ? profiles.findIndex((e) => e.id === id) : -1;
  let next: StoredProfile[];
  if (index >= 0) {
    const existing = profiles[index]!;
    next = [...profiles];
    next[index] = { ...candidate, createdAt: existing.createdAt, updatedAt: now };
  } else {
    if (profiles.length >= MAX_PROFILES) {
      return { profiles, error: `Es sind maximal ${MAX_PROFILES} Profile möglich. Bitte lösche zuerst ein Profil.` };
    }
    next = [candidate, ...profiles];
  }
  return writeProfiles(next, error);
}

export function deleteProfile(id: string): ProfilesResult {
  const { profiles, error } = loadProfiles();
  return writeProfiles(
    profiles.filter((e) => e.id !== id),
    error,
  );
}

/**
 * Ein geladenes Profil startet immer mit einem frischen, positiven Seed –
 * damit ein erneuter Start desselben Profils eine andere Karriere erzeugt.
 */
export function profileForEditing(entry: StoredProfile): Profile {
  return { ...entry.profile, seed: randomSeed() };
}

