import type { TrophyVariant } from "./competitions";

export type Position =

  | "TW"
  | "IV"
  | "LV"
  | "RV"
  | "ZDM"
  | "ZM"
  | "ZOM"
  | "LM"
  | "RM"
  | "LF"
  | "RF"
  | "ST";

export const POSITIONS: Position[] = [
  "TW",
  "IV",
  "LV",
  "RV",
  "ZDM",
  "ZM",
  "ZOM",
  "LM",
  "RM",
  "LF",
  "RF",
  "ST",
];

export type Pace = 1 | 2 | 5;

export interface Club {
  id: string;
  name: string;
  country: string; // country code
  league: string;
  division: number;
  strength: number; // 50-95
  prestige: number; // 0-100
  youth: number; // 0-100
  finances: number; // 0-100
  /** Offizieller Wettbewerbsname (nur bei realen Daten). */
  officialName?: string;
  /** Staffel/Gruppe, z. B. "Nord" oder "Eastern Conference". */
  group?: string;
  /** Saison der Datengrundlage, z. B. "2026/27". */
  season?: string;
  /** "closed" = Liga ohne echten Auf-/Abstieg (z. B. MLS/USL). */
  promotionSystem?: "pyramid" | "closed";
  /** true = realer Vereinsname aus dem Datenmanifest. */
  isReal?: boolean;
  /** Herkunftsregion (nur Top-5-Verbände), z. B. "BY" oder "LDN". */
  region?: string;
  /** true = generischer regionaler Nachwuchsverein (Auffüllung). */
  regionalAcademy?: boolean;
}


export interface Profile {
  name: string;
  birthDate: string; // yyyy-mm-dd
  height: number;
  weight: number;
  nat1: string;
  nat2?: string | undefined;
  /** Pflicht-Herkunftsregion bei Top-5-Verbänden (DE/ENG/ES/IT/FR). */
  region?: string | undefined;
  pos: Position;
  pos2?: Position | undefined;
  avatar: string; // preset id "preset:3" oder data-url
  pace: Pace;
  seed: number;
}


export interface Trophy {
  id: string;
  kind: "club" | "national" | "award";
  name: string;
  season: number;
  age: number;
  clubId?: string | undefined;
  country?: string | undefined;
  description: string;
  /** Registry-ID aus competitions.ts – Basis für Icon und Duplikatschutz. */
  refId?: string | undefined;
  /** Icon-Variante aus der Registry (kein Namens-Rätselraten in der UI). */
  variant?: TrophyVariant | undefined;
}


