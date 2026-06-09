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
          Hodos is almost ready. Join the waitlist and be among the first to
          explore Scripture this way.
        </p>

        <div className="mx-auto mt-8 max-w-md rounded-xl border border-gold/40 bg-gold-soft/10 px-6 py-5">
          <p className="font-sans text-2xs tracking-eyebrow text-gold">
            EARLY ACCESS
          </p>
          <p className="mt-2 font-sans text-base leading-relaxed text-ink-soft">
            The first <span className="font-semibold text-ink">10</span> to join
            get <span className="font-semibold text-ink">early beta access</span>{" "}
            — and a{" "}
            <span className="font-semibold text-ink">
              free lifetime subscription
            </span>
            .
          </p>
        </div>

        <div className="mt-10">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
