# Unity 6 Awaitable & Lifecycle Reference

## Safe Scene & Asset Loading with `Awaitable`

```csharp
using System;
using System.Threading;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Uomd.Core
{
    public sealed class SceneTransitionRunner : MonoBehaviour
    {
        public async Awaitable TransitionToSceneAsync(string sceneName, float fadeSeconds = 0.25f)
        {
            CancellationToken ct = destroyCancellationToken;
            try
            {
                await FadeVeilAsync(0f, 1f, fadeSeconds, ct);
                AsyncOperation op = SceneManager.LoadSceneAsync(sceneName, LoadSceneMode.Single);
                if (op != null)
                {
                    await op;
                }
                await Awaitable.NextFrameAsync(ct);
                await FadeVeilAsync(1f, 0f, fadeSeconds, ct);
            }
            catch (OperationCanceledException)
            {
                // Clean exit when object or application terminates during transition
            }
        }

        private async Awaitable FadeVeilAsync(float from, float to, float duration, CancellationToken ct)
        {
            if (duration <= 0f) return;
            float elapsed = 0f;
            while (elapsed < duration)
            {
                ct.ThrowIfCancellationRequested();
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                ApplyVeilAlpha(Mathf.Lerp(from, to, t));
                await Awaitable.NextFrameAsync(ct);
            }
            ApplyVeilAlpha(to);
        }

        private void ApplyVeilAlpha(float alpha) { /* Updates UI Toolkit or URP ScreenVeil */ }
    }
}
```

## Offloading SHA-256 & JSON Verification to Background Thread

```csharp
public async Awaitable<bool> VerifyManifestFileAsync(string absolutePath, string expectedSha256, CancellationToken ct)
{
    await Awaitable.BackgroundThreadAsync();
    try
    {
        ct.ThrowIfCancellationRequested();
        string actual = Sha256Hash.ComputeFileHex(absolutePath);
        bool matches = string.Equals(actual, expectedSha256, StringComparison.OrdinalIgnoreCase);
        await Awaitable.MainThreadAsync();
        return matches;
    }
    finally
    {
        await Awaitable.MainThreadAsync();
    }
}
```
