import { collection, doc, getDocs, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { Participant, toParticipant } from "./types";

export interface SpinResult {
  id: string;
  name: string;
  wishlist: string;
}

export const ERR_ALREADY_SPUN = "ALREADY_SPUN";
export const ERR_NO_TARGET = "NO_TARGET";
export const ERR_NOT_FOUND = "NOT_FOUND";

/**
 * Atomically assigns a target to `userId`.
 * Rules enforced inside the transaction:
 *  1. target !== spinner (self-exclusion)
 *  2. target.isDrawn === false (anti-collision)
 *  3. deadlock prevention: never leave the last unspun person as the only undrawn name.
 */
export async function performSpin(userId: string): Promise<SpinResult> {
  // Web SDK transactions can't run queries, so list ids first, then read each doc inside the transaction.
  const listing = await getDocs(collection(db, "participants"));
  const ids = listing.docs.map((d) => d.id);

  return runTransaction(db, async (tx) => {
    const snaps = await Promise.all(ids.map((id) => tx.get(doc(db, "participants", id))));
    const all: Participant[] = snaps.filter((s) => s.exists()).map((s) => toParticipant(s.id, s.data() ?? {}));

    const me = all.find((p) => p.id === userId);
    if (!me) throw new Error(ERR_NOT_FOUND);
    if (me.hasSpun) throw new Error(ERR_ALREADY_SPUN);

    const unspunOthers = all.filter((p) => !p.hasSpun && p.id !== me.id);
    const undrawn = all.filter((p) => !p.isDrawn);
    const candidates = undrawn.filter((p) => p.id !== me.id);

    const safe = candidates.filter((target) => {
      const stillUndrawn = undrawn.filter((p) => p.id !== target.id);
      return !(
        unspunOthers.length === 1 &&
        stillUndrawn.length === 1 &&
        stillUndrawn[0].id === unspunOthers[0].id
      );
    });

    const pool = safe.length > 0 ? safe : candidates;
    if (pool.length === 0) throw new Error(ERR_NO_TARGET);

    const target = pool[Math.floor(Math.random() * pool.length)];

    tx.update(doc(db, "participants", me.id), {
      hasSpun: true,
      drawnParticipantId: target.id,
      drawnParticipantName: target.name,
      drawnParticipantWishlist: target.wishlist,
      spunAt: serverTimestamp(),
    });
    tx.update(doc(db, "participants", target.id), { isDrawn: true });

    return { id: target.id, name: target.name, wishlist: target.wishlist };
  });
}
