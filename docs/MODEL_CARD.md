# Model card: RealReveal inference checkpoint

| Item | Recorded value |
| --- | --- |
| File | `backend/best_subset_model.h5` |
| Size | 49,738,424 bytes |
| SHA-256 | `3e8f9266c110389d4d3a38232a7d8d16a99ac053b5bdfeab0418cec94d9df374` |
| Framework tested | TensorFlow 2.20.0 / Keras 3.13.2 |
| Architecture | EfficientNetB0 layers, global average pooling, Dense(128, ReLU), Dense(1, sigmoid) |
| Input | RGB, 224×224, float32, raw pixels in `[0,255]` |
| Output | One sigmoid value; project training convention `Fake=0`, `Real=1` |
| Application labels | `Deepfake` at/below 0.5, `Real` above 0.5 |

## Intended use

Research and educational image screening alongside checking original sources and context. The label `Deepfake` is an application label for resemblance to the synthetic class; it is not proof of a particular manipulation technique or malicious intent.

## Provenance

The existing project notebook (`Model/Subset Model.ipynb` in the broader local workspace) defines a Keras EfficientNetB0 classifier initialized from ImageNet, a binary image-directory loader and fine-tuning. The repository's checkpoint structure matches that architecture. The deployment code already used `Real` for scores above 0.5; the included training script makes `Fake, Real` order explicit.

The exact original dataset source URL, license, identity overlap, seed, final training run and generator coverage were not recorded in the available checkpoint metadata. The included training script documents a compatible workflow rather than claiming exact reproduction. Checkpoint distribution terms need to be resolved alongside dataset provenance; the MIT source-code license does not establish rights to external data or pretrained assets.

## Validation performed

The checkpoint was loaded on the author's local environment and produced finite scalar predictions. API smoke checks use procedurally generated fixtures; these establish operational inference, not detection quality. No independent held-out accuracy, calibration or fairness result is asserted here. See `docs/VALIDATION.md` for the submission preparation run.

## Known limitations

- Out-of-distribution generators, compression, resizing, screenshots and ordinary edits may produce incorrect predictions.
- Face-heavy training data may not represent landscapes, illustrations or other content.
- A genuine image may be used in a false context; this classifier does not verify accompanying claims.
- `confidence` is an uncalibrated score, not a percentage guarantee of correctness.
- Local Grad-CAM overlays locate regions influencing the classifier score. They do not identify confirmed edits or establish authenticity. Optional Watsonx text guidance summarizes this evidence and does not inspect image pixels.
- The API does not detect video or audio deepfakes.

## Recommended next evaluation

Obtain a licensed dataset manifest; split by person/source and generator; retain an unseen-generator test set; report per-class precision, recall, F1, false positives, sample counts and thresholds. Evaluate calibration and performance by content type and compression level. Keep test images out of training and tuning.

## Independent visual review

When separately enabled, an image-capable model hosted on IBM Watsonx reviews a resized copy of the image for visible clues. This is independent of the local classifier and Grad-CAM, may disagree with them, and may itself hallucinate. The prompt requests specific observations, alternative photographic explanations, and an explicit statement when no clear visual anomalies are present. It does not identify people or supply a numerical authenticity probability.
