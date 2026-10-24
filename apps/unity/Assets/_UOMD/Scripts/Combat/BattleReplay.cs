#nullable enable
// C# port of packages/combat/src/replay.ts: the client computes the same logHash the server checks.
using System.Collections.Generic;
using Uomd.Core;

namespace Uomd.Combat
{
    public sealed class ReplayOutput
    {
        public bool Valid;
        /// <summary>false when the action list ended while a player decision was still pending</summary>
        public bool Complete;
        public string? Error;
        public BattleResult? Result;
        /// <summary>SHA-256 over the canonical event log; client and server must agree on it.</summary>
        public string LogHash = "";
        public int EventCount;
    }

    public static class BattleReplay
    {
        public static string LogHash(Battle battle) => Sha256Hash.ComputeHex(CanonicalJson.Serialize(battle.Log));

        /// <summary>Re-simulates a battle from the encounter seed and the ordered actions (server acceptance rules).</summary>
        public static ReplayOutput Replay(UnitPackDef pack, EncounterDef encounter, IReadOnlyList<PlayerAction> actions, IReadOnlyList<PartyMemberDef>? party = null)
        {
            var battle = Battle.Create(pack, encounter, party);
            var step = battle.Advance();
            int i = 0;
            try
            {
                while (step.Result == null)
                {
                    if (step.Prompt == null) throw new IllegalActionException("battle stalled without a prompt");
                    if (i >= actions.Count) break;
                    step = battle.Act(actions[i]);
                    i++;
                }
                if (step.Result != null && i < actions.Count) throw new IllegalActionException($"{actions.Count - i} extra action(s) after the battle ended");
            }
            catch (IllegalActionException e)
            {
                return new ReplayOutput { Valid = false, Complete = false, Error = e.Message, Result = battle.Result, LogHash = LogHash(battle), EventCount = battle.Log.Count };
            }
            return new ReplayOutput { Valid = true, Complete = step.Result != null, Result = battle.Result, LogHash = LogHash(battle), EventCount = battle.Log.Count };
        }

        /// <summary>Plays a whole battle with the Auto Battle policy; returns the recorded (replayable) actions.</summary>
        public static (Battle Battle, List<PlayerAction> Actions) PlayAuto(UnitPackDef pack, EncounterDef encounter, IReadOnlyList<PartyMemberDef>? party = null)
        {
            var battle = Battle.Create(pack, encounter, party);
            var actions = new List<PlayerAction>();
            var step = battle.Advance();
            while (step.Result == null)
            {
                var a = battle.AutoAction();
                actions.Add(a);
                step = battle.Act(a);
            }
            return (battle, actions);
        }
    }
}
