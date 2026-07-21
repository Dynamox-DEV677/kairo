"""
Google Play listing assets for Kyno (icon + feature graphic).

Icon = the user's Canva design (tools/_assets/kyno_icon_canva.png — the mark on a
black rounded square, exported on a white canvas). We crop the white canvas away
and re-round the corners cleanly, then emit every required size.

Feature graphic = the mark + Kyno wordmark + tagline on a deep-purple banner.

OUTPUT -> kairo-repo/play-store-assets/
    app-icon-512.png             512x512 curved-square icon (upload to Play)
    icon-preview-squircle.png    same, for reference
    feature-graphic-1024x500.png 1024x500 banner (no alpha)
  and (in-app, same look):
    kairo_icon_192 / _512 / _512_maskable / apple-touch-icon
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

REPO  = Path(__file__).resolve().parents[1]
PUB   = REPO / 'kairo-dashboard' / 'public'
OUT   = REPO / 'play-store-assets'
CANVA = REPO / 'tools' / '_assets' / 'kyno_icon_canva.png'   # black icon on white canvas
MARK  = PUB / 'kyno-logo.png'                                # transparent mark (feature graphic)

RADIUS = 0.20   # curved-square corner (≈ the Canva design's rounding)

DEEP, PURPLE, BRIGHT, LITE = (0x0B,0x08,0x18), (0x4A,0x2F,0xA8), (0x8B,0x7A,0xFF), (0xA5,0xB4,0xFC)
SUBTX, DIMTX = (0xC7,0xD2,0xFE), (0x9C,0xA3,0xAF)


# ── icon (from the Canva design) ─────────────────────────────────────────────
def _canva_square():
    """Crop the white canvas away, leaving the black icon as a tight square."""
    im = Image.open(CANVA).convert('RGBA')
    bbox = im.convert('L').point(lambda p: 255 if p < 235 else 0).getbbox()
    crop = im.crop(bbox) if bbox else im
    w, h = crop.size
    s = max(w, h)
    fill = crop.getpixel((2, h // 2))            # sample the black square edge colour
    sq = Image.new('RGBA', (s, s), fill)
    sq.paste(crop, ((s - w) // 2, (s - h) // 2))
    return sq


def _round_mask(size, frac=RADIUS):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size, size], radius=int(size * frac), fill=255)
    return m


def icon(size):
    """Rounded ('curved square') icon, transparent corners."""
    base = _canva_square().resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(base, (0, 0), _round_mask(size))
    return out


def icon_full(size):
    """Full-bleed black square (maskable) — the OS applies its own mask."""
    bg = Image.new('RGBA', (size, size), (0, 0, 0, 255))
    bg.alpha_composite(icon(size))
    return bg


# ── feature graphic (deep-purple banner) ─────────────────────────────────────
def diagonal(size, tl, br):
    mid = tuple((a + b) // 2 for a, b in zip(tl, br))
    g = Image.new('RGB', (2, 2))
    g.putpixel((0, 0), tl); g.putpixel((1, 0), mid)
    g.putpixel((0, 1), mid); g.putpixel((1, 1), br)
    return g.resize(size, Image.BILINEAR).convert('RGBA')


def glow(size, center, radius, color, alpha):
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(
        [center[0]-radius, center[1]-radius, center[0]+radius, center[1]+radius], fill=color+(alpha,))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.55))


def load_mark(target_h):
    m = Image.open(MARK).convert('RGBA')
    scale = target_h / m.height
    return m.resize((int(m.width * scale), target_h), Image.LANCZOS)


def load_font(sz):
    for p in (r'C:\Windows\Fonts\bahnschrift.ttf', r'C:\Windows\Fonts\seguisb.ttf',
              r'C:\Windows\Fonts\segoeuib.ttf', r'C:\Windows\Fonts\arialbd.ttf'):
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()


def build_feature():
    W, H = 1024, 500
    c = diagonal((W, H), (0x1B, 0x11, 0x46), DEEP)
    c = Image.alpha_composite(c, glow((W, H), (int(W*0.28), H//2), 360, PURPLE, 150))
    c = Image.alpha_composite(c, glow((W, H), (int(W*0.30), int(H*0.5)), 190, BRIGHT, 90))
    c = Image.alpha_composite(c, glow((W, H), (int(W*0.9), int(H*0.15)), 200, LITE, 55))
    mark = load_mark(300)
    mx, my = int(W*0.085), (H - mark.height)//2
    c.alpha_composite(mark.filter(ImageFilter.GaussianBlur(9)), (mx, my))
    c.alpha_composite(mark, (mx, my))
    d = ImageDraw.Draw(c)
    tx = int(W*0.40)
    d.text((tx, 150), 'Kyno', font=load_font(132), fill=(255, 255, 255))
    d.text((tx+3, 300), 'Your AI study partner', font=load_font(34), fill=SUBTX)
    d.text((tx+4, 348), 'Learn faster  ·  fix mistakes  ·  ace exams', font=load_font(22), fill=DIMTX)
    return c.convert('RGB')


def save(img, path, rgb=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    (img.convert('RGB') if rgb else img).save(path, format='PNG', optimize=True)
    print(f'  · {path.relative_to(REPO)}  ({img.size[0]}x{img.size[1]})')


def main():
    if not CANVA.exists():
        raise SystemExit(f'missing icon: {CANVA}')
    OUT.mkdir(parents=True, exist_ok=True)
    print('Building Kyno Play assets from the Canva icon...')

    save(icon(512),        OUT / 'app-icon-512.png')
    save(icon(512),        OUT / 'icon-preview-squircle.png')
    save(build_feature(),  OUT / 'feature-graphic-1024x500.png', rgb=True)

    save(icon(192),        PUB / 'kairo_icon_192.png')
    save(icon(512),        PUB / 'kairo_icon_512.png')
    save(icon_full(512),   PUB / 'kairo_icon_512_maskable.png')
    save(icon(180),        PUB / 'apple-touch-icon.png')
    print('done.')


if __name__ == '__main__':
    main()
