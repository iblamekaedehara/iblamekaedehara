<script lang="ts">
  import type { DiscordActivity } from "../../lib/types";
  import { sharedClock } from "../../lib/live/stores/clock";

  let { activity, imageUrl }: { activity: DiscordActivity; imageUrl: string } = $props();

  let now = $state(Date.now());
  let startTimestamp = $state<number | null>(null);

  // Snap the activity start timestamp whenever it changes, so the clock
  // always tracks the authoritative start even across rapid prop updates.
  $effect(() => {
    startTimestamp = activity.timestamps?.start ?? null;
  });

  const activityVerb = $derived.by(() => {
    switch (activity.type) {
      case 0: return "Playing";
      case 1: return "Streaming";
      case 3: return "Watching";
      case 5: return "Competing";
      default: return "Active";
    }
  });

  const displayTime = $derived.by(() => {
    if (startTimestamp === null) return null;
    const elapsed = now - startTimestamp;
    if (elapsed < 0) return null;
    const hrs = Math.floor(elapsed / 3600000);
    const mins = Math.floor((elapsed % 3600000) / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    if (hrs > 0) return `${hrs}:${pad(mins)}:${pad(secs)} elapsed`;
    return `${pad(mins)}:${pad(secs)} elapsed`;
  });

  $effect(() => {
    const unsub = sharedClock.subscribe((t) => (now = t));
    return unsub;
  });
</script>

<div class="inner-card flex items-center gap-3 p-3 sm:gap-4 sm:p-3.5">
  <div class="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-[10px] bg-card sm:h-[78px] sm:w-[78px]">
    <img
      src={imageUrl}
      alt={activity.name}
      width={80}
      height={80}
      class="h-full w-full object-contain"
      loading="lazy"
    />
  </div>

  <div class="min-w-0 flex-1 py-0.5">
    <div class="flex items-center justify-between gap-2">
      <p class="eyebrow">{activityVerb}</p>
      {#if displayTime}
        <span class="shrink-0 font-mono text-[0.7rem] font-semibold tabular-nums text-text-secondary">{displayTime}</span>
      {/if}
    </div>
    <p class="mt-1 truncate text-[0.97rem] font-semibold leading-tight text-text-primary sm:text-base">{activity.name}</p>

    {#if activity.details}
      <p class="mt-0.5 truncate text-[0.85rem] leading-snug text-text-secondary">{activity.details}</p>
    {/if}
    {#if activity.state}
      <p class="truncate text-[0.82rem] leading-snug text-text-muted">{activity.state}</p>
    {/if}
  </div>
</div>
