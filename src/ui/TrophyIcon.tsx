import { useId } from "react";
import type { Trophy } from "@/lib/sim/types";
import type { TrophyVariant } from "@/lib/sim/competitions";

/** Variante aus der Registry – Namensheuristik nur für alte Spielstände. */
function variantOf(t: Trophy): TrophyVariant {
  if (t.variant) return t.variant;
  const n = t.name;
  if (n.includes("Torschützenkönig")) return "boot";
  if (n.includes("Meisterschaft")) return "shield";
  if (n.includes("Kontinental")) return "cup-big";
  if (n.includes("Pokal")) return "cup";
  if (n.includes("Turnier")) return "globe";
  return "star";
}

const METAL = {
  gold: ["#fff2b3", "#f0c63c", "#b07d0a"],
  silver: ["#ffffff", "#cfd8df", "#7f8f9c"],
} as const;

/** Gefüllte Trophäen-Icons mit Metallverlauf: Awards und Nationaltitel Gold, Vereinstitel Silber. */
export function TrophyIcon({ trophy, size = 22 }: { trophy: Trophy; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const variant = variantOf(trophy);
  const metal = trophy.kind === "club" && variant !== "shield" ? METAL.silver : METAL.gold;
  const g = `tg-${uid}`;
  const fill = `url(#${g})`;
  const stroke = metal[2];

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={trophy.name} style={{ flex: "none" }}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={metal[0]} />
          <stop offset="0.5" stopColor={metal[1]} />
          <stop offset="1" stopColor={metal[2]} />
        </linearGradient>
      </defs>
      {variant === "cup" && (
        <g stroke={stroke} strokeWidth="0.8" strokeLinejoin="round">
          <path d="M7 3h10v5.5a5 5 0 0 1-10 0V3Z" fill={fill} />
          <path d="M7 5H4.5v2a3 3 0 0 0 3 3M17 5h2.5v2a3 3 0 0 1-3 3" fill="none" strokeWidth="1.4" />
          <path d="M10.5 13.2h3l.6 4h-4.2Z" fill={fill} />
          <rect x="7.5" y="17.5" width="9" height="3.2" rx="0.6" fill={fill} />
        </g>
      )}
      {variant === "cup-big" && (
        <g stroke={stroke} strokeWidth="0.8" strokeLinejoin="round">
          <path d="M3.5 4.5c0 3 1.5 4.5 3.5 4.8M20.5 4.5c0 3-1.5 4.5-3.5 4.8" fill="none" strokeWidth="1.6" />
          <path d="M6 2h12l-1 7.5a5 5 0 0 1-10 0L6 2Z" fill={fill} />
          <path d="M11 14h2v3h-2Z" fill={fill} />
          <path d="M8 17.5h8l1 3.5H7Z" fill={fill} />
        </g>
      )}
      {variant === "shield" && (
        <g stroke={stroke} strokeWidth="0.8" strokeLinejoin="round">
          <path d="M12 2 20 5v7c0 5-4 8-8 10-4-2-8-5-8-10V5l8-3Z" fill={fill} />
          <path d="m12 7 1.5 3 3.3.4-2.4 2.3.6 3.3L12 14.4 9 16l.6-3.3-2.4-2.3 3.3-.4Z" fill="#fff" fillOpacity="0.75" />
        </g>
      )}
      {variant === "boot" && (
        <g stroke={stroke} strokeWidth="0.8" strokeLinejoin="round">
          <path d="M3 7h7l3 5h6a2.5 2.5 0 0 1 2.5 2.5V17H5a2 2 0 0 1-2-2V7Z" fill={fill} />
          <path d="M5 17v2.5M9 17v2.5M13 17v2.5M17 17v2.5" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      )}
      {variant === "globe" && (
        <g stroke={stroke} strokeWidth="0.8">
          <circle cx="12" cy="8.5" r="6.5" fill={fill} />
          <path d="M5.5 8.5h13M12 2c2.4 2.6 2.4 10.4 0 13M12 2c-2.4 2.6-2.4 10.4 0 13" fill="none" />
          <path d="M8.5 14.5 10 18h4l1.5-3.5" fill={fill} />
          <rect x="7.5" y="18" width="9" height="3.5" rx="0.6" fill={fill} />
        </g>
      )}
      {variant === "star" && (
        <path
          d="m12 2.5 2.8 5.9 6.4.8-4.7 4.5 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.5 6.4-.8L12 2.5Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      )}
      {variant === "glove" && (
        <g stroke={stroke} strokeWidth="0.8" strokeLinejoin="round">
          <path d="M7 21v-4L4.5 12.5a1.6 1.6 0 0 1 2.7-1.6L9 13V5a1.5 1.5 0 0 1 3 0v6V4a1.5 1.5 0 0 1 3 0v7V5.5a1.5 1.5 0 0 1 3 0V15c0 3-2 6-5 6Z" fill={fill} />
        </g>
      )}
      {variant === "ball" && (
        <g stroke={stroke} strokeWidth="0.8">
          <circle cx="12" cy="12" r="9" fill={fill} />
          <path d="m12 7.5 3.4 2.5-1.3 4h-4.2l-1.3-4Z" fill="#fff" fillOpacity="0.6" />
          <path d="M12 3v4.5M15.4 10l4.3-1.4M14.1 14l2.6 3.6M9.9 14l-2.6 3.6M8.6 10 4.3 8.6" fill="none" />
        </g>
      )}
      {variant === "medal" && (
        <g stroke={stroke} strokeWidth="0.8" strokeLinejoin="round">
          <path d="M7 2h4l2 6H9ZM17 2h-4l-2 6h4Z" fill="#0a84d6" stroke="#05508a" />
          <circle cx="12" cy="15" r="6.5" fill={fill} />
          <circle cx="12" cy="15" r="4" fill="none" strokeOpacity="0.7" />
        </g>
      )}
    </svg>
  );
}
