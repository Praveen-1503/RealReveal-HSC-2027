# Test cases

## Automated checks

Run from the repository root with the virtual environment active:

```sh
python -m unittest discover -s tests -v
python scripts/smoke_test.py
node --test tests/extension.test.cjs
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

| Area | Case and expected behavior |
| --- | --- |
| Health | Returns process/model-file/load status without loading TensorFlow |
| Upload | Missing field, empty filename, invalid/truncated bytes return 400 |
| Formats | PNG, JPEG, WEBP and AVIF decode; GIF is rejected with 415 |
| Limits | Oversized request or decoded pixel dimensions return 413 |
| Preprocessing | RGB/grayscale/RGBA/EXIF rotation become float32 `(1,224,224,3)` with raw 0–255 scale |
| Mapping | Fixed scores above/below/at threshold return expected label and score |
| Model errors | Missing checkpoint returns 503; invalid scalar, NaN or inference error returns 500 |
| Guidance | Optional cloud failure falls back without fabricating visual observations |
| CORS | Allowed web origin receives CORS headers; an unrelated origin does not |
| Extension | Worker handles successful upload, failed image/API request, unsupported URL and file limit |
| Real model | Included checkpoint produces valid numeric predictions on generated fixtures; no accuracy assertion |

The API suite uses deterministic classifier stubs and is not a model benchmark. The Node suite uses mocked browser/fetch interfaces and does not replace manually loading Chrome.

## Manual demonstration

1. Start the backend and web app using the README. Verify `/health` returns 200.
2. Upload `samples/images/gradient.png`. Expect a preview, a model label, numeric score and source-verification guidance. Do not treat its output as a correct/incorrect ground-truth result.
3. Try `samples/images/shapes.jpg` and `samples/images/grayscale.png`.
4. Upload a file containing plain text renamed `.png`. Expect a readable error rather than a prediction. The web app may filter selection; use curl to test the API directly.
5. Stop the API, upload an image and confirm that the frontend shows an error. Restart it to continue.
6. Choose a second image while a first request is pending. Confirm the second image is the one associated with the final result; superseded requests are aborted.
7. Load the unpacked extension, reload an HTTP/HTTPS page with an image, and use **Verify with RealReveal**. Expect a loading overlay followed by a prediction. Sites blocking downloads may require manual upload.
8. Confirm the extension reports errors if the backend is stopped, the image cannot be downloaded or the URL is unsupported.

## Separate model-quality evaluation

Provide a licensed, held-out labeled dataset to `training/train.py`. Save dataset provenance and the resulting report. Required metrics include sample count, confusion matrix, per-class precision/recall/F1 and accuracy. Test sources and identities must not leak into training/validation. Repeat on unseen generators and compressed images. Generated fixtures and a handful of original images are insufficient evidence for an accuracy percentage.

Frontend regression tests cover HTTP-format errors, unavailable models, network failures, invalid results and error rendering without a fabricated classification. Attention tests check region summaries and presentation.