export interface SeasonRecord {
  index: number;
  age: number;
  seasonLabel: string;
  clubId: string;
  leagueLabel: string;
  apps: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  rating: number;
  form: number;
  startOvr: number;
  endOvr: number;
  tablePosition: number;
  competitions: string[];
  trophies: Trophy[];
  injuries: string[];
  transferNote?: string | undefined;
  nationalNote?: string | undefined;
  natApps: number;
  natGoals: number;
  eventNote?: string | undefined;
  /** Notiz zum Investoren-Projekt (Übernahme, Beitritt, Ablehnung). */
  investorNote?: string | undefined;
  physicalNote?: string | undefined;
  loan: boolean;
  /** Dynamische Ligaebene dieser Saison. */
  division?: number;
  promoted?: boolean;
  relegated?: boolean;
  /** Qualifikation für die Folgesaison, z. B. "UEFA Champions League". */
  qualification?: string | undefined;
  /** Bestes europäisches/kontinentales Abschneiden dieser Saison. */
  continental?: string | undefined;
  /** Kurzmeldung aus der Fußballwelt (Meister, Pokalsieger, Überraschung). */
  worldNote?: string | undefined;
  /** Derby-, Fan- oder Beziehungsnotiz. */
  relationNote?: string | undefined;
  /** Ausfallmonate durch Verletzung. */
  monthsOut?: number;
  missedSeason?: boolean;
  decisionNote?: string | undefined;
  /** Stammverein während einer Leihsaison. */
  parentClubId?: string | undefined;
  /** Zusätzliche Entwicklung durch eine erfolgreiche Leihe (+1..+3). */
  loanBonus?: number | undefined;
  /** Notiz zur Leihe (Start, Verlauf, Rückkehr). */
  loanNote?: string | undefined;
  /**
   * Reine Saisonentwicklung (inkl. Leihbonus) VOR jeder Entscheidung.
   * Ab Alter 40 immer strikt negativ, solange der OVR über 50 liegt.
   */
  seasonalDelta?: number;
  /** OVR direkt nach der Saison, bevor eine Entscheidung wirkt. */
  preDecisionOvr?: number;
  /** Stärkeschub, den die eigene Saison dem Verein gebracht hat (+1/+2). */
  clubImpact?: number | undefined;
  /** Klartextnotiz zum Teamschub, z. B. "Deine Saison hebt das Teamniveau +1". */
  clubImpactNote?: string | undefined;
  /** Sofortwirkung auf die Tabelle in dieser Saison (0..8). */
  teamSeasonBoost?: number | undefined;
  /**
   * Konkrete, seeded legendäre Finalszene bei einem großen Nationalturnier.
   * Bleibt dauerhaft im Spielstand und erscheint im PNG-Export wieder.
   */
  legendMoment?: string | undefined;
  /** Wettbewerb/Jahr der Finalszene, z. B. "FIFA World Cup 2030". */
  legendMomentRef?: string | undefined;
}





/**
 * Riskante Option: Gewinn +1..+3 OVR, Verlust -1..-3 OVR. Der Verlust ist nie
 * größer als der mögliche Gewinn; beide Chancen werden immer angezeigt.
 */
export interface GambleEffect {
  type: "gamble";
  gain: 1 | 2 | 3;
  loss: -1 | -2 | -3;
  /** Erfolgswahrscheinlichkeit in Prozent (48–75, mit Pechsträhnen-Schutz bis 92). */
  successChance: number;
}


/** Sichere Option: garantiert 0 OVR. */
export interface NeutralEffect {
  type: "neutral";
  delta: 0;
}

export type OvrEffect = GambleEffect | NeutralEffect;

/** Option einer reinen OVR-/Lebenssituationsentscheidung. */
export interface DecisionOption {
  id: string;
  label: string;
  hint: string;
  /** Transparente OVR-Wirkung – genau eine Gamble- und eine neutrale Option je Entscheidung. */
  ovrEffect: OvrEffect;
}

/**
 * OVR-Entscheidung: verändert ausschließlich Spielerwerte. Sie wechselt niemals
 * den Verein und trägt exakt zwei Optionen ([0] Gamble, [1] neutral).
 */
export interface PendingOvrDecision {
  kind: "ovr";
  id: string;
  title: string;
  intro: string;
  options: DecisionOption[];
}

export type DealType = "transfer" | "loan";
export type PlayerRole = "Talent" | "Rotation" | "Stammspieler" | "Leistungsträger";

/** Ein konkretes Vereinsangebot – ohne jeden OVR-Gamble. */
export interface ClubOffer {
  id: string;
  clubId: string;
  deal: DealType;
  leagueLabel: string;
  division: number;
  strength: number;
  expectedRole: PlayerRole;
  playtime: string;
  reason: string;
  /** Land des Vereins (für Comeback-Angebote sichtbar). */
  country?: string | undefined;
  /**
   * Nur bei deal === "loan": Herkunft des Angebots.
   * "playtime" = klassische Spielpraxis-Leihe nach unten/seitwärts,
   * "step-up"  = ein stärkerer Verein leiht ein junges Talent aus.
   */
  loanRoute?: "playtime" | "step-up" | undefined;

}

/** Ein bereits verpflichteter Weltstar eines Investorenprojekts (fiktiv). */
export interface InvestorStar {
  name: string;
  position: Position;
  ovr: number;
  age: number;
  /** Verbandscode der Nationalität. */
  nationality: string;
  /** Woher der Star kommt, z. B. "aus der Premier League". */
  fromLabel: string;
}

