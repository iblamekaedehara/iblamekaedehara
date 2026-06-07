/**
 * Steam CDN provider.
 *
 * Deterministic URL construction for Steam hero images.
 * No network probing — Steam CDN URLs are deterministic.
 * Used ONLY by the Steam activity tab (landscape hero role).
 * Never used for presence activity icons.
 */

/**
 * Return the Steam CDN library hero URL for an appid.
 *
 * The URL is constructed deterministically with no network validation.
 * If the appid exists on Steam the image will load; if not, the caller
 * should handle fallback via CSS background or a placeholder.
 */
export function fetchSteamHero(appid: number): string {
  // header.jpg (920×430) is ~10× smaller than library_hero.jpg (3840×1240)
  // and renders identically at card sizes with object-cover cropping.
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}
