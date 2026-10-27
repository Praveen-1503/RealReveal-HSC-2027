"""Grad-CAM evidence from the deployed classifier, computed entirely locally."""
import base64
import io

import numpy as np
from PIL import Image

REGIONS = [
    'upper left', 'upper center', 'upper right',
    'middle left', 'center', 'middle right',
    'lower left', 'lower center', 'lower right',
]


def strongest_regions(heatmap):
    if not np.isfinite(heatmap).all() or float(np.max(heatmap)) <= 0:
        return []
    strengths = []
    for row in np.array_split(heatmap, 3, axis=0):
        for cell in np.array_split(row, 3, axis=1):
            strengths.append(float(cell.mean()))
    ranked = sorted(range(9), key=lambda i: strengths[i], reverse=True)
    return [REGIONS[i] for i in ranked[:2] if strengths[i] >= strengths[ranked[0]] * 0.6]


def build_attention_model(model):
    if not hasattr(model, 'get_layer'):
        return None
    import tensorflow as tf
    # Explain pre-sigmoid scores to avoid vanishing gradients at saturated outputs.
    final = model.layers[-1]
    if final.get_config().get('activation') != 'sigmoid' or final.units != 1:
        raise ValueError('Attention requires the deployed single-sigmoid classifier')
    spatial = model.get_layer('top_activation')
    return tf.keras.Model(model.inputs, [spatial.output, final.input])


def explain_attention(model, attention_model, inputs, label, source_image):
    if attention_model is None:
        return None
    import tensorflow as tf
    final = model.layers[-1]
    with tf.GradientTape() as tape:
        feature_map, hidden = attention_model([tf.convert_to_tensor(inputs)], training=False)
        logit = tf.linalg.matmul(hidden, final.kernel) + final.bias
        target = logit[:, 0] if label == 'Real' else -logit[:, 0]
    gradients = tape.gradient(target, feature_map)
    if gradients is None:
        raise ValueError('No gradients for the classifier feature map')
    weights = tf.reduce_mean(gradients, axis=(0, 1, 2))
    heatmap = tf.maximum(tf.reduce_sum(feature_map[0] * weights, axis=-1), 0).numpy()
    maximum = float(heatmap.max())
    if maximum <= 1e-12:
        return {
            'method': 'Grad-CAM', 'target': label, 'regions': [],
            'summary': 'No distinct positively contributing region could be isolated for this prediction.',
        }
    heatmap = heatmap / maximum
    regions = strongest_regions(heatmap)
    preview = source_image.copy()
    preview.thumbnail((640, 640))
    mask = Image.fromarray(np.uint8(heatmap * 255)).resize(preview.size, Image.Resampling.BILINEAR)
    alpha = np.asarray(mask, dtype=np.float32)[..., None] / 255 * 0.55
    pixels = np.asarray(preview.convert('RGB'), dtype=np.float32)
    red = np.zeros_like(pixels)
    red[..., 0] = 255
    red[..., 1] = 60
    overlay = Image.fromarray(np.uint8(pixels * (1 - alpha) + red * alpha))
    buffer = io.BytesIO()
    overlay.save(buffer, format='PNG')
    summary = (
        f"The detector's {label.lower()} score was influenced most by the "
        f"{' and '.join(regions)} of this image. The highlighted areas contain features "
        "the classifier associates with that class in its training data. "
        "This locates model influence; it does not establish that those areas were edited."
    )
    return {
        'method': 'Grad-CAM', 'target': label, 'regions': regions,
        'summary': summary,
        'overlay': 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii'),
    }
