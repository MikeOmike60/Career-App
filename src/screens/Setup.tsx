import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Dices, Search, Upload, X } from "lucide-react";
import { COUNTRIES, REAL_DATA_INFO } from "@/lib/sim/data";
import { POSITIONS, type Pace, type Position, type Profile } from "@/lib/sim/types";
import { REGIONS, isTop5, regionName } from "@/lib/sim/regions";
import {
  MAX_PROFILES,
  deleteProfile,
  loadProfiles,
  profileForEditing,
  saveProfile,
  type StoredProfile,
} from "@/lib/sim/storage";
import { randomSeed } from "@/lib/sim/rng";
import { AVATAR_PRESETS, Avatar } from "@/ui/Avatar";
import { Flag } from "@/ui/Flag";
import { Sheet, TopBar } from "@/ui/primitives";
import { tap, useBackHandler, warn } from "@/ui/native";
import { loadImage } from "@/ui/fifaFace";
import { FaceStudio } from "./FaceStudio";
import { TRAITS, parseTraits } from "@/lib/sim/personality";

export const POSITION_LABEL: Record<Position, string> = {
  TW: "Torwart",
  IV: "Innenverteidigung",
  LV: "Linksverteidigung",
  RV: "Rechtsverteidigung",
  ZDM: "Defensives Mittelfeld",
  ZM: "Zentrales Mittelfeld",
  ZOM: "Offensives Mittelfeld",
  LM: "Linkes Mittelfeld",
  RM: "Rechtes Mittelfeld",
  LF: "Linksaußen",
  RF: "Rechtsaußen",
  ST: "Sturm",
};

/** Positionen auf dem Spielfeld (x/y in %, Angriff oben). */
const PITCH: Record<Position, [number, number]> = {
  ST: [50, 11],
  LF: [17, 19],
  RF: [83, 19],
  ZOM: [50, 32],
  LM: [14, 44],
  RM: [86, 44],
  ZM: [50, 49],
  ZDM: [50, 64],
  LV: [15, 72],
  RV: [85, 72],
  IV: [50, 79],
  TW: [50, 92],
};

const PACES: { value: Pace; title: string; text: string }[] = [
  { value: 1, title: "Jede Saison", text: "Ein Anpfiff simuliert eine Saison. Maximal eine Lebenssituation pro Anpfiff." },
  { value: 2, title: "Alle 2 Saisons", text: "Ein Anpfiff simuliert zwei Saisons am Stück – trotzdem höchstens eine Entscheidung." },
  { value: 5, title: "Alle 5 Saisons", text: "Ein Anpfiff simuliert fünf Saisons – auch hier tritt höchstens eine Entscheidung auf." },
];

const STEPS = ["Profil", "Herkunft", "Position", "Karriere"] as const;
const STEP_OF_FIELD: Record<string, number> = {
  name: 0,
  personality: 0,
  birthDate: 0,
  height: 0,
  weight: 0,
  nat1: 1,
  nat2: 1,
  region: 1,
  pos: 2,
  pos2: 2,
  seed: 3,
};

/* -------------------------------------------------------------- Länderwahl */

