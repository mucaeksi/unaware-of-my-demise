/** Reference resolution: all scene coordinates are authored for 1920x1080 and scaled by Phaser.Scale.FIT. */
export const REF_W = 1920;
export const REF_H = 1080;

export const CLIENT_VERSION: string = __CLIENT_VERSION__;
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';
export const CHANNEL = import.meta.env.VITE_CONTENT_CHANNEL ?? 'staging';
export const PATCH_LAB_ENABLED: boolean = import.meta.env.VITE_PATCH_LAB !== 'false';
export const SUPPORTED_CONTENT_SCHEMA = 1;
/** Extra bytes a content patch may add on a device (mobile storage budget). */
export const PATCH_STORAGE_BUDGET = 200 * 1024 * 1024;

export const BASE_CONTENT_URL = '/content/base';
