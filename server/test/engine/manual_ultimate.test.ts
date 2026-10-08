import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BattleService } from "../../src/engine/battle";
import { loadPacks, PACK_FILES, type PackName } from "../../src/engine/content";
import { StoryRules } from "../../src/engine/story";
import { parseClientResult } from "../../src/stages";
import type { UltimateCommand } from "../../src/engine/battle/live";

const content = join(import.meta.dirname,"../../../game/data/content");
const readPack = (file: string) => JSON.parse(readFileSync(join(content,file),"utf8"));
const registry = loadPacks(Object.fromEntries(PACK_FILES.map(file => [file,readPack(file)])) as Record<PackName,unknown>);
const story = new StoryRules(registry,readPack("story_script_part1_manifest.json"));
const fixtures: {stage_id:string; roster:string[];seed:number;levels:Record<string,number>;commands:UltimateCommand[];expected:Record<string,unknown>}[] =
  JSON.parse(readFileSync(join(import.meta.dirname,"../fixtures/manual_ultimate_v1.json"),"utf8"));

describe("player-controlled Ultimates",() => {
  it("re-simulates Godot's complete manual logs, bosses and five-hero parties",() => {
    expect(fixtures.some(row => row.commands.length>0)).toBe(true);
    for (const row of fixtures) {
      const state = story.newPlayerState();
      state.owned_character_ids = new Set(row.roster);
      const result = BattleService.create(registry,story).run(row.stage_id,row.roster,{
        story_state:state,player_levels:row.levels,run_seed:row.seed,
        combat_mode:"manual_ultimate_v1",manual_commands:row.commands,
      });
      expect({
        error:result.error,outcome:result.outcome,stars:result.stars,actions:result.actions,cycles:result.cycles,
        final_units:result.final_units,events:result.state!.battle_events,
      },row.stage_id+" seed "+row.seed+" commands "+row.commands.length).toEqual(row.expected);
    }
  });
  it("refuses unfunded, enemy, unknown, out-of-order and excessive commands",() => {
    for (const actor_id of ["fadyme","missing","1-1:0:bellbound_dead:0"]) {
      const result = BattleService.create(registry,story).run("1-1",["mahmut","fadyme"],{
        combat_mode:"manual_ultimate_v1",manual_commands:[{after_actions:0,actor_id}],
      });
      expect(result.error).not.toBe("");
      expect(result.outcome).toBe("");
    }
    const report = {outcome:"victory",combat_mode:"manual_ultimate_v1"};
    for (const manual_commands of [
      [{after_actions:-1,actor_id:"fadyme"}],
      [{after_actions:4,actor_id:"fadyme"},{after_actions:3,actor_id:"mahmut"}],
      [{after_actions:0.5,actor_id:"fadyme"}],
      [{after_actions:5,actor_id:"fadyme",damage:999999}],
      Array.from({length:1001},()=>({after_actions:5,actor_id:"fadyme"})),
    ]) expect(()=>parseClientResult({...report,manual_commands})).toThrow();
    expect(()=>parseClientResult({outcome:"victory",manual_commands:[]})).toThrow();
    expect(()=>parseClientResult({...report,combat_mode:"anything",manual_commands:[]})).toThrow();
  });
  it("preserves an explicitly empty transcript and legacy report shape",() => {
    expect(parseClientResult({outcome:"victory"})).toEqual({outcome:"victory",stars:null,actions:null,cycles:null});
    expect(parseClientResult({outcome:"victory",combat_mode:"manual_ultimate_v1",manual_commands:[]})).toMatchObject({combat_mode:"manual_ultimate_v1",manual_commands:[]});
  });
});
