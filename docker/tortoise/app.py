#!/usr/bin/env python

import os
import numpy as np
import soundfile as sf
import logging
import torch
from datetime import datetime
from flask import Flask, request, jsonify
from tortoise.api import TextToSpeech
from tortoise.utils.audio import load_voice

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

mounted_input_dir = "/mount/inputs"
tortoise_voice_dir = "/usr/local/lib/python3.10/dist-packages/tortoise/voices"

if os.path.exists(mounted_input_dir):
    if not os.path.islink(tortoise_voice_dir):
        os.makedirs(os.path.dirname(tortoise_voice_dir), exist_ok=True)
        if os.path.exists(tortoise_voice_dir):
            os.rename(tortoise_voice_dir, tortoise_voice_dir + "_bak")
        os.symlink(mounted_input_dir, tortoise_voice_dir)
        logging.info(f"Symlink created: {tortoise_voice_dir} -> {mounted_input_dir}")
else:
    logging.warning(f"{mounted_input_dir} not found — skipping symlink setup. Likely volume mount issue.")

if torch.cuda.is_available():
    os.environ["TORCH_DEVICE"] = "cuda"
    logging.info(f"CUDA Device: {torch.cuda.get_device_name(torch.cuda.current_device())}")
else:
    os.environ["TORCH_DEVICE"] = "cpu"
    logging.info("CUDA not available. Using CPU.")

tts = TextToSpeech()
app = Flask(__name__)

@app.route("/synthesize", methods=["POST"])
def synthesize():
    data = request.get_json()
    text = data.get("text")
    voice = data.get("voice")

    if not text or not voice:
        logging.error("Missing 'text' or 'voice' parameter")
        return jsonify({"error": "Missing 'text' or 'voice' parameter"}), 400

    try:
        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        voice_output_path = f"/mount/outputs/{voice}/"
        output_filename = f"{voice}-{timestamp}.wav"
        output_file_path = os.path.join(voice_output_path, output_filename)
        tmp_file_path = f"/tmp/{output_filename}"

        os.makedirs(voice_output_path, exist_ok=True)

        os.environ["TORCH_DEVICE"] = "cuda" if tts.device.type == "cuda" else "cpu"
        logging.info(f"Using device: {os.environ['TORCH_DEVICE']}")

        logging.info(f"Loading voice named '{voice}'")
        voice_samples, conditioning_latents = load_voice(voice)

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

        sf.write(tmp_file_path, pcm_audio, 22050)
        with open(tmp_file_path, 'rb') as src, open(output_file_path, 'wb') as dst:
            dst.write(src.read())
        os.remove(tmp_file_path)
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
