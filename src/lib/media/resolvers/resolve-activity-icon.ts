/**
 * Resolve a square activity icon.
 *
 * Order: Lanyard (free, from Discord's own payload) → SteamGridDB (rate-
 * limited third-party) → built-in fallback. Pass the activity payload so
 * the Lanyard step can run.
 */
import * as SGDB from "../providers/sgdb";
import { resolveLanyardAssetUrl } from "../providers/lanyard";
import type { ActivityIconMedia } from "../contracts";
import { FALLBACK_PLACEHOLDER } from "../contracts";
import type { DiscordActivity } from "../../types";
import { getMediaOverride } from "../overrides";

export async function resolveActivityIcon(
  gameName: string,
  activity?: DiscordActivity
): Promise<ActivityIconMedia> {
  const override = getMediaOverride(gameName);
  if (override?.iconUrl) {
    return {
      role: "activity-icon",
      provider: "fallback",
      url: override.iconUrl,
      aspectRatio: "square",
    };
  }

  if (activity) {
    const lanyardUrl = resolveLanyardAssetUrl(activity);
    if (lanyardUrl) {
      return {
        role: "activity-icon",
        provider: "lanyard",
        url: lanyardUrl,
        aspectRatio: "square",
      };
    }
  }

  const gameId = await SGDB.searchGame(gameName);
  if (gameId) {
    const iconUrl = await SGDB.fetchIcons(gameId);
    if (iconUrl) {
      return {
        role: "activity-icon",
        provider: "sgdb-icon",
        url: iconUrl,
        aspectRatio: "square",
      };
    }
    console.warn(`[media] SGDB: no PNG icon found for gameId=${gameId} (name="${gameName}")`);
  } else {
    console.warn(`[media] SGDB: game not found for name="${gameName}"`);
  }

  return {
    role: "activity-icon",
    provider: "fallback",
    url: FALLBACK_PLACEHOLDER,
    aspectRatio: "square",
  };
}
