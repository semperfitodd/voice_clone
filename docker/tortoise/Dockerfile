FROM python:3.10-slim

ENV PYTORCH_ENABLE_MPS_FALLBACK=1

RUN apt-get update && apt-get install -y \
    git ffmpeg libsndfile1 libgl1 libglib2.0-0 \
    && apt-get clean

WORKDIR /app

RUN git clone https://github.com/neonbjb/tortoise-tts.git tortoise_app \
    && sed -i 's/transformers==4.31.0/transformers==4.28.1/' tortoise_app/requirements.txt \
    && rm -rf tortoise_app/tortoise/voices tortoise_app/examples

RUN pip install --upgrade pip \
    && pip install -r tortoise_app/requirements.txt \
    && pip install soundfile flask

RUN pip install --no-deps ./tortoise_app

COPY app.py /app/

ENTRYPOINT ["/app/app.py"]
