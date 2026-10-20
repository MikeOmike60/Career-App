/**
 * Vereinsprofile: trennt HISTORIE (Tradition) sauber von AKTUELLER STÄRKE.
 *
 * Grundlage der Kalibrierung (nur als Modellgrundlage, keine Logos/Assets):
 * - UEFA Klub-Koeffizient (5 Jahre) und UEFA Club Ranking 2025
 * - Vereinsoffizielle Titel-/Historienangaben (Juventus, Bayern, PSG)
 * - Bundesliga-Historie zu Aufsteigern wie SV Elversberg
 *
 * Das Modul ist bewusst frei von Abhängigkeiten zu data.ts/world.ts, damit es
 * isoliert testbar bleibt und keine Zyklen entstehen.
 */

export type ClubBand =
  | "global-giant"
  | "continental-elite"
  | "established"
  | "historic-lower"
  | "ordinary"
  | "volatile"
  | "newcomer";

export interface ClubProfile {
  band: ClubBand;
  /** Kalibrierte aktuelle Basisstärke (Ausgangswert der dynamischen Welt). */
  baseStrength: number;
  prestige: number;
  finances: number;
  /** Historie 0..100 – beeinflusst Rebound/Aufstieg, NICHT die heutige Stärke. */
  tradition: number;
  /** Widerstandsfähigkeit gegen eine schlechte Saison in Liga 1 (0..1). */
  topFlightStability: number;
  /** Saisonstreuung und Krisenanfälligkeit (0..1). */
  volatility: number;
  /** Zusatzchance auf Aufstieg/Rückkehr in unteren Ligen (0..1). */
  reboundBonus: number;
  /** Wurde der Verein handkuratiert erkannt? */
  curated: boolean;
}

/* ------------------------------------------------------ Namensnormalisierung */

const NOISE = new Set([
  "fc", "afc", "ac", "as", "sc", "sv", "ss", "ssc", "ssd", "us", "usl", "ud", "cd", "cf", "sd", "rc", "rcd",
  "cfc", "asd", "sef", "gd", "ea", "ogc", "osc", "sco", "aj", "hsc", "fco", "spvgg", "tsg", "tsv", "vfb",
  "vfl", "bsc", "sk", "fk", "skn", "sku", "ask", "ce", "ca", "ad", "club", "calcio", "futebol", "sad",
  "de", "der", "the", "1", "04", "05", "07", "96", "98", "1899", "1907", "1912", "1913", "1929", "1932",
  "1936", "1937", "1903", "1910", "1915", "1919", "1922", "1945", "1966", "1908", "1921", "1978", "1965",
]);

/**
 * Robust gegen Umlaute, Akzente, Präfixe/Suffixe wie FC/AC/1. und Jahreszahlen.
 * "1. FC Köln" -> "koln", "Atlético Madrid" -> "atletico madrid".
 */
export function normalizeClubName(name: string): string {
  const flat = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const parts = flat.split(" ").filter((w) => w && !NOISE.has(w));
  return (parts.length ? parts : flat.split(" ")).join(" ").trim();
}

/* --------------------------------------------------------- Kuratierte Daten */

type Row = [name: string, strength: number];

/** Globale Giganten – Abstieg nur nach mehrjähriger, echter Krise. */
const GLOBAL_GIANTS: Row[] = [
  ["Real Madrid", 93],
  ["FC Bayern München", 92],
  ["Manchester City", 91],
  ["Paris Saint-Germain", 91],
  ["FC Liverpool", 90],
  ["FC Barcelona", 90],
  ["FC Arsenal", 89],
  ["Inter Mailand", 88],
  ["Juventus Turin", 86],
  ["AC Mailand", 85],
  ["FC Chelsea", 86],
  ["Manchester United", 84],
  ["Borussia Dortmund", 85],
  ["Atlético Madrid", 87],
];

