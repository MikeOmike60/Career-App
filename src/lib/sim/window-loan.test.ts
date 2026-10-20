import { describe, expect, it } from "vitest";
import {
  advanceToNextDecision,
  applyDecision,
  applyDecisionAndAdvance,
  buildClubDecision,
  createInitialState,
  signAndAdvance,
  loanRouteFor,
} from "./engine";
import { subRng } from "./rng";
import { dynamicStrength } from "./world";
import { getClub } from "./data";
import type { GameState, Pace, Profile } from "./types";

/** Vollständiges, gültiges Profil – keine Casts, keine Platzhalterobjekte. */
function profile(seed: number, over: Partial<Profile> = {}): Profile {
  return {
    name: "Test Spieler",
    birthDate: "2008-04-11",
    height: 182,
    weight: 76,
    nat1: "DE",
    region: "BY",
    pos: "ST",
    avatar: "preset:3",
    pace: 1,
    seed,
    ...over,
  };
}

function startCareer(seed: number, over: Partial<Profile> = {}): GameState {
  const s0 = createInitialState(profile(seed, over));
  return signAndAdvance(s0, s0.offers[0]!.clubId);
}

interface Played {
  state: GameState;
  /** Entscheidungsarten je Saisonindex, in dem sie aufgetreten sind. */
  perSeason: Map<number, string[]>;
}

/** Spielt Saisons durch und protokolliert alle Entscheidungen je Saisonindex. */
function play(state: GameState, seasons: number): Played {
  const perSeason = new Map<number, string[]>();
  let s = state;
  let guard = 0;
  while (s.phase === "career" && !s.retired && s.seasons.length < seasons && guard++ < 400) {
    const pending = s.pending;
    if (!pending) {
      s = advanceToNextDecision(s);
      continue;
    }
    const idx = s.seasons.length - 1;
    perSeason.set(idx, [...(perSeason.get(idx) ?? []), pending.kind]);
    const optionId =
      pending.kind === "club" || pending.kind === "comeback"
        ? "stay"
        : (pending.options[0]?.id ?? "stay");
    const next = applyDecisionAndAdvance(s, pending.kind === "club" ? "stay" : optionId);
    if (next === s) break;
    s = next;
  }
  return { state: s, perSeason };
}

describe("garantiertes jährliches Fenster", () => {
  for (const pace of [1, 2, 5] as Pace[]) {
    it(`liefert bei Tempo ${pace} pro vollständig aufgelöster Saison genau ein OVR- und ein Vereinsfenster`, { timeout: 120_000 }, () => {
      const { state, perSeason } = play(startCareer(4200 + pace, { pace }), 6);
      expect(state.seasons.length).toBeGreaterThanOrEqual(4);
      // Die aktuell noch offene Saison wird nicht gewertet.
      const openIdx = state.pending || state.queue.length > 0 ? state.seasons.length - 1 : -1;
      let counted = 0;
      for (const [idx, kinds] of perSeason) {
        if (idx === openIdx || idx < 0) continue;
        counted++;
        expect(kinds.filter((k) => k === "ovr").length).toBe(1);
        expect(kinds.filter((k) => k === "club").length).toBe(1);
      }
      expect(counted).toBeGreaterThanOrEqual(3);
      // Keine doppelten Saisons in der Chronik.
      const labels = state.seasons.map((x) => x.seasonLabel);
      expect(new Set(labels).size).toBe(labels.length);
      const idxs = state.seasons.map((x) => x.index);
      expect(new Set(idxs).size).toBe(idxs.length);
    });
  }
});

/** Setzt einen jungen Überflieger bei einem bewusst schwachen Verein auf. */
function stepUpFixture(seed: number): GameState {
  const s = startCareer(seed);
  const last = s.seasons[s.seasons.length - 1]!;
  // Schwächster verfügbarer Verein des Startlandes als Stammverein.
  const home = getClub(s.player.clubId);
  const homeStrength = dynamicStrength(s.world, home.id);
  return {
    ...s,
    player: { ...s.player, age: 20, ovr: Math.max(homeStrength + 6, 70), parentClubId: undefined, loanSeasonsLeft: 0 },
    seasons: [...s.seasons.slice(0, -1), { ...last, apps: 30, rating: 7.6, missedSeason: false }],
  };
}

