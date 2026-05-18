# python:3.11-bullseye already has gcc, g++, make built in
# This avoids needing build-essential from apt
FROM python:3.11-bullseye

WORKDIR /app

# Runtime libs needed by OpenCV / InsightFace
RUN apt-get update -o Acquire::Retries=5 -o Acquire::http::Timeout=60 && \
    apt-get install -y --no-install-recommends \
      libgl1 \
      libglib2.0-0 \
      libgomp1 && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --retries 5 -r requirements.txt

# Pre-download buffalo_sc model during build
RUN python -c "\
import insightface; \
model = insightface.app.FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider']); \
model.prepare(ctx_id=0, det_size=(320, 320)); \
print('buffalo_sc model downloaded and ready.')"

# Copy app source
COPY . .

# Expose default local port
EXPOSE 8000

# IMPORTANT:
# Use Render/Railway dynamic PORT variable in cloud
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