/** Kontinentale Elite – sehr stabil, aber keine Giganten. */
const CONTINENTAL_ELITE: Row[] = [
  ["Bayer 04 Leverkusen", 84],
  ["RB Leipzig", 82],
  ["Eintracht Frankfurt", 80],
  ["VfB Stuttgart", 79],
  ["SSC Neapel", 86],
  ["Atalanta Bergamo", 83],
  ["AS Rom", 82],
  ["Lazio Rom", 80],
  ["Tottenham Hotspur", 83],
  ["Newcastle United", 82],
  ["Aston Villa", 81],
  ["Benfica Lissabon", 82],
  ["Sporting Lissabon", 82],
  ["FC Porto", 81],
  ["Olympique Marseille", 80],
  ["AS Monaco", 79],
  ["Olympique Lyon", 78],
  ["OSC Lille", 77],
  ["Athletic Bilbao", 80],
  ["FC Villarreal", 79],
  ["Real Sociedad", 77],
  ["Betis Sevilla", 78],
  ["FC Sevilla", 75],
  ["Celtic Glasgow", 76],
  ["Glasgow Rangers", 74],
  ["FC Red Bull Salzburg", 75],
  ["BSC Young Boys", 73],
  ["FC Basel", 72],
];

/** Etablierte Erstligisten – deutlich stabiler als Aufsteiger. */
const ESTABLISHED: Row[] = [
  ["SC Freiburg", 76],
  ["Werder Bremen", 73],
  ["Borussia Mönchengladbach", 73],
  ["1. FSV Mainz 05", 72],
  ["TSG 1899 Hoffenheim", 72],
  ["VfL Wolfsburg", 71],
  ["FC Augsburg", 70],
  ["1. FC Union Berlin", 70],
  ["Brighton & Hove Albion", 78],
  ["Nottingham Forest", 77],
  ["Crystal Palace", 76],
  ["FC Fulham", 75],
  ["FC Brentford", 74],
  ["FC Everton", 74],
  ["AFC Bournemouth", 74],
  ["Rayo Vallecano", 72],
  ["CA Osasuna", 71],
  ["Celta Vigo", 72],
  ["FC Getafe", 70],
  ["FC Valencia", 73],
  ["FC Bologna", 76],
  ["AC Florenz", 76],
  ["FC Turin", 73],
  ["Udinese Calcio", 72],
  ["Stade Rennes", 74],
  ["OGC Nizza", 74],
  ["Racing Straßburg", 73],
  ["RC Lens", 74],
  ["FC Toulouse", 71],
  ["Sporting Braga", 76],
  ["Vitória Guimarães", 72],
  ["SK Rapid Wien", 70],
  ["SK Sturm Graz", 70],
  ["LASK", 68],
  ["Heart of Midlothian", 67],
];

/**
 * Traditionsclubs – hohe Historie, aktuelle Stärke kommt aus der Liga.
 * Sie bekommen realistisch bessere, aber NICHT garantierte Aufstiegschancen.
 */
const HISTORIC_LOWER: string[] = [
  // Deutschland
  "Hertha BSC", "1. FC Nürnberg", "1. FC Kaiserslautern", "Hannover 96", "Fortuna Düsseldorf",
  "FC Schalke 04", "Hamburger SV", "1. FC Köln", "VfL Bochum", "Dynamo Dresden", "1. FC Magdeburg",
  "Karlsruher SC", "Eintracht Braunschweig", "Hansa Rostock", "MSV Duisburg", "Rot-Weiss Essen",
  "Alemannia Aachen", "1. FC Saarbrücken", "Arminia Bielefeld", "FC St. Pauli", "Energie Cottbus",
  "Waldhof Mannheim", "Preußen Münster",
  // England
  "West Ham United", "Wolverhampton Wanderers", "Southampton", "Leicester City", "Sheffield Wednesday",
  "Sheffield United", "Middlesbrough", "Derby County", "Portsmouth", "Norwich City", "Stoke City",
  "Blackburn Rovers", "Bolton Wanderers", "Birmingham City", "Coventry City", "Huddersfield Town",
  "Preston North End", "Wigan Athletic", "Leeds United", "AFC Sunderland", "Ipswich Town", "Burnley",
  "West Bromwich Albion", "Nottingham Forest",
  // Italien
  "FC Palermo", "Sampdoria Genua", "SSC Bari", "Catania SSD", "AC Perugia Calcio", "US Salernitana",
  "AC Reggiana", "Delfino Pescara 1936", "Novara Calcio", "US Livorno 1915", "Hellas Verona",
  "FC Empoli", "Calcio Padova", "L.R. Vicenza", "FC Modena", "Ascoli Calcio", "FC Cesena",
  "US Avellino 1912", "Foggia Calcio", "Spezia Calcio", "CFC Genua", "FC Crotone", "Cosenza Calcio",
  // Frankreich
  "AS Saint-Étienne", "FC Nantes", "Stade Reims", "FC Sochaux", "FC Metz", "AS Nancy", "EA Guingamp",
  "HSC Montpellier", "Red Star Paris", "AJ Auxerre", "Stade Brest", "Le Havre AC",
  // Spanien
  "Real Valladolid", "Zaragoza", "UD Las Palmas", "FC Cádiz", "Deportivo A Coruña", "Sporting Gijón",
  "Real Oviedo", "CD Teneriffa", "Racing Santander", "FC Granada", "FC Málaga", "Hércules", "Murcia",
  "CD Leganés", "SD Eibar",
  // Portugal / Österreich / Schweiz / Schottland
  "Académica de Coimbra", "Marítimo Funchal", "Leixões SC", "União Leiria", "GD Chaves",
  "Portimonense SC", "FK Austria Wien", "SV Austria Salzburg", "FC Wacker Innsbruck",
  "Grasshopper Club Zürich", "Servette FC", "FC Zürich", "FC Luzern", "Hibernian",
];

