import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Δ monogram inside a circle — matches the dot-and-arc motif.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#16202B",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 116,
            height: 116,
            borderRadius: "50%",
            border: "4px solid #B98A3A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#D9B871",
            fontSize: 78,
            fontFamily: "Georgia, serif",
          }}
        >
          Δ
        </div>
      </div>
    ),
    { ...size }
  );
}
