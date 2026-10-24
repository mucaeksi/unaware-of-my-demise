#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using NUnit.Framework;
using UnityEngine;
using Uomd.Combat;
using Uomd.Core;

namespace Uomd.Tests
{
    /// <summary>
    /// Bit-exact replay parity of Uomd.Combat with @uomd/combat. combat_vectors.json is produced by
    /// tools/export_unity_combat_vectors.ts from real content battles; every case must reproduce the TypeScript
    /// logHash, event count, result and validity, which is what POST /api/v1/battles/verify checks.
    /// </summary>
    public sealed class CombatParityTests
    {
        private static string RepoRoot => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", ".."));

        private static List<object?> Cases()
        {
            string path = Path.Combine(Application.dataPath, "_UOMD/Tests/EditMode/combat_vectors.json");
            return (List<object?>)UomdJson.ParseObject(File.ReadAllText(path))["cases"]!;
        }

        private static readonly Dictionary<string, UnitPackDef> Packs = new Dictionary<string, UnitPackDef>();

        private static UnitPackDef Pack(string rel)
        {
            if (!Packs.TryGetValue(rel, out var p)) Packs[rel] = p = UnitPackDef.FromJson(File.ReadAllText(Path.Combine(RepoRoot, rel)));
            return p;
        }

        private static ReplayOutput Run(Dictionary<string, object?> c)
        {
            var encounterJson = UomdJson.ParseObject(File.ReadAllText(Path.Combine(RepoRoot, (string)c["encounter"]!)));
            if (c.TryGetValue("override", out var ov) && ov is Dictionary<string, object?> o)
            {
                foreach (var kv in o) encounterJson[kv.Key] = kv.Value;
            }
            var encounter = CombatJson.Encounter(encounterJson);
            List<PartyMemberDef>? party = null;
            if (c.TryGetValue("party", out var pv) && pv is List<object?> members)
            {
                party = new List<PartyMemberDef>();
                foreach (object? m in members) party.Add(CombatJson.Member((Dictionary<string, object?>)m!));
            }
            var actions = new List<PlayerAction>();
            foreach (object? a in (List<object?>)c["actions"]!)
            {
                var d = (Dictionary<string, object?>)a!;
                actions.Add(new PlayerAction((string)d["skillId"]!, d.TryGetValue("targetId", out var t) ? (string?)t : null));
            }
            return BattleReplay.Replay(Pack((string)c["pack"]!), encounter, actions, party);
        }

        [Test]
        public void EveryGoldenReplayMatchesTypeScript()
        {
            var failures = new StringBuilder();
            int checkedCases = 0;
            foreach (object? item in Cases())
            {
                var c = (Dictionary<string, object?>)item!;
                string name = (string)c["name"]!;
                checkedCases++;
                ReplayOutput r;
                try
                {
                    r = Run(c);
                }
                catch (Exception e)
                {
                    failures.AppendLine($"{name}: threw {e.GetType().Name}: {e.Message}");
                    continue;
                }
                var expected = c["result"] as Dictionary<string, object?>;
                string want = $"valid={c["valid"]} complete={c["complete"]} events={Convert.ToInt32(c["eventCount"], CultureInfo.InvariantCulture)} hash={c["logHash"]}"
                    + (expected == null ? " result=null" : $" result={expected["winner"]}/{expected["stars"]}/{expected["turns"]}")
                    + (c.TryGetValue("error", out var err) ? $" error={err}" : "");
                string got = $"valid={r.Valid} complete={r.Complete} events={r.EventCount} hash={r.LogHash}"
                    + (r.Result == null ? " result=null" : $" result={r.Result.Winner}/{r.Result.Stars}/{CanonicalJson.FormatJsNumber(r.Result.Turns)}")
                    + (r.Error != null ? $" error={r.Error}" : "");
                if (!string.Equals(want, got, StringComparison.OrdinalIgnoreCase)) failures.AppendLine($"{name}:\n  want {want}\n  got  {got}");
            }
            Assert.Greater(checkedCases, 100, "combat_vectors.json looks truncated");
            Assert.IsEmpty(failures.ToString(), failures.ToString());
        }

        [Test]
        public void AutoBattleRecordsReplayableActions()
        {
            var pack = Pack("content/base/units/unit_pack.json");
            var encounter = EncounterDef.FromJson(File.ReadAllText(Path.Combine(RepoRoot, "content/base/encounters/tutorial_t1.json")));
            var (battle, actions) = BattleReplay.PlayAuto(pack, encounter);
            var replay = BattleReplay.Replay(pack, encounter, actions);
            Assert.IsTrue(replay.Valid);
            Assert.IsTrue(replay.Complete);
            Assert.AreEqual(BattleReplay.LogHash(battle), replay.LogHash);
            Assert.AreEqual(battle.Log.Count, replay.EventCount);
        }
    }
}
