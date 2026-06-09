import Reveal from "@/components/Reveal";

/** Feature grid (2x2) — gold icon, serif H3, ink-soft body, hover lift. */

type Feature = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

/** Simple line icons drawn inline so no icon dep / no hardcoded colors. */
const iconProps = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "var(--gold)",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const features: Feature[] = [
  {
    icon: (
      <svg {...iconProps}>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
      </svg>
    ),
    title: "Infinite zoomable canvas",
    body: "No pages, no folders. One continuous space that grows with your study. Zoom in to a single verse or out to see the whole picture.",
  },
  {
    icon: (
      <svg {...iconProps}>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <path d="M8.5 6H15M6 8.5v7a2 2 0 0 0 2 2h7.5" />
      </svg>
    ),
    title: "Automatic cross-references",
    body: "Connect a thought to a passage and Hodos surfaces related verses from across scripture — connections you might have missed.",
  },
  {
    icon: (
      <svg {...iconProps}>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5zM20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5z" />
      </svg>
    ),
    title: "Your thoughts, all in one place",
    body: "Questions, insights, sermon notes, half-formed ideas. Everything lives on the same canvas, right next to the text that sparked it.",
  },
  {
    icon: (
      <svg {...iconProps}>
        <path d="M4 18 9 9l4 5 3-4 4 8z" />
        <circle cx="9" cy="9" r="1" />
        <circle cx="16" cy="10" r="1" />
      </svg>
    ),
    title: "A map that compounds",
    body: "The more you study, the richer your map becomes. Old insights connect to new ones. Nothing is ever lost.",
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="relative bg-parchment-2 px-gutter py-rhythm md:px-gutter-lg md:py-rhythm-lg"
    >
      <div className="dot-grid absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-content">
        <Reveal>
          <h2 className="font-serif text-2xl text-ink md:text-xl">
            What makes Hodos different.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={0.1 + i * 0.1}>
              <div className="group h-full rounded-xl border border-rule bg-parchment p-8 transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-lg hover:shadow-ink/5 md:p-10">
                <span className="inline-block transition-transform duration-300 group-hover:scale-110">
                  {f.icon}
                </span>
                <h3 className="mt-5 font-serif text-lg text-ink">{f.title}</h3>
                <p className="mt-3 font-sans text-base leading-relaxed text-ink-soft">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
