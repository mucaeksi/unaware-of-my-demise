using System;
using UnityEngine;

namespace Uomd.Scenes
{
    [Serializable]
    public sealed class RebuildShotSettings
    {
        public string scenario = "title";
        public float framing = 1f;
        public float subtitleBottom = 128f;
        public float light = 1f;
        public bool particles = true;

        public void Validate()
        {
            if (string.IsNullOrWhiteSpace(scenario) || !float.IsFinite(framing) || framing < 0.8f || framing > 1.2f
                || !float.IsFinite(subtitleBottom) || subtitleBottom < 80 || subtitleBottom > 320
                || !float.IsFinite(light) || light < 0.2f || light > 2f)
                throw new ArgumentException("Presentation settings are outside the supported authoring range.");
        }
    }

    [Serializable]
    public sealed class RebuildPresentationConfig
    {
        public RebuildShotSettings[] shots = Array.Empty<RebuildShotSettings>();

        public static RebuildShotSettings For(string scenario)
        {
            var asset = Resources.Load<TextAsset>("Rebuild/Presentation");
            var config = asset == null ? new RebuildPresentationConfig() : JsonUtility.FromJson<RebuildPresentationConfig>(asset.text);
            foreach (var shot in config.shots)
                if (shot.scenario == scenario) { shot.Validate(); return shot; }
            return new RebuildShotSettings { scenario = scenario };
        }
    }
}
