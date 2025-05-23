import sys
sys.path.insert(0, '/app/tortoise_app')

import numpy as np
import soundfile as sf
from tortoise.api         import TextToSpeech
from tortoise.utils.audio import load_voice

text, voice = sys.argv[1], sys.argv[2]

tts = TextToSpeech()
voice_samples, conditioning_latents = load_voice(voice)

pcm_audio = tts.tts_with_preset(
    text,
    "high_quality",
    voice_samples=voice_samples,
    conditioning_latents=conditioning_latents,
    num_autoregressive_samples=64,
    temperature=0.7,
    top_p=0.9,
    repetition_penalty=2.0,
    length_penalty=1.0,
    cond_free_k=2,
    cvvp_amount=0.0,  # disable CVVP
)

pcm_audio = np.squeeze(pcm_audio)

out_path = f"/app/outputs/{voice}.wav"
sf.write(out_path, pcm_audio, 22050)

print(f"Synthesis complete → {out_path}")
