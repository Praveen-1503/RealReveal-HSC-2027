# Compatible Keras training workflow

`train.py` extracts the model design and fine-tuning approach from the original local `Model/Subset Model.ipynb`. It makes dataset paths, class order, output path and seed explicit. It is compatible with the inference API; it is not a promise of bit-for-bit reproduction of the included historical checkpoint.

Use your own licensed dataset. The original project's dataset source/license and final-run configuration were not fully recorded, so the full dataset is not redistributed.

## Input layout

```text
your-dataset/
  Train/
    Fake/
    Real/
  Validation/
    Fake/
    Real/
  Test/
    Fake/
    Real/
```

Use independent sources/identities across splits. Keep an evaluation set with generators absent from training. Record the dataset URL, version, license, collection permissions and split counts before training. Do not train on the repository's unlabeled sample fixtures.

## Run

From the repository root, activate the backend virtual environment and install `backend/requirements.txt`, then:

```sh
python training/train.py --data-dir /absolute/path/to/your-dataset \
  --epochs 50 --batch-size 32 \
  --output training/outputs/best_subset_model.h5
```

The first run downloads ImageNet backbone weights through Keras unless already cached. Supply internet access and review the relevant upstream terms. Reduce batch size for low-memory computers. Training is resource-intensive and was not rerun during application preparation.

The script uses raw RGB pixels, 224×224 resizing, ImageNet-initialized EfficientNetB0, trainable layers after index 100, global average pooling, Dense(128, ReLU), and a single sigmoid output. The class order is explicitly `Fake=0, Real=1`. Adam uses learning rate `1e-5`; early stopping monitors validation loss with patience 5.

Outputs include a best checkpoint, history JSON and held-out evaluation JSON with counts, confusion matrix, per-class precision/recall/F1 and accuracy. Random seed defaults to 42, but hardware, library versions and dataset order can still affect reproducibility.

To use newly trained weights, set `MODEL_PATH` in `backend/.env` to the checkpoint's absolute path and restart the API. Confirm the input/output contract and run `python scripts/smoke_test.py`. Do not copy benchmark claims from another model or dataset into this project's application.
