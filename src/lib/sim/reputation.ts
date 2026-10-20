/**
 * Ruf, Rivalitäten und Verrat.
 *
 * Ein Wechsel wird gegen ALLE früheren Vereine geprüft: Ist das Ziel Rivale
 * mehrerer Ex-Klubs, addieren sich die Rivalitäten – der zweite Rivalen-Wechsel
 * ist deshalb schlimmer als der erste. Verrat bleibt im Spielstand
 * (`betrayals`), senkt Fanwerte dauerhaft, schließt Türen bei Vereinen und
 * färbt Angebote, Saisonnotizen und die Karriere-Erzählung.
 */
import { relationBetween } from "./club-relations";
import { getClub } from "./data";
import { subRng } from "./rng";
import { hasTrait } from "./personality";
import type { Betrayal, GameState, SeasonRecord } from "./types";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const fanOf = (s: GameState, id: string) => s.fanRelations[id] ?? 50;

/** Alle bisherigen Vereine (chronologisch, ohne Doppelungen), inkl. aktuellem Verein. */
export function formerClubs(state: GameState): string[] {
  const ids: string[] = [];
  const add = (id: string | undefined) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  for (const s of state.seasons) {
    add(s.parentClubId);
    add(s.clubId);
  }
  add(state.player.parentClubId);
  add(state.player.clubId);
  return ids;
}

/** Saisons beim Verein insgesamt. */
export function seasonsAt(state: GameState, clubId: string): number {
  return state.seasons.filter((s) => s.clubId === clubId || s.parentClubId === clubId).length;
}

/** Saisons am Stück beim aktuellen Verein (vom Ende gezählt). */
export function currentTenure(state: GameState): number {
  const id = state.player.parentClubId ?? state.player.clubId;
  let n = 0;
  for (let i = state.seasons.length - 1; i >= 0; i--) {
    const s = state.seasons[i]!;
    if (s.clubId === id || s.parentClubId === id) n++;
    else break;
  }
  return n;
}

export interface RivalHit {
  clubId: string;
  intensity: number;
  label: string;
  current: boolean;
  heart: boolean;
  seasons: number;
  fans: number;
}

/** Welche früheren Vereine wären von einem Wechsel zu `targetId` verraten? */
export function rivalHits(state: GameState, targetId: string): RivalHit[] {
  const current = state.player.parentClubId ?? state.player.clubId;
  const hits: RivalHit[] = [];
  for (const id of formerClubs(state)) {
    if (id === targetId) continue;
    const rel = relationBetween(id, targetId);
    if (rel?.type !== "rivalry") continue;
    hits.push({
      clubId: id,
      intensity: rel.intensity,
      label: rel.label,
      current: id === current,
      heart: id === state.heartClub,
      seasons: seasonsAt(state, id),
      fans: fanOf(state, id),
    });
  }
  return hits.sort((a, b) => Number(b.current) - Number(a.current) || b.intensity - a.intensity);
}

/** Gewichtete Schwere: aktueller Verein, Herzensverein, lange Zugehörigkeit und Fanliebe zählen mehr. */
export function rivalSeverity(state: GameState, hits: RivalHit[]): number {
  let total = 0;
  for (const h of hits) {
    let w = h.intensity * (h.current ? 1 : 0.75);
    if (h.heart) w *= 1.5;
    if (h.seasons >= 5) w *= 1.3;
    // Fanliebe macht es schlimmer – Hass macht es aber nie „harmloser“.
    w *= 0.8 + Math.max(h.fans, 40) / 200;
    total += w;
  }
  // Rivale mehrerer Ex-Klubs: jeder weitere verratene Verein eskaliert.
  total *= 1 + 0.5 * Math.max(0, hits.length - 1);
  // Wer sich selbst als loyal beschreibt, verrät doppelt.
  if (hasTrait(state, "loyal")) total *= 1.6;
  // Jeder frühere Verrat macht den nächsten schlimmer.
  total *= 1 + 0.35 * (state.betrayals?.length ?? 0);
  return Math.round(total * 10) / 10;
}

export type BetrayalTier = 0 | 1 | 2 | 3;

export function betrayalTier(severity: number, hits: number, earlier: number): BetrayalTier {
  if (severity <= 0) return 0;
  if (severity >= 15 || hits >= 3 || (earlier >= 1 && severity >= 9)) return 3;
  if (severity >= 9 || hits >= 2 || earlier >= 1) return 2;
  return 1;
}

/** Würde dieser Verein dich überhaupt noch anrufen? Verbrannte Brücken bleiben verbrannt. */
export function clubWillCall(state: GameState, clubId: string): boolean {
  if (fanOf(state, clubId) <= 12) return false;
  const betrayed = state.betrayals?.some((b) => b.betrayedClubIds.includes(clubId));
  if (betrayed && fanOf(state, clubId) < 35) return false;
  return true;
}

