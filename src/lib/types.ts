import type { ValidatedLanyardPresence } from "./schemas/lanyard";

/** Discord activity type — derived from the Valibot schema (single source of truth). */
export type DiscordActivity = NonNullable<ValidatedLanyardPresence["activities"]>[number];

/** Spotify playback data — derived from the Valibot schema. */
export type SpotifyData = NonNullable<ValidatedLanyardPresence["spotify"]>;

/** Resolved activity with image URL — shared between API route and PresenceSection. */
export interface ResolvedActivity {
  id: string;
  type: number;
  name: string;
  details?: string;
  state?: string;
  timestamps?: { start?: number; end?: number };
  imageUrl: string;
}
