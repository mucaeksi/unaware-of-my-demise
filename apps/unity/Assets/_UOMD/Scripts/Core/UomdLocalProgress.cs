using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;

namespace Uomd.Core
{
    /// <summary>
    /// Device-side cleared nodes and stars (port of services.ts Progress): what the Chapters list shows for a signed-out
    /// player. A signed-in player's list comes from GET /api/v1/progress, which is authoritative.
    /// Stored as "node:stars,node:stars" in PlayerPrefs; node ids are content ids ([a-z0-9_]).
    /// </summary>
    public static class UomdLocalProgress
    {
        private const string Key = "uomd.progress.v1";

        public static Dictionary<string, int> Load()
        {
            var cleared = new Dictionary<string, int>(StringComparer.Ordinal);
            string raw = PlayerPrefs.GetString(Key, "");
            foreach (string pair in raw.Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                int colon = pair.IndexOf(':');
                if (colon <= 0) continue;
                if (int.TryParse(pair.Substring(colon + 1), NumberStyles.Integer, CultureInfo.InvariantCulture, out int stars))
                    cleared[pair.Substring(0, colon)] = Mathf.Clamp(stars, 0, 3);
            }
            return cleared;
        }

        public static bool IsCleared(string nodeId) => Load().ContainsKey(nodeId);

        /// <summary>Marks a node cleared, keeping the best star count.</summary>
        public static void Complete(string nodeId, int stars)
        {
            if (string.IsNullOrEmpty(nodeId) || nodeId.IndexOfAny(new[] { ',', ':' }) >= 0) return;
            var cleared = Load();
            cleared[nodeId] = Math.Max(cleared.TryGetValue(nodeId, out int best) ? best : 0, Mathf.Clamp(stars, 0, 3));
            var sb = new StringBuilder();
            foreach (var entry in cleared)
            {
                if (sb.Length > 0) sb.Append(',');
                sb.Append(entry.Key).Append(':').Append(entry.Value.ToString(CultureInfo.InvariantCulture));
            }
            PlayerPrefs.SetString(Key, sb.ToString());
            PlayerPrefs.Save();
        }
    }
}
