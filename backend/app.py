"""Local image-screening API. Run with python backend/app.py."""
import io
import os
import threading
import warnings
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.exceptions import RequestEntityTooLarge

try:
    from .explanations import build_explainer, explain_prediction
    from .attention import build_attention_model, explain_attention
    from .vision import build_visual_reviewer, review_image
except ImportError:
    from explanations import build_explainer, explain_prediction
    from attention import build_attention_model, explain_attention
    from vision import build_visual_reviewer, review_image

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "AVIF"}


def load_detector(path):
    from tensorflow.keras.models import load_model
    return load_model(path, compile=False)


def preprocess_image(image):
    """The saved EfficientNet includes rescaling: keep pixels in [0, 255]."""
    image = ImageOps.exif_transpose(image).convert("RGB").resize((224, 224))
    return np.expand_dims(np.asarray(image, dtype=np.float32), axis=0)


def create_app(model=None, config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        MODEL_PATH=os.getenv("MODEL_PATH", str(BASE_DIR / "best_subset_model.h5")),
        MAX_CONTENT_LENGTH=int(os.getenv("MAX_UPLOAD_MB", "8")) * 1024 * 1024,
        MAX_IMAGE_PIXELS=20_000_000,
        REAL_THRESHOLD=float(os.getenv("REAL_THRESHOLD", "0.5")),
        IBM_VISION_REQUESTED=os.getenv('ENABLE_IBM_VISION', '0') == '1',
        CORS_ORIGINS=os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(","),
    )
    if config:
        app.config.update(config)
    if not 0 < app.config["REAL_THRESHOLD"] < 1:
        raise ValueError("REAL_THRESHOLD must be between 0 and 1")
    model_path = Path(app.config["MODEL_PATH"]).expanduser()
    if not model_path.is_absolute():
        model_path = BASE_DIR / model_path
    app.config["MODEL_PATH"] = str(model_path)
    CORS(app, resources={r"/*": {"origins": app.config["CORS_ORIGINS"]}})
    app.extensions["detector"] = model
    app.extensions["attention_model"] = None
    app.extensions["text_generator"] = build_explainer()
    app.extensions["visual_reviewer"] = build_visual_reviewer()
    lock = threading.Lock()

    def get_model():
        if app.extensions["detector"] is None:
            app.extensions["detector"] = load_detector(app.config["MODEL_PATH"])
        return app.extensions["detector"]

    @app.get("/health")
    def health():
        return jsonify(
            status="ok",
            model_file_exists=model_path.is_file(),
            model_loaded=app.extensions["detector"] is not None,
            ibm_vision_enabled=app.extensions["visual_reviewer"] is not None,
            ibm_vision_requested=app.config['IBM_VISION_REQUESTED'],
            ibm_text_enabled=app.extensions["text_generator"] is not None,
        )

    @app.errorhandler(RequestEntityTooLarge)
    def too_large(_error):
        return jsonify(error="Upload exceeds the configured size limit."), 413

    @app.post("/predict")
    def predict():
        if "file" not in request.files:
            return jsonify(error="No file uploaded. Use multipart field 'file'."), 400
        upload = request.files["file"]
        if not upload.filename:
            return jsonify(error="Choose an image file."), 400
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(upload.read())) as image:
                    if image.format not in ALLOWED_FORMATS:
                        return jsonify(error="Unsupported image format. Use JPEG, PNG, WEBP or AVIF."), 415
                    if image.width * image.height > app.config["MAX_IMAGE_PIXELS"]:
                        return jsonify(error="Image dimensions exceed the pixel limit."), 413
                    image.load()
                    source_image = ImageOps.exif_transpose(image).convert('RGB').copy()
                    input_data = preprocess_image(image)
        except (Image.DecompressionBombError, Image.DecompressionBombWarning):
            return jsonify(error="Image dimensions exceed the pixel limit."), 413
        except (UnidentifiedImageError, OSError, ValueError):
            return jsonify(error="The upload is not a readable image."), 400

        try:
            with lock:
                detector = get_model()
        except Exception:
            app.logger.exception("Unable to load the detector")
            return jsonify(error="Model unavailable. Check MODEL_PATH and dependencies."), 503
        try:
            with lock:
                prediction = np.asarray(detector.predict(input_data, verbose=0))
            if prediction.size != 1:
                raise ValueError("Expected one sigmoid output")
            score = float(prediction.reshape(-1)[0])
            if not np.isfinite(score) or not 0 <= score <= 1:
                raise ValueError("Invalid model score")
        except Exception:
            app.logger.exception("Image inference failed")
            return jsonify(error="The model could not analyze this image."), 500

        label = "Real" if score > app.config["REAL_THRESHOLD"] else "Deepfake"
        confidence = round((score if label == "Real" else 1 - score) * 100, 2)
        visual_evidence = None
        try:
            with lock:
                if app.extensions["attention_model"] is None:
                    app.extensions["attention_model"] = build_attention_model(detector)
                visual_evidence = explain_attention(
                    detector, app.extensions["attention_model"], input_data, label, source_image
                )
        except Exception:
            app.logger.warning("Model attention could not be computed; prediction is still available.")
        visual_review = review_image(source_image, app.extensions['visual_reviewer'])
        if visual_review is None and app.config['IBM_VISION_REQUESTED']:
            visual_review = {
                'status': 'unavailable', 'provider': 'IBM Watsonx',
                'error': 'IBM visual review is enabled but not connected. Check the API key, workspace and vision model configuration.',
            }
        if visual_review and visual_review['status'] == 'success':
            explanation = visual_review['explanation']
        else:
            explanation = explain_prediction(
                label, confidence, app.extensions["text_generator"], evidence=visual_evidence
            )
        return jsonify(
            detection=label,
            confidence=confidence,
            explanation=explanation,
            visual_evidence=visual_evidence,
            visual_review=visual_review,
            advisory="Model prediction only; verify the source before trusting or sharing.",
        )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5002")))
