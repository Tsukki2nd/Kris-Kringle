"use client";

import { FormEvent, useCallback, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ERR_ALREADY_SPUN, performSpin } from "@/lib/draw";
import { Participant, normalizeName, toParticipant } from "@/lib/types";
import WheelCanvas, { WheelEntry } from "./WheelCanvas";
import ResultModal from "./ResultModal";
import CompanyBrand from "./CompanyBrand";
import HelpModal from "./HelpModal";

type Step = "name" | "pin" | "wheel" | "result";

interface Match {
  name: string;
  wishlist: string;
}

export default function ParticipantFlow() {
  const [step, setStep] = useState<Step>("name");
  const [user, setUser] = useState<Participant | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [entries, setEntries] = useState<WheelEntry[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [finished, setFinished] = useState(false);
  const [pinAlreadySet, setPinAlreadySet] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const reset = () => {
    setStep("name");
    setUser(null);
    setNameInput("");
    setPinInput("");
    setError(null);
    setEntries([]);
    setSpinning(false);
    setTargetId(null);
    setMatch(null);
    setFinished(false);
    setPinAlreadySet(false);
  };

  const handleName = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = normalizeName(nameInput);
    if (!normalized) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "participants"), where("normalizedName", "==", normalized), limit(1))
      );
      if (snap.empty) {
        setError("Your name is not on the participant list. Please check your spelling or contact the Admin.");
        return;
      }
      const p = toParticipant(snap.docs[0].id, snap.docs[0].data());
      setUser(p);

      if (p.hasSpun) {
        if (p.pin) {
          setStep("pin");
        } else {
          // Spun but never saved a PIN (e.g. refreshed mid-flow): let them finish locking.
          setMatch({ name: p.drawnParticipantName ?? "", wishlist: p.drawnParticipantWishlist ?? "" });
          setPinAlreadySet(false);
          setStep("result");
        }
        return;
      }

      const all = await getDocs(collection(db, "participants"));
      const list: WheelEntry[] = all.docs
        .map((d) => ({ id: d.id, name: String(d.data().name ?? "") }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (list.length < 2) {
        setError("The wheel needs at least 2 participants. Please contact the Admin.");
        return;
      }
      setEntries(list);
      setStep("wheel");
    } catch {
      setError("Something went wrong connecting to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePin = (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (pinInput === user.pin) {
      setError(null);
      setMatch({ name: user.drawnParticipantName ?? "", wishlist: user.drawnParticipantWishlist ?? "" });
      setPinAlreadySet(true);
      setStep("result");
    } else {
      setError("Incorrect PIN. Please try again, or ask the Admin if you forgot it.");
      setPinInput("");
    }
  };

  const handleSpin = async () => {
    if (!user || spinning) return;
    setSpinning(true); // disable immediately to prevent double submissions
    setError(null);
    try {
      const result = await performSpin(user.id);
      setMatch({ name: result.name, wishlist: result.wishlist });
      setTargetId(result.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === ERR_ALREADY_SPUN) {
        setError("You have already spun. Refresh the page and enter your PIN to see your match.");
      } else {
        setError("Could not complete the draw. Please try again.");
        setSpinning(false);
      }
    }
  };

  const handleFinished = useCallback(() => {
    setTimeout(() => setFinished(true), 500);
  }, []);

  const showModal = match !== null && user !== null && (step === "result" || finished);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-10 pt-20">
      <button
        onClick={() => setHelpOpen(true)}
        aria-label="How it works"
        title="How it works"
        className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-base font-medium text-ink shadow-[0_6px_20px_rgba(0,0,0,0.12)] ring-1 ring-ink/10 backdrop-blur transition hover:bg-ink hover:text-white active:scale-95"
      >
        ?
      </button>

      <header className="mb-7 flex flex-col items-center text-center">
        <CompanyBrand />
        <span className="mt-6 inline-block rounded-full bg-emerald px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white">
          Kris Kringle
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">🎄 Secret Santa</h1>
        <p className="mt-1 text-sm text-ink/60">Wheel of Names</p>
      </header>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {step === "name" && (
        <form onSubmit={handleName} className="rounded-3xl border border-ink/10 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-5">
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-ink">
            What&apos;s your name?
          </label>
          <input
            id="name"
            type="text"
            autoComplete="off"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Enter your name"
            className="w-full rounded-xl border border-ink/20 px-3 py-3 text-lg outline-none focus:ring-2 focus:ring-emerald"
          />
          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-crimson bg-crimson/10 px-3 py-2 text-sm font-medium text-crimson">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-full bg-ink px-4 py-3 font-medium text-white transition hover:bg-ink/85 disabled:opacity-50"
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>
      )}

      {step === "pin" && user && (
        <form onSubmit={handlePin} className="rounded-3xl border border-ink/10 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-5">
          <p className="mb-1 text-lg font-medium text-ink">Welcome back, {user.name}</p>
          <p className="mb-4 text-sm text-ink/60">
            You&apos;ve already spun. Enter your 4-digit PIN to view your match.
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            className="w-full rounded-xl border border-ink/20 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-emerald"
          />
          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-crimson bg-crimson/10 px-3 py-2 text-sm font-medium text-crimson">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pinInput.length !== 4}
            className="mt-4 w-full rounded-full bg-ink px-4 py-3 font-medium text-white transition hover:bg-ink/85 disabled:opacity-40"
          >
            Unlock my match
          </button>
          <button type="button" onClick={reset} className="mt-3 w-full text-sm text-ink/60 underline">
            Not you? Go back
          </button>
        </form>
      )}

      {step === "wheel" && user && (
        <section className="flex flex-col items-center">
          <p className="mb-4 text-center text-sm text-ink/70">
            Hi <span className="font-medium text-ink">{user.name}</span>! Spin to find out who you&apos;re gifting.
          </p>
          <WheelCanvas entries={entries} targetId={targetId} onFinished={handleFinished} />
          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-crimson bg-crimson/10 px-3 py-2 text-sm font-medium text-crimson">
              {error}
            </p>
          )}
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="mt-6 w-full rounded-full bg-crimson px-6 py-4 text-base font-medium tracking-[0.15em] text-white shadow-[0_8px_24px_rgba(220,38,38,0.35)] transition hover:bg-crimson/90 active:scale-[0.98] disabled:opacity-50"
          >
            {spinning ? "SPINNING…" : "SPIN THE WHEEL"}
          </button>
        </section>
      )}

      {showModal && user && match && (
        <ResultModal
          userId={user.id}
          drawnName={match.name}
          drawnWishlist={match.wishlist}
          pinAlreadySet={pinAlreadySet}
          onDone={reset}
        />
      )}
    </main>
  );
}
