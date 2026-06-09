/** Problem section — alt background, eyebrow, mixed roman/italic H1, two paras. */
export default function Problem() {
  return (
    <section
      id="problem"
      className="relative bg-parchment-2 px-gutter py-rhythm md:px-gutter-lg md:py-rhythm-lg"
    >
      <div className="dot-grid absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-3xl">
        <p className="font-sans text-2xs tracking-eyebrow text-gold">
          THE PROBLEM
        </p>

        <h2 className="mt-6 font-serif text-2xl leading-tight text-ink md:text-[2.75rem]">
          You hit something you don&rsquo;t understand —{" "}
          <em className="italic text-ink-soft">and then what?</em>
        </h2>

        <div className="mt-10 space-y-6 font-sans text-md leading-relaxed text-ink-soft">
          <p>
            You&rsquo;re reading Hebrews and a name comes up you&rsquo;ve seen
            before but never really understood. You have a real question — but no
            good place to put it.
          </p>
          <p>
            So you skim past it and lose the thread, or fall down a rabbit hole
            of tabs and commentaries with no way to hold it together. Either way,
            the insight slips away.
          </p>
        </div>
      </div>
    </section>
  );
}
