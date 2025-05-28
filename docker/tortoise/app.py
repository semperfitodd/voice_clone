import os
import numpy as np
import soundfile as sf
from flask import Flask, request, jsonify
from tortoise.api import TextToSpeech
from tortoise.utils.audio import load_voice

app = Flask(__name__)
tts = TextToSpeech()

@app.route("/synthesize", methods=["POST"])
def synthesize():
    data = request.get_json()
    text = data.get("text")
    voice = data.get("voice")

    if not text or not voice:
        return jsonify({"error": "Missing 'text' or 'voice' parameter"}), 400

    try:
        # Construct paths
        voice_input_path = f"/app/{voice}/input/"
        voice_output_path = f"/app/{voice}/output/"
        output_file_path = os.path.join(voice_output_path, f"{voice}.wav")

        # Ensure output directory exists
        os.makedirs(voice_output_path, exist_ok=True)

        # Patch the environment so load_voice reads from the correct dir
        os.environ["TORCH_DEVICE"] = "cuda" if tts.device.type == "cuda" else "cpu"
        voice_samples, conditioning_latents = load_voice(voice_input_path)

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
            cvvp_amount=0.0,
        )

        pcm_audio = np.squeeze(pcm_audio)

        # Write to output file
        sf.write(output_file_path, pcm_audio, 22050)

        return jsonify({
            "message": "Synthesis complete",
            "output_file": output_file_path
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
