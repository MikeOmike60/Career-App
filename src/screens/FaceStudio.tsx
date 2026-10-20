import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Cpu, KeyRound, RotateCcw, Sparkles, Image as ImageIcon } from "lucide-react";
import { Sheet } from "@/ui/primitives";
import { PlayerCard } from "@/ui/PlayerCard";
import { celebrate, tap, warn } from "@/ui/native";
import { NoFaceError, loadAiSettings, makeFifaHeadAI, makeFifaHeadLocal, saveAiSettings, type AiQuality, type AiSettings } from "@/ui/fifaFace";

type Mode = "local" | "ai";
type Job = { status: "idle" } | { status: "busy" } | { status: "done"; url: string } | { status: "error"; message: string };

const QUALITY: { value: AiQuality; label: string; cost: string }[] = [
  { value: "low", label: "Niedrig", cost: "ca. 1–2 Cent" },
  { value: "medium", label: "Mittel", cost: "ca. 4–6 Cent" },
  { value: "high", label: "Hoch", cost: "ca. 17–20 Cent" },
];

/** Scanner-Animation über dem Originalfoto, solange gerechnet wird. */
function Scanner({ src, label }: { src: string; label: string }) {
  return (
    <div style={{ position: "relative", width: 220, height: 220, margin: "0 auto", borderRadius: 8, overflow: "hidden", background: "#0e1a24" }}>
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }} />
      <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0 }} aria-hidden>
        <polygon points="50,14 80,31 80,69 50,86 20,69 20,31" fill="none" stroke="#8fd134" strokeWidth="1.2" strokeDasharray="4 3">
          <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="6s" repeatCount="indefinite" />
        </polygon>
      </svg>
      <motion.div
        style={{ position: "absolute", inset: 0, willChange: "transform" }}
        animate={{ y: ["0%", "100%", "0%"] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: "#8fd134", boxShadow: "0 0 14px 4px rgba(143,209,52,.7)" }} />
      </motion.div>
      <div className="h-section" style={{ position: "absolute", left: 0, right: 0, bottom: 8, textAlign: "center", color: "#fff", fontSize: 14, textShadow: "0 1px 3px #000" }}>
        {label}
      </div>
    </div>
  );
}

/** Ergebnis wie im Spiel: freigestellter Kopf auf Weiß + Vorschau auf der Karte. */
function Result({ url, name, nat, pos }: { url: string; name: string; nat: string; pos: string }) {
  return (
    <motion.div className="row" style={{ justifyContent: "center", gap: 14, alignItems: "center" }} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", damping: 14 }}>
      <img src={url} alt="FIFA-Kopfbild" style={{ width: 170, height: 170, background: "#fff", borderRadius: 6, boxShadow: "var(--shadow)", border: "1px solid var(--line)" }} />
      <PlayerCard data={{ name: name || "Spieler", avatar: url, ovr: 65, pos, nat, stats: [["ALT", 16], ["FRM", 50], ["FIT", 90], ["MOR", 70], ["REP", 10], ["MEN", 60]] }} width={118} />
    </motion.div>
  );
}

