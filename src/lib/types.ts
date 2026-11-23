import type { DocumentData, Timestamp } from "firebase/firestore";

export interface Participant {
  id: string;
  name: string;
  normalizedName: string;
  wishlist: string;
  pin: string | null;
  hasSpun: boolean;
  drawnParticipantId: string | null;
  drawnParticipantName: string | null;
  drawnParticipantWishlist: string | null;
  isDrawn: boolean;
  spunAt: Timestamp | null;
}

export const normalizeName = (value: string): string => value.trim().toLowerCase();

export function toParticipant(id: string, data: DocumentData): Participant {
  return {
    id,
    name: String(data.name ?? ""),
    normalizedName: String(data.normalizedName ?? ""),
    wishlist: String(data.wishlist ?? ""),
    pin: typeof data.pin === "string" ? data.pin : null,
    hasSpun: Boolean(data.hasSpun),
    drawnParticipantId: typeof data.drawnParticipantId === "string" ? data.drawnParticipantId : null,
    drawnParticipantName: typeof data.drawnParticipantName === "string" ? data.drawnParticipantName : null,
    drawnParticipantWishlist:
      typeof data.drawnParticipantWishlist === "string" ? data.drawnParticipantWishlist : null,
    isDrawn: Boolean(data.isDrawn),
    spunAt: (data.spunAt as Timestamp | null | undefined) ?? null,
  };
}
