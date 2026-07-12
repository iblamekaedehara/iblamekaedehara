/**
 * SteamGridDB provider.
 *
 * All SGDB API calls go through this module. The API key is read
 * from environment variables — never exposed to the client.
 *
 * Filtering strategy: fetch bare endpoints (no query params that could 400)
 * and filter client-side. For icons, apply semantic ranking that optimizes
 * for canonical game identity (the "face" of the game) rather than raw
 * community score. SGDB assets are returned sorted by score descending.
 */
import { cacheGet, cacheSet, cacheKey, dedupe } from "../cache";
import { normalizeGameName } from "../../normalize-name";

const NULL_TTL_MS = 60 * 60 * 1000; // 1 hour — don't hammer SGDB for missing assets

// ── Types ─────────────────────────────────────────────────────────────────

interface SGDBGame {
  id: number;
  name: string;
  types: string[];
  verified: boolean;
}

interface SGDBSearchResult {
  data?: SGDBGame[];
}

interface SGDBAsset {
  url: string;
  thumb: string;
  mime?: string;
  width?: number;
  height?: number;
  style?: string;
  nsfw?: boolean;
  humor?: boolean;
  score?: number;
}

interface SGDBAssetResult {
  data?: SGDBAsset[];
}

// ── API key ───────────────────────────────────────────────────────────────

function apiKey(): string | undefined {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env.STEAM_GRID_API_KEY as string | undefined;
  }
  return undefined;
}

function authHeaders(): Record<string, string> | undefined {
  const key = apiKey();
  if (!key) return undefined;
  return { Authorization: `Bearer ${key}` };
}

