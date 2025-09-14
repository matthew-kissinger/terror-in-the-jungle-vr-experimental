#!/usr/bin/env python3
"""
Asset Analysis Script for Terror in the Jungle
Analyzes PNG and audio assets for optimization opportunities
"""

import os
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple
import hashlib

# Try to import PIL for image analysis
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("Warning: PIL not installed. Install with 'pip install Pillow' for detailed image analysis")

# Try to import mutagen for audio analysis
try:
    import mutagen
    from mutagen import File as AudioFile
    HAS_MUTAGEN = True
except ImportError:
    HAS_MUTAGEN = False
    print("Warning: mutagen not installed. Install with 'pip install mutagen' for audio analysis")

class AssetAnalyzer:
    def __init__(self, assets_dir: str):
        self.assets_dir = Path(assets_dir)
        self.png_files = []
        self.audio_files = []
        self.analysis_results = {
            'timestamp': datetime.now().isoformat(),
            'png_assets': {},
            'audio_assets': {},
            'summary': {},
            'recommendations': []
        }

    def discover_assets(self):
        """Discover all PNG and audio files in the assets directory"""
        # Find PNG files
        self.png_files = list(self.assets_dir.glob('*.png'))

        # Find audio files
        audio_extensions = ['*.wav', '*.mp3', '*.ogg']
        for ext in audio_extensions:
            self.audio_files.extend(self.assets_dir.glob(ext))

        print(f"Found {len(self.png_files)} PNG files")
        print(f"Found {len(self.audio_files)} audio files")

    def analyze_png(self, file_path: Path) -> Dict:
        """Analyze a single PNG file"""
        result = {
            'name': file_path.name,
            'path': str(file_path),
            'size_bytes': file_path.stat().st_size,
            'size_kb': round(file_path.stat().st_size / 1024, 2),
            'size_mb': round(file_path.stat().st_size / (1024 * 1024), 3),
        }

        if HAS_PIL:
            try:
                with Image.open(file_path) as img:
                    result['dimensions'] = f"{img.width}x{img.height}"
                    result['width'] = img.width
                    result['height'] = img.height
                    result['mode'] = img.mode
                    result['format'] = img.format
                    result['has_transparency'] = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
                    result['pixels'] = img.width * img.height
                    result['megapixels'] = round(result['pixels'] / 1_000_000, 2)

                    # Calculate compression ratio estimate
                    uncompressed_size = img.width * img.height * (4 if result['has_transparency'] else 3)
                    result['compression_ratio'] = round(uncompressed_size / result['size_bytes'], 2)

                    # Category detection based on filename
                    name_lower = file_path.name.lower()
                    if 'soldier' in name_lower:
                        result['category'] = 'soldier'
                    elif any(tree in name_lower for tree in ['dipterocarp', 'banyan', 'coconut', 'palm', 'tree']):
                        result['category'] = 'tree'
                    elif any(plant in name_lower for plant in ['fern', 'elephant', 'grass']):
                        result['category'] = 'foliage'
                    elif 'skybox' in name_lower:
                        result['category'] = 'skybox'
                    elif 'floor' in name_lower:
                        result['category'] = 'terrain'
                    elif 'first-person' in name_lower:
                        result['category'] = 'ui'
                    else:
                        result['category'] = 'misc'

                    # Optimization potential
                    if result['size_kb'] > 500:
                        result['optimization'] = 'HIGH - Large file size'
                    elif result['size_kb'] > 200:
                        result['optimization'] = 'MEDIUM - Could be compressed'
                    else:
                        result['optimization'] = 'LOW - Already optimized'

            except Exception as e:
                result['error'] = str(e)

        return result

    def analyze_audio(self, file_path: Path) -> Dict:
        """Analyze a single audio file"""
        result = {
            'name': file_path.name,
            'path': str(file_path),
            'size_bytes': file_path.stat().st_size,
            'size_kb': round(file_path.stat().st_size / 1024, 2),
            'size_mb': round(file_path.stat().st_size / (1024 * 1024), 3),
            'extension': file_path.suffix
        }

        if HAS_MUTAGEN:
            try:
                audio = AudioFile(file_path)
                if audio:
                    result['duration'] = round(audio.info.length, 2) if hasattr(audio.info, 'length') else 'N/A'
                    result['bitrate'] = audio.info.bitrate if hasattr(audio.info, 'bitrate') else 'N/A'
                    result['sample_rate'] = audio.info.sample_rate if hasattr(audio.info, 'sample_rate') else 'N/A'
                    result['channels'] = audio.info.channels if hasattr(audio.info, 'channels') else 'N/A'

                    # Category based on filename
                    name_lower = file_path.name.lower()
                    if 'gunshot' in name_lower:
                        result['category'] = 'weapon'
                    elif 'death' in name_lower:
                        result['category'] = 'death'
                    elif 'jungle' in name_lower:
                        result['category'] = 'ambient'
                    else:
                        result['category'] = 'misc'

            except Exception as e:
                result['error'] = str(e)

        return result

    def run_analysis(self):
        """Run complete analysis on all assets"""
        self.discover_assets()

        # Analyze PNG files
        total_png_size = 0
        categories = {}

        for png_file in self.png_files:
            analysis = self.analyze_png(png_file)
            self.analysis_results['png_assets'][png_file.name] = analysis
            total_png_size += analysis['size_bytes']

            # Track by category
            cat = analysis.get('category', 'misc')
            if cat not in categories:
                categories[cat] = {'count': 0, 'total_size': 0, 'files': []}
            categories[cat]['count'] += 1
            categories[cat]['total_size'] += analysis['size_bytes']
            categories[cat]['files'].append(png_file.name)

        # Analyze audio files
        total_audio_size = 0
        audio_categories = {}

        for audio_file in self.audio_files:
            analysis = self.analyze_audio(audio_file)
            self.analysis_results['audio_assets'][audio_file.name] = analysis
            total_audio_size += analysis['size_bytes']

            # Track by category
            cat = analysis.get('category', 'misc')
            if cat not in audio_categories:
                audio_categories[cat] = {'count': 0, 'total_size': 0, 'files': []}
            audio_categories[cat]['count'] += 1
            audio_categories[cat]['total_size'] += analysis['size_bytes']
            audio_categories[cat]['files'].append(audio_file.name)

        # Generate summary
        self.analysis_results['summary'] = {
            'total_png_files': len(self.png_files),
            'total_png_size_mb': round(total_png_size / (1024 * 1024), 2),
            'total_audio_files': len(self.audio_files),
            'total_audio_size_mb': round(total_audio_size / (1024 * 1024), 2),
            'total_assets': len(self.png_files) + len(self.audio_files),
            'total_size_mb': round((total_png_size + total_audio_size) / (1024 * 1024), 2),
            'png_categories': categories,
            'audio_categories': audio_categories
        }

        # Generate recommendations
        self.generate_recommendations()

    def generate_recommendations(self):
        """Generate optimization recommendations"""
        recommendations = []

        # Check for large PNG files
        large_pngs = [
            (name, data) for name, data in self.analysis_results['png_assets'].items()
            if data['size_kb'] > 200
        ]

        if large_pngs:
            recommendations.append({
                'priority': 'HIGH',
                'category': 'PNG Optimization',
                'issue': f"Found {len(large_pngs)} PNG files larger than 200KB",
                'files': [f"{name} ({data['size_kb']}KB)" for name, data in large_pngs],
                'solution': 'Use pngquant or TinyPNG to compress these files (60-80% size reduction possible)'
            })

        # Check for oversized sprites
        if HAS_PIL:
            oversized = [
                (name, data) for name, data in self.analysis_results['png_assets'].items()
                if data.get('width', 0) > 512 or data.get('height', 0) > 512
            ]

            if oversized:
                recommendations.append({
                    'priority': 'MEDIUM',
                    'category': 'Texture Resolution',
                    'issue': f"Found {len(oversized)} textures larger than 512px",
                    'files': [f"{name} ({data.get('dimensions', 'unknown')})" for name, data in oversized],
                    'solution': 'Consider reducing resolution for pixel art style (256x256 or smaller)'
                })

        # Check for uncompressed audio
        wav_files = [
            (name, data) for name, data in self.analysis_results['audio_assets'].items()
            if data.get('extension') == '.wav'
        ]

        if wav_files:
            recommendations.append({
                'priority': 'HIGH',
                'category': 'Audio Compression',
                'issue': f"Found {len(wav_files)} uncompressed WAV files",
                'files': [f"{name} ({data['size_mb']}MB)" for name, data in wav_files],
                'solution': 'Convert to OGG Vorbis for 70-90% size reduction with minimal quality loss'
            })

        # Texture atlas recommendation
        soldier_count = len([
            name for name in self.analysis_results['png_assets']
            if 'soldier' in name.lower()
        ])

        if soldier_count > 4:
            recommendations.append({
                'priority': 'MEDIUM',
                'category': 'Texture Atlas',
                'issue': f"Found {soldier_count} separate soldier sprites",
                'solution': 'Consider combining into texture atlases to reduce draw calls'
            })

        # Loading optimization
        total_size = self.analysis_results['summary']['total_size_mb']
        if total_size > 10:
            recommendations.append({
                'priority': 'HIGH',
                'category': 'Loading Performance',
                'issue': f"Total asset size is {total_size}MB",
                'solution': 'Implement progressive loading with priority queue (critical assets first)'
            })

        self.analysis_results['recommendations'] = recommendations

    def save_report(self, output_path: str = None):
        """Save analysis report to JSON and markdown"""
        if not output_path:
            output_path = Path(__file__).parent / 'asset_analysis_report'
        else:
            output_path = Path(output_path)

        # Save JSON report
        json_path = output_path.with_suffix('.json')
        with open(json_path, 'w') as f:
            json.dump(self.analysis_results, f, indent=2)

        # Generate and save markdown report
        md_content = self.generate_markdown_report()
        md_path = output_path.with_suffix('.md')
        with open(md_path, 'w') as f:
            f.write(md_content)

        print(f"\nReports saved:")
        print(f"  JSON: {json_path}")
        print(f"  Markdown: {md_path}")

        return md_path

    def generate_markdown_report(self) -> str:
        """Generate a formatted markdown report"""
        lines = []
        lines.append("# Asset Analysis Report - Terror in the Jungle")
        lines.append(f"\nGenerated: {self.analysis_results['timestamp']}")
        lines.append("\n## Summary")

        summary = self.analysis_results['summary']
        lines.append(f"\n- **Total Assets**: {summary['total_assets']}")
        lines.append(f"- **Total Size**: {summary['total_size_mb']}MB")
        lines.append(f"- **PNG Files**: {summary['total_png_files']} ({summary['total_png_size_mb']}MB)")
        lines.append(f"- **Audio Files**: {summary['total_audio_files']} ({summary['total_audio_size_mb']}MB)")

        # PNG breakdown
        lines.append("\n## PNG Assets by Category")
        for cat, data in summary['png_categories'].items():
            size_mb = round(data['total_size'] / (1024 * 1024), 2)
            lines.append(f"\n### {cat.capitalize()} ({data['count']} files, {size_mb}MB)")
            for file in data['files']:
                file_data = self.analysis_results['png_assets'][file]
                dims = file_data.get('dimensions', 'N/A')
                lines.append(f"- {file}: {file_data['size_kb']}KB, {dims}")

        # Audio breakdown
        lines.append("\n## Audio Assets")
        for name, data in self.analysis_results['audio_assets'].items():
            duration = data.get('duration', 'N/A')
            lines.append(f"- {name}: {data['size_kb']}KB, {duration}s")

        # Recommendations
        lines.append("\n## Optimization Recommendations")
        for rec in self.analysis_results['recommendations']:
            lines.append(f"\n### [{rec['priority']}] {rec['category']}")
            lines.append(f"**Issue**: {rec['issue']}")
            if 'files' in rec:
                lines.append("\n**Affected Files**:")
                for file in rec['files'][:5]:  # Show first 5
                    lines.append(f"- {file}")
                if len(rec['files']) > 5:
                    lines.append(f"- ...and {len(rec['files']) - 5} more")
            lines.append(f"\n**Solution**: {rec['solution']}")

        return '\n'.join(lines)

def main():
    # Get the assets directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    assets_dir = project_root / 'public' / 'assets'

    if not assets_dir.exists():
        print(f"Error: Assets directory not found at {assets_dir}")
        sys.exit(1)

    print(f"Analyzing assets in: {assets_dir}")
    print("-" * 50)

    # Run analysis
    analyzer = AssetAnalyzer(assets_dir)
    analyzer.run_analysis()

    # Save report
    report_path = analyzer.save_report()

    # Print summary
    print("\n" + "=" * 50)
    print("ANALYSIS COMPLETE")
    print("=" * 50)

    summary = analyzer.analysis_results['summary']
    print(f"\nTotal Assets: {summary['total_assets']}")
    print(f"Total Size: {summary['total_size_mb']}MB")

    if analyzer.analysis_results['recommendations']:
        print(f"\n⚠️  Found {len(analyzer.analysis_results['recommendations'])} optimization opportunities")
        print("Check the full report for details.")

if __name__ == "__main__":
    main()