/** Fahrstuhlclubs / unbeständige Erstligisten. */
const VOLATILE: string[] = [
  "SC Paderborn 07", "1. FC Heidenheim", "Holstein Kiel", "SpVgg Greuther Fürth", "SV Darmstadt 98",
  "FC Ingolstadt 04", "SV Wehen Wiesbaden", "Hull City", "Luton Town", "Cardiff City", "Watford",
  "Swansea City", "Queens Park Rangers", "Bristol City", "Millwall", "Como 1907", "Como", "US Sassuolo Calcio",
  "Frosinone Calcio", "AC Monza", "FC Venedig", "US Lecce", "Cagliari Calcio", "Parma Calcio 1913",
  "US Cremonese", "SCO Angers", "FC Lorient", "ES Troyes AC", "Clermont Foot", "FC Girona",
  "Deportivo Alavés", "FC Elche", "UD Levante", "RCD Mallorca", "FC Alverca", "Casa Pia AC",
  "SCR Altach", "Wolfsberger AC", "WSG Tirol", "FC Lugano", "FC Sion", "FC Thun",
];

/** Neulinge/kleine Aufsteiger – klar abstiegsgefährdet. */
const NEWCOMER: string[] = [
  "SV Elversberg", "SC Verl", "Viktoria Köln", "TSV Havelse", "SG Sonnenhof Großaspach",
  "Wrexham", "Bromley", "Stevenage", "Lincoln City", "Milton Keynes Dons", "AFC Wimbledon",
  "Paris FC", "Le Mans FC", "FC Annecy", "USL Dunkerque", "AD Ceuta FC", "FC Andorra",
  "CD Eldense", "AVS Futebol SAD", "Dolomiti Bellunesi", "Union Brescia", "AC Ospitaletto",
  "Alcione Milano", "Grazer AK", "TSV Hartberg", "SKU Amstetten", "FC Vaduz", "Yverdon Sport FC",
];

interface Override {
  band: ClubBand;
  strength?: number;
}

const OVERRIDES = new Map<string, Override>();
const add = (name: string, band: ClubBand, strength?: number) => {
  const key = normalizeClubName(name);
  // Der erste Eintrag gewinnt: Giganten/Elite stehen bewusst vor den Listen.
  if (!OVERRIDES.has(key)) OVERRIDES.set(key, strength === undefined ? { band } : { band, strength });
};
for (const [n, s] of GLOBAL_GIANTS) add(n, "global-giant", s);
for (const [n, s] of CONTINENTAL_ELITE) add(n, "continental-elite", s);
for (const [n, s] of ESTABLISHED) add(n, "established", s);
for (const n of HISTORIC_LOWER) add(n, "historic-lower");
for (const n of VOLATILE) add(n, "volatile");
for (const n of NEWCOMER) add(n, "newcomer");

/** Nur für Tests/Diagnose: Anzahl kuratierter Vereine. */
export function curatedCount(): number {
  return OVERRIDES.size;
}

/* ------------------------------------------------------------ Bandparameter */

interface BandTraits {
  tradition: number;
  /** Obergrenze der kalibrierten Stärke ohne expliziten Override. */
  maxStrength: number;
  topFlightStability: number;
  volatility: number;
  reboundBonus: number;
}

