/**
 * Lanyard-supplied activity asset URL builders.
 *
 * Lanyard exposes Discord's raw gateway `activities` array. The
 * `assets.large_image` field comes in three flavors — each requires a
 * different URL. This module is pure (no network calls).
 */
import type { DiscordActivity } from "../../types";

const DISCORD_MEDIA_HOST = "https://media.discordapp.net/external";
const DISCORD_CDN_HOST = "https://cdn.discordapp.com/app-assets";
const SPOTIFY_CDN_HOST = "https://i.scdn.co/image";

const SPOTIFY_ASSET_PREFIX = "spotify:";
const EXTERNAL_ASSET_PREFIX = "mp:external/";

export function resolveLanyardAssetUrl(activity: DiscordActivity): string | null {
  const raw = activity.assets?.large_image;
  if (!raw) return null;

  if (raw.startsWith(EXTERNAL_ASSET_PREFIX)) {
    return buildExternalUrl(raw);
  }

  if (raw.startsWith(SPOTIFY_ASSET_PREFIX)) {
    const hash = raw.slice(SPOTIFY_ASSET_PREFIX.length);
    if (!hash) return null;
    return `${SPOTIFY_CDN_HOST}/${hash}`;
  }

  // Bare or path-style internal Discord app asset — uses activity.application_id.
  const appId = activity.application_id;
  if (!appId) return null;
  const assetKey = raw.includes("/") ? raw.split("/").pop() : raw;
  if (!assetKey) return null;
  return `${DISCORD_CDN_HOST}/${appId}/${assetKey}.png`;
}

// Discord has already percent-encoded the trailing URL, so we keep it verbatim.
function buildExternalUrl(raw: string): string | null {
  const stripped = raw.slice(EXTERNAL_ASSET_PREFIX.length);
  const slash = stripped.indexOf("/");
  if (slash === -1) return null;
  const hash = stripped.slice(0, slash);
  const url = stripped.slice(slash + 1);
  if (!hash || !url) return null;
  return `${DISCORD_MEDIA_HOST}/${hash}/${url}`;
}
