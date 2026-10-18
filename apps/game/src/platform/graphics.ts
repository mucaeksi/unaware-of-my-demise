import type Phaser from '../engine';
import { Music } from '../audio/Music';
import { prefs, type QualityTierPref } from './prefs';

export type ResolvedQualityTier = 'low' | 'medium' | 'high';

export interface QualityProfile {
  tier: ResolvedQualityTier;
  textResolution: number;
  particles: boolean;
  particleDensity: number;
  vignette: boolean;
  targetFps: number;
}

const PROFILES: Record<ResolvedQualityTier, QualityProfile> = {
  low: {
    tier: 'low',
    textResolution: 1,
    particles: false,
    particleDensity: 0,
    vignette: false,
    targetFps: 30
  },
  medium: {
    tier: 'medium',
    textResolution: 1.5,
    particles: true,
    particleDensity: 0.5,
    vignette: false,
    targetFps: 60
  },
  high: {
    tier: 'high',
    textResolution: 2,
    particles: true,
    particleDensity: 1,
    vignette: true,
    targetFps: 60
  }
};

export function resolveQualityTier(pref: QualityTierPref = prefs().qualityTier): ResolvedQualityTier {
  if (pref === 'low' || pref === 'medium' || pref === 'high') return pref;
  if (prefs().reducedMotion) return 'medium';
  if (typeof navigator !== 'undefined') {
    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    if (cores <= 2 || mem <= 2) return 'low';
    if (cores <= 4 || mem <= 4) return 'medium';
  }
  return 'high';
}

export function qualityProfile(pref: QualityTierPref = prefs().qualityTier): QualityProfile {
  return PROFILES[resolveQualityTier(pref)];
}

export interface ContextRecoveryHandle {
  isLost: () => boolean;
  lastInterruptedScene: () => string | null;
  simulateLoss: () => void;
  simulateRestore: () => Promise<void>;
}

/**
 * Installs checkpoint-safe WebGL context loss and restoration handlers on the Phaser canvas.
 * Instead of trapping the player on a dead fatal screen, active scenes flush their durable checkpoints
 * and resume cleanly when the context restores (or via the recovery action button).
 */
export function installContextRecovery(
  game: Phaser.Game,
  refreshArt: () => Promise<void>
): ContextRecoveryHandle {
  let lost = false;
  let interruptedScene: string | null = null;
  let interruptedData: Record<string, unknown> | undefined;

  const findPrimaryScene = (): Phaser.Scene | null => {
    const active = game.scene.getScenes(true);
    return active.find((s) => s.scene.key !== 'PatchBar' && s.scene.key !== 'Boot') ?? active[0] ?? null;
  };

  const renderBanner = (message: string, showReloadButton: boolean): void => {
    const el = document.getElementById('fatal');
    if (!el) return;
    el.style.display = 'grid';
    el.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.id = 'context-recovery';
    wrap.style.cssText = 'display:grid;gap:16px;justify-items:center;max-width:640px;';
    const msg = document.createElement('div');
    msg.textContent = message;
    wrap.appendChild(msg);
    if (showReloadButton) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'RECOVER FROM CHECKPOINT';
      btn.style.cssText =
        'padding:12px 24px;font:600 16px/1.2 "Cinzel",Georgia,serif;color:#efe8f5;background:#3a1c46;border:2px solid #e3c37d;border-radius:8px;cursor:pointer;';
      btn.onclick = () => {
        void onRestored();
      };
      wrap.appendChild(btn);
    }
    el.appendChild(wrap);
  };

  const hideBanner = (): void => {
    const el = document.getElementById('fatal');
    if (!el) return;
    el.style.display = 'none';
    el.textContent = '';
  };

  const onLost = (e?: Event): void => {
    e?.preventDefault();
    lost = true;
    const primary = findPrimaryScene();
    interruptedScene = primary?.scene.key ?? null;
    interruptedData = (primary as unknown as { cfg?: Record<string, unknown> })?.cfg;
    try {
      game.events.emit('webgl:contextlost', { sceneKey: interruptedScene });
    } catch {
      /* best-effort checkpoint flush */
    }
    try {
      Music.setVolume(0);
    } catch {
      /* optional */
    }
    renderBanner('Graphics context interrupted — checkpoint saved. Restoring display…', true);
  };

  const onRestored = async (): Promise<void> => {
    if (!lost) return;
    lost = false;
    try {
      await refreshArt();
    } catch {
      /* art will reload on scene create */
    }
    hideBanner();
    try {
      Music.setVolume(prefs().musicVolume);
    } catch {
      /* optional */
    }
    const targetKey = interruptedScene;
    const targetData = interruptedData;
    interruptedScene = null;
    interruptedData = undefined;
    if (targetKey) {
      const sc = game.scene.getScene(targetKey);
      if (sc) {
        sc.scene.restart(targetData);
      }
    }
    game.events.emit('webgl:contextrestored', { sceneKey: targetKey });
  };

  game.canvas?.addEventListener('webglcontextlost', onLost);
  game.canvas?.addEventListener('webglcontextrestored', () => {
    void onRestored();
  });

  return {
    isLost: () => lost,
    lastInterruptedScene: () => interruptedScene,
    simulateLoss: () => onLost(),
    simulateRestore: () => onRestored()
  };
}