/**
 * Investoren-Projekt: dauerhaftes Weltereignis. Ein bislang nicht elitärer
 * Verein wird übernommen (Stadion, Infrastruktur, Weltstars). Es existiert
 * unabhängig davon, ob der Spieler das Angebot annimmt.
 */
export interface InvestorProject {
  id: string;
  clubId: string;
  country: string;
  leagueLabel: string;
  division: number;
  investorName: string;
  /** Saisonindex der Übernahme. */
  startedSeason: number;
  startedYearLabel: string;
  strengthBefore: number;
  /** Neue Clubstärke (80–87) – kein Immunitätsbonus, keine Titelgarantie. */
  strengthAfter: number;
  stadiumBefore: string;
  stadiumAfter: string;
  infrastructureBefore: string;
  infrastructureAfter: string;
  stars: InvestorStar[];
  role: PlayerRole;
  /** Wochengehalt in €. */
  wage: number;
  signingBonus: number;
  /** Garantierte Gesamtsumme des ersten Jahres (Gehalt + Bonus). */
  firstYearGuarantee: number;
  contractYears: number;
  target: string;
  /** true = angenommen, false = abgelehnt, undefined = noch offen. */
  accepted?: boolean | undefined;
  /** Saisonindex des Beitritts (nur bei Annahme). */
  joinedSeason?: number | undefined;
}

/** Dauerhafte finanzielle Lage – wird nie zurückgesetzt. */
export interface PlayerWealth {
  /** Summe der dokumentierten Karriereeinnahmen in €. */
  careerEarnings: number;
  /** Einmal erreicht, bleibt dauerhaft true. */
  financiallySecure: boolean;
  securedSeason?: number | undefined;
  securedLabel?: string | undefined;
  source?: string | undefined;
}

/**
 * Getrennte Vereinswahl mit exakt drei unterschiedlichen Zielclubs.
 * Einzige Ausnahme: variant === "investor" – dort gibt es bewusst genau EIN
 * Projektangebot plus "Bleiben".
 */
export interface PendingClubDecision {
  kind: "club";
  id: string;
  title: string;
  intro: string;
  /** true = der Spieler muss den Verein verlassen (kein "Bleiben"). */
  forced: boolean;
  /**
   * "stagnation" = Agent/Familie rät wegen sportlicher Sackgasse zum Wechsel.
   * Das "Bleiben" wirkt dann deutlich positiv (Loyalität).
   * "investor"   = einmaliges Investoren-Projekt (ein Angebot + Bleiben).
   */
  variant?: "window" | "loan-return" | "stagnation" | "investor" | undefined;
  /** Nur bei variant === "investor" gesetzt. */
  project?: InvestorProject | undefined;
  offers: ClubOffer[];
}


export interface NationOption {
  id: string;
  code: string;
  label: string;
  hint: string;
}

export interface PendingNationDecision {
  kind: "nation";
  id: string;
  title: string;
  intro: string;
  options: NationOption[];
}

/**
 * Comeback aus dem Ruhestand: direkt drei geografisch passende Angebote plus
 * "Im Ruhestand bleiben" – ohne vorgeschaltete Ja/Nein-Frage.
 */
export interface PendingComebackDecision {
  kind: "comeback";
  id: string;
  title: string;
  intro: string;
  years: number;
  /** Reduzierter OVR, mit dem der Spieler zurückkehren würde. */
  comebackOvr: number;
  offers: ClubOffer[];
}

/** Erzählquelle der „Noch ein Jahr?“-Entscheidung. */
export type RetirementStory = "fans" | "mentor" | "ambition" | "joy";

export type RetirementOptionId = "retire-continue" | "retire-stop";

export interface RetirementOption {
  id: RetirementOptionId;
  label: string;
  hint: string;
}

