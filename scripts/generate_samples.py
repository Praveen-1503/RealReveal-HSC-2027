"""Create reproducible upload fixtures without third-party image assets."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def main():
    destination = ROOT / "samples" / "images"
    destination.mkdir(parents=True, exist_ok=True)
    gradient = Image.new("RGB", (256, 256))
    gradient.putdata([(x, y, (x + y) // 2) for y in range(256) for x in range(256)])
    gradient.save(destination / "gradient.png")
    shapes = Image.new("RGB", (320, 240), "#eef2ff")
    draw = ImageDraw.Draw(shapes)
    draw.rectangle((30, 30, 150, 170), fill="#2563eb")
    draw.ellipse((130, 70, 290, 210), fill="#f97316")
    shapes.save(destination / "shapes.jpg", quality=90)
    gradient.convert("L").save(destination / "grayscale.png")
    print("Generated 3 sample images in", destination)


if __name__ == "__main__":
    main()
