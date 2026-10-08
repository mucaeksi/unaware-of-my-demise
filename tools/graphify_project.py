"""Build the project-wide Graphify map without modifying source/runtime files.

Graphify's native extractor covers supported languages. A conservative adapter
adds Godot declarations and resource references; document fragments add semantic
context. The persisted MultiDiGraph preserves distinct relations and directions.
"""
from __future__ import annotations

import argparse
import ast
import copy
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import unquote, urlsplit

import networkx as nx
from graphify.analyze import god_nodes, suggest_questions, surprising_connections
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.diagnostics import diagnose_extraction, format_diagnostic_report
from graphify.export import to_json
from graphify.report import generate
from graphify.detect import detect, save_manifest
from graphify.extract import extract

from graphify_godot import extract_godot

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'graphify-out'
ART = ROOT / 'build' / 'graphify-map-20261007'
CODE = {'.gd','.ts','.tsx','.js','.py','.sql','.sh','.ps1','.java','.gradle','.gdshader','.css'}
DOC = {'.md','.txt','.yaml','.yml','.html'}
MEDIA = {'.png','.jpg','.jpeg','.webp','.svg','.ogg','.mp3','.wav','.ttf','.fnt'}
SECRET = {'.pem','.key','.p12','.jks','.keystore'}

def norm(value):
    return re.sub(r'[^a-z0-9_]', '_', value.lower())

def stem(path):
    return norm(Path(path).with_suffix('').as_posix())

def write(name, value):
    (OUT/name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def read(name):
    path=OUT/name
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'nodes':[],'edges':[],'hyperedges':[]}

def relative(source):
    if not source: return None
    p=Path(source)
    try: return p.resolve().relative_to(ROOT).as_posix() if p.is_absolute() else p.as_posix()
    except ValueError: return p.as_posix()

def inventory():
    raw=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT)
    paths=sorted(set(raw.decode('utf-8').split('\0'))-{''})
    return [p for p in paths if (ROOT/p).is_file() and not p.startswith(('graphify-out/','.git/','build/','.local/','local-backups/'))]

def edge(source,target,relation,path=None,line=None,context=None):
    return {'source':source,'target':target,'relation':relation,'confidence':'EXTRACTED',
            'confidence_score':1.0,'weight':1.0,'source_file':path,'source_location':line,
            'context':context or relation,'_origin':'project_structural'}

def grounded_native_fragment(fragment):
    """Quarantine fuzzy calls contradicted by explicit external Graphify imports."""
    by_id={n['id']:n for n in fragment.get('nodes',[])}
    bindings={}; quarantined=[]; retained=[]
    for e in fragment.get('edges',[]):
        src=relative(e.get('source_file'))
        if e.get('relation')=='calls' and e.get('confidence')=='INFERRED' and src and src.endswith('.py'):
            if src not in bindings:
                bindings[src]={}
                try:
                    tree=ast.parse((ROOT/src).read_text(encoding='utf-8'))
                    for item in tree.body:
                        if isinstance(item,ast.ImportFrom) and item.module and item.module.startswith('graphify.'):
                            for alias in item.names:
                                bindings[src][alias.asname or alias.name]=item.module+'.'+alias.name
                except (OSError,SyntaxError,UnicodeError):
                    pass
            target=by_id.get(e.get('target'),{})
            name=target.get('label','').removesuffix('()')
            if name in bindings[src] and relative(target.get('source_file'))!=src:
                quarantined.append({**e,'reason':'fuzzy target contradicted by explicit external import',
                                    'imported_symbol':bindings[src][name]})
                continue
        retained.append(e)
    fragment={**fragment,'edges':retained}
    return fragment,quarantined

