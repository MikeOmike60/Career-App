import { describe, expect, it } from "vitest";
import {
  FANS_MIN_VALUE,
  MENTOR_MIN_AGE,
  MENTOR_MIN_SEASONS_AT_CLUB,
  buildRetirementDecision,
  fansEligible,
  mentorEligible,
  pickRetirementStory,
  type RetirementStoryInput,
} from "./retirement";
import { advanceToNextDecision, applyDecision, applyDecisionAndAdvance, createInitialState, signWithClub } from "./engine";
import { canPlayAnotherSeason, isBodyFinished } from "./body";
import { clubsOf } from "./data";
import { subRng } from "./rng";
import { POSITIONS, type GameState, type Pace, type Profile, type RetirementStory } from "./types";

function profile(seed: number): Profile {
  return {
    name: `Veteran ${seed}`,
    birthDate: "2008-01-09",
    height: 180,
    weight: 77,
    nat1: "DE",
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: "preset:3",
    pace: 1 as Pace,
    seed,
  };
}

function storyInput(over: Partial<RetirementStoryInput> = {}): RetirementStoryInput {
  return { age: 36, fanValue: 60, seasonsAtClub: 2, ovr: 78, trophies: 2, mentality: 60, ...over };
}

/** Alter Spieler mit Verschleiß unter 100 und mehreren Saisons beim Club. */
function veteran(seed: number, age: number, bodyWear: number): GameState {
  let s = createInitialState(profile(seed));
  const club = clubsOf("DE", 1)[0]!;
  s = signWithClub(s, club.id);
  s.player.age = age;
  s.player.bodyWear = bodyWear;
  s.player.ovr = 76;
  s.seasonIndex = age - 16;
  s.fanRelations[s.player.clubId] = 92;
  return s;
}

describe("Ruhestandsentscheidung „Noch ein Jahr?“", () => {
  it("prüft die Eligibility der Story-Typen korrekt", () => {
    expect(mentorEligible(storyInput({ age: MENTOR_MIN_AGE, seasonsAtClub: MENTOR_MIN_SEASONS_AT_CLUB }))).toBe(true);
    expect(mentorEligible(storyInput({ age: MENTOR_MIN_AGE - 1, seasonsAtClub: 9 }))).toBe(false);
    expect(mentorEligible(storyInput({ age: 40, seasonsAtClub: MENTOR_MIN_SEASONS_AT_CLUB - 1 }))).toBe(false);
    expect(fansEligible(storyInput({ fanValue: FANS_MIN_VALUE }))).toBe(true);
    expect(fansEligible(storyInput({ fanValue: FANS_MIN_VALUE - 1 }))).toBe(false);
  });

  it("erzeugt über viele Seeds alle vier Storytypen", () => {
    const seen = new Set<RetirementStory>();
    for (let seed = 1; seed <= 400; seed++) {
      seen.add(pickRetirementStory(subRng(seed, "story"), storyInput({ age: 37, seasonsAtClub: 6, fanValue: 90 })));
    }
    expect([...seen].sort()).toEqual(["ambition", "fans", "joy", "mentor"]);
  });

  it("hält den Mentornamen dauerhaft konsistent", () => {
    const s = veteran(21, 38, 70);
    let first: string | undefined;
    for (let i = 0; i < 6; i++) {
      s.seasonIndex += 1;
      const decision = buildRetirementDecision(s, subRng(s.profile.seed, "retire", i));
      expect(s.menteeName).toBeTruthy();
      first ??= s.menteeName;
      expect(s.menteeName).toBe(first);
      if (decision.story === "mentor") {
        expect(decision.title).toContain(first!);
        expect(decision.intro).toContain(first!);
      }
    }
  });

  it("bietet genau zwei Optionen: weitermachen oder aufhören", () => {
    const s = veteran(33, 39, 80);
    const d = buildRetirementDecision(s, subRng(33, "retire"));
    expect(d.options.map((o) => o.id)).toEqual(["retire-continue", "retire-stop"]);
  });

  it("verlängert bei „weitermachen“ auch jenseits 50, solange der Körper trägt", () => {
    const s = veteran(77, 51, 52);
    const wearBefore = s.player.bodyWear;
    s.pending = buildRetirementDecision(s, subRng(77, "retire"));
    const next = applyDecision(s, "retire-continue");
    // Die Verlängerung wird angenommen: mehr Verschleiß, aber kein Karriereende.
    expect(next.player.retirementExtensions).toBe(1);
    expect(next.player.bodyWear).toBeGreaterThan(wearBefore);
    expect(next.retirementCause).not.toBe("choice");
    // Nach der Zusage folgt zuerst das jährliche Transferfenster; die
    // Alterung passiert mit der dann gespielten Saison.
    expect(next.retired).toBe(false);
    expect(next.player.retireAge).toBeGreaterThanOrEqual(52);
    expect(canPlayAnotherSeason(next.player.bodyWear)).toBe(true);
    /**
     * Beweis über die tatsächlich gespielte Saison: erst die offenen
     * Entscheidungen (u. a. das neue Transferfenster) auflösen, dann muss eine
     * echte Saison mit Alter 52+ in der Chronik stehen.
     */
    let s2 = next;
    let guard = 0;
    const before = s2.seasons.length;
    while (s2.seasons.length === before && !s2.retired && guard++ < 8) {
      const p2 = s2.pending;
      if (!p2) {
        s2 = advanceToNextDecision(s2);
        continue;
      }
      s2 = applyDecisionAndAdvance(
        s2,
        p2.kind === "club" || p2.kind === "comeback" ? "stay" : (p2.options[0]?.id ?? "stay"),
      );
    }
    const played = s2.seasons[s2.seasons.length - 1]!;
    expect(s2.seasons.length).toBeGreaterThan(before);
    // Die Saison wird mit 51 gespielt; danach ist der Spieler nachweislich 52+.
    expect(played.age).toBeGreaterThanOrEqual(51);
    expect(s2.player.age).toBeGreaterThanOrEqual(52);
  });

  it("beendet die Karriere bei „aufhören“ mit Ursache choice", () => {
    const s = veteran(78, 37, 60);
    s.pending = buildRetirementDecision(s, subRng(78, "retire"));
    const next = applyDecision(s, "retire-stop");
    expect(next.retired).toBe(true);
    expect(next.retirementCause).toBe("choice");
    // Ein freiwilliges Ende darf später ein Comeback-Angebot erzeugen – nie mehr.
    if (next.pending) expect(next.pending.kind).toBe("comeback");
  });

  it("erzeugt bei körperlichem Ende keine Continue-Option", () => {
    const s = veteran(79, 41, 100);
    expect(isBodyFinished(s.player.bodyWear)).toBe(true);
    expect(canPlayAnotherSeason(s.player.bodyWear)).toBe(false);
  });
});
