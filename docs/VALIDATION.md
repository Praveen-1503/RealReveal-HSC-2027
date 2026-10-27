# Submission preparation validation

Run date: **27 October 2026**. The checks below were run locally; a cloud CI run is not claimed.

| Check | Result |
| --- | --- |
| Python API unit suite | **22 passed** |
| Node extension/manifest suite | **6 passed** |
| Real checkpoint smoke test | **3 generated images processed successfully** |
| Frontend ESLint | **Passed** |
| Frontend Vite production build | **Passed**, 2,060 modules transformed |
| Python source compilation | **Passed** for API, training, tests and scripts |

Local environment: macOS Apple Silicon; Python 3.13.3, TensorFlow 2.20.0, Keras 3.13.2; Node.js 25.9.0, npm 11.12.1. The supported setup is documented in the README; other listed Python/Node versions have not all been exercised locally.

The checkpoint SHA-256 is recorded in the model card. The generated fixture smoke outputs were:

| Fixture | Output label | Model score |
| --- | --- | --- |
| `gradient.png` | Deepfake | 52.74 |
| `grayscale.png` | Deepfake | 53.59 |
| `shapes.jpg` | Real | 77.08 |

These are operational examples on unlabeled patterns, **not evidence of accuracy**. Small numerical differences may occur across hardware/library versions.

## Not validated

- Long-term IBM service reliability or availability under load (see the live update below).
- Manual end-to-end Chrome extension behavior on arbitrary websites. Worker logic and manifest assets were tested with mocks.
- Retraining to convergence, exact checkpoint reproduction, held-out quality, fairness or calibrated confidence.
- Internet-facing deployment, hosting privacy guarantees, NGO pilots or measured reduction in fraud.

## Publication handling

The existing local Git repository tracks a `.env` file containing a nonempty IBM API key. The prepared submission exporter excludes actual environment files, Git history, logs, original personal/dataset images, virtual environments and installed dependencies. It also checks the exported file contents against local key/token/secret values without printing them.

Ignoring a file does not remove it from an existing Git history. Publish the prepared clean folder in a new repository rather than pushing the old history. Rotate the existing IBM key through its provider, and address the old repository separately. The prepared ZIP contains a SHA-256 manifest for reviewing exactly what will be uploaded.

## Image explanation update — 27 October 2026

- 29 API tests passed, including AVIF decoding, errors without predictions, local attention summaries and explicit visual-review failure states.
- 12 frontend tests passed, including the regression preventing failed uploads from displaying a fake/deepfake label or zero score.
- Frontend lint and production build passed.
- Grad-CAM was computed from the real checkpoint using the final 7×7 spatial feature map and pre-sigmoid score. The generated overlay and attention summary were checked on a bundled geometric fixture.
- Live IBM Watsonx image-chat review succeeded using the configured workspace and an image-capable Llama 4 Maverick model. Only procedural, non-personal fixtures were used in these checks.
- A browser upload displayed the local prediction, attention overlay and IBM observations about the actual image.
- A live AVIF upload returned local inference, attention and successful IBM image review. Unsupported GIF uploads returned HTTP 415 without a classification.

These checks establish feature operation, not accuracy, forensic validity or fraud detection quality. Visual reviews can be wrong or disagree with the classifier.
