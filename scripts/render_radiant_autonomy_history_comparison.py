#!/usr/bin/env python3
"""Render lightweight visual evidence for Radiant Autonomy historical-source review."""
from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
ARTWORK = Path("media/stikkers/2026/Batch 5/Music Legends/radiant-autonomy-music-legend-mural.png")
OLD_COMMIT = "116ad9900fe918737c284e1593560450cf9d8f4e"
CURRENT = ROOT / ARTWORK
OLD = ROOT / ".tmp-radiant-autonomy-old-preview.png"
OUT_DIR = ROOT / "docs" / "audits" / "radiant-autonomy-history-visual"


def load_rgba(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return image.convert("RGBA")


def flatten_thumbnail(image: Image.Image, max_size=(760, 570)) -> Image.Image:
    thumb = image.copy()
    thumb.thumbnail(max_size, Image.Resampling.LANCZOS)
    bg = Image.new("RGBA", thumb.size, (238, 238, 238, 255))
    bg.alpha_composite(thumb)
    return bg.convert("RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with OLD.open("wb") as handle:
        subprocess.run(["git", "show", f"{OLD_COMMIT}:{ARTWORK.as_posix()}"], cwd=ROOT, check=True, stdout=handle)

    old = load_rgba(OLD)
    current = load_rgba(CURRENT)
    old_preview = flatten_thumbnail(old)
    current_preview = flatten_thumbnail(current)
    old_preview.save(OUT_DIR / "old-preview.jpg", "JPEG", quality=92, optimize=True)
    current_preview.save(OUT_DIR / "current-preview.jpg", "JPEG", quality=92, optimize=True)

    if old.size == current.size:
        diff = ImageChops.difference(old, current).convert("RGB")
        diff = ImageEnhance.Contrast(diff).enhance(4.0)
        diff = ImageEnhance.Brightness(diff).enhance(3.0)
        diff_preview = diff.copy()
        diff_preview.thumbnail((760, 570), Image.Resampling.LANCZOS)
    else:
        diff_preview = Image.new("RGB", (760, 570), "white")
        ImageDraw.Draw(diff_preview).text((20, 20), "Different image dimensions", fill="black")
    diff_preview.save(OUT_DIR / "amplified-difference.jpg", "JPEG", quality=90, optimize=True)

    panel_w, panel_h = 800, 640
    sheet = Image.new("RGB", (panel_w * 3, panel_h), "white")
    draw = ImageDraw.Draw(sheet)
    titles = ["HISTORICAL", "CURRENT", "AMPLIFIED PIXEL DIFFERENCE"]
    previews = [old_preview, current_preview, diff_preview]
    for index, (title, preview) in enumerate(zip(titles, previews)):
        x0 = index * panel_w
        draw.text((x0 + 20, 15), title, fill="black")
        x = x0 + (panel_w - preview.width) // 2
        y = 50 + (570 - preview.height) // 2
        sheet.paste(preview, (x, y))
    sheet.save(OUT_DIR / "comparison-sheet.jpg", "JPEG", quality=92, optimize=True)

    print(f"Visual comparison written to {OUT_DIR.relative_to(ROOT)}")
    OLD.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
