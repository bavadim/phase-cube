#!/usr/bin/env python3
"""Local assets: full authored song minus riff, eight half-bar riff samples."""
from pathlib import Path
import base64, hashlib, io, json
import numpy as np
import soundfile as sf
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
SOURCE=ROOT/'output/music/steel_shift'
SR=32000; BPM=140; BAR=240/BPM; BARS=48
frames=round(BARS*BAR*SR)
inputs={}; backing=np.zeros((frames,2),np.float32)
for p in sorted((SOURCE/'stems').glob('*.flac')):
    inputs[str(p.relative_to(ROOT))]=hashlib.sha256(p.read_bytes()).hexdigest()
    if p.stem=='riff':continue
    data,rate=sf.read(p,dtype='float32',always_2d=True)
    assert rate==SR
    backing+=data[:frames]
# No source stem or authored entry time is edited. Trim export tail outside the loop.
def wav(data):
    out=io.BytesIO();sf.write(out,data,SR,format='WAV',subtype='PCM_16');return out.getvalue()
def url(data):return 'data:audio/wav;base64,'+base64.b64encode(wav(data)).decode()
backing_bytes=wav(backing)
(HERE/'assets'/'song-background.wav').write_bytes(backing_bytes)
riff,rate=sf.read(SOURCE/'stems/riff.flac',dtype='float32',always_2d=True)
# Bars 8..12 are riffThemeALoop, including its authored D/D/Bb/C development.
parts={}; meta=[]
for i in range(8):
    start=round((8+i*.5)*BAR*SR); end=round((8+(i+1)*.5)*BAR*SR)
    data=riff[start:end].copy(); fade=64
    data[:fade]*=np.linspace(0,1,fade)[:,None]
    data[-fade:]*=np.linspace(1,0,fade)[:,None]
    parts['steel_riff_'+str(i)]=url(data)
    meta.append({'id':i,'source_bars':[8+i*.5,8+(i+1)*.5],'frames':len(data),'peak':float(np.max(np.abs(data)))})
(HERE/'song-assets.js').write_text('/* Derived local audio; source hashes in audio-manifest.json. */\nwindow.STEEL_AUDIO='+json.dumps({'backing':url(backing),'samples':parts},separators=(',',':'))+';\n')
(HERE/'audio-manifest.json').write_text(json.dumps({'source':'Цех горного короля: existing authored stems','bpm':BPM,'songBars':BARS,'localBars':4,'sampleRate':SR,'frames':frames,'duration':frames/SR,'unchangedVoices':[p.stem for p in sorted((SOURCE/'stems').glob('*.flac')) if p.stem!='riff'],'editedVoice':'riff','riffSourceBars':[8,12],'sampleEdgeFadeMs':2,'parts':meta,'sourceSha256':inputs,'backingPeak':float(np.max(np.abs(backing))),'scope':'13 authored stems continue as full-song PCM; only selected four-bar riff is reconstructed and transformed. Master differs from original mastered MP3.'},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'frames':frames,'seconds':frames/SR,'fixedVoices':13,'riffParts':len(parts),'backingPeak':float(np.max(np.abs(backing)))},indent=2))
