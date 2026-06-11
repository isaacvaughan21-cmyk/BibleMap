/**
 * Beta invite email — rendered server-side and sent via Resend
 * (resend.com) once RESEND_API_KEY is configured. Email clients need
 * inline styles and literal colors, so the brand tokens appear here as
 * hex by necessity (the only sanctioned exception to the no-hex rule).
 *
 * Magic link format: https://hodos-dusky.vercel.app/app?invite=<token>
 */

const colors = {
  parchment: "#F4EFE6",
  parchment2: "#EFE9DC",
  ink: "#16202B",
  inkSoft: "#2C3744",
  inkMuted: "#5B6675",
  gold: "#B98A3A",
  rule: "#E4DDCB",
};

const serif = "Georgia, 'Times New Roman', serif";
const sans = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export default function BetaInviteEmail({
  inviteUrl = "https://hodos-dusky.vercel.app/app?invite=preview-token",
  recipientName,
}: {
  inviteUrl?: string;
  recipientName?: string;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: "32px 16px",
          backgroundColor: colors.parchment2,
          fontFamily: sans,
        }}
      >
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ maxWidth: 520, margin: "0 auto" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  backgroundColor: colors.parchment,
                  border: `1px solid ${colors.rule}`,
                  borderRadius: 16,
                  padding: "40px 36px",
                }}
              >
                {/* Wordmark */}
                <p style={{ margin: 0 }}>
                  <span
                    style={{
                      fontFamily: serif,
                      fontSize: 24,
                      color: colors.ink,
                    }}
                  >
                    Hodos
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.5em",
                      color: colors.gold,
                      marginLeft: 10,
                    }}
                  >
                    ΟΔΟΣ
                  </span>
                </p>

                <hr
                  style={{
                    border: 0,
                    borderTop: `1px solid ${colors.rule}`,
                    margin: "24px 0",
                  }}
                />

                <p
                  style={{
                    fontFamily: serif,
                    fontSize: 20,
                    lineHeight: 1.4,
                    color: colors.ink,
                    margin: "0 0 16px",
                  }}
                >
                  {recipientName ? `${recipientName}, your` : "Your"} canvas is
                  ready.
                </p>

                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: colors.inkSoft,
                    margin: "0 0 12px",
                  }}
                >
                  You&rsquo;re one of the first to study Scripture on an
                  infinite, zoomable mind map. Capture every question, connect
                  every verse, and follow the cross-references wherever they
                  lead.
                </p>

                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: colors.inkSoft,
                    margin: "0 0 28px",
                  }}
                >
                  No account, no setup — the link below drops you straight onto
                  your canvas.
                </p>

                <p style={{ textAlign: "center", margin: "0 0 28px" }}>
                  <a
                    href={inviteUrl}
                    style={{
                      display: "inline-block",
                      backgroundColor: colors.gold,
                      color: colors.parchment,
                      fontSize: 14,
                      fontWeight: 600,
                      textDecoration: "none",
                      borderRadius: 999,
                      padding: "12px 32px",
                    }}
                  >
                    Open your canvas
                  </a>
                </p>

                <p
                  style={{
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: colors.inkMuted,
                    margin: 0,
                  }}
                >
                  Everything you map is saved privately on your device. Found
                  something rough? There&rsquo;s a &ldquo;Send Isaac a
                  note&rdquo; button in the corner — I read every one.
                </p>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "20px 8px 0", textAlign: "center" }}>
                <p
                  style={{
                    fontSize: 11,
                    color: colors.inkMuted,
                    margin: 0,
                  }}
                >
                  Hodos — the way, the path. You received this because you
                  joined the waitlist.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
