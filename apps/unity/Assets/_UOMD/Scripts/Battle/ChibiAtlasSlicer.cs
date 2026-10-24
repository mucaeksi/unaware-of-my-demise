#nullable enable
using System.Collections.Generic;
using UnityEngine;
using Uomd.Contracts;

namespace Uomd.Battle
{
    /// <summary>
    /// Runtime Unity 6 Sprite slicer for UOMD atlases and 16-cell (4x4) SD Chibi sheets.
    /// Consumes the precomputed bottom-left rects and normalized foot pivots `(pivot_x, 1 - foot_y)`
    /// exported by `npm run export:unity` (`unity_base_art_slices.json` / `unity_campaign_art_slices.json`).
    /// </summary>
    public static class ChibiAtlasSlicer
    {
        public const float DefaultPixelsPerUnit = 100.0f;

        /// <summary>
        /// Slices a full Texture2D using precomputed UnityAtlasDescriptorDto metadata.
        /// </summary>
        public static Dictionary<string, Sprite> SliceAtlas(
            Texture2D atlasTexture,
            UnityAtlasDescriptorDto descriptor,
            float pixelsPerUnit = DefaultPixelsPerUnit)
        {
            var result = new Dictionary<string, Sprite>(descriptor.slices.Length);
            for (int i = 0; i < descriptor.slices.Length; i++)
            {
                UnitySpriteSliceDto s = descriptor.slices[i];
                var rect = new Rect(s.rect.x, s.rect.y, s.rect.width, s.rect.height);
                var pivot = new Vector2(s.pivot.x, s.pivot.y);
                Sprite sprite = Sprite.Create(
                    atlasTexture,
                    rect,
                    pivot,
                    pixelsPerUnit,
                    0,
                    SpriteMeshType.FullRect
                );
                sprite.name = s.name;
                result[s.name] = sprite;
            }
            return result;
        }

        /// <summary>
        /// Converts a top-left UOMD frame `[x, y, w, h]` and top-down `footY` into a Unity bottom-left Sprite.
        /// </summary>
        public static Sprite CreateFromTopLeftRect(
            Texture2D texture,
            string spriteName,
            float topLeftX,
            float topLeftY,
            float width,
            float height,
            float pivotX = 0.5f,
            float footY = 0.92f,
            float pixelsPerUnit = DefaultPixelsPerUnit)
        {
            float unityY = texture.height - (topLeftY + height);
            var rect = new Rect(topLeftX, unityY, width, height);
            var unityPivot = new Vector2(pivotX, 1.0f - footY);
            Sprite sprite = Sprite.Create(
                texture,
                rect,
                unityPivot,
                pixelsPerUnit,
                0,
                SpriteMeshType.FullRect
            );
            sprite.name = spriteName;
            return sprite;
        }

        /// <summary>
        /// Slices a uniform 16-cell (4x4) SD Chibi state sheet (`chibi_<unitId>_<state>.png`) in row-major order.
        /// </summary>
        public static Sprite[] SliceUniformGridSheet(
            Texture2D sheetTexture,
            string unitId,
            int cols = 4,
            int rows = 4,
            float pivotX = 0.5f,
            float footY = 0.92f,
            float pixelsPerUnit = DefaultPixelsPerUnit)
        {
            int total = cols * rows;
            int cellW = sheetTexture.width / cols;
            int cellH = sheetTexture.height / rows;
            var normalizedPivot = new Vector2(pivotX, 1.0f - footY);
            var frames = new Sprite[total];

            for (int index = 0; index < total; index++)
            {
                int col = index % cols;
                int rowFromTop = index / cols;
                float x = col * cellW;
                float y = sheetTexture.height - ((rowFromTop + 1) * cellH);
                var rect = new Rect(x, y, cellW, cellH);

                Sprite sp = Sprite.Create(
                    sheetTexture,
                    rect,
                    normalizedPivot,
                    pixelsPerUnit,
                    0,
                    SpriteMeshType.FullRect
                );
                sp.name = $"{unitId}_{index:D2}";
                frames[index] = sp;
            }
            return frames;
        }
    }
}
