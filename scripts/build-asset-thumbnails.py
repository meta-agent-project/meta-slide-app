"""Build small WebP previews; full-resolution originals remain unchanged. Requires Pillow."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1] / 'assets' / 'clipart'
out = root / 'thumbnails'
out.mkdir(exist_ok=True)
for source in root.glob('*.png'):
    with Image.open(source) as image:
        image.thumbnail((240, 180), Image.Resampling.LANCZOS)
        image.save(out / (source.stem + '.webp'), 'WEBP', quality=78, method=6)
