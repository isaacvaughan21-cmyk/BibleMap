import Reveal from "@/components/Reveal";

/** Problem section — alt background, eyebrow, mixed roman/italic H1, two paras. */
export default function Problem() {
  return (
    <section
      id="problem"
      className="relative overflow-hidden bg-parchment-2 px-gutter py-rhythm md:px-gutter-lg md:py-rhythm-lg"
    >
      <div className="dot-grid absolute inset-0" aria-hidden="true" />

      {/* Oversized serif "?" watermark */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 right-4 select-none font-serif text-[16rem] italic leading-none text-gold/10 md:right-24 md:text-[22rem]"
      >
        ?
      </span>

      <div className="relative mx-auto max-w-3xl">
        <Reveal>
          <p className="font-sans text-2xs tracking-eyebrow text-gold">
            THE PROBLEM
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <h2 className="mt-6 font-serif text-2xl leading-tight text-ink md:text-[2.75rem]">
            You hit something you don&rsquo;t understand —{" "}
            <em className="italic text-ink-soft">and then what?</em>
          </h2>
        </Reveal>

        <div className="mt-10 space-y-6 font-sans text-md leading-relaxed text-ink-soft">
          <Reveal delay={0.2}>
            <p>
              You&rsquo;re reading Hebrews and a name comes up you&rsquo;ve seen
              before but never really understood. You have a real question — but
              no good place to put it.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <p>
              So you skim past it and lose the thread, or fall down a rabbit
              hole of tabs and commentaries with no way to hold it together.
              Either way, the insight slips away.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
