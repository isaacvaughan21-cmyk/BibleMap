import WaitlistForm from "@/components/WaitlistForm";

/** CTA — "Go deep." headline + waitlist form. */
export default function WaitlistCTA() {
  return (
    <section
      id="cta"
      className="relative px-gutter py-rhythm md:px-gutter-lg md:py-rhythm-lg"
    >
      <div className="dot-grid absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className="font-serif text-3xl text-ink md:text-2xl">Go deep.</h2>
        <p className="mx-auto mt-6 max-w-lg font-sans text-md leading-relaxed text-ink-soft">
          Hodos is almost ready. Join the waitlist and be the first to start
          walking the path.
        </p>

        <div className="mt-12">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
