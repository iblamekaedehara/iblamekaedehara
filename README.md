# @iblamekaedehara

personal hobby project to track my discord rich presence and steam games & anime list activity; acting as a link hub of my socials too- built with astro, svelte, and tailwindcss

live at [kaedehara.qzz.io](https://kaedehara.qzz.io).

---

## what it shows

**social links** — discord, github, spotify, steam, anilist, instagram.

**discord presence** — pulled live from [lanyard](https://lanyard.rest) over websocket. avatar, online status, and whatever activity discord is currently reporting with a live elapsed timer. reflects reality within seconds, no polling involved.

**spotify** — if i'm listening to something, it shows the track, artist, album art, and a progress bar ticking in real time. its fetched though the same lanyard ws- just that spotify gets a spotlight with a custom card.

**steam** — the three most recently played games, with total playtime, a last-played timestamp, and hero artwork. non-steam games (locally added ones) are handled: the app searches the steam store api to resolve a real app id so it can fetch artwork the same way as native games.

**anilist** — what i'm currently watching and the five most recent activity entries (episode progress, completions) from my anilist profile, fetched via their graphql api.


---

## stack

- **[astro 5](https://astro.build/)** — ssr, vercel adapter. steam and anilist sections use `server:defer` so they render a skeleton immediately and stream real content in once the upstream api responds.
- **[svelte 5](https://svelte.dev/)** — handles the interactive parts: the presence section, spotify card, and any per-second ui updates. runes throughout.
- **[tailwind css v4](https://tailwindcss.com/)** — via the vite plugin, with a custom dark theme defined in `global.css` under `@theme`.
- **[valibot](https://valibot.dev/)** — validates the lanyard websocket payload on every message. if the shape is wrong, it gets dropped.
- **typescript** — strict mode.
- **pnpm**, **vercel**.

---

## how it works

### lanyard websocket transport

presence is driven by a singleton transport (`src/lib/live/transport/presence-transport.ts`) that holds a single websocket connection to lanyard. the protocol has two distinct message types that need to be handled differently:

- `init_state` is always a **full replace** — it's a complete snapshot.
- `presence_update` is a **partial merge** — lanyard only sends changed fields. activities are merged by id to preserve timestamps and asset urls that weren't included in the diff.

### tab leader election

only one browser tab should hold the websocket connection at a time. `src/lib/live/transport/leader-election.ts` uses a lease-based approach over `broadcastchannel`: the leader tab heartbeats every 5 seconds, and any other tab that goes 12 seconds without hearing one attempts to take over. non-leader tabs receive state updates via a second `broadcastchannel` that the leader broadcasts to after every lanyard message.

### stale degradation

presence is persisted to `sessionstorage` so there's no empty flash on load. freshness is tracked in three tiers:

- **live** — within 2 minutes of the last websocket message
- **soft-stale** — 2–10 minutes (state and activities still shown)
- **hard-stale** — past 10 minutes (activities and spotify cleared, only identity kept)

### media resolution pipeline

game artwork runs through a prioritized fallback chain defined in `src/lib/media/`:

**activity icons (square):** lanyard cdn (from discord's own payload) → steamgriddb icon → local fallback svg.

**steam hero images (landscape):** steamgriddb hero → steam cdn deterministic url.

all resolved urls are cached server-side for 24 hours. in-flight requests to the same key are deduplicated so concurrent renders don't fire multiple identical api calls.

game names are normalized before any lookup — stripping `™`, `®`, and edition suffixes like "deluxe edition" or "goty edition" — to reduce unnecessary fallbacks from name mismatches across providers.

### shared clock

components that tick per-second (activity elapsed timer, spotify progress bar) subscribe to a single `sharedclock` store that runs one `setinterval` and fans out. no component runs its own interval.

---

## project structure for src

```
iblamekaedeahara/
├── .gitignore                     # ignores generated files and secrets from git
├── astro.config.mjs               # astro framework configuration
├── tsconfig.json                  # typescript configuration
├── LICENSE                        # project license
├── package.json                   # project metadata and dependencies
├── pnpm-lock.yaml                 # locked dependency versions for reproducible installs
│
├── public/                        # static assets served directly
│   └── assets/
│       ├── anilist.png            # anilist branding/image asset
│       ├── avatar-fallback.svg    # fallback avatar image
│       ├── banner.jpg             # main banner/background image
│       ├── banner.svg             # vector banner asset
│       └── discord.png            # discord branding/image asset
│
└── src/
    ├── env.d.ts                   # typescript environment declarations
    │
    ├── components/                # reusable ui components
    │
    │   ├── AniList/
    │   │   ├── AniListActivity.astro   # renders anilist activity cards
    │   │   ├── AniListSection.astro    # main anilist section wrapper
    │   │   └── AniListSkeleton.astro   # loading skeleton for anilist data
    │   │
    │   ├── Presence/
    │   │   ├── PresenceCard.svelte     # live presence/activity card
    │   │   └── PresenceSection.svelte  # grouped presence section container
    │   │
    │   ├── Spotify/
    │   │   ├── SpotifyCard.svelte      # spotify now playing card
    │   │   └── SpotifySection.svelte   # spotify section wrapper
    │   │
    │   └── Steam/
    │       ├── SteamCard.astro         # steam activity/game card
    │       ├── SteamSection.astro      # steam section wrapper
    │       └── SteamSkeleton.astro     # loading skeleton for steam data
    │
    ├── layouts/
    │   └── BaseLayout.astro       # shared page layout and metadata
    │
    ├── lib/                       # utility logic and shared backend helpers
    │   ├── anilist.ts             # anilist api interaction logic
    │   ├── constants.ts           # shared constants/config values
    │   ├── image-fallback.ts      # image fallback handling utilities
    │   ├── normalize-name.ts      # text/name normalization helpers
    │   ├── steam.ts               # steam api interaction logic
    │   │
    │   ├── live/
    │   │                            # likely reserved for realtime/live presence logic
    │   │
    │   ├── media/
    │   │   ├── cache.ts          # media caching logic
    │   │   ├── contracts.ts      # shared media type/contracts definitions
    │   │   └── index.ts          # media utility exports
    │   │
    │   └── schemas/
    │       └── lanyard.ts        # lanyard api schema/type definitions
    │
    ├── pages/
    │   ├── index.astro           # main landing page
    │   │
    │   └── api/                  # server api endpoints
    │       ├── anilist.ts        # anilist api route
    │       ├── game-image.ts     # game image fetching/proxy route
    │       ├── presence-activities.ts # realtime presence api route
    │       └── steam.ts          # steam api route
    │
    └── styles/
        └── global.css            # global styling and theme definitions
```