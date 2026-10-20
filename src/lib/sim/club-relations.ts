/**
 * Kuratierte, belegbare Vereinsbeziehungen (Rivalitäten & Fanfreundschaften).
 * Auflösung ausschließlich über exakte Vereinsnamen aus football-data.json –
 * keine Runtime-Netzwerkzugriffe, keine erfundenen Feindschaften.
 * Quellen siehe SOURCES_PRIVATE.md.
 */
import { allClubs } from "./data";
import type { Club } from "./types";

export type RelationType = "rivalry" | "fanFriendship";

export interface ClubRelation {
  type: RelationType;
  /** Intensität 1 (regional) bis 5 (Jahrhundertduell). */
  intensity: number;
  label: string;
  a: string;
  b: string;
}

type Pair = [string, string, number, string];

const RIVALRIES: Record<string, Pair[]> = {
  DE: [
    ["FC Bayern München", "TSV 1860 München", 5, "Münchner Stadtderby"],
    ["1. FC Nürnberg", "SpVgg Greuther Fürth", 5, "Frankenderby"],
    ["Eintracht Frankfurt", "Kickers Offenbach", 5, "Mainderby"],
    ["Eintracht Braunschweig", "Hannover 96", 5, "Niedersachsenderby"],
    ["1. FC Köln", "Fortuna Düsseldorf", 4, "Rheinlandderby"],
    ["Bayer 04 Leverkusen", "1. FC Köln", 4, "Rheinisches Derby"],
    ["FC Schalke 04", "VfL Bochum", 3, "Revierderby"],
    ["Borussia Dortmund", "VfL Bochum", 3, "Revierderby"],
    ["1. FC Kaiserslautern", "1. FC Saarbrücken", 4, "Südwestderby"],
    ["1. FC Kaiserslautern", "SV Waldhof Mannheim", 4, "Südwestderby"],
    ["1. FSV Mainz 05", "1. FC Kaiserslautern", 4, "Rheinland-Pfalz-Derby"],
    ["Karlsruher SC", "SV Waldhof Mannheim", 3, "Baden-Derby"],
    ["VfB Stuttgart", "Stuttgarter Kickers", 4, "Stuttgarter Stadtderby"],
    ["SC Freiburg", "Karlsruher SC", 3, "Badisches Derby"],
    ["Arminia Bielefeld", "SC Paderborn 07", 4, "Ostwestfalen-Derby"],
    ["Arminia Bielefeld", "Preußen Münster", 4, "Westfalenderby"],
    ["VfL Osnabrück", "Preußen Münster", 4, "Westfalenderby"],
    ["Dynamo Dresden", "1. FC Lokomotive Leipzig", 4, "Sachsenderby"],
    ["1. FC Lokomotive Leipzig", "BSG Chemie Leipzig", 5, "Leipziger Stadtderby"],
    ["RB Leipzig", "1. FC Lokomotive Leipzig", 3, "Leipziger Derby"],
    ["Dynamo Dresden", "1. FC Magdeburg", 4, "Ostderby"],
    ["1. FC Magdeburg", "Hallescher FC", 5, "Elbe-Saale-Derby"],
    ["Hansa Rostock", "FC St. Pauli", 4, "Nordduell"],
    ["Holstein Kiel", "Hansa Rostock", 3, "Ostseederby"],
    ["1. FC Union Berlin", "BFC Dynamo", 5, "Ost-Berliner Derby"],
    ["Hertha BSC", "BFC Dynamo", 3, "Berliner Derby"],
    ["MSV Duisburg", "Rot-Weiss Essen", 4, "Ruhrpott-Derby"],
    ["Rot-Weiss Essen", "Rot-Weiß Oberhausen", 4, "Niederrhein-Derby"],
    ["Alemannia Aachen", "1. FC Köln", 3, "Rheinlandderby"],
    ["FC Carl Zeiss Jena", "FC Rot-Weiß Erfurt", 5, "Thüringenderby"],
    ["Chemnitzer FC", "FC Erzgebirge Aue", 4, "Sachsenderby"],
    ["Hamburger SV", "Hannover 96", 3, "Norddeutsches Derby"],
    ["FC Bayern München", "FC Augsburg", 3, "Bayerisches Derby"],
    ["FC Bayern München", "1. FC Nürnberg", 4, "Bayerisches Derby"],
    ["Eintracht Frankfurt", "SV Darmstadt 98", 4, "Hessenderby"],
    ["Würzburger Kickers", "1. FC Schweinfurt 05", 4, "Unterfrankenderby"],
    ["FC Bayern München", "Borussia Dortmund", 5, "Der Klassiker"],
    ["Borussia Dortmund", "FC Schalke 04", 5, "Revierderby"],
    ["1. FC Köln", "Borussia Mönchengladbach", 4, "Rheinderby"],
    ["Hamburger SV", "Werder Bremen", 4, "Nordderby"],
    ["Hamburger SV", "FC St. Pauli", 4, "Hamburger Stadtderby"],
    ["1. FC Union Berlin", "Hertha BSC", 4, "Berliner Stadtderby"],
    ["VfB Stuttgart", "Karlsruher SC", 3, "Badisch-schwäbisches Derby"],
  ],
  ENG: [
    ["FC Arsenal", "FC Chelsea", 4, "London Derby"],
    ["FC Chelsea", "Tottenham Hotspur", 4, "London Derby"],
    ["West Ham United", "Millwall", 5, "East London Derby"],
    ["Aston Villa", "Birmingham City", 5, "Second City Derby"],
    ["Leeds United", "Manchester United", 5, "Roses Rivalry"],
    ["Nottingham Forest", "Derby County", 5, "East Midlands Derby"],
    ["Leicester City", "Nottingham Forest", 3, "East Midlands Derby"],
    ["Southampton", "Portsmouth", 5, "South Coast Derby"],
    ["Sheffield United", "Sheffield Wednesday", 5, "Steel City Derby"],
    ["Bristol City", "Bristol Rovers", 5, "Bristol Derby"],
    ["Ipswich Town", "Norwich City", 5, "East Anglian Derby"],
    ["Brighton & Hove Albion", "Crystal Palace", 4, "M23 Derby"],
    ["Wolverhampton Wanderers", "West Bromwich Albion", 5, "Black Country Derby"],
    ["Stoke City", "Port Vale", 4, "Potteries Derby"],
    ["Cardiff City", "Swansea City", 5, "South Wales Derby"],
    ["Blackburn Rovers", "Burnley", 5, "East Lancashire Derby"],
    ["Preston North End", "Blackpool", 4, "West Lancashire Derby"],
    ["Middlesbrough", "Newcastle United", 3, "Tees-Tyne Derby"],
    ["Luton Town", "Watford", 4, "Beds-Herts Derby"],
    ["Charlton Athletic", "Millwall", 4, "South London Derby"],
    ["Oxford United", "Swindon Town", 4, "A420 Derby"],
    ["Plymouth Argyle", "Exeter City", 4, "Devon Derby"],
    ["Manchester City", "FC Liverpool", 4, "Moderner Klassiker"],
    ["FC Arsenal", "Tottenham Hotspur", 5, "North London Derby"],
    ["Manchester City", "Manchester United", 5, "Manchester Derby"],
    ["FC Liverpool", "FC Everton", 4, "Merseyside Derby"],
    ["FC Liverpool", "Manchester United", 5, "North West Derby"],
    ["Newcastle United", "AFC Sunderland", 4, "Tyne-Wear Derby"],
  ],
  ES: [
    ["FC Valencia", "UD Levante", 4, "Derbi valenciano"],
    ["FC Valencia", "FC Villarreal", 4, "Derbi de la Comunitat"],
    ["Celta Vigo", "Deportivo A Coruña", 5, "Derbi gallego"],
    ["Sporting Gijón", "Real Oviedo", 5, "Derbi asturiano"],
    ["UD Las Palmas", "CD Teneriffa", 5, "Derbi canario"],
    ["FC Málaga", "FC Granada", 4, "Derbi andaluz"],
    ["FC Sevilla", "FC Cádiz", 3, "Derbi andaluz"],
    ["Athletic Bilbao", "CA Osasuna", 3, "Derbi vasco-navarro"],
    ["Deportivo Alavés", "Athletic Bilbao", 3, "Baskenderby"],
    ["Real Sociedad", "SD Eibar", 3, "Baskenderby"],
    ["Racing Santander", "Sporting Gijón", 3, "Derbi del Cantábrico"],
    ["Zaragoza", "Huesca", 4, "Derbi aragonés"],
    ["Murcia", "Cartagena", 4, "Derbi murciano"],
    ["Atlético Madrid", "FC Barcelona", 4, "Spitzenduell"],
    ["Real Madrid", "FC Barcelona", 5, "El Clásico"],
    ["Real Madrid", "Atlético Madrid", 5, "Derbi madrileño"],
    ["FC Sevilla", "Betis Sevilla", 5, "Derbi sevillano"],
    ["Athletic Bilbao", "Real Sociedad", 4, "Baskenderby"],
    ["FC Barcelona", "Espanyol Barcelona", 4, "Derbi barceloní"],
  ],
  IT: [
    ["SSC Neapel", "AS Rom", 4, "Derby del Sole"],
    ["Juventus Turin", "AC Florenz", 5, "Rivalità storica"],
    ["AC Mailand", "Juventus Turin", 4, "Klassiker des Nordens"],
    ["SSC Neapel", "Juventus Turin", 4, "Nord-Süd-Klassiker"],
    ["FC Bologna", "AC Florenz", 4, "Derby dell'Appennino"],
    ["Atalanta Bergamo", "Union Brescia", 5, "Derby lombardo"],
    ["FC Palermo", "Catania SSD", 5, "Derby di Sicilia"],
    ["SSC Bari", "US Lecce", 4, "Derby di Puglia"],
    ["SSC Bari", "Foggia Calcio", 4, "Derby di Puglia"],
    ["Hellas Verona", "L.R. Vicenza", 4, "Derby veneto"],
    ["Calcio Padova", "L.R. Vicenza", 4, "Derby veneto"],
    ["FC Venedig", "Calcio Padova", 3, "Derby veneto"],
    ["US Salernitana", "SSC Neapel", 3, "Derby campano"],
    ["US Avellino 1912", "US Salernitana", 4, "Derby campano"],
    ["Parma Calcio 1913", "AC Reggiana", 4, "Derby dell'Enza"],
    ["FC Modena", "FC Bologna", 3, "Derby emiliano"],
    ["Pisa Sporting Club", "US Livorno 1915", 5, "Derby toscano"],
    ["Cagliari Calcio", "SEF Torres 1903", 3, "Derby sardo"],
    ["Spezia Calcio", "Carrarese Calcio", 4, "Derby della Lunigiana"],
    ["Cosenza Calcio", "FC Crotone", 4, "Derby di Calabria"],
    ["Ascoli Calcio", "US Sambenedettese", 5, "Derby del Piceno"],
    ["Inter Mailand", "AC Mailand", 5, "Derby della Madonnina"],
    ["AS Rom", "Lazio Rom", 5, "Derby della Capitale"],
    ["Juventus Turin", "FC Turin", 4, "Derby della Mole"],
    ["Juventus Turin", "Inter Mailand", 5, "Derby d'Italia"],
    ["CFC Genua", "Sampdoria Genua", 4, "Derby della Lanterna"],
  ],
  FR: [
    ["OGC Nizza", "AS Monaco", 4, "Derby de la Côte d'Azur"],
    ["FC Nantes", "Stade Rennes", 4, "Derby de l'Ouest"],
    ["Olympique Lyon", "Olympique Marseille", 4, "Olympico"],
    ["Paris Saint-Germain", "Paris FC", 4, "Derby parisien"],
    ["Red Star Paris", "Paris FC", 3, "Derby parisien"],
    ["FC Metz", "AS Nancy", 5, "Derby lorrain"],
    ["Racing Straßburg", "FC Metz", 4, "Derby de l'Est"],
    ["Stade Rennes", "EA Guingamp", 4, "Derby breton"],
    ["Stade Brest", "FC Lorient", 4, "Derby breton"],
    ["Olympique Marseille", "OGC Nizza", 3, "Derby du Sud"],
    ["Stade Reims", "ES Troyes AC", 3, "Derby de Champagne"],
    ["Paris Saint-Germain", "Olympique Marseille", 5, "Le Classique"],
    ["Olympique Lyon", "AS Saint-Étienne", 4, "Derby Rhône-Alpes"],
    ["OSC Lille", "RC Lens", 4, "Derby du Nord"],
  ],
  PT: [
    ["Sporting Braga", "Vitória Guimarães", 5, "Derby do Minho"],
    ["FC Porto", "Sporting Braga", 3, "Derby do Norte"],
    ["Nacional Funchal", "Marítimo Funchal", 5, "Derby da Madeira"],
    ["Benfica Lissabon", "Sporting Lissabon", 5, "Derby de Lisboa"],
    ["Benfica Lissabon", "FC Porto", 5, "O Clássico"],
    ["FC Porto", "Sporting Lissabon", 4, "Clássico do Norte-Sul"],
  ],
  AT: [
    ["FC Red Bull Salzburg", "SK Rapid Wien", 4, "Westbahnderby"],
    ["LASK", "FC Blau-Weiß Linz", 5, "Linzer Derby"],
    ["FC Red Bull Salzburg", "SV Austria Salzburg", 5, "Salzburger Derby"],
    ["SK Sturm Graz", "SK Rapid Wien", 4, "Österreichischer Klassiker"],
    ["FC Wacker Innsbruck", "FC Red Bull Salzburg", 3, "Westderby"],
    ["SK Rapid Wien", "FK Austria Wien", 5, "Wiener Derby"],
    ["SK Sturm Graz", "Grazer AK", 4, "Grazer Derby"],
  ],
  CH: [
    ["BSC Young Boys", "FC Basel", 5, "Der Klassiker"],
    ["FC Lausanne-Sport", "Servette FC", 4, "Derby du Léman"],
    ["FC Sion", "Servette FC", 4, "Derby romand"],
    ["FC St. Gallen", "FC Zürich", 3, "Ostschweizer Duell"],
    ["FC Basel", "FC Zürich", 4, "Schweizer Spitzenduell"],
    ["Grasshopper Club Zürich", "FC Zürich", 5, "Zürcher Derby"],
  ],
  SCO: [
    ["FC Aberdeen", "Glasgow Rangers", 5, "Aberdeen–Rangers-Fehde"],
    ["Celtic Glasgow", "FC Aberdeen", 3, "Nord-Süd-Duell"],
    ["FC Kilmarnock", "Ayr United", 5, "Ayrshire Derby"],
    ["Partick Thistle", "Queen's Park", 3, "Glasgow Derby"],
    ["Raith Rovers", "Dunfermline Athletic", 5, "Fife Derby"],
    ["Celtic Glasgow", "Glasgow Rangers", 5, "Old Firm"],
    ["Heart of Midlothian", "Hibernian Edinburgh", 4, "Edinburgh Derby"],
    ["FC Dundee", "Dundee United", 4, "Dundee Derby"],
  ],
  JP: [
    ["Kashima Antlers", "Urawa Red Diamonds", 4, "J.-League-Klassiker"],
    ["Kawasaki Frontale", "FC Tokyo", 4, "Tamagawa Clásico"],
    ["Yokohama F. Marinos", "Yokohama FC", 4, "Yokohama Derby"],
    ["Shimizu S-Pulse", "Júbilo Iwata", 5, "Shizuoka Derby"],
    ["Kashiwa Reysol", "JEF United Ichihara Chiba", 5, "Chiba Derby"],
    ["Avispa Fukuoka", "Sagan Tosu", 4, "Kyushu Derby"],
    ["Vissel Kōbe", "Gamba Osaka", 3, "Kansai Derby"],
    ["Gamba Osaka", "Cerezo Osaka", 4, "Osaka Derby"],
    ["FC Tokyo", "Tokyo Verdy", 4, "Tokyo Derby"],
    ["Urawa Red Diamonds", "RB Ōmiya Ardija", 4, "Saitama Derby"],
    ["Kashima Antlers", "Yokohama F. Marinos", 3, "J.-League-Klassiker"],
  ],
  US: [
    ["LA Galaxy", "San José Earthquakes", 4, "California Clásico"],
    ["Vancouver Whitecaps", "Seattle Sounders", 4, "Cascadia Rivalry"],
    ["Vancouver Whitecaps", "Portland Timbers", 4, "Cascadia Rivalry"],
    ["Orlando City", "Inter Miami", 4, "Florida Derby"],
    ["Toronto FC", "CF Montreal", 5, "Canadian Classique"],
    ["FC Dallas", "Houston Dynamo", 4, "Texas Derby"],
    ["Austin FC", "FC Dallas", 3, "Texas Derby"],
    ["D.C. United", "New York Red Bulls", 4, "Atlantic Cup"],
    ["Philadelphia Union", "New York Red Bulls", 4, "Rivalität"],
    ["Real Salt Lake", "Colorado Rapids", 4, "Rocky Mountain Cup"],
    ["Louisville City FC", "Indy Eleven", 4, "Rivalität"],
    ["LA Galaxy", "Los Angeles FC", 4, "El Tráfico"],
    ["Portland Timbers", "Seattle Sounders", 4, "Cascadia Rivalry"],
    ["New York City FC", "New York Red Bulls", 4, "Hudson River Derby"],
    ["Columbus Crew", "FC Cincinnati", 4, "Hell is Real"],
  ],
};

