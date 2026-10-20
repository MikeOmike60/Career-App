import { useEffect, useState } from "react";
import { countryFlag, countryFlagFallback, countryName } from "@/lib/sim/data";

let cachedSupport: boolean | null = null;

/** Einmalige Feature-Erkennung: Kann das System Farb-Flaggen-Emoji rendern? */
function detectFlagEmojiSupport(): boolean {
  if (cachedSupport !== null) return cachedSupport;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext("2d");
    if (!ctx) return (cachedSupport = false);
    ctx.font = "16px sans-serif";
    ctx.fillText("🇩🇪", 0, 16);
    const flagPixels = ctx.getImageData(0, 0, 24, 24).data;
    ctx.clearRect(0, 0, 24, 24);
    ctx.fillText("DE", 0, 16);
    const textPixels = ctx.getImageData(0, 0, 24, 24).data;
    let equal = true;
    for (let i = 0; i < flagPixels.length; i += 4) {
      if (flagPixels[i + 3] !== textPixels[i + 3]) {
        equal = false;
        break;
      }
    }
    cachedSupport = !equal;
  } catch {
    cachedSupport = false;
  }
  return cachedSupport;
}

/** Flaggen-Emoji mit textuellem Fallback, falls das System keine Farb-Emoji rendert. */
export function Flag({ code, withName, size }: { code: string; withName?: boolean; size?: number }) {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    setSupported(detectFlagEmojiSupport());
  }, []);
  const name = countryName(code);
  return (
    <span title={name} aria-label={name} style={{ fontSize: size, lineHeight: 1, whiteSpace: "nowrap" }}>
      {supported ? (
        <span aria-hidden>{countryFlag(code)}</span>
      ) : (
        <span
          aria-hidden
          style={{
            fontSize: "0.7em",
            fontWeight: 800,
            letterSpacing: "0.06em",
            padding: "1px 4px",
            borderRadius: 2,
            background: "#13202b",
            color: "#fff",
          }}
        >
          {countryFlagFallback(code)}
        </span>
      )}
      {withName ? ` ${name}` : ""}
    </span>
  );
}