export const BAND_TRAITS: Record<ClubBand, BandTraits> = {
  "global-giant": { maxStrength: 99, tradition: 100, topFlightStability: 0.97, volatility: 0.1, reboundBonus: 0.95 },
  "continental-elite": { maxStrength: 93, tradition: 88, topFlightStability: 0.9, volatility: 0.18, reboundBonus: 0.8 },
  established: { maxStrength: 88, tradition: 62, topFlightStability: 0.68, volatility: 0.32, reboundBonus: 0.45 },
  "historic-lower": { maxStrength: 80, tradition: 82, topFlightStability: 0.5, volatility: 0.42, reboundBonus: 0.78 },
  ordinary: { maxStrength: 84, tradition: 42, topFlightStability: 0.42, volatility: 0.46, reboundBonus: 0.28 },
  volatile: { maxStrength: 78, tradition: 46, topFlightStability: 0.27, volatility: 0.66, reboundBonus: 0.34 },
  newcomer: { maxStrength: 74, tradition: 20, topFlightStability: 0.13, volatility: 0.8, reboundBonus: 0.18 },
};

export interface ClubProfileInput {
  name: string;
  country: string;
  division: number;
  /** Prozedural/heuristisch geschätzte Stärke als Ausgangspunkt. */
  fallbackStrength: number;
  isReal?: boolean | undefined;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Obergrenze für kalibrierte Stärke abhängig von der aktuellen Ligaebene. */
function divisionCap(division: number): number {
  return division <= 1 ? 95 : 82 - (division - 2) * 9;
}

const CACHE = new Map<string, ClubProfile>();

export function clubProfile(input: ClubProfileInput): ClubProfile {
  const key = `${input.country}|${input.division}|${input.name}|${Math.round(input.fallbackStrength)}`;
  const hit = CACHE.get(key);
  if (hit) return hit;

  const override = OVERRIDES.get(normalizeClubName(input.name));
  const band: ClubBand = override?.band ?? heuristicBand(input);
  const traits = BAND_TRAITS[band];

  const raw = override?.strength ?? heuristicStrength(input, band);
  const cap = override?.strength ? divisionCap(input.division) : Math.min(divisionCap(input.division), traits.maxStrength);
  const baseStrength = Math.round(clamp(raw, 42, cap));
  const prestige = Math.round(clamp(baseStrength * 0.6 + traits.tradition * 0.45, 8, 100));
  const finances = Math.round(clamp(baseStrength * 0.85 + traits.tradition * 0.2 - input.division * 2, 8, 100));

  const profile: ClubProfile = {
    band,
    baseStrength,
    prestige,
    finances,
    tradition: traits.tradition,
    topFlightStability: traits.topFlightStability,
    volatility: traits.volatility,
    reboundBonus: traits.reboundBonus,
    curated: Boolean(override),
  };
  CACHE.set(key, profile);
  return profile;
}

function heuristicBand(input: ClubProfileInput): ClubBand {
  if (input.division === 1 && input.isReal && input.fallbackStrength >= 74) return "established";
  return "ordinary";
}

/**
 * Ohne Kuratierung bleibt die prozedurale Schätzung erhalten, wird aber gegen
 * die Ligaebene gedeckelt, damit Zweit-/Drittligisten nie Weltklasse sind.
 */
function heuristicStrength(input: ClubProfileInput, band: ClubBand): number {
  const damp = band === "established" ? 0 : 2;
  return input.fallbackStrength - damp;
}

/* ---------------------------------------------------------- Risikofunktionen */

/**
 * Wahrscheinlichkeit, dass ein Verein in einer Saison einen externen Schock
 * erleidet (Finanzkrise, Massenabgänge, Punktabzug). Auch für Giganten > 0.
 */
export function crisisShockRisk(profile: ClubProfile): number {
  return 0.004 + profile.volatility * 0.03;
}

/**
 * Relative Abstiegsanfälligkeit eines Vereins in Liga 1 – rein aus Profil und
 * aufgebautem Krisenlevel. Immer echt größer als 0, nie garantiert.
 */
export function relegationRiskFactor(profile: ClubProfile, crisisLevel: number): number {
  const shield = profile.topFlightStability * crisisShield(crisisLevel);
  return clamp(1 - shield, 0.02, 1);
}

/** Ab Krisenlevel 4 schützt die Historie nicht mehr. */
export function crisisShield(crisisLevel: number): number {
  return clamp(1 - crisisLevel / 4, 0, 1);
}