/** Grenzüberschreitende Rivalitäten aus dem Europapokal. */
const INTERNATIONAL: Array<[string, string, string, string, number, string]> = [
  ["DE", "FC Bayern München", "ES", "Real Madrid", 4, "Europas Klassiker"],
  ["DE", "Borussia Dortmund", "ES", "Real Madrid", 3, "Königsklassen-Duell"],
  ["ES", "FC Barcelona", "FR", "Paris Saint-Germain", 3, "Die Remontada-Rivalität"],
  ["ES", "FC Barcelona", "ENG", "FC Chelsea", 3, "Champions-League-Fehde"],
  ["ES", "FC Barcelona", "IT", "Inter Mailand", 3, "Champions-League-Fehde"],
  ["ES", "Real Madrid", "IT", "Juventus Turin", 3, "Europapokal-Klassiker"],
  ["ENG", "FC Liverpool", "ES", "Real Madrid", 3, "Finalduell"],
  ["ENG", "Manchester United", "ES", "FC Barcelona", 3, "Finalduell"],
  ["ENG", "FC Liverpool", "IT", "AC Mailand", 3, "Istanbul-Rivalität"],
  ["DE", "FC Bayern München", "ENG", "FC Chelsea", 3, "Dahoam-Trauma"],
];

/** Nur eindeutig dokumentierte Fanfreundschaften. */
const FRIENDSHIPS: Array<[string, string, string, number, string]> = [
  ["DE", "Borussia Mönchengladbach", "ENG:FC Liverpool", 3, "Fanfreundschaft Gladbach–Liverpool"],
  ["DE", "FC St. Pauli", "SCO:Celtic Glasgow", 3, "Fanfreundschaft St. Pauli–Celtic"],
  ["DE", "Hamburger SV", "SCO:Glasgow Rangers", 3, "Fanfreundschaft HSV–Rangers"],
];

