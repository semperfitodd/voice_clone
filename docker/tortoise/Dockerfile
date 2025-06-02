FROM nvidia/cuda:11.8.0-runtime-ubuntu22.04

RUN apt-get update && \
    apt-get install -y python3.10 python3-pip git ffmpeg libsndfile1 libgl1 libglib2.0-0 && \
    ln -s /usr/bin/python3.10 /usr/bin/python && \
    apt-get clean

WORKDIR /app

RUN git clone https://github.com/neonbjb/tortoise-tts.git tortoise_app && \
    sed -i 's/transformers==4.31.0/transformers==4.28.1/' tortoise_app/requirements.txt && \
    rm -rf tortoise_app/tortoise/voices tortoise_app/examples

RUN pip install --upgrade pip && \
    pip install torch==2.1.2+cu118 torchvision --extra-index-url https://download.pytorch.org/whl/cu118 && \
    pip install -r tortoise_app/requirements.txt && \
    pip install soundfile flask && \
    pip install --no-deps ./tortoise_app

COPY app.py /app/

CMD ["python", "/app/app.py"]