/**
 * „Noch ein Jahr?“ – eigene Entscheidung nach der jährlichen OVR-Wahl.
 * Sie erscheint nur, wenn der Körper eine weitere Saison überhaupt zulässt;
 * ein körperlicher Zwangsrücktritt kennt diese Entscheidung nicht.
 */
export interface PendingRetirementDecision {
  kind: "retirement";
  id: string;
  title: string;
  intro: string;
  story: RetirementStory;
  /** Bisher freiwillig verlängerte Saisons. */
  extensions: number;
  /** Aktueller Körperverschleiß 0..100 (nur Anzeige). */
  bodyWear: number;
  options: RetirementOption[];
}

export type PendingDecision =
  | PendingOvrDecision
  | PendingClubDecision
  | PendingNationDecision
  | PendingComebackDecision
  | PendingRetirementDecision;




/** Strukturiertes Gamble-Ergebnis – die UI muss keinen Text parsen. */
export interface GambleOutcomeLog {
  outcome: "win" | "loss";
  delta: number;
  gain: number;
  loss: number;
  successChance: number;
}

export interface DecisionLog {
  age: number;
  title: string;
  choice: string;
  consequence: string;
  deltas: string[];
  /** Entscheidungstyp, damit die UI Ergebnisstreifen typgenau rendern kann. */
  kind?: PendingDecision["kind"] | undefined;
  optionId?: string | undefined;
  /** Nur bei gewählter Gamble-Option gesetzt. */
  gamble?: GambleOutcomeLog | undefined;
  /** OVR nach Anwendung der Entscheidung. */
  ovrAfter?: number | undefined;
}


export interface AcademyOffer {
  clubId: string;
  playtime: string;
  scoutText: string;
  /** Land des Vereins (ISO-/Verbandscode). */
  country?: string | undefined;
  /** Herkunftsregion des Vereins (nur Top-5-Verbände). */
  region?: string | undefined;
  /** Ausgeschriebener Regionsname für die Anzeige. */
  regionLabel?: string | undefined;
}


export interface NationalState {
  committed?: string | undefined;
  locked: boolean;
  switchOffered: boolean;
  caps: number;
  goals: number;
  majorTitles: number;
}

export type TalentArchetype = "normal" | "strong" | "elite" | "worldclass" | "generational";

export interface PlayerState {
  age: number;
  ovr: number;
  potential: number;
  form: number;
  morale: number;
  fitness: number;
  reputation: number;
  clubId: string;
  contractYears: number;
  wage: number;
  value: number;
  declineAge: number;
  /**
   * Zeitpunkt der NÄCHSTEN Ruhestandsabwägung – niemals ein hartes Limit.
   * Es gibt keine maximale Alterszahl; nur der Körper beendet Karrieren.
   */
  retireAge: number;
  /**
   * Körperverschleiß 0..100. Steigt jede Saison monoton an (Alter, Belastung,
   * Ausfälle, Anfälligkeit); gute Fitness bremst den Zuwachs, dreht ihn aber
   * nie um. Bei 100 ist die Karriere körperlich endgültig vorbei.
   */
  bodyWear: number;
  /** Anzahl freiwillig verlängerter Saisons („Noch eine Saison“). */
  retirementExtensions: number;
  loan: boolean;

  /** Stammverein, solange der Spieler verliehen ist. */
  parentClubId?: string | undefined;
  /** Verbleibende Saisons der laufenden Leihe. */
  loanSeasonsLeft: number;
  relationship: number;
  injuryRisk: number;
  /** Mentale Stabilität 0–100. */
  mentality: number;
  /** Rolle im Kader – beeinflusst die Spielzeit. */
  role: PlayerRole;

  /** Multiplikator auf die Einsatzzeit (Rollen-/Entscheidungsfolgen). */
  playtimeModifier: number;
  /** Dauerhafte Verletzungsanfälligkeit 0–100. */
  injuryProneness: number;
  /** Ausfallmonate der letzten Saison. */
  monthsOut: number;
  /** Anzahl schwerer Verletzungen. */
  majorInjuries: number;
  /** Verdeckter Talent-Archetyp. */
  archetype: TalentArchetype;
  /** Verdeckte Langlebigkeit 0–1; nur extrem selten hoch. */
  longevity: number;
}