let CACHE: Map<string, ClubRelation[]> | null = null;

/** Jede deklarierte Paarung mit vollqualifizierten Namen (`CODE:Name`). */
export interface DeclaredPair {
  type: RelationType;
  intensity: number;
  label: string;
  a: string;
  b: string;
}

export function declaredPairs(): DeclaredPair[] {
  const out: DeclaredPair[] = [];
  for (const [code, pairs] of Object.entries(RIVALRIES)) {
    for (const [an, bn, intensity, label] of pairs) {
      out.push({ type: "rivalry", intensity, label, a: `${code}:${an}`, b: `${code}:${bn}` });
    }
  }
  for (const [ca, an, cb, bn, intensity, label] of INTERNATIONAL) {
    out.push({ type: "rivalry", intensity, label, a: `${ca}:${an}`, b: `${cb}:${bn}` });
  }
  for (const [code, an, target, intensity, label] of FRIENDSHIPS) {
    out.push({ type: "fanFriendship", intensity, label, a: `${code}:${an}`, b: target });
  }
  return out;
}

function nameIndex(): Map<string, Club> {
  const map = new Map<string, Club>();
  for (const c of allClubs()) {
    const key = `${c.country}:${c.name}`;
    if (!map.has(key)) map.set(key, c);
  }
  return map;
}

