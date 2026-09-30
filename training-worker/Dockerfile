FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/.cache/huggingface \
    TRANSFORMERS_CACHE=/models/.cache/huggingface \
    TRAINING_ROOT=/models/cortex-training

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN python3 -m pip install --break-system-packages --upgrade pip && python3 -m pip install --break-system-packages -r requirements.txt

COPY app.py .
RUN mkdir -p /models/cortex-training /models/.cache/huggingface

EXPOSE 8080
CMD ["python3","-m","uvicorn","app:app","--host","0.0.0.0","--port","8080"]
