/**
 * Investoren-Projekt („Anzhi-Moment“).
 *
 * Sehr selten übernimmt ein Investor irgendwo auf der Welt einen Verein, der
 * bislang NICHT zur Elite gehört: Stadionneubau, moderne Infrastruktur, bereits
 * verpflichtete Weltstars und ein Gehalt, das eine Karriere finanziell
 * abschließt. Der Spieler bekommt dort eine zentrale Rolle angeboten.
 *
 * Wichtige Regeln dieses Moduls:
 * - Alles ist deterministisch aus Seed + Saisonindex abgeleitet (kein Reroll
 *   nach Reload).
 * - Die Übernahme passiert in der Spielwelt UNABHÄNGIG davon, ob der Spieler
 *   annimmt. Ablehnen verbraucht die einmalige Gelegenheit.
 * - Es gibt keinen OVR-Bonus und keine garantierten Titel – nur eine echte
 *   Clubstärke im Bereich 80–87 und sehr viel Geld.
 *
 * Das Modul kennt bewusst keine engine.ts (keine Zyklen).
 */

import type {
  Club,
  ClubOffer,
  GameState,
  InvestorProject,
  InvestorStar,
  PendingClubDecision,
  Position,
} from "./types";
import type { Rng } from "./rng";
import { traitWeight } from "./personality";
import { COUNTRY_BY_CODE, COUNTRIES, clubsOf, countryName, getClub } from "./data";
import {
  adjustClubStrength,
  dynamicDivision,
  dynamicStrength,
  ensureCountryWorld,
  leagueLabelFor,
  profileOf,
} from "./world";

/** Unter diesem OVR gibt es NIE ein Investorenprojekt. */
export const INVESTOR_MIN_OVR = 80;
export const INVESTOR_MIN_AGE = 20;
export const INVESTOR_MAX_AGE = 35;
/** Zielkorridor der neuen Clubstärke – niemals darüber. */
export const INVESTOR_STRENGTH_MIN = 80;
export const INVESTOR_STRENGTH_MAX = 87;
/** Ein Verein gilt bis zu dieser Stärke als „nicht Elite“. */
export const INVESTOR_TARGET_MAX_STRENGTH = 77;

/**
 * Mit dem OVR steigende Chance pro Saison. Bewusst spürbar: wer 80+ erreicht,
 * bekommt das (einmalige) Angebot meist irgendwann in der Karriere.
 */
export function investorChance(ovr: number): number {
  if (ovr < INVESTOR_MIN_OVR) return 0;
  if (ovr >= 90) return 0.3;
  if (ovr >= 85) return 0.22;
  return 0.15;
}

/**
 * Grundvoraussetzungen. Vorrangige Fenster (Leihrückkehr, Sackgasse, Zwang)
 * prüft der Aufrufer – dieses Modul weiß nichts davon.
 */
export function investorEligible(state: GameState): boolean {
  const p = state.player;
  if (state.investorOffered) return false;
  if (state.retired) return false;
  if (p.ovr < INVESTOR_MIN_OVR) return false;
  if (p.age < INVESTOR_MIN_AGE || p.age > INVESTOR_MAX_AGE) return false;
  // Aus einer laufenden Leihe heraus gibt es kein Projekt.
  if (p.loan || p.parentClubId) return false;
  return true;
}

/* ------------------------------------------------------------- Zielverein */

function visible(club: Club): boolean {
  const tiers = COUNTRY_BY_CODE.get(club.country)?.tiers ?? 1;
  return club.division <= tiers;
}

const ELITE_BANDS = new Set(["global-giant", "continental-elite"]);

/** Nicht-Elite: kein Gigant, keine kontinentale Spitze, moderate Stärke. */
export function isInvestorTarget(state: GameState, club: Club): boolean {
  if (club.id === state.player.clubId) return false;
  if (!visible(club)) return false;
  if (club.division > 2) return false;
  const profile = profileOf(club.id);
  if (ELITE_BANDS.has(profile.band)) return false;
  if (profile.baseStrength > INVESTOR_TARGET_MAX_STRENGTH) return false;
  if (club.strength > INVESTOR_TARGET_MAX_STRENGTH) return false;
  if (dynamicStrength(state.world, club.id) > INVESTOR_TARGET_MAX_STRENGTH + 1) return false;
  return true;
}

