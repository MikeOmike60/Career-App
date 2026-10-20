import { beforeEach, describe, expect, it } from "vitest";
import {
  advanceToNextDecision,
  applyDecision,
  applyDecisionAndAdvance,
  academyPool,
  comebackCountries,
  createInitialState,
  decisionOptionIds,
  generateOffers,
  signWithClub,
  simulateChunk,
  CLUB_IMPACT_CAP,
} from "./engine";
import { clubsOf, getClub } from "./data";
import { REGIONS, regionName } from "./regions";
import { neighborCountries } from "./neighbors";
import { adjustClubStrength, dynamicStrength, emptyWorld, ensureCountryWorld } from "./world";
import { makeGamble, streakBonus, CHANCE_STREAK_MAX } from "./gamble";
import {
  MAX_PROFILES,
  deleteProfile,
  loadProfiles,
  profileForEditing,
  saveProfile,
  type StoredProfile,
} from "./storage";
import { POSITIONS, type GameState, type Pace, type Profile } from "./types";

function profile(seed: number, over: Partial<Profile> = {}): Profile {
  return {
    name: `QA ${seed}`,
    birthDate: `2008-03-1${seed % 9}`,
    height: 178,
    weight: 74,
    nat1: "DE",
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: "preset:1",
    pace: 1 as Pace,
    seed,
    ...over,
  };
}

/* ------------------------------------------------ 1. Auto-Flow Konsequenz */

function firstDecision(seed: number, pace: Pace): GameState {
  let s = createInitialState(profile(seed, { pace }));
  s = signWithClub(s, s.offers[0]!.clubId);
  s = advanceToNextDecision(s);
  return s;
}

describe("Auto-Flow erhält die Konsequenz", () => {
  for (const pace of [1, 2, 5] as Pace[]) {
    it(`Pace ${pace}: lastConsequence überlebt die automatische Weitersimulation`, () => {
      const s = firstDecision(7 + pace, pace);
      expect(s.pending).toBeTruthy();
      const ids = decisionOptionIds(s.pending!);
      const next = applyDecisionAndAdvance(s, ids[0]!);
      expect(next.lastConsequence).toBeTruthy();
      expect(next.lastConsequence!.optionId).toBe(ids[0]);
      // Es gibt entweder eine neue Entscheidung oder die Karriere ist beendet.
      expect(Boolean(next.pending) || next.retired || next.phase === "end").toBe(true);
    });
  }

  it("manuell gestartete Abschnitte bereinigen alte Konsequenzen", () => {
    const s = firstDecision(31, 1);
    const ids = decisionOptionIds(s.pending!);
    const after = applyDecision(s, ids[0]!);
    expect(after.lastConsequence).toBeTruthy();
    // Ohne offene Folgeentscheidung räumt ein manueller Abschnitt auf.
    const cleaned = simulateChunk({ ...after, pending: undefined });
    expect(cleaned.lastConsequence).toBeUndefined();
  });
});

/* --------------------------------------------------- 2. Profilverwaltung */

