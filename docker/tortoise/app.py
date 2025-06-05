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

tortoise_voice_dir = "/usr/local/lib/python3.10/dist-packages/tortoise/voices"

os.makedirs(tortoise_voice_dir, exist_ok=True)

if torch.cuda.is_available():
    os.environ["TORCH_DEVICE"] = "cuda"
    logging.info(f"CUDA Device: {torch.cuda.get_device_name(torch.cuda.current_device())}")
else:
    os.environ["TORCH_DEVICE"] = "cpu"
    logging.info("CUDA not available. Using CPU.")

tts = TextToSpeech()
app = Flask(__name__)

@app.route("/synthesize", methods=["GET", "POST"])
def synthesize():
    if request.method == "GET":
        return "Health check OK", 200

    if not request.is_json:
        logging.error("Unsupported content type for POST request")
        return jsonify({"error": "Content-Type must be application/json"}), 415

    data = request.get_json()
    text = data.get("text")
    voice = data.get("voice")

    if not text or not voice:
        logging.error("Missing 'text' or 'voice' parameter")
        return jsonify({"error": "Missing 'text' or 'voice' parameter"}), 400

    safe_email = voice.strip().lower().replace("/", "_").replace("..", "_")
    user_inputs_dir = os.path.join("/mount", safe_email, "inputs")
    user_outputs_dir = os.path.join("/mount", safe_email, "outputs")

    voice_symlink_path = os.path.join(tortoise_voice_dir, safe_email)
    if os.path.isdir(user_inputs_dir):
        if not os.path.islink(voice_symlink_path):
            try:
                os.symlink(user_inputs_dir, voice_symlink_path)
                logging.info(f"Symlink created: {voice_symlink_path} -> {user_inputs_dir}")
            except Exception as e:
                logging.error(f"Failed to create symlink for voice '{safe_email}': {e}")
                return jsonify({"error": f"Voice directory setup failed: {str(e)}"}), 500
    else:
        logging.error(f"User inputs directory not found: {user_inputs_dir}")
        return jsonify({"error": f"No inputs found for '{safe_email}'"}), 404

    try:
        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        os.makedirs(user_outputs_dir, exist_ok=True)
        output_filename = f"{safe_email}-{timestamp}.wav"
        output_file_path = os.path.join(user_outputs_dir, output_filename)
        tmp_file_path = f"/tmp/{output_filename}"

        os.environ["TORCH_DEVICE"] = "cuda" if tts.device.type == "cuda" else "cpu"
        logging.info(f"Using device: {os.environ['TORCH_DEVICE']}")

        logging.info(f"Loading voice samples for '{safe_email}'")
        voice_samples, conditioning_latents = load_voice(safe_email)

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

@app.route("/input", methods=["POST"])
def receive_inputs():
    """
    Expects a multipart/form-data POST with:
      • form-field “email” (e.g. “alice@example.com”)
      • one or more form-field “file” entries, each a .wav
    Saves files under /mount/{email}/inputs/ as {email}_0.wav, {email}_1.wav, etc.
    """
    if not request.content_type.startswith("multipart/form-data"):
        logging.error("Unsupported content type for POST /input")
        return jsonify({"error": "Content-Type must be multipart/form-data"}), 415

    email = request.form.get("email", "").strip().lower()
    if not email:
        logging.error("Missing 'email' field in /input")
        return jsonify({"error": "Missing 'email' field"}), 400

    safe_email = email.replace("/", "_").replace("..", "_")
    user_inputs_dir = os.path.join("/mount", safe_email, "inputs")

    try:
        os.makedirs(user_inputs_dir, exist_ok=True)
    except Exception as e:
        logging.exception("Could not create user inputs directory")
        return jsonify({"error": str(e)}), 500

    wav_files = request.files.getlist("file")
    if not wav_files:
        logging.error("No 'file' fields found in /input")
        return jsonify({"error": "No 'file' fields provided"}), 400

    saved_paths = []
    existing = [
        fname for fname in os.listdir(user_inputs_dir)
        if fname.startswith(f"{safe_email}_") and fname.lower().endswith(".wav")
    ]
    existing_indices = []
    for fname in existing:
        try:
            idx = int(fname.replace(f"{safe_email}_", "").replace(".wav", ""))
            existing_indices.append(idx)
        except ValueError:
            continue
    next_index = max(existing_indices) + 1 if existing_indices else 0

    for wav in wav_files:
        filename = wav.filename or ""
        if not filename.lower().endswith(".wav"):
            logging.warning(f"Skipping non-wav file: {filename}")
            continue

        dest_name = f"{safe_email}_{next_index}.wav"
        dest_path = os.path.join(user_inputs_dir, dest_name)
        try:
            wav.save(dest_path)
            saved_paths.append(dest_path)
            logging.info(f"Saved {filename} → {dest_path}")
            next_index += 1
        except Exception as e:
            logging.exception(f"Failed to save {filename}")
            return jsonify({"error": f"Failed to save {filename}: {str(e)}"}), 500

    return jsonify({
        "message": f"Saved {len(saved_paths)} file(s) for {safe_email}",
        "saved_files": saved_paths
    }), 201

if __name__ == "__main__":
    logging.info("Starting Flask app on port 5000")
    app.run(host="0.0.0.0", port=5000)
