/** Dekaden-Farbschema für OVR-Werte – überall konsistent einsetzen. */
export type OvrTone = "slate" | "cyan" | "emerald" | "violet" | "gold";

export function ovrTone(ovr: number): OvrTone {
  if (ovr >= 90) return "gold";
  if (ovr >= 80) return "violet";
  if (ovr >= 70) return "emerald";
  if (ovr >= 60) return "cyan";
  return "slate";
}

const TEXT: Record<OvrTone, string> = {
  slate: "text-ovr-slate",
  cyan: "text-ovr-cyan",
  emerald: "text-ovr-emerald",
  violet: "text-ovr-violet",
  gold: "text-ovr-gold",
};

const CHIP: Record<OvrTone, string> = {
  slate: "bg-ovr-slate/12 text-ovr-slate ring-ovr-slate/35",
  cyan: "bg-ovr-cyan/12 text-ovr-cyan ring-ovr-cyan/35",
  emerald: "bg-ovr-emerald/12 text-ovr-emerald ring-ovr-emerald/35",
  violet: "bg-ovr-violet/14 text-ovr-violet ring-ovr-violet/35",
  gold: "bg-ovr-gold/14 text-ovr-gold ring-ovr-gold/40",
};

export function ovrTextClass(ovr: number): string {
  return TEXT[ovrTone(ovr)];
}

export function ovrChipClass(ovr: number): string {
  return `${CHIP[ovrTone(ovr)]} ring-1`;
}

export function ovrHex(ovr: number): string {
  const tone = ovrTone(ovr);
  return {
    slate: "#94a3b8",
    cyan: "#22d3ee",
    emerald: "#34d399",
    violet: "#a78bfa",
    gold: "#f5c451",
  }[tone];
}

export function formatMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} Mio. €`;
  if (value >= 1000) return `${Math.round(value / 1000)} Tsd. €`;
  return `${Math.round(value)} €`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE").format(Math.round(value));
}
