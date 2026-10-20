import { describe, expect, it } from "vitest";
import {
  STAGNATION_MIN_OVR,
  stagnationInputOf,
  stagnationTriggered,
  type StagnationInput,
} from "./stagnation";
import { applyDecision, buildStagnationOffers, createInitialState, signWithClub } from "./engine";
import { clubsOf, getClub } from "./data";
import { dynamicDivision } from "./world";
import { subRng } from "./rng";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

function base(over: Partial<StagnationInput> = {}): StagnationInput {
  return {
    ovr: 86,
    clubStrength: 84,
    trophylessSeasons: 1,
    disappointingSeasons: 0,
    relegated: false,
    loan: false,
    minutes: 0.8,
    wonMajorThisSeason: false,
    cooldownActive: false,
    ...over,
  };
}

function profile(seed: number, over: Partial<Profile> = {}): Profile {
  return {
    name: `Sackgasse ${seed}`,
    birthDate: "2008-05-02",
    height: 183,
    weight: 78,
    nat1: "DE",
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: "preset:2",
    pace: 1 as Pace,
    seed,
    ...over,
  };
}

/** Weltklassespieler bei einem Topclub. */
function topClubState(seed: number, ovr: number): GameState {
  let s = createInitialState(profile(seed));
  const club = clubsOf("DE", 1).sort((a, b) => b.strength - a.strength)[0]!;
  s = signWithClub(s, club.id);
  s.player.ovr = ovr;
  s.peakOvr = ovr;
  return s;
}

describe("Sportliche Sackgasse – Trigger", () => {
  it("löst sofort nach einem Abstieg mit gutem Team aus", () => {
    expect(stagnationTriggered(base({ relegated: true, trophylessSeasons: 1 }))).toBe(true);
  });

  it("löst nach drei titellosen Saisons aus", () => {
    expect(stagnationTriggered(base({ trophylessSeasons: 3 }))).toBe(true);
    expect(stagnationTriggered(base({ trophylessSeasons: 2 }))).toBe(false);
  });

  it("löst bei zwei deutlichen Underperformance-Jahren aus", () => {
    expect(stagnationTriggered(base({ disappointingSeasons: 2 }))).toBe(true);
    expect(stagnationTriggered(base({ disappointingSeasons: 1 }))).toBe(false);
  });

  it("löst nicht bei Leihe, Cooldown, frischem Titel, zu wenig Spielzeit oder schwachem Umfeld aus", () => {
    const trigger = base({ trophylessSeasons: 4 });
    expect(stagnationTriggered({ ...trigger, loan: true })).toBe(false);
    expect(stagnationTriggered({ ...trigger, cooldownActive: true })).toBe(false);
    expect(stagnationTriggered({ ...trigger, wonMajorThisSeason: true })).toBe(false);
    expect(stagnationTriggered({ ...trigger, minutes: 0.2 })).toBe(false);
    expect(stagnationTriggered({ ...trigger, clubStrength: 60 })).toBe(false);
    expect(stagnationTriggered({ ...trigger, ovr: STAGNATION_MIN_OVR - 1 })).toBe(false);
    // Auch ein Abstieg ändert nichts, solange der Cooldown läuft.
    expect(stagnationTriggered(base({ relegated: true, cooldownActive: true }))).toBe(false);
  });

  it("liest den Cooldown korrekt aus dem Spielstand", () => {
    const s = topClubState(7, 88);
    s.seasonIndex = 4;
    s.cooldowns["stagnation"] = 6;
    expect(stagnationInputOf(s).cooldownActive).toBe(true);
    s.cooldowns["stagnation"] = 4;
    expect(stagnationInputOf(s).cooldownActive).toBe(false);
  });
});

describe("Sportliche Sackgasse – Angebote", () => {
  it("liefert auch bei 95–99 OVR exakt drei plausible Erstligisten", () => {
    for (const ovr of [95, 96, 97, 98, 99]) {
      for (const seed of [12, 981, 30303]) {
        const s = topClubState(seed, ovr);
        const offers = buildStagnationOffers(s, subRng(seed, "stagnation", ovr));
        expect(offers).toHaveLength(3);
        expect(new Set(offers.map((o) => o.clubId)).size).toBe(3);
        for (const o of offers) {
          expect(o.clubId).not.toBe(s.player.clubId);
          expect(o.clubId).not.toBe(s.player.parentClubId);
          expect(o.deal).toBe("transfer");
          expect(dynamicDivision(s.world, o.clubId)).toBe(1);
        }
      }
    }
  });

  it("bietet nie den aktuellen oder den Stammverein an", () => {
    const s = topClubState(55, 88);
    const parent = clubsOf("DE", 1).find((c) => c.id !== s.player.clubId)!;
    s.player.parentClubId = parent.id;
    const offers = buildStagnationOffers(s, subRng(55, "stagnation"));
    expect(offers.map((o) => o.clubId)).not.toContain(s.player.clubId);
    expect(offers.map((o) => o.clubId)).not.toContain(parent.id);
  });
});

describe("Sportliche Sackgasse – Bleiben", () => {
  it("erhöht Loyalität, Fanbindung und Vereinsbeziehung stärker als normales Bleiben", () => {
    const make = (variant: "stagnation" | "window") => {
      const s = topClubState(4711, 88);
      s.player.relationship = 50;
      s.fanRelations[s.player.clubId] = 50;
      s.pending = {
        kind: "club",
        id: `test-${variant}`,
        title: "Test",
        intro: "Test",
        forced: false,
        variant,
        offers: buildStagnationOffers(s, subRng(4711, "stagnation")),
      };
      return applyDecision(s, "stay");
    };
    const loyal = make("stagnation");
    const normal = make("window");
    expect(loyal.player.relationship).toBeGreaterThan(normal.player.relationship);
    expect(loyal.fanRelations[loyal.player.clubId]!).toBeGreaterThan(normal.fanRelations[normal.player.clubId]!);
    expect(loyal.lastConsequence?.consequence).toContain(getClub(loyal.player.clubId).name);
    expect(loyal.lastConsequence?.consequence.toLowerCase()).toContain("treue");
    expect(loyal.lastConsequence?.deltas.join(" ")).toContain("Fanbindung");
  });
});
