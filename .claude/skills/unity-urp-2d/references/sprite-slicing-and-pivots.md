# Unity 6 Runtime Sprite Slicing & Pivot Reference

## Slicing a 16-Cell (`4x4`) Chibi Atlas Sheet at Runtime

Every `chibi_<unitId>_<state>.png/.webp` sheet in `StreamingAssets/uomd_base/art/chibi/` is a `4x4` grid (`16` frames) described by `UnitSliceSpecDto` in `unity_export_manifest.json`.

```csharp
using UnityEngine;
using Uomd.Contracts;

namespace Uomd.Battle
{
    public static class ChibiAtlasSlicer
    {
        public static Sprite[] SliceStateSheet(Texture2D sheetTexture, UnitSliceSpecDto spec, float pixelsPerUnit = 100f)
        {
            int cols = spec.cols > 0 ? spec.cols : 4;
            int rows = spec.rows > 0 ? spec.rows : 4;
            int totalFrames = cols * rows;
            int cellW = sheetTexture.width / cols;
            int cellH = sheetTexture.height / rows;

            // Precomputed in unity_export_manifest.json: (pivot_x, 1 - foot_y)
            Vector2 normalizedPivot = new Vector2(spec.unity_pivot.x, spec.unity_pivot.y);
            Sprite[] frames = new Sprite[totalFrames];

            for (int index = 0; index < totalFrames; index++)
            {
                int col = index % cols;
                int rowFromTop = index / cols;
                float x = col * cellW;
                // Convert top-left row index to Unity bottom-left Y coordinate
                float y = sheetTexture.height - ((rowFromTop + 1) * cellH);

                Rect cellRect = new Rect(x, y, cellW, cellH);
                Sprite frameSprite = Sprite.Create(
                    sheetTexture,
                    cellRect,
                    normalizedPivot,
                    pixelsPerUnit,
                    0,
                    SpriteMeshType.FullRect
                );
                frameSprite.name = $"{spec.unit_id}_{index:D2}";
                frames[index] = frameSprite;
            }

            return frames;
        }
    }
}
```
