/**
 * „Noch ein Jahr?“ – eigene Entscheidung, die nach der jährlichen OVR-Wahl
 * erscheint, wenn die normale Ruhestandsabwägung anschlägt, der Körper aber
 * noch trägt. Die Frage darf nach jeder weiteren Saison erneut kommen, bis
 * Körper oder Höchstalter (careerAgeLimit) die Karriere beenden.
 */
import type { GameState, PendingRetirementDecision, RetirementOption, RetirementStory } from "./types";
import type { Rng } from "./rng";
import { getClub } from "./data";

/** Ab diesem Alter ist die Mentor-Geschichte überhaupt glaubwürdig. */
export const MENTOR_MIN_AGE = 34;
/** Mindestjahre beim selben Verein für die Mentor-Geschichte. */
export const MENTOR_MIN_SEASONS_AT_CLUB = 4;
/** Ab dieser Fanbindung bitten die Fans („Legende“). */
export const FANS_MIN_VALUE = 88;

const MENTEE_NAMES = [
  "Luca",
  "Elias",
  "Mateo",
  "Noah",
  "Jonas",
  "Emre",
  "Rafael",
  "Kwame",
  "Tomás",
  "Aleks",
];

export interface RetirementStoryInput {
  age: number;
  /** Fanbindung beim aktuellen Verein 0..100. */
  fanValue: number;
  /** Abgeschlossene Saisons beim aktuellen Verein. */
  seasonsAtClub: number;
  ovr: number;
  trophies: number;
  mentality: number;
}

export function mentorEligible(input: RetirementStoryInput): boolean {
  return input.age >= MENTOR_MIN_AGE && input.seasonsAtClub >= MENTOR_MIN_SEASONS_AT_CLUB;
}

export function fansEligible(input: RetirementStoryInput): boolean {
  return input.fanValue >= FANS_MIN_VALUE;
}

/**
 * Seeded und kontextabhängig: Fans und Mentor sind bei passenden Voraussetzungen
 * deutlich häufiger, aber nie garantiert.
 */
export function pickRetirementStory(rng: Rng, input: RetirementStoryInput): RetirementStory {
  const entries: Array<readonly [RetirementStory, number]> = [
    ["fans", fansEligible(input) ? 46 : 6],
    ["mentor", mentorEligible(input) ? 38 : 4],
    ["ambition", input.ovr >= 74 || input.trophies === 0 ? 26 : 14],
    ["joy", input.mentality >= 55 ? 22 : 14],
  ];
  return rng.weighted(entries);
}

/** Abgeschlossene Saisons in Folge beim aktuellen Verein. */
export function seasonsAtCurrentClub(state: GameState): number {
  const clubId = state.player.clubId;
  let count = 0;
  for (let i = state.seasons.length - 1; i >= 0; i--) {
    if (state.seasons[i]!.clubId !== clubId) break;
    count += 1;
  }
  return count;
}

export function retirementStoryInputOf(state: GameState): RetirementStoryInput {
  const p = state.player;
  return {
    age: p.age,
    fanValue: state.fanRelations[p.clubId] ?? 50,
    seasonsAtClub: seasonsAtCurrentClub(state),
    ovr: p.ovr,
    trophies: state.trophies.length,
    mentality: p.mentality,
  };
}

interface StoryText {
  title: string;
  intro: string;
  continueLabel: string;
  continueHint: string;
}

function storyText(
  story: RetirementStory,
  state: GameState,
  input: RetirementStoryInput,
  menteeName: string,
): StoryText {
  const club = getClub(state.player.clubId);
  const age = input.age;
  switch (story) {
    case "fans":
      return {
        title: "Die Kurve bittet um ein Jahr",
        intro: `Nach dem letzten Heimspiel bleibt die Kurve von ${club.name} stehen und singt deinen Namen, bis das Stadion leer ist. Auf einem Banner steht nur ein Satz: „Ein Jahr noch.“ Du bist ${age} – und für diese Menschen längst mehr als ein Spieler.`,
        continueLabel: "Noch eine Saison – für die Fans",
        continueHint: "Der Körper zahlt dafür, die Kurve trägt dich.",
      };
    case "mentor":
      return {
        title: `${menteeName} bittet dich zu bleiben`,
        intro: `${menteeName}, den du seit seinem ersten Profitraining bei ${club.name} unter deine Fittiche genommen hast, klopft an die Kabinentür. Er sagt, er sei noch nicht fertig mit dem Lernen – und fragt, ob du ihm eine Saison länger den Weg zeigst.`,
        continueLabel: "Noch eine Saison – als Mentor",
        continueHint: "Verantwortung statt Ruhe: du gibst weiter, was du kannst.",
      };
    case "ambition":
      return {
        title: "Da ist noch etwas offen",
        intro: `Du sitzt nach der Saison lange in der leeren Kabine von ${club.name}. Mit ${age} weiß dein Körper, dass es reicht. Dein Kopf rechnet trotzdem weiter: Es gibt Ziele, die du erreichen wolltest und noch nicht erreicht hast.`,
        continueLabel: "Noch eine Saison – die Ziele stehen",
        continueHint: "Ehrgeiz gegen Verschleiß.",
      };
    default:
      return {
        title: "Einfach noch nicht aufhören",
        intro: `Es ist kein Titel, kein Vertrag und kein Banner. Es ist der Moment, in dem du morgens die Schuhe schnürst und weißt, dass du das hier liebst. Mit ${age} Jahren und dem Trikot von ${club.name} auf der Bank fällt dir kein guter Grund ein, damit aufzuhören.`,
        continueLabel: "Noch eine Saison – aus Spielfreude",
        continueHint: "Kein Kalkül, nur Fußball.",
      };
  }
}

export const RETIREMENT_OPTION_IDS = ["retire-continue", "retire-stop"] as const;

/**
 * Baut die Entscheidung deterministisch. Der Aufrufer stellt sicher, dass der
 * Körper eine weitere Saison überhaupt zulässt.
 */
export function buildRetirementDecision(state: GameState, rng: Rng): PendingRetirementDecision {
  const input = retirementStoryInputOf(state);
  const story = pickRetirementStory(rng, input);
  /**
   * Der Mentee-Name wird beim ersten Auftritt dauerhaft im Spielstand
   * festgeschrieben – spätere Mentor-Entscheidungen nennen dieselbe Person.
   */
  const menteeName = state.menteeName ?? rng.pick(MENTEE_NAMES);
  state.menteeName = menteeName;
  const text = storyText(story, state, input, menteeName);
  const options: RetirementOption[] = [
    { id: "retire-continue", label: text.continueLabel, hint: text.continueHint },
    {
      id: "retire-stop",
      label: "Jetzt aufhören",
      hint: "Sauberer Abschluss – die Karriere endet hier.",
    },
  ];
  return {
    kind: "retirement",
    id: `retirement-${state.seasonIndex}-${state.player.retirementExtensions}`,
    title: text.title,
    intro: text.intro,
    story,
    extensions: state.player.retirementExtensions,
    bodyWear: Math.round(state.player.bodyWear),
    options,
  };
}