def build(project_fragments=False, allow_reviewed_shrink=False):
    files=inventory()
    collisions=defaultdict(list)
    for p in files: collisions[stem(p)].append(p)
    ids={p:stem(p)+(('_'+norm(Path(p).suffix.lstrip('.'))) if len(collisions[stem(p)])>1 else '') for p in files}
    godot=read('.graphify_godot.json')
    for p,nid in godot.get('file_ids',{}).items():
        if relative(p) in ids: ids[relative(p)]=nid
    assert len(ids.values())==len(set(ids.values())), 'Unresolved file ID collision'
    nodes={}; edges=[]; headings=0; resolved_links=0; unresolved=[]; duplicates=[]
    hashes=defaultdict(list)
    dirs=set()
    for p in files:
        path=ROOT/p; ext=path.suffix.lower()
        category='code' if ext in CODE else 'document' if ext in DOC else 'image' if ext in {'.png','.jpg','.jpeg','.webp','.svg'} else 'concept'
        d={'id':ids[p],'label':path.name,'file_type':category,'source_file':p,'source_location':'L1',
           'inventory_file':True,'extension':ext,'size_bytes':path.stat().st_size,'_origin':'project_inventory'}
        if ext in SECRET: d['content_excluded']='sensitive_material'; category='excluded'
        if ext in MEDIA or ext in DOC:
            digest=hashlib.sha256(path.read_bytes()).hexdigest(); d['sha256']=digest; hashes[digest].append(p)
        if ext in {'.ogg','.mp3','.wav'}: d['asset_type']='audio'; d['semantic_depth']='reference_and_metadata_only'
        if ext in {'.png','.jpg','.jpeg','.webp','.svg'}: d['asset_type']='image'; d['semantic_depth']='reference_and_metadata_only'
        nodes[d['id']]=d
        parent=Path(p).parent
        while parent.as_posix()!='.': dirs.add(parent.as_posix()); parent=parent.parent
    nodes['project_root']={'id':'project_root','label':'Unaware of My Demise project','file_type':'concept','source_file':None,'_origin':'project_inventory'}
    for directory in sorted(dirs):
        nid='directory_'+norm(directory)
        nodes[nid]={'id':nid,'label':Path(directory).name+' /','file_type':'concept','source_file':directory,'directory':True,'_origin':'project_inventory'}
        par=Path(directory).parent.as_posix(); target='project_root' if par=='.' else 'directory_'+norm(par)
        edges.append(edge(target,nid,'contains',directory))
    for p in files:
        par=Path(p).parent.as_posix(); target='project_root' if par=='.' else 'directory_'+norm(par)
        edges.append(edge(target,ids[p],'contains',p))
    for digest,group in hashes.items():
        if len(group)<2: continue
        group.sort(key=lambda p:(not p.startswith('game/'),len(p),p))
        duplicates.append({'sha256':digest,'files':group})
        for p in group[1:]: edges.append(edge(ids[p],ids[group[0]],'same_content_as',p,context='sha256_equal'))
    for p in files:
        if Path(p).suffix.lower() not in DOC: continue
        text=(ROOT/p).read_text(encoding='utf-8',errors='replace')
        for number,line in enumerate(text.splitlines(),1):
            match=re.match(r'^(#{1,6})\s+(.+)',line)
            if match:
                title=match.group(2).strip(); nid=ids[p]+'_heading_'+norm(title)
                if nid not in nodes:
                    nodes[nid]={'id':nid,'label':title,'file_type':'concept','source_file':p,'source_location':f'L{number}','_origin':'document_structure'}
                    edges.append(edge(ids[p],nid,'contains_heading',p,f'L{number}')); headings+=1
            candidates=re.findall(r'\[[^\]]*\]\(([^)]+)\)',line)+re.findall(r'`([^`\n]+)`',line)
            for raw in candidates:
                target=unquote(raw.strip().strip('<>'))
                if target.startswith(('http:','https:','mailto:','#','app:')): continue
                target=target.split('#')[0].strip()
                if not target or '\n' in target: continue
                if target.startswith('res://'): choices=['game/'+target[6:]]
                else:
                    choices=[(Path(p).parent/target).as_posix(),target.replace('\\','/')]
                    if target.startswith('F:/unaware-of-my-demise/'): choices=[target.split('F:/unaware-of-my-demise/',1)[1]]
                found=None
                for candidate in choices:
                    try: candidate=(ROOT/candidate).resolve().relative_to(ROOT).as_posix()
                    except ValueError: continue
                    if candidate in ids: found=ids[candidate]; break
                    if candidate in dirs: found='directory_'+norm(candidate); break
                if found and found!=ids[p]:
                    edges.append(edge(ids[p],found,'references',p,f'L{number}',context='document_path_reference')); resolved_links+=1
                elif '/' in target and len(target)<180 and not any(c in target for c in '*{}$|'):
                    unresolved.append({'source_file':p,'source_location':f'L{number}','target':target})
    native_fragment,native_ambiguities=grounded_native_fragment(read('.graphify_ast.json'))
    fragments=[native_fragment,godot]
    semantic_stale=set()
    semantic_covered=set()
    if project_fragments:
        for name, manifest_name in [('.graphify_semantic_project.json','semantic-project/processed-manifest.json'),('.graphify_semantic_framework.json','semantic-framework/coverage.json')]:
            fragment=read(name)
            manifest=read(manifest_name)
            records=manifest if isinstance(manifest,list) else manifest.get('files',manifest.get('processed_files',manifest.get('documents',[])))
            if isinstance(records,dict): records=list(records.values())
            if fragment.get('nodes') and not records:
                raise ValueError(f'{name} has semantic nodes but no coverage manifest; restore {manifest_name} or rebuild semantics')
            verified_paths=set()
            fragment_stale=set()
            for record in records:
                if not isinstance(record,dict):
                    raise ValueError(f'{manifest_name} has an invalid file record')
                path=relative(record.get('source_file',record.get('path',record.get('file'))))
                expected=record.get('sha256',record.get('hash'))
                if not path or not isinstance(expected,str) or not re.fullmatch(r'[a-f0-9]{64}',expected):
                    raise ValueError(f'{manifest_name} has a file record without a usable SHA-256')
                verified_paths.add(path)
                if not (ROOT/path).exists() or hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=expected:
                    fragment_stale.add(path)
                else:
                    semantic_covered.add(path)
            for record in fragment.get('nodes',[])+fragment.get('edges',[])+fragment.get('hyperedges',[]):
                path=relative(record.get('source_file'))
                if path and Path(path).suffix.lower() in DOC and path not in verified_paths:
                    raise ValueError(f'{name} has unchecked document evidence from {path}')
            # Reference-only code endpoint placeholders must not replace fresh
            # native/adapter declarations or inventory metadata.
            fragment['nodes']=[n for n in fragment.get('nodes',[]) if relative(n.get('source_file')) in verified_paths]
            if fragment_stale:
                bad=fragment_stale
                fragment['nodes']=[n for n in fragment.get('nodes',[]) if relative(n.get('source_file')) not in bad]
                fragment['edges']=[e for e in fragment.get('edges',[]) if relative(e.get('source_file')) not in bad]
                fragment['hyperedges']=[h for h in fragment.get('hyperedges',[]) if relative(h.get('source_file')) not in bad]
            fragments.append(fragment)
            semantic_stale.update(fragment_stale)
        semantic_stale.difference_update(semantic_covered)
    hyper=[]; failed=[]
    for fragment in fragments:
        remap={}
        for item in fragment.get('nodes',[]):
            n=copy.deepcopy(item); src=relative(n.get('source_file')); n['source_file']=src
            nid=n['id']; standard=stem(src) if src in ids else None
            if standard and (nid==standard or (n.get('label')==Path(src).name and not n.get('_callable'))):
                remap[nid]=ids[src]; nid=ids[src]; n['id']=nid
            base=nodes.get(nid,{})
            nodes[nid]={**base,**n}
            if base.get('inventory_file'): nodes[nid]['inventory_file']=True
        for e in fragment.get('edges',[]):
            e=copy.deepcopy(e); e['source']=remap.get(e['source'],e['source']); e['target']=remap.get(e['target'],e['target'])
            e['source_file']=relative(e.get('source_file')); e.setdefault('confidence_score',1.0 if e.get('confidence')=='EXTRACTED' else 0.2)
            edges.append(e)
        for h in fragment.get('hyperedges',[]):
            h=copy.deepcopy(h); h['source_file']=relative(h.get('source_file')); h['nodes']=[remap.get(n,n) for n in h.get('nodes',[])]; hyper.append(h)
        failed.extend(fragment.get('failed_sources',[]))
    seen=set(); unique=[]
    for e in edges:
        key=tuple(str(e.get(k,'')) for k in ('source','target','relation','context','source_file','source_location'))
        if key in seen: continue
        seen.add(key); unique.append(e)
        for endpoint in ('source','target'):
            nid=e[endpoint]
            if nid not in nodes:
                nodes[nid]={'id':nid,'label':nid,'file_type':'concept','source_file':None,'resolution':'external_or_unresolved','_origin':'endpoint_catalogue'}
    extraction={'nodes':list(nodes.values()),'edges':unique,'hyperedges':hyper,'input_tokens':0,'output_tokens':0}
    write('.graphify_extract.json',extraction)
    native=build_from_json(copy.deepcopy(extraction),root=ROOT,directed=True,dedup=False)
    # Persist exact, distinct structural relations rather than the simple view.
    G=nx.MultiDiGraph()
    G.graph.update(native.graph)
    G.graph['hyperedges']=hyper
    G.graph['semantic_usage_status']='actual_host_agent_token_counts_unavailable'
    G.graph['scope']='git-visible authored files; generated/private local material excluded'
    for n in extraction['nodes']: G.add_node(n['id'],**{k:v for k,v in n.items() if k!='id'})
    for e in unique: G.add_edge(e['source'],e['target'],**{k:v for k,v in e.items() if k not in {'source','target'}})
    assert all(nid in G for nid in ids.values())
    assert G.number_of_edges()==len(unique)
    communities=cluster(G)
    cohesion=score_all(G,communities)
    labels={}
    for cid,members in communities.items():
        scopes=Counter('/'.join((G.nodes[n].get('source_file') or '').split('/')[:3]) for n in members if G.nodes[n].get('source_file'))
        label=scopes.most_common(1)[0][0] if scopes else 'Shared concepts'
        labels[cid]=label.replace('_',' ') or 'Shared concepts'
    gods=god_nodes(G); surprises=surprising_connections(G,communities); questions=suggest_questions(G,communities,labels)
    detected=read('.graphify_detect.json'); detected['total_files']=len(files)
    # Zero refers solely to paid API usage. Host semantic-agent counts unavailable.
    report=generate(G,communities,cohesion,labels,gods,surprises,detected,{'input':0,'output':0},str(ROOT),suggested_questions=questions)
    report=report.replace('- Token cost: 0 input · 0 output', '- Token cost: host-agent input/output unavailable; paid external LLM API calls: 0')
    report='> Coverage: full authored-file inventory plus native AST, conservative Godot extraction and document concepts.\n> No external LLM API calls. Host-agent semantic token counts are unavailable; numeric zero cost below does not mean zero host-agent usage.\n> Audio/image content is catalogued via paths, hashes and references; not transcribed or exhaustively visually interpreted.\n> Graph is a MultiDiGraph: direction and distinct relations are preserved.\n\n'+report
    (OUT/'GRAPH_REPORT.md').write_text(report,encoding='utf-8')
    wrote=to_json(G,communities,str(OUT/'graph.json'),community_labels=labels,force=allow_reviewed_shrink)
    assert wrote,'Graph shrink guard refused write'
    write('.graphify_labels.json',{str(k):v for k,v in labels.items()})
    write('.graphify_analysis.json',{'communities':{str(k):v for k,v in communities.items()},'cohesion':{str(k):v for k,v in cohesion.items()},'gods':gods,'surprises':surprises,'questions':questions})
    summary={'files':len(files),'file_extensions':dict(Counter(Path(p).suffix.lower() for p in files)),
        'source_directories':dict(Counter(p.split('/')[0] for p in files)), 'nodes':len(G),'edges':G.number_of_edges(),'communities':len(communities),
        'document_headings':headings,'resolved_document_refs':resolved_links,'unresolved_document_refs':len(unresolved),
        'duplicate_groups':len(duplicates),'duplicate_extra_files':sum(len(g['files'])-1 for g in duplicates),
        'sensitive_contents_excluded':[p for p in files if Path(p).suffix.lower() in SECRET],
        'host_semantic_tokens':None,'external_api_calls':0,'native_failed_sources':failed,
        'native_call_ambiguities_quarantined':len(native_ambiguities),
        'semantic_source_documents':len(semantic_covered),'stale_semantic_sources':sorted(set(semantic_stale)),
        'documents_without_semantic_fragment':[p for p in files if Path(p).suffix.lower() in DOC and p not in semantic_covered],
        'reviewed_shrink_override':allow_reviewed_shrink,
        'godot_statistics':godot.get('statistics',godot.get('stats',{})), 'semantic_fragments_included':project_fragments,
        'all_inventory_nodes_present':True,'dangling_edge_endpoints':0,'direction_and_parallel_relations_preserved':True}
    write('coverage.json',summary); write('inventory.json',[{'path':p,'node_id':ids[p],'size_bytes':(ROOT/p).stat().st_size} for p in files])
    write('duplicate_content.json',duplicates);write('unresolved_document_refs.json',unresolved)
    write('native_call_ambiguities.json',native_ambiguities)
    diagnostic=diagnose_extraction(extraction,directed=True,root=ROOT)
    write('diagnostics.json',diagnostic)
    (OUT/'GRAPH_HEALTH.md').write_text(format_diagnostic_report(diagnostic)+'\n\nDistinct same-endpoint edges are intentionally preserved in graph.json MultiDiGraph; the simple-graph collapse simulation is a risk diagnostic, not loss in this export.\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=True))

def refresh_sources():
    OUT.mkdir(exist_ok=True)
    detected=detect(ROOT)
    write('.graphify_detect.json',detected)
    result=extract([Path(p) for p in detected.get('files',{}).get('code',[])],cache_root=ROOT,parallel=False)
    write('.graphify_ast.json',result)
    write('.graphify_godot.json',extract_godot(ROOT,inventory()))
    save_manifest(detected['files'],root=ROOT,kind='ast')
    (OUT/'.graphify_python').write_text(sys.executable,encoding='utf-8')
    (OUT/'.graphify_root').write_text(str(ROOT),encoding='utf-8')

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8',errors='replace')
    parser=argparse.ArgumentParser()
    parser.add_argument('--semantic',action='store_true',help='Include existing, hash-verified document fragments')
    parser.add_argument('--refresh',action='store_true',help='Refresh native AST and Godot structure; retain only unchanged document semantics')
    parser.add_argument('--allow-reviewed-shrink',action='store_true',help='Allow overwrite with fewer nodes only after intentional source removals were reviewed')
    args=parser.parse_args()
    if args.refresh: refresh_sources()
    build(args.semantic or args.refresh,args.allow_reviewed_shrink)
