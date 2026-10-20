/**
 * Vollständiger Katalog der 211 FIFA-Mitgliedsverbände.
 * Format: [code, deutscher Name, Nationalteam-Stärke, Ligaqualität, Region]
 * Die Codes sind stabil und eindeutig (ISO-3166-Alpha-2, mit ENG/SCO/WAL/NIR
 * für die britischen Verbände und XK für Kosovo).
 */
export type Region =
  | "eu-west"
  | "eu-north"
  | "eu-south"
  | "eu-east"
  | "sam"
  | "cam"
  | "carib"
  | "afr-north"
  | "afr-west"
  | "afr-east"
  | "afr-south"
  | "asia-west"
  | "asia-south"
  | "asia-east"
  | "oce";

export type RawCountry = readonly [string, string, number, number, Region];

export const RAW_COUNTRIES: RawCountry[] = [
  // ---------------------------------------------------------------- UEFA (55)
  ["AL", "Albanien", 66, 52, "eu-south"],
  ["AD", "Andorra", 42, 40, "eu-south"],
  ["AM", "Armenien", 58, 48, "eu-east"],
  ["AT", "Österreich", 76, 70, "eu-west"],
  ["AZ", "Aserbaidschan", 58, 50, "eu-east"],
  ["BY", "Belarus", 63, 52, "eu-east"],
  ["BE", "Belgien", 84, 74, "eu-west"],
  ["BA", "Bosnien und Herzegowina", 69, 54, "eu-south"],
  ["BG", "Bulgarien", 63, 53, "eu-east"],
  ["HR", "Kroatien", 82, 66, "eu-south"],
  ["CY", "Zypern", 60, 56, "eu-south"],
  ["CZ", "Tschechien", 74, 63, "eu-east"],
  ["DK", "Dänemark", 79, 68, "eu-north"],
  ["ENG", "England", 90, 93, "eu-west"],
  ["EE", "Estland", 50, 44, "eu-north"],
  ["FO", "Färöer", 47, 41, "eu-north"],
  ["FI", "Finnland", 66, 54, "eu-north"],
  ["FR", "Frankreich", 92, 84, "eu-west"],
  ["GE", "Georgien", 66, 52, "eu-east"],
  ["DE", "Deutschland", 90, 90, "eu-west"],
  ["GI", "Gibraltar", 42, 40, "eu-south"],
  ["GR", "Griechenland", 74, 65, "eu-south"],
  ["HU", "Ungarn", 70, 58, "eu-east"],
  ["IS", "Island", 62, 48, "eu-north"],
  ["IL", "Israel", 68, 60, "asia-west"],
  ["IT", "Italien", 89, 89, "eu-south"],
  ["KZ", "Kasachstan", 58, 52, "eu-east"],
  ["XK", "Kosovo", 62, 48, "eu-south"],
  ["LV", "Lettland", 52, 44, "eu-north"],
  ["LI", "Liechtenstein", 40, 40, "eu-west"],
  ["LT", "Litauen", 52, 44, "eu-north"],
  ["LU", "Luxemburg", 52, 44, "eu-west"],
  ["MT", "Malta", 48, 44, "eu-south"],
  ["MD", "Moldau", 52, 46, "eu-east"],
  ["ME", "Montenegro", 64, 50, "eu-south"],
  ["NL", "Niederlande", 86, 78, "eu-west"],
  ["MK", "Nordmazedonien", 62, 48, "eu-south"],
  ["NIR", "Nordirland", 62, 50, "eu-west"],
  ["NO", "Norwegen", 76, 64, "eu-north"],
  ["PL", "Polen", 75, 63, "eu-east"],
  ["PT", "Portugal", 88, 80, "eu-south"],
  ["IE", "Irland", 68, 55, "eu-west"],
  ["RO", "Rumänien", 70, 58, "eu-east"],
  ["RU", "Russland", 72, 66, "eu-east"],
  ["SM", "San Marino", 40, 40, "eu-south"],
  ["SCO", "Schottland", 71, 65, "eu-north"],
  ["RS", "Serbien", 76, 62, "eu-south"],
  ["SK", "Slowakei", 68, 55, "eu-east"],
  ["SI", "Slowenien", 68, 55, "eu-south"],
  ["ES", "Spanien", 91, 91, "eu-south"],
  ["SE", "Schweden", 76, 65, "eu-north"],
  ["CH", "Schweiz", 76, 69, "eu-west"],
  ["TR", "Türkei", 76, 70, "asia-west"],
  ["UA", "Ukraine", 74, 62, "eu-east"],
  ["WAL", "Wales", 72, 52, "eu-west"],

  // ----------------------------------------------------------- CONMEBOL (10)
  ["AR", "Argentinien", 91, 76, "sam"],
  ["BO", "Bolivien", 64, 56, "sam"],
  ["BR", "Brasilien", 92, 78, "sam"],
  ["CL", "Chile", 75, 63, "sam"],
  ["CO", "Kolumbien", 80, 68, "sam"],
  ["EC", "Ecuador", 78, 66, "sam"],
  ["PY", "Paraguay", 74, 62, "sam"],
  ["PE", "Peru", 72, 60, "sam"],
  ["UY", "Uruguay", 82, 68, "sam"],
  ["VE", "Venezuela", 68, 56, "sam"],

  // ---------------------------------------------------------- CONCACAF (35)
  ["AI", "Anguilla", 40, 40, "carib"],
  ["AG", "Antigua und Barbuda", 48, 42, "carib"],
  ["AW", "Aruba", 44, 40, "carib"],
  ["BS", "Bahamas", 42, 40, "carib"],
  ["BB", "Barbados", 46, 42, "carib"],
  ["BZ", "Belize", 46, 42, "cam"],
  ["BM", "Bermuda", 50, 42, "carib"],
  ["VG", "Britische Jungferninseln", 40, 40, "carib"],
  ["CA", "Kanada", 74, 62, "cam"],
  ["KY", "Kaimaninseln", 42, 40, "carib"],
  ["CR", "Costa Rica", 72, 60, "cam"],
  ["CU", "Kuba", 58, 48, "carib"],
  ["CW", "Curaçao", 60, 46, "carib"],
  ["DM", "Dominica", 42, 40, "carib"],
  ["DO", "Dominikanische Republik", 56, 46, "carib"],
  ["SV", "El Salvador", 58, 50, "cam"],
  ["GD", "Grenada", 48, 42, "carib"],
  ["GT", "Guatemala", 62, 54, "cam"],
  ["GY", "Guyana", 50, 42, "sam"],
  ["HT", "Haiti", 62, 48, "carib"],
  ["HN", "Honduras", 64, 54, "cam"],
  ["JM", "Jamaika", 68, 52, "carib"],
  ["MX", "Mexiko", 79, 71, "cam"],
  ["MS", "Montserrat", 42, 40, "carib"],
  ["NI", "Nicaragua", 50, 44, "cam"],
  ["PA", "Panama", 68, 56, "cam"],
  ["PR", "Puerto Rico", 46, 42, "carib"],
  ["KN", "St. Kitts und Nevis", 46, 42, "carib"],
  ["LC", "St. Lucia", 44, 40, "carib"],
  ["VC", "St. Vincent und die Grenadinen", 44, 40, "carib"],
  ["SR", "Suriname", 54, 46, "sam"],
  ["TT", "Trinidad und Tobago", 60, 50, "carib"],
  ["TC", "Turks- und Caicosinseln", 40, 40, "carib"],
  ["US", "USA", 77, 72, "cam"],
  ["VI", "US-Jungferninseln", 40, 40, "carib"],

  // ---------------------------------------------------------------- CAF (54)
  ["DZ", "Algerien", 78, 62, "afr-north"],
  ["AO", "Angola", 66, 52, "afr-south"],
  ["BJ", "Benin", 62, 48, "afr-west"],
  ["BW", "Botswana", 52, 44, "afr-south"],
  ["BF", "Burkina Faso", 72, 52, "afr-west"],
  ["BI", "Burundi", 54, 44, "afr-east"],
  ["CV", "Kap Verde", 68, 46, "afr-west"],
  ["CM", "Kamerun", 76, 56, "afr-west"],
  ["CF", "Zentralafrikanische Republik", 52, 42, "afr-west"],
  ["TD", "Tschad", 44, 40, "afr-west"],
  ["KM", "Komoren", 56, 42, "afr-east"],
  ["CG", "Kongo", 58, 46, "afr-west"],
  ["CD", "DR Kongo", 72, 52, "afr-west"],
  ["CI", "Côte d'Ivoire", 78, 58, "afr-west"],
  ["DJ", "Dschibuti", 40, 40, "afr-east"],
  ["EG", "Ägypten", 76, 62, "afr-north"],
  ["GQ", "Äquatorialguinea", 58, 44, "afr-west"],
  ["ER", "Eritrea", 42, 40, "afr-east"],
  ["SZ", "Eswatini", 46, 42, "afr-south"],
  ["ET", "Äthiopien", 50, 44, "afr-east"],
  ["GA", "Gabun", 62, 46, "afr-west"],
  ["GM", "Gambia", 60, 44, "afr-west"],
  ["GH", "Ghana", 76, 56, "afr-west"],
  ["GN", "Guinea", 68, 48, "afr-west"],
  ["GW", "Guinea-Bissau", 60, 44, "afr-west"],
  ["KE", "Kenia", 56, 48, "afr-east"],
  ["LS", "Lesotho", 44, 40, "afr-south"],
  ["LR", "Liberia", 48, 42, "afr-west"],
  ["LY", "Libyen", 54, 44, "afr-north"],
  ["MG", "Madagaskar", 56, 44, "afr-east"],
  ["MW", "Malawi", 50, 42, "afr-south"],
  ["ML", "Mali", 74, 52, "afr-west"],
  ["MR", "Mauretanien", 56, 44, "afr-north"],
  ["MU", "Mauritius", 42, 40, "afr-east"],
  ["MA", "Marokko", 82, 63, "afr-north"],
  ["MZ", "Mosambik", 54, 44, "afr-south"],
  ["NA", "Namibia", 52, 44, "afr-south"],
  ["NE", "Niger", 50, 42, "afr-west"],
  ["NG", "Nigeria", 78, 57, "afr-west"],
  ["RW", "Ruanda", 48, 42, "afr-east"],
  ["ST", "São Tomé und Príncipe", 40, 40, "afr-west"],
  ["SN", "Senegal", 80, 58, "afr-west"],
  ["SC", "Seychellen", 40, 40, "afr-east"],
  ["SL", "Sierra Leone", 50, 42, "afr-west"],
  ["SO", "Somalia", 40, 40, "afr-east"],
  ["ZA", "Südafrika", 68, 58, "afr-south"],
  ["SS", "Südsudan", 44, 40, "afr-east"],
  ["SD", "Sudan", 50, 44, "afr-north"],
  ["TZ", "Tansania", 58, 48, "afr-east"],
  ["TG", "Togo", 54, 44, "afr-west"],
  ["TN", "Tunesien", 74, 58, "afr-north"],
  ["UG", "Uganda", 56, 46, "afr-east"],
  ["ZM", "Sambia", 60, 48, "afr-south"],
  ["ZW", "Simbabwe", 54, 44, "afr-south"],

  // ---------------------------------------------------------------- AFC (46)
  ["AF", "Afghanistan", 42, 40, "asia-south"],
  ["AU", "Australien", 72, 60, "oce"],
  ["BH", "Bahrain", 58, 52, "asia-west"],
  ["BD", "Bangladesch", 42, 42, "asia-south"],
  ["BT", "Bhutan", 40, 40, "asia-south"],
  ["BN", "Brunei", 40, 40, "asia-east"],
  ["KH", "Kambodscha", 44, 44, "asia-east"],
  ["CN", "China", 60, 62, "asia-east"],
  ["TW", "Chinesisch-Taipeh", 44, 42, "asia-east"],
  ["GU", "Guam", 40, 40, "oce"],
  ["HK", "Hongkong", 52, 50, "asia-east"],
  ["IN", "Indien", 55, 48, "asia-south"],
  ["ID", "Indonesien", 56, 52, "asia-east"],
  ["IQ", "Irak", 68, 56, "asia-west"],
  ["IR", "Iran", 74, 62, "asia-west"],
  ["JP", "Japan", 78, 74, "asia-east"],
  ["JO", "Jordanien", 66, 52, "asia-west"],
  ["KG", "Kirgisistan", 54, 44, "asia-west"],
  ["KW", "Kuwait", 52, 48, "asia-west"],
  ["LA", "Laos", 42, 40, "asia-east"],
  ["LB", "Libanon", 52, 46, "asia-west"],
  ["MO", "Macau", 40, 40, "asia-east"],
  ["MY", "Malaysia", 52, 52, "asia-east"],
  ["MV", "Malediven", 44, 40, "asia-south"],
  ["MN", "Mongolei", 40, 40, "asia-east"],
  ["MM", "Myanmar", 46, 44, "asia-east"],
  ["NP", "Nepal", 44, 40, "asia-south"],
  ["KP", "Nordkorea", 56, 46, "asia-east"],
  ["OM", "Oman", 60, 52, "asia-west"],
  ["PK", "Pakistan", 40, 40, "asia-south"],
  ["PS", "Palästina", 54, 44, "asia-west"],
  ["PH", "Philippinen", 48, 44, "asia-east"],
  ["QA", "Katar", 64, 62, "asia-west"],
  ["SA", "Saudi-Arabien", 70, 70, "asia-west"],
  ["SG", "Singapur", 46, 46, "asia-east"],
  ["KR", "Südkorea", 76, 65, "asia-east"],
  ["LK", "Sri Lanka", 40, 40, "asia-south"],
  ["SY", "Syrien", 58, 44, "asia-west"],
  ["TJ", "Tadschikistan", 56, 44, "asia-west"],
  ["TH", "Thailand", 56, 56, "asia-east"],
  ["TL", "Timor-Leste", 40, 40, "asia-east"],
  ["TM", "Turkmenistan", 50, 42, "asia-west"],
  ["AE", "Vereinigte Arabische Emirate", 62, 60, "asia-west"],
  ["UZ", "Usbekistan", 68, 56, "asia-west"],
  ["VN", "Vietnam", 56, 52, "asia-east"],
  ["YE", "Jemen", 42, 40, "asia-west"],

  // ---------------------------------------------------------------- OFC (11)
  ["AS", "Amerikanisch-Samoa", 40, 40, "oce"],
  ["CK", "Cookinseln", 40, 40, "oce"],
  ["FJ", "Fidschi", 48, 42, "oce"],
  ["NC", "Neukaledonien", 50, 42, "oce"],
  ["NZ", "Neuseeland", 66, 52, "oce"],
  ["PG", "Papua-Neuguinea", 44, 40, "oce"],
  ["WS", "Samoa", 40, 40, "oce"],
  ["SB", "Salomonen", 46, 42, "oce"],
  ["PF", "Tahiti", 46, 42, "oce"],
  ["TO", "Tonga", 40, 40, "oce"],
  ["VU", "Vanuatu", 44, 40, "oce"],
];

