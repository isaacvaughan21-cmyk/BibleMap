"use client";

/**
 * The gold ✦ on the first bubble of a canvas (any type) — the anchor of the
 * study. Pairs with the `.node-primary` glow. Sits top-left so it never
 * collides with the top-right {@link NestBadge}.
 */
export default function PrimaryBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      title="The first bubble on this canvas — the anchor of your study"
      aria-label="Anchor bubble"
      className="absolute -left-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-gold/60 bg-parchment text-2xs leading-none text-gold shadow-sm shadow-gold/20"
    >
      ✦
    </span>
  );
}
