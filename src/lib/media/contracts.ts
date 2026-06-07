/**
 * Semantic media contracts. Components receive finalized media objects
 * — never raw unresolved URLs.
 */

export type MediaRole = "activity-icon" | "steam-hero";
export type AspectRatio = "square" | "landscape" | "portrait";

export type ActivityIconProvider = "lanyard" | "sgdb-icon" | "fallback";
export type SteamHeroProvider = "sgdb-hero" | "steam-cdn" | "fallback";

export interface ActivityIconMedia {
  role: "activity-icon";
  provider: ActivityIconProvider;
  url: string;
  aspectRatio: "square";
}

export interface SteamHeroMedia {
  role: "steam-hero";
  provider: SteamHeroProvider;
  url: string;
  aspectRatio: "landscape";
}

export type GameMedia = ActivityIconMedia | SteamHeroMedia;

export const FALLBACK_PLACEHOLDER = "/assets/game-fallback.svg";
