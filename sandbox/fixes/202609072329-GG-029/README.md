# Fix 202609072329 · GG-029 and GG-027 · card arrives minimised on a phone

**Version:** gridatlas v9.147, composition `202609072329`, published at
`https://ventusltd.github.io/gridatlas/atlas/v/202609072329/`

**Predecessor:** `202609071232` (v9.146), which stays published and untouched.

## What was wrong

On a phone the project card docks as a full-width sheet over the bottom of the
map. That is where the engine draws its lines and where the layers panel
opens. Arriving expanded hid both. The owner photographed the layers label
flipping between HIDE LAYERS and LAYERS on an iPhone 16 Pro Max with nothing
else changing on screen: the toggle was firing and the panel was opening
behind the sheet.

## What changed

One change, serving two tickets. On a sheet target the card arrives with the
minimised class: its bar, its title and its restore control, nothing else. The
reader expands it when they want the numbers. Anywhere with room, the card
opens as it always did. The bar glyph agrees with the state it carries, so a
minimised card offers a plus rather than a minus that restores nothing.

Only the sld-sandbox cartridge changed. The other three are carried at their
existing hashes.

## How it was verified

`node D:\gridatlas-ci\overnight.mjs GG-027`, one browser session per shape,
closed after each: Pixel 7 portrait and landscape, Galaxy S9+ portrait and
landscape, iPhone Pro Max portrait and landscape, and desktop. The study
measures the panel wrapper identically before and after the tap, because an
earlier version of it read the two sides differently and reported a broken
control as working.

## Still open on this ticket

At 658x320 the collapse attribute never clears at all, so on the smallest
landscape screens the panel does not open regardless of the card. That is a
separate, smaller fault and stays on the register.
