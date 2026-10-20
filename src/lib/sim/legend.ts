/**
 * Globaler Legendenstatus – bewusst getrennt vom vereinsbezogenen Fanstatus.
 *
 * Reines, testbares Modul: alle Funktionen leiten sich ausschließlich aus dem
 * Spielstand ab und erfinden niemals Erfolge. Titellose Karrieren erhalten
 * ehrliche, nicht beschönigende Texte.
 */
import type { GameState, Position, SeasonRecord, Trophy } from "./types";
import type { Rng } from "./rng";
import { getClub, countryName } from "./data";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Ein Verein mit dieser Basisstärke oder weniger gilt als klarer Underdog. */
export const UNDERDOG_BASE_STRENGTH = 72;

const CONTINENTAL_TROPHY_IDS = new Set([
  "ucl",
  "uel",
  "uecl",
  "libertadores",
  "sudamericana",
  "concacaf-cc",
  "acl-elite",
  "acl-two",
  "caf-cl",
  "caf-confed",
  "ofc-cl",
  "fifa-cwc",
]);

/** Die wirklich großen individuellen Auszeichnungen. */
const MAJOR_AWARD_IDS = new Set(["ballon-dor", "world-player", "player-of-the-year"]);

export function isContinentalTrophy(t: Trophy): boolean {
  return Boolean(t.refId && CONTINENTAL_TROPHY_IDS.has(t.refId));
}

export function isLeagueTitle(t: Trophy): boolean {
  return Boolean(t.refId?.startsWith("league-"));
}

export function isCupTitle(t: Trophy): boolean {
  return Boolean(t.refId?.startsWith("cup-"));
}

/** true = der Titel wurde mit einem ursprünglich klar schwachen Verein geholt. */
export function isUnderdogTrophy(t: Trophy): boolean {
  if (t.kind !== "club" || !t.clubId) return false;
  return getClub(t.clubId).strength <= UNDERDOG_BASE_STRENGTH;
}

/* ------------------------------------------------------------ Stufenmodell */

export interface LegendTierDef {
  key: "profi" | "star" | "ikone" | "legende" | "unsterblich";
  name: string;
  min: number;
  blurb: string;
}

export const LEGEND_TIERS: LegendTierDef[] = [
  { key: "profi", name: "Profi", min: 0, blurb: "Eine Karriere im Profifußball." },
  { key: "star", name: "Star", min: 150, blurb: "Ein Name, den die Liga kennt." },
  { key: "ikone", name: "Ikone", min: 320, blurb: "Ein Gesicht seiner Ära." },
  { key: "legende", name: "Legende", min: 560, blurb: "Eine Karriere, über die man in Jahrzehnten spricht." },
  { key: "unsterblich", name: "Unsterblich", min: 850, blurb: "Ein Platz in der Geschichte des Spiels." },
];

export function legendTier(score: number): LegendTierDef {
  let tier = LEGEND_TIERS[0]!;
  for (const t of LEGEND_TIERS) if (score >= t.min) tier = t;
  return tier;
}

/* --------------------------------------------------------------- Score */

export interface LegendBreakdown {
  peak: number;
  longevity: number;
  clubTitles: number;
  multiClub: number;
  awards: number;
  national: number;
  underdog: number;
  moments: number;
}

