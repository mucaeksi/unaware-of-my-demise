using System;
using UnityEngine;

namespace Uomd.Core
{
    /// <summary>
    /// Loads content art as Texture2D. Unity cannot decode WebP, so ".webp" paths resolve to the lossless ".png"
    /// sibling written by tools/export_unity_bundle.ts (writePngSiblings).
    /// </summary>
    public static class UomdTextureLoader
    {
        public static string ToDecodablePath(string relativePath)
        {
            if (relativePath != null && relativePath.EndsWith(".webp", StringComparison.OrdinalIgnoreCase))
            {
                return relativePath.Substring(0, relativePath.Length - 5) + ".png";
            }
            return relativePath;
        }

        public static async Awaitable<Texture2D> LoadAsync(PatchManager patch, string relativePath)
        {
            string path = ToDecodablePath(relativePath);
            byte[] bytes = await patch.ReadBytesAsync(path);
            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false)
            {
                name = path,
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            if (!texture.LoadImage(bytes, true))
            {
                UnityEngine.Object.Destroy(texture);
                throw new InvalidOperationException($"[UomdTextureLoader] Could not decode '{path}'.");
            }
            return texture;
        }
    }
}