async function fetchJSON<T>(url: string): Promise<T | null> {
  const headers = authHeaders();
  if (!headers) {
    console.warn("[media] SGDB: no API key configured (STEAM_GRID_API_KEY missing)");
    return null;
  }

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      console.warn(`[media] SGDB: fetch failed ${res.status} for ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[media] SGDB: fetch error for ${url}:`, err);
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function isRenderableImage(asset: SGDBAsset): boolean {
  const mime = asset.mime ?? "";
  if (!mime) {
    // Infer from URL extension as fallback when MIME is missing
    const url = asset.url ?? "";
    if (url.endsWith(".gif")) return false;
    if (url.endsWith(".ico")) return false;
    return /\.(png|jpg|jpeg|webp)(\?|$)/i.test(url);
  }
  if (mime === "image/x-icon" || mime === "image/vnd.microsoft.icon") return false;
  if (mime === "image/gif") return false; // reject all animated GIFs
  return mime.startsWith("image/");
}

function hasSecureUrl(asset: SGDBAsset): boolean {
  return asset.url?.startsWith("https://") ?? false;
}

// ── Search ────────────────────────────────────────────────────────────────

/** Search SGDB by display name. Returns game ID or null. Nulls cached for 1h to avoid re-hammering. */
export async function searchGame(displayName: string): Promise<number | null> {
  // Full slug: used as cache key for consistent hashing across name variants
  const cacheSlug = normalizeGameName(displayName);
  const key = cacheKey("sgdb", "search", cacheSlug);
  const cached = cacheGet<number | null>(key);
  if (cached !== undefined) return cached;

  // Query name: strip TM/copyright only — preserve natural language spacing and casing
  // SGDB autocomplete matches against registered game names, not slugs
  const queryName = displayName.replace(/[™®©]/g, "").trim();

  const result = await dedupe(key, async () => {
    const data = await fetchJSON<SGDBSearchResult>(
      `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(queryName)}`,
    );
    return data?.data?.find((g) => g.verified)?.id ?? data?.data?.[0]?.id ?? null;
  });

  cacheSet(key, result, result === null ? NULL_TTL_MS : undefined);
  return result;
}

// ── Semantic icon ranking ─────────────────────────────────────────────────
//
// Presence icons represent a game's CANONICAL IDENTITY, not generic artwork.
// The best icon is the one a user immediately associates with the game —
// even if it has lower community score than a well-voted launcher or meme.
//
// Scoring model:
//   base = community score (normalized 0–100)
//   + official bonus
//   + canonical identity bonus (globally recognizable, app-icon-like)
//   - launcher/edition/ecosystem penalty
//   - text-heavy / promotional penalty

/** Keywords that indicate non-canonical branding — these should almost never be presence icons. */
const DEPRIORITIZE_KEYWORDS = [
  "launcher", "client", "manager", "hub", "modpack", "modded",
  "installer", "updater", "beta", "alpha", "companion",
  "mobile", "android", "ios", "edition", "collection",
  "bundle", "trilogy", "soundtrack", "demo", "test", "benchmark",
  "server", "plugin", "addon", "expansion", "dlc",
];

/** Keywords that indicate high-quality canonical identity icons. */
const CANONICAL_KEYWORDS = [
  "icon", "logo", "app", "official", "classic", "original",
  "main", "standard", "default", "primary",
];

function rankIcon(asset: SGDBAsset): number {
  let score = (asset.score ?? 50) / 100; // normalize to 0–1 range

  // Official style bonus
  if (asset.style === "official") score += 0.3;

  // Canonical keywords in the asset metadata (SGDB includes author/name tags)
  const searchText = JSON.stringify(asset).toLowerCase();
  for (const kw of CANONICAL_KEYWORDS) {
    if (searchText.includes(kw)) score += 0.05;
  }

  // Penalize deprioritized keywords
  for (const kw of DEPRIORITIZE_KEYWORDS) {
    if (searchText.includes(kw)) score -= 0.4;
  }

  // Penalize humor/meme uploads
  if (asset.humor) score -= 0.5;

  // Penalize NSFW
  if (asset.nsfw) score -= 1.0;

  return score;
}

// ── Icons ─────────────────────────────────────────────────────────────────

/**
 * Fetch the best canonical identity icon for a presence card.
 *
 * Ranks eligible icons by semantic suitability (canonical identity, official
 * style, absence of launcher/edition/meme keywords) rather than raw community
 * score. Accepts PNG, JPEG, WEBP — rejects ICO.
 */
export async function fetchIcons(gameId: number): Promise<string | null> {
  const key = cacheKey("sgdb", "icons", String(gameId));
  const cached = cacheGet<string | null>(key);
  if (cached !== undefined) return cached;

  const result = await dedupe(key, async () => {
    const data = await fetchJSON<SGDBAssetResult>(
      `https://www.steamgriddb.com/api/v2/icons/game/${gameId}?nsfw=false&humor=false&types=static`,
    );

    if (!data?.data?.length) return null;

    const eligible = data.data
      .filter((a) => isRenderableImage(a) && hasSecureUrl(a))
      .filter((a) => !a.nsfw); // outright reject NSFW

    if (!eligible.length) {
      console.warn(`[media] SGDB: no renderable icon found for gameId=${gameId}`);
      return null;
    }

    // Rank by semantic suitability, then pick the best
    const ranked = eligible
      .map((a) => ({ asset: a, rank: rankIcon(a) }))
      .sort((a, b) => b.rank - a.rank);

    const best = ranked[0];

    return best.asset.url;
  });

  cacheSet(key, result, result === null ? NULL_TTL_MS : undefined);
  return result;
}

// ── Heroes ────────────────────────────────────────────────────────────────

/**
 * Fetch the best hero banner for a game.
 *
 * Strategy: fetch ALL heroes (no query params), filter to renderable
 * HTTPS landscape images. Prefers official style, but any valid hero
 * is better than nothing.
 */
export async function fetchHeroes(gameId: number): Promise<string | null> {
  const key = cacheKey("sgdb", "heroes", String(gameId));
  const cached = cacheGet<string | null>(key);
  if (cached !== undefined) return cached;

  const result = await dedupe(key, async () => {
    const data = await fetchJSON<SGDBAssetResult>(
      `https://www.steamgriddb.com/api/v2/heroes/game/${gameId}?nsfw=false&humor=false&types=static`,
    );

    if (!data?.data?.length) return null;

    const eligible = data.data.filter(
      (a) => isRenderableImage(a) && hasSecureUrl(a) && !a.nsfw && !a.humor,
    );
    if (!eligible.length) {
      console.warn(`[media] SGDB: no renderable hero found for gameId=${gameId}`);
      return null;
    }

    // Prefer official, then highest-scored
    const best = eligible.find((a) => a.style === "official") ?? eligible[0];
    return best.url;
  });

  cacheSet(key, result, result === null ? NULL_TTL_MS : undefined);
  return result;
}
