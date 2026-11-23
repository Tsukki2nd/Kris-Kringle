"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Participant, normalizeName, toParticipant } from "@/lib/types";

const BATCH_LIMIT = 400;

const emptyDraw = {
  hasSpun: false,
  pin: null,
  drawnParticipantId: null,
  drawnParticipantName: null,
  drawnParticipantWishlist: null,
  spunAt: null,
};

/** Queues the writes that reset one user and free the person they drew. */
function queueResetUser(batch: WriteBatch, user: Participant, all: Participant[]) {
  batch.update(doc(db, "participants", user.id), emptyDraw);
  if (user.drawnParticipantId && all.some((p) => p.id === user.drawnParticipantId)) {
    batch.update(doc(db, "participants", user.drawnParticipantId), { isDrawn: false });
  }
}

export default function AdminDashboard() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [name, setName] = useState("");
  const [wishlist, setWishlist] = useState("");
  const [bulk, setBulk] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editWishlist, setEditWishlist] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "participants")),
      (snap) => {
        const list = snap.docs
          .map((d) => toParticipant(d.id, d.data()))
          .sort((a, b) => a.name.localeCompare(b.name));
        setParticipants(list);
        setLoaded(true);
      },
      () => setNotice({ kind: "err", text: "Could not load participants. Check your Firebase config and rules." })
    );
    return unsub;
  }, []);

  const total = participants.length;
  const spun = useMemo(() => participants.filter((p) => p.hasSpun).length, [participants]);
  const remaining = total - spun;
  const spinsStarted = spun > 0;
  const byId = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);

  const flash = (kind: "ok" | "err", text: string) => setNotice({ kind, text });

  const existingNames = () => new Set(participants.map((p) => p.normalizedName));

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return flash("err", "Name is required.");
    if (existingNames().has(normalizeName(trimmed))) return flash("err", `"${trimmed}" is already on the list.`);
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, "participants")), newParticipantData(trimmed, wishlist.trim()));
      await batch.commit();
      setName("");
      setWishlist("");
      flash("ok", `Added ${trimmed}.`);
    } catch {
      flash("err", "Could not add participant.");
    } finally {
      setBusy(false);
    }
  };

  const handleBulk = async (e: FormEvent) => {
    e.preventDefault();
    const seen = existingNames();
    const rows: { name: string; wishlist: string }[] = [];
    let skipped = 0;
    for (const line of bulk.split("\n")) {
      if (!line.trim()) continue;
      const idx = line.indexOf("|");
      const n = (idx === -1 ? line : line.slice(0, idx)).trim();
      const w = idx === -1 ? "" : line.slice(idx + 1).trim();
      const key = normalizeName(n);
      if (!n || seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      rows.push({ name: n, wishlist: w });
    }
    if (rows.length === 0) return flash("err", "Nothing to import (empty or all duplicates).");
    setBusy(true);
    try {
      for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        rows.slice(i, i + BATCH_LIMIT).forEach((r) =>
          batch.set(doc(collection(db, "participants")), newParticipantData(r.name, r.wishlist))
        );
        await batch.commit();
      }
      setBulk("");
      flash("ok", `Imported ${rows.length} participant(s)${skipped ? `, skipped ${skipped} duplicate/empty line(s)` : ""}.`);
    } catch {
      flash("err", "Bulk import failed.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: Participant) => {
    if (
      spinsStarted &&
      !window.confirm(
        "Spins have already started. Changing a name or wishlist will also update anyone who drew this person. Continue?"
      )
    )
      return;
    setEditingId(p.id);
    setEditName(p.name);
    setEditWishlist(p.wishlist);
  };

  const saveEdit = async (p: Participant) => {
    const trimmed = editName.trim();
    if (!trimmed) return flash("err", "Name is required.");
    const clash = participants.find((o) => o.id !== p.id && o.normalizedName === normalizeName(trimmed));
    if (clash) return flash("err", `"${trimmed}" is already on the list.`);
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "participants", p.id), {
        name: trimmed,
        normalizedName: normalizeName(trimmed),
        wishlist: editWishlist.trim(),
      });
      participants
        .filter((o) => o.drawnParticipantId === p.id)
        .forEach((o) =>
          batch.update(doc(db, "participants", o.id), {
            drawnParticipantName: trimmed,
            drawnParticipantWishlist: editWishlist.trim(),
          })
        );
      await batch.commit();
      setEditingId(null);
      flash("ok", "Participant updated.");
    } catch {
      flash("err", "Could not save changes.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (p: Participant) => {
    const drawers = participants.filter((o) => o.drawnParticipantId === p.id);
    const warning =
      p.hasSpun || drawers.length > 0
        ? `Delete ${p.name}? Their draw will be undone${
            drawers.length ? ` and ${drawers.map((d) => d.name).join(", ")} will have to spin again` : ""
          }.`
        : `Delete ${p.name}?`;
    if (!window.confirm(warning)) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      if (p.hasSpun) queueResetUser(batch, p, participants);
      drawers.forEach((d) => queueResetUser(batch, d, participants));
      batch.delete(doc(db, "participants", p.id));
      await batch.commit();
      flash("ok", `Deleted ${p.name}.`);
    } catch {
      flash("err", "Could not delete participant.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetUser = async (p: Participant) => {
    if (!window.confirm(`Reset ${p.name}? They will be able to spin again and the person they drew is freed up.`)) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      queueResetUser(batch, p, participants);
      await batch.commit();
      flash("ok", `${p.name} has been reset.`);
    } catch {
      flash("err", "Could not reset user.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetAll = async () => {
    if (!window.confirm("Reset ALL draws? Every participant's spin, PIN and match will be cleared. This cannot be undone."))
      return;
    setBusy(true);
    try {
      for (let i = 0; i < participants.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        participants
          .slice(i, i + BATCH_LIMIT)
          .forEach((p) => batch.update(doc(db, "participants", p.id), { ...emptyDraw, isDrawn: false }));
        await batch.commit();
      }
      flash("ok", "All draws have been reset.");
    } catch {
      flash("err", "Could not reset all draws.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full rounded-xl border border-ink/20 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald";
  const btnDark = "rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/85 disabled:opacity-50";
  const btnLine = "rounded-xl border border-ink/20 px-3 py-1 text-xs font-medium text-ink transition hover:bg-ink hover:text-white disabled:opacity-50";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="rounded-full bg-crimson px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white">
            Admin
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Secret Santa Dashboard</h1>
        </div>
        <button
          onClick={() => {
            try {
              sessionStorage.removeItem("ss_admin_unlocked");
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
          className={btnLine}
        >
          Lock
        </button>
      </header>

      {notice && (
        <div
          role="status"
          className={`rounded-xl border px-3 py-2 text-sm font-medium ${
            notice.kind === "ok"
              ? "border-emerald bg-emerald/10 text-emerald"
              : "border-crimson bg-crimson/10 text-crimson"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Counters */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Participants", value: total, tone: "border-ink" },
          { label: "Spins Completed", value: spun, tone: "border-emerald" },
          { label: "Remaining", value: remaining, tone: "border-crimson" },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border ${c.tone} p-4 text-center`}>
            <p className="text-3xl font-semibold text-ink">{c.value}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/60">{c.label}</p>
          </div>
        ))}
      </section>

      {/* Roster setup */}
      <section className="grid gap-4 md:grid-cols-2">
        <form onSubmit={handleAdd} className="space-y-3 rounded-3xl border border-ink/10 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-4">
          <h2 className="text-lg font-medium text-ink">Add participant</h2>
          <input className={inputCls} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea
            className={`${inputCls} min-h-[90px]`}
            placeholder="Wishlist (optional, multiple lines OK)"
            value={wishlist}
            onChange={(e) => setWishlist(e.target.value)}
          />
          <button type="submit" disabled={busy} className={btnDark}>
            Add
          </button>
        </form>

        <form onSubmit={handleBulk} className="space-y-3 rounded-3xl border border-ink/10 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-4">
          <h2 className="text-lg font-medium text-ink">Bulk import</h2>
          <p className="text-xs text-ink/60">
            One person per line: <code className="font-mono">Name | Wishlist</code>
          </p>
          <textarea
            className={`${inputCls} min-h-[120px] font-mono text-sm`}
            placeholder={"Maria Santos | Books, coffee\nJuan Dela Cruz | Socks, board games"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <button type="submit" disabled={busy} className={btnDark}>
            Import list
          </button>
        </form>
      </section>

      {/* Roster */}
      <section className="rounded-3xl border border-ink/10 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-4">
        <h2 className="mb-3 text-lg font-medium text-ink">Participant roster</h2>
        {spinsStarted && (
          <p className="mb-3 rounded-xl border border-crimson bg-crimson/10 px-3 py-2 text-xs font-medium text-crimson">
            ⚠️ Spins have started. Editing or deleting people now can affect existing matches.
          </p>
        )}
        {!loaded ? (
          <p className="text-sm text-ink/60">Loading…</p>
        ) : participants.length === 0 ? (
          <p className="text-sm text-ink/60">No participants yet.</p>
        ) : (
          <ul className="divide-y divide-ink/15">
            {participants.map((p) => (
              <li key={p.id} className="py-3">
                {editingId === p.id ? (
                  <div className="space-y-2">
                    <input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <textarea
                      className={`${inputCls} min-h-[70px]`}
                      value={editWishlist}
                      onChange={(e) => setEditWishlist(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(p)} disabled={busy} className={btnDark}>
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className={btnLine}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="whitespace-pre-wrap break-words text-sm text-ink/60">
                        {p.wishlist || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => startEdit(p)} disabled={busy} className={btnLine}>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={busy}
                        className="rounded-xl border border-crimson px-3 py-1 text-xs font-medium text-crimson transition hover:bg-crimson hover:text-white disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Master results */}
      <section className="rounded-3xl border border-ink/10 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-ink">Live master draw results</h2>
          <button
            onClick={handleResetAll}
            disabled={busy || total === 0}
            className="rounded-xl bg-crimson px-4 py-2 text-sm font-medium text-white transition hover:bg-crimson/90 disabled:opacity-50"
          >
            Reset All Draws
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-xs uppercase tracking-wide text-ink/60">
                <th className="py-2 pr-3">Participant</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Drew</th>
                <th className="py-2 pr-3">PIN</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="border-b border-ink/15">
                  <td className="py-2 pr-3 font-medium text-ink">{p.name}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                        p.hasSpun ? "bg-emerald" : "bg-ink/50"
                      }`}
                    >
                      {p.hasSpun ? "Spun" : "Pending"}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {p.drawnParticipantName ?? byId.get(p.drawnParticipantId ?? "")?.name ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono tracking-widest">{p.pin ?? "—"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleResetUser(p)} disabled={busy || !p.hasSpun} className={btnLine}>
                      Reset User
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function newParticipantData(name: string, wishlist: string) {
  return {
    name,
    normalizedName: normalizeName(name),
    wishlist,
    pin: null,
    hasSpun: false,
    drawnParticipantId: null,
    drawnParticipantName: null,
    drawnParticipantWishlist: null,
    isDrawn: false,
    spunAt: null,
  };
}
