"""
Google Play listing assets for Kyno (icon + feature graphic).

Icon = the real main logo (tools/_assets/kyno_main_logo.png — white grad-cap +
orbit mark on solid black) with curved square corners. Nothing fancy, per brand:
black + rounded square.

Feature graphic = the mark + Kyno wordmark + tagline on a deep-purple banner.

OUTPUT -> kairo-repo/play-store-assets/
    app-icon-512.png             512x512 curved-square icon (upload to Play)
    icon-preview-squircle.png    same, kept for reference
    feature-graphic-1024x500.png 1024x500 banner (no alpha)
  and (in-app, same look):
    kairo_icon_192 / _512 / _512_maskable / apple-touch-icon
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PUB  = REPO / 'kairo-dashboard' / 'public'
OUT  = REPO / 'play-store-assets'
SRC  = REPO / 'tools' / '_assets' / 'kyno_main_logo.png'   # white mark on solid black
MARK = PUB / 'kyno-logo.png'                               # transparent mark (feature graphic)

RADIUS = 0.2237   # iOS-spec curved-square corner

# brand palette (feature graphic only)
DEEP, PURPLE, BRIGHT, LITE = (0x0B,0x08,0x18), (0x4A,0x2F,0xA8), (0x8B,0x7A,0xFF), (0xA5,0xB4,0xFC)
SUBTX, DIMTX = (0xC7,0xD2,0xFE), (0x9C,0xA3,0xAF)


# ── icon: the logo on a black square with curved corners ─────────────────────
def _mark_cropped():
    """Crop the source logo down to just the white mark (drop its wide black margin)."""
    src = Image.open(SRC).convert('RGBA')
    bright = src.convert('L').point(lambda p: 255 if p > 24 else 0)
    bbox = bright.getbbox()
    return src.crop(bbox) if bbox else src


def icon(size, margin_px, do_round=True):
    """The mark scaled to leave `margin_px` padding, centered on a black square."""
    mark = _mark_cropped()
    avail = size - 2 * margin_px
    mw, mh = mark.size
    scale = avail / max(mw, mh)
    nw, nh = max(1, int(mw * scale)), max(1, int(mh * scale))
    mark_r = mark.resize((nw, nh), Image.LANCZOS)
    base = Image.new('RGBA', (size, size), (0, 0, 0, 255))
    base.alpha_composite(mark_r, ((size - nw) // 2, (size - nh) // 2))
    return rounded(base) if do_round else base


def rounded(img, frac=RADIUS):
    size = img.size[0]
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size, size], radius=int(size * frac), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


# ── feature graphic (purple banner) ──────────────────────────────────────────
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
    if not SRC.exists():
        raise SystemExit(f'missing logo: {SRC}')
    OUT.mkdir(parents=True, exist_ok=True)
    print('Building Kyno Play assets (black logo, curved square)...')

    m = lambda s: max(3, round(s * 10 / 512))    # ~10px edge at 512, scaled per size

    save(icon(512, m(512)),                  OUT / 'app-icon-512.png')
    save(icon(512, m(512)),                  OUT / 'icon-preview-squircle.png')
    save(build_feature(),                    OUT / 'feature-graphic-1024x500.png', rgb=True)

    save(icon(192, m(192)),                  PUB / 'kairo_icon_192.png')
    save(icon(512, m(512)),                  PUB / 'kairo_icon_512.png')
    # Maskable keeps a safe margin so the OS circle-mask never clips the mark.
    save(icon(512, round(512 * 0.20), do_round=False), PUB / 'kairo_icon_512_maskable.png')
    save(icon(180, m(180)),                  PUB / 'apple-touch-icon.png')
    print('done.')


if __name__ == '__main__':
    main()
