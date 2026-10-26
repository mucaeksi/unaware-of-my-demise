using System;
using UnityEngine;

namespace Uomd.Core
{
    /// <summary>
    /// Device preferences (port of the TS platform/prefs.ts subset the Unity client supports): audio volumes, reduced
    /// motion, reduced flash and the battle layout. Stored in PlayerPrefs; applied to the session and the audio director.
    /// </summary>
    public static class UomdPrefs
    {
        private const string Prefix = "uomd.prefs.";
        public static readonly string[] BattleLayouts = { "afk_faithful", "current", "arena_lite" };

        public static void Apply(GameSessionState session, AudioDirector audio)
        {
            session.ReducedMotion = PlayerPrefs.GetInt(Prefix + "reducedMotion", 0) == 1;
            session.ReduceFlash = PlayerPrefs.GetInt(Prefix + "reduceFlash", 0) == 1;
            string layout = PlayerPrefs.GetString(Prefix + "battleLayout", "afk_faithful");
            session.BattleHudLayout = Array.IndexOf(BattleLayouts, layout) >= 0 ? layout : "afk_faithful";
            if (audio == null) return;
            audio.Muted = PlayerPrefs.GetInt(Prefix + "muted", audio.Muted ? 1 : 0) == 1;
            audio.BgmVolume = PlayerPrefs.GetFloat(Prefix + "musicVolume", audio.BgmVolume);
            audio.SfxVolume = PlayerPrefs.GetFloat(Prefix + "sfxVolume", audio.SfxVolume);
            audio.VoiceVolume = PlayerPrefs.GetFloat(Prefix + "voiceVolume", audio.VoiceVolume);
        }

        public static void Save(GameSessionState session, AudioDirector audio)
        {
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active) return;
#endif
            PlayerPrefs.SetInt(Prefix + "reducedMotion", session.ReducedMotion ? 1 : 0);
            PlayerPrefs.SetInt(Prefix + "reduceFlash", session.ReduceFlash ? 1 : 0);
            PlayerPrefs.SetString(Prefix + "battleLayout", session.BattleHudLayout);
            if (audio != null)
            {
                PlayerPrefs.SetInt(Prefix + "muted", audio.Muted ? 1 : 0);
                PlayerPrefs.SetFloat(Prefix + "musicVolume", audio.BgmVolume);
                PlayerPrefs.SetFloat(Prefix + "sfxVolume", audio.SfxVolume);
                PlayerPrefs.SetFloat(Prefix + "voiceVolume", audio.VoiceVolume);
            }
            PlayerPrefs.Save();
        }
    }
}