/** Nachvollziehbare Einzelbeiträge des globalen Legendenscores. */
export function legendBreakdown(state: GameState): LegendBreakdown {
  const trophies = state.trophies;
  const peakOvr = Math.max(state.peakOvr, state.player.ovr);

  const peak = Math.max(0, peakOvr - 70) * 4;

  const eliteSeasons = state.seasons.filter((s) => s.endOvr >= 85).length;
  const worldClassSeasons = state.seasons.filter((s) => s.endOvr >= 90).length;
  const longevity = eliteSeasons * 7 + worldClassSeasons * 5;

  const club = trophies.filter((t) => t.kind === "club");
  const clubTitles = club.length * 8;

  const titleClubs = new Set(club.map((t) => t.clubId).filter(Boolean) as string[]);
  const multiClub = Math.max(0, titleClubs.size - 1) * 30;

  let awards = 0;
  for (const t of trophies.filter((x) => x.kind === "award")) {
    awards += 20;
    if (t.refId && MAJOR_AWARD_IDS.has(t.refId)) awards += 35;
  }

  let national = 0;
  for (const t of trophies.filter((x) => x.kind === "national")) {
    national += 45;
    if (t.refId === "fifa-wc") national += 95;
  }

  let underdog = 0;
  for (const t of club) {
    if (!isUnderdogTrophy(t)) continue;
    if (isContinentalTrophy(t)) underdog += 95;
    else if (isLeagueTitle(t)) underdog += 55;
    else if (isCupTitle(t)) underdog += 40;
    else underdog += 30;
  }

  const moments = state.seasons.filter((s) => s.legendMoment).length * 70;

  return { peak, longevity, clubTitles, multiClub, awards, national, underdog, moments };
}

export function legendScore(state: GameState): number {
  const b = legendBreakdown(state);
  return Math.round(b.peak + b.longevity + b.clubTitles + b.multiClub + b.awards + b.national + b.underdog + b.moments);
}

export interface LegendStatus {
  score: number;
  tier: LegendTierDef;
  /** Nächste Stufe, falls es eine gibt. */
  next?: LegendTierDef | undefined;
  /** Fortschritt zur nächsten Stufe 0..1 (1 = höchste Stufe erreicht). */
  progress: number;
  /** Fehlende Punkte bis zur nächsten Stufe. */
  toNext: number;
}

export function legendStatus(state: GameState): LegendStatus {
  const score = legendScore(state);
  const tier = legendTier(score);
  const index = LEGEND_TIERS.findIndex((t) => t.key === tier.key);
  const next = LEGEND_TIERS[index + 1];
  if (!next) return { score, tier, next: undefined, progress: 1, toNext: 0 };
  const span = Math.max(1, next.min - tier.min);
  return {
    score,
    tier,
    next,
    progress: clamp((score - tier.min) / span, 0, 1),
    toNext: Math.max(0, next.min - score),
  };
}

/* ------------------------------------------------- Legendäre Finalszene */

type PosGroup = "keeper" | "defense" | "midfield" | "attack";

export function positionGroup(pos: Position): PosGroup {
  if (pos === "TW") return "keeper";
  if (pos === "IV" || pos === "LV" || pos === "RV" || pos === "ZDM") return "defense";
  if (pos === "ZM" || pos === "LM" || pos === "RM") return "midfield";
  if (pos === "ZOM") return "midfield";
  return "attack";
}

export interface LegendMomentInput {
  pos: Position;
  tournament: string;
  year: number;
  nationName: string;
  playerName: string;
}

/**
 * Konkrete, positionsgerechte Finalszene. Wird ausschließlich erzeugt, wenn der
 * Spieler beim gewonnenen Turnier tatsächlich beteiligt war, und nennt immer
 * Turnier und Jahr.
 */
