using UnityEngine;
using UnityEngine.UIElements;

namespace Uomd.UI
{
    /// <summary>
    /// A linear gradient (horizontal or vertical) drawn with vertex colours — USS has no linear-gradient(). Used for the
    /// readability scrims of the TS kit (setArtBackdrop's 90° scrim, shades over art). Fills its parent by default.
    /// </summary>
    public sealed class UomdGradient : VisualElement
    {
        private readonly bool _horizontal;
        private readonly (float At, Color Color)[] _stops;

        public UomdGradient(bool horizontal, params (float At, Color Color)[] stops)
        {
            _horizontal = horizontal;
            _stops = stops;
            pickingMode = PickingMode.Ignore;
            style.position = Position.Absolute;
            style.left = style.top = style.right = style.bottom = 0;
            generateVisualContent += Draw;
        }

        private void Draw(MeshGenerationContext context)
        {
            float w = contentRect.width, h = contentRect.height;
            if (w <= 0f || h <= 0f || _stops.Length < 2) return;
            int bands = _stops.Length - 1;
            var mesh = context.Allocate(_stops.Length * 2, bands * 6);
            foreach (var (at, color) in _stops)
            {
                float t = Mathf.Clamp01(at);
                Vector3 a = _horizontal ? new Vector3(t * w, 0f, Vertex.nearZ) : new Vector3(0f, t * h, Vertex.nearZ);
                Vector3 b = _horizontal ? new Vector3(t * w, h, Vertex.nearZ) : new Vector3(w, t * h, Vertex.nearZ);
                mesh.SetNextVertex(new Vertex { position = a, tint = color });
                mesh.SetNextVertex(new Vertex { position = b, tint = color });
            }
            for (int i = 0; i < bands; i++)
            {
                ushort a0 = (ushort)(i * 2), b0 = (ushort)(i * 2 + 1), a1 = (ushort)(i * 2 + 2), b1 = (ushort)(i * 2 + 3);
                mesh.SetNextIndex(a0); mesh.SetNextIndex(a1); mesh.SetNextIndex(b1);
                mesh.SetNextIndex(a0); mesh.SetNextIndex(b1); mesh.SetNextIndex(b0);
            }
        }
    }
}
