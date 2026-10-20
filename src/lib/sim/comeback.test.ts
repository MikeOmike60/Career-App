import { describe, expect, it } from "vitest";
import {
  advanceToNextDecision,
  applyDecision,
  applyDecisionAndAdvance,
  buildComebackDecision,
  comebackCountries,
  createInitialState,
  decisionOptionIds,
  signWithClub,
} from "./engine";
import { clubsOf, getClub } from "./data";
import { subRng } from "./rng";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

function profile(seed: number, over: Partial<Profile> = {}): Profile {
  return {
    name: `Comeback ${seed}`,
    birthDate: "2008-03-14",
    height: 181,
    weight: 76,
    nat1: "DE",
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: "preset:1",
    pace: 1 as Pace,
    seed,
    ...over,
  };
}

/** Deutscher Spieler, letzter Verein in Japan, Karriereende mit 38. */
function retiredInJapan(seed: number): GameState {
  let s = createInitialState(profile(seed));
  const japanClub = clubsOf("JP", 1)[0]!;
  s = signWithClub(s, japanClub.id);
  s.player.age = 38;
  s.player.ovr = 74;
  s.peakOvr = 80;
  s.retired = true;
  return s;
}

describe("Comeback-Entscheidung als echter Flow", () => {
  it("bietet exakt drei Vereine aus erlaubten Ländern – nie aus Japan", () => {
    const allowed = comebackCountries(profile(1));
    let checked = 0;
    for (const seed of [11, 202, 3003, 44004, 51]) {
      const s = retiredInJapan(seed);
      const rng = subRng(seed, "comeback-test");
      const pending = buildComebackDecision(s, 2, 66, rng);
      expect(pending).toBeTruthy();
      expect(pending!.kind).toBe("comeback");
      if (pending!.kind !== "comeback") return;
      expect(pending!.offers).toHaveLength(3);
      expect(new Set(pending!.offers.map((o) => o.clubId)).size).toBe(3);
      for (const offer of pending!.offers) {
        expect(offer.country).toBeTruthy();
        expect(allowed).toContain(offer.country);
        expect(["JP", "CN", "KOR", "KR"]).not.toContain(offer.country);
        expect(getClub(offer.clubId).country).toBe(offer.country);
      }
      expect(decisionOptionIds(pending!)).toContain("comeback-no");
      checked++;
    }
    expect(checked).toBe(5);
  });

  it("setzt bei Auswahl OVR und Verein und simuliert automatisch weiter", () => {
    const s = retiredInJapan(777);
    const pending = buildComebackDecision(s, 2, 66, subRng(777, "comeback-test"))!;
    expect(pending.kind).toBe("comeback");
    if (pending.kind !== "comeback") return;
    const state: GameState = { ...s, pending };
    const offer = pending.offers[1]!;
    const picked = applyDecision(state, offer.id);
    expect(picked.player.ovr).toBe(pending.comebackOvr);
    expect(picked.player.clubId).toBe(offer.clubId);
    expect(picked.retired).toBe(false);
    expect(picked.comebacks).toBe(1);

    // Auto-Flow: ohne manuellen Weiter-Klick steht die nächste Entscheidung an.
    const advanced = advanceToNextDecision({ ...picked, pending: undefined });
    expect(Boolean(advanced.pending) || advanced.phase === "end").toBe(true);
  });

  it("beendet die Karriere bei comeback-no", () => {
    const s = retiredInJapan(4242);
    const pending = buildComebackDecision(s, 1, 68, subRng(4242, "comeback-test"))!;
    const ended = applyDecisionAndAdvance({ ...s, pending }, "comeback-no");
    expect(ended.phase).toBe("end");
  });
});