export function buildLegendMoment(rng: Rng, input: LegendMomentInput): string {
  const { tournament, year, nationName } = input;
  const head = `${tournament} ${year}`;
  switch (positionGroup(input.pos)) {
    case "keeper":
      return rng.pick([
        `${head}: Im Finale hältst du in der 89. Minute den Elfmeter, der ${nationName} den Titel sichert – und wirst zur Legende einer ganzen Generation.`,
        `${head}: Zwei Paraden im Elfmeterschießen des Finales, beide mit dem starken Fuß abgeklärt. ${nationName} feiert den Titel mit deinem Namen auf den Lippen.`,
        `${head}: Deine Reflexparade in der Nachspielzeit des Finales rettet ${nationName} den Titel – die Bilder laufen heute noch.`,
      ]);
    case "defense":
      return rng.pick([
        `${head}: Im Finale grätschst du den Ball in der letzten Minute vor der leeren Torlinie weg und sicherst ${nationName} den Titel.`,
        `${head}: Du nimmst den gefährlichsten Stürmer des Turniers im Finale komplett aus dem Spiel – kein Torschuss, ein Titel für ${nationName}.`,
        `${head}: Deine Kopfballklärung in der Nachspielzeit des Finales wird zum Bild des Turniers. ${nationName} ist Champion.`,
      ]);
    case "midfield":
      return rng.pick([
        `${head}: Du kontrollierst das Finale über 120 Minuten und legst das entscheidende Tor mit einem Pass in die Tiefe auf. ${nationName} gewinnt.`,
        `${head}: Dein Assist in der Verlängerung des Finales entscheidet das Turnier für ${nationName} – der Pass gilt bis heute als perfekt.`,
        `${head}: Im Finale gehen 96 deiner Pässe an, du führst ${nationName} als Taktgeber zum Titel.`,
      ]);
    default:
      return rng.pick([
        `${head}: Dein Tor in der 88. Minute des Finales entscheidet das Turnier – ${nationName} ist Champion.`,
        `${head}: Du triffst im Finale doppelt und holst ${nationName} den Titel; der zweite Treffer fällt aus der Drehung.`,
        `${head}: In der Verlängerung des Finales köpfst du ${nationName} zum Titel – ein Moment, den ein ganzes Land auswendig kennt.`,
      ]);
  }
}

/* ---------------------------------------------------------- Highlights */

/**
 * 3–6 wichtigste Momente. Auch eine titelarme Karriere erhält ehrliche,
 * belegbare Zeilen – nie erfundene Erfolge.
 */
export function legendHighlights(state: GameState): string[] {
  const out: string[] = [];
  const peakOvr = Math.max(state.peakOvr, state.player.ovr);

  for (const s of state.seasons) {
    if (s.legendMoment) out.push(s.legendMoment);
  }

  for (const t of state.trophies.filter((x) => x.kind === "national")) {
    const line = `${t.name} ${t.season}${t.country ? ` mit ${countryName(t.country)}` : ""}.`;
    if (!out.some((x) => x.includes(`${t.name} ${t.season}`))) out.push(line);
  }

  for (const t of state.trophies.filter((x) => x.kind === "club" && isUnderdogTrophy(x))) {
    out.push(
      `${t.name} ${t.season} mit ${t.clubId ? getClub(t.clubId).name : "deinem Verein"} – als klarer Außenseiter.`,
    );
  }

  for (const t of state.trophies.filter((x) => x.kind === "award" && x.refId && MAJOR_AWARD_IDS.has(x.refId))) {
    out.push(`${t.name} ${t.season} – die höchste individuelle Auszeichnung deiner Ära.`);
  }

  for (const t of state.trophies.filter((x) => x.kind === "club" && isContinentalTrophy(x) && !isUnderdogTrophy(x))) {
    out.push(`${t.name} ${t.season} mit ${t.clubId ? getClub(t.clubId).name : "deinem Verein"}.`);
  }

  if (out.length < 6) {
    const best = [...state.seasons].sort((a, b) => b.rating - a.rating)[0];
    if (best) {
      out.push(
        `Beste Saison ${best.seasonLabel} bei ${getClub(best.clubId).name}: Note ${best.rating} in ${best.apps} Einsätzen.`,
      );
    }
  }
  if (out.length < 6) out.push(`Höchstes Rating der Karriere: ${peakOvr} OVR.`);
  if (out.length < 6 && state.national.caps > 0) {
    out.push(
      `${state.national.caps} Länderspiele${state.national.committed ? ` für ${countryName(state.national.committed)}` : ""}.`,
    );
  }
  if (out.length < 6) {
    const apps = state.seasons.reduce((a, s) => a + s.apps, 0);
    out.push(`${apps} Pflichtspiele in ${state.seasons.length} Profisaisons.`);
  }
  return out.slice(0, 6);
}