/** Vorgegebene Ligatiefen – alle übrigen Verbände haben genau eine Liga. */
export const TIER_OVERRIDES: Record<string, number> = {
  DE: 4,
  ENG: 4,
  ES: 3,
  IT: 3,
  JP: 3,
  FR: 2,
  PT: 2,
  AT: 2,
  CH: 2,
  SCO: 2,
  US: 2,
};

const SUBDIVISION_FLAGS: Record<string, string> = {
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  WAL: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  NIR: "🇬🇧",
};

/** Flaggen-Emoji aus dem stabilen Code ableiten. */
export function flagFor(code: string): string {
  const special = SUBDIVISION_FLAGS[code];
  if (special) return special;
  if (code.length !== 2) return "🏳️";
  return String.fromCodePoint(
    ...code.split("").map((ch) => 0x1f1e6 + (ch.charCodeAt(0) - 65)),
  );
}

/* ------------------------------------------------- prozedurale Ortsnamen */

const PREFIX: Record<Region, string[]> = {
  "eu-west": ["Nord", "Alt", "Hohen", "Grün", "Stein", "Berg", "Wald", "Fels"],
  "eu-north": ["Sjö", "Nord", "Fjord", "Bjer", "Sol", "Vall", "Hav", "Skog"],
  "eu-south": ["Val", "Monte", "Castel", "Rio", "Alba", "Sierra", "Porto", "Terra"],
  "eu-east": ["Novo", "Bela", "Zele", "Dobra", "Kamen", "Vysoka", "Zlato", "Rud"],
  sam: ["Rio", "Puerto", "Villa", "Nueva", "Costa", "Cerro", "Valle", "Palma"],
  cam: ["San", "Nueva", "Puerto", "Villa", "Monte", "Bahía", "Palma", "Río"],
  carib: ["Port", "Bay", "Coral", "Palm", "Sun", "Reef", "Cane", "Sea"],
  "afr-north": ["Al", "Beni", "Sidi", "Oued", "Dar", "Ain", "Bab", "Ras"],
  "afr-west": ["Kofi", "Bama", "Sena", "Kanto", "Dabo", "Yara", "Tema", "Zola"],
  "afr-east": ["Mwanza", "Kigo", "Nyeri", "Sabi", "Meru", "Rufi", "Tana", "Zanzi"],
  "afr-south": ["Kwa", "Umzi", "Bulo", "Thaba", "Vaal", "Limpo", "Mafi", "Zulu"],
  "asia-west": ["Al", "Dar", "Shah", "Bandar", "Qal", "Nur", "Ferdo", "Marj"],
  "asia-south": ["Nava", "Sagar", "Chandra", "Rampur", "Nilg", "Deva", "Ganga", "Vind"],
  "asia-east": ["Shin", "Kita", "Nan", "Hoa", "Jin", "Bao", "Tan", "Seon"],
  oce: ["Wai", "Ara", "Moana", "Nui", "Tapu", "Rangi", "Kai", "Puna"],
};

