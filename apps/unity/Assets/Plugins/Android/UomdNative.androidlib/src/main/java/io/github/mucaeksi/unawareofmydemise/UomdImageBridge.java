package io.github.mucaeksi.unawareofmydemise;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.nio.ByteBuffer;

/**
 * Image decoding for Unity, which cannot decode WebP. Android decodes WebP (lossy, lossless and alpha) natively, so patched
 * content keeps the WebP files the release pipeline publishes. Called from UomdTextureLoader through JNI.
 */
public final class UomdImageBridge {
    private UomdImageBridge() {}

    /**
     * Decodes WebP/PNG/JPEG bytes. Returns width and height as two big-endian int32 values followed by straight-alpha RGBA32
     * pixels in bottom-up row order (what Texture2D.LoadRawTextureData expects), or null when the bytes are not an image.
     */
    public static byte[] decodeRgbaBottomUp(byte[] data) {
        if (data == null || data.length == 0) return null;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inPremultiplied = false;
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap bitmap = BitmapFactory.decodeByteArray(data, 0, data.length, options);
        if (bitmap == null) return null;
        try {
            int width = bitmap.getWidth();
            int height = bitmap.getHeight();
            int stride = bitmap.getRowBytes();
            ByteBuffer pixels = ByteBuffer.allocate(stride * height);
            bitmap.copyPixelsToBuffer(pixels);
            byte[] top = pixels.array();
            int row = width * 4;
            byte[] out = new byte[8 + row * height];
            ByteBuffer.wrap(out, 0, 8).putInt(width).putInt(height);
            for (int y = 0; y < height; y++) {
                System.arraycopy(top, y * stride, out, 8 + (height - 1 - y) * row, row);
            }
            return out;
        } finally {
            bitmap.recycle();
        }
    }
}
