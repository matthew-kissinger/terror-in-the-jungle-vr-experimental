#!/usr/bin/env python3
"""
Simple asset optimizer using only PIL - no external tools needed
"""

import os
import shutil
from pathlib import Path
from datetime import datetime
from PIL import Image
import json

def optimize_pngs():
    """Optimize PNGs using PIL only"""
    # Get correct paths relative to script location
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    assets_dir = project_root / "public" / "assets"
    output_dir = project_root / "public" / "assets_optimized"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Backup first
    backup_dir = project_root / f"assets_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    backup_dir.mkdir(exist_ok=True)

    stats = {
        'files': [],
        'total_original': 0,
        'total_optimized': 0
    }

    print("OPTIMIZING PNG FILES")
    print("=" * 50)

    png_files = list(assets_dir.glob("*.png"))

    for png_file in png_files:
        print(f"\nProcessing {png_file.name}...")

        # Backup
        shutil.copy2(png_file, backup_dir / png_file.name)

        # Get original size
        original_size = png_file.stat().st_size
        stats['total_original'] += original_size

        # Open and optimize
        try:
            img = Image.open(png_file)

            # Convert RGBA to RGB+Alpha palette if possible (reduces file size)
            if img.mode == 'RGBA':
                # Check if we can use palette mode
                if len(img.getcolors(256)) <= 256:
                    img = img.convert('P', palette=Image.ADAPTIVE, colors=256)

            # Save with optimization
            output_path = output_dir / png_file.name
            img.save(output_path, 'PNG', optimize=True, compress_level=9)

            new_size = output_path.stat().st_size
            stats['total_optimized'] += new_size

            reduction = (1 - new_size/original_size) * 100
            print(f"  Original: {original_size/1024:.1f}KB")
            print(f"  Optimized: {new_size/1024:.1f}KB")
            print(f"  Reduction: {reduction:.1f}%")

            stats['files'].append({
                'name': png_file.name,
                'original': original_size,
                'optimized': new_size,
                'reduction': reduction
            })

        except Exception as e:
            print(f"  Error: {e}")
            # Copy original if optimization fails
            shutil.copy2(png_file, output_dir / png_file.name)

    # Copy audio files from optimized folder
    print("\n" + "=" * 50)
    print("COPYING OPTIMIZED AUDIO")
    print("=" * 50)

    audio_optimized = project_root / "public" / "assets" / "optimized"
    if audio_optimized.exists():
        for audio_file in audio_optimized.glob("*.*"):
            print(f"Copying {audio_file.name}")
            shutil.copy2(audio_file, output_dir / audio_file.name)

    # Summary
    print("\n" + "=" * 50)
    print("OPTIMIZATION COMPLETE")
    print("=" * 50)

    original_mb = stats['total_original'] / (1024 * 1024)
    optimized_mb = stats['total_optimized'] / (1024 * 1024)
    total_reduction = (1 - optimized_mb/original_mb) * 100 if original_mb > 0 else 0

    print(f"\nTotal original size: {original_mb:.2f} MB")
    print(f"Total optimized size: {optimized_mb:.2f} MB")
    print(f"Total reduction: {total_reduction:.1f}%")
    print(f"\nBackup saved to: {backup_dir}")
    print(f"Optimized files in: {output_dir}")

    # Save report
    with open(output_dir / "optimization_report.json", "w") as f:
        json.dump(stats, f, indent=2)

    return output_dir

if __name__ == "__main__":
    optimize_pngs()