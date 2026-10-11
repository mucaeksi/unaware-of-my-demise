"""Read-only preparation checks; writes a design report, never a game/release result.
Run from any directory: python narrative/.../ash_circle/qa/validate_design.py
"""
from pathlib import Path
from copy import deepcopy
from collections import Counter
import json, hashlib, csv, math, random

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[3]
def read(n):return json.loads((ROOT/n).read_text())
def save(n,d):(ROOT/n).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
mode=read('authoring/mode.json'); arena=read('authoring/arena.json')
chapters=read('authoring/chapters.json')['chapters']; ranks=read('authoring/threat_ranks.json')['ranks']
enemies=read('authoring/enemies.json')['roles']; bosses=read('authoring/bosses.json'); cards=read('authoring/upgrades.json')
roster=read('authoring/roster_adapters.json'); story=read('authoring/story.json')['scenes']; triggers=read('authoring/story_triggers.json')['triggers']
tuning=read('authoring/tuning.json'); sim=read('authoring/simulation_contract.json'); state=read('authoring/state_contract.json')
assert mode['status']=='complete_preproduction_not_implemented'
assert mode['rewards']['binding'] is None and mode['energy_cost'] is None
assert mode['unlock']['after_stage']=='4-5' and mode['party']['unique_owned']==5
assert mode['progression']['permanent_stats'] is False
for src in mode['sources']:assert hashlib.sha256((REPO/src['path']).read_bytes()).hexdigest()==src['sha256'],src['path']
assert len(chapters)==10 and [c['chapter'] for c in chapters]==list(range(1,11))
assert len(ranks)==6 and [r['rank'] for r in ranks]==list(range(6))
assert len({c['arena_id'] for c in chapters})==1 and chapters[0]['arena_id']==arena['arena_id']
assert len({c['boss_id'] for c in chapters})==10
patterns=read('authoring/spawn_patterns.json')['patterns'];hazards=read('authoring/hazards.json')['hazards']
bossmap={b['boss_id']:b for b in bosses['bosses']}
bounds=arena['playable_bounds'];x0,y0=bounds['x'],bounds['y'];x1,y1=x0+bounds['width'],y0+bounds['height']
actor_radius=arena['actor_radius'];timeline_count=0;objective_trace=[]
for c in chapters:
 assert c['boss_id'] in bossmap and c['duration_seconds']*30==c['combat_clock_ticks']==14400
 assert c['boss_start_tick']==10800 and c['breather_tick']==7200
 assert c['requires']['highest_base_chapter']==c['chapter']-1
 assert c['objective']['count']==3 and c['objective']['deadline_tick']==10800
 assert c['objective']['positions']==arena['chapter_positions'][str(c['chapter'])]
 assert c['objective']['available_tick_by_stage']==[0,3600,7200]
 assert c['objective']['interaction_ticks']==30
 for pos in [c['start_position'],*c['objective']['positions']]:
  assert x0+actor_radius<=pos[0]<=x1-actor_radius and y0+actor_radius<=pos[1]<=y1-actor_radius
 previous=c['start_position'];now=0;arrival=[]
 for pos,available in zip(c['objective']['positions'],c['objective']['available_tick_by_stage']):
  # Lower bound only: no collisions/enemies/hazards. Assert the planned geometry is not
  # impossible even before combat; passing this does not prove a survivable route.
  speed=c['objective'].get('escort',{}).get('cart_speed',arena['hero_speed_units_per_second'])
  travel=math.ceil(math.dist(previous,pos)/speed*30)
  now=max(available,now+travel)+c['objective']['interaction_ticks'];arrival.append(now);previous=pos
 assert now<c['objective']['deadline_tick']
 objective_trace.append({'chapter':c['chapter'],'unopposed_min_finish_tick':now,'arrivals':arrival,'proof_scope':'geometry/time lower bound only'})
 assert len(c['waves'])==6
 for i,w in enumerate(c['waves']):
  assert w['phase']==i+1 and w['start_tick']==1800*i and w['end_tick']==1800*(i+1)
  assert w['spawn_pattern'] in patterns and w['batch_size']>0 and w['batch_interval_ticks']==180
  assert all(f in enemies and v>0 for f,v in w['family_weights'].items())
  assert all(h in hazards for h in w['ambient_hazard_ids'])
  assert w['objective_stage_available']==min(3,i//2+1)
  timeline_count+=len(range(w['start_tick'],w['end_tick'],w['batch_interval_ticks']))
 b=bossmap[c['boss_id']]
 assert b['canonical_family'] in enemies and b['arena_id']==arena['arena_id']
 assert b['hp']>0 and b['timeout_ticks']==3600
 assert all(all(a in bosses['attack_profiles'] for a in p['sequence']) for p in b['phases'])
 assert b['phase_thresholds_hp_percent']==[p['hp_below_percent'] for p in b['phases']]
 assert all(p['ambient_hazards_enabled'] is False and p['hp_refill'] is False for p in b['phases'])
for name,atk in bosses['attack_profiles'].items():
 if atk['damage']>0:assert atk['warning_ticks']>=45,name
for h in hazards.values():assert h['warning_ticks']>=45
assert tuning['hard_budgets']['enemy_live']==160
assert all(r['live_cap']==160 and r['warnings_scaled'] is False for r in ranks)
assert set(roster['excluded_main_inputs'])>=set(['level','rarity','gear','duplicates'])
canon=json.loads((REPO/'narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/characters_part1.json').read_text())['characters']
assert {c['character_id'] for c in canon}=={c['character_id'] for c in roster['adapters']}
weapons=read('authoring/weapons.json')['weapons']
for r in roster['adapters']:
 assert r['lead_weapon'] in weapons and r['support_weapon'] in weapons and r['support_trait'] in roster['traits']
 assert r['owned_required'] and r['canonical_kit_copied'] is False
manifest=json.loads((REPO/'narrative/02_Main_Story/story_script_part1_manifest.json').read_text())
free=set(manifest['acquisition_story_beats']['starting_free'])|{r['character_id'] for r in manifest['acquisition_story_beats']['story_recruits']}
assert len(free)==5 and free<={r['character_id'] for r in roster['adapters']}
for selector in manifest['acquisition_story_beats']['guaranteed_selector']['choose_one_from']:
 assert selector in {r['character_id'] for r in roster['adapters']}

scene_ids={s['scene_id'] for s in story};assert len(scene_ids)==len(story)==34
assert scene_ids=={t['scene_id'] for t in triggers} and len(triggers)==len(scene_ids)
assert all(all(req in scene_ids for req in t['required_seen']) for t in triggers)
seen=set()
for _ in range(40):
 for t in triggers:
  if set(t['required_seen'])<=seen:seen.add(t['scene_id'])
assert seen==scene_ids
lines=[l for s in story for l in s['lines']+sum([o['lines'] for o in s.get('choice',{}).get('options',[])],[])]
lineids={l['line_id'] for l in lines};assert len(lineids)==len(lines)==189
csvlines=list(csv.DictReader((ROOT/'VO_LINE_LIST.csv').open()))
assert [l['line_id'] for l in lines]==[l['line_id'] for l in csvlines]
for a,b in zip(lines,csvlines):
 assert a['text_en']==b['text_en'] and a['speaker_id']==b['speaker_id']
 assert a['text_en'] in (ROOT/'TAM_SCRIPT.md').read_text()
 assert b['text_ja']=='' and b['recording_status']=='not_recorded'
assert sum(cards['xp_needed_for_next_level'])==836
assert len(cards['cards'])==20 and len({c['card_id'] for c in cards['cards']})==20

# Seeded draft reference check: eligibility/caps only, not the future xorshift32 game RNG.
offer_checks=0
for seed in range(500):
 rng=random.Random(seed);levels=Counter()
 for _ in range(cards['choices_per_run_max']):
  eligible=sorted(c['card_id'] for c in cards['cards'] if levels[c['card_id']]<c['rank_cap'])
  assert len(eligible)>=3;rng.shuffle(eligible);offer=eligible[:3]
  assert len(set(offer))==3
  saved=deepcopy(offer);chosen=offer[rng.randrange(3)]
  assert chosen in saved;levels[chosen]+=1;assert levels[chosen]<=4
  assert offer==saved;offer_checks+=1
assert cards['max_level']-cards['starting_level']==cards['choices_per_run_max']==19
assert len(cards['cards'])-cards['choices_per_run_max']//4>=3

# Proposed sim protocol golden RNG/axis vectors; this is not a game simulation.
def next_uint32(x):
 x^=(x<<13)&0xffffffff;x^=x>>17;x^=(x<<5)&0xffffffff
 return x&0xffffffff
x=1;outputs=[]
for _ in range(5):x=next_uint32(x);outputs.append(x)
assert outputs==[270369,67634689,2647435461,307599695,2398689233]
axis_vectors=[]
for ax,ay in [(0,0),(127,0),(-127,0),(127,127),(-127,-127),(100,100),(100,20)]:
 squared=ax*ax+ay*ay
 if squared>127*127:
  denominator=math.isqrt(squared)+(math.isqrt(squared)**2<squared)
  nx=math.trunc(ax*127/denominator);ny=math.trunc(ay*127/denominator)
 else:nx,ny=ax,ay
 assert nx*nx+ny*ny<=127*127
 axis_vectors.append({'input':[ax,ay],'normalized':[nx,ny]})
save('qa/PROTOCOL_VECTORS.json',{'scope':'proposed RNG/axis contract vectors, not server/client integration','xorshift32_seed':1,'next_uint32':outputs,'axis_vectors':axis_vectors})

# Demand sweep; arithmetic count/HP pressures only. At-cap admission fixture deliberately
# applies zero deaths to stress skip-without-backlog. No collision or party balance implied.
demand=[]
for c in chapters:
 previous_hp=0
 for r in ranks:
  batches=[(tick,w['batch_size']+r['spawn_batch_extra'],w) for w in c['waves'] for tick in range(w['start_tick'],w['end_tick'],w['batch_interval_ticks'])]
  scheduled=sum(n for _,n,_ in batches)
  hp=sum(n*sum(enemies[f]['hp']*weight for f,weight in w['family_weights'].items())/sum(w['family_weights'].values()) for _,n,w in batches)*c['base_enemy_hp_multiplier']*r['enemy_hp_multiplier']
  boss_hp=math.ceil(bossmap[c['boss_id']]['hp']*r['boss_hp_multiplier'])
  assert hp>previous_hp;previous_hp=hp
  live=0;admitted=0;skipped=0
  for tick,n,w in batches:
   accepted=min(n,160-live);live+=accepted;admitted+=accepted;skipped+=n-accepted
   assert live<=160 and tick<10800
  assert admitted+skipped==scheduled and admitted<=160
  assert all(b[0]<10800 for b in batches)
  demand.append({'rank':r['rank'],'chapter':c['chapter'],'scheduled_batches':len(batches),'requested_spawns':scheduled,'weighted_pre_cap_HP_demand':round(hp,3),'boss_HP':boss_hp,'zero_death_cap_fixture_admitted':admitted,'zero_death_cap_fixture_skipped':skipped,'not_balance_or_enemy_simulation':True})
assert len(demand)==60

# Reference account state machine: failure/replay/duplicate/gaps cannot unlock extra cells.
checks=0
def check(a,b):
 global checks
 assert a==b,(a,b);checks+=1
def progress(highest,cell,status,already_accepted=False):
 if already_accepted:return highest
 if cell<1 or cell>min(60,highest+1):raise ValueError('locked')
 return highest+1 if status=='accepted' and cell==highest+1 else highest
highest=0;trace=[]
for cell in range(1,61):
 for outcome in ['defeated','abandoned','rejected','pending_verification','paused']:check(progress(highest,cell,outcome),highest)
 try:progress(highest,cell+1,'accepted');raise AssertionError('gap admitted')
 except ValueError:checks+=1
 old=highest;highest=progress(highest,cell,'accepted');check(highest,old+1)
 check(progress(highest,cell,'accepted'),highest)
 check(progress(highest,cell,'accepted',True),highest)
 check(progress(highest,1,'accepted'),highest)
 trace.append({'cell':cell,'rank':(cell-1)//10,'chapter':(cell-1)%10+1,'highest_after':highest})
check(highest,60)
for cell in [0,-1,61,900]:
 try:progress(60,cell,'accepted');raise AssertionError('invalid cell admitted')
 except ValueError:checks+=1
check(state['transitions']['accepted'],[])
check(sim['input_log_limit']['max_ticks'],14400)
check(sim['input_log_limit']['max_events']>=sim['input_log_limit']['max_ticks']*2,True)
summary={'status':'PASS_DESIGN_REFERENCES_ONLY','chapters':10,'arena_count':1,'cells':60,'source_hashes_checked':len(mode['sources']),
 'timeline_batch_definitions_checked':timeline_count,'scheduled_batches_all_cells':sum(d['scheduled_batches'] for d in demand),'upgrade_offer_reference_checks':offer_checks,'progress_reference_checks':checks,
 'story_refs_and_CSV':'PASS','geometry_deadline_lower_bounds':'PASS','monotone_pre_cap_HP_demand':'PASS','roster_ID_and_free_access_refs':'PASS','protocol_vector_checks':12,
 'does_not_prove':['playable_module','server_replay','real_collision_safety','difficulty_monotonicity_in_play','free_roster_balance','Android_fps','actual_cloudflare_cpu'],'runtime_enable_allowed':False}
save('qa/DESIGN_VALIDATION.json',summary);save('qa/SCHEDULER_DEMAND.json',{'scope':'schedule arithmetic and cap stress reference, not combat simulation','cells':demand})
save('qa/OBJECTIVE_LOWER_BOUNDS.json',{'scope':'unopposed geometry lower bound, not hazard/collision/playability proof','chapters':objective_trace})
save('qa/PROGRESSION_TRACE.json',{'scope':'new design reference state model, not shipped server','steps':trace})
print(json.dumps(summary,ensure_ascii=False))
