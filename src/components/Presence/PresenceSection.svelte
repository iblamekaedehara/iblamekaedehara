<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getPresenceTransport } from "../../lib/live/transport/presence-transport";
  import type { PresenceState } from "../../lib/live/transport/presence-transport";
  import { MAX_ACTIVITY_CARDS, PROFILE, SOCIAL_LINKS } from "../../lib/constants";
  import type { DiscordActivity, ResolvedActivity } from "../../lib/types";
  import { getDiscordAvatarUrl } from "../../lib/image-fallback";
  import PresenceCard from "./PresenceCard.svelte";
  import SpotifySection from "../Spotify/SpotifySection.svelte";

  const transport = getPresenceTransport();

  // Monotonic counter — stale async resolutions can't overwrite newer ones.
  let resolveGeneration = 0;

  let connectionState = $state<string>("idle");
  let avatarUrl: string = $state(PROFILE.avatarFallback);
  let presenceState = $state<PresenceState | null>(null);
  let resolvedActivities = $state<ResolvedActivity[]>([]);

  let spotifyCard = $derived(presenceState?.spotify || null);

  let isLive = $derived(
    presenceState?.freshness?.source === "live" ||
    presenceState?.freshness?.source === "soft-stale"
  );

  let priorityActivities = $derived.by(() => {
    return [...resolvedActivities]
      .sort((a, b) => {
        if ((a.type === 0) !== (b.type === 0)) return a.type === 0 ? -1 : 1;
        return 0;
      })
      .slice(0, MAX_ACTIVITY_CARDS);
  });

  let hasVisibleActivity = $derived(priorityActivities.length > 0);

  const STATUS_MAP = {
    online:  { kind: "online",  color: "var(--color-accent-green)", text: "online" },
    idle:    { kind: "idle",    color: "var(--color-accent-amber)", text: "idle" },
    dnd:     { kind: "dnd",     color: "var(--color-accent-red)",   text: "do not disturb" },
    offline: { kind: "offline", color: "var(--color-accent-gray)",  text: "offline" },
  } as const satisfies Record<string, { kind: string; color: string; text: string }>;

  const statusDescriptor = $derived(
    STATUS_MAP[presenceState?.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.offline
  );

  async function resolveActivities(activities: DiscordActivity[]): Promise<ResolvedActivity[]> {
    if (!activities.length) return [];

    const myGeneration = ++resolveGeneration;

    try {
      const res = await fetch("/api/presence-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activities }),
        signal: AbortSignal.timeout(6000),
      });
      if (myGeneration < resolveGeneration) return resolvedActivities;
      if (!res.ok) return resolvedActivities;
      const data = await res.json() as { activities: ResolvedActivity[] };
      return data.activities ?? [];
    } catch {
      // Preserve last-resolved state on error, regardless of generation.
      return resolvedActivities;
    }
  }

  let unsubPresence: (() => void) | null = null;
  let unsubConnection: (() => void) | null = null;

  onMount(() => {
    unsubConnection = transport.onConnection((s) => (connectionState = s));
    unsubPresence = transport.onPresence(async (state) => {
      const rawAvatar = state.user?.avatar
        ? getDiscordAvatarUrl(state.user.id, state.user.avatar, "webp", 160)
        : null;
      avatarUrl = rawAvatar ?? PROFILE.avatarFallback;
      presenceState = state;

      resolvedActivities = await resolveActivities(state.activities ?? []);
    });

    transport.connect();
  });

  onDestroy(() => {
    unsubPresence?.();
    unsubConnection?.();
  });

  // Banner fallback chain: jpg -> png -> svg
  function handleBannerError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    const attempted = img.getAttribute("data-attempted") ?? "jpg";
    if (attempted === "jpg") {
      img.setAttribute("data-attempted", "png");
      img.src = "/assets/banner.png";
    } else if (attempted === "png") {
      img.setAttribute("data-attempted", "svg");
      img.onerror = null;
      img.src = "/assets/banner.svg";
    }
  }
</script>

