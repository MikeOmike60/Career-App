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
    ["FC Bayern München", "Borussia Dortmund", 5, "Der Klassiker"],
    ["Borussia Dortmund", "FC Schalke 04", 5, "Revierderby"],
    ["1. FC Köln", "Borussia Mönchengladbach", 4, "Rheinderby"],
    ["Hamburger SV", "Werder Bremen", 4, "Nordderby"],
    ["Hamburger SV", "FC St. Pauli", 4, "Hamburger Stadtderby"],
    ["1. FC Union Berlin", "Hertha BSC", 4, "Berliner Stadtderby"],
    ["VfB Stuttgart", "Karlsruher SC", 3, "Badisch-schwäbisches Derby"],
  ],
  ENG: [
    ["FC Arsenal", "Tottenham Hotspur", 5, "North London Derby"],
    ["Manchester City", "Manchester United", 5, "Manchester Derby"],
    ["FC Liverpool", "FC Everton", 4, "Merseyside Derby"],
    ["FC Liverpool", "Manchester United", 5, "North West Derby"],
    ["Newcastle United", "AFC Sunderland", 4, "Tyne-Wear Derby"],
  ],
  ES: [
    ["Real Madrid", "FC Barcelona", 5, "El Clásico"],
    ["Real Madrid", "Atlético Madrid", 5, "Derbi madrileño"],
    ["FC Sevilla", "Betis Sevilla", 5, "Derbi sevillano"],
    ["Athletic Bilbao", "Real Sociedad", 4, "Baskenderby"],
    ["FC Barcelona", "Espanyol Barcelona", 4, "Derbi barceloní"],
  ],
  IT: [
    ["Inter Mailand", "AC Mailand", 5, "Derby della Madonnina"],
    ["AS Rom", "Lazio Rom", 5, "Derby della Capitale"],
    ["Juventus Turin", "FC Turin", 4, "Derby della Mole"],
    ["Juventus Turin", "Inter Mailand", 5, "Derby d'Italia"],
    ["CFC Genua", "Sampdoria Genua", 4, "Derby della Lanterna"],
  ],
  FR: [
    ["Paris Saint-Germain", "Olympique Marseille", 5, "Le Classique"],
    ["Olympique Lyon", "AS Saint-Étienne", 4, "Derby Rhône-Alpes"],
    ["OSC Lille", "RC Lens", 4, "Derby du Nord"],
  ],
  PT: [
    ["Benfica Lissabon", "Sporting Lissabon", 5, "Derby de Lisboa"],
    ["Benfica Lissabon", "FC Porto", 5, "O Clássico"],
    ["FC Porto", "Sporting Lissabon", 4, "Clássico do Norte-Sul"],
  ],
  AT: [
    ["SK Rapid Wien", "FK Austria Wien", 5, "Wiener Derby"],
    ["SK Sturm Graz", "Grazer AK", 4, "Grazer Derby"],
  ],
  CH: [
    ["FC Basel", "FC Zürich", 4, "Schweizer Spitzenduell"],
    ["Grasshopper Club Zürich", "FC Zürich", 5, "Zürcher Derby"],
  ],
  SCO: [
    ["Celtic Glasgow", "Glasgow Rangers", 5, "Old Firm"],
    ["Heart of Midlothian", "Hibernian Edinburgh", 4, "Edinburgh Derby"],
    ["FC Dundee", "Dundee United", 4, "Dundee Derby"],
  ],
  JP: [
    ["Gamba Osaka", "Cerezo Osaka", 4, "Osaka Derby"],
    ["FC Tokyo", "Tokyo Verdy", 4, "Tokyo Derby"],
    ["Urawa Red Diamonds", "RB Ōmiya Ardija", 4, "Saitama Derby"],
    ["Kashima Antlers", "Yokohama F. Marinos", 3, "J.-League-Klassiker"],
  ],
  US: [
    ["LA Galaxy", "Los Angeles FC", 4, "El Tráfico"],
    ["Portland Timbers", "Seattle Sounders", 4, "Cascadia Rivalry"],
    ["New York City FC", "New York Red Bulls", 4, "Hudson River Derby"],
    ["Columbus Crew", "FC Cincinnati", 4, "Hell is Real"],
  ],
};

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
