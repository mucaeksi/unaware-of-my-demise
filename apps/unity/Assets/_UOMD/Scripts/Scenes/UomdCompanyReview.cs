#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Uomd.Core;
using Uomd.Core.Growth;

namespace Uomd.Scenes
{
    // Explicit synthetic account fixtures over the actual controllers. Never contacts HTTP or writes the device journal.
    public sealed partial class UomdHubReview
    {
        private readonly Dictionary<string, string> _savedTeams = new Dictionary<string, string>();
        private readonly Dictionary<string, int> _levels = new Dictionary<string, int>(), _spentRation = new Dictionary<string, int>(), _sweepUsed = new Dictionary<string, int>();
        private readonly Dictionary<string, int> _walletDelta = new Dictionary<string, int>();
        private readonly Dictionary<string, string> _characterChanges = new Dictionary<string, string>();
        private readonly Dictionary<string, string> _equipped = new Dictionary<string, string>(), _receipts = new Dictionary<string, string>(), _inputs = new Dictionary<string, string>(), _paths = new Dictionary<string, string>();
        public bool LoseNextResponse, StatusOffline, RejectNext;
        public int Writes, Applied;
        public string LastInput = "", LastPath = "";
        public AwaitableCompletionSource<bool> WriteGate;
        private static Dictionary<string, object> Graph(object value) => UomdJson.ParseObject(CanonicalJson.Serialize(FixtureGraph(value)));
        private static object FixtureGraph(object value)
        {
            if (value == null || value is string || value is bool || value is int || value is long || value is float || value is double) return value;
            if (value is IDictionary<string, object> dictionary) return dictionary.ToDictionary(p => p.Key, p => FixtureGraph(p.Value));
            if (value is System.Collections.IEnumerable list) return list.Cast<object>().Select(FixtureGraph).ToArray();
            return value.GetType().GetProperties().ToDictionary(p => p.Name, p => FixtureGraph(p.GetValue(value)));
        }
        private Dictionary<string, object> SweepUsage(string player) => _sweepUsed.Where(p => p.Key.StartsWith(player + ":", StringComparison.Ordinal)).ToDictionary(p => p.Key.Substring(player.Length + 1), p => (object)p.Value);
        private void EnrichCharacter(Dictionary<string, object> member, string player, string mode)
        {
            string id = JsonRead.Str(member, "id");
            member["level"] = _levels.TryGetValue(player + ":" + id, out int level) ? level : mode == "ascend" ? 20 : member["level"];
            member["xp"] = 0; member["xpToNext"] = 1200; member["cap"] = 20; member["ascension"] = 1;
            member["shards"] = mode == "excess" ? 150 : 40;
            member["resonance"] = new Dictionary<string, object> { ["tier"] = mode == "excess" ? 6 : 1, ["maxTier"] = 6, ["nextShardCost"] = mode == "excess" ? null : (object)10, ["bonusPct"] = 1, ["excessShards"] = mode == "excess" ? 20 : 0, ["excessItemId"] = "torn_chronicle_page" };
            member["nextAscension"] = new Dictionary<string, object> { ["cap"] = 30, ["accountLevel"] = 15, ["fee"] = 55, ["requiresNode"] = "t1", ["items"] = new object[] { new Dictionary<string, object> { ["itemId"] = "fixture_ascension", ["quantity"] = 2 } } };
            member["skills"] = new object[] { new Dictionary<string, object> { ["skillId"] = "fixture_strike", ["name"] = "Fixture skill", ["type"] = "active", ["rank"] = 1, ["maxRank"] = 5, ["next"] = new Dictionary<string, object> { ["rank"] = 2, ["unlockLevel"] = 10, ["itemId"] = "fixture_manual", ["quantity"] = 1, ["fee"] = 10 } } };
            if (_characterChanges.TryGetValue(player + ":" + id, out string saved)) foreach (var pair in UomdJson.ParseObject(saved)) member[pair.Key] = pair.Value;
        }
        private Dictionary<string, object> SystemRead(string path, string player, string mode)
        {
            if (path == "/api/v1/stacks") return Graph(new { stacks = new[] { new { item_id = "fixture_xp", qty = 20 }, new { item_id = "fixture_ascension", qty = 10 }, new { item_id = "fixture_manual", qty = 10 } } });
            if (path.StartsWith("/api/v1/catalog?", StringComparison.Ordinal)) return Graph(new Dictionary<string, object> {
                ["items"] = new object[] { new {item_id="fixture_xp",name_en="XP material fixture",kind="character_xp",xp_value=2000}, new {item_id="fixture_ascension",name_en="Ascension fixture",kind="material",xp_value=0}, new {item_id="fixture_manual",name_en="Skill manual fixture",kind="material",xp_value=0} },
                ["gear"] = new object[0], ["config"] = new { progression = new { character = new {levelCap=30,xp=new{a=60,b=35,c=5},fee=new { @base=1,increment=1},ascension=new object[]{new{cap=20,accountLevel=1,fee=0,items=new object[0]}}}}} });
            if (path.Contains("/stats?"))
            {
                if (mode == "stats_error") throw new UomdApiException(503, "fixture_stats", "Isolated stats error.");
                return Graph(new { power="str", attributes=new{str=15, @int=12,vit=20,agi=10},stats=new{hp=1100,atk=145,def=80,spd=95,crit_rate=0.1} });
            }
            int count = mode == "empty" ? 0 : mode == "long" ? 40 : 4;
            var gear = new List<object>();
            for (int i=1;i<=count;i++)
            {
                string equipped = _equipped.TryGetValue(player + ":" + i, out string chosen) ? chosen : i==1 ? "mahmut" : i==3 ? "fadyme" : "";
                gear.Add(new Dictionary<string, object> { ["id"] = i, ["name"] = "Equipment fixture " + i, ["slot"] = i == 1 ? "weapon" : i==2 ? "armor" : "ring", ["rarity"] = 3, ["level"] = 1, ["levelCap"] = 10, ["equippedBy"] = equipped,
                    ["unavailableReason"] = i==3 ? "Unavailable in this content version" : "", ["passive"] = i==2 ? new {name="Undefined passive fixture",supported=false} : null,
                    ["stats"] = new {main=new{stat="vit_flat",value=2},subs=new[]{new{stat="heal_bonus_pct",value=0.05}}} });
            }
            return Graph(new { gear });
        }
        private async Awaitable<Dictionary<string, object>> Status(string path)
        {
            await Awaitable.NextFrameAsync(); if (StatusOffline) throw new UomdApiException(0, "fixture_offline", "Isolated status loss.");
            string player = _router.Api.GetCurrentSessionSnapshot()?.playerId ?? "hub_review";
            string request = path.Substring("/api/v1/operations/".Length).Split('?')[0], endpoint = Uri.UnescapeDataString(path.Substring(path.IndexOf("?path=", StringComparison.Ordinal) + 6));
            string key = player + ":" + request;
            if (!_receipts.TryGetValue(key, out string receipt)) return Graph(new { requestId=request,path=endpoint,state="unknown",binding=(string)null,inputHash=(string)null,result=(object)null });
            if (_paths[key] != endpoint) throw new UomdApiException(409, "request_id_reused", "Isolated path mismatch.");
            var input = UomdJson.ParseObject(_inputs[key]); if (endpoint == UomdSavedAction.SweepPath) input["sweep"] = true;
            return Graph(new { requestId=request,path=endpoint,state="confirmed",binding="exact",inputHash=UomdBattleWire.Hash(CanonicalJson.Serialize(input)),result=UomdJson.Parse(receipt) });
        }
        private async Awaitable<Dictionary<string, object>> Send(string method, string path, Dictionary<string, object> body)
        {
            if (!UomdEditorPreviewIsolation.Active) throw new InvalidOperationException("Review mutations require isolation.");
            string player = _router.Api.GetCurrentSessionSnapshot()?.playerId ?? "hub_review"; ++Writes;
            string json = CanonicalJson.Serialize(body); LastInput = json; LastPath = path;
            var gate = WriteGate; WriteGate = null; if (gate != null) await gate.Awaitable; else await Awaitable.NextFrameAsync();
            if (RejectNext) { RejectNext = false; throw new UomdApiException(402, "insufficient_items", "Isolated rejection."); }
            if (Mode == "offline") throw new UomdApiException(0, "fixture_offline", "Isolated write loss.");
            var input = Graph(body ?? new Dictionary<string, object>()); string request = JsonRead.Str(input, "requestId"), key = player + ":" + request;
            if (request.Length>0 && _receipts.TryGetValue(key,out string original))
            { if (_inputs[key]!=json || _paths[key]!=path) throw new UomdApiException(409,"request_id_reused","Isolated input mismatch."); return UomdJson.ParseObject(original); }
            Dictionary<string, object> result;
            if (path.StartsWith("/api/v1/teams/", StringComparison.Ordinal))
            {
                if (input.ContainsKey("requestId")) throw new InvalidOperationException("Plain team write must not add requestId.");
                int slot = int.Parse(path.Substring("/api/v1/teams/".Length).Split('/','?')[0],System.Globalization.CultureInfo.InvariantCulture);
                var teams = _savedTeams.TryGetValue(player,out string saved) ? (List<object>)UomdJson.Parse(saved) : new List<object> { Graph(new {slot=1,name="The Company",active=true,members=new[]{new{characterId="mahmut",slot=0,row="front"},new{characterId="fadyme",slot=3,row="rear"}}}) };
                if (method=="DELETE") teams.RemoveAll(t=>JsonRead.Int(t,"slot")==slot);
                else if (method=="PUT")
                {
                    bool active=teams.Any(t=>JsonRead.Int(t,"slot")==slot&&JsonRead.Bool(t,"active"))||teams.Count==0;
                    teams.RemoveAll(t=>JsonRead.Int(t,"slot")==slot); var next=Graph(input);next.Remove("releaseId");next["slot"]=(long)slot;next["active"]=active;teams.Add(next);
                }
                else foreach(var team in teams.Cast<Dictionary<string,object>>())team["active"]=JsonRead.Int(team,"slot")==slot;
                _savedTeams[player]=CanonicalJson.Serialize(teams);result=Graph(new{ok=true});
            }
            else if(path.StartsWith("/api/v1/gear/",StringComparison.Ordinal))
            {
                if(input.ContainsKey("requestId"))throw new InvalidOperationException("Plain gear write must not add requestId.");
                string id=path.Split('/')[4];_equipped[player+":"+id]=path.EndsWith("/unequip",StringComparison.Ordinal)?"":JsonRead.Str(input,"characterId");result=Graph(new{ok=true});
            }
            else if(path==UomdSavedAction.SweepPath)
            {
                int count=(int)JsonRead.Int(input,"count"),cost=count*6;string node=JsonRead.Str(input,"nodeId");
                _spentRation[player]=(_spentRation.TryGetValue(player,out int spent)?spent:0)+cost;
                _walletDelta[player]=(_walletDelta.TryGetValue(player,out int oldDelta)?oldDelta:0)+count*2;
                string usage=player+":"+node;_sweepUsed[usage]=(_sweepUsed.TryGetValue(usage,out int used)?used:0)+count;
                result=Graph(new{requestId=request,nodeId=node,count,dailyUsed=_sweepUsed[usage],dailyLimit=20,rewards=new[]{new{type="currency",currency="eclipse_token",amount=count*2}},ration=new{spent=cost,value=114-_spentRation[player],cap=120,nextMs=0},replayed=false});
            }
            else if (RewardsPath(path)) result = RewardsApply(path, input, player);
            else
            {
                string id=path.Split('/')[4]; string characterKey=player+":"+id;
                var raw = new Dictionary<string,object> { ["id"]=id,["level"]=12,["copies"]=1 }; EnrichCharacter(raw,player,Mode); raw=Graph(raw);
                var character=CharacterView.From(raw); int fee = 0;
                result=Graph(new{character=id,replayed=false});
                if(path.EndsWith("/level-up",StringComparison.Ordinal))
                {
                    var plan=UomdGrowth.PlanLevelUp(character,30,1650,new Dictionary<string,int>{{"fixture_xp",20}},new List<(string,int)>{("fixture_xp",2000)},ProgressionConfig.Default,"Bell's Remains",x=>x);
                    raw["level"]=(long)plan.ToLevel;raw["xp"]=(long)plan.ToXp;raw["xpToNext"]=plan.ToXpNext;fee=plan.Fee;
                    result["gainedXp"]=2000L;result["wastedXp"]=(long)plan.WastedXp;
                }
                else if(path.EndsWith("/ascend",StringComparison.Ordinal))
                {raw["ascension"]=(long)character.Ascension+1;raw["cap"]=30L;raw["nextAscension"]=null;fee=55;result["newCap"]=30L;}
                else if(path.Contains("/skills/"))
                {var skill=JsonRead.Objects(raw,"skills").First();skill["rank"]=2L;skill["next"]=null;fee=10;result["rank"]=2L;}
                else if(path.EndsWith("/attune",StringComparison.Ordinal))
                {int spent=character.Resonance.NextShardCost??0;raw["shards"]=(long)character.Shards-spent;var resonance=JsonRead.Obj(raw,"resonance");resonance["tier"]=(long)character.Resonance.Tier+1;resonance["nextShardCost"]=20L;result["spentShards"]=(long)spent;result["resonance"]=resonance;}
                else if(path.EndsWith("/convert",StringComparison.Ordinal))
                {long converted=JsonRead.Int(input,"shards");raw["shards"]=(long)character.Shards-converted;JsonRead.Obj(raw,"resonance")["excessShards"]=0L;result["convertedShards"]=converted;result["shardsRemaining"]=raw["shards"];}
                _walletDelta[player]=(_walletDelta.TryGetValue(player,out int delta)?delta:0)-fee;
                foreach(string field in new[]{"level","xp","ascension"})result[field]=raw[field];
                result["balance"]=(long)1650+_walletDelta[player];result["spent"]=new Dictionary<string,object>{["fee"]=(long)fee};
                _characterChanges[characterKey]=CanonicalJson.Serialize(raw);
            }
            ++Applied;
            if(request.Length>0){_receipts[key]=CanonicalJson.Serialize(result);_inputs[key]=json;_paths[key]=path;}
            if (RewardsLoseResponse && RewardsPath(path)) { RewardsLoseResponse = false; StatusOffline = true; throw new UomdApiException(0, "fixture_response_lost", "Applied reward response lost."); }
            if(LoseNextResponse){LoseNextResponse=false;throw new UomdApiException(0,"fixture_response_lost","Applied fixture response lost.");}
            return result;
        }
    }
}
#endif
