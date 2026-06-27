"use client";

import { useReactFlow } from "@xyflow/react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * Bottom-right control cluster — undo/redo, then zoom out, fit-to-view (gold
 * accent), zoom in. Shifts left when the study panel is open. The minimap sits
 * just above it.
 */
export default function CanvasControls({ railOpen }: { railOpen: boolean }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const reducedMotion = usePrefersReducedMotion();
  const ms = (d: number) => (reducedMotion ? 0 : d);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);

  return (
    <div
      className={`dive-dim absolute bottom-4 z-30 flex items-center gap-1 rounded-full border border-rule/80 bg-parchment/85 p-1 shadow-md shadow-ink/5 backdrop-blur-md transition-all duration-300 ${
        railOpen ? "right-[336px]" : "right-4"
      }`}
      role="group"
      aria-label="Canvas controls"
    >
      <ControlButton label="Undo" disabled={!canUndo} onClick={() => undo()}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5.5 3.5 3 6l2.5 2.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 6h5a3.5 3.5 0 1 1 0 7H5.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ControlButton>

      <ControlButton label="Redo" disabled={!canRedo} onClick={() => redo()}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8.5 3.5 11 6 8.5 8.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11 6H6a3.5 3.5 0 1 0 0 7h2.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ControlButton>

      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-rule/80" />

      <ControlButton
        label="Zoom out"
        onClick={() => zoomOut({ duration: ms(200) })}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <line
            x1="1.5"
            y1="6"
            x2="10.5"
            y2="6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </ControlButton>

      <button
        type="button"
        onClick={() =>
          fitView({ duration: ms(500), padding: 0.25, maxZoom: 1 })
        }
        aria-label="Fit map to view"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-parchment shadow-md shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink hover:shadow-lg hover:shadow-ink/15"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 5V2.5A1.5 1.5 0 0 1 2.5 1H5M9 1h2.5A1.5 1.5 0 0 1 13 2.5V5M13 9v2.5a1.5 1.5 0 0 1-1.5 1.5H9M5 13H2.5A1.5 1.5 0 0 1 1 11.5V9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <ControlButton
        label="Zoom in"
        onClick={() => zoomIn({ duration: ms(200) })}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <line
            x1="6"
            y1="1.5"
            x2="6"
            y2="10.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <line
            x1="1.5"
            y1="6"
            x2="10.5"
            y2="6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-parchment-2 hover:text-gold disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