<div class="flex w-full flex-col gap-3">
  <section aria-label="Profile" class="overflow-hidden">
    <div class="relative h-[148px] overflow-visible rounded-t-[14px] bg-banner sm:h-[168px]">
      <img
        src="/assets/banner.jpg"
        alt=""
        class="h-full w-full object-cover"
        loading="eager"
        data-attempted="jpg"
        onerror={handleBannerError}
      />

      <div class="absolute -bottom-12 left-4 sm:left-6">
        <div class="relative h-[104px] w-[104px] sm:h-[120px] sm:w-[120px]">
          {#if connectionState === "connecting" || connectionState === "idle"}
            <div class="skeleton-pulse h-full w-full rounded-full border-[5px] border-surface"></div>
          {:else}
          <img
            src={avatarUrl}
            alt="Avatar"
            width={128}
            height={128}
            class="h-full w-full rounded-full border-[5px] border-surface object-cover"
            fetchpriority="high"
          />
          {/if}

          <div
            class="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border-[4px] border-surface"
            style="background-color: {isLive ? statusDescriptor.color : 'var(--color-accent-gray)'}"
            aria-label={isLive ? statusDescriptor.text : "offline"}
          >
            {#if isLive && statusDescriptor.kind === "idle"}
              <span class="relative block h-4 w-4 rounded-full bg-accent-amber">
                <span class="absolute -top-0.5 -left-0.5 block h-3.5 w-3.5 rounded-full bg-surface"></span>
              </span>
            {:else if isLive && statusDescriptor.kind === "dnd"}
              <span class="h-1 w-3.5 rounded-full bg-surface"></span>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="px-4 pb-1 pt-14 sm:px-6 sm:pt-16">
      <h1 class="text-[1.35rem] font-semibold leading-tight text-text-primary sm:text-[1.65rem]">
        {PROFILE.displayName}
      </h1>
      <p class="mt-1 text-[0.95rem] leading-snug text-text-secondary sm:text-base">{PROFILE.bio}</p>
    </div>
  </section>

  <span role="status" aria-live="polite" aria-atomic="true" class="sr-only">
    {isLive ? `Discord status: ${statusDescriptor.text}` : "Discord status: offline"}
  </span>

  <section class="card-shell p-4 sm:p-5" aria-label="Social links">
    <div class="section-header mb-3.5">
      <p class="eyebrow">social links</p>
    </div>
    <div class="flex flex-wrap items-center gap-2.5">
      {#each SOCIAL_LINKS as link (link.name)}
        <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.name} class="social-icon">
          <img src={link.icon} alt={link.name} width={30} height={30} class="h-[30px] w-[30px] rounded-[7px] object-cover" loading="lazy" />
        </a>
      {/each}
    </div>
  </section>

  <SpotifySection spotify={spotifyCard} />

  {#if hasVisibleActivity}
    <section aria-label="what am i doing?" class="card-shell p-4 sm:p-5">
      <div class="section-header mb-3.5 flex items-center justify-between">
        <p class="eyebrow">what am i doing rn?</p>
      </div>
      <div class="flex flex-col gap-2.5">
        {#each priorityActivities as activity (activity.id)}
          <PresenceCard {activity} imageUrl={activity.imageUrl} />
        {/each}
      </div>
    </section>
  {:else if connectionState === "connecting" || connectionState === "idle"}
    <section class="card-shell p-4 sm:p-5" aria-label="Loading presence" aria-busy="true">
      <div class="section-header mb-3.5">
        <p class="eyebrow">what am i doing rn?</p>
      </div>
      <div class="inner-card flex items-center gap-3 p-3 sm:gap-4 sm:p-3.5">
        <div class="skeleton-pulse h-[72px] w-[72px] flex-shrink-0 rounded-[10px] sm:h-[78px] sm:w-[78px]"></div>
        <div class="flex flex-1 flex-col gap-2 py-0.5">
          <div class="skeleton-pulse h-2 w-14 rounded-full"></div>
          <div class="skeleton-pulse h-3.5 w-36 rounded-full"></div>
          <div class="skeleton-pulse h-3 w-28 rounded-full"></div>
        </div>
      </div>
    </section>
  {:else if connectionState === "connected" && !spotifyCard}
    <section class="card-shell p-4 sm:p-5">
      <div class="section-header mb-3.5">
        <p class="eyebrow">what am i doing rn?</p>
      </div>
      <div class="inner-card px-4 py-5 text-center text-[0.88rem] text-text-secondary">
        <p>prolly idling or offline</p>
      </div>
    </section>
  {/if}
</div>