function CountryPicker({
  open,
  onClose,
  onPick,
  exclude,
  value,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (code: string) => void;
  exclude?: string | undefined;
  value?: string | undefined;
  title: string;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = COUNTRIES.filter((c) => c.code !== exclude);
    return (q ? base.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().startsWith(q)) : base).slice(0, 80);
  }, [query, exclude]);
  return (
    <Sheet open={open} onClose={onClose} title={title} eyebrow="Nationalität" full>
      <div className="row" style={{ position: "sticky", top: -14, background: "#fff", margin: "-14px -14px 10px", padding: "12px 14px", zIndex: 1, borderBottom: "1px solid var(--line)" }}>
        <Search size={18} className="muted" />
        <input
          className="input"
          style={{ border: 0, boxShadow: "none", minHeight: 40, padding: 4 }}
          placeholder="Land suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Land suchen"
        />
      </div>
      {list.length === 0 && <p className="muted small">Kein Land gefunden.</p>}
      <div style={{ display: "grid", gap: 6 }}>
        {list.map((c) => (
          <button
            key={c.code}
            type="button"
            className="choice row"
            aria-pressed={value === c.code}
            onClick={() => {
              tap();
              onPick(c.code);
              onClose();
            }}
          >
            <Flag code={c.code} size={22} />
            <span className="grow break" style={{ fontWeight: 600 }}>
              {c.name}
            </span>
            {value === c.code && <Check size={18} color="var(--blue)" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string | undefined; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Setup */

export function Setup({ onStart, onExit }: { onStart: (profile: Profile) => void; onExit: () => void }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState(() => `${new Date().getFullYear() - 16}-03-14`);
  const [height, setHeight] = useState(180);
  const [weight, setWeight] = useState(74);
  const [nat1, setNat1] = useState<string | undefined>(undefined);
  const [nat2, setNat2] = useState<string | undefined>(undefined);
  const [region, setRegion] = useState<string | undefined>(undefined);
  const [pos, setPos] = useState<Position | undefined>(undefined);
  const [pos2, setPos2] = useState<Position | undefined>(undefined);
  const [posMode, setPosMode] = useState<"main" | "second">("main");
  const [avatar, setAvatar] = useState<string>("preset:2");
  const [pace, setPace] = useState<Pace>(1);
  const [personality, setPersonality] = useState("");
  const detectedTraits = parseTraits(personality);
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState("");
  const [picker, setPicker] = useState<"nat1" | "nat2" | null>(null);
  const [profiles, setProfiles] = useState<StoredProfile[]>([]);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const [studioPhoto, setStudioPhoto] = useState<string | null>(null);

  useEffect(() => {
    const res = loadProfiles();
    setProfiles(res.profiles);
    setProfileError(res.error ?? "");
  }, []);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  useBackHandler(step > 0, () => go(step - 1));

  const handleUpload = async (file: File) => {
    setUploadError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setUploadError("Nur PNG, JPG oder WEBP sind erlaubt.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Das Bild darf höchstens 5 MB groß sein.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    }).catch(() => "");
    if (!dataUrl) {
      setUploadError("Das Bild konnte nicht gelesen werden.");
      return;
    }
    // Foto für das FIFA-Studio vorbereiten (max. 1024 px).
    try {
      const img = await loadImage(dataUrl);
      const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      setStudioPhoto(canvas.toDataURL("image/jpeg", 0.9));
    } catch {
      setUploadError("Das Bild konnte nicht verarbeitet werden.");
    }
  };

  /** Normales Foto: quadratisch auf 256 px – der Spielstand bleibt klein. */
  const applyOriginalPhoto = async (dataUrl: string) => {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return setAvatar(dataUrl);
    const min = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
    setAvatar(canvas.toDataURL("image/jpeg", 0.82));
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e["name"] = "Bitte gib einen Spielernamen mit mindestens 2 Zeichen ein.";
    if (name.trim().length > 24) e["name"] = "Der Name darf höchstens 24 Zeichen haben.";
    if (!birthDate) e["birthDate"] = "Bitte wähle ein Geburtsdatum.";
    else {
      const year = new Date(birthDate).getFullYear();
      const now = new Date().getFullYear();
      if (Number.isNaN(year) || year < now - 80 || year > now - 10)
        e["birthDate"] = `Bitte wähle ein plausibles Geburtsdatum (${now - 80}–${now - 10}).`;
    }
    if (height < 155 || height > 210) e["height"] = "Die Größe muss zwischen 155 und 210 cm liegen.";
    if (weight < 50 || weight > 120) e["weight"] = "Das Gewicht muss zwischen 50 und 120 kg liegen.";
    if (!nat1) e["nat1"] = "Bitte wähle eine primäre Nationalität.";
    if (nat2 && nat2 === nat1) e["nat2"] = "Die zweite Nationalität muss sich von der ersten unterscheiden.";
    if (isTop5(nat1) && !region) e["region"] = "Bitte wähle deine Herkunftsregion.";
    if (!pos) e["pos"] = "Bitte wähle eine Hauptposition.";
    if (pos2 && pos2 === pos) e["pos2"] = "Die Nebenposition muss sich von der Hauptposition unterscheiden.";
    if (!Number.isFinite(seed) || seed <= 0) e["seed"] = "Der Seed muss eine positive Zahl sein.";
    if (personality.trim().length > 160) e["personality"] = "Bitte höchstens 160 Zeichen.";
    return e;
  };

  /** Prüft nur die Felder des aktuellen Schritts. */
  const next = () => {
    const e = validate();
    const own = Object.fromEntries(Object.entries(e).filter(([k]) => STEP_OF_FIELD[k] === step));
    setErrors(own);
    if (Object.keys(own).length) {
      warn();
      return;
    }
    tap();
    go(step + 1);
  };

  const buildProfile = (): Profile | null => {
    const e = validate();
    setErrors(e);
    const keys = Object.keys(e);
    if (keys.length) {
      warn();
      const first = Math.min(...keys.map((k) => STEP_OF_FIELD[k] ?? 0));
      if (first !== step) go(first);
      return null;
    }
    return {
      name: name.trim(),
      birthDate,
      height,
      weight,
      nat1: nat1!,
      ...(nat2 ? { nat2 } : {}),
      ...(isTop5(nat1) && region ? { region } : {}),
      pos: pos!,
      ...(pos2 ? { pos2 } : {}),
      avatar,
      pace,
      seed,
      ...(personality.trim() ? { personality: personality.trim() } : {}),
    };
  };

  const submit = () => {
    const built = buildProfile();
    if (built) onStart(built);
  };

  const handleSaveProfile = () => {
    setProfileNotice("");
    const built = buildProfile();
    if (!built) {
      setProfileError("Bitte korrigiere zuerst die markierten Felder.");
      return;
    }
    const res = saveProfile(built, activeProfileId);
    setProfiles(res.profiles);
    setProfileError(res.error ?? "");
    if (!res.error) {
      const entry = res.profiles.find((x) => x.profile.name === built.name && x.profile.seed === built.seed);
      if (entry) setActiveProfileId(entry.id);
      setProfileNotice(activeProfileId ? "Profil aktualisiert." : "Profil gespeichert.");
    }
  };

  const handleDelete = (id: string) => {
    const res = deleteProfile(id);
    setProfiles(res.profiles);
    setProfileError(res.error ?? "");
    setConfirmDeleteId(undefined);
    if (activeProfileId === id) setActiveProfileId(undefined);
  };

  const applyProfile = (entry: StoredProfile) => {
    // Der Seed wird bewusst neu gewürfelt – jeder Start variiert.
    const pr = profileForEditing(entry);
    setName(pr.name);
    setBirthDate(pr.birthDate);
    setHeight(pr.height);
    setWeight(pr.weight);
    setNat1(pr.nat1);
    setNat2(pr.nat2);
    setRegion(pr.region);
    setPos(pr.pos);
    setPos2(pr.pos2);
    setAvatar(pr.avatar);
    setPace(pr.pace);
    setSeed(pr.seed);
    setPersonality(pr.personality ?? "");
    setErrors({});
    setActiveProfileId(entry.id);
    setProfileNotice(`Profil „${pr.name}“ geladen · neuer Seed ${pr.seed}`);
    setProfileError("");
  };

  const pickPosition = (p: Position) => {
    tap();
    if (posMode === "main") {
      setPos(p);
      if (pos2 === p) setPos2(undefined);
    } else {
      if (p === pos) return;
      setPos2(pos2 === p ? undefined : p);
    }
  };

  return (
    <div className="screen">
      <TopBar
        title="Erschaffe deinen Spieler"
        sub={`Schritt ${step + 1}/4 · ${STEPS[step]}`}
        onBack={() => (step > 0 ? go(step - 1) : onExit())}
      />
      {/* Fortschritt als Hexagon-Kette */}
      <div className="tabs">
        <div className="tabs-inner" style={{ justifyContent: "space-between", padding: "8px 14px" }}>
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => i < step && go(i)}
              className="row"
              style={{ gap: 6, opacity: i <= step ? 1 : 0.45 }}
              aria-current={i === step ? "step" : undefined}
            >
              <span
                className="ovr-hex"
                style={{
                  width: 26,
                  height: 29,
                  fontSize: 13,
                  background: i < step ? "var(--lime-2)" : i === step ? "var(--blue)" : "#9aa8b4",
                }}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </span>
              <span className={`h-section step-label ${i === step ? "current" : ""}`} style={{ fontSize: 14 }}>
                {s}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="scroll">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -60 }}
            transition={{ duration: 0.22 }}
            className="content"
          >
            {step === 0 && (
              <div className="stack">
                <div className="panel pad">
                  <div className="row" style={{ gap: 14 }}>
                    <Avatar avatar={avatar} name={name} size={84} />
                    <div className="grow">
                      <div className="h-display break" style={{ fontSize: 26 }}>
                        {name || "Namenlos"}
                      </div>
                      <div className="small muted">
                        {pos ? POSITION_LABEL[pos] : "Position offen"} · {height} cm · {weight} kg
                      </div>
                    </div>
                  </div>
                  <div className="divider" />
                  <div className="label">Avatar wählen</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 6 }}>
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        aria-label={`Avatar-Vorlage ${preset.split(":")[1]}`}
                        aria-pressed={avatar === preset}
                        onClick={() => {
                          tap();
                          setAvatar(preset);
                        }}
                        style={{
                          borderRadius: 6,
                          overflow: "hidden",
                          boxShadow: avatar === preset ? "0 0 0 3px var(--blue)" : "0 0 0 1px var(--line)",
                          aspectRatio: "1",
                        }}
                      >
                        <Avatar avatar={preset} fluid />
                      </button>
                    ))}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f);
                      e.target.value = "";
                    }}
                  />
                  <div className="row" style={{ marginTop: 10 }}>
                    <button type="button" className="btn ghost small grow" onClick={() => fileRef.current?.click()}>
                      <Upload size={16} /> Foto → FIFA-Gesicht
                    </button>
                    {avatar.startsWith("data:") && (
                      <button type="button" className="btn ghost small" onClick={() => setAvatar("preset:2")}>
                        <X size={16} /> Entfernen
                      </button>
                    )}
                  </div>
                  {uploadError && <p className="error">{uploadError}</p>}
                </div>

                <div className="panel pad">
                  <Field label="Spielername" error={errors["name"]} htmlFor="name">
                    <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Mika Ferreira" autoComplete="off" />
                  </Field>
                  <Field label="Geburtsdatum" error={errors["birthDate"]} htmlFor="birth">
                    <input id="birth" className="input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                  </Field>
                  <div className="grid-2" style={{ marginTop: 14 }}>
                    <Field label="Größe (cm)" error={errors["height"]} htmlFor="height">
                      <input id="height" className="input tnum" type="number" inputMode="numeric" min={155} max={210} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
                    </Field>
                    <Field label="Gewicht (kg)" error={errors["weight"]} htmlFor="weight">
                      <input id="weight" className="input tnum" type="number" inputMode="numeric" min={50} max={120} value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
                    </Field>
                  </div>
                </div>

                <div className="panel pad">
                  <Field
                    label="Persönlichkeit (optional)"
                    error={errors["personality"]}
                    htmlFor="personality"
                    hint="Beschreib dich in ein paar Worten. Das Spiel erkennt z. B. loyal, ehrgeizig, geldgierig, Hitzkopf, Partylöwe, Führungsspieler, bescheiden oder Vollprofi – und deine Karriere reagiert darauf."
                  >
                    <textarea
                      id="personality"
                      className="input"
                      rows={2}
                      maxLength={160}
                      value={personality}
                      onChange={(e) => setPersonality(e.target.value)}
                      placeholder="z. B. Loyal bis in die Knochen, aber ein echter Hitzkopf auf dem Platz"
                      style={{ resize: "none", minHeight: 64 }}
                    />
                  </Field>
                  {detectedTraits.length > 0 && (
                    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                      {detectedTraits.map((t) => (
                        <motion.div key={t} className="row" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ alignItems: "flex-start", gap: 8 }}>
                          <span className="chip lime" style={{ flex: "none" }}>
                            {TRAITS[t].label}
                          </span>
                          <span className="tiny muted">{TRAITS[t].effect}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  {personality.trim() && detectedTraits.length === 0 && (
                    <p className="hint">Noch kein Charakterzug erkannt – deine Beschreibung erscheint trotzdem in deiner Lebensgeschichte.</p>
                  )}
                </div>

                <div className="panel pad">
                  <div className="row">
                    <h3 className="h-section grow">Gespeicherte Profile</h3>
                    <span className="chip tnum">
                      {profiles.length}/{MAX_PROFILES}
                    </span>
                  </div>
                  {profileError ? <p className="notice error" style={{ marginTop: 8 }}>{profileError}</p> : null}
                  {profileNotice ? <p className="small" style={{ color: "var(--blue)", marginTop: 8 }}>{profileNotice}</p> : null}
                  {profiles.length === 0 ? (
                    <p className="small muted" style={{ marginBottom: 0 }}>
                      Noch keine Profile gespeichert. Im letzten Schritt kannst du dein Profil speichern.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                      {profiles.map((entry) => (
                        <div key={entry.id} className="row choice" aria-pressed={entry.id === activeProfileId} style={{ padding: "6px 8px" }}>
                          <button type="button" className="grow row" style={{ textAlign: "left", minHeight: 40 }} onClick={() => applyProfile(entry)}>
                            <Avatar avatar={entry.profile.avatar} size={36} />
                            <span className="grow">
                              <span className="break" style={{ display: "block", fontWeight: 700 }}>
                                {entry.profile.name}
                              </span>
                              <span className="tiny muted break">
                                {entry.profile.pos} · {entry.profile.nat1}
                                {entry.profile.region ? ` · ${regionName(entry.profile.nat1, entry.profile.region)}` : ""}
                              </span>
                            </span>
                          </button>
                          {confirmDeleteId === entry.id ? (
                            <span className="row" style={{ gap: 4 }}>
                              <button type="button" className="btn danger small" onClick={() => handleDelete(entry.id)}>
                                Löschen
                              </button>
                              <button type="button" className="btn ghost small" onClick={() => setConfirmDeleteId(undefined)}>
                                <X size={16} />
                              </button>
                            </span>
                          ) : (
                            <button type="button" className="btn ghost small" aria-label={`Profil ${entry.profile.name} löschen`} onClick={() => setConfirmDeleteId(entry.id)}>
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="stack">
                <div className="panel pad">
                  <Field label="Primäre Nationalität" error={errors["nat1"]}>
                    <button type="button" className="choice row" style={{ width: "100%" }} onClick={() => setPicker("nat1")}>
                      {nat1 ? <Flag code={nat1} size={22} /> : null}
                      <span className={`grow ${nat1 ? "" : "muted"}`} style={{ fontWeight: 600 }}>
                        {nat1 ? COUNTRIES.find((c) => c.code === nat1)?.name : "Land wählen"}
                      </span>
                      <ChevronRight size={18} className="muted" />
                    </button>
                  </Field>
                  {isTop5(nat1) && (
                    <Field label="Herkunftsregion (Pflicht)" error={errors["region"]} hint="Deine Startangebote kommen ausschließlich aus dieser Region." htmlFor="region">
                      <select id="region" className="input" value={region ?? ""} onChange={(e) => setRegion(e.target.value || undefined)}>
                        <option value="">Region wählen</option>
                        {(REGIONS[nat1!] ?? []).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field label="Zweite Nationalität (optional)" error={errors["nat2"]} hint="Mit zwei Nationalitäten können später seltene Nationalteam-Entscheidungen entstehen.">
                    <div className="row">
                      <button type="button" className="choice row grow" onClick={() => setPicker("nat2")}>
                        {nat2 ? <Flag code={nat2} size={22} /> : null}
                        <span className={`grow ${nat2 ? "" : "muted"}`} style={{ fontWeight: 600 }}>
                          {nat2 ? COUNTRIES.find((c) => c.code === nat2)?.name : "Keine"}
                        </span>
                        <ChevronRight size={18} className="muted" />
                      </button>
                      {nat2 && (
                        <button type="button" className="btn ghost small" aria-label="Zweite Nationalität entfernen" onClick={() => setNat2(undefined)}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </Field>
                </div>
                <p className="tiny muted" style={{ padding: "0 4px" }}>
                  Echte Vereinsnamen für {REAL_DATA_INFO.realNamesCountries} Kernverbände ({REAL_DATA_INFO.realClubs} Vereine) – alle anderen Länder mit generierten Vereinen.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="stack">
                <div className="panel" style={{ padding: 6, display: "flex", gap: 6 }}>
                  {(["main", "second"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`btn small grow ${posMode === m ? "blue" : "ghost"}`}
                      onClick={() => setPosMode(m)}
                    >
                      {m === "main" ? `Hauptposition${pos ? ` · ${pos}` : ""}` : `Nebenposition${pos2 ? ` · ${pos2}` : ""}`}
                    </button>
                  ))}
                </div>
                {/* Spielfeld mit Positions-Hexagons */}
                <div
                  className="panel"
                  style={{
                    position: "relative",
                    aspectRatio: "0.72",
                    maxHeight: "62vh",
                    margin: "12px auto 0",
                    overflow: "hidden",
                    background: "repeating-linear-gradient(180deg,#3aa04a 0 9%,#349443 9% 18%)",
                    border: "3px solid #fff",
                  }}
                >
                  <svg viewBox="0 0 100 140" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
                    <g fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="0.7">
                      <rect x="4" y="4" width="92" height="132" />
                      <line x1="4" y1="70" x2="96" y2="70" />
                      <circle cx="50" cy="70" r="12" />
                      <rect x="24" y="4" width="52" height="20" />
                      <rect x="24" y="116" width="52" height="20" />
                      <rect x="38" y="4" width="24" height="8" />
                      <rect x="38" y="128" width="24" height="8" />
                    </g>
                  </svg>
                  {POSITIONS.map((p) => {
                    const [x, y] = PITCH[p];
                    const main = pos === p;
                    const second = pos2 === p;
                    return (
                      <motion.button
                        key={p}
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => pickPosition(p)}
                        aria-pressed={main || second}
                        aria-label={`${POSITION_LABEL[p]}${main ? " (Hauptposition)" : second ? " (Nebenposition)" : ""}`}
                        className="ovr-hex"
                        style={{
                          position: "absolute",
                          left: `${x}%`,
                          top: `${y}%`,
                          width: 54,
                          height: 60,
                          marginLeft: -27,
                          marginTop: -30,
                          fontSize: 17,
                          background: main
                            ? "linear-gradient(160deg,#b6ea5c,#5fa514)"
                            : second
                              ? "linear-gradient(160deg,#5cc4ff,#0560a3)"
                              : "rgba(255,255,255,.92)",
                          color: main ? "#10200a" : second ? "#fff" : "#13202b",
                        }}
                        animate={main || second ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                        transition={{ duration: 0.35 }}
                      >
                        {p}
                      </motion.button>
                    );
                  })}
                </div>
                <p className="small" style={{ textAlign: "center", fontWeight: 700 }}>
                  {pos ? POSITION_LABEL[pos] : "Tippe auf deine Position"}
                  {pos2 ? ` · Neben: ${POSITION_LABEL[pos2]}` : ""}
                </p>
                {errors["pos"] && <p className="error" style={{ textAlign: "center" }}>{errors["pos"]}</p>}
                {errors["pos2"] && <p className="error" style={{ textAlign: "center" }}>{errors["pos2"]}</p>}
              </div>
            )}

            {step === 3 && (
              <div className="stack">
                <div className="panel pad">
                  <div className="label">Karrieretempo</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {PACES.map((p) => (
                      <button key={p.value} type="button" className="choice" aria-pressed={pace === p.value} onClick={() => setPace(p.value)}>
                        <span className="h-section" style={{ display: "block", fontSize: 17 }}>
                          {p.title}
                        </span>
                        <span className="small muted">{p.text}</span>
                      </button>
                    ))}
                  </div>
                  <Field label="Start-Seed" error={errors["seed"]} hint="Gleiche Eingaben und derselbe Seed erzeugen dieselbe Karriere." htmlFor="seed">
                    <div className="row">
                      <input id="seed" className="input tnum grow" type="number" inputMode="numeric" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
                      <button type="button" className="btn ghost" aria-label="Neuen Seed würfeln" onClick={() => setSeed(randomSeed())}>
                        <Dices size={20} />
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="panel pad">
                  <div className="row">
                    <Avatar avatar={avatar} name={name} size={56} />
                    <div className="grow">
                      <div className="h-section break">{name || "Namenlos"}</div>
                      <div className="small muted row" style={{ gap: 6, flexWrap: "wrap" }}>
                        {nat1 && <Flag code={nat1} />}
                        {nat2 && <Flag code={nat2} />}
                        <span>{pos ?? "?"}{pos2 ? `/${pos2}` : ""}</span>
                        <span>· {PACES.find((p) => p.value === pace)?.title}</span>
                      </div>
                    </div>
                  </div>
                  <p className="tiny muted" style={{ marginBottom: 0 }}>
                    Startalter (14–16) und Start-OVR (50–75, meist niedrig) werden beim Start ausgewürfelt und erst danach enthüllt.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ flex: "none", padding: "10px 14px calc(12px + var(--safe-bottom))", background: "linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.95) 30%)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 8 }}>
          {step < 3 ? (
            <button type="button" className="btn primary block" onClick={next}>
              Weiter <ChevronRight size={20} />
            </button>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={handleSaveProfile}>
                Speichern
              </button>
              <button type="button" className="btn primary grow shine" onClick={submit}>
                Karriere beginnen
              </button>
            </>
          )}
        </div>
      </div>

      <FaceStudio
        photo={studioPhoto}
        name={name}
        nat={nat1 ?? "DE"}
        pos={pos ?? "ST"}
        onClose={() => setStudioPhoto(null)}
        onUse={(url) => {
          const photo = studioPhoto;
          setStudioPhoto(null);
          if (url === photo) void applyOriginalPhoto(url).catch(() => setUploadError("Das Bild konnte nicht verarbeitet werden."));
          else setAvatar(url);
        }}
      />

      <CountryPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === "nat2" ? "Zweite Nationalität" : "Primäre Nationalität"}
        exclude={picker === "nat2" ? nat1 : nat2}
        value={picker === "nat2" ? nat2 : nat1}
        onPick={(code) => {
          if (picker === "nat2") setNat2(code);
          else {
            setNat1(code);
            setRegion(undefined);
          }
        }}
      />
    </div>
  );
}
