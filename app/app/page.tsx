import { notFound } from "next/navigation";
import Canvas from "@/components/canvas/Canvas";
import MobileGate from "@/components/canvas/MobileGate";

/**
 * The Hodos canvas. Feature-flagged: production keeps serving only the
 * landing page until the v1 cutover flips NEXT_PUBLIC_HODOS_APP_ENABLED.
 *
 * MobileGate keeps the canvas off phones for now (desktop-only, with a
 * "coming soon" note) — the landing page and Journal stay reachable there.
 */
export default function AppPage() {
  if (process.env.NEXT_PUBLIC_HODOS_APP_ENABLED !== "true") {
    notFound();
  }
  return (
    <MobileGate>
      <Canvas />
    </MobileGate>
  );
}
