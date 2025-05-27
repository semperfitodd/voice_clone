import os
import numpy as np
import soundfile as sf
import logging
from flask import Flask, request, jsonify
from tortoise.api import TextToSpeech
from tortoise.utils.audio import load_voice

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
tts = TextToSpeech()

@app.route("/synthesize", methods=["POST"])
def synthesize():
    data = request.get_json()
    text = data.get("text")
    voice = data.get("voice")

    if not text or not voice:
        logging.error("Missing 'text' or 'voice' parameter")
        return jsonify({"error": "Missing 'text' or 'voice' parameter"}), 400

    try:
        voice_input_path = f"/app/{voice}/input/"
        voice_output_path = f"/app/{voice}/output/"
        output_file_path = os.path.join(voice_output_path, f"{voice}.wav")

        os.makedirs(voice_output_path, exist_ok=True)

        os.environ["TORCH_DEVICE"] = "cuda" if tts.device.type == "cuda" else "cpu"
        logging.info(f"Using device: {os.environ['TORCH_DEVICE']}")

        logging.info(f"Loading voice from {voice_input_path}")
        voice_samples, conditioning_latents = load_voice(voice_input_path)

        logging.info("Starting synthesis")
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
        sf.write(output_file_path, pcm_audio, 22050)
        logging.info(f"Synthesis complete. Output written to {output_file_path}")

        return jsonify({
            "message": "Synthesis complete",
            "output_file": output_file_path
        })
    except Exception as e:
        logging.exception("Error during synthesis")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    logging.info("Starting Flask app on port 5000")
    app.run(host="0.0.0.0", port=5000)
