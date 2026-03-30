#!/usr/bin/env python3
"""
Icon Generation Script (Python Alternative)
Converts SVG source files to PNG format for the VS Code extension

Usage: python generate-icons.py
Requires: pip install cairosvg
"""

import os
import sys
from pathlib import Path

# Try to import cairosvg
try:
    import cairosvg
except ImportError:
    print("""
╔════════════════════════════════════════════════════════════════╗
║  CairoSVG not found. Please install it first:                   ║
║                                                                 ║
║  pip install cairosvg                                           ║
║                                                                 ║
║  Or use an online converter for the SVG files:                  ║
║  - icon-source.svg → icon.png (256x256)                         ║
║  - logo-source.svg → logo.png (128x128)                         ║
╚════════════════════════════════════════════════════════════════╝
""")
    sys.exit(1)

# Get paths
SCRIPT_DIR = Path(__file__).parent.absolute()
RESOURCES_DIR = SCRIPT_DIR.parent / "resources"

ICONS = [
    {
        "name": "icon.png",
        "source": "icon-source.svg",
        "width": 256,
        "height": 256
    },
    {
        "name": "logo.png",
        "source": "logo-source.svg",
        "width": 128,
        "height": 128
    }
]


def generate_icons():
    print("🎨 Generating icons for Proactive AI Assistant...\n")

    for icon in ICONS:
        source_path = RESOURCES_DIR / icon["source"]
        output_path = RESOURCES_DIR / icon["name"]

        # Check if source exists
        if not source_path.exists():
            print(f"❌ Source file not found: {icon['source']}")
            continue

        try:
            # Read SVG
            with open(source_path, 'rb') as f:
                svg_data = f.read()

            # Convert to PNG using cairosvg
            cairosvg.svg2png(
                bytestring=svg_data,
                write_to=str(output_path),
                output_width=icon["width"],
                output_height=icon["height"]
            )

            print(f"✅ Generated {icon['name']} ({icon['width']}x{icon['height']})")
        except Exception as e:
            print(f"❌ Failed to generate {icon['name']}: {e}")

    print("\n✨ Icon generation complete!")


if __name__ == "__main__":
    generate_icons()
