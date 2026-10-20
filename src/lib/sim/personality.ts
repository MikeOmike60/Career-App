/**
 * Persönlichkeit aus Freitext: Ein optionales Feld im Spielerprofil wird über
 * Stichwörter in feste Charakterzüge übersetzt. Die Züge steuern, welche
 * Ereignisse auftauchen, wie heftig Wechsel aufgenommen werden und wie die
 * Karriere am Ende erzählt wird.
 */
import type { GameState, Profile } from "./types";

export type Trait = "loyal" | "ambitious" | "greedy" | "hothead" | "showman" | "leader" | "humble" | "professional";

export interface TraitInfo {
  label: string;
  /** Kurzer Satz, wie sich der Zug im Spiel auswirkt. */
  effect: string;
  keywords: string[];
}

export const TRAITS: Record<Trait, TraitInfo> = {
  loyal: {
    label: "Loyal",
    effect: "Schnelle Wechsel und Rivalen-Transfers treffen dich und die Fans doppelt hart – Treue wird belohnt.",
    keywords: ["loyal", "treu", "vereinstreu", "heimat", "verwurzelt", "bodenstandig", "herzensverein", "familienmensch", "dankbar"],
  },
  ambitious: {
    label: "Ehrgeizig",
    effect: "Du willst nach oben: Stillstand nagt an dir, große Schritte geben dir Auftrieb.",
    keywords: ["ehrgeiz", "ehrgeizig", "ambitioniert", "ambitious", "gewinner", "siegeswille", "titelhungrig", "hungrig", "karrierist", "erfolgshungrig", "will ganz nach oben"],
  },
  greedy: {
    label: "Geldorientiert",
    effect: "Geld lockt dich: Investoren und Söldner-Angebote klopfen öfter an, die Kurve misstraut dir schneller.",
    keywords: ["geld", "gierig", "reich", "luxus", "millionar", "soldner", "gehalt", "kohle", "money", "geschaftsmann"],
  },
  hothead: {
    label: "Hitzkopf",
    effect: "Du explodierst schnell: mehr Ärger mit Schiris, Trainern und Rivalen – aber auch Leidenschaft.",
    keywords: ["hitzkopf", "hitzkopfig", "aggressiv", "aufbrausend", "temperament", "emotional", "wutend", "impulsiv", "kampfer", "bad boy", "rebell"],
  },
  showman: {
    label: "Showman",
    effect: "Rampenlicht, Partys, Social Media: Boulevard und Klatsch begleiten dich auf Schritt und Tritt.",
    keywords: ["party", "feiern", "lebemann", "showman", "rampenlicht", "influencer", "eitel", "arrogant", "selbstbewusst", "superstar", "diva", "social media", "instagram", "frauenheld", "playboy"],
  },
  leader: {
    label: "Anführer",
    effect: "Du übernimmst Verantwortung: Kapitänsrollen, Mentoren-Geschichten und Kabinenführung kommen öfter.",
    keywords: ["anfuhrer", "fuhrung", "fuhrungsspieler", "leader", "kapitan", "verantwortung", "vorbild", "mentor", "lautsprecher"],
  },
  humble: {
    label: "Bescheiden",
    effect: "Kein Lärm, nur Fußball: weniger Medienrummel, dafür lieben dich die Fans für deine Bodenhaftung.",
    keywords: ["bescheiden", "ruhig", "introvertiert", "schuchtern", "zuruckhaltend", "leise", "demutig", "unauffallig"],
  },
  professional: {
    label: "Vollprofi",
    effect: "Disziplin zahlt sich aus: stabilere Form, seltener verletzt, etwas bessere Chancen bei Entscheidungen.",
    keywords: ["profi", "vollprofi", "professionell", "diszipliniert", "fleissig", "arbeiter", "trainingsweltmeister", "akribisch", "perfektionist", "fokussiert", "zielstrebig"],
  },
};

export const TRAIT_ORDER = Object.keys(TRAITS) as Trait[];

/** Kleinbuchstaben, ohne Akzente/Umlaute (ä→a, ß→ss) – für robusten Stichwortvergleich. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

const cache = new Map<string, Trait[]>();

/** Erkennt Charakterzüge im Freitext. „nicht loyal“ / „kein Hitzkopf“ zählen nicht. */
export function parseTraits(text: string | undefined): Trait[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  const hit = cache.get(raw);
  if (hit) return hit;
  const folded = ` ${fold(raw).replace(/[^a-z0-9 ]+/g, " ")} `;
  const found: Trait[] = [];
  for (const trait of TRAIT_ORDER) {
    for (const kw of TRAITS[trait].keywords) {
      // nur am Wortanfang: „star“ soll nicht in „stark“ treffen
      const idx = folded.indexOf(` ${kw}`);
      if (idx < 0) continue;
      if (kw === "profi" && folded.slice(idx + 1).startsWith("profil")) continue;
      // idx zeigt auf das Leerzeichen vor dem Wort – es gehört zum Vorlauf
      const before = folded.slice(Math.max(0, idx - 12), idx + 1);
      if (/\b(nicht|kein|keine|nie|never|not)\s+$/.test(before)) continue;
      found.push(trait);
      break;
    }
  }
  cache.set(raw, found);
  return found;
}

export function traitsOfProfile(profile: Pick<Profile, "personality">): Trait[] {
  return parseTraits(profile.personality);
}

export function hasTrait(state: GameState, trait: Trait): boolean {
  return traitsOfProfile(state.profile).includes(trait);
}

/** Faktor für Ereignisgewichte: Produkt der passenden Zug-Multiplikatoren. */
export function traitWeight(state: GameState, factors: Partial<Record<Trait, number>> | undefined): number {
  if (!factors) return 1;
  let w = 1;
  for (const t of traitsOfProfile(state.profile)) w *= factors[t] ?? 1;
  return w;
}
