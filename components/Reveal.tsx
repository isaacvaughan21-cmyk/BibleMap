"use client";

import { motion } from "framer-motion";

/**
 * Scroll-triggered entrance used across all sections: a soft rise + fade with
 * a long expressive ease. Fires once, ~80px before the element is fully in
 * view, so content settles right as the eye lands on it.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