/* ----------------------------------------------------------- Narrative */

function biggestTrophy(state: GameState): Trophy | undefined {
  const rank = (t: Trophy): number => {
    if (t.kind === "national") return t.refId === "fifa-wc" ? 100 : 80;
    if (t.kind === "award" && t.refId && MAJOR_AWARD_IDS.has(t.refId)) return 70;
    if (isContinentalTrophy(t)) return 60;
    if (isLeagueTitle(t)) return 40;
    if (isCupTitle(t)) return 30;
    return 10;
  };
  return [...state.trophies].sort((a, b) => rank(b) - rank(a) || a.season - b.season)[0];
}

/** Vereine nach Anzahl Saisons – die prägenden Stationen zuerst. */
export function mainClubs(state: GameState): Array<{ clubId: string; seasons: number }> {
  const counts = new Map<string, number>();
  for (const s of state.seasons) counts.set(s.clubId, (counts.get(s.clubId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([clubId, seasons]) => ({ clubId, seasons }))
    .sort((a, b) => b.seasons - a.seasons);
}

/**
 * Deterministische deutsche Karriere-Zusammenfassung in 1–3 Absätzen.
 * Nutzt ausschließlich echte Werte aus dem Spielstand.
 */
export function careerNarrative(state: GameState): string[] {
  const seasons = state.seasons;
  if (seasons.length === 0) {
    return [`${state.profile.name} hat noch keine Profisaison abgeschlossen.`];
  }
  const first = seasons[0]!;
  const last = seasons[seasons.length - 1]!;
  const name = state.profile.name;
  const peakOvr = Math.max(state.peakOvr, state.player.ovr);
  const peakSeason = [...seasons].sort((a, b) => b.endOvr - a.endOvr || a.index - b.index)[0]!;
  const clubs = mainClubs(state);
  const status = legendStatus(state);
  const paragraphs: string[] = [];

  /* -------- Absatz 1: Start und Weg */
  const startClub = getClub(first.clubId);
  const clubList = clubs
    .slice(0, 3)
    .map((c) => `${getClub(c.clubId).name} (${c.seasons} ${c.seasons === 1 ? "Saison" : "Saisons"})`)
    .join(", ");
  paragraphs.push(
    `${name} begann ${first.seasonLabel} mit ${first.age} Jahren bei ${startClub.name} und beendete die Karriere ` +
      `${last.seasonLabel} mit ${last.age} Jahren bei ${getClub(last.clubId).name}. ` +
      `In ${seasons.length} ${seasons.length === 1 ? "Profisaison" : "Profisaisons"} prägten ihn vor allem ${clubList}. ` +
      `Das höchste Rating erreichte er ${peakSeason.seasonLabel} mit ${peakOvr} OVR.`,
  );

  /* -------- Absatz 2: Titel, Underdog- und Nationalmoment (nur belegte Fakten) */
  const clubTitles = state.trophies.filter((t) => t.kind === "club");
  const nationalTitles = state.trophies.filter((t) => t.kind === "national");
  const awards = state.trophies.filter((t) => t.kind === "award");
  const underdogs = clubTitles.filter(isUnderdogTrophy);
  const big = biggestTrophy(state);
  const moment = seasons.find((s) => s.legendMoment)?.legendMoment;

  if (state.trophies.length === 0) {
    const apps = seasons.reduce((a, s) => a + s.apps, 0);
    const avg = (seasons.reduce((a, s) => a + s.rating, 0) / seasons.length).toFixed(2);
    paragraphs.push(
      `Titel blieben aus. Was bleibt, sind ${apps} Pflichtspiele, eine Durchschnittsnote von ${avg} und eine Karriere, ` +
        `die ohne Trophäe erzählt werden muss – die aber stattgefunden hat, Saison für Saison.`,
    );
  } else {
    const parts: string[] = [];
    if (big) {
      parts.push(
        `Der größte Erfolg war ${big.name} ${big.season}${big.clubId ? ` mit ${getClub(big.clubId).name}` : ""}`,
      );
    }
    if (clubTitles.length) parts.push(`insgesamt ${clubTitles.length} Vereinstitel`);
    if (nationalTitles.length) parts.push(`${nationalTitles.length} Titel mit der Nationalmannschaft`);
    if (awards.length) parts.push(`${awards.length} individuelle Auszeichnungen`);
    let text = `${parts.join(", ")}.`;
    if (underdogs.length) {
      const u = underdogs[0]!;
      text += ` Besonders in Erinnerung bleibt ${u.name} ${u.season} mit ${u.clubId ? getClub(u.clubId).name : "einem Außenseiter"} – ein Verein, dem das niemand zugetraut hatte.`;
    }
    if (moment) text += ` ${moment}`;
    paragraphs.push(text);
  }

  /* -------- Absatz 3: Ende, Langlebigkeit, Status */
  const causeText =
    state.retirementCause === "body"
      ? `Am Ende gab der Körper das Urteil ab: Nach ${last.age} Jahren war keine weitere Saison mehr möglich.`
      : state.player.retirementExtensions > 0
        ? `${state.player.retirementExtensions === 1 ? "Eine Saison" : `${state.player.retirementExtensions} Saisons`} hängte er freiwillig an, bevor er mit ${last.age} Jahren aufhörte.`
        : `Mit ${last.age} Jahren beendete er seine Laufbahn aus eigener Entscheidung.`;
  paragraphs.push(
    `${causeText} ${state.comebacks > 0 ? `Nach einem Comeback kehrte er noch einmal auf den Platz zurück. ` : ""}` +
      `Global gilt ${name} damit als ${status.tier.name} – ${status.tier.blurb} (Legendenscore ${status.score}).`,
  );

  return paragraphs;
}

/* -------------------------------------------------- Endscreen-Jahreszeilen */

export interface SeasonExportRow {
  seasonLabel: string;
  age: number;
  clubName: string;
  leagueLabel: string;
  apps: number;
  /** Feldspieler: "12/7"; Torhüter: "14 ZN / 96 P". */
  output: string;
  tablePosition: string;
  honours: string;
  ovr: string;
  flags: string;
  note: string;
}

/**
 * Genau eine Zeile je absolvierter Saison – Grundlage der vollständigen
 * Saisonliste im Endscreen und im PNG-Export.
 */
export function careerSeasonRows(state: GameState): SeasonExportRow[] {
  const isGk = state.profile.pos === "TW";
  return state.seasons.map((s: SeasonRecord) => {
    const flags: string[] = [];
    if (s.loan) flags.push("Leihe");
    if (s.promoted) flags.push("Aufstieg");
    if (s.relegated) flags.push("Abstieg");
    if (s.missedSeason) flags.push("Saison verpasst");
    const honours = s.trophies.map((t) => t.name).join(", ");
    const note =
      s.legendMoment ??
      s.clubImpactNote ??
      s.transferNote ??
      s.continental ??
      s.qualification ??
      s.injuries[0] ??
      s.nationalNote ??
      "";
    return {
      seasonLabel: s.seasonLabel,
      age: s.age,
      clubName: getClub(s.clubId).name,
      leagueLabel: s.leagueLabel,
      apps: s.apps,
      output: isGk
        ? `${s.cleanSheets} Zu-null · ${s.saves} Paraden`
        : `${s.goals} Tore · ${s.assists} Assists`,
      tablePosition: s.tablePosition > 0 ? `${s.tablePosition}.` : "–",
      honours: honours || "–",
      ovr: `${s.startOvr} → ${s.endOvr}`,
      flags: flags.join(" · ") || "–",
      note,
    };
  });
}
