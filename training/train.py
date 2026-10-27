"""Compatible Keras training workflow derived from the project's subset notebook."""
import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf

CLASSES = ["Fake", "Real"]


def dataset(directory, batch_size, shuffle, seed):
    for name in CLASSES:
        if not (directory / name).is_dir():
            raise ValueError(f"Missing class directory: {directory / name}")
    return tf.keras.utils.image_dataset_from_directory(
        directory,
        class_names=CLASSES,
        label_mode="binary",
        image_size=(224, 224),
        batch_size=batch_size,
        shuffle=shuffle,
        seed=seed,
    ).prefetch(tf.data.AUTOTUNE)


def metrics_for(model, test_ds):
    matrix = np.zeros((2, 2), dtype=np.int64)
    for images, labels in test_ds:
        scores = model(images, training=False).numpy().reshape(-1)
        actual = labels.numpy().astype(int).reshape(-1)
        predicted = (scores > 0.5).astype(int)
        for truth, prediction in zip(actual, predicted):
            matrix[truth, prediction] += 1
    count = int(matrix.sum())
    report = {
        "class_order": CLASSES,
        "sample_count": count,
        "threshold": 0.5,
        "confusion_matrix_rows_actual_columns_predicted": matrix.tolist(),
        "accuracy": float(np.trace(matrix) / count) if count else None,
    }
    per_class = {}
    for index, name in enumerate(CLASSES):
        tp = int(matrix[index, index])
        precision = tp / int(matrix[:, index].sum()) if matrix[:, index].sum() else 0.0
        recall = tp / int(matrix[index, :].sum()) if matrix[index, :].sum() else 0.0
        per_class[name] = {
            "precision": precision,
            "recall": recall,
            "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
            "support": int(matrix[index, :].sum()),
        }
    report["per_class"] = per_class
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("training/outputs/best_subset_model.h5"))
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("epochs and batch-size must be positive")
    tf.keras.utils.set_random_seed(args.seed)
    train_ds = dataset(args.data_dir / "Train", args.batch_size, True, args.seed)
    val_ds = dataset(args.data_dir / "Validation", args.batch_size, False, args.seed)
    test_ds = dataset(args.data_dir / "Test", args.batch_size, False, args.seed)

    base = tf.keras.applications.EfficientNetB0(
        include_top=False, weights="imagenet", input_shape=(224, 224, 3)
    )
    base.trainable = True
    for layer in base.layers[:100]:
        layer.trainable = False
    x = tf.keras.layers.GlobalAveragePooling2D()(base.output)
    x = tf.keras.layers.Dense(128, activation="relu")(x)
    output = tf.keras.layers.Dense(1, activation="sigmoid")(x)
    model = tf.keras.Model(base.input, output)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    history = model.fit(
        train_ds, validation_data=val_ds, epochs=args.epochs,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
            tf.keras.callbacks.ModelCheckpoint(str(args.output), monitor="val_loss", save_best_only=True),
        ],
    )
    best_model = tf.keras.models.load_model(args.output, compile=False)
    report = metrics_for(best_model, test_ds)
    report["seed"] = args.seed
    report["tensorflow_version"] = tf.__version__
    report["checkpoint"] = args.output.name
    report_path = args.output.with_suffix(".evaluation.json")
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    args.output.with_suffix(".history.json").write_text(json.dumps(history.history, indent=2) + "\n")
    print("Saved checkpoint:", args.output)
    print("Saved evaluation:", report_path)


if __name__ == "__main__":
    main()
