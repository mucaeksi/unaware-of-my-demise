---
name: unity-6-core
description: Use this skill first for Unity 6 LTS (6000.0.x) C# architecture — Awaitable async/await patterns, MonoBehaviour and ScriptableObject lifecycle discipline, .asmdef modularization, zero-GC Update loops, ObjectPool/ArrayPool patterns, and IL2CPP AOT stripping safety.
license: MIT
---
# Unity 6 LTS (6000.0.x) Core Architecture & C# Standards

Use this skill whenever writing, refactoring, or reviewing C# scripts, `.asmdef` packages, async workflows, or scene lifecycles in `apps/unity/`.

## 1. Unity 6 `Awaitable` Async Discipline (Replaces Coroutines)
Unity 6 introduces `UnityEngine.Awaitable`, a pooled, zero-allocation async primitive integrated directly with the Unity PlayerLoop.
- **Frame & Time Waiting**:
  - `await Awaitable.NextFrameAsync(destroyCancellationToken);`
  - `await Awaitable.WaitForSecondsAsync(durationSeconds, destroyCancellationToken);`
  - `await Awaitable.EndOfFrameAsync(destroyCancellationToken);`
- **Thread Switching**:
  - Offload heavy JSON parsing, SHA-256 hashing (`ContentService`), or file I/O to a background thread with `await Awaitable.BackgroundThreadAsync();`, then return to the Unity main thread before touching any `UnityEngine.Object` with `await Awaitable.MainThreadAsync();`.
- **Mandatory Cancellation**:
  - Always pass `this.destroyCancellationToken` (built into `MonoBehaviour` in Unity 6) or a linked `CancellationToken` to every `Awaitable` call so scene teardown never continues executing on a destroyed `MonoBehaviour`.
  - Catch `OperationCanceledException` cleanly when a scene closes mid-transition; never log cancellation as an unhandled error.

## 2. Lifecycle & Component Discipline
- **`Awake()`**: Initialize internal state and cache local component references (`TryGetComponent(out _spriteRenderer)`). Do not call other objects' methods that depend on initialization order.
- **`OnEnable()` / `OnDisable()`**: Register and unregister event handlers, `UIDocument` element queries (`Q<T>`), and input callbacks in `OnEnable()`, and always symmetric-unsubscribe in `OnDisable()`.
- **`OnDestroy()`**: Dispose native buffers, release pooled `Texture2D`/`Sprite` instances owned by this component, and cancel any custom `CancellationTokenSource`.
- **Null Checks on `UnityEngine.Object`**: Remember that `UnityEngine.Object` overloads `==` and `!=` to check native C++ object lifetime. Avoid `?.` (`null`-conditional) or `??` (`null`-coalescing) on `MonoBehaviour`/`Component`/`GameObject` references when a destroyed native shell might still have a non-null managed wrapper; use explicit `if (target != null)` or `ReferenceEquals` only when testing managed assignment.

## 3. Zero-GC Frame Loop (`Update` / `LateUpdate`)
Mobile 60 FPS on Android ARM64 requires `< 16.6 ms` frame time and near-zero per-frame managed heap allocations to prevent Incremental GC spikes:
- **Forbidden in `Update` / `LateUpdate`**:
  - `GetComponent<T>()`, `FindObjectOfType<T>()`, `GameObject.Find()`, `Camera.main` (unless cached in Unity 6, still prefer explicit reference).
  - `System.Linq` (`Where`, `Select`, `ToList`, `OrderBy`), lambda closures capturing local variables, `foreach` over non-struct enumerators (`IList<T>` interface instead of concrete `List<T>`).
  - String concatenation (`$"{hp}/{maxHp}"`) on frames where the underlying integer value has not changed. Cache the last displayed integer and update text only on change.
  - Allocating new arrays (`new Collider2D[...]`); use `ArrayPool<T>.Shared` or pre-allocated fixed buffers.
- **Pooling**:
  - Use `UnityEngine.Pool.ObjectPool<T>` and `UnityEngine.Pool.ListPool<T>` for damage popups, hit sparks, status icons, and turn-order cards.

## 4. Assembly Definition (`.asmdef`) Modularity
- Every folder under `apps/unity/Assets/_UOMD/Scripts/<Module>/` has an explicit `.asmdef` with `"autoReferenced": false` and `"overrideReferences": true` where needed.
- Pure domain modules (`Uomd.Contracts`, `Uomd.Combat`) must remain testable in Unity EditMode (`-testPlatform EditMode`) in `< 2 seconds` without loading scenes.

## 5. IL2CPP & AOT Stripping Safety
Android release builds use **IL2CPP (ARM64)** with Managed Code Stripping:
- Reflection-deserialized DTOs in `Uomd.Contracts` must carry `[UnityEngine.Scripting.Preserve]` or be listed in `apps/unity/Assets/_UOMD/link.xml`.
- Avoid `System.Reflection.Emit` or dynamic code generation (unsupported under IL2CPP AOT).

## Reference Guides
- [Awaitable & Lifecycle Patterns](references/awaitable-lifecycle.md)
- [Assembly Definition & IL2CPP Architecture](references/asmdef-architecture.md)
