// Minimal stand-ins so engine-free Unity sources compile under plain .NET for headless tests.
// Keep this surface tiny: anything beyond attributes and test paths belongs in the real Unity compile
// (apps/unity/cloud/unity_ci.sh import), not here.
using System;
using System.IO;

namespace UnityEngine.Scripting
{
    /// <summary>IL2CPP stripping hint in Unity; inert here.</summary>
    [AttributeUsage(AttributeTargets.All, Inherited = false)]
    public sealed class PreserveAttribute : Attribute
    {
    }
}

namespace UnityEngine
{
    /// <summary>Resolves Unity's project paths from the repository layout (apps/unity/Assets).</summary>
    public static class Application
    {
        private static string _dataPath;

        public static string dataPath => _dataPath ??= FindAssetsDirectory();

        public static string streamingAssetsPath => Path.Combine(dataPath, "StreamingAssets");

        private static string FindAssetsDirectory()
        {
            string fromEnv = Environment.GetEnvironmentVariable("UOMD_UNITY_ASSETS");
            if (!string.IsNullOrEmpty(fromEnv))
            {
                return Path.GetFullPath(fromEnv);
            }

            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                string candidate = Path.Combine(dir.FullName, "apps", "unity", "Assets");
                if (Directory.Exists(candidate))
                {
                    return candidate;
                }
                dir = dir.Parent;
            }
            throw new DirectoryNotFoundException("apps/unity/Assets not found; set UOMD_UNITY_ASSETS.");
        }
    }
}
