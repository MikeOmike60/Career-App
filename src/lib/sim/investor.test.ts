import { describe, expect, it } from "vitest";
import {
  applyDecision,
  buildClubDecision,
  createInitialState,
  decisionOptionIds,
  signAndAdvance,
  STATE_VERSION,
} from "./engine";
import {
  INVESTOR_MIN_OVR,
  INVESTOR_STRENGTH_MAX,
  INVESTOR_STRENGTH_MIN,
  activateInvestorProject,
  buildInvestorDecision,
  buildInvestorProject,
  buildInvestorStars,
  investorChance,
  investorEligible,
  isInvestorTarget,
} from "./investor";
import { subRng } from "./rng";
import { dynamicStrength, profileOf } from "./world";
import { getClub } from "./data";
import { migrateState } from "./storage";
import type { GameState, Profile } from "./types";

function profile(seed: number, over: Partial<Profile> = {}): Profile {
  return {
    name: "Investor Tester",
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

/** Echte, gespielte Karriere als Fixture – keine handgebauten Teilobjekte. */
function startCareer(seed: number): GameState {
  const s0 = createInitialState(profile(seed));
  return signAndAdvance(s0, s0.offers[0]!.clubId);
}

/** Bringt eine echte Karriere in einen investorfähigen Zustand. */
function eligibleState(seed: number, ovr = 88, age = 27): GameState {
  const s = startCareer(seed);
  s.player.ovr = ovr;
  s.player.age = age;
  s.player.loan = false;
  s.player.parentClubId = undefined;
  s.player.loanSeasonsLeft = 0;
  // Timeline konsistent halten: die Engine klammert das OVR an die letzte Saison.
  const last = s.seasons[s.seasons.length - 1];
  if (last) {
    last.startOvr = ovr;
    last.endOvr = ovr;
  }
  s.peakOvr = Math.max(s.peakOvr, ovr);
  return s;
}

const rngFor = (s: GameState, tag = "t") => subRng(s.profile.seed, tag, s.seasonIndex);

describe("Investoren-Projekt · Voraussetzungen", () => {
  it("gibt es unter 80 OVR nie", () => {
    expect(investorChance(79)).toBe(0);
    expect(investorChance(INVESTOR_MIN_OVR)).toBeGreaterThan(0);
    const s = eligibleState(11, 79);
    expect(investorEligible(s)).toBe(false);
    expect(buildInvestorDecision(s, subRng(1, "always"), "2030/31")).toBeNull();
  });

  it("steigt mit dem OVR und bleibt pro Saison unter einem Drittel", () => {
    expect(investorChance(82)).toBeLessThan(investorChance(87));
    expect(investorChance(87)).toBeLessThan(investorChance(93));
    expect(investorChance(99)).toBeLessThanOrEqual(0.3);
  });

  it("greift nur im Alterskorridor 20–35", () => {
    expect(investorEligible(eligibleState(12, 88, 19))).toBe(false);
    expect(investorEligible(eligibleState(12, 88, 36))).toBe(false);
    expect(investorEligible(eligibleState(12, 88, 27))).toBe(true);
  });

  it("greift nicht aus einer laufenden Leihe heraus", () => {
    const s = eligibleState(13);
    s.player.loan = true;
    s.player.parentClubId = s.player.clubId;
    s.player.loanSeasonsLeft = 1;
    expect(investorEligible(s)).toBe(false);
  });
});

describe("Investoren-Projekt · Zielverein und Welt", () => {
  it("wählt einen Verein, der vorher nicht zur Elite gehört", () => {
    const s = eligibleState(21);
    const project = buildInvestorProject(s, rngFor(s), "2032/33")!;
    expect(project).toBeTruthy();
    const club = getClub(project.clubId);
    expect(["global-giant", "continental-elite"]).not.toContain(profileOf(club.id).band);
    expect(project.clubId).not.toBe(s.player.clubId);
    expect(isInvestorTarget(s, club)).toBe(true);
  });

  it("hebt die Clubstärke real in den Korridor 80–87", () => {
    const s = eligibleState(22);
    const project = buildInvestorProject(s, rngFor(s), "2032/33")!;
    expect(project.strengthAfter).toBeGreaterThanOrEqual(INVESTOR_STRENGTH_MIN);
    expect(project.strengthAfter).toBeLessThanOrEqual(INVESTOR_STRENGTH_MAX);
    expect(project.strengthAfter).toBeGreaterThan(project.strengthBefore);
    activateInvestorProject(s, project);
    expect(Math.round(dynamicStrength(s.world, project.clubId))).toBe(project.strengthAfter);
  });

  it("verpflichtet 3–5 benannte Stars und liefert ein vollständiges Dossier", () => {
    const s = eligibleState(23);
    const project = buildInvestorProject(s, rngFor(s), "2032/33")!;
    expect(project.stars.length).toBeGreaterThanOrEqual(3);
    expect(project.stars.length).toBeLessThanOrEqual(5);
    expect(new Set(project.stars.map((x) => x.name)).size).toBe(project.stars.length);
    for (const star of project.stars) {
      expect(star.name.split(" ").length).toBeGreaterThanOrEqual(2);
      expect(star.ovr).toBeGreaterThanOrEqual(80);
    }
    expect(project.stadiumAfter).not.toBe(project.stadiumBefore);
    expect(project.infrastructureAfter).not.toBe(project.infrastructureBefore);
    expect(project.wage).toBeGreaterThan(0);
    expect(project.firstYearGuarantee).toBe(project.wage * 52 + project.signingBonus);
    expect(project.contractYears).toBeGreaterThanOrEqual(3);
    expect(project.target).toMatch(/garantiert ist nichts/i);
  });

  it("ist bei gleichem Seed exakt reproduzierbar (kein Reroll nach Reload)", () => {
    const a = buildInvestorProject(eligibleState(24), subRng(24, "x", 0), "2032/33")!;
    const b = buildInvestorProject(eligibleState(24), subRng(24, "x", 0), "2032/33")!;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const starsA = buildInvestorStars(subRng(7, "stars"));
    const starsB = buildInvestorStars(subRng(7, "stars"));
    expect(starsA).toEqual(starsB);
  });
});

describe("Investoren-Projekt · Fenster", () => {
  /** Erzeugt das Fenster garantiert, indem die Chance auf 100 % gezogen wird. */
  function forceWindow(s: GameState) {
    const rng = subRng(s.profile.seed, "force", s.seasonIndex);
    return buildInvestorDecision(s, { ...rng, chance: () => true }, "2034/35");
  }

  it("hat genau ein Projektangebot plus Bleiben", () => {
    const s = eligibleState(31);
    const decision = forceWindow(s)!;
    expect(decision).toBeTruthy();
    expect(decision.variant).toBe("investor");
    expect(decision.offers).toHaveLength(1);
    expect(decision.forced).toBe(false);
    expect(decisionOptionIds(decision)).toEqual([decision.offers[0]!.id, "stay"]);
    expect(decision.project?.clubId).toBe(decision.offers[0]!.clubId);
  });

  it("wird durch die Übernahme sofort Weltgeschichte und ist einmalig", () => {
    const s = eligibleState(32);
    const decision = forceWindow(s)!;
    expect(s.investorOffered).toBe(true);
    expect(s.investorProject?.id).toBe(decision.id);
    // Zweiter Versuch derselben Karriere: nichts mehr.
    expect(forceWindow(s)).toBeNull();
  });

  it("verdrängt das normale Fenster nicht dauerhaft", () => {
    const s = eligibleState(33);
    forceWindow(s);
    const ordinary = buildClubDecision(s, rngFor(s, "ordinary"), false);
    expect(ordinary?.offers).toHaveLength(3);
    expect(ordinary?.variant).toBe("window");
  });
});

describe("Investoren-Projekt · Annahme und Ablehnung", () => {
  function windowState(seed: number): GameState {
    const s = eligibleState(seed, 92, 26);
    const rng = subRng(seed, "force", s.seasonIndex);
    const decision = buildInvestorDecision(s, { ...rng, chance: () => true }, "2034/35")!;
    s.pending = decision;
    return s;
  }

  it("Annahme: fester Wechsel, riesiges Paket, dauerhafte Absicherung, kein OVR-Bonus", () => {
    const s = windowState(41);
    const project = s.investorProject!;
    const before = s.player.ovr;
    const next = applyDecision(s, (s.pending as { offers: { id: string }[] }).offers[0]!.id);
    expect(next.player.clubId).toBe(project.clubId);
    expect(next.player.loan).toBe(false);
    expect(next.player.parentClubId).toBeUndefined();
    expect(next.player.ovr).toBe(before);
    expect(next.player.wage).toBe(project.wage);
    expect(next.player.contractYears).toBe(project.contractYears);
    expect(next.wealth?.financiallySecure).toBe(true);
    expect(next.wealth?.careerEarnings).toBe(project.firstYearGuarantee);
    expect(next.investorProject?.accepted).toBe(true);
    expect(next.investorProject?.joinedSeason).toBe(s.seasonIndex);
    expect(next.decisions.at(-1)?.consequence).toMatch(/abgesichert/i);
    expect(next.seasons.at(-1)?.investorNote).toMatch(/unterschrieben/);
  });

  it("Ablehnung: Verein bleibt, Projekt läuft weiter, Gelegenheit verbraucht", () => {
    const s = windowState(42);
    const clubBefore = s.player.clubId;
    const project = s.investorProject!;
    const next = applyDecision(s, "stay");
    expect(next.player.clubId).toBe(clubBefore);
    expect(next.investorProject?.accepted).toBe(false);
    expect(next.investorOffered).toBe(true);
    expect(next.wealth?.financiallySecure).toBeUndefined();
    expect(Math.round(dynamicStrength(next.world, project.clubId))).toBe(project.strengthAfter);
    expect(next.seasons.at(-1)?.investorNote).toMatch(/abgelehnt/);
  });

  it("die Welt entwickelt den Projektverein normal weiter (keine Immunität)", () => {
    const s = windowState(43);
    const project = s.investorProject!;
    // Die Projektstärke liegt im normalen Korridor und nicht über dem Weltmaximum.
    expect(dynamicStrength(s.world, project.clubId)).toBeLessThanOrEqual(95);
    expect(project.strengthAfter).toBeLessThanOrEqual(INVESTOR_STRENGTH_MAX);
  });
});

describe("Investoren-Projekt · Spielstände", () => {
  it("alte Stände bleiben gültig und behalten die Gelegenheit", () => {
    const s = startCareer(51);
    const old = JSON.parse(JSON.stringify({ ...s, version: 13 })) as GameState;
    delete (old as Partial<GameState>).investorProject;
    delete (old as Partial<GameState>).investorOffered;
    const migrated = migrateState(old)!;
    expect(migrated.version).toBe(STATE_VERSION);
    expect(migrated.investorOffered).toBe(false);
    expect(migrated.investorProject).toBeUndefined();
  });

  it("ein gespeichertes Investoren-Fenster übersteht Speichern und Laden", () => {
    const s = eligibleState(52, 90, 28);
    const rng = subRng(52, "force", s.seasonIndex);
    s.pending = buildInvestorDecision(s, { ...rng, chance: () => true }, "2034/35")!;
    const reloaded = migrateState(JSON.parse(JSON.stringify(s)) as GameState)!;
    expect(reloaded.pending?.kind).toBe("club");
    expect(reloaded.pending && "variant" in reloaded.pending ? reloaded.pending.variant : undefined).toBe("investor");
    expect(reloaded.investorProject?.clubId).toBe(s.investorProject?.clubId);
    expect(reloaded.investorOffered).toBe(true);
  });
});
