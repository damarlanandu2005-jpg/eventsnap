# python:3.11-bullseye already has gcc, g++, make built in
# This avoids needing build-essential from apt (which pulls in cmake and causes mirror failures)
FROM python:3.11-bullseye

WORKDIR /app

# Only install small runtime libs needed by OpenCV
# No build tools needed — they're already in the base image
RUN apt-get update -o Acquire::Retries=5 -o Acquire::http::Timeout=60 && \
    apt-get install -y --no-install-recommends \
      libgl1 \
      libglib2.0-0 \
      libgomp1 && \
    rm -rf /var/lib/apt/lists/*

# Upgrade pip then install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --retries 5 -r requirements.txt

# Download buffalo_sc model at build time (lightweight, fits Railway free tier)
RUN python -c "\
import insightface; \
model = insightface.app.FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider']); \
model.prepare(ctx_id=0, det_size=(320, 320)); \
print('buffalo_sc model downloaded and ready.')"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
