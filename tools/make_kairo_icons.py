"""
Generate Kairo's Apple-style app icon set.

Dark squircle background + soft purple glow + the Kairo wordmark centred —
matches the rest of the brand. Produces every size the PWA and Electron
builder need.

Output paths:
  kairo-dashboard/public/kairo_icon_192.png          PWA Android home screen
  kairo-dashboard/public/kairo_icon_512.png          PWA splash + general
  kairo-dashboard/public/kairo_icon_512_maskable.png PWA Android adaptive
  kairo-dashboard/public/apple-touch-icon.png        180x180 iOS home screen
  kairo-electron/assets/icon.png                     1024 master
  kairo-electron/assets/icon-512.png                 512 Linux
  kairo-electron/assets/icon-256.png                 256 fallback
  kairo-electron/assets/icon.ico                     multi-res Windows
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
LOGO_SRC = REPO / 'kairo-dashboard' / 'public' / 'kairo_logo.png'

# Brand palette
INK         = (6, 6, 10, 255)
PURPLE_DEEP = (59, 7, 100)
PURPLE_HI   = (124, 58, 237)
PURPLE_SOFT = (196, 181, 253)

def make_icon(size: int, *, maskable: bool = False) -> Image.Image:
    """
    Apple-style icon: dark square + radial purple glow + centred logo.
    The OS rounds the corners on iOS/macOS. PWA maskable icons need a
    safe inner zone, so we shrink the logo when maskable=True.
    """
    # Base — solid ink
    img = Image.new('RGBA', (size, size), INK)

    # ── Radial glow behind the logo ──────────────────────────────────────
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd   = ImageDraw.Draw(glow)
    # Two-pass glow for premium feel: large faint deep purple + smaller
    # bright purple in the centre.
    big_r = int(size * 0.50)
    cx, cy = size // 2, size // 2
    gd.ellipse([cx - big_r, cy - big_r, cx + big_r, cy + big_r],
               fill=(*PURPLE_DEEP, 110))
    small_r = int(size * 0.30)
    gd.ellipse([cx - small_r, cy - small_r, cx + small_r, cy + small_r],
               fill=(*PURPLE_HI, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size // 8))
    img = Image.alpha_composite(img, glow)

    # ── Centre logo ──────────────────────────────────────────────────────
    # Maskable icons need to keep important pixels inside the inner 80% so
    # the OS can crop into a circle, squircle, or rounded rect without
    # eating the artwork.
    logo_scale = 0.52 if not maskable else 0.40
    logo = Image.open(LOGO_SRC).convert('RGBA')
    lw   = int(size * logo_scale)
    logo = logo.resize((lw, lw), Image.LANCZOS)
    pos  = ((size - lw) // 2, (size - lw) // 2)
    # Soft drop-shadow under the logo for extra Apple-like depth
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd     = ImageDraw.Draw(shadow)
    sd.rectangle([0, 0, size, size], fill=(0, 0, 0, 0))
    shadow.paste(logo, (pos[0], pos[1] + int(size * 0.015)), logo)
    # Black-out the shadow's RGB so it reads as a darker shape
    sR, sG, sB, sA = shadow.split()
    black = Image.new('L', (size, size), 0)
    shadow = Image.merge('RGBA', (black, black, black, sA))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size // 60))
    img = Image.alpha_composite(img, shadow)
    img.paste(logo, pos, logo)

    return img


def save(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format='PNG', optimize=True)
    print(f'  · {path.relative_to(REPO)}  ({img.size[0]}x{img.size[1]})')


def main():
    print('Generating Kairo icon set...')
    # ── PWA ─────────────────────────────────────────────────────────────
    pwa = REPO / 'kairo-dashboard' / 'public'
    save(make_icon(192),                            pwa / 'kairo_icon_192.png')
    save(make_icon(512),                            pwa / 'kairo_icon_512.png')
    save(make_icon(512, maskable=True),             pwa / 'kairo_icon_512_maskable.png')
    save(make_icon(180),                            pwa / 'apple-touch-icon.png')

    # ── Electron ───────────────────────────────────────────────────────
    ele = REPO / 'kairo-electron' / 'assets'
    master_1024 = make_icon(1024)
    save(master_1024,                               ele / 'icon.png')
    save(make_icon(512),                            ele / 'icon-512.png')
    save(make_icon(256),                            ele / 'icon-256.png')

    # ── Windows .ico (multi-resolution) ────────────────────────────────
    ico_path = ele / 'icon.ico'
    ico_path.parent.mkdir(parents=True, exist_ok=True)
    master_1024.save(
        ico_path, format='ICO',
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
    )
    print(f'  · {ico_path.relative_to(REPO)}  (multi-res)')

    print('done.')


if __name__ == '__main__':
    main()
