import io
import logging
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

from backend.app import create_app, preprocess_image
from backend.explanations import explain_prediction


class FixedModel:
    def __init__(self, score=0.9):
        self.score = score
        self.last_input = None

    def predict(self, inputs, verbose=0):
        self.last_input = inputs
        return np.array([[self.score]])


def image_bytes(mode="RGB", image_format="PNG", size=(24, 16)):
    image = Image.new(mode, size, 128 if mode == "L" else "white")
    stream = io.BytesIO()
    image.save(stream, format=image_format)
    stream.seek(0)
    return stream


class APITests(unittest.TestCase):
    def setUp(self):
        self.model = FixedModel()
        with patch("backend.app.build_explainer", return_value=None):
            self.app = create_app(self.model, {"TESTING": True})
        self.client = self.app.test_client()
        # Expected error-path tests do not need to print exception tracebacks.
        self.app.logger.setLevel(logging.CRITICAL)

    def upload(self, stream=None, filename="test.png"):
        return self.client.post(
            "/predict", data={"file": (stream or image_bytes(), filename)}
        )

    def test_health_does_not_load_model(self):
        with patch("backend.app.load_detector") as loader:
            result = self.client.get("/health")
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json["status"], "ok")
            self.assertTrue(result.json["model_loaded"])
            loader.assert_not_called()

    def test_missing_upload(self):
        self.assertEqual(self.client.post("/predict").status_code, 400)

    def test_empty_filename(self):
        self.assertEqual(self.upload(filename="").status_code, 400)

    def test_invalid_image(self):
        self.assertEqual(self.upload(io.BytesIO(b"not a PNG")).status_code, 400)

    def test_truncated_image(self):
        stream = io.BytesIO(image_bytes().getvalue()[:30])
        self.assertEqual(self.upload(stream).status_code, 400)

    def test_supported_formats(self):
        for fmt in ["PNG", "JPEG", "WEBP"]:
            with self.subTest(format=fmt):
                self.assertEqual(self.upload(image_bytes(image_format=fmt)).status_code, 200)

    def test_unsupported_gif_even_with_png_filename(self):
        self.assertEqual(self.upload(image_bytes(image_format="GIF")).status_code, 415)

    def test_request_limit(self):
        self.app.config["MAX_CONTENT_LENGTH"] = 30
        self.assertEqual(self.upload().status_code, 413)

    def test_pixel_limit(self):
        self.app.config["MAX_IMAGE_PIXELS"] = 100
        self.assertEqual(self.upload().status_code, 413)

    def test_label_mapping_and_confidence(self):
        for score, label, confidence in [
            (0.9, "Real", 90), (0.1, "Deepfake", 90),
            (0.5, "Deepfake", 50), (0, "Deepfake", 100), (1, "Real", 100),
        ]:
            with self.subTest(score=score):
                self.model.score = score
                response = self.upload()
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json["detection"], label)
                self.assertEqual(response.json["confidence"], confidence)
                self.assertIn("not proof", response.json["explanation"])
                self.assertIn("verify", response.json["advisory"])

    def test_configurable_threshold(self):
        self.app.config["REAL_THRESHOLD"] = 0.95
        self.assertEqual(self.upload().json["detection"], "Deepfake")

    def test_invalid_threshold_rejected(self):
        with self.assertRaises(ValueError):
            create_app(self.model, {"REAL_THRESHOLD": 1})

    def test_input_shape_and_scale(self):
        self.assertEqual(self.upload().status_code, 200)
        tensor = self.model.last_input
        self.assertEqual(tensor.shape, (1, 224, 224, 3))
        self.assertEqual(tensor.dtype, np.float32)
        self.assertEqual(float(tensor.max()), 255)

    def test_grayscale_and_rgba_conversion(self):
        for mode in ["L", "RGBA"]:
            with self.subTest(mode=mode):
                self.assertEqual(self.upload(image_bytes(mode=mode)).status_code, 200)
                self.assertEqual(self.model.last_input.shape, (1, 224, 224, 3))

    def test_exif_orientation_is_applied(self):
        image = Image.new("RGB", (10, 20), "black")
        for x in range(10):
            for y in range(10):
                image.putpixel((x, y), (255, 0, 0))
        image.getexif()[274] = 6  # Rotate 90 degrees clockwise.
        tensor = preprocess_image(image)
        self.assertGreater(float(tensor[0, 112, 200, 0]), 240)
        self.assertLess(float(tensor[0, 112, 20, 0]), 10)

    def test_model_load_failure_returns_503(self):
        self.app.extensions["detector"] = None
        with patch("backend.app.load_detector", side_effect=OSError("missing checkpoint")):
            result = self.upload()
        self.assertEqual(result.status_code, 503)
        self.assertNotIn("confidence", result.json)

    def test_inference_failure_returns_500(self):
        with patch.object(self.model, "predict", side_effect=RuntimeError("broken")):
            self.assertEqual(self.upload().status_code, 500)

    def test_invalid_scores_are_rejected(self):
        for score in [np.nan, np.inf, -0.1, 1.1]:
            with self.subTest(score=score):
                self.model.score = score
                self.assertEqual(self.upload().status_code, 500)

    def test_wrong_output_shape_is_rejected(self):
        with patch.object(self.model, "predict", return_value=np.array([[0.2, 0.8]])):
            self.assertEqual(self.upload().status_code, 500)

    def test_cloud_failure_falls_back_to_local_guidance(self):
        def failing_generator(_prompt):
            raise RuntimeError("unavailable")
        self.app.extensions["text_generator"] = failing_generator
        result = self.upload()
        self.assertEqual(result.status_code, 200)
        self.assertIn("not proof", result.json["explanation"])

    def test_cloud_receives_text_only_and_keeps_advisory(self):
        prompts = []
        def generator(prompt):
            prompts.append(prompt)
            return "Check the original publisher."
        result = explain_prediction("Real", 80, generator)
        self.assertIn("not proof", result)
        self.assertIn("have not seen the image", prompts[0])
        self.assertIn("Check the original publisher", result)

    def test_cors_origin_policy(self):
        allowed = self.client.get("/health", headers={"Origin": "http://127.0.0.1:5173"})
        self.assertEqual(allowed.headers["Access-Control-Allow-Origin"], "http://127.0.0.1:5173")
        denied = self.client.get("/health", headers={"Origin": "https://unrelated.example"})
        self.assertNotIn("Access-Control-Allow-Origin", denied.headers)


if __name__ == "__main__":
    unittest.main()
