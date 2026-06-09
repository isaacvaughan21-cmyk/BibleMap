/** How it works — three numbered steps with gold serif numerals + chips. */

type Step = {
  num: string;
  title: string;
  body: string;
  chip: string;
};

const steps: Step[] = [
  {
    num: "01",
    title: "CAPTURE",
    body: "Jot down any question or thought. Reading and something catches you? Drop a bubble onto your canvas. A question, a connection, a half-formed thought — it all belongs here.",
    chip: "Who is Melchizedek?",
  },
  {
    num: "02",
    title: "CONNECT",
    body: "Let ideas find each other. Draw connections between your thoughts. Hodos surfaces cross-references from elsewhere in scripture — verses you might never have found on your own.",
    chip: "Hebrews 7:1 → Genesis 14",
  },
  {
    num: "03",
    title: "EXPAND",
    body: "Watch your map grow. Over weeks and months, isolated questions weave into a living web of understanding. Zoom out and see how it all fits together.",
    chip: "147 connected insights",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how"
      className="relative px-gutter py-rhythm md:px-gutter-lg md:py-rhythm-lg"
    >
      <div className="dot-grid absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-content">
        <p className="font-sans text-2xs tracking-eyebrow text-gold">
          HOW IT WORKS
        </p>
        <h2 className="mt-6 font-serif text-2xl text-ink md:text-xl">
          Three steps. One living path.
        </h2>

        <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
          {steps.map((step) => (
            <div key={step.num}>
              <span className="font-serif text-2xl text-gold">{step.num}</span>
              <h3 className="mt-4 font-sans text-xs tracking-eyebrow text-ink">
                {step.title}
              </h3>
              <p className="mt-4 font-sans text-base leading-relaxed text-ink-soft">
                {step.body}
              </p>
              <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-rule bg-parchment px-4 py-2 font-sans text-xs text-ink-soft">
                <span className="text-gold" aria-hidden="true">
                  ●
                </span>
                {step.chip}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
