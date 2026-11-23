"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminDashboard from "@/components/AdminDashboard";

const SESSION_KEY = "ss_admin_unlocked";

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(SESSION_KEY) === "1");
    } catch {
      /* sessionStorage unavailable */
    }
    setReady(true);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const expected = process.env.NEXT_PUBLIC_ADMIN_PIN;
    if (expected && pin === expected) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setError(null);
    } else {
      setError(expected ? "Incorrect passcode." : "NEXT_PUBLIC_ADMIN_PIN is not configured.");
      setPin("");
    }
  };

  if (!ready) return null;
  if (unlocked) return <AdminDashboard />;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4">
      <form onSubmit={handleSubmit} className="rounded-3xl border border-ink/10 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-5">
        <span className="rounded-full bg-crimson px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white">
          Admin
        </span>
        <h1 className="mb-4 mt-3 text-2xl font-semibold text-ink">Enter passcode</h1>
        <input
          type="password"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Admin PIN"
          className="w-full rounded-xl border border-ink/20 px-3 py-3 text-lg outline-none focus:ring-2 focus:ring-emerald"
        />
        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-crimson bg-crimson/10 px-3 py-2 text-sm font-medium text-crimson">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-ink px-4 py-3 font-medium text-white transition hover:bg-ink/85"
        >
          Unlock
        </button>
      </form>
    </main>
  );
}
