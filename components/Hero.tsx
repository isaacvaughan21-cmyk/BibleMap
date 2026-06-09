/** Hero — wordmark, Greek subline, Psalm pull-quote, tagline. */
export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] items-center justify-center px-gutter py-rhythm md:px-gutter-lg md:py-rhythm-lg"
    >
      <div className="dot-grid absolute inset-0 -z-[5]" aria-hidden="true" />

      <div className="mx-auto max-w-content text-center">
        <h1 className="font-serif text-4xl leading-none text-ink md:text-[7.5rem]">
          Hodos
        </h1>

        <p className="mt-5 font-sans text-xs tracking-greek text-gold md:text-sm">
          ΟΔΟΣ — THE WAY, THE PATH
        </p>

        <blockquote className="mx-auto mt-10 max-w-2xl">
          <p className="font-serif text-lg italic text-ink-soft md:text-xl">
            &ldquo;Your word is a lamp to my feet and a light to my path.&rdquo;
          </p>
          <cite className="mt-3 block font-sans text-2xs not-italic tracking-eyebrow text-ink-muted">
            — PSALM 119:105
          </cite>
        </blockquote>

        <p className="mx-auto mt-10 max-w-2xl font-sans text-md leading-relaxed text-ink-soft">
          An infinite, zoomable mind map for Bible study — capture every
          question, connect every insight, and walk deeper into the Word than
          you ever have before.
        </p>
      </div>
    </section>
  );
}
