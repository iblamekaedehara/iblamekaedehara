/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly STEAM_WEB_API?: string;
  readonly STEAM_USER_ID?: string;
  readonly STEAM_GRID_API_KEY?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
