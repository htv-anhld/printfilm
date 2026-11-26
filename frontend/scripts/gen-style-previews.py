"""生成画面风格预览缩略图：public/image-styles/*.jpg|png → preview/*.webp（最长边 960，q78）。

原图保留不动（后端把原图当风格板参考图发给上游）；页面只加载缩略图。
用法（仓库根目录）：backend/.venv/bin/python frontend/scripts/gen-style-previews.py
"""
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parents[1] / "public" / "image-styles"
OUT = SRC / "preview"
MAX_SIDE = 960


def main() -> None:
    """遍历原图，jpg 优先于同名 png，写出 webp 缩略图。"""
    OUT.mkdir(exist_ok=True)
    seen: set[str] = set()
    for path in sorted(SRC.glob("*.jpg")) + sorted(SRC.glob("*.png")):
        if path.stem in seen:
            continue
        seen.add(path.stem)
        with Image.open(path) as img:
            img = img.convert("RGB")
            img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            img.save(OUT / f"{path.stem}.webp", "WEBP", quality=78, method=6)


if __name__ == "__main__":
    main()
