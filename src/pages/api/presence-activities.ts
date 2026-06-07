import type { APIRoute } from "astro";
import { resolveActivityIcon } from "../../lib/media";
import { FALLBACK_PLACEHOLDER } from "../../lib/media/contracts";
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
  const relevant = activities.filter(
    (a) => a.type !== ACTIVITY_TYPES.SPOTIFY && a.type !== ACTIVITY_TYPES.CUSTOM
  );

  const resolved = await Promise.all(
    relevant.map(async (activity) => {
      const isGame = activity.type === 0 || activity.type === 1;
      const imageUrl = isGame
        ? (await resolveActivityIcon(activity.name, activity)).url
        : FALLBACK_PLACEHOLDER;

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