export function FaceStudio({
  photo,
  onClose,
  onUse,
  name,
  nat,
  pos,
}: {
  photo: string | null;
  onClose: () => void;
  onUse: (avatar: string) => void;
  name: string;
  nat: string;
  pos: string;
}) {
  const [mode, setMode] = useState<Mode>("local");
  const [local, setLocal] = useState<Job>({ status: "idle" });
  const [ai, setAi] = useState<Job>({ status: "idle" });
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [keyDraft, setKeyDraft] = useState("");
  const abort = useRef<AbortController | null>(null);

  // Neues Foto → lokale Umwandlung startet sofort.
  useEffect(() => {
    if (!photo) return;
    setMode("local");
    setAi({ status: "idle" });
    setLocal({ status: "busy" });
    let cancelled = false;
    makeFifaHeadLocal(photo)
      .then((url) => {
        if (cancelled) return;
        setLocal({ status: "done", url });
        celebrate();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        warn();
        setLocal({
          status: "error",
          message:
            err instanceof NoFaceError
              ? "Kein Gesicht erkannt. Nimm ein Foto, auf dem dein Gesicht gut sichtbar von vorne zu sehen ist."
              : "Die Gesichtserkennung konnte nicht geladen werden. Versuche es erneut.",
        });
      });
    return () => {
      cancelled = true;
      abort.current?.abort();
    };
  }, [photo]);

  const runAi = () => {
    if (!photo) return;
    tap();
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setAi({ status: "busy" });
    makeFifaHeadAI(photo, settings, ctrl.signal)
      .then((url) => {
        setAi({ status: "done", url });
        celebrate();
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        warn();
        setAi({ status: "error", message: err instanceof Error ? err.message : "Die KI-Anfrage ist fehlgeschlagen." });
      });
  };

  const saveKey = () => {
    const next = { ...settings, apiKey: keyDraft.trim() };
    setSettings(next);
    saveAiSettings(next);
    setKeyDraft("");
  };

  const job = mode === "local" ? local : ai;

  return (
    <Sheet open={Boolean(photo)} onClose={onClose} title="FIFA-Gesicht" eyebrow="Profilbild aus deinem Foto" full>
      {photo && (
        <div className="stack">
          <div className="panel" style={{ padding: 6, display: "flex", gap: 6 }}>
            <button type="button" className={`btn small grow ${mode === "local" ? "blue" : "ghost"}`} onClick={() => setMode("local")}>
              <Cpu size={16} /> Handy · gratis
            </button>
            <button type="button" className={`btn small grow ${mode === "ai" ? "blue" : "ghost"}`} onClick={() => setMode("ai")}>
              <Sparkles size={16} /> KI
            </button>
          </div>

          <div className="panel pad" style={{ minHeight: 250, display: "grid", placeItems: "center" }}>
            {job.status === "busy" && <Scanner src={photo} label={mode === "local" ? "Gesicht wird gescannt …" : "KI rendert dein Gesicht …"} />}
            {job.status === "done" && <Result url={job.url} name={name} nat={nat} pos={pos} />}
            {job.status === "error" && (
              <div style={{ textAlign: "center" }}>
                <img src={photo} alt="" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 6, opacity: 0.6 }} />
                <p className="notice error" style={{ marginTop: 10 }}>
                  {job.message}
                </p>
              </div>
            )}
            {job.status === "idle" && mode === "ai" && (
              <div style={{ textAlign: "center", width: "100%" }}>
                <img src={photo} alt="Dein Foto" style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 6 }} />
                {settings.apiKey ? (
                  <p className="small muted">Die KI macht aus deinem Foto einen echten FIFA-11-Render: gerader Blick, neutrales Gesicht, weißes Shirt.</p>
                ) : null}
              </div>
            )}
          </div>

          {mode === "local" && (
            <p className="tiny muted" style={{ margin: 0 }}>
              Läuft komplett auf deinem Handy: Gesicht wird erkannt, gerade ausgerichtet, freigestellt und bekommt ein weißes Shirt. Gesichtsausdruck und Blickrichtung bleiben wie auf dem Foto – am besten ein Foto von vorne mit neutralem Blick nehmen.
            </p>
          )}

          {mode === "ai" && (
            <div className="panel pad">
              {!settings.apiKey ? (
                <>
                  <div className="row">
                    <KeyRound size={18} color="var(--blue)" />
                    <div className="h-section grow" style={{ fontSize: 16 }}>
                      OpenAI-API-Schlüssel
                    </div>
                  </div>
                  <p className="small muted">
                    Die KI-Variante nutzt die Bildbearbeitung von OpenAI. Dafür brauchst du ein OpenAI-Konto mit Guthaben und einen API-Schlüssel (platform.openai.com → API keys). Der Schlüssel bleibt nur auf diesem Gerät; dein Foto wird zur Umwandlung an OpenAI geschickt.
                  </p>
                  <div className="row">
                    <input
                      className="input grow"
                      type="password"
                      placeholder="sk-…"
                      autoComplete="off"
                      value={keyDraft}
                      onChange={(e) => setKeyDraft(e.target.value)}
                      aria-label="OpenAI-API-Schlüssel"
                    />
                    <button type="button" className="btn blue small" disabled={keyDraft.trim().length < 20} onClick={saveKey}>
                      Speichern
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="label">Qualität</div>
                  <div className="grid-3">
                    {QUALITY.map((q) => (
                      <button
                        key={q.value}
                        type="button"
                        className="choice"
                        aria-pressed={settings.quality === q.value}
                        style={{ textAlign: "center" }}
                        onClick={() => {
                          const next = { ...settings, quality: q.value };
                          setSettings(next);
                          saveAiSettings(next);
                        }}
                      >
                        <span style={{ display: "block", fontWeight: 700 }}>{q.label}</span>
                        <span className="tiny muted">{q.cost}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn primary block shine" style={{ marginTop: 10 }} disabled={ai.status === "busy"} onClick={runAi}>
                    <Sparkles size={18} /> {ai.status === "done" ? "Neu erzeugen" : "Mit KI erzeugen"}
                  </button>
                  <p className="tiny muted" style={{ marginBottom: 0 }}>
                    Kosten laufen über dein OpenAI-Konto. Den Schlüssel kannst du in den Einstellungen ändern oder löschen.
                  </p>
                </>
              )}
            </div>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              className="btn primary block"
              disabled={job.status !== "done"}
              onClick={() => {
                if (job.status === "done") onUse(job.url);
              }}
            >
              <Check size={18} /> FIFA-Gesicht übernehmen
            </button>
            <div className="grid-2">
              <button type="button" className="btn ghost small" onClick={() => onUse(photo)}>
                <ImageIcon size={16} /> Originalfoto
              </button>
              <button type="button" className="btn ghost small" onClick={onClose}>
                <RotateCcw size={16} /> Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
