# RealReveal

**Check an image before you trust or share it.** RealReveal is a research prototype for the **Digital Safety & Cyber Fraud Awareness** theme of Hack for Social Cause 2027. It combines a React web interface, a Flask API and a Chrome extension with an EfficientNetB0 image classifier.

The prototype returns a `Real` or `Deepfake` prediction, a model score and verification guidance. A prediction can be wrong; the score is not a calibrated probability or proof of authenticity. It does not verify the claim or context accompanying a genuine image.

## Submission checklist

| Requirement | Included material |
| --- | --- |
| Source and setup instructions | `frontend/`, `backend/`, `chrome-extension/`, `training/`, this README |
| Environment variables | `backend/.env.example`, `frontend/.env.example` |
| Technical design and architectural diagrams | [Technical design](docs/TECHNICAL_DESIGN.md) |
| Sample data | [Generated fixtures](samples/README.md), `samples/images/` |
| Test cases | [Test guide](docs/TEST_CASES.md), `tests/` |
| License | [MIT](LICENSE), [third-party notices](THIRD_PARTY_NOTICES.md) |
| Model details and limits | [Model card](docs/MODEL_CARD.md) |

## What works

- Upload JPEG, PNG or WEBP images through the web app.
- Run inference with the included `backend/best_subset_model.h5` checkpoint.
- Right-click an HTTP/HTTPS image in Chrome and select **Verify with RealReveal**.
- View a classification, model score and general source-verification advice.
- Run deterministic API tests without TensorFlow or any cloud credentials.
- Optionally request additional text guidance from your own IBM Watsonx project. The local demo works without it.

Video/audio detection, spectral analysis, automatic retraining, multilingual lessons and NGO pilots are not implemented. No independently verified accuracy percentage is claimed.

## Prerequisites

- Python **3.11–3.13**, a virtual environment, and pip. The checkpoint was tested here with Python 3.13.3, TensorFlow 2.20.0 and Keras 3.13.2. Python 3.14 is not the supported setup.
- Node.js **22.12+** (or a newer supported LTS release) and npm; use the committed frontend lockfile.
- A modern Chrome browser for the optional extension.
- Enough disk space for TensorFlow and the approximately 48 MB inference checkpoint. A CPU is sufficient; the first request includes model loading and may be slower.

## Setup and run

Clone this repository and change into its root. Run all commands below from that root unless noted.

### 1. Backend

```sh
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
python backend/app.py
```

On Windows, use `py -3.13 -m venv .venv` and `.venv\Scripts\activate` instead. Python 3.11 or 3.12 can also be selected when creating the environment. The `cp` command can be replaced by copying the example file in your file manager.

The API listens on `http://127.0.0.1:5002`. Open `http://127.0.0.1:5002/health` to check the process. `model_loaded` stays false until the first successful prediction; `/health` alone does not validate inference. No API keys are required.

### 2. Frontend (second terminal)

```sh
cd frontend
npm ci
cp .env.example .env
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://127.0.0.1:5173`, choose an image, and review the result. Keep the backend terminal running. JPEG, PNG and WEBP are accepted; the default upload cap is 8 MB and decoded images are limited to 20 million pixels. Use the included synthetic fixtures to exercise the upload flow; they are not labeled accuracy benchmarks.

### 3. Chrome extension (optional)

1. Keep the API running at `http://127.0.0.1:5002`.
2. Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `chrome-extension/`.
3. Open an ordinary HTTP/HTTPS page containing an image, reload it after installing, then right-click the image and select **Verify with RealReveal**.
4. The extension worker downloads the chosen image and submits it to your local API. Only a user-selected image is submitted; there is no background image scanning.

Chrome internal pages, extension-store pages, `file:` URLs, `blob:` images and sites that block image downloads may not work. Upload a saved image in the web app in those cases. The extension requests broad HTTP/HTTPS host access because the user can choose an image on any website. It is intended for a local demo. If you change the API port, update `API_BASE_URL` in `chrome-extension/background.js` and reload the extension.

## Environment variables

