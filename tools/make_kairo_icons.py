"""
Kairo icon pipeline (rev 2 — May 2026 brand refresh).

INPUT (two source PNGs in tools/_assets/):
    kairo_new_logo.png   — the new wordmark on a WHITE background
                           (gets the background stripped → transparent
                           for use everywhere inside the React app).
    kairo_electron.png   — same logo, PRE-RENDERED on a solid BLACK
                           background. We just round the corners +
                           resize for the icon-launcher set.

OUTPUT:
    kairo-dashboard/public/kairo_logo.png                transparent web logo
    kairo-dashboard/public/kairo_icon_192.png            PWA Android
    kairo-dashboard/public/kairo_icon_512.png            PWA splash + general
    kairo-dashboard/public/kairo_icon_512_maskable.png   PWA adaptive icon
    kairo-dashboard/public/apple-touch-icon.png          iOS home screen (180×180)
    kairo-electron/assets/icon.png                       1024 master
    kairo-electron/assets/icon-512.png
    kairo-electron/assets/icon-256.png
    kairo-electron/assets/icon.ico                       multi-res Windows
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

REPO   = Path(__file__).resolve().parents[1]
ASSETS = REPO / 'tools' / '_assets'

SRC_LOGO_RAW       = ASSETS / 'kairo_new_logo.png'       # white-bg source
SRC_ELECTRON_DARK  = ASSETS / 'kairo_electron.png'       # black-bg source

# ─── 1. Build the transparent web logo ─────────────────────────────────────
def make_transparent_logo() -> Image.Image:
    """
    The new-logo source has its strokes drawn on a flat white field with
    near-zero alpha — direct background-removal yields an empty image.
    Smarter route: take the ELECTRON source (white strokes on a solid
    black background) and use its luminance as the alpha channel.
    Black pixels become transparent, white pixels stay opaque white,
    grey edges become soft anti-aliased semi-transparent.

    The result is a crisp WHITE logo on a fully transparent background —
    perfect for overlay on the dark surfaces throughout the React app
    (sidebar, splash, footer, masthead, login, etc.).
    """
    src = Image.open(SRC_ELECTRON_DARK).convert('RGBA')
    r, g, b, _ = src.split()
    # Per-pixel luminance — anything that was white in the source becomes
    # opaque, anything that was black becomes transparent.
    luminance = Image.merge('RGB', (r, g, b)).convert('L')
    # Fill the RGB plane with pure white so the stroke colour stays clean
    # regardless of any source-side compression artefacts.
    white = Image.new('L', src.size, 255)
    return Image.merge('RGBA', (white, white, white, luminance))


# ─── 2. Apply iOS-style rounded corners to the dark electron source ────────
def make_squircle_icon(size: int, *, maskable: bool = False) -> Image.Image:
    """
    Take the user-supplied black-background electron PNG, scale to the
    requested icon size, then mask with an iOS-spec rounded square.
    Maskable PWA icons skip the rounding (the OS applies its own mask).
    """
    src = Image.open(SRC_ELECTRON_DARK).convert('RGBA')
    # Resize with high-quality Lanczos
    icon = src.resize((size, size), Image.LANCZOS)

    if maskable:
        return icon            # full square — OS will round it

    # iOS-spec rounded square = 22.37 % corner radius
    radius = int(size * 0.2237)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size, size], radius=radius, fill=255)

    rounded = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    rounded.paste(icon, (0, 0), mask)
    return rounded


# ─── helpers ───────────────────────────────────────────────────────────────
def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format='PNG', optimize=True)
    print(f'  · {path.relative_to(REPO)}  ({img.size[0]}x{img.size[1]})')


def main():
    if not SRC_LOGO_RAW.exists():
        raise SystemExit(f'missing source: {SRC_LOGO_RAW}')
    if not SRC_ELECTRON_DARK.exists():
        raise SystemExit(f'missing source: {SRC_ELECTRON_DARK}')

    pwa = REPO / 'kairo-dashboard' / 'public'
    ele = REPO / 'kairo-electron'  / 'assets'

    print('Generating Kairo icons (brand refresh, May 2026)...')

    # 1. Transparent web logo
    web_logo = make_transparent_logo()
    save(web_logo, pwa / 'kairo_logo.png')

    # 2. PWA — rounded squircle, 3 sizes + maskable
    save(make_squircle_icon(192),                 pwa / 'kairo_icon_192.png')
    save(make_squircle_icon(512),                 pwa / 'kairo_icon_512.png')
    save(make_squircle_icon(512, maskable=True),  pwa / 'kairo_icon_512_maskable.png')

    # 3. Apple touch (iOS home screen, same look as the Electron icon)
    save(make_squircle_icon(180),                 pwa / 'apple-touch-icon.png')

    # 4. Electron — rounded squircle
    master_1024 = make_squircle_icon(1024)
    save(master_1024,                              ele / 'icon.png')
    save(make_squircle_icon(512),                  ele / 'icon-512.png')
    save(make_squircle_icon(256),                  ele / 'icon-256.png')

    # 5. Multi-resolution .ico for Windows installers
    ico = ele / 'icon.ico'
    ico.parent.mkdir(parents=True, exist_ok=True)
    master_1024.save(
        ico, format='ICO',
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
    )
    print(f'  · {ico.relative_to(REPO)}  (multi-res)')
    print('done.')


if __name__ == '__main__':
    main()
