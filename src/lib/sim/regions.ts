/**
 * Herkunftsregionen der "Top 5"-Verbände (Deutschland, England, Spanien,
 * Italien, Frankreich).
 *
 * Die Zuordnung realer Vereine erfolgt über eine gepflegte Stichwortliste
 * (Städte, Vereinsbestandteile). Vereine ohne Treffer erhalten deterministisch
 * eine Region – identisch in jedem Lauf, ohne Zufall zur Laufzeit.
 */
import { hashString } from "./rng";

export interface RegionDef {
  id: string;
  name: string;
}

export const TOP5_COUNTRIES = ["DE", "ENG", "ES", "IT", "FR"] as const;

export function isTop5(code: string | undefined): boolean {
  return !!code && (TOP5_COUNTRIES as readonly string[]).includes(code);
}

export const REGIONS: Record<string, RegionDef[]> = {
  DE: [
    { id: "BW", name: "Baden-Württemberg" },
    { id: "BY", name: "Bayern" },
    { id: "BE", name: "Berlin" },
    { id: "BB", name: "Brandenburg" },
    { id: "HB", name: "Bremen" },
    { id: "HH", name: "Hamburg" },
    { id: "HE", name: "Hessen" },
    { id: "MV", name: "Mecklenburg-Vorpommern" },
    { id: "NI", name: "Niedersachsen" },
    { id: "NW", name: "Nordrhein-Westfalen" },
    { id: "RP", name: "Rheinland-Pfalz" },
    { id: "SL", name: "Saarland" },
    { id: "SN", name: "Sachsen" },
    { id: "ST", name: "Sachsen-Anhalt" },
    { id: "SH", name: "Schleswig-Holstein" },
    { id: "TH", name: "Thüringen" },
  ],
  ENG: [
    { id: "NE", name: "North East" },
    { id: "NW", name: "North West" },
    { id: "YH", name: "Yorkshire and the Humber" },
    { id: "EM", name: "East Midlands" },
    { id: "WM", name: "West Midlands" },
    { id: "EE", name: "East of England" },
    { id: "LDN", name: "Greater London" },
    { id: "SE", name: "South East" },
    { id: "SW", name: "South West" },
  ],
  ES: [
    { id: "AN", name: "Andalusien" },
    { id: "AR", name: "Aragonien" },
    { id: "AS", name: "Asturien" },
    { id: "IB", name: "Balearische Inseln" },
    { id: "CN", name: "Kanarische Inseln" },
    { id: "CB", name: "Kantabrien" },
    { id: "CM", name: "Kastilien-La Mancha" },
    { id: "CL", name: "Kastilien und León" },
    { id: "CT", name: "Katalonien" },
    { id: "EX", name: "Extremadura" },
    { id: "GA", name: "Galicien" },
    { id: "RI", name: "La Rioja" },
    { id: "MD", name: "Madrid" },
    { id: "MC", name: "Murcia" },
    { id: "NC", name: "Navarra" },
    { id: "PV", name: "Baskenland" },
    { id: "VC", name: "Valencia" },
  ],
  IT: [
    { id: "ABR", name: "Abruzzen" },
    { id: "BAS", name: "Basilikata" },
    { id: "CAL", name: "Kalabrien" },
    { id: "CAM", name: "Kampanien" },
    { id: "EMR", name: "Emilia-Romagna" },
    { id: "FVG", name: "Friaul-Julisch Venetien" },
    { id: "LAZ", name: "Latium" },
    { id: "LIG", name: "Ligurien" },
    { id: "LOM", name: "Lombardei" },
    { id: "MAR", name: "Marken" },
    { id: "MOL", name: "Molise" },
    { id: "PIE", name: "Piemont" },
    { id: "PUG", name: "Apulien" },
    { id: "SAR", name: "Sardinien" },
    { id: "SIC", name: "Sizilien" },
    { id: "TOS", name: "Toskana" },
    { id: "TAA", name: "Trentino-Südtirol" },
    { id: "UMB", name: "Umbrien" },
    { id: "VDA", name: "Aostatal" },
    { id: "VEN", name: "Venetien" },
  ],
  FR: [
    { id: "ARA", name: "Auvergne-Rhône-Alpes" },
    { id: "BFC", name: "Bourgogne-Franche-Comté" },
    { id: "BRE", name: "Bretagne" },
    { id: "CVL", name: "Centre-Val de Loire" },
    { id: "COR", name: "Korsika" },
    { id: "GES", name: "Grand Est" },
    { id: "HDF", name: "Hauts-de-France" },
    { id: "IDF", name: "Île-de-France" },
    { id: "NOR", name: "Normandie" },
    { id: "NAQ", name: "Nouvelle-Aquitaine" },
    { id: "OCC", name: "Okzitanien" },
    { id: "PDL", name: "Pays de la Loire" },
    { id: "PAC", name: "Provence-Alpes-Côte d’Azur" },
  ],
};

