import { useState } from "react";
import type { GameState, Pace } from "@/lib/sim/types";
import { REAL_DATA_INFO } from "@/lib/sim/data";
import { Sheet } from "@/ui/primitives";
import { updateSettings, useSettings } from "@/ui/settings";
import { tap } from "@/ui/native";
import clubLogos from "@/data/club-logos.json";

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className="choice row"
      style={{ width: "100%" }}
      onClick={() => {
        tap();
        onChange(!value);
      }}
    >
      <span className="grow">
        <span style={{ display: "block", fontWeight: 700 }}>{label}</span>
        <span className="tiny muted">{hint}</span>
      </span>
      <span
        aria-hidden
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          background: value ? "var(--lime-2)" : "#b9c5cf",
          position: "relative",
          transition: "background .2s",
          flex: "none",
        }}
      >
        <span style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
      </span>
    </button>
  );
}

export function SettingsSheet({
  open,
  onClose,
  state,
  setState,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  state: GameState | null;
  setState: (s: GameState) => void;
  onReset: () => void;
}) {
  const settings = useSettings();
  const [confirm, setConfirm] = useState(false);
  const logoCount = Object.keys(clubLogos).length;

  return (
    <Sheet
      open={open}
      onClose={() => {
        setConfirm(false);
        onClose();
      }}
      title="Einstellungen"
      eyebrow="Legendenweg"
    >
      <div className="stack">
        <Toggle label="Vibration" hint="Kurzes haptisches Feedback bei Aktionen und Titeln." value={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} />
        <Toggle label="Schnelle Animationen" hint="Anpfiff-Sequenz deutlich verkürzen." value={settings.fastAnimations} onChange={(v) => updateSettings({ fastAnimations: v })} />

        {state && state.phase === "career" && (
          <div className="panel pad">
            <div className="label">Karrieretempo</div>
            <div className="grid-3">
              {([1, 2, 5] as Pace[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="choice"
                  aria-pressed={state.profile.pace === p}
                  style={{ textAlign: "center", fontWeight: 700 }}
                  onClick={() => {
                    tap();
                    setState({ ...state, profile: { ...state.profile, pace: p } });
                  }}
                >
                  {p === 1 ? "1 Saison" : `${p} Saisons`}
                </button>
              ))}
            </div>
            <p className="tiny muted" style={{ marginBottom: 0 }}>
              Gilt ab dem nächsten Anpfiff. Pro Anpfiff tritt höchstens eine Lebenssituation auf.
            </p>
          </div>
        )}

        {state && (
          <div className="panel pad">
            <div className="label">Spielstand</div>
            {!confirm ? (
              <button type="button" className="btn ghost block" onClick={() => setConfirm(true)}>
                Karriere zurücksetzen
              </button>
            ) : (
              <div>
                <p className="small" style={{ marginTop: 0 }}>
                  <b>Karriere wirklich zurücksetzen?</b> Der aktuelle Spielstand wird endgültig gelöscht.
                </p>
                <div className="grid-2">
                  <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => {
                      setConfirm(false);
                      onReset();
                    }}
                  >
                    Zurücksetzen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="notice tiny muted" style={{ lineHeight: 1.5 }}>
          Privates, inoffizielles Fanprojekt. Keine Verbindung zu Vereinen, Ligen oder Verbänden. Reale Vereinsnamen für {REAL_DATA_INFO.realNamesCountries} Verbände ({REAL_DATA_INFO.realClubs} Vereine, Stand {REAL_DATA_INFO.generatedAt}). {logoCount} Vereinslogos aus der Sammlung luukhopman/football-logos; alle übrigen Vereine erhalten ein generiertes Wappen. Logos sind Marken der jeweiligen Vereine.
        </div>
      </div>
    </Sheet>
  );
}