function build(): Map<string, ClubRelation[]> {
  const byName = nameIndex();
  const out = new Map<string, ClubRelation[]>();
  const add = (a: Club, b: Club, type: RelationType, intensity: number, label: string) => {
    const push = (x: Club, y: Club) => {
      const list = out.get(x.id) ?? [];
      if (!list.some((r) => r.b === y.id)) list.push({ type, intensity, label, a: x.id, b: y.id });
      out.set(x.id, list);
    };
    push(a, b);
    push(b, a);
  };

  for (const pair of declaredPairs()) {
    const a = byName.get(pair.a);
    const b = byName.get(pair.b);
    if (a && b) add(a, b, pair.type, pair.intensity, pair.label);
  }
  return out;
}

/** Abgleich deklarierter vs. tatsächlich aufgelöster Paarungen (für Tests/Doku). */
export function relationResolution(): {
  expected: number;
  resolved: number;
  missing: Array<{ pair: string; unresolved: string[] }>;
} {
  const byName = nameIndex();
  const pairs = declaredPairs();
  const missing: Array<{ pair: string; unresolved: string[] }> = [];
  let resolved = 0;
  for (const pair of pairs) {
    const unresolved = [pair.a, pair.b].filter((k) => !byName.has(k));
    if (unresolved.length) missing.push({ pair: `${pair.a} ↔ ${pair.b}`, unresolved });
    else resolved++;
  }
  return { expected: pairs.length, resolved, missing };
}

function relations(): Map<string, ClubRelation[]> {
  if (!CACHE) CACHE = build();
  return CACHE;
}

export function relationsOf(clubId: string): ClubRelation[] {
  return relations().get(clubId) ?? [];
}

/** Beziehung zwischen zwei Vereinen; sonst höchstens ein neutrales lokales Duell. */
export function relationBetween(aId: string, bId: string): ClubRelation | null {
  const direct = relationsOf(aId).find((r) => r.b === bId);
  if (direct) return direct;
  return null;
}

/** Anzahl kuratierter Paarungen (für Tests/Doku). */
export function relationPairCount(): number {
  let n = 0;
  for (const list of relations().values()) n += list.length;
  return n / 2;
}
