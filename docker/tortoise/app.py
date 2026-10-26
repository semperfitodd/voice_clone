#!/usr/bin/env python

import logging
import os
import threading
from datetime import datetime

import numpy as np
import soundfile as sf
import torch
from flask import Flask, jsonify, request, send_from_directory

from auth import require_auth, safe_filename

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

tortoise_voice_dir = os.environ.get(
    "TORTOISE_VOICE_DIR",
    "/usr/local/lib/python3.10/dist-packages/tortoise/voices",
)
os.makedirs(tortoise_voice_dir, exist_ok=True)

if torch.cuda.is_available():
    os.environ["TORCH_DEVICE"] = "cuda"
    logging.info("CUDA available")
else:
    os.environ["TORCH_DEVICE"] = "cpu"
    logging.info("CUDA not available. Using CPU.")

_tts = None
_tts_lock = threading.Lock()

app = Flask(__name__)


def get_tts():
    global _tts
    if _tts is None:
        with _tts_lock:
            if _tts is None:
                from tortoise.api import TextToSpeech

                _tts = TextToSpeech()
                if torch.cuda.is_available():
                    logging.info("Tortoise TTS loaded on GPU")
                else:
                    logging.info("Tortoise TTS loaded on CPU")
    return _tts


def run_tts(text, safe_email, user_inputs_dir, user_outputs_dir):
    try:
        tts = get_tts()
        os.makedirs(user_outputs_dir, exist_ok=True)
        output_filename = f"{safe_email}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.wav"
        output_file_path = os.path.join(user_outputs_dir, output_filename)
        tmp_file_path = f"/tmp/{output_filename}"

        os.environ["TORCH_DEVICE"] = "cuda" if tts.device.type == "cuda" else "cpu"
        voice_symlink_path = os.path.join(tortoise_voice_dir, safe_email)
        if not os.path.isdir(user_inputs_dir):
            logging.warning("Voice inputs missing for synthesis job")
            return
        if not os.path.islink(voice_symlink_path):
            try:
                os.symlink(user_inputs_dir, voice_symlink_path)
            except OSError:
                logging.exception("Failed to link voice directory")
                return

        from tortoise.utils.audio import load_voice

        voice_samples, conditioning_latents = load_voice(safe_email)
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
        with open(tmp_file_path, "rb") as src, open(output_file_path, "wb") as dst:
            dst.write(src.read())
        os.remove(tmp_file_path)
    except Exception:
        logging.exception("Synthesis job failed")


@app.route("/synthesize", methods=["GET", "POST"])
def synthesize():
    if request.method == "GET":
        return "Health check OK", 200
    return _synthesize_post()


@require_auth
def _synthesize_post():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 415
    data = request.get_json(silent=True) or {}
    text = data.get("text")
    if not text or not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Missing or invalid 'text' parameter"}), 400
    safe_email = request.user_email
    user_inputs_dir = os.path.join("/mount", safe_email, "inputs")
    user_outputs_dir = os.path.join("/mount", safe_email, "outputs")
    thread = threading.Thread(
        target=run_tts,
        args=(text.strip(), safe_email, user_inputs_dir, user_outputs_dir),
    )
    thread.start()
    return jsonify({"message": "Processing started"}), 202


@app.route("/input", methods=["POST"])
@require_auth
def receive_inputs():
    if not request.content_type or not request.content_type.startswith("multipart/form-data"):
        return jsonify({"error": "Content-Type must be multipart/form-data"}), 415
    safe_email = request.user_email
    user_inputs_dir = os.path.join("/mount", safe_email, "inputs")
    try:
        os.makedirs(user_inputs_dir, exist_ok=True)
    except OSError:
        logging.exception("Failed to create inputs directory")
        return jsonify({"error": "Failed to store upload"}), 500
    wav_files = request.files.getlist("file")
    if not wav_files:
        return jsonify({"error": "No 'file' fields provided"}), 400
    saved_count = 0
    existing = [
        fname
        for fname in os.listdir(user_inputs_dir)
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
            continue
        dest_name = f"{safe_email}_{next_index}.wav"
        dest_path = os.path.join(user_inputs_dir, dest_name)
        try:
            wav.save(dest_path)
            saved_count += 1
            next_index += 1
        except OSError:
            logging.exception("Failed to save upload")
            return jsonify({"error": "Failed to store upload"}), 500
    return jsonify({"message": f"Saved {saved_count} file(s)"}), 201


@app.route("/outputs", methods=["GET"])
@require_auth
def list_outputs():
    safe_email = request.user_email
    user_outputs_dir = os.path.join("/mount", safe_email, "outputs")
    items = []
    if os.path.isdir(user_outputs_dir):
        for fname in sorted(os.listdir(user_outputs_dir)):
            if fname.lower().endswith(".wav"):
                items.append({"filename": fname, "url": f"/outputs/{fname}"})
    return jsonify(items), 200


@app.route("/outputs/<filename>", methods=["GET"])
@require_auth
def serve_output(filename):
    safe_name = safe_filename(filename)
    if not safe_name:
        return jsonify({"error": "Invalid filename"}), 400
    safe_email = request.user_email
    user_outputs_dir = os.path.join("/mount", safe_email, "outputs")
    return send_from_directory(user_outputs_dir, safe_name, as_attachment=False)


if __name__ == "__main__":
    logging.info("Starting Flask app on port 5000")
    app.run(host="0.0.0.0", port=5000)