Backend variables are read from `backend/.env`. Existing process variables take precedence. Copy only `.env.example`; never commit real credentials.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MODEL_PATH` | `best_subset_model.h5` under `backend/` | Absolute path or path relative to `backend/` |
| `HOST` | `127.0.0.1` | Local development bind address |
| `PORT` | `5002` | Local development API port |
| `MAX_UPLOAD_MB` | `8` | Maximum multipart request size in MiB, including form overhead |
| `REAL_THRESHOLD` | `0.5` | Sigmoid score strictly above this value maps to `Real` |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed web origins |
| `ENABLE_WATSONX` | `0` | Set `1` only for optional cloud text guidance |
| `IBM_API_KEY` | empty | Your own Watsonx API key; optional integration only |
| `IBM_REGION` | `us-south` | Your Watsonx service region |
| `IBM_PROJECT_ID` / `IBM_SPACE_ID` | empty | Workspace identifier; space takes precedence |
| `IBM_MODEL_ID` | empty | A supported text model available in your own workspace |

The frontend reads `VITE_API_BASE_URL` from `frontend/.env`, defaulting to `http://127.0.0.1:5002`. Restart Vite after changing it. Variables prefixed with `VITE_` are public client configuration and must never hold secrets.

For optional Watsonx guidance, install `backend/requirements-watsonx.txt` and configure the IBM variables. This integration is optional and has not been validated against a live account in the submission checks. The prompt sends the prediction label and score, never image bytes. Generated text is general advice, not visual evidence. Failures fall back to local guidance.

## API example

```sh
curl http://127.0.0.1:5002/health
curl -X POST http://127.0.0.1:5002/predict \
  -F 'file=@samples/images/gradient.png'
```

Successful responses contain `detection`, `confidence`, `explanation` and `advisory`. The label and score depend on the image and checkpoint; no fixed response is promised for the generated fixture.

Status codes: `400` missing/unreadable file, `413` request/pixel limit exceeded, `415` unsupported image format, `503` unavailable checkpoint, `500` inference failure. The model is loaded lazily, and missing weights never produce a fabricated prediction.

## Tests and build

With the backend environment active:

```sh
python -m unittest discover -s tests -v
python scripts/smoke_test.py
node --test tests/extension.test.cjs
npm --prefix frontend run lint
npm --prefix frontend run build
```

The unit suite injects fixed-output classifiers to verify request handling, preprocessing, label mapping and failure handling. The smoke test uses the real checkpoint on generated images and checks finite output, not detection accuracy. See [test cases](docs/TEST_CASES.md) for manual end-to-end checks and evaluation guidance.

For API-only tests on a machine without TensorFlow, install `backend/requirements-test.txt` instead; skip the real-model smoke test.

## Training and model

[Training instructions](training/README.md) describe the Keras pipeline derived from this project's original training notebook. The class order is explicitly `Fake=0, Real=1`, matching the deployed sigmoid head. Input is RGB at 224×224 with float pixels in `[0,255]`; EfficientNet contains its own rescaling layer.

The full original dataset is not redistributed in the submission bundle. Supply a dataset you have permission to use. The original checkpoint's dataset source and license were not recorded in the available notebooks; the model card records this limitation. A new training run is not expected to recreate the checkpoint bit-for-bit.

## Privacy and limitations

The local API decodes uploads in memory and does not intentionally write images to disk. No external service is used by default. A hosted operator, operating system or reverse proxy can have its own retention behavior. The Flask server has no authentication, rate limiting or production deployment configuration; keep the default loopback binding for the demonstration.

Compression, screenshots, unseen generators and distribution shift can change predictions. A real photograph may accompany a false claim. Do not use a result alone to accuse someone of fraud or decide whether to send money. The tool supports source verification and awareness; it does not replace them.

## License

Original project source, documentation and generated sample fixtures are provided under the [MIT License](LICENSE). Third-party packages, pretrained backbones and existing model/data assets retain their respective terms; see [third-party notices](THIRD_PARTY_NOTICES.md). Do not assume the source license grants rights to a third-party dataset.
