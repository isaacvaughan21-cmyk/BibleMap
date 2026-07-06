"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { listMyGroups, type GroupRow } from "@/lib/groups/realtime";
import { isCloudEnabled } from "@/lib/supabase-browser";
import { useAuthUser } from "@/lib/use-auth";

/**
 * Group map sharing — create or join a group whose canvas everyone edits live.
 * Sits in the canvas top bar. Hidden entirely when cloud isn't configured;
 * prompts sign-in (collaboration needs a stable identity) when signed out.
 */
export default function GroupsMenu() {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const session = useCanvasStore((s) => s.groupSession);
  const online = useCanvasStore((s) => s.groupMembersOnline);
  const createGroup = useCanvasStore((s) => s.createGroup);
  const joinGroup = useCanvasStore((s) => s.joinGroup);
  const leaveGroup = useCanvasStore((s) => s.leaveGroup);
  const openGroup = useCanvasStore((s) => s.openGroup);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);

  const refresh = useCallback(() => {
    if (!user) return;
    void listMyGroups().then(setGroups);
  }, [user]);

  useEffect(() => {
    if (open && user) {
      refresh();
      setMode("menu");
      setError(null);
    }
  }, [open, user, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Cloud off → the feature doesn't exist yet. Keep the bar uncluttered.
  if (!isCloudEnabled()) return null;

  const inviteLink = (c: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/app?join=${c}`
      : `/app?join=${c}`;

  const copy = async (c: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(c));
      setCopied(c);
      setTimeout(() => setCopied((v) => (v === c ? null : v)), 1800);
    } catch {
      /* clipboard blocked — the link is still shown for manual copy */
    }
  };

  const doCreate = async () => {
    setBusy(true);
    setError(null);
    const g = await createGroup(name.trim() || "Shared map");
    setBusy(false);
    if (!g) {
      setError("Couldn't create the group. Try again.");
      return;
    }
    setName("");
    setOpen(false);
  };

  const doJoin = async () => {
    setBusy(true);
    setError(null);
    const { group, error: err } = await joinGroup(code.trim());
    setBusy(false);
    if (!group) {
      setError(err ?? "That invite code didn't work.");
      return;
    }
    setCode("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Group sharing"
        title="Share this map with a group"
        className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 transition-colors ${
          session
            ? "border-gold bg-gold/10 text-gold"
            : open
              ? "border-gold text-gold"
              : "border-rule text-ink-muted hover:border-gold hover:text-gold"
        }`}
      >
        <PeopleIcon />
        {session && (
          <span className="flex items-center gap-1 font-sans text-2xs tabular-nums">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
            />
            {online.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            aria-label="Group sharing"
            className="absolute right-0 top-10 z-50 w-72 animate-fade-up overflow-hidden rounded-xl border border-rule bg-parchment py-1.5 shadow-xl shadow-ink/10"
          >
            <p className="px-4 pb-1 pt-1.5 font-sans text-2xs tracking-eyebrow text-ink-muted">
              GROUP MAPS
            </p>

            {!user ? (
              <div className="px-4 py-3">
                <p className="font-serif text-sm italic text-ink-soft">
                  Study together, live.
                </p>
                <p className="mt-1 font-sans text-xs text-ink-muted">
                  Sign in to create or join a group and edit one map with others
                  in real time.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new Event("hodos:open-gate"));
                    setOpen(false);
                  }}
                  className="mt-3 w-full rounded-full bg-gold px-4 py-2 font-sans text-xs font-medium text-parchment transition-colors hover:bg-ink"
                >
                  Sign in to collaborate
                </button>
              </div>
            ) : mode === "create" ? (
              <div className="px-4 py-2">
                <label className="font-sans text-2xs tracking-eyebrow text-ink-muted">
                  GROUP NAME
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy) void doCreate();
                  }}
                  placeholder="Tuesday Bible study"
                  maxLength={60}
                  className="mt-1 w-full rounded-lg border border-rule bg-parchment-2 px-3 py-2 font-sans text-sm text-ink focus:border-gold focus:outline-none"
                />
                {error && <ErrorLine text={error} />}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void doCreate()}
                    className="flex-1 rounded-full bg-gold px-4 py-2 font-sans text-xs font-medium text-parchment transition-colors hover:bg-ink disabled:opacity-50"
                  >
                    {busy ? "Creating…" : "Create group"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("menu")}
                    className="rounded-full border border-rule px-3 py-2 font-sans text-xs text-ink-muted hover:text-ink"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : mode === "join" ? (
              <div className="px-4 py-2">
                <label className="font-sans text-2xs tracking-eyebrow text-ink-muted">
                  INVITE CODE
                </label>
                <input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy) void doJoin();
                  }}
                  placeholder="ABCD2345"
                  maxLength={8}
                  className="mt-1 w-full rounded-lg border border-rule bg-parchment-2 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-ink focus:border-gold focus:outline-none"
                />
                {error && <ErrorLine text={error} />}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || code.trim().length < 4}
                    onClick={() => void doJoin()}
                    className="flex-1 rounded-full bg-gold px-4 py-2 font-sans text-xs font-medium text-parchment transition-colors hover:bg-ink disabled:opacity-50"
                  >
                    {busy ? "Joining…" : "Join group"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("menu")}
                    className="rounded-full border border-rule px-3 py-2 font-sans text-xs text-ink-muted hover:text-ink"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <>
                {groups.length > 0 && (
                  <div className="max-h-56 overflow-y-auto px-1.5 py-0.5">
                    {groups.map((g) => {
                      const isActive = g.id === activeCanvasId;
                      return (
                        <div
                          key={g.id}
                          className="rounded-lg px-2.5 py-2 transition-colors hover:bg-parchment-2"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                isActive ? "bg-gold" : "bg-rule"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                void openGroup(g);
                                setOpen(false);
                              }}
                              className="min-w-0 flex-1 truncate text-left font-sans text-sm text-ink-soft transition-colors hover:text-ink"
                            >
                              {g.name}
                            </button>
                            <span className="shrink-0 font-sans text-2xs text-ink-muted">
                              {g.member_count ?? 1}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 pl-3.5">
                            <code className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-2xs tracking-widest text-ink-soft">
                              {g.invite_code}
                            </code>
                            <button
                              type="button"
                              onClick={() => void copy(g.invite_code)}
                              className="font-sans text-2xs text-gold transition-colors hover:text-ink"
                            >
                              {copied === g.invite_code
                                ? "Copied!"
                                : "Copy link"}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await leaveGroup(g.id);
                                refresh();
                              }}
                              className="ml-auto font-sans text-2xs text-ink-muted transition-colors hover:text-danger"
                            >
                              Leave
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {groups.length === 0 && (
                  <p className="px-4 py-2 font-sans text-xs text-ink-muted">
                    You&rsquo;re not in any groups yet. Create one, or join with
                    an invite code.
                  </p>
                )}
                <div
                  className="mx-4 my-1.5 h-px bg-rule/70"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMode("create");
                    setError(null);
                  }}
                  className="block w-full px-4 py-2 text-left font-sans text-xs text-ink-soft transition-colors hover:bg-parchment-2 hover:text-ink"
                >
                  + New group
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMode("join");
                    setError(null);
                  }}
                  className="block w-full px-4 py-2 text-left font-sans text-xs text-ink-soft transition-colors hover:bg-parchment-2 hover:text-ink"
                >
                  Join with a code…
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-1.5 font-sans text-2xs text-danger">
      {text}
    </p>
  );
}

function PeopleIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="5.5" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M1.8 13c0-2.1 1.7-3.6 3.7-3.6s3.7 1.5 3.7 3.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M10.5 3.2a2.2 2.2 0 0 1 0 4.1M11.4 9.6c1.6.2 2.8 1.6 2.8 3.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
