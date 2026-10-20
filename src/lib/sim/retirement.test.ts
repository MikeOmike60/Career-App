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
import { advanceToNextDecision, applyDecision, applyDecisionAndAdvance, careerAgeLimit, createInitialState, decisionOptionIds, signWithClub } from "./engine";
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

  it("verlängert bei „weitermachen“, solange Körper und Höchstalter es zulassen", () => {
    const s = veteran(77, 36, 52);
    const wearBefore = s.player.bodyWear;
    s.pending = buildRetirementDecision(s, subRng(77, "retire"));
    const next = applyDecision(s, "retire-continue");
    expect(next.player.retirementExtensions).toBe(1);
    expect(next.player.bodyWear).toBeGreaterThan(wearBefore);
    expect(next.retired).toBe(false);
    expect(next.retirementCause).not.toBe("choice");
    expect(canPlayAnotherSeason(next.player.bodyWear)).toBe(true);
  });

  it("beendet jede Karriere spätestens mit dem Höchstalter – auch wenn man immer weitermacht", () => {
    for (const seed of [77, 78, 79, 80]) {
      let s = veteran(seed, 37, 20);
      const limit = careerAgeLimit(s);
      for (let guard = 0; guard < 60 && s.phase !== "end"; guard++) {
        const p = s.pending;
        if (!p) {
          s = advanceToNextDecision(s);
          if (!s.pending && s.phase !== "end") break;
          continue;
        }
        const ids = decisionOptionIds(p);
        const pick = ["retire-continue", "stay", "comeback-no"].find((id) => ids.includes(id)) ?? ids[0]!;
        s = applyDecisionAndAdvance(s, pick);
      }
      expect(s.retired).toBe(true);
      expect(s.seasons[s.seasons.length - 1]!.age).toBeLessThan(limit);
      expect(s.player.age).toBeLessThanOrEqual(limit);
    }
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
