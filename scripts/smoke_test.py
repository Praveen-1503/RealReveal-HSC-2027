"""Operational smoke test using real weights; not a detection benchmark."""
import io
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app import create_app


def main():
    app = create_app(config={"TESTING": True})
    client = app.test_client()
    assert client.get("/health").status_code == 200
    for path in sorted((ROOT / "samples" / "images").iterdir()):
        response = client.post(
            "/predict", data={"file": (io.BytesIO(path.read_bytes()), path.name)}
        )
        assert response.status_code == 200, response.get_json()
        result = response.get_json()
        assert result["detection"] in {"Real", "Deepfake"}
        assert math.isfinite(result["confidence"]) and 0 <= result["confidence"] <= 100
        assert result["explanation"] and result["advisory"]
        print(path.name, result["detection"], result["confidence"])
    assert client.get("/health").get_json()["model_loaded"]
    print("Real-checkpoint smoke test passed (3 unlabeled fixtures).")


if __name__ == "__main__":
    main()
