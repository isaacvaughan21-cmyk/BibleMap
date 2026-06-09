import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Hodos — The way, the path. An infinite mind map for Bible study.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand tokens (kept in sync with globals.css). OG runs in an isolated edge
// runtime that can't read CSS variables, so the values are inlined here only.
const PARCHMENT = "#F4EFE6";
const INK = "#16202B";
const GOLD = "#B98A3A";
const INK_MUTED = "#5B6675";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: PARCHMENT,
          backgroundImage: `radial-gradient(${INK_MUTED}22 1.5px, transparent 1.5px)`,
          backgroundSize: "32px 32px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ fontSize: 150, color: INK, fontWeight: 600 }}>Hodos</div>
        <div
          style={{
            fontSize: 30,
            color: GOLD,
            letterSpacing: 18,
            marginTop: 8,
          }}
        >
          ΟΔΟΣ — THE WAY, THE PATH
        </div>
        <div
          style={{
            fontSize: 34,
            color: INK_MUTED,
            fontStyle: "italic",
            marginTop: 40,
            maxWidth: 820,
            textAlign: "center",
          }}
        >
          &ldquo;Your word is a lamp to my feet and a light to my path.&rdquo;
        </div>
        <div
          style={{
            fontSize: 20,
            color: INK_MUTED,
            letterSpacing: 6,
            marginTop: 18,
          }}
        >
          PSALM 119:105
        </div>
      </div>
    ),
    { ...size }
  );
}
