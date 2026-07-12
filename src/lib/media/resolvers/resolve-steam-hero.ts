/**
 * Resolve a landscape hero/banner for the Steam activity section.
 *
 * Priority:
 *  1. SteamGridDB heroes (best quality, landscape)
 *  2. Steam CDN (deterministic URL, no network probe)
 */
import * as SGDB from "../providers/sgdb";
import { fetchSteamHero as fetchCDNHero } from "../providers/steam-cdn";
import type { SteamHeroMedia } from "../contracts";
import { getMediaOverride } from "../overrides";

export async function resolveSteamHero(
  appid: number,
  gameName: string,
): Promise<SteamHeroMedia> {
  const override = getMediaOverride(gameName);
  if (override?.heroUrl) {
    return {
      role: "steam-hero",
      provider: "fallback",
      url: override.heroUrl,
      aspectRatio: "landscape",
    };
  }

  if (!override?.preferSgdbHero) {
    return {
      role: "steam-hero",
      provider: "steam-cdn",
      url: fetchCDNHero(appid),
      aspectRatio: "landscape",
    };
  }

  const gameId = await SGDB.searchGame(gameName);
  if (gameId) {
    const heroUrl = await SGDB.fetchHeroes(gameId);
    if (heroUrl) {
      return {
        role: "steam-hero",
        provider: "sgdb-hero",
        url: heroUrl,
        aspectRatio: "landscape",
      };
    }
  }

  const cdnUrl = fetchCDNHero(appid);
  return {
    role: "steam-hero",
    provider: "steam-cdn",
    url: cdnUrl,
    aspectRatio: "landscape",
  };
}