/** Sichtbare Warnung auf einer Angebotskarte. */
export function offerWarning(state: GameState, clubId: string): string | undefined {
  const hits = rivalHits(state, clubId);
  if (!hits.length) return undefined;
  const names = hits.map((h) => getClub(h.clubId).name);
  const severity = rivalSeverity(state, hits);
  const tier = betrayalTier(severity, hits.length, state.betrayals?.length ?? 0);
  const first = hits[0]!;
  if (tier >= 3) return `Erzrivale von ${names.join(" und ")} – das wäre der ultimative Verrat. Du würdest zur Hassfigur.`;
  if (tier === 2)
    return hits.length > 1
      ? `Rivale von ${names.join(" und ")} – das wäre Doppelverrat.`
      : `${first.label}: Rivale von ${names[0]}${first.fans >= 70 ? ", wo du Legende bist" : ""} – die Kurve würde es dir nie verzeihen.`;
  return `${first.label}: Rivale von ${names[0]} – ein Wechsel mit Sprengkraft.`;
}

/* --------------------------------------------------------------- Ruf-Tags */

export interface ReputationTag {
  key: string;
  label: string;
  tone: "gold" | "up" | "down" | "info";
  text: string;
}

/** Was die Fußballwelt über dich denkt – aus der echten Karriere abgeleitet. */
export function reputationTags(state: GameState): ReputationTag[] {
  const tags: ReputationTag[] = [];
  const clubs = formerClubs(state);
  const betrayals = state.betrayals ?? [];
  const worst = betrayals.reduce((m, b) => Math.max(m, b.severity), 0);

  if (betrayals.length >= 2 || worst >= 15) {
    tags.push({ key: "hate", label: "Hassfigur", tone: "down", text: "In mehreren Stadien wirst du gnadenlos ausgepfiffen." });
  } else if (betrayals.length === 1) {
    tags.push({ key: "traitor", label: "Verräter", tone: "down", text: `Seit dem Wechsel zu ${getClub(betrayals[0]!.toClubId).name} gilt dir eine Kurve als Verräter.` });
  }

  // Längste Station am Stück
  let best = { id: "", n: 0 };
  let run = { id: "", n: 0 };
  for (const s of state.seasons) {
    const id = s.parentClubId ?? s.clubId;
    run = run.id === id ? { id, n: run.n + 1 } : { id, n: 1 };
    if (run.n > best.n) best = run;
  }
  if (best.n >= 8) {
    tags.push({ key: "icon", label: `Ikone von ${getClub(best.id).name}`, tone: "gold", text: `${best.n} Saisons am Stück – so etwas gibt es kaum noch.` });
  } else if (state.heartClub && seasonsAt(state, state.heartClub) >= 6) {
    tags.push({ key: "heart", label: "Herzblut", tone: "up", text: `Dein Herzensverein ${getClub(state.heartClub).name} weiß, was er an dir hat.` });
  }

  const seasons = Math.max(1, state.seasons.length);
  const moves = Math.max(0, clubs.length - 1);
  if (moves >= 5 && seasons / clubs.length < 2.6) {
    tags.push({ key: "merc", label: "Söldner", tone: "info", text: "Du gehst dahin, wo das Projekt – oder das Geld – stimmt." });
  } else if (moves >= 3 && seasons / clubs.length < 2) {
    tags.push({ key: "nomad", label: "Wandervogel", tone: "info", text: "Kaum angekommen, schon wieder weg." });
  }
  if (state.investorProject?.accepted) {
    tags.push({ key: "money", label: "Projekt-Millionär", tone: "info", text: `Das Geld von ${state.investorProject.investorName} hat dich unabhängig gemacht.` });
  }
  return tags;
}

/* ----------------------------------------------- Nachwirkungen pro Saison */

/**
 * Verrat wirkt nach: Spielst du in derselben Liga wie ein verratener Verein,
 * wirst du dort ausgepfiffen – das kostet Nerven und landet in der Saisonnotiz.
 * Eigener Zufallsstrom, damit der übrige Saisonverlauf unverändert bleibt.
 */
export function applyLingeringReputation(state: GameState, record: SeasonRecord): void {
  const betrayals = state.betrayals ?? [];
  if (!betrayals.length) return;
  const rng = subRng(state.profile.seed, "grudge", record.index);
  const here = getClub(record.clubId);
  const victims = [...new Set(betrayals.flatMap((b) => b.betrayedClubIds))].filter((id) => {
    const c = getClub(id);
    return c.country === here.country && id !== record.clubId;
  });
  if (!victims.length) return;
  const victim = getClub(rng.pick(victims));
  const lines = [
    `Rückkehr nach ${victim.name}: 90 Minuten Pfeifkonzert, Plakate mit deinem Namen – durchgestrichen.`,
    `Im Duell mit ${victim.name} fliegen Feuerzeuge Richtung Eckfahne, sobald du zum Eckstoß antrittst.`,
    `Die Fans von ${victim.name} haben ein Lied über dich gedichtet. Es ist nicht nett.`,
    `Vor dem Spiel gegen ${victim.name} wird dein altes Trikot im Gästeblock verbrannt.`,
  ];
  record.relationNote = record.relationNote ?? rng.pick(lines);
  const p = state.player;
  p.morale = clamp(p.morale - rng.int(2, 6), 5, 100);
  if (hasTrait(state, "hothead")) p.form = clamp(p.form - 3, 0, 100);
}

/** Betrayal-Eintrag zusammenstellen. */
export function makeBetrayal(state: GameState, toClubId: string, hits: RivalHit[], severity: number): Betrayal {
  return {
    seasonIndex: state.seasonIndex,
    age: state.player.age,
    toClubId,
    betrayedClubIds: hits.map((h) => h.clubId),
    severity,
    label: hits[0]?.label ?? "Rivalenwechsel",
  };
}
