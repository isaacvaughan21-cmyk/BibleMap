"use client";

import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Canvas keyboard shortcuts. Undo/redo is intentionally absent: React Flow
 * ships no built-in history and the build brief forbids a custom one.
 */

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["mod", "K"], label: "Command palette" },
  { keys: ["2×click"], label: "Create a bubble (on the canvas)" },
  { keys: ["2×click"], label: "Open a bubble into its own map" },
  { keys: ["⌫"], label: "Delete selection" },
  { keys: ["mod", "A"], label: "Select all" },
  { keys: ["mod", "/"], label: "Toggle study panel" },
  { keys: ["mod", "F"], label: "Fit map to view" },
  { keys: ["mod", "+"], label: "Zoom in" },
  { keys: ["mod", "−"], label: "Zoom out" },
  { keys: ["⇧", "drag"], label: "Box select" },
  { keys: ["⇧", "click"], label: "Multi-select" },
  { keys: ["?"], label: "Keyboard shortcuts" },
];

export function useCanvasShortcuts(handlers: {
  onPalette: () => void;
  onToggleRail: () => void;
  onHelp: () => void;
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const selectAll = useCanvasStore((s) => s.selectAll);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField =
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      const ms = (d: number) => (reducedMotion ? 0 : d);

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handlers.onPalette();
        return;
      }
      if (inField) return;

      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
      } else if (mod && e.key === "/") {
        e.preventDefault();
        handlers.onToggleRail();
      } else if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        fitView({ duration: ms(500), padding: 0.25, maxZoom: 1 });
      } else if (mod && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        zoomIn({ duration: ms(200) });
      } else if (mod && e.key === "-") {
        e.preventDefault();
        zoomOut({ duration: ms(200) });
      } else if (!mod && e.key === "?") {
        handlers.onHelp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers, fitView, zoomIn, zoomOut, selectAll, reducedMotion]);
}