/** Global plausibler Zielverein – irgendwo auf der Welt, nicht nur in Europa. */
export function pickInvestorClub(state: GameState, rng: Rng): Club | null {
  const codes = rng.shuffle(COUNTRIES.map((c) => c.code));
  for (const code of codes.slice(0, 24)) {
    // Das Land muss in der dynamischen Welt existieren, bevor es bewertet wird.
    ensureCountryWorld(state.world, code);
    const pool = clubsOf(code).filter((c) => isInvestorTarget(state, c));
    if (!pool.length) continue;
    const real = pool.filter((c) => c.isReal);
    return rng.pick(real.length ? real : pool);
  }
  return null;
}

/* ------------------------------------------------------------- Weltstars */

const FIRST = [
  "Mateo", "Luan", "Diogo", "Enzo", "Yusuf", "Kwame", "Tarik", "Nikola", "Adrien", "Rafael",
  "Ibrahim", "Sota", "Elias", "Malik", "Andrés", "Marko", "Joaquín", "Noah", "Kenji", "Amine",
];
const LAST = [
  "Ferreira", "Okonkwo", "Baptiste", "Vukovic", "Moreno", "Haddad", "Silveira", "Kovacic", "Lindqvist",
  "Nakamura", "Duarte", "Traoré", "Rivas", "Petrovic", "Ozturk", "Mensah", "Castillo", "Berger",
];
const STAR_NATIONS = [
  "BR", "AR", "FR", "ENG", "ES", "PT", "NL", "DE", "IT", "BE", "HR", "SN", "MA", "JP", "US", "UY", "CO", "NG",
];
const STAR_POSITIONS: Position[] = ["TW", "IV", "ZDM", "ZM", "ZOM", "LF", "RF", "ST"];
const STAR_FROM = [
  "aus der Premier League",
  "von einem spanischen Spitzenclub",
  "aus der Serie A",
  "von einem Champions-League-Halbfinalisten",
  "aus der Bundesliga",
  "von einem Meister aus Südamerika",
];

/** 3–5 fiktive, deterministisch erzeugte Weltstars – ohne reale Spielernamen. */
export function buildInvestorStars(rng: Rng): InvestorStar[] {
  const count = rng.int(3, 5);
  const stars: InvestorStar[] = [];
  const used = new Set<string>();
  const positions = rng.shuffle(STAR_POSITIONS);
  while (stars.length < count) {
    const name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    if (used.has(name)) continue;
    used.add(name);
    stars.push({
      name,
      position: positions[stars.length % positions.length]!,
      ovr: rng.int(84, 89),
      age: rng.int(25, 32),
      nationality: rng.pick(STAR_NATIONS),
      fromLabel: rng.pick(STAR_FROM),
    });
  }
  return stars;
}

/* --------------------------------------------------------------- Paket */

/** Eigennamen, damit jede Formulierung grammatisch sauber bleibt. */
const INVESTORS = [
  "Al-Hadar Holding (Abu Dhabi)",
  "Aral Sovereign Fund (Zentralasien)",
  "Kanema Resources Group (Westafrika)",
  "Lianhe Tech Capital (Singapur)",
  "Doha Sports Holding (Katar)",
  "Yenisej Mining Trust (Sibirien)",
];

const STADIUM_AFTER = [
  "Neubau mit 62.000 Plätzen, komplett überdacht",
  "Abriss und Neubau: 55.000 Plätze, Hybridrasen, LED-Ring",
  "Neubau mit 48.000 Plätzen direkt am Stadtrand",
];
const INFRA_AFTER = [
  "neues Leistungszentrum, eigene Klinik, Reha-Abteilung auf Weltniveau",
  "Trainingscampus mit sieben Plätzen, Sportklinik, eigener Datenabteilung",
  "Nachwuchsakademie, Kryotherapie, hauseigene Analyseabteilung",
];

