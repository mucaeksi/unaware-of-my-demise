import { Capacitor } from '@capacitor/core';

/** Reference resolution: all scene coordinates are authored for 1920x1080; the PIXI stage is fitted to the screen. */
export const REF_W = 1920;
export const REF_H = 1080;

export const CLIENT_VERSION: string = __CLIENT_VERSION__;
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';
export const CHANNEL = import.meta.env.VITE_CONTENT_CHANNEL ?? 'staging';
/** inside the Android/iOS shell the developer conveniences below are off whatever the build env said (fail closed) */
const NATIVE_SHELL = Capacitor.isNativePlatform();
export const PATCH_LAB_ENABLED: boolean = !NATIVE_SHELL && import.meta.env.VITE_PATCH_LAB !== 'false';
/** Browser/staging preview of the first-install flow may continue without a Google account; never in the native app. */
export const PREVIEW_FLOW_ENABLED: boolean = !NATIVE_SHELL && import.meta.env.VITE_PREVIEW_FLOW !== 'false';
/** Google OAuth Web client ID for genuine browser/staging sign-in via Google Identity Services (empty = disabled on web). */
export const GOOGLE_WEB_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? '';
/** Review/automation shortcut: `?fastintro` collapses the cosmetic splash and studio card timings (no effect on logic). */
export const INTRO_FAST: boolean = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fastintro');
export const SUPPORTED_CONTENT_SCHEMA = 1;
/** Extra bytes a content patch may add on a device (mobile storage budget). */
export const PATCH_STORAGE_BUDGET = 200 * 1024 * 1024;

export const BASE_CONTENT_URL = '/content/base';
