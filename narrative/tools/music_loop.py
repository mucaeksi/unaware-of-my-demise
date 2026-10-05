"""Loop builder for Lyria music takes (run in an env with librosa, soundfile, ffmpeg+rubberband).
Usage: python music_loop.py "{\x27<out_name>\x27: (\x27<source_stem>\x27, <semitones>)}"
Edit SRC/OUT/W paths to your environment. Picks level/chroma-matched loop points on beats,
3 s equal-power crossfade at the seam, removes Lyria fade-outs, optional pitch shift."""
import librosa, numpy as np, soundfile as sf, subprocess, json, os, sys
SRC="/mnt/user-data/uploads/Unaware of My Demise/narrative/audio/_review"
OUT="/mnt/user-data/outputs/audio_review"; os.makedirs(OUT,exist_ok=True)
W="/tmp/claude-0/-home-claude/7dd7c737-8aae-585a-826c-b94ca11ef986/scratchpad/music"
import ast
TR=ast.literal_eval(sys.argv[1])  # {out_name:(src_stem,semitones)}
KR_MAJ=np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]); KR_MIN=np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
N=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
def key(y,sr):
    c=librosa.feature.chroma_cqt(y=y,sr=sr).mean(1); best=None
    for i in range(12):
        for prof,m in((KR_MAJ,'major'),(KR_MIN,'minor')):
            r=np.corrcoef(c,np.roll(prof,i))[0,1]
            if best is None or r>best[0]: best=(r,f"{N[i]} {m}")
    return best[1],round(float(best[0]),2)
def sh(cmd): r=subprocess.run(cmd,capture_output=True,text=True); 
def run(cmd):
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode: sys.exit(r.stderr[-800:])
report={}
for name,(stem,semi) in TR.items():
    src=f"{SRC}/{stem}.mp3"; wav=f"{W}/{name}_src.wav"
    if semi:
        run(["ffmpeg","-y","-v","error","-i",src,"-af",f"rubberband=pitch={2**(semi/12):.6f}:formant=preserved","-ar","44100",wav])
    else:
        run(["ffmpeg","-y","-v","error","-i",src,"-ar","44100",wav])
    y,sr=sf.read(wav,always_2d=True)          # (n,ch)
    mono=y.mean(1); hop=1024
    rms=librosa.feature.rms(y=mono,frame_length=4096,hop_length=hop)[0]
    ref=np.median(rms[len(rms)//5:4*len(rms)//5])
    on=np.where(rms>0.25*ref)[0]
    a=on[0]*hop
    alive=np.where(rms>0.6*ref)[0]; b_fade=alive[-1]*hop   # last loud frame
    # snap loop end to a beat before fade
    tempo,beats=librosa.beat.beat_track(y=mono[a:b_fade],sr=sr,hop_length=512)
    bt=librosa.frames_to_samples(beats,hop_length=512)+a
    W2=int(2*sr)
    def lrms(p): seg_=mono[max(0,p-W2):p+W2]; return np.sqrt((seg_**2).mean())
    ch=librosa.feature.chroma_stft(y=mono,sr=sr,hop_length=hop)
    def chv(p,d): i=p//hop; j=i+d*int(2*sr/hop); lo,hi=sorted((i,j)); v=ch[:,lo:hi].mean(1); return v/np.linalg.norm(v)
    rr=np.sqrt((mono[len(mono)//5:4*len(mono)//5]**2).mean())
    heads=[p for p in bt if p<a+0.3*(b_fade-a)]
    tails=[p for p in bt if b_fade-0.3*(b_fade-a)<p<b_fade-sr]
    best=None
    for h in heads:
        rh=lrms(h)
        for t in tails[::2]:
            if t-h<60*sr: continue
            rt=lrms(t); lev=min(rh,rt)/max(rh,rt); loud=min(rh,rt)/rr
            sim=float(chv(h,1)@chv(t,1))   # what follows head vs what follows tail
            sc=sim+0.8*lev+0.6*min(loud,1)+0.15*(t-h)/(b_fade-a)
            if best is None or sc>best[0]: best=(sc,h,t)
    a,b=int(best[1]),int(best[2])
    xf=int(3.0*sr)
    seg=y[a:b].copy()
    ramp=np.linspace(0,1,xf)[:,None]
    ramp_in=np.sin(ramp*np.pi/2); ramp_out=np.cos(ramp*np.pi/2)   # equal power
    body=seg[:-xf].copy()
    body[:xf]=seg[:xf]*ramp_in+seg[-xf:]*ramp_out
    peak=np.abs(body).max(); body*=0.89/peak
    lw=f"{W}/{name}_loop.wav"; sf.write(lw,body.astype(np.float32),sr,subtype="PCM_16")
    run(["ffmpeg","-y","-v","error","-i",lw,"-c:a","libvorbis","-q:a","6",f"{OUT}/{name}_loop.ogg"])
    run(["ffmpeg","-y","-v","error","-i",lw,"-c:a","libmp3lame","-q:a","2",f"{OUT}/{name}_loop_preview.mp3"])
    # seam check: rms around seam vs body
    seam=np.concatenate([body[-sr:],body[:sr]]).mean(1)
    k,kr=key(body.mean(1)[::2],sr//2)
    report[name]={"source":stem+".mp3","pitch_shift_semitones":semi,"loop_start_s":round(a/sr,2),"loop_end_s":round(b/sr,2),
      "loop_length_s":round(len(body)/sr,2),"crossfade_s":3.0,"tempo_bpm":round(float(np.atleast_1d(tempo)[0]),1),"key_est":k,"key_conf":kr,
      "seam_rms_ratio":round(float(np.sqrt((seam**2).mean())/np.sqrt((body.mean(1)**2).mean())),2)}
    print(name,report[name],flush=True)
pj=f"{OUT}/post.json"; old=json.load(open(pj)) if os.path.exists(pj) else {}
old.update({k:{kk:(float(vv) if isinstance(vv,np.floating) else vv) for kk,vv in v.items()} for k,v in report.items()}); json.dump(old,open(pj,"w"),indent=1)
