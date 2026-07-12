<script lang="ts">
  import type { SpotifyData } from "../../lib/types";
  import { sharedClock } from "../../lib/live/stores/clock";

  let { spotify }: { spotify: SpotifyData } = $props();

  let progressPercent = $state(0);
  let currentTime = $state("00:00");
  let endTime = $state("00:00");
  // Outer ref allows the effect to cancel the previous subscription before re-subscribing on prop change
  let unsubClock: (() => void) | null = null;

  function formatClock(ms: number): string {
    if (!ms || ms <= 0) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function handleCoverError(e: Event) {
    const img = e.target as HTMLImageElement;
    img.src = "/assets/music-fallback.svg";
    img.onerror = null;
  }

  function tick(now: number) {
    const elapsed = now - spotify.timestamps.start;
    const total = spotify.timestamps.end - spotify.timestamps.start;
    if (elapsed >= total) {
      progressPercent = 100;
      currentTime = endTime;
      return;
    }
    progressPercent = Math.min((elapsed / total) * 100, 100);
    currentTime = formatClock(elapsed);
  }

  $effect(() => {
    spotify;
    endTime = formatClock(spotify.timestamps.end - spotify.timestamps.start);
    tick(Date.now());
    unsubClock?.();
    unsubClock = sharedClock.subscribe(tick);
    return () => unsubClock?.();
  });
</script>

<div class="fade-in inner-card relative overflow-hidden p-3 sm:p-3.5">
  <div
    class="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-[0.13] blur-2xl"
    style="background-image: url('{spotify.album_art_url}')"
    aria-hidden="true"
  ></div>
  <div class="pointer-events-none absolute inset-0 bg-panel/80" aria-hidden="true"></div>

  <div class="relative flex items-center gap-3 sm:gap-4">
    <div class="h-[76px] w-[76px] flex-shrink-0 overflow-hidden rounded-[10px] shadow-[0_10px_28px_rgba(0,0,0,0.26)] sm:h-[92px] sm:w-[92px]">
      <img src={spotify.album_art_url} alt={spotify.album} width={96} height={96} class="h-full w-full object-cover" loading="lazy" decoding="async" fetchpriority="low" onerror={handleCoverError} />
    </div>
    <div class="min-w-0 flex-1 py-0.5">
      <p class="truncate text-[0.98rem] font-semibold leading-tight text-text-primary sm:text-[1.05rem]">{spotify.song}</p>
      <p class="mt-1 truncate text-[0.85rem] font-medium leading-snug text-text-secondary">{spotify.artist}</p>
      <div class="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 sm:mt-3.5">
        <span class="font-mono text-[0.72rem] font-semibold tabular-nums text-text-secondary">{currentTime}</span>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div class="h-full rounded-full bg-spotify transition-none" style="width: {progressPercent}%" role="progressbar" aria-valuenow={Math.round(progressPercent)} aria-valuemin={0} aria-valuemax={100} aria-label="Spotify playback progress"></div>
        </div>
        <span class="font-mono text-[0.72rem] font-semibold tabular-nums text-text-secondary">{endTime}</span>
      </div>
    </div>
  </div>
</div>
