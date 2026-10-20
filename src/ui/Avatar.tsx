import { hashString } from "@/lib/sim/rng";
import { isHeadCutout } from "./fifaFace";

export const AVATAR_PRESETS = Array.from({ length: 12 }, (_, i) => `preset:${i}`);

const SKIN = ["#f2d3b3", "#e8be96", "#d9a173", "#c07f4f", "#9a5f33", "#6f4322"];
const HAIR = ["#1c1917", "#3f2a16", "#5b3b1e", "#8a6a3c", "#d6c197", "#2b2b2b", "#7c2d12", "#e5e7eb"];
const KIT = ["#0a84d6", "#c8102e", "#111827", "#8fd134", "#f5c400", "#5b2d8e", "#00843d", "#e35205"];

/** Prozeduraler Avatar: Presets werden lokal gezeichnet, Uploads als Bild gezeigt. */
export function Avatar({
  avatar,
  name = "",
  size = 72,
  transparent,
  fluid,
}: {
  avatar: string;
  name?: string;
  size?: number;
  /** Ohne Hintergrund – z. B. auf der Spielerkarte. */
  transparent?: boolean;
  /** Füllt den Elterncontainer statt fester Pixelgröße. */
  fluid?: boolean;
}) {
  if (avatar.startsWith("data:")) {
    const cutout = isHeadCutout(avatar);
    return (
      <img
        src={avatar}
        alt={name ? `Profilbild von ${name}` : "Profilbild"}
        width={size}
        height={size}
        style={{
          width: fluid ? "100%" : size,
          height: fluid ? "100%" : size,
          objectFit: "cover",
          // FIFA-Kopfbild: auf Weiß wie im Spiel, auf der Karte ohne Kasten.
          borderRadius: transparent ? (cutout ? 0 : "50%") : 6,
          background: transparent ? "transparent" : "#fff",
          flex: "none",
        }}
      />
    );
  }
  const idx = Number(avatar.split(":")[1] ?? 0);
  const h = hashString(`${avatar}|${name}`);
  const skin = SKIN[idx % SKIN.length]!;
  const hair = HAIR[(idx * 3 + Math.floor(h / 5)) % HAIR.length]!;
  const kit = KIT[idx % KIT.length]!;
  const hairStyle = idx % 4;
  const beard = idx % 3 === 1;

  return (
    <svg
      viewBox="0 0 100 100"
      width={fluid ? "100%" : size}
      height={fluid ? "100%" : size}
      role="img"
      aria-label={name ? `Avatar von ${name}` : "Avatar"}
      style={{ flex: "none", borderRadius: transparent ? 0 : 6, display: "block" }}
    >
      {!transparent && (
        <>
          <rect width="100" height="100" fill="#dfe7ed" />
          <path d="M50 0 L100 0 L100 40 Z" fill="#fff" opacity="0.6" />
        </>
      )}
      <path d="M18 100c2-18 15-27 32-27s30 9 32 27Z" fill={kit} />
      <path d="M41 73 L50 84 L59 73" fill="none" stroke="#fff" strokeWidth="3" opacity="0.8" />
      <rect x="41" y="58" width="18" height="16" rx="6" fill={skin} />
      <ellipse cx="50" cy="44" rx="21" ry="24" fill={skin} />
      {hairStyle === 0 && <path d="M29 40c1-16 12-22 21-22s20 6 21 22c-6-8-12-10-21-10s-15 2-21 10Z" fill={hair} />}
      {hairStyle === 1 && <ellipse cx="50" cy="26" rx="26" ry="17" fill={hair} />}
      {hairStyle === 2 && (
        <g fill={hair}>
          <circle cx="34" cy="30" r="10" />
          <circle cx="50" cy="23" r="12" />
          <circle cx="66" cy="30" r="10" />
        </g>
      )}
      {hairStyle === 3 && <path d="M31 38c3-10 10-15 19-15s16 5 19 15c-5-4-11-6-19-6s-14 2-19 6Z" fill={hair} opacity="0.5" />}
      <ellipse cx="42" cy="45" rx="2.6" ry="3" fill="#111827" />
      <ellipse cx="58" cy="45" rx="2.6" ry="3" fill="#111827" />
      <path d="M44 56c3 2.5 9 2.5 12 0" stroke="#4b2f20" strokeWidth="2" fill="none" strokeLinecap="round" />
      {beard && <path d="M31 46c1 14 9 22 19 22s18-8 19-22c-2 16-9 20-19 20s-17-4-19-20Z" fill={hair} opacity="0.85" />}
    </svg>
  );
}
