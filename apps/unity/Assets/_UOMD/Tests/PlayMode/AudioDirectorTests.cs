using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using Uomd.Core;

namespace Uomd.Tests
{
    public sealed class AudioDirectorTests
    {
        private GameObject _root;
        private AudioDirector _audio;
        private AudioClip _clip;

        [SetUp]
        public void SetUp()
        {
            _root = new GameObject("AudioDirectorTest");
            _audio = _root.AddComponent<AudioDirector>();
            _clip = AudioClip.Create("SilentTestVoice", 48000 * 4, 1, 48000, false);
        }

        [TearDown]
        public void TearDown()
        {
            Object.Destroy(_root);
            Object.Destroy(_clip);
        }

        [UnityTest]
        public IEnumerator MutedNarrationStillLoadsAndAdvancesItsSubtitleClock()
        {
            _audio.Muted = true;
            _audio.PlayVoiceLine("test", _clip);
            yield return new WaitForSecondsRealtime(0.2f);
            Assert.IsTrue(_audio.VoiceReady);
            Assert.IsTrue(_audio.VoicePlaying);
            Assert.Greater(_audio.VoiceTime, 0.05f);
            foreach (var source in _root.GetComponents<AudioSource>())
                if (source.clip == _clip) Assert.IsTrue(source.mute);
        }

        [UnityTest]
        public IEnumerator VoiceThatBecomesReadyWhilePausedWaitsForResume()
        {
            _audio.SetPaused(true);
            _audio.PlayVoiceLine("test", _clip);
            float pausedAt = _audio.VoiceTime;
            yield return new WaitForSecondsRealtime(0.2f);
            Assert.IsTrue(_audio.VoiceReady);
            Assert.IsFalse(_audio.VoicePlaying);
            Assert.AreEqual(pausedAt, _audio.VoiceTime, 0.02f);
            _audio.SetPaused(false);
            yield return new WaitForSecondsRealtime(0.2f);
            Assert.IsTrue(_audio.VoicePlaying);
            Assert.Greater(_audio.VoiceTime, pausedAt + 0.05f);
        }

        [UnityTest]
        public IEnumerator PauseFreezesMusicAndVoiceAndStopClearsVoiceReadiness()
        {
            _audio.PlayBgmCue("test_music", _clip);
            _audio.PlayVoiceLine("test_voice", _clip);
            yield return new WaitForSecondsRealtime(0.2f);
            _audio.SetPaused(true);
            var sources = _root.GetComponents<AudioSource>();
            var positions = new float[sources.Length];
            for (int i = 0; i < sources.Length; i++) positions[i] = sources[i].time;
            yield return new WaitForSecondsRealtime(0.2f);
            for (int i = 0; i < sources.Length; i++) Assert.AreEqual(positions[i], sources[i].time, 0.02f);
            _audio.StopVoiceLine();
            Assert.IsFalse(_audio.VoiceReady);
            Assert.AreEqual(0, _audio.VoiceTime);
            _audio.SetPaused(false);
        }
    }
}
