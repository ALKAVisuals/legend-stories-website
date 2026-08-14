#!/usr/bin/env python3
"""Audit historical Radiant Autonomy artwork without modifying source images.

Compares the pre-compression repository version with current main at raw RGBA pixel
level and inventories any Git object paths containing 'radiant' or 'autonomy'.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
PATH = Path("media/stikkers/2026/Batch 5/Music Legends/radiant-autonomy-music-legend-mural.png")
OLD_COMMIT = "116ad9900fe918737c284e1593560450cf9d8f4e"
CURRENT = ROOT / PATH
OLD = ROOT / ".tmp-radiant-autonomy-old.png"
OUT_JSON = ROOT / "docs" / "audits" / "radiant-autonomy-history-audit.json"
OUT_MD = ROOT / "docs" / "audits" / "radiant-autonomy-history-audit.md"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def raw_rgba_sha(path: Path) -> tuple[str, tuple[int, int], str]:
    with Image.open(path) as im:
        original_mode = im.mode
        rgba = im.convert("RGBA")
        return hashlib.sha256(rgba.tobytes()).hexdigest(), rgba.size, original_mode


def compare_pixels(old_path: Path, current_path: Path) -> dict:
    with Image.open(old_path) as old_im, Image.open(current_path) as cur_im:
        old_rgba = old_im.convert("RGBA")
        cur_rgba = cur_im.convert("RGBA")
        if old_rgba.size != cur_rgba.size:
            return {
                "same_dimensions": False,
                "identical_pixels": False,
                "different_pixel_count": None,
                "difference_bbox": None,
                "max_channel_difference": None,
            }

        diff = ImageChops.difference(old_rgba, cur_rgba)
        bbox = diff.getbbox()
        if bbox is None:
            return {
                "same_dimensions": True,
                "identical_pixels": True,
                "different_pixel_count": 0,
                "difference_bbox": None,
                "max_channel_difference": 0,
            }

        different = 0
        max_diff = 0
        for pixel in diff.getdata():
            if any(pixel):
                different += 1
                max_diff = max(max_diff, *pixel)
        return {
            "same_dimensions": True,
            "identical_pixels": False,
            "different_pixel_count": different,
            "difference_bbox": list(bbox),
            "max_channel_difference": max_diff,
        }


def inventory_related_git_paths() -> list[str]:
    proc = subprocess.run(
        ["git", "rev-list", "--all", "--objects"],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    paths = set()
    for line in proc.stdout.splitlines():
        parts = line.split(" ", 1)
        if len(parts) != 2:
            continue
        candidate = parts[1]
        lowered = candidate.lower()
        if "radiant" in lowered or "autonomy" in lowered:
            paths.add(candidate)
    return sorted(paths)


def main() -> None:
    if not CURRENT.exists():
        raise RuntimeError(f"Current source missing: {PATH}")

    OLD.parent.mkdir(parents=True, exist_ok=True)
    with OLD.open("wb") as f:
        subprocess.run(
            ["git", "show", f"{OLD_COMMIT}:{PATH.as_posix()}"],
            cwd=ROOT,
            check=True,
            stdout=f,
        )

    old_pixel_sha, old_size, old_mode = raw_rgba_sha(OLD)
    current_pixel_sha, current_size, current_mode = raw_rgba_sha(CURRENT)
    comparison = compare_pixels(OLD, CURRENT)
    related_paths = inventory_related_git_paths()

    payload = {
        "schema_version": 1,
        "artwork": "radiant-autonomy-music-legend-mural",
        "repository_path": PATH.as_posix(),
        "old_commit": OLD_COMMIT,
        "old": {
            "file_size_bytes": OLD.stat().st_size,
            "file_sha256": sha256_file(OLD),
            "raw_rgba_pixel_sha256": old_pixel_sha,
            "dimensions_px": list(old_size),
            "original_mode": old_mode,
        },
        "current": {
            "file_size_bytes": CURRENT.stat().st_size,
            "file_sha256": sha256_file(CURRENT),
            "raw_rgba_pixel_sha256": current_pixel_sha,
            "dimensions_px": list(current_size),
            "original_mode": current_mode,
        },
        "pixel_comparison": comparison,
        "historical_version_can_resolve_source_blocker": not comparison["identical_pixels"],
        "related_git_paths": related_paths,
        "related_git_path_count": len(related_paths),
        "source_images_modified": False,
        "interpretation": (
            "Historical PNG is pixel-identical; byte-size/hash differences are encoding/compression only and cannot remove the known watermark blocker."
            if comparison["identical_pixels"]
            else "Historical PNG pixels differ from current; visual/source-quality review is required before it may be considered as a clean replacement."
        ),
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    lines = [
        "# Radiant Autonomy History Audit", "",
        f"- Repository path: `{PATH.as_posix()}`",
        f"- Historical commit: `{OLD_COMMIT}`",
        f"- Old file bytes: **{payload['old']['file_size_bytes']:,}**",
        f"- Current file bytes: **{payload['current']['file_size_bytes']:,}**",
        f"- Old dimensions: **{old_size[0]}×{old_size[1]} px**",
        f"- Current dimensions: **{current_size[0]}×{current_size[1]} px**",
        f"- Raw RGBA pixel hashes equal: **{'yes' if old_pixel_sha == current_pixel_sha else 'no'}**",
        f"- Pixel-identical: **{'yes' if comparison['identical_pixels'] else 'no'}**",
        f"- Different pixels: **{comparison['different_pixel_count']}**",
        f"- Related Git paths found: **{len(related_paths)}**", "",
        "## Interpretation", "", payload["interpretation"], "",
        "## Related historical paths", "",
    ]
    lines.extend(f"- `{path}`" for path in related_paths)
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({
        "old_file_size": payload["old"]["file_size_bytes"],
        "current_file_size": payload["current"]["file_size_bytes"],
        "old_pixel_sha": old_pixel_sha,
        "current_pixel_sha": current_pixel_sha,
        "pixel_comparison": comparison,
        "related_git_paths": related_paths,
    }, indent=2))

    OLD.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