class MemStorage {
  map = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new DOMException("full", "QuotaExceededError");
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

let mem: MemStorage;
beforeEach(() => {
  mem = new MemStorage();
  (globalThis as { localStorage?: Storage }).localStorage = mem as unknown as Storage;
});

describe("Profil-Storage", () => {
  it("liefert leer ohne Daten", () => {
    expect(loadProfiles()).toEqual({ profiles: [] });
  });

  it("speichert, lädt und aktualisiert unter stabiler ID", () => {
    const p = profile(5, { region: "BY" });
    const saved = saveProfile(p);
    expect(saved.error).toBeUndefined();
    expect(saved.profiles).toHaveLength(1);
    const id = saved.profiles[0]!.id;

    const again = saveProfile({ ...p, name: "Neu" }, id);
    expect(again.profiles).toHaveLength(1);
    expect(again.profiles[0]!.id).toBe(id);
    expect(again.profiles[0]!.profile.name).toBe("Neu");
    expect(again.profiles[0]!.updatedAt).toBeGreaterThanOrEqual(again.profiles[0]!.createdAt);

    // Ohne ID entsteht ein zweiter Eintrag.
    expect(saveProfile(p).profiles).toHaveLength(2);
  });

  it("löscht gezielt", () => {
    const id = saveProfile(profile(1)).profiles[0]!.id;
    saveProfile(profile(2));
    const res = deleteProfile(id);
    expect(res.profiles).toHaveLength(1);
    expect(res.profiles.some((e) => e.id === id)).toBe(false);
  });

  it("begrenzt auf 12 Profile", () => {
    for (let i = 0; i < MAX_PROFILES; i++) saveProfile(profile(100 + i, { name: `P${i}` }));
    const res = saveProfile(profile(999, { name: "Zuviel" }));
    expect(res.profiles).toHaveLength(MAX_PROFILES);
    expect(res.error).toContain("maximal");
  });

  it("vergibt beim Laden immer einen neuen positiven Seed", () => {
    const entry = saveProfile(profile(4242)).profiles[0]! as StoredProfile;
    const edit = profileForEditing(entry);
    expect(edit.seed).toBeGreaterThan(0);
    expect(edit.seed).not.toBe(4242);
  });

  it("Avatar und Region überstehen den Roundtrip", () => {
    const p = profile(8, { region: "NRW", avatar: "preset:4", nat2: "FR" });
    const entry = saveProfile(p).profiles[0]!;
    expect(entry.profile.avatar).toBe("preset:4");
    expect(entry.profile.region).toBe("NRW");
    expect(entry.profile.nat2).toBe("FR");
  });

  it("meldet kaputtes JSON, ohne zu crashen", () => {
    mem.map.set("legendenweg:profiles:v1", "{kaputt");
    const res = loadProfiles();
    expect(res.profiles).toEqual([]);
    expect(res.error).toBeTruthy();
  });

  it("migriert das alte Array-Format", () => {
    mem.map.set(
      "legendenweg:profiles:v1",
      JSON.stringify([{ id: "alt", savedAt: 1, profile: profile(3) }]),
    );
    const res = loadProfiles();
    expect(res.error).toBeUndefined();
    expect(res.profiles[0]!.id).toBe("alt");
    expect(res.profiles[0]!.updatedAt).toBe(1);
  });

  it("meldet Quota-Fehler als Meldung statt still zu scheitern", () => {
    mem.failWrites = true;
    const res = saveProfile(profile(11));
    expect(res.error).toBeTruthy();
  });

  it("verwirft unvollständige Profile", () => {
    const res = saveProfile({ ...profile(12), name: "" } as Profile);
    expect(res.error).toBeTruthy();
    expect(res.profiles).toHaveLength(0);
  });
});

/* --------------------------------------------- 3. Region auf Startangebot */

describe("Startangebote je Region", () => {
  for (const [country, regions] of Object.entries(REGIONS)) {
    it(`${country}: jede Region liefert genau drei passende Angebote`, () => {
      for (const region of regions) {
        const p = profile(21, { nat1: country, region: region.id, nat2: "BRA" });
        const pool = academyPool(p);
        expect(pool.length).toBeGreaterThanOrEqual(3);
        const state = createInitialState(p);
        const offers = generateOffers(state);
        expect(offers).toHaveLength(3);
        expect(new Set(offers.map((o) => o.clubId)).size).toBe(3);
        for (const o of offers) {
          const club = getClub(o.clubId);
          expect(club.country).toBe(country);
          expect(club.region).toBe(region.id);
          expect(o.country).toBe(country);
          expect(o.region).toBe(region.id);
          expect(o.regionLabel).toBe(regionName(country, region.id));
        }
      }
    });
  }

  it("Nicht-Top-5 funktioniert ohne Region", () => {
    const offers = generateOffers(createInitialState(profile(9, { nat1: "BRA" })));
    expect(offers).toHaveLength(3);
  });
});

/* ------------------------------------------------- 4. Comeback-Geografie */

describe("Comeback-Geografie", () => {
  it("erlaubt nur Heimat und Nachbarn – nie das Gastland", () => {
    const p = profile(17, { nat1: "DE" });
    const allowed = comebackCountries(p);
    expect(allowed).toContain("DE");
    expect(allowed).not.toContain("JP");
    expect(allowed).not.toContain("CN");
    expect(allowed).not.toContain("KOR");
    for (const code of allowed) expect(["DE", ...neighborCountries("DE")]).toContain(code);
  });

  it("berücksichtigt die zweite Nationalität, wenn gesetzt", () => {
    const allowed = comebackCountries(profile(17, { nat1: "DE", nat2: "ES" }));
    expect(allowed).toContain("ES");
  });
});

/* --------------------------------------------------------- 5. Club-Impact */

describe("Club-Impact-Grenzen", () => {
  it("respektiert den Cap von 88", () => {
    const world = emptyWorld();
    const club = clubsOf("DE")[0]!;
    ensureCountryWorld(world, "DE");
    for (let i = 0; i < 40; i++) adjustClubStrength(world, club.id, 2, CLUB_IMPACT_CAP);
    expect(dynamicStrength(world, club.id)).toBeLessThanOrEqual(Math.max(CLUB_IMPACT_CAP, club.strength));
  });

  it("nimmt einen verdienten Schub nicht negativ unter den Startwert zurück", () => {
    const world = emptyWorld();
    const club = clubsOf("DE").find((c) => c.strength <= 70) ?? clubsOf("DE")[0]!;
    ensureCountryWorld(world, "DE");
    const before = dynamicStrength(world, club.id);
    adjustClubStrength(world, club.id, 2, CLUB_IMPACT_CAP);
    expect(dynamicStrength(world, club.id)).toBe(before + 2);
  });
});

/* ------------------------------------------------------ 6. Gamble-Streak */

describe("Gamble-Streak-Schutz", () => {
  it("erhöht die Chance nach zwei Verlusten", () => {
    expect(streakBonus(0)).toBe(0);
    expect(streakBonus(1)).toBe(0);
    expect(streakBonus(2)).toBeGreaterThan(0);
  });

  it("bleibt bei maximal 92 Prozent", () => {
    const g = makeGamble(1234, "d1", "risk", 3, 0, 99);
    expect(g.successChance).toBeLessThanOrEqual(CHANCE_STREAK_MAX);
  });

  it("neutrale Wahl setzt die Pechsträhne zurück", () => {
    let s = firstDecision(55, 1);
    s.gambleLossStreak = 3;
    const ids = s.pending!.kind === "ovr" ? decisionOptionIds(s.pending!) : [];
    if (ids.length >= 2) {
      s = applyDecision(s, ids[1]!);
      expect(s.gambleLossStreak).toBe(0);
    }
  });
});
