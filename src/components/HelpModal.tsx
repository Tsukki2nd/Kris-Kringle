"use client";

import { useEffect } from "react";

interface HelpModalProps {
  onClose: () => void;
}

const STEPS: { title: string; body: string }[] = [
  {
    title: "Enter your name",
    body: "Type your name as it appears on the participant list. Not found? Check the spelling or ask the Admin.",
  },
  {
    title: "Spin the wheel",
    body: "Tap “Spin the Wheel” once. Whoever the pointer lands on is the person you’ll be gifting.",
  },
  {
    title: "Screenshot your match",
    body: "Take a screenshot or photo of the result and their wishlist so you don’t lose it.",
  },
  {
    title: "Lock it with a PIN",
    body: "Create a 4-digit PIN to lock your draw. Don’t use personal or bank PINs, just random digits for this game.",
  },
  {
    title: "Come back anytime",
    body: "Enter your name again and your PIN to see your match. Forgot it? The Admin can help.",
  },
];

export default function HelpModal({ onClose }: HelpModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/40 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="How it works"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.25)] ring-1 ring-ink/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-crimson via-crimson to-emerald" />
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-crimson">Talkstation Cavite</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">How it works</h2>
              <p className="mt-1 text-sm text-ink/50">Secret Santa in 5 quick steps.</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close instructions"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.05] text-ink/60 transition hover:bg-ink hover:text-white"
            >
              ✕
            </button>
          </div>

          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white ${
                    i % 2 === 0 ? "bg-crimson" : "bg-emerald"
                  }`}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{s.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink/60">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-2xl bg-ink/[0.035] px-4 py-3 text-xs leading-relaxed text-ink/70">
            🤫 Keep it a secret until the gift exchange. Each person can only spin once, and results can&apos;t be
            redrawn.
          </div>

          <button
            onClick={onClose}
            className="mt-5 w-full rounded-full bg-ink px-4 py-3.5 text-sm font-medium tracking-wide text-white shadow-[0_8px_20px_rgba(10,10,10,0.25)] transition hover:bg-ink/85 active:scale-[0.99]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