export function regionsOf(code: string): RegionDef[] {
  return REGIONS[code] ?? [];
}

export function regionName(code: string, regionId: string | undefined): string {
  if (!regionId) return "";
  return regionsOf(code).find((r) => r.id === regionId)?.name ?? regionId;
}

export function isValidRegion(code: string, regionId: string | undefined): boolean {
  if (!isTop5(code)) return regionId === undefined;
  return Boolean(regionId && regionsOf(code).some((r) => r.id === regionId));
}

/* ------------------------------------------------------- Stichwortpflege */

const KEYWORDS: Record<string, Record<string, string[]>> = {
  DE: {
    BY: ["münchen", "munchen", "nürnberg", "nurnberg", "augsburg", "fürth", "furth", "regensburg", "würzburg", "wurzburg", "ingolstadt", "bayreuth", "aschaffenburg", "unterhaching", "schweinfurt", "bamberg", "burghausen", "ansbach", "buchbach", "vilzing", "hankofen", "aubstadt", "türkgücü", "illertissen", "memmingen", "landshut"],
    BW: ["stuttgart", "freiburg", "hoffenheim", "karlsruhe", "heidenheim", "mannheim", "sandhausen", "ulm", "aalen", "reutlingen", "heidelberg", "villingen", "balingen", "pforzheim", "walldorf", "göppingen", "goppingen", "offenburg", "bahlingen", "steinbach"],
    BE: ["berlin", "hertha", "union berlin", "viktoria 1889", "tennis borussia", "lichtenberg", "sparta lichtenberg", "altglienicke"],
    BB: ["cottbus", "babelsberg", "potsdam", "luckenwalde", "eberswalde", "brandenburg"],
    HB: ["bremen", "bremerhaven", "brinkumer"],
    HH: ["hamburg", "st. pauli", "st pauli", "altona", "eimsbüttel", "eimsbuttel", "concordia hamburg", "teutonia"],
    HE: ["frankfurt", "darmstadt", "kassel", "wiesbaden", "offenbach", "steinbach haiger", "hessen", "fulda", "gießen", "giessen", "eintracht frankfurt"],
    MV: ["rostock", "hansa", "schwerin", "greifswald", "neustrelitz", "malchow"],
    NI: ["hannover", "wolfsburg", "braunschweig", "osnabrück", "osnabruck", "oldenburg", "meppen", "lüneburg", "luneburg", "delmenhorst", "drochtersen", "norderstedt hb", "hildesheim", "atlas delmenhorst", "eintracht braunschweig"],
    NW: ["dortmund", "schalke", "köln", "koln", "leverkusen", "gladbach", "mönchengladbach", "monchengladbach", "bochum", "düsseldorf", "dusseldorf", "duisburg", "paderborn", "bielefeld", "essen", "münster", "munster", "aachen", "wuppertal", "oberhausen", "siegen", "verl", "lotte", "gütersloh", "gutersloh", "wattenscheid", "velbert", "wiedenbrück", "wiedenbruck", "homberg", "straelen", "fortuna köln", "bonner"],
    RP: ["mainz", "kaiserslautern", "trier", "koblenz", "worms", "pirmasens", "engers", "ludwigshafen", "mechtersheim", "diefflen"],
    SL: ["saarbrücken", "saarbrucken", "elversberg", "homburg", "völklingen", "volklingen", "saarland"],
    SN: ["leipzig", "dresden", "chemnitz", "zwickau", "aue", "plauen", "meuselwitz sn", "lok leipzig", "chemie leipzig"],
    ST: ["magdeburg", "halle", "halberstadt", "dessau", "bernburg", "sachsen-anhalt"],
    SH: ["kiel", "flensburg", "lübeck", "lubeck", "elmshorn", "eutin", "phönix lübeck", "weiche flensburg", "heider"],
    TH: ["jena", "erfurt", "nordhausen", "meuselwitz", "gera", "eisenach", "thüringen", "thuringen"],
  },
  ENG: {
    NE: ["newcastle", "sunderland", "middlesbrough", "hartlepool", "darlington", "gateshead", "south shields", "spennymoor"],
    NW: ["manchester", "liverpool", "everton", "bolton", "blackburn", "blackpool", "burnley", "preston", "wigan", "oldham", "rochdale", "stockport", "salford", "tranmere", "carlisle", "accrington", "barrow", "morecambe", "crewe", "fleetwood", "fc liverpool"],
    YH: ["leeds", "sheffield", "hull", "huddersfield", "barnsley", "rotherham", "doncaster", "bradford", "harrogate", "york"],
    EM: ["nottingham", "leicester", "derby", "chesterfield", "mansfield", "notts county", "northampton", "lincoln", "grimsby"],
    WM: ["aston villa", "birmingham", "west bromwich", "wolverhampton", "coventry", "walsall", "stoke", "port vale", "shrewsbury", "kidderminster", "solihull", "tamworth"],
    EE: ["ipswich", "norwich", "luton", "peterborough", "cambridge", "colchester", "southend", "stevenage", "watford", "barnet", "dagenham"],
    LDN: ["arsenal", "chelsea", "tottenham", "west ham", "crystal palace", "fulham", "brentford", "queens park", "charlton", "millwall", "leyton", "wimbledon", "sutton united", "bromley", "london"],
    SE: ["brighton", "southampton", "portsmouth", "reading", "milton keynes", "oxford", "gillingham", "crawley", "wycombe", "aldershot", "eastleigh", "woking", "maidstone", "bournemouth"],
    SW: ["bristol", "swindon", "exeter", "plymouth", "cheltenham", "forest green", "yeovil", "torquay", "bath", "truro", "salisbury"],
  },
  ES: {
    MD: ["madrid", "getafe", "leganés", "leganes", "rayo", "alcorcón", "alcorcon", "fuenlabrada", "móstoles", "mostoles"],
    CT: ["barcelona", "espanyol", "girona", "sabadell", "nàstic", "nastic", "tarragona", "lleida", "andorra cf", "europa"],
    VC: ["valencia", "villarreal", "levante", "elche", "castellón", "castellon", "alicante", "hércules", "hercules", "eldense", "intercity"],
    AN: ["sevilla", "betis", "málaga", "malaga", "granada", "cádiz", "cadiz", "almería", "almeria", "córdoba", "cordoba", "huelva", "recreativo", "algeciras", "linares", "antequera", "marbella"],
    PV: ["bilbao", "sociedad", "alavés", "alaves", "eibar", "amorebieta", "sestao", "barakaldo", "athletic"],
    GA: ["celta", "coruña", "coruna", "lugo", "ourense", "pontevedra", "ferrol", "racing club villalbés", "compostela", "deportivo"],
    AS: ["oviedo", "sporting gijón", "sporting gijon", "gijón", "gijon", "avilés", "aviles", "langreo"],
    CB: ["santander", "racing santander", "cantabria", "torrelavega"],
    CL: ["valladolid", "burgos", "salamanca", "ponferradina", "zamora", "unionistas", "numancia", "ávila", "avila"],
    AR: ["zaragoza", "huesca", "teruel", "ejea"],
    NC: ["osasuna", "pamplona", "tudelano", "navarra"],
    RI: ["logroñés", "logrones", "rioja", "nájera"],
    MC: ["murcia", "cartagena", "lorca", "yeclano", "águilas", "aguilas"],
    CM: ["albacete", "toledo", "guadalajara", "talavera", "manchego"],
    EX: ["mérida", "merida", "badajoz", "extremadura", "villanovense"],
    IB: ["mallorca", "baleares", "ibiza", "menorca", "poblense"],
    CN: ["las palmas", "tenerife", "canaria", "lanzarote", "fuerteventura"],
  },
  IT: {
    LOM: ["mailand", "milan", "inter", "atalanta", "bergamo", "brescia", "monza", "como", "cremonese", "cremona", "pavia", "mantova", "lecco", "varese", "pergolettese", "renate", "albinoleffe", "pro sesto"],
    LAZ: ["rom", "roma", "lazio", "frosinone", "latina", "viterbese", "civitavecchia"],
    PIE: ["turin", "torino", "juventus", "alessandria", "novara", "pro vercelli", "cuneo", "asti"],
    CAM: ["neapel", "napoli", "salernitana", "salerno", "benevento", "avellino", "casertana", "juve stabia", "giugliano", "turris"],
    TOS: ["florenz", "fiorentina", "empoli", "pisa", "livorno", "siena", "arezzo", "carrarese", "lucchese", "pontedera", "grosseto"],
    EMR: ["bologna", "parma", "modena", "reggiana", "cesena", "sassuolo", "piacenza", "rimini", "ravenna", "ferrara", "spal", "carpi", "imolese"],
    VEN: ["venedig", "venezia", "verona", "vicenza", "padova", "treviso", "chievo", "cittadella"],
    LIG: ["genua", "genoa", "sampdoria", "spezia", "entella", "savona", "sanremese"],
    SIC: ["palermo", "catania", "messina", "trapani", "siracusa", "acireale"],
    SAR: ["cagliari", "olbia", "torres", "sassari", "nuorese"],
    PUG: ["lecce", "bari", "foggia", "taranto", "brindisi", "monopoli", "audace cerignola", "fidelis andria"],
    MAR: ["ancona", "ascoli", "fermana", "pesaro", "vis pesaro", "recanatese", "samb"],
    ABR: ["pescara", "teramo", "chieti", "avezzano", "l'aquila", "aquila"],
    CAL: ["cosenza", "crotone", "catanzaro", "reggina", "rende", "vibonese"],
    UMB: ["perugia", "ternana", "gubbio", "foligno"],
    FVG: ["udinese", "udine", "triestina", "pordenone"],
    TAA: ["trento", "bozen", "bolzano", "südtirol", "sudtirol", "trentino"],
    BAS: ["potenza", "matera", "lucania"],
    MOL: ["campobasso", "isernia", "molise"],
    VDA: ["aosta", "valle d'aosta"],
  },
  FR: {
    IDF: ["paris", "versailles", "créteil", "creteil", "red star", "saint-ouen", "poissy", "fleury", "sannois"],
    ARA: ["lyon", "saint-étienne", "saint-etienne", "grenoble", "clermont", "annecy", "bourg-en-bresse", "villefranche", "chambéry", "chambery"],
    PAC: ["marseille", "nizza", "nice", "monaco", "toulon", "istres", "martigues", "avignon", "fréjus", "frejus"],
    HDF: ["lens", "lille", "valenciennes", "amiens", "dunkerque", "boulogne", "arras", "beauvais", "chambly"],
    GES: ["straßburg", "strasbourg", "metz", "nancy", "reims", "troyes", "mulhouse", "colmar", "épinal", "epinal", "sedan", "châlons"],
    NAQ: ["bordeaux", "pau", "limoges", "angoulême", "angouleme", "bergerac", "niort", "poitiers", "biarritz", "bayonne"],
    OCC: ["toulouse", "montpellier", "nîmes", "nimes", "rodez", "béziers", "beziers", "perpignan", "narbonne", "albi"],
    PDL: ["nantes", "angers", "le mans", "laval", "cholet", "saint-nazaire"],
    BRE: ["rennes", "brest", "lorient", "guingamp", "concarneau", "vannes", "saint-brieuc", "quimper", "dinan"],
    NOR: ["le havre", "caen", "rouen", "cherbourg", "avranches", "évreux", "evreux", "dieppe"],
    CVL: ["orléans", "orleans", "tours", "bourges", "châteauroux", "chateauroux", "blois", "vierzon"],
    BFC: ["dijon", "auxerre", "sochaux", "besançon", "besancon", "belfort", "nevers", "montceau"],
    COR: ["bastia", "ajaccio", "korsika", "corse", "corte"],
  },
};

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Regionszuordnung eines Vereins über gepflegte Stichworte, sonst
 * deterministisch aus Name und Land – nie zufällig.
 */
export function regionOfClubName(country: string, name: string): string | undefined {
  const list = regionsOf(country);
  if (!list.length) return undefined;
  const n = normalize(name);
  const table = KEYWORDS[country] ?? {};
  let best: { id: string; len: number } | null = null;
  for (const [id, words] of Object.entries(table)) {
    for (const w of words) {
      if (n.includes(w) && (!best || w.length > best.len)) best = { id, len: w.length };
    }
  }
  if (best) return best.id;
  return list[hashString(`${country}|${n}`) % list.length]!.id;
}
