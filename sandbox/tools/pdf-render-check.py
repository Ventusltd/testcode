"""Independently parse and render the actual browser downloads; never author PDFs."""
import itertools
import json
import sys
from pathlib import Path
import pymupdf

directory = Path(sys.argv[1])
generation = sys.argv[2]
results = []
files = sorted(directory.glob('*.pdf'))
assert len(files) == 6, f'Expected six browser/viewport downloads, found {len(files)}'
for file in files:
    document = pymupdf.open(file)
    assert len(document) == 1, file
    page = document[0]
    spans = [span for block in page.get_text('dict')['blocks'] if 'lines' in block
             for line in block['lines'] for span in line['spans']]
    text = page.get_text()
    assert f'generation {generation}' in text, (file, text)
    assert 'OpenStreetMap' in text and 'CARTO' in text and 'UTC' in text, (file, text)
    rectangles = [pymupdf.Rect(span['bbox']) for span in spans]
    for rectangle in rectangles:
        assert page.rect.contains(rectangle), (file, 'clipped metadata', rectangle)
    for left, right in itertools.combinations(rectangles, 2):
        intersection = left & right
        assert intersection.is_empty or intersection.get_area() < 0.01, (file, 'overlapping metadata', left, right)
    images = page.get_images(full=True)
    assert len(images) == 1, (file, images)
    raster = pymupdf.Pixmap(document, images[0][0])
    assert (raster.width, raster.height) == (page.rect.width, page.rect.height), file
    # Probe decoded image pixels, independently of the JPEG header and PDF syntax.
    samples = raster.samples
    stride = max(raster.n, (len(samples) // 10000 // raster.n) * raster.n)
    colours = {samples[i:i+raster.n] for i in range(0, len(samples), stride)}
    assert len(colours) > 32, (file, 'blank or near-uniform map', len(colours))
    page.get_pixmap().save(str(file.with_suffix('.png')))
    results.append({'file': file.name, 'nativePixels': [raster.width, raster.height],
                    'metadataSpans': len(spans), 'sampledColours': len(colours), 'pass': True})
(directory / 'render-check.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
print(f'PASS {len(results)} actual PDFs: readable nonoverlapping metadata, exact generation, native raster and rendered PNGs')