export function formatInvestorMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(".", ",")} Mio. €`;
  if (value >= 1000) return `${Math.round(value / 1000)} Tsd. €`;
  return `${Math.round(value)} €`;
}

/** Sauber begrenztes Geldpaket – groß, aber niemals unendlich. */
export function investorPackage(ovr: number, rng: Rng): {
  wage: number;
  signingBonus: number;
  firstYearGuarantee: number;
  contractYears: number;
} {
  const factor = 1 + Math.max(0, ovr - INVESTOR_MIN_OVR) * 0.06;
  const wage = Math.round((rng.int(900_000, 1_500_000) * factor) / 10_000) * 10_000;
  const signingBonus = Math.round((rng.int(25_000_000, 55_000_000) * factor) / 100_000) * 100_000;
  const contractYears = rng.int(3, 4);
  return { wage, signingBonus, firstYearGuarantee: wage * 52 + signingBonus, contractYears };
}

/* -------------------------------------------------------------- Projekt */

/**
 * Baut das Projekt deterministisch. Es entsteht nur, wenn ein plausibler
 * Nicht-Elite-Verein existiert.
 */
export function buildInvestorProject(
  state: GameState,
  rng: Rng,
  yearLabel: string,
): InvestorProject | null {
  const club = pickInvestorClub(state, rng);
  if (!club) return null;
  const before = Math.round(dynamicStrength(state.world, club.id));
  const after = Math.max(
    Math.min(INVESTOR_STRENGTH_MAX, before + 6),
    Math.min(INVESTOR_STRENGTH_MAX, rng.int(INVESTOR_STRENGTH_MIN, INVESTOR_STRENGTH_MAX)),
  );
  const money = investorPackage(state.player.ovr, rng);
  return {
    id: `investor-${state.seasonIndex}-${club.id}`,
    clubId: club.id,
    country: club.country,
    leagueLabel: leagueLabelFor(state.world, club.id),
    division: dynamicDivision(state.world, club.id),
    investorName: rng.pick(INVESTORS),
    startedSeason: state.seasonIndex,
    startedYearLabel: yearLabel,
    strengthBefore: before,
    strengthAfter: after,
    stadiumBefore: `gewachsenes Stadion, ${rng.int(8, 26)}.000 Plätze, Stehtraditionen`,
    stadiumAfter: rng.pick(STADIUM_AFTER),
    infrastructureBefore: "Trainingsgelände auf Zweitliganiveau, ein Physio, kein Leistungszentrum",
    infrastructureAfter: rng.pick(INFRA_AFTER),
    stars: buildInvestorStars(rng),
    role: "Leistungsträger",
    wage: money.wage,
    signingBonus: money.signingBonus,
    firstYearGuarantee: money.firstYearGuarantee,
    contractYears: money.contractYears,
    target: `${countryName(club.country)}: Meistertitel innerhalb von drei Jahren, danach kontinental angreifen – garantiert ist nichts.`,
  };
}

/**
 * Aktiviert das Projekt in der Spielwelt. Das passiert unabhängig von der
 * Entscheidung des Spielers und ist nicht stapelbar.
 */
export function activateInvestorProject(state: GameState, project: InvestorProject): void {
  const club = getClub(project.clubId);
  ensureCountryWorld(state.world, club.country);
  const current = dynamicStrength(state.world, project.clubId);
  if (project.strengthAfter > current) {
    adjustClubStrength(state.world, project.clubId, project.strengthAfter - current, project.strengthAfter);
  }
  state.investorProject = project;
  state.investorOffered = true;
}

/** Das eine Projektangebot – bewusst nur EIN Angebot plus „Bleiben“. */
export function investorOffer(project: InvestorProject): ClubOffer {
  const club = getClub(project.clubId);
  return {
    id: `transfer:${project.clubId}`,
    clubId: project.clubId,
    deal: "transfer",
    leagueLabel: project.leagueLabel,
    division: project.division,
    strength: project.strengthAfter,
    expectedRole: project.role,
    playtime: "Zentrale Rolle, gesetzt",
    reason: `${club.name} wurde von ${project.investorName} übernommen. Du sollst das Projekt anführen.`,
    country: project.country,
  };
}

/** Das komplette Investoren-Fenster: ein Projektangebot plus „Bleiben“. */
export function buildInvestorDecision(
  state: GameState,
  rng: Rng,
  yearLabel: string,
): PendingClubDecision | null {
  if (!investorEligible(state)) return null;
  // Geldorientierte Spieler hören das Telefon öfter, loyale seltener.
  const factor = traitWeight(state, { greedy: 1.6, loyal: 0.5, showman: 1.2 });
  if (!rng.chance(Math.min(0.6, investorChance(state.player.ovr) * factor))) return null;
  const project = buildInvestorProject(state, rng, yearLabel);
  if (!project) return null;
  // Die Übernahme ist ab jetzt Weltgeschichte – unabhängig von der Antwort.
  activateInvestorProject(state, project);
  const club = getClub(project.clubId);
  const current = getClub(state.player.clubId);
  return {
    kind: "club",
    id: project.id,
    title: "Ein Anruf, der alles verändert",
    intro: `${club.name} (${countryName(project.country)}, ${project.leagueLabel}) ist von ${project.investorName} übernommen worden. Budget praktisch ohne Grenze, Stadionneubau beschlossen, mehrere Weltstars haben bereits unterschrieben. Du sollst der Spieler sein, um den dieses Projekt gebaut wird – oder du bleibst bei ${current.name}.`,
    forced: false,
    variant: "investor",
    project,
    offers: [investorOffer(project)],
  };
}
