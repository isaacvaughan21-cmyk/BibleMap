import { versionCredit, versionCreditLink } from "@/lib/versions";

/**
 * The licence-required attribution for a Bible version, rendered wherever that
 * version's text is shown. Returns null for versions that need no credit
 * (the public-domain bundled ones).
 *
 * Some licences require a link as well as the credit line — Crossway's ESV
 * terms say "each page on which you use the text must include a link to
 * www.esv.org" — so the link comes from the version registry rather than being
 * hand-written at each call site.
 */
export function VersionCredit({
  version,
  className,
}: {
  version: string;
  className: string;
}) {
  const credit = versionCredit(version);
  if (!credit) return null;
  const link = versionCreditLink(version);

  return (
    <p className={className}>
      {credit}
      {link && (
        <>
          {" "}
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-rule underline-offset-2 hover:text-gold"
          >
            {link.label}
          </a>
        </>
      )}
    </p>
  );
}