const SUFFIX: Record<Region, string[]> = {
  "eu-west": ["feld", "burg", "hausen", "bach", "tal", "heim"],
  "eu-north": ["vik", "borg", "lund", "hamn", "by", "stad"],
  "eu-south": ["mar", "verde", "nova", "reale", "lago", "sole"],
  "eu-east": ["grad", "vac", "ovo", "ice", "polje", "brod"],
  sam: ["blanca", "verde", "mayor", "alta", "del Sol", "grande"],
  cam: ["Grande", "del Mar", "Verde", "Nuevo", "Alto", "Real"],
  carib: ["Town", "Bay", "Point", "Harbour", "Ridge", "Cove"],
  "afr-north": ["Zahra", "Nour", "Kabir", "Rif", "Wadi", "Medina"],
  "afr-west": ["kro", "ville", "bara", "town", "dou", "gou"],
  "afr-east": ["ni", "wa", "ra", "beni", "gara", "sha"],
  "afr-south": ["hoek", "berg", "fontein", "dal", "kop", "sig"],
  "asia-west": ["abad", "kent", "sar", "hir", "bad", "kan"],
  "asia-south": ["pur", "nagar", "gaon", "kot", "bad", "halli"],
  "asia-east": ["gawa", "shan", "yang", "bin", "gu", "san"],
  oce: ["tea", "roa", "toa", "vai", "nga", "hiva"],
};

