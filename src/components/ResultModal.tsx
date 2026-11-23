"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ResultModalProps {
  userId: string;
  drawnName: string;
  drawnWishlist: string;
  /** true when the PIN already exists (user unlocked via PIN verification) */
  pinAlreadySet: boolean;
  onDone: () => void;
}

interface PinInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** Four separate digit boxes with auto-advance, backspace and paste support. */
function PinInput({ label, value, onChange }: PinInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (i: number) => refs.current[Math.max(0, Math.min(3, i))]?.focus();

  const handleChange = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "").slice(-1);
    if (!d) {
      onChange(value.slice(0, i));
      return;
    }
    onChange((value.slice(0, i) + d).slice(0, 4));
    if (i < 3) focusBox(i + 1);
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      e.preventDefault();
      onChange(value.slice(0, i - 1));
      focusBox(i - 1);
    } else if (e.key === "ArrowLeft") {
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      focusBox(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!digits) return;
    e.preventDefault();
    onChange(digits);
    focusBox(digits.length >= 4 ? 3 : digits.length);
  };

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-ink/50">{label}</p>
      <div className="grid grid-cols-4 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            aria-label={`${label} digit ${i + 1}`}
            value={value[i] ?? ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.currentTarget.select()}
            className={`h-14 w-full rounded-2xl border text-center text-xl text-ink outline-none transition focus:border-ink focus:ring-4 focus:ring-ink/10 ${
              value[i] ? "border-ink/40 bg-ink/[0.03]" : "border-ink/15 bg-white"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function ResultModal({
  userId,
  drawnName,
  drawnWishlist,
  pinAlreadySet,
  onDone,
}: ResultModalProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(pinAlreadySet);

  const wishItems = drawnWishlist
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError("Please enter all 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("The PINs don't match. Please try again.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "participants", userId), { pin });
      setLocked(true);
    } catch {
      setError("Could not save your PIN. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/40 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="my-4 w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.25)] ring-1 ring-ink/5">
        {/* festive accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-crimson via-crimson to-emerald" />

        <div className="p-6">
          {/* header */}
          <div className="mb-5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-crimson/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-crimson">
              <span aria-hidden>🎁</span> Your match
            </span>
            {locked && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald">
                <span aria-hidden>🔒</span> Locked
              </span>
            )}
          </div>

          {/* match */}
          <p className="text-sm text-ink/50">You drew:</p>
          <p className="mb-5 mt-1 break-words text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-ink">
            {drawnName}
          </p>

          {/* wishlist */}
          <div className="mb-4 rounded-2xl bg-ink/[0.035] p-4">
            <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.15em] text-ink/50">Their wishlist</p>
            {wishItems.length > 0 ? (
              <ul className="space-y-1.5">
                {wishItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-ink/90">
                    <span
                      aria-hidden
                      className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${i % 2 === 0 ? "bg-crimson" : "bg-emerald"}`}
                    />
                    <span className="break-words">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/60">No wishlist provided — surprise them!</p>
            )}
          </div>

          {/* screenshot reminder */}
          <div className="mb-5 rounded-2xl bg-ink px-4 py-3 text-sm leading-snug text-white">
            📸 Take a screenshot or photo of this screen right now so you don&apos;t lose your match!
          </div>

          {!locked ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <p className="text-sm font-medium text-ink">Lock your draw with a 4-digit PIN</p>
                <p className="mt-1 text-xs text-ink/50">You&apos;ll need it to view your match again.</p>
              </div>

              <div className="rounded-2xl border border-crimson/25 bg-crimson/[0.05] px-4 py-3 text-xs leading-relaxed text-ink/80">
                <p className="mb-0.5 font-medium text-crimson">⚠️ Don&apos;t use personal or bank PINs</p>
                No ATM, card, phone or banking codes, and nothing you use anywhere else. Pick a random 4 digits just
                for this game. The Admin can see PINs to help with recovery.
              </div>

              <PinInput label="Create PIN" value={pin} onChange={setPin} />
              <PinInput label="Confirm PIN" value={confirmPin} onChange={setConfirmPin} />

              {error && (
                <p role="alert" className="rounded-2xl border border-crimson/30 bg-crimson/10 px-3.5 py-2.5 text-sm text-crimson">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving || pin.length !== 4 || confirmPin.length !== 4}
                className="w-full rounded-full bg-ink px-4 py-3.5 text-sm font-medium tracking-wide text-white shadow-[0_8px_20px_rgba(10,10,10,0.25)] transition hover:bg-ink/85 active:scale-[0.99] disabled:opacity-40 disabled:shadow-none"
              >
                {saving ? "Saving…" : "Save PIN & lock my draw"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl bg-emerald/10 px-4 py-3.5">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald text-xs text-white"
                >
                  ✓
                </span>
                <p className="text-sm leading-snug text-ink/80">
                  <span className="font-medium text-emerald">Your draw is recorded and locked.</span> It can&apos;t be
                  re-spun or redrawn.
                </p>
              </div>
              <button
                onClick={onDone}
                className="w-full rounded-full border border-ink/20 bg-white px-4 py-3.5 text-sm font-medium tracking-wide text-ink transition hover:bg-ink hover:text-white"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
