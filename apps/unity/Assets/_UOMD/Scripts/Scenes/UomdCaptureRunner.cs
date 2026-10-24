using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Scenes
{
    /// <summary>
    /// QA capture mode for the cloud pipeline: started with `-uomdCapture &lt;dir&gt;` on the player command line, it visits every
    /// screen, writes `NN-screen.png` per screen into the directory and quits. `unity_ci.sh capture` runs it; tools/publish_unity_screens.mjs converts the
    /// files and publishes them to docs/evidence/ so the Control Center Development page shows the current Unity build.
    /// Inactive unless the argument is present.
    /// </summary>
    public sealed class UomdCaptureRunner : MonoBehaviour
    {
        public const string Argument = "-uomdCapture";
        private const float SettleSeconds = 1.5f;

        private static readonly UomdScreenId[] Order =
        {
            UomdScreenId.Studio, UomdScreenId.Title, UomdScreenId.Prologue, UomdScreenId.Story, UomdScreenId.Battle, UomdScreenId.Finish,
            UomdScreenId.Home, UomdScreenId.Chapters, UomdScreenId.Roster, UomdScreenId.Character, UomdScreenId.Gear, UomdScreenId.Team,
            UomdScreenId.Summon, UomdScreenId.Recruit, UomdScreenId.Shop, UomdScreenId.Trials, UomdScreenId.Tasks, UomdScreenId.Deeds,
            UomdScreenId.Profile, UomdScreenId.Mail, UomdScreenId.Library, UomdScreenId.Account, UomdScreenId.Purchases, UomdScreenId.Operations
        };

        public static bool Requested(out string directory)
        {
            directory = "";
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == Argument)
                {
                    directory = args[i + 1];
                    return true;
                }
            }
            return false;
        }

        public async void Run(UomdSceneRouter router, string directory)
        {
            Directory.CreateDirectory(directory);
            var written = new List<string>();
            int index = 1;
            foreach (var screen in Order)
            {
                try
                {
                    await router.NavigateToAsync(screen);
                    await Awaitable.WaitForSecondsAsync(SettleSeconds);
                    await Awaitable.EndOfFrameAsync();
                    string file = Path.Combine(directory, $"{index:00}-{screen.ToString().ToLowerInvariant()}.png");
                    var texture = ScreenCapture.CaptureScreenshotAsTexture();
                    File.WriteAllBytes(file, texture.EncodeToPNG());
                    Destroy(texture);
                    written.Add(Path.GetFileName(file));
                }
                catch (Exception e)
                {
                    Debug.LogError($"[UomdCapture] {screen} failed: {e}");
                }
                index++;
            }
            File.WriteAllText(Path.Combine(directory, "capture.txt"), string.Join("\n", written) + "\n");
            Debug.Log($"[UomdCapture] wrote {written.Count} screens to {directory}");
            Application.Quit(0);
        }
    }
}
