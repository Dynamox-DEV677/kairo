"""
Google Play listing assets for Kyno (icon + feature graphic).

Builds from the real brand mark (public/kyno-logo.png — white grad-cap + orbit)
on a premium deep-purple gradient with a glow bloom, so the icon pops on the
Play grid instead of reading as a flat black square.

OUTPUT -> kairo-repo/play-store-assets/
    app-icon-512.png            512x512 full-bleed (upload to Play Console)
    feature-graphic-1024x500.png 1024x500 banner (no alpha)
    icon-preview-squircle.png    512 rounded (what it looks like on a phone)
  and (for the app itself, same new look):
    kairo_icon_192 / _512 / _512_maskable / apple-touch-icon (regenerated)
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PUB  = REPO / 'kairo-dashboard' / 'public'
OUT  = REPO / 'play-store-assets'
MARK = PUB / 'kyno-logo.png'          # white strokes, transparent bg, 353x327

# ── brand palette ────────────────────────────────────────────────────────────
DEEP   = (0x0B, 0x08, 0x18)   # near-black violet
PURPLE = (0x4A, 0x2F, 0xA8)   # --c-purple-deep
BRIGHT = (0x8B, 0x7A, 0xFF)   # glow
LITE   = (0xA5, 0xB4, 0xFC)
TEXT   = (0xFF, 0xFF, 0xFF)
SUBTX  = (0xC7, 0xD2, 0xFE)
DIMTX  = (0x9C, 0xA3, 0xAF)


def diagonal(size, tl, br):
    """Smooth 2-corner diagonal gradient via a 2x2 upscale."""
    mid = tuple((a + b) // 2 for a, b in zip(tl, br))
    g = Image.new('RGB', (2, 2))
    g.putpixel((0, 0), tl); g.putpixel((1, 0), mid)
    g.putpixel((0, 1), mid); g.putpixel((1, 1), br)
    return g.resize(size, Image.BILINEAR).convert('RGBA')


def glow(size, center, radius, color, alpha):
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(
        [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius],
        fill=color + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.55))


def load_mark(target_h):
    m = Image.open(MARK).convert('RGBA')
    scale = target_h / m.height
    return m.resize((int(m.width * scale), target_h), Image.LANCZOS)


def luminous(mark):
    """A soft white halo behind the mark so it glows on the purple."""
    halo = mark.copy().filter(ImageFilter.GaussianBlur(mark.height * 0.03))
    return halo


def load_font(sz):
    for p in (r'C:\Windows\Fonts\bahnschrift.ttf',
              r'C:\Windows\Fonts\seguisb.ttf',
              r'C:\Windows\Fonts\segoeuib.ttf',
              r'C:\Windows\Fonts\arialbd.ttf'):
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()


# ── icon ─────────────────────────────────────────────────────────────────────
def build_icon_canvas(size, mark_keep):
    bg = diagonal((size, size), (0x3A, 0x2A, 0x86), DEEP)          # purple TL -> dark BR
    canvas = Image.alpha_composite(bg, glow((size, size), (size // 2, int(size * 0.42)),
                                            int(size * 0.44), BRIGHT, 165))
    mark = load_mark(int(size * mark_keep))
    mx = (size - mark.width) // 2
    my = int(size * 0.50) - mark.height // 2
    canvas.alpha_composite(luminous(mark), (mx, my))
    canvas.alpha_composite(mark, (mx, my))
    return canvas


def squircle(canvas):
    size = canvas.size[0]
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size, size],
                                           radius=int(size * 0.2237), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), mask)
    return out


def save(img, path, rgb=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    (img.convert('RGB') if rgb else img).save(path, format='PNG', optimize=True)
    print(f'  · {path.relative_to(REPO)}  ({img.size[0]}x{img.size[1]})')


# ── feature graphic ────────────────────────────────────────────────────────────
def build_feature():
    W, H = 1024, 500
    canvas = diagonal((W, H), (0x1B, 0x11, 0x46), DEEP)
    canvas = Image.alpha_composite(canvas, glow((W, H), (int(W * 0.28), H // 2), 360, PURPLE, 150))
    canvas = Image.alpha_composite(canvas, glow((W, H), (int(W * 0.30), int(H * 0.5)), 190, BRIGHT, 90))
    canvas = Image.alpha_composite(canvas, glow((W, H), (int(W * 0.9), int(H * 0.15)), 200, LITE, 55))

    mark = load_mark(300)
    mx, my = int(W * 0.085), (H - mark.height) // 2
    canvas.alpha_composite(luminous(mark), (mx, my))
    canvas.alpha_composite(mark, (mx, my))

    d = ImageDraw.Draw(canvas)
    tx = int(W * 0.40)
    f_big = load_font(132)
    f_tag = load_font(34)
    f_sub = load_font(22)
    d.text((tx, 150), 'Kyno', font=f_big, fill=TEXT)
    d.text((tx + 3, 300), 'Your AI study partner', font=f_tag, fill=SUBTX)
    d.text((tx + 4, 348), 'Learn faster  ·  fix mistakes  ·  ace exams', font=f_sub, fill=DIMTX)
    return canvas.convert('RGB')


def main():
    if not MARK.exists():
        raise SystemExit(f'missing mark: {MARK}')
    OUT.mkdir(parents=True, exist_ok=True)
    print('Building Kyno Play Store assets...')

    # Play Console listing icon: full-bleed square (Google rounds it in the grid)
    save(build_icon_canvas(512, 0.60), OUT / 'app-icon-512.png')
    # Preview of how it looks rounded on a phone
    save(squircle(build_icon_canvas(512, 0.60)), OUT / 'icon-preview-squircle.png')
    # Feature graphic
    save(build_feature(), OUT / 'feature-graphic-1024x500.png', rgb=True)

    # Regenerate the in-app icons with the SAME new look (so phone + splash match)
    save(squircle(build_icon_canvas(192, 0.60)), PUB / 'kairo_icon_192.png')
    save(squircle(build_icon_canvas(512, 0.60)), PUB / 'kairo_icon_512.png')
    save(build_icon_canvas(512, 0.48),           PUB / 'kairo_icon_512_maskable.png')  # safe zone
    save(squircle(build_icon_canvas(180, 0.60)), PUB / 'apple-touch-icon.png')
    print('done.')


if __name__ == '__main__':
    main()
