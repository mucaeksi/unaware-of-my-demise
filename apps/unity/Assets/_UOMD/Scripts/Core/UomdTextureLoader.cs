using System;
using UnityEngine;

namespace Uomd.Core
{
    /// <summary>
    /// Loads content art as Texture2D. Unity cannot decode WebP: base content ships JPG/PNG siblings (decodable.json,
    /// tools/export_unity_bundle.ts) and patched WebP files are decoded by Android (UomdImageBridge) on device.
    /// </summary>
    public static class UomdTextureLoader
    {
        public static async Awaitable<Texture2D> LoadAsync(PatchManager patch, string relativePath)
        {
            byte[] bytes = await patch.ReadBytesAsync(relativePath);
            return Decode(bytes, relativePath);
        }

        /// <summary>RIFF....WEBP: the container Unity's ImageConversion cannot read.</summary>
        public static bool IsWebp(byte[] bytes) =>
            bytes != null && bytes.Length >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
            && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';

        /// <summary>PNG/JPEG through ImageConversion; WebP (patched content) through Android's decoder on device.</summary>
        public static Texture2D Decode(byte[] bytes, string name)
        {
            if (IsWebp(bytes)) return DecodeWebp(bytes, name);
            var texture = NewTexture(2, 2, name);
            if (!texture.LoadImage(bytes, true))
            {
                UnityEngine.Object.Destroy(texture);
                throw new InvalidOperationException($"[UomdTextureLoader] Could not decode '{name}'.");
            }
            return texture;
        }

        private static Texture2D NewTexture(int width, int height, string name) => new Texture2D(width, height, TextureFormat.RGBA32, false)
        {
            name = name,
            filterMode = FilterMode.Bilinear,
            wrapMode = TextureWrapMode.Clamp
        };

        private static Texture2D DecodeWebp(byte[] bytes, string name)
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            var input = new sbyte[bytes.Length];
            Buffer.BlockCopy(bytes, 0, input, 0, bytes.Length);
            sbyte[] raw;
            using (var bridge = new AndroidJavaClass("io.github.mucaeksi.unawareofmydemise.UomdImageBridge"))
            {
                raw = bridge.CallStatic<sbyte[]>("decodeRgbaBottomUp", input);
            }
            if (raw == null || raw.Length < 8) throw new InvalidOperationException($"[UomdTextureLoader] Android could not decode '{name}'.");
            int width = (byte)raw[0] << 24 | (byte)raw[1] << 16 | (byte)raw[2] << 8 | (byte)raw[3];
            int height = (byte)raw[4] << 24 | (byte)raw[5] << 16 | (byte)raw[6] << 8 | (byte)raw[7];
            if (width <= 0 || height <= 0 || raw.Length != 8 + width * height * 4) throw new InvalidOperationException($"[UomdTextureLoader] '{name}' decoded to an invalid size.");
            var pixels = new byte[width * height * 4];
            Buffer.BlockCopy(raw, 8, pixels, 0, pixels.Length);
            var texture = NewTexture(width, height, name);
            texture.LoadRawTextureData(pixels);
            texture.Apply(false, true);
            return texture;
#else
            throw new NotSupportedException($"[UomdTextureLoader] '{name}' is WebP; only the Android player decodes WebP (base content ships JPG/PNG siblings).");
#endif
        }
    }
}
