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
from PIL import Image, ImageDraw, ImageFilter, ImageChops
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
    Apple-style icon: dark **rounded** square + radial purple glow +
    big centred logo. The corners are pre-rounded so Windows (which
    doesn't auto-round) looks just as premium as iOS/macOS.
    PWA maskable icons get the full square (no rounding) because the
    OS applies its own mask shape on top.
    """
    # iOS uses ~22.37% of icon size for its rounded-square radius.
    # Maskable icons stay square; the OS will mask them.
    corner_radius = int(size * 0.2237) if not maskable else 0

    # ── Layer 1 — dark rounded background ───────────────────────────────
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bd  = ImageDraw.Draw(img)
    if corner_radius > 0:
        bd.rounded_rectangle([0, 0, size, size],
                             radius=corner_radius, fill=INK)
    else:
        bd.rectangle([0, 0, size, size], fill=INK)

    # ── Layer 2 — radial purple glow ────────────────────────────────────
    # Larger + brighter than before so the bigger logo sits inside a
    # proper halo instead of touching the edges of a flat field.
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd   = ImageDraw.Draw(glow)
    cx, cy = size // 2, size // 2
    # Deep outer wash
    big_r = int(size * 0.55)
    gd.ellipse([cx - big_r, cy - big_r, cx + big_r, cy + big_r],
               fill=(*PURPLE_DEEP, 130))
    # Mid wash
    mid_r = int(size * 0.40)
    gd.ellipse([cx - mid_r, cy - mid_r, cx + mid_r, cy + mid_r],
               fill=(*PURPLE_HI, 110))
    # Bright core
    core_r = int(size * 0.22)
    gd.ellipse([cx - core_r, cy - core_r, cx + core_r, cy + core_r],
               fill=(*PURPLE_HI, 80))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size // 7))
    # Mask the glow to the rounded square shape so it doesn't bleed past
    # the corners on Windows.
    if corner_radius > 0:
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, size, size], radius=corner_radius, fill=255)
        glow.putalpha(ImageChops.multiply(glow.split()[3], mask))
    img = Image.alpha_composite(img, glow)

    # ── Layer 3 — the big centre logo ───────────────────────────────────
    # ~70% of icon size now (was 52%) so the brand mark dominates.
    # Maskable shrinks to 0.46 to keep important pixels inside the
    # OS-applied 80% safe zone.
    logo_scale = 0.70 if not maskable else 0.46
    logo = Image.open(LOGO_SRC).convert('RGBA')
    lw   = int(size * logo_scale)
    logo = logo.resize((lw, lw), Image.LANCZOS)
    pos  = ((size - lw) // 2, (size - lw) // 2)

    # Soft drop-shadow under the logo for Apple-like depth
    sR, sG, sB, sA = logo.split()
    black = Image.new('L', (size, size), 0)
    shadow_alpha = Image.new('L', (size, size), 0)
    shadow_alpha.paste(sA, (pos[0], pos[1] + int(size * 0.012)))
    shadow = Image.merge('RGBA', (black, black, black, shadow_alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size // 50))
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
