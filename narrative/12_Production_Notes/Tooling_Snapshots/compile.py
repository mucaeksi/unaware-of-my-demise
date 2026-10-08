"""Compile narrative/docs/PART1_FULL_SCRIPT.md from narrative/content/*.json.
Usage: python narrative/tools/compile.py
"""
import json,os
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R=os.path.join(BASE,'content')+os.sep
man=json.load(open(R+'story_script_part1_manifest.json'))
scenes={}
chapters={}
for f in man['chapter_files']:
    d=json.load(open(R+f,encoding='utf-8'))
    for key in ('opening_scene',):
        if key in d: scenes[d[key]['scene_id']]=(d,d[key])
    for s in d.get('scenes',[])+d.get('after_battle_scenes',[]):
        scenes[s.get('stage_id') or s['scene_id']]=(d,s)
out=["# Unaware of My Demise — Part I: *Unaware, I Fade*","","**Full script** (English). Compiled from `content/story_script_*.json`, `character_stories_part1.json`, `events_part1.json` and `lore_text_part1.json`. Voice-track IDs are omitted for readability.",""]
def line(l):
    who=l['speaker_display']; t=l['text_en']
    if l['speaker_id']=='narrator': return f"*{t}*"
    if l['speaker_id'].endswith('_thought'): return f"**{who}:** *{t}*"
    return f"**{who}:** {t}"
def walk(o,acc):
    if isinstance(o,dict):
        if 'text_en' in o and 'speaker_display' in o: acc.append(line(o)); return
        if 'trigger' in o and 'direction_en' in o: acc.append(f"> *[{o['trigger']}] {o['direction_en']}*")
        for k,v in o.items():
            if k in ('tutorial_cards_en',): continue
            if isinstance(v,(dict,list)): walk(v,acc)
            elif k in ('battle_transition_en',): acc.append(f"> *{v}*")
    elif isinstance(o,list):
        for x in o: walk(x,acc)
LT=json.load(open(R+'lore_text_part1.json',encoding='utf-8'))
cur=None
for sid in man['story_order']:
    d,s=scenes[sid]
    ch=d.get('chapter_id')
    if ch!=cur:
        cur=ch; num=int(ch[2:4]); card=next(c for c in LT['chapter_cards'] if c['chapter']==num)
        out+=["",f"## Chapter {num} — {card['title_en']}","",f"*{card['card_en']}*",""]
    title=s.get('title_en','')
    out+=[f"### {sid} — {title}",""]
    if s.get('direction_en'): out+=[f"> *{s['direction_en']}*",""]
    for part,key in (('Before battle','pre_battle_lines'),(None,'phase_interludes'),('After battle','post_battle_lines'),(None,'lines')):
        if key in s:
            acc=[]; walk(s[key],acc)
            if part: out+=[f"**— {part} —**",""]
            out+=[a+"  " for a in acc]+[""]
    if s.get('battle_transition_en'): out+=[f"> *{s['battle_transition_en']}*",""]
    if s.get('next_part_teaser_en'): out+=["","---","",f"## {s['next_part_teaser_en']}",""]
# leftover keys check
cs=json.load(open(R+'character_stories_part1.json',encoding='utf-8'))
out+=["","---","","# Appendix A — Companion Stories",""]
for st in cs['stories']:
    out+=[f"## {st['name_en']} (Tier {st['tier']})",""]
    for p in st['parts']:
        u=p['unlock']; out+=[f"### {p['part']}. {p['title_en']}  ·  unlocks after {u['after_stage']}",""]
        out+=[f"> *{p['direction_en']}*",""]+[line(l)+"  " for l in p['lines']]+[""]
ev=json.load(open(R+'events_part1.json',encoding='utf-8'))
out+=["","---","","# Appendix B — Events",""]
for e in ev['events']:
    out+=[f"## {e['title_en']}  ·  {e['event_type']}, after {e['unlock']['after_stage']}","",e['purpose_en'],""]
    for s in e['scenes']:
        out+=[f"### {s['title_en']}","",f"> *{s['direction_en']}*",""]+[line(l)+"  " for l in s['lines']]+[""]
lt=json.load(open(R+'lore_text_part1.json',encoding='utf-8'))
out+=["","---","","# Appendix C — Codex and Lore Text",""]
for c in lt['codex']: out+=[f"**{c['title_en']}.** {c['text_en']}",""]
for k,label in (('weapons','Signature weapons'),('enemies','Enemies'),('items','Items')):
    out+=[f"## {label}",""]+[f"- **{i}:** {t}" for i,t in lt[k].items()]+[""]
vo=json.load(open(R+'character_voice_lines_part1.json',encoding='utf-8'))
out+=["","---","","# Appendix D — Character Voice Lines",""]
for c in vo['characters']:
    out+=[f"## {c['character_id']}",""]+[f"- *{l['trigger']}*{' ('+l['about']+')' if l.get('about') else ''}: {l['text_en']}" for l in c['lines']]+[""]
out+=["","---","","# Appendix E — Banner Copy",""]
for k,b in lt['banners'].items(): out+=[f"- **{b['title_en']}** ({k}): *{b['tagline_en']}* — {b['story_tie_en']}"]
open(os.path.join(BASE,'docs','PART1_FULL_SCRIPT.md'),'w',encoding='utf-8').write("\n".join(out)+"\n")
print(len(out))
