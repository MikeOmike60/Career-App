/**
 * Datengetriebene Nachbarschaftstabelle für geografisch plausible
 * Comeback-Angebote. Das Heimatland ist immer zulässig; ergänzt wird um
 * direkte bzw. naheliegende Nachbarn. Für Verbände ohne Eintrag greift die
 * Regionszugehörigkeit aus countries.ts als "regionale Nachbarschaft".
 */
import { COUNTRIES, COUNTRY_BY_CODE } from "./data";

const NEIGHBORS: Record<string, string[]> = {
  DE: ["AT", "CH", "FR", "PL", "CZ", "NL", "BE", "DK", "LU"],
  AT: ["DE", "CH", "IT", "CZ", "SK", "HU", "SI", "LI"],
  CH: ["DE", "FR", "IT", "AT", "LI"],
  FR: ["DE", "CH", "IT", "ES", "BE", "LU", "MC", "AD"],
  ES: ["PT", "FR", "AD", "MA"],
  PT: ["ES"],
  IT: ["FR", "CH", "AT", "SI", "SM", "MT", "HR"],
  ENG: ["SCO", "WAL", "NIR", "IE", "FR", "BE", "NL"],
  SCO: ["ENG", "WAL", "NIR", "IE"],
  WAL: ["ENG", "SCO", "IE"],
  NIR: ["IE", "SCO", "ENG"],
  IE: ["NIR", "ENG", "SCO", "WAL"],
  NL: ["BE", "DE", "ENG"],
  BE: ["NL", "FR", "DE", "LU", "ENG"],
  US: ["CA", "MX"],
  MX: ["US", "GT", "BZ"],
  CA: ["US"],
  JP: ["KR", "CN", "TW", "PH"],
  KR: ["JP", "CN"],
  BR: ["AR", "UY", "PY", "BO", "PE", "CO"],
  AR: ["BR", "UY", "CL", "PY", "BO"],
  AU: ["NZ", "ID", "PG"],
};

/** Erlaubte Länder für Comeback-Angebote: Heimatland plus Nachbarn. */
export function neighborCountries(code: string): string[] {
  const direct = NEIGHBORS[code];
  const known = new Set(COUNTRIES.map((c) => c.code));
  if (direct) return [code, ...direct.filter((c) => known.has(c) && c !== code)];
  const region = COUNTRY_BY_CODE.get(code)?.region;
  const near = COUNTRIES.filter((c) => c.region === region && c.code !== code)
    .sort((a, b) => b.leagueQuality - a.leagueQuality)
    .slice(0, 8)
    .map((c) => c.code);
  return [code, ...near];
}
