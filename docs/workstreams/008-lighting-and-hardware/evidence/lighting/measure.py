"""Image-space proxy: fixed interior rear ROI, not a radiometric measurement."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
root = Path(__file__).parent
# This shared interior rectangle lies inside the plate at every captured rear pose.
# Excludes LCD, room, frame, ports and narrow curved-edge highlights.
roi = (490, 260, 710, 700)
records = []
for path in sorted(root.glob('*.png')):
    if not path.name.startswith(('before-', 'final-')) or path.stem.endswith('-roi'): continue
    if '-rear' not in path.name and '-sweep-' not in path.name: continue
    image = Image.open(path).convert('RGB')
    pixels = list(image.crop(roi).getdata())
    exact = sum(min(p) == 255 for p in pixels)
    near = sum(min(p) >= 250 for p in pixels)
    luminance = sorted(0.2126*r + 0.7152*g + 0.0722*b for r,g,b in pixels)
    records.append({'file': path.name, 'sample_pixels': len(pixels), 'all_rgb_255_fraction': exact/len(pixels), 'all_rgb_at_least_250_fraction': near/len(pixels), 'srgb_luma_p10': luminance[int(len(pixels)*.1)], 'srgb_luma_p90': luminance[int(len(pixels)*.9)]})
    if path.name in ['before-black-rear-low.png','final-black-rear-low.png']:
        draw=ImageDraw.Draw(image);draw.rectangle(roi, outline='#ff3e90',width=2)
        image.save(root / path.name.replace('.png','-roi.png'))
front = []
for path in sorted(root.glob('final-*-front-*.png')):
    image = Image.open(path).convert('RGB')
    regions = {'lower_left_shell': (405,600,455,725), 'lower_right_shell': (745,600,790,725), 'wheel_lower_left': (505,630,545,680)}
    front.append({'file':path.name,'regions':{name:sum(0.2126*r+0.7152*g+0.0722*b for r,g,b in image.crop(rect).getdata())/((rect[2]-rect[0])*(rect[3]-rect[1])) for name,rect in regions.items()}})
result={'method':'Screenshot sRGB proxy. Rear ROI [490,260,710,700] manually verified inside plate; all-channel 255 and >=250 distinguish white clipping from tinted highlights. Percentiles record retained tonal range; no arbitrary acceptance threshold. Narrow rolled edge excluded. Front means are code-value luma, not physical luminance. Combined front includes separate studio IBL; key-only/fill-only disable it, so do not attribute all combined-minus-key to the fill.', 'rear_roi':roi, 'rear':records, 'front_isolation':front}
(root/'clipping-and-fill.json').write_text(json.dumps(result,indent=2)+'\n')
for phase in ['before','final']:
    samples=[x for x in records if x['file'].startswith(phase)]
    if samples: print(phase, 'max clipped', max(x['all_rgb_255_fraction'] for x in samples), 'max nearwhite', max(x['all_rgb_at_least_250_fraction'] for x in samples))
for item in front: print(item)
