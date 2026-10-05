"""Intro+loop builder: file starts at the take's real beginning (clean), loops back to loop_offset.
The last 3 s before the loop end are an equal-power blend into the audio just before loop_offset,
so end -> loop_offset is seamless. Engine setting: loop on, loop_offset = sidecar loop_offset_s."""
import json, numpy as np, soundfile as sf, subprocess, librosa, os
# W: folder with <name>_src.wav written by music_loop.py; edit paths for your env
W=os.path.dirname(os.path.abspath(__file__)); O="/mnt/user-data/outputs/music_final"; os.makedirs(O,exist_ok=True)
P=json.load(open("/mnt/user-data/outputs/audio_review/post.json"))
res={}
for name,v in P.items():
    y,sr=sf.read(f"{W}/{name}_src.wav",always_2d=True)
    mono=y.mean(1); rms=librosa.feature.rms(y=mono,frame_length=2048,hop_length=512)[0]
    ref=np.median(rms); s0=max(0,int(np.where(rms>0.03*ref)[0][0]*512)-int(0.05*sr))
    a=int(round(v["loop_start_s"]*sr)); b=int(round(v["loop_end_s"]*sr)); xf=int(3.0*sr)
    assert a-s0>=xf
    F=y[s0:b].copy(); r=np.linspace(0,1,xf)[:,None]
    F[-xf:]=y[b-xf:b]*np.cos(r*np.pi/2)+y[a-xf:a]*np.sin(r*np.pi/2)
    fi=int(0.01*sr); F[:fi]*=np.linspace(0,1,fi)[:,None]          # 10 ms de-click at file start only
    F*=0.89/np.abs(F).max()
    off=a-s0
    # seam check: sample jump at end->offset vs typical
    jump=np.abs(F[-1]-F[off]).max(); typ=np.median(np.abs(np.diff(F[:,0])))
    w=f"{W}/{name}_final.wav"; sf.write(w,F.astype(np.float32),sr,subtype="PCM_16")
    subprocess.run(["ffmpeg","-y","-v","error","-i",w,"-c:a","libvorbis","-q:a","6",f"{O}/{name}_loop.ogg"],check=True)
    # preview: whole file + two more passes of the loop region, so the loop point is heard twice
    pv=np.concatenate([F,F[off:],F[off:off+int(15*sr)]]); fo=int(2*sr); pv[-fo:]*=np.linspace(1,0,fo)[:,None]
    sf.write(f"{W}/{name}_pv.wav",pv.astype(np.float32),sr,subtype="PCM_16")
    subprocess.run(["ffmpeg","-y","-v","error","-i",f"{W}/{name}_pv.wav","-c:a","libmp3lame","-q:a","2",f"{O}/{name}_loop_preview.mp3"],check=True)
    res[name]=dict(file_length_s=round(len(F)/sr,3),loop_offset_s=round(off/sr,4),loop_offset_samples=int(off),sample_rate=int(sr),
                   intro_from_original_s=round(s0/sr,2),loop_region_original_s=[v["loop_start_s"],v["loop_end_s"]],seam_jump=round(float(jump),4),typical_step=round(float(typ),4),
                   pitch_shift_semitones=v["pitch_shift_semitones"],key_est=v["key_est"],tempo_bpm=v["tempo_bpm"])
    print(name,res[name])
json.dump(res,open(f"{O}/loops.json","w"),indent=1)
