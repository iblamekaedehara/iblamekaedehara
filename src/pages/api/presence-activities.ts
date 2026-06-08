import type { APIRoute } from "astro";
import { resolveActivityIcon } from "../../lib/media";
import type { DiscordActivity } from "../../lib/types";
import { ACTIVITY_TYPES } from "../../lib/constants";

export const POST: APIRoute = async ({ request }) => {
  let activities: DiscordActivity[] = [];
  try {
    const body = await request.json();
    activities = Array.isArray(body.activities) ? body.activities : [];
  } catch {
    return new Response(JSON.stringify({ activities: [] }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Skip Spotify and Custom Status — they're rendered by their own cards.
  // Every other activity (game, streaming, watching, listening, competing)
  // goes through the icon resolver, which queries Lanyard first and then
  // SteamGridDB by display name — SGDB indexes virtually every app/service
  // (YouTube, Twitch, Spotify-as-app, Crunchyroll, etc.) as a "game".
  const relevant = activities.filter(
    (a) => a.type !== ACTIVITY_TYPES.SPOTIFY && a.type !== ACTIVITY_TYPES.CUSTOM
  );

  const resolved = await Promise.all(
    relevant.map(async (activity) => {
      const imageUrl = (await resolveActivityIcon(activity.name, activity)).url;

      return {
        id: activity.id,
        type: activity.type,
        name: activity.name,
        details: activity.details,
        state: activity.state,
        timestamps: activity.timestamps,
        imageUrl,
      };
    })
  );

  return new Response(JSON.stringify({ activities: resolved }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