describe("Leih-Routen", () => {
  it("junger Überflieger eines schwächeren Vereins bekommt zwingend eine Step-up-Route", () => {
    const s = stepUpFixture(9101);
    expect(loanRouteFor(s)).toBe("step-up");
  });

  it("Step-up-Fenster bietet drei stärkere Leihziele, behält den Stammverein und endet mit der Rückkehr", () => {
    const base = stepUpFixture(9102);
    expect(loanRouteFor(base)).toBe("step-up");
    const parentBefore = base.player.clubId;

    // Echter Builder statt Fake-Queue.
    const decision = buildClubDecision(base, subRng(base.profile.seed, "test", "stepup", 9102), false);
    expect(decision).not.toBeNull();
    const pending = decision!;
    expect(pending.offers.length).toBe(3);
    expect(new Set(pending.offers.map((o) => o.clubId)).size).toBe(3);
    for (const o of pending.offers) {
      expect(o.deal).toBe("loan");
      expect(o.loanRoute).toBe("step-up");
      expect(o.strength).toBeGreaterThan(base.player.ovr);
      expect(o.clubId).not.toBe(parentBefore);
    }

    // Nur die Unterschrift ansehen: keine Weitersimulation, keine Folgeentscheidung.
    const target = pending.offers[0]!;
    const signedState: GameState = { ...base, pending, queue: [], chunkRemaining: 0 };
    const signed = applyDecision(signedState, target.id);
    expect(signed.player.clubId).toBe(target.clubId);
    expect(signed.player.parentClubId).toBe(parentBefore);
    expect(signed.player.loan).toBe(true);
    expect(signed.player.loanSeasonsLeft).toBeGreaterThanOrEqual(1);

    // Genau eine tatsächlich gespielte Leihsaison.
    const before = signed.seasons.length;
    let s = advanceToNextDecision({ ...signed, lastConsequence: undefined });
    let guard = 0;
    while (s.seasons.length === before && s.pending && guard++ < 10) {
      const p = s.pending;
      const optionId =
        p.kind === "club"
          ? (p.offers[0]?.id ?? "stay")
          : p.kind === "comeback"
            ? (p.offers[0]?.id ?? "comeback-no")
            : (p.options[0]?.id ?? "stay");
      s = applyDecisionAndAdvance(s, optionId);
    }
    expect(s.seasons.length).toBe(before + 1);
    const loanSeason = s.seasons[s.seasons.length - 1]!;
    expect(loanSeason.loan).toBe(true);
    expect(loanSeason.clubId).toBe(target.clubId);
    expect(loanSeason.parentClubId).toBe(parentBefore);

    // Anschließend zurück zum ursprünglichen Stammverein.
    guard = 0;
    while (s.player.loan && !s.retired && guard++ < 20) {
      if (s.pending) {
        const optionId =
          s.pending.kind === "club" || s.pending.kind === "comeback"
            ? "stay"
            : (s.pending.options?.[0]?.id ?? "stay");
        const next = applyDecisionAndAdvance(s, optionId);
        if (next === s) break;
        s = next;
      } else {
        s = advanceToNextDecision(s);
      }
    }
    expect(s.player.loan).toBe(false);
    expect(s.player.parentClubId).toBeUndefined();
    expect(s.player.clubId).toBe(parentBefore);
  });

  it("schwaches junges Talent bekommt keine Step-up-Leihe", () => {
    const s = startCareer(9103);
    const last = s.seasons[s.seasons.length - 1]!;
    const weak: GameState = {
      ...s,
      player: { ...s.player, age: 20, ovr: 50, parentClubId: undefined },
      seasons: [...s.seasons.slice(0, -1), { ...last, apps: 6, rating: 5.9, missedSeason: false }],
    };
    expect(loanRouteFor(weak)).not.toBe("step-up");
  });

  it("aus einer laufenden Leihe entsteht keine verschachtelte Leihe", () => {
    const s = startCareer(9104);
    const onLoan: GameState = {
      ...s,
      player: { ...s.player, age: 20, ovr: 78, parentClubId: s.player.clubId, loan: true, loanSeasonsLeft: 1 },
    };
    expect(loanRouteFor(onLoan)).not.toBe("step-up");
  });

  it("OVR 99 bekommt statt eines leeren Leihpools drei echte feste Transferangebote", () => {
    const s = startCareer(9105);
    const last = s.seasons[s.seasons.length - 1]!;
    const world: GameState = {
      ...s,
      player: { ...s.player, age: 22, ovr: 99, parentClubId: undefined, loan: false, loanSeasonsLeft: 0 },
      seasons: [...s.seasons.slice(0, -1), { ...last, apps: 32, rating: 8.4, missedSeason: false }],
    };
    const decision = buildClubDecision(world, subRng(world.profile.seed, "test", "top", 9105), false);
    expect(decision).not.toBeNull();
    expect(decision!.offers.length).toBe(3);
    expect(new Set(decision!.offers.map((o) => o.clubId)).size).toBe(3);
    for (const o of decision!.offers) {
      expect(o.deal).toBe("transfer");
      expect(o.loanRoute).toBeUndefined();
    }
  });
});
