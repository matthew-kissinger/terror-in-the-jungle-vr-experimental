#!/usr/bin/env python3
"""
Asset Optimization Script for Terror in the Jungle
Preserves visual quality while reducing file sizes
"""

import os
import subprocess
import shutil
from pathlib import Path
from typing import Dict, List
import json

class AssetOptimizer:
    def __init__(self, assets_dir: str, output_dir: str = None):
        self.assets_dir = Path(assets_dir)
        self.output_dir = Path(output_dir) if output_dir else self.assets_dir / 'optimized'
        self.output_dir.mkdir(exist_ok=True)

        # Quality settings - HIGH QUALITY preservation
        self.png_quality = "85-95"  # Very high quality for pngquant
        self.jpeg_quality = 92       # For skybox if converted
        self.ogg_quality = 6         # High quality audio (192kbps)

        self.stats = {
            'original_size': 0,
            'optimized_size': 0,
            'files_processed': 0,
            'savings': []
        }

    def check_tools(self):
        """Check if optimization tools are installed"""
        tools = {
            'pngquant': 'pngquant --version',
            'optipng': 'optipng --version',
            'ffmpeg': 'ffmpeg -version',
            'cwebp': 'cwebp -version'  # For WebP option
        }

        available = {}
        for tool, cmd in tools.items():
            try:
                subprocess.run(cmd.split(), capture_output=True, check=True)
                available[tool] = True
                print(f"✓ {tool} is installed")
            except:
                available[tool] = False
                print(f"✗ {tool} not found - install for better optimization")

        return available

    def optimize_png_lossless(self, input_path: Path, output_path: Path) -> bool:
        """
        Lossless PNG optimization - preserves 100% quality
        Uses optipng for compression without quality loss
        """
        try:
            # Copy first
            shutil.copy2(input_path, output_path)

            # Run optipng for lossless compression
            cmd = ['optipng', '-o7', '-preserve', '-quiet', str(output_path)]
            subprocess.run(cmd, check=True, capture_output=True)

            return True
        except Exception as e:
            print(f"Lossless optimization failed for {input_path.name}: {e}")
            return False

    def optimize_png_smart(self, input_path: Path, output_path: Path) -> bool:
        """
        Smart PNG optimization - uses different strategies based on image type
        Preserves visual quality while reducing size significantly
        """
        filename = input_path.name.lower()

        try:
            # Determine optimization strategy based on content
            if 'soldier' in filename or 'enemy' in filename:
                # Soldier sprites - use indexed color with high quality
                # These have limited color palettes, perfect for quantization
                return self.optimize_sprite(input_path, output_path)

            elif any(x in filename for x in ['tree', 'palm', 'banyan', 'fern', 'elephant']):
                # Vegetation - can handle more aggressive compression
                # Natural textures hide compression artifacts well
                return self.optimize_vegetation(input_path, output_path)

            elif 'skybox' in filename:
                # Skybox - consider JPEG for non-transparent areas
                return self.optimize_skybox(input_path, output_path)

            elif 'floor' in filename or 'grass' in filename:
                # Repeating textures - can be compressed more
                return self.optimize_texture(input_path, output_path)

            else:
                # Default high-quality compression
                return self.optimize_png_hq(input_path, output_path)

        except Exception as e:
            print(f"Smart optimization failed for {input_path.name}: {e}")
            # Fallback to simple copy
            shutil.copy2(input_path, output_path)
            return False

    def optimize_sprite(self, input_path: Path, output_path: Path) -> bool:
        """Optimize character sprites - preserve details but reduce colors intelligently"""
        try:
            # Use pngquant with very high quality for sprites
            # 256 colors is usually enough for pixel art sprites
            cmd = [
                'pngquant',
                '--quality=90-100',  # Very high quality
                '--speed=1',         # Slowest, best quality
                '--floyd=1',          # Best dithering
                '256',                # Max colors (enough for sprites)
                str(input_path),
                '--output', str(output_path),
                '--force'
            ]
            subprocess.run(cmd, check=True, capture_output=True)

            # Follow up with optipng for additional lossless compression
            cmd2 = ['optipng', '-o3', '-quiet', str(output_path)]
            subprocess.run(cmd2, capture_output=True)

            return True

        except Exception as e:
            print(f"Sprite optimization failed: {e}")
            return False

    def optimize_vegetation(self, input_path: Path, output_path: Path) -> bool:
        """Optimize vegetation - these can handle more compression"""
        try:
            # Vegetation has more organic shapes, can use fewer colors
            cmd = [
                'pngquant',
                '--quality=85-98',   # Slightly lower quality acceptable
                '--speed=1',
                '--floyd=0.8',        # Less dithering for organic shapes
                '256',
                str(input_path),
                '--output', str(output_path),
                '--force'
            ]
            subprocess.run(cmd, check=True, capture_output=True)

            # Additional compression
            cmd2 = ['optipng', '-o3', '-quiet', str(output_path)]
            subprocess.run(cmd2, capture_output=True)

            return True

        except Exception as e:
            print(f"Vegetation optimization failed: {e}")
            return False

    def optimize_skybox(self, input_path: Path, output_path: Path) -> bool:
        """Optimize skybox - consider JPEG for non-transparent skybox"""
        try:
            # For skybox, we can be more aggressive
            # First try PNG optimization
            cmd = [
                'pngquant',
                '--quality=80-95',   # Can be lower for distant skybox
                '--speed=1',
                '256',
                str(input_path),
                '--output', str(output_path),
                '--force'
            ]
            subprocess.run(cmd, check=True, capture_output=True)

            # Heavy compression since it's distant
            cmd2 = ['optipng', '-o7', '-quiet', str(output_path)]
            subprocess.run(cmd2, capture_output=True)

            return True

        except Exception as e:
            print(f"Skybox optimization failed: {e}")
            return False

    def optimize_texture(self, input_path: Path, output_path: Path) -> bool:
        """Optimize repeating textures - can use aggressive settings"""
        try:
            cmd = [
                'pngquant',
                '--quality=75-90',   # Lower quality OK for repeating textures
                '--speed=1',
                '128',                # Fewer colors for textures
                str(input_path),
                '--output', str(output_path),
                '--force'
            ]
            subprocess.run(cmd, check=True, capture_output=True)

            cmd2 = ['optipng', '-o5', '-quiet', str(output_path)]
            subprocess.run(cmd2, capture_output=True)

            return True

        except Exception as e:
            print(f"Texture optimization failed: {e}")
            return False

    def optimize_png_hq(self, input_path: Path, output_path: Path) -> bool:
        """High quality PNG optimization for any image"""
        try:
            cmd = [
                'pngquant',
                '--quality=85-100',
                '--speed=1',
                '256',
                str(input_path),
                '--output', str(output_path),
                '--force'
            ]
            subprocess.run(cmd, check=True, capture_output=True)

            cmd2 = ['optipng', '-o3', '-quiet', str(output_path)]
            subprocess.run(cmd2, capture_output=True)

            return True

        except Exception as e:
            print(f"HQ optimization failed: {e}")
            return False

    def optimize_audio(self, input_path: Path, output_path: Path) -> bool:
        """
        Convert WAV to OGG Vorbis with high quality
        Maintains audio fidelity while reducing size by 80-90%
        """
        try:
            output_ogg = output_path.with_suffix('.ogg')

            # Determine quality based on content
            filename = input_path.name.lower()

            if 'jungle' in filename:
                # Ambient sounds can use lower bitrate
                quality = '4'  # ~128kbps
            elif 'gunshot' in filename or 'death' in filename:
                # SFX need higher quality for impact
                quality = '6'  # ~192kbps
            else:
                quality = '5'  # ~160kbps default

            cmd = [
                'ffmpeg',
                '-i', str(input_path),
                '-c:a', 'libvorbis',
                '-q:a', quality,
                '-y',  # Overwrite
                str(output_ogg)
            ]

            subprocess.run(cmd, check=True, capture_output=True, stderr=subprocess.DEVNULL)
            return True

        except Exception as e:
            print(f"Audio optimization failed for {input_path.name}: {e}")
            return False

    def create_webp_alternative(self, input_path: Path, output_path: Path) -> bool:
        """
        Create WebP version for modern browsers
        WebP can be 25-35% smaller than PNG with same quality
        """
        try:
            output_webp = output_path.with_suffix('.webp')

            # Determine quality based on content
            filename = input_path.name.lower()

            if 'soldier' in filename:
                quality = '95'  # High quality for characters
            elif 'skybox' in filename:
                quality = '85'  # Lower for skybox
            else:
                quality = '90'  # Default

            cmd = [
                'cwebp',
                '-q', quality,
                '-alpha_q', '100',  # Preserve alpha channel quality
                '-m', '6',           # Slowest, best compression
                str(input_path),
                '-o', str(output_webp),
                '-quiet'
            ]

            subprocess.run(cmd, check=True, capture_output=True)
            return True

        except Exception as e:
            print(f"WebP creation failed: {e}")
            return False

    def optimize_all(self):
        """Run optimization on all assets"""
        tools = self.check_tools()

        if not tools['pngquant']:
            print("\n⚠️  pngquant not found! Install it for PNG optimization:")
            print("  Windows: Download from https://pngquant.org/")
            print("  Mac: brew install pngquant")
            print("  Linux: apt-get install pngquant")
            return

        print("\n" + "="*60)
        print("STARTING OPTIMIZATION - Preserving Visual Quality")
        print("="*60)

        # Process PNG files
        png_files = list(self.assets_dir.glob('*.png'))
        print(f"\nProcessing {len(png_files)} PNG files...")

        for png_file in png_files:
            print(f"  Optimizing {png_file.name}...", end=" ")
            original_size = png_file.stat().st_size

            output_path = self.output_dir / png_file.name

            # Use smart optimization
            success = self.optimize_png_smart(png_file, output_path)

            if success and output_path.exists():
                new_size = output_path.stat().st_size
                reduction = (1 - new_size/original_size) * 100
                print(f"✓ {reduction:.1f}% smaller")

                self.stats['original_size'] += original_size
                self.stats['optimized_size'] += new_size
                self.stats['files_processed'] += 1
                self.stats['savings'].append({
                    'file': png_file.name,
                    'original': original_size,
                    'optimized': new_size,
                    'reduction': reduction
                })

                # Create WebP version if tool available
                if tools.get('cwebp'):
                    self.create_webp_alternative(png_file, output_path)
            else:
                print("✗ Failed")

        # Process audio files
        if tools['ffmpeg']:
            audio_files = list(self.assets_dir.glob('*.wav'))
            print(f"\nProcessing {len(audio_files)} WAV files...")

            for audio_file in audio_files:
                print(f"  Converting {audio_file.name} to OGG...", end=" ")
                original_size = audio_file.stat().st_size

                output_path = self.output_dir / audio_file.name
                success = self.optimize_audio(audio_file, output_path)

                if success:
                    ogg_path = output_path.with_suffix('.ogg')
                    if ogg_path.exists():
                        new_size = ogg_path.stat().st_size
                        reduction = (1 - new_size/original_size) * 100
                        print(f"✓ {reduction:.1f}% smaller")

                        self.stats['original_size'] += original_size
                        self.stats['optimized_size'] += new_size
                        self.stats['files_processed'] += 1
                else:
                    print("✗ Failed")

        # Print summary
        self.print_summary()
        self.save_report()

    def print_summary(self):
        """Print optimization summary"""
        print("\n" + "="*60)
        print("OPTIMIZATION COMPLETE")
        print("="*60)

        if self.stats['files_processed'] > 0:
            total_reduction = (1 - self.stats['optimized_size']/self.stats['original_size']) * 100

            print(f"\nFiles processed: {self.stats['files_processed']}")
            print(f"Original size: {self.stats['original_size'] / (1024*1024):.2f} MB")
            print(f"Optimized size: {self.stats['optimized_size'] / (1024*1024):.2f} MB")
            print(f"Total reduction: {total_reduction:.1f}%")
            print(f"Space saved: {(self.stats['original_size'] - self.stats['optimized_size']) / (1024*1024):.2f} MB")

            print("\nTop 5 improvements:")
            sorted_savings = sorted(self.stats['savings'], key=lambda x: x['original'] - x['optimized'], reverse=True)
            for item in sorted_savings[:5]:
                saved_mb = (item['original'] - item['optimized']) / (1024*1024)
                print(f"  {item['file']}: {saved_mb:.2f} MB saved ({item['reduction']:.1f}% smaller)")

    def save_report(self):
        """Save optimization report"""
        report_path = self.output_dir / 'optimization_report.json'
        with open(report_path, 'w') as f:
            json.dump(self.stats, f, indent=2)
        print(f"\nDetailed report saved to: {report_path}")

def main():
    import sys

    # Get paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    assets_dir = project_root / 'public' / 'assets'

    # Allow custom output directory
    output_dir = sys.argv[1] if len(sys.argv) > 1 else None

    print("🎮 Terror in the Jungle - Asset Optimizer")
    print("Preserving visual quality while reducing file sizes")
    print("-" * 60)

    optimizer = AssetOptimizer(assets_dir, output_dir)
    optimizer.optimize_all()

    print("\n✅ Optimization complete!")
    print("Your original assets are unchanged.")
    print(f"Optimized versions are in: {optimizer.output_dir}")
    print("\nTo use optimized assets:")
    print("1. Test them in your game to ensure quality is preserved")
    print("2. If satisfied, copy them to your assets folder")
    print("3. Keep originals as backup in 'assets_original' folder")

if __name__ == "__main__":
    main()