import type { ContentManifest } from '@uomd/content-schema';

/**
 * True when a self-contained snapshot was composed on an older embedded base: it omits paths the current base declares
 * (each base update so far added files — new backgrounds, presentation.json, recorded voices). A snapshot composed on the
 * current base declares every base path, so a different hash on one of them is an intentional override, not staleness.
 * Legacy dependent overlays inherit undeclared paths from the base already, so they are never stale.
 * shortcut: a base update that only rewrites existing paths is invisible here; record a base fingerprint in the manifest when one ships.
 */
export function builtOnOlderBase(manifest: Pick<ContentManifest, 'depends_on' | 'files'>, baseFiles: Record<string, string>): boolean {
  if (manifest.depends_on) return false;
  const declared = new Set(manifest.files.map((f) => f.path));
  return Object.keys(baseFiles).some((path) => !declared.has(path));
}
