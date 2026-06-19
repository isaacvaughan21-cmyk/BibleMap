import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NotesScreen from "@/components/notes/NotesScreen";

/**
 * Reading / print view for a compiled study. Feature-flagged alongside the
 * canvas (same NEXT_PUBLIC_HODOS_APP_ENABLED gate as /app). The document itself
 * is handed over in module state by the canvas's "Compile to notes" action.
 */
export const metadata: Metadata = {
  title: "Study notes — Hodos",
  robots: { index: false, follow: false },
};

export default function NotesPage() {
  if (process.env.NEXT_PUBLIC_HODOS_APP_ENABLED !== "true") {
    notFound();
  }
  return <NotesScreen />;
}
