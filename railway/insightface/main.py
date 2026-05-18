"""
EventSnap InsightFace Service
Runs on Railway. Exposes HTTP endpoints for face embedding generation.
Uses buffalo_sc model (512-dim embeddings) — lightweight, fits Railway free tier RAM.

Optional env vars:
  INSIGHTFACE_API_KEY  — if set, all endpoints require `x-api-key: <key>` header
  DET_SIZE             — detection resolution, e.g. "640,640" (default: 640,640)
  MIN_SELFIE_DET_SCORE — minimum det_score for selfie acceptance (default: 0.60)
  MAX_IMAGE_BYTES      — maximum upload size in bytes (default: 20971520 = 20MB)
"""

import os
from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
import insightface
import numpy as np
import cv2
from PIL import Image
import io
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="EventSnap InsightFace Service", version="1.1.0")

# ── Optional API key authentication ─────────────────────────────────────────
_API_KEY = os.environ.get("INSIGHTFACE_API_KEY", "")


async def verify_api_key(request: Request):
    if not _API_KEY:
        return  # No key configured — open access (suitable for private Railway network)
    provided = request.headers.get("x-api-key", "")
    if provided != _API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ── Detection size from env ───────────────────────────────────────────────────
_det_size_env = os.environ.get("DET_SIZE", "640,640")
try:
    _w, _h = [int(x.strip()) for x in _det_size_env.split(",")]
    DET_SIZE = (_w, _h)
except Exception:
    DET_SIZE = (640, 640)

# ── Load buffalo_sc model once at startup ─────────────────────────────────────
# buffalo_sc: ~80MB RAM vs buffalo_l (~500MB) — fits Railway free tier.
logger.info(f"Loading InsightFace buffalo_sc model (det_size={DET_SIZE})…")
face_model = insightface.app.FaceAnalysis(
    name="buffalo_sc",
    providers=["CPUExecutionProvider"]
)
face_model.prepare(ctx_id=0, det_size=DET_SIZE)
logger.info("Model loaded successfully.")


def decode_image(image_bytes: bytes) -> np.ndarray:
    """Decode image bytes to OpenCV BGR array."""
    if not image_bytes:
        raise ValueError("Empty image bytes")
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)


@app.get("/health")
def health():
    return {"status": "ok", "model": "buffalo_sc", "det_size": list(DET_SIZE)}


@app.post("/embed", dependencies=[Depends(verify_api_key)])
async def embed_face(image: UploadFile = File(...)):
    """
    Generate a 512-dim face embedding from a selfie image.
    Returns the embedding of the largest (most prominent) face found.
    Used for: guest selfie matching.
    """
    contents = await image.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image file")

    MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(20 * 1024 * 1024)))  # 20MB default
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large ({len(contents) // (1024*1024)}MB). Maximum is {MAX_IMAGE_BYTES // (1024*1024)}MB."
        )

    try:
        img_array = decode_image(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

    faces = face_model.get(img_array)

    if not faces:
        raise HTTPException(status_code=422, detail="No face detected in image")

    # Use the largest face area — good for selfies where the subject is prominent
    largest_face = max(
        faces,
        key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
    )

    MIN_SELFIE_DET_SCORE = float(os.environ.get("MIN_SELFIE_DET_SCORE", "0.60"))
    if hasattr(largest_face, "det_score") and largest_face.det_score < MIN_SELFIE_DET_SCORE:
        raise HTTPException(
            status_code=422,
            detail=f"Face not clear enough for matching (score: {largest_face.det_score:.2f}). "
                   "Please upload a clearer selfie with good lighting and no obstructions."
        )

    embedding = largest_face.normed_embedding.tolist()
    bbox = [float(x) for x in largest_face.bbox.tolist()]
    det_score = float(largest_face.det_score) if hasattr(largest_face, "det_score") else None

    return JSONResponse({
        "embedding": embedding,
        "face_count": len(faces),
        "embedding_dim": len(embedding),
        "bbox": bbox,
        "det_score": det_score,
    })


@app.post("/embed-batch", dependencies=[Depends(verify_api_key)])
async def embed_batch(image: UploadFile = File(...)):
    """
    Embed ALL faces found in an image.
    Returns all embeddings (one per person in the photo) with bbox and detection score.
    Used for: event photo indexing (group shots have multiple faces).
    """
    contents = await image.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image file")

    MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(20 * 1024 * 1024)))  # 20MB default
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large ({len(contents) // (1024*1024)}MB). Maximum is {MAX_IMAGE_BYTES // (1024*1024)}MB."
        )

    try:
        img_array = decode_image(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

    faces = face_model.get(img_array)

    if not faces:
        return JSONResponse({"embeddings": [], "face_count": 0, "faces": []})

    embeddings = [f.normed_embedding.tolist() for f in faces]
    faces_meta = [
        {
            "bbox": [float(x) for x in f.bbox.tolist()],
            "det_score": float(f.det_score) if hasattr(f, "det_score") else None,
        }
        for f in faces
    ]

    return JSONResponse({
        "embeddings": embeddings,
        "face_count": len(faces),
        "embedding_dim": len(embeddings[0]) if embeddings else 0,
        "faces": faces_meta,
    })


if __name__ == "__main__":
    import os
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000))
    )
