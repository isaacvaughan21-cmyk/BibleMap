import { notFound } from "next/navigation";
import Canvas from "@/components/canvas/Canvas";

/**
 * The Hodos canvas. Feature-flagged: production keeps serving only the
 * landing page until the v1 cutover flips NEXT_PUBLIC_HODOS_APP_ENABLED.
 */
export default function AppPage() {
  if (process.env.NEXT_PUBLIC_HODOS_APP_ENABLED !== "true") {
    notFound();
  }
  return <Canvas />;
}
