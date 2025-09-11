#!/usr/bin/env python3
"""
Aggressive texture compression script for WebGL performance optimization.
Reduces texture sizes while maintaining visual quality for pixel art.
"""

import os
import sys
from PIL import Image
import numpy as np
from pathlib import Path
import shutil

# Configuration for each texture type
TEXTURE_CONFIGS = {
    'forestfloor.png': {
        'size': (512, 512),      # Reduce from 5.1MB to manageable size
        'colors': 64,            # Limit palette for terrain
        'quality': 85,
        'optimize': True
    },
    'grass.png': {
        'size': (128, 128),      # Small for billboard sprites
        'colors': 32,
        'quality': 90,
        'optimize': True
    },
    'tree.png': {
        'size': (256, 256),      # Medium for tree billboards
        'colors': 64,
        'quality': 90,
        'optimize': True
    },
    'mushroom.png': {
        'size': (128, 128),      # Small for decoration
        'colors': 32,
        'quality': 90,
        'optimize': True
    },
    'imp.png': {
        'size': (256, 256),      # Medium for enemies
        'colors': 64,
        'quality': 90,
        'optimize': True
    },
    'attacker.png': {
        'size': (256, 256),      # Medium for enemies
        'colors': 64,
        'quality': 90,
        'optimize': True
    },
    'skybox.png': {
        'size': (1024, 512),     # Can be rectangular for equirectangular
        'colors': 128,
        'quality': 85,
        'optimize': True
    }
}

def get_file_size_mb(filepath):
    """Get file size in MB"""
    return os.path.getsize(filepath) / (1024 * 1024)

def quantize_colors(img, num_colors):
    """Reduce color palette using median cut algorithm"""
    # Convert to P mode (palette mode) with specified colors
    img = img.convert('RGBA')
    
    # Use adaptive palette with limited colors
    quantized = img.convert('P', palette=Image.ADAPTIVE, colors=num_colors)
    
    # Convert back to RGBA to maintain transparency
    return quantized.convert('RGBA')

def compress_texture(input_path, output_path, config):
    """Compress a single texture with aggressive optimization"""
    
    print(f"\n{'='*60}")
    print(f"Processing: {os.path.basename(input_path)}")
    print(f"Original size: {get_file_size_mb(input_path):.2f} MB")
    
    # Open image
    img = Image.open(input_path)
    original_mode = img.mode
    print(f"Original dimensions: {img.size[0]}x{img.size[1]}, mode: {original_mode}")
    
    # Step 1: Resize with nearest neighbor for pixel art
    target_size = config['size']
    if img.size != target_size:
        img = img.resize(target_size, Image.NEAREST)
        print(f"Resized to: {target_size[0]}x{target_size[1]}")
    
    # Step 2: Reduce colors for pixel art style
    if 'colors' in config:
        img = quantize_colors(img, config['colors'])
        print(f"Reduced to {config['colors']} colors")
    
    # Step 3: Additional optimizations for specific textures
    if 'forestfloor' in input_path.lower():
        # For terrain, we can be more aggressive since it tiles
        # Convert to indexed color mode for maximum compression
        if img.mode == 'RGBA':
            # Separate alpha channel
            alpha = img.split()[-1]
            img = img.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=32)
            img = img.convert('RGBA')
            img.putalpha(alpha)
        print("Applied aggressive terrain optimization")
    
    # Step 4: Save with optimization
    save_kwargs = {
        'optimize': config.get('optimize', True),
        'compress_level': 9,  # Maximum PNG compression
    }
    
    # For PNG, we can also use pngquant-style optimization
    if img.mode == 'RGBA':
        # Check if we can reduce to RGB (no transparency needed)
        alpha = img.split()[-1]
        if alpha.getextrema() == (255, 255):  # No transparency
            img = img.convert('RGB')
            print("Removed unnecessary alpha channel")
    
    # Save compressed version
    img.save(output_path, 'PNG', **save_kwargs)
    
    # Report results
    new_size = get_file_size_mb(output_path)
    reduction = (1 - new_size / get_file_size_mb(input_path)) * 100
    print(f"New size: {new_size:.2f} MB")
    print(f"Reduction: {reduction:.1f}%")
    
    return reduction

def main():
    assets_dir = Path("public/assets")
    backup_dir = Path("public/assets/original")
    
    if not assets_dir.exists():
        print(f"Error: {assets_dir} directory not found!")
        sys.exit(1)
    
    # Create backup directory
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    print("AGGRESSIVE TEXTURE COMPRESSION FOR WEBGL")
    print("=" * 60)
    
    total_original = 0
    total_compressed = 0
    
    for filename, config in TEXTURE_CONFIGS.items():
        input_path = assets_dir / filename
        
        if not input_path.exists():
            print(f"WARNING: Skipping {filename} - file not found")
            continue
        
        # Backup original
        backup_path = backup_dir / filename
        if not backup_path.exists():
            shutil.copy2(input_path, backup_path)
            print(f"Backed up {filename} to {backup_dir}")
        
        # Track sizes
        original_size = get_file_size_mb(input_path)
        total_original += original_size
        
        # Compress texture
        try:
            compress_texture(str(input_path), str(input_path), config)
            total_compressed += get_file_size_mb(input_path)
        except Exception as e:
            print(f"ERROR: Error processing {filename}: {e}")
            # Restore from backup on error
            if backup_path.exists():
                shutil.copy2(backup_path, input_path)
                print(f"Restored from backup")
    
    # Summary
    print("\n" + "=" * 60)
    print("COMPRESSION SUMMARY")
    print("=" * 60)
    print(f"Total original size: {total_original:.2f} MB")
    print(f"Total compressed size: {total_compressed:.2f} MB")
    print(f"Total reduction: {(1 - total_compressed/total_original) * 100:.1f}%")
    print(f"\nCompression complete! Originals backed up to {backup_dir}")
    
    # Create a simple batch file to install requirements
    requirements = "Pillow==10.2.0\nnumpy==1.26.3"
    with open("requirements_compress.txt", "w") as f:
        f.write(requirements)
    print(f"\nTo install requirements: pip install -r requirements_compress.txt")

if __name__ == "__main__":
    main()