export type Phase = "setup" | "offers" | "career" | "end";

/* -------------------------------------------------------- Dynamische Welt */

export interface ClubWorldEntry {
  /** Aktuelle Ligaebene (dynamisch). */
  division: number;
  /** Dynamische Stärke, entwickelt sich über Jahre. */
  strength: number;
  lastPosition?: number;
  /** Aufgebaute Krise (0..6). Erst ab Stufe 4 verliert ein Traditionsclub seinen Schutz. */
  crisisLevel?: number;
  /** Aufeinanderfolgende Saisons deutlich unter Erwartung. */
  poorStreak?: number;
  /** Saisons ohne Ligawechsel. */
  seasonsInDivision?: number;
  /** Letzte Bewegung: 1 = Aufstieg, -1 = Abstieg, 0 = keine. */
  lastMovement?: number;

  /** Qualifikation für die kommende Saison. */
  europe?: "UCL" | "UEL" | "UECL" | undefined;
}

export interface CountryWorld {
  code: string;
  /** clubId -> Zustand */
  clubs: Record<string, ClubWorldEntry>;
  /** zuletzt simulierte Saison (seasonIndex). */
  lastSeason: number;
  champion?: string | undefined;
  cupWinner?: string | undefined;
  continentalWinners?: Record<string, string> | undefined;
}

export interface ClubWorld {
  countries: Record<string, CountryWorld>;
}

export interface GameState {
  version: number;
  phase: Phase;
  profile: Profile;
  player: PlayerState;
  startYear: number;
  seasonIndex: number;
  seasons: SeasonRecord[];
  decisions: DecisionLog[];
  trophies: Trophy[];
  national: NationalState;
  offers: AcademyOffer[];
  rerolls: number;
  heartClub?: string | undefined;
  pending?: PendingDecision | undefined;
  /**
   * Nachgelagerte Entscheidungen derselben Saison (Verein/Leihe/Nationalteam).
   * Sie folgen der OVR-Entscheidung, ersetzen sie aber nie.
   */
  queue: PendingDecision[];

  lastConsequence?: DecisionLog | undefined;
  retired: boolean;
  /**
   * Grund des Karriereendes. "body" = körperlich endgültig vorbei; danach ist
   * kein Comeback mehr möglich und es gibt keine „weitermachen“-Option.
   */
  retirementCause?: "body" | "choice" | "natural" | undefined;
  /** Name des betreuten Nachwuchsspielers (Mentor-Story), sobald vergeben. */
  menteeName?: string | undefined;
  comebacks: number;
  comebackChecked: boolean;

  peakOvr: number;
  eventsSeen: string[];
  chunkRemaining: number;
  chunkEventUsed: boolean;
  /** Fanbindung je Verein (0–100). */
  fanRelations: Record<string, number>;
  /** Verlorene OVR-Gambles in Folge (Pechsträhnen-Schutz). */
  gambleLossStreak: number;
  /** Kumulierter Stärkeschub, den der Spieler je Verein erzeugt hat. */
  clubImpact: Record<string, number>;
  /** eventId -> frühester seasonIndex für eine Wiederholung. */
  cooldowns: Record<string, number>;

  /** Dynamische Clubwelt (Tabellen, Auf-/Abstieg, Europa). */
  world: ClubWorld;

  /**
   * Einmaliges Investoren-Projekt der Karriere. Es bleibt auch nach einer
   * Ablehnung im Spielstand und in der Welt bestehen.
   */
  investorProject?: InvestorProject | undefined;
  /** true = die einmalige Gelegenheit ist verbraucht (auch bei Ablehnung). */
  investorOffered?: boolean | undefined;
  /** Dauerhafte finanzielle Lage (Karriereeinnahmen, Absicherung). */
  wealth?: PlayerWealth | undefined;
}

