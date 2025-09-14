#!/usr/bin/env python3
"""
Audio optimization script for game assets
Optimizes WAV files for web game usage with proper format and compression
"""

import os
import json
import subprocess
import sys
from pathlib import Path

def check_ffmpeg():
    """Check if ffmpeg is available"""
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: ffmpeg not found. Please install ffmpeg first.")
        return False

def get_audio_info(file_path):
    """Get audio file information using ffprobe"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            str(file_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error analyzing {file_path}: {e}")
        return None

def optimize_gunshot(input_file, output_file):
    """Optimize gunshot sound effects
    - Convert to mono (for 3D positioning)
    - 44.1kHz sample rate
    - 16-bit depth
    - Normalize audio
    """
    cmd = [
        'ffmpeg',
        '-i', str(input_file),
        '-ac', '1',  # Convert to mono
        '-ar', '44100',  # 44.1kHz sample rate
        '-sample_fmt', 's16',  # 16-bit
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',  # Normalize for consistent volume
        '-y',  # Overwrite output
        str(output_file)
    ]

    try:
        subprocess.run(cmd, capture_output=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error optimizing {input_file}: {e}")
        return False

def optimize_ambient(input_file, output_file):
    """Optimize ambient sounds (jungle sounds)
    - Keep stereo for immersion
    - 44.1kHz sample rate
    - Convert to OGG for compression
    - Quality level 6 (good balance of size/quality)
    """
    # Output as OGG for ambient sounds
    output_ogg = output_file.with_suffix('.ogg')

    cmd = [
        'ffmpeg',
        '-i', str(input_file),
        '-ac', '2',  # Keep stereo
        '-ar', '44100',  # 44.1kHz sample rate
        '-c:a', 'libvorbis',  # OGG Vorbis codec
        '-q:a', '6',  # Quality level 6
        '-y',  # Overwrite output
        str(output_ogg)
    ]

    try:
        subprocess.run(cmd, capture_output=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error optimizing {input_file}: {e}")
        return False

def optimize_death_sounds(input_file, output_file):
    """Optimize death sound effects
    - Convert to mono (for 3D positioning)
    - 44.1kHz sample rate
    - 16-bit depth
    - Slight compression for impact
    """
    cmd = [
        'ffmpeg',
        '-i', str(input_file),
        '-ac', '1',  # Convert to mono
        '-ar', '44100',  # 44.1kHz sample rate
        '-sample_fmt', 's16',  # 16-bit
        '-af', 'acompressor=threshold=0.5:ratio=4:attack=5:release=50,loudnorm=I=-18:TP=-2:LRA=7',
        '-y',  # Overwrite output
        str(output_file)
    ]

    try:
        subprocess.run(cmd, capture_output=True, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error optimizing {input_file}: {e}")
        return False

def main():
    if not check_ffmpeg():
        sys.exit(1)

    # Define paths
    assets_dir = Path(__file__).parent.parent / 'public' / 'assets'
    optimized_dir = assets_dir / 'optimized'
    optimized_dir.mkdir(exist_ok=True)

    # Define audio files and their optimization strategies
    audio_files = {
        'playerGunshot.wav': 'gunshot',
        'otherGunshot.wav': 'gunshot',
        'AllyDeath.wav': 'death',
        'EnemyDeath.wav': 'death',
        'jungle1.wav': 'ambient',
        'jungle2.wav': 'ambient'
    }

    print("[Audio] Starting audio optimization...")
    print(f"Assets directory: {assets_dir}")
    print(f"Output directory: {optimized_dir}\n")

    for filename, sound_type in audio_files.items():
        input_path = assets_dir / filename

        if not input_path.exists():
            print(f"[Warning] {filename} not found, skipping...")
            continue

        print(f"[Analyzing] {filename}...")
        info = get_audio_info(input_path)

        if info:
            stream = info['streams'][0]
            format_info = info['format']

            # Display current stats
            print(f"  Current: {stream['sample_rate']}Hz, {stream['channels']} channel(s), {stream['codec_name']}")
            print(f"  Size: {int(format_info['size']) / 1024 / 1024:.2f} MB")
            print(f"  Duration: {float(format_info['duration']):.2f} seconds")

        # Determine output path based on type
        if sound_type == 'ambient':
            output_path = optimized_dir / filename.replace('.wav', '.ogg')
        else:
            output_path = optimized_dir / filename

        print(f"[Optimizing] as {sound_type} sound...")

        # Apply appropriate optimization
        success = False
        if sound_type == 'gunshot':
            success = optimize_gunshot(input_path, output_path)
        elif sound_type == 'ambient':
            success = optimize_ambient(input_path, output_path)
        elif sound_type == 'death':
            success = optimize_death_sounds(input_path, output_path)

        if success:
            # Check new file size
            new_size = output_path.stat().st_size / 1024 / 1024
            old_size = input_path.stat().st_size / 1024 / 1024
            reduction = ((old_size - new_size) / old_size) * 100 if old_size > 0 else 0

            print(f"[Success] Optimized to {output_path.name}")
            print(f"  New size: {new_size:.2f} MB ({reduction:.1f}% reduction)\n")
        else:
            print(f"[Error] Failed to optimize {filename}\n")

    print("\n[Complete] Audio optimization complete!")
    print(f"Optimized files saved to: {optimized_dir}")
    print("\nRecommendations:")
    print("- Use the optimized WAV files for gunshots and death sounds (low latency)")
    print("- Use the OGG files for ambient jungle sounds (better compression)")
    print("- Update your asset loader to use files from the 'optimized' folder")

if __name__ == "__main__":
    main()