const CLUB_SUFFIX: Record<Region, string[]> = {
  "eu-west": ["FC", "SV", "SC", "United"],
  "eu-north": ["IF", "FK", "BK", "United"],
  "eu-south": ["CF", "AC", "SC", "Atlético"],
  "eu-east": ["FK", "SK", "Dinamo", "Spartak"],
  sam: ["FC", "Atlético", "Deportivo", "Club"],
  cam: ["FC", "CD", "Deportivo", "Real"],
  carib: ["FC", "United", "SC", "Rangers"],
  "afr-north": ["SC", "FC", "Olympique", "Union"],
  "afr-west": ["FC", "AS", "Stars", "United"],
  "afr-east": ["FC", "SC", "City", "United"],
  "afr-south": ["FC", "United", "Sundowns", "Rovers"],
  "asia-west": ["SC", "FC", "Al-Ittihad", "Club"],
  "asia-south": ["FC", "SC", "United", "Warriors"],
  "asia-east": ["FC", "SC", "United", "Dragons"],
  oce: ["FC", "United", "SC", "Rovers"],
};

/** Deterministische Städte- bzw. Namensbestandteile für einen Verband. */
export function proceduralCities(code: string, region: Region, count = 6): string[] {
  const pre = PREFIX[region];
  const suf = SUFFIX[region];
  const seed = code.split("").reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 7);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = pre[(seed + i * 5) % pre.length]!;
    const b = suf[(seed + i * 3 + 1) % suf.length]!;
    const name = b.startsWith(" ") || b[0] === b[0]!.toUpperCase() ? `${a} ${b}` : `${a}${b}`;
    out.push(out.includes(name) ? `${name} ${i + 1}` : name);
  }
  return out;
}

export function clubSuffixes(region: Region): string[] {
  return CLUB_SUFFIX[region];
}
