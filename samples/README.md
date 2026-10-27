# Sample data

The files in `images/` are deterministic, procedurally generated gradients and geometric patterns created for this repository under its MIT license. They contain no people or third-party photographs.

| File | Purpose |
| --- | --- |
| `images/gradient.png` | RGB PNG upload |
| `images/shapes.jpg` | JPEG upload |
| `images/grayscale.png` | Single-channel image conversion |

Recreate them with `python scripts/generate_samples.py` after installing Pillow. These are application fixtures, **not labeled real/fake evaluation data**. Any returned class is merely an example of inference; do not calculate detector accuracy from these files. For quality evaluation, supply a separate licensed dataset with reliable labels and source information.
