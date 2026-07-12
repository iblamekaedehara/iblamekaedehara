/**
 * Resolve a landscape hero/banner for the Steam activity section.
 *
 * Priority:
 *  1. Steam CDN (official, deterministic URL, no network probe)
 */
import { fetchSteamHero as fetchCDNHero } from "../providers/steam-cdn";
import type { SteamHeroMedia } from "../contracts";

export async function resolveSteamHero(
  appid: number,
  _gameName: string,
): Promise<SteamHeroMedia> {
  return {
    role: "steam-hero",
    provider: "steam-cdn",
    url: fetchCDNHero(appid),
    aspectRatio: "landscape",
  };
}
