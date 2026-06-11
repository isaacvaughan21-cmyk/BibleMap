import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hodos — Your map",
  robots: { index: false, follow: false },
};

/** Canvas chrome — a full-viewport, non-scrolling shell for the map. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-parchment">{children}</div>
  );
}
