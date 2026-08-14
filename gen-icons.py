#!/usr/bin/env python3
import cairosvg
import os

svg_path = os.path.join(os.path.dirname(__file__), 'icon-src.svg')
out_dir  = os.path.join(os.path.dirname(__file__), 'icons')
os.makedirs(out_dir, exist_ok=True)

sizes = [16, 32, 180, 192, 512]
names = {
    16:  'favicon-16x16.png',
    32:  'favicon-32x32.png',
    180: 'apple-touch-icon.png',
    192: 'icon-192.png',
    512: 'icon-512.png',
}

with open(svg_path, 'rb') as f:
    svg_data = f.read()

for size in sizes:
    out_path = os.path.join(out_dir, names[size])
    cairosvg.svg2png(bytestring=svg_data, write_to=out_path, output_width=size, output_height=size)
    file_size = os.path.getsize(out_path)
    print(f"  {names[size]:30s}  {size}x{size}  {file_size:>6d} bytes  ✓")

print("\nAll icons generated successfully.")
