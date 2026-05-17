"""
Kairo · Builders Call · poster generator.

Renders Kairo_Hiring_Poster.pdf in the Constructivist Call visual language.
"""
from __future__ import annotations
import os
from reportlab.lib.colors import Color
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import B2
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas

# ───────────────────────────── PALETTE ─────────────────────────────────────
INK       = Color(0.024, 0.024, 0.039)   # near-black bg
PAPER     = Color(0.984, 0.984, 0.969)   # bone white
PURPLE    = Color(0.357, 0.129, 0.714)   # #5b21b6 — disc + bold accent
PURPLE_HI = Color(0.486, 0.227, 0.929)   # #7c3aed — bright accent
PURPLE_SO = Color(0.769, 0.710, 0.992)   # #c4b5fd — soft tint
PURPLE_IN = Color(0.231, 0.027, 0.392)   # #3b0764 — deep shadow
DIM       = Color(0.553, 0.553, 0.588)   # muted mono labels
RULE      = Color(0.180, 0.180, 0.220)   # hairlines on ink

# ─────────────────────────── FONT REGISTRATION ─────────────────────────────
FONT_DIR = os.path.join(os.path.dirname(__file__), "_fonts")

def reg(name: str, file: str) -> str:
    pdfmetrics.registerFont(TTFont(name, os.path.join(FONT_DIR, file)))
    return name

SHOUT  = reg("KrShout",     "BigShoulders-Bold.ttf")
SHOUT_R= reg("KrShoutR",    "BigShoulders-Regular.ttf")
DISP   = reg("KrDisplay",   "Boldonse-Regular.ttf")
SERIF  = reg("KrSerifIt",   "InstrumentSerif-Italic.ttf")
SERIF_R= reg("KrSerif",     "InstrumentSerif-Regular.ttf")
MONO   = reg("KrMono",      "IBMPlexMono-Regular.ttf")
MONO_B = reg("KrMonoB",     "IBMPlexMono-Bold.ttf")
SANS   = reg("KrSans",      "InstrumentSans-Regular.ttf")
SANS_B = reg("KrSansB",     "InstrumentSans-Bold.ttf")

# ─────────────────────────── PAGE SETUP ────────────────────────────────────
PAGE_W, PAGE_H = B2          # 500 × 707 mm → 1417 × 2004 pt
MARGIN = 36 * mm
GRID_GAP = 14 * mm

# ─────────────────────────── HELPERS ───────────────────────────────────────
def set_fill(c, col):       c.setFillColor(col); c.setStrokeColor(col)
def set_stroke(c, col, w):  c.setStrokeColor(col); c.setLineWidth(w)
def text_w(s, font, size):  return pdfmetrics.stringWidth(s, font, size)
def cap_h(font, size):
    # approx cap height for BigShoulders-Bold; ReportLab does not expose
    # font metrics easily without a deeper API. ~0.72 * size is a sane
    # empirical figure for condensed sans.
    asc = pdfmetrics.getFont(font).face.ascent
    return asc / 1000.0 * size

def draw_centered(c, x_centre, y, s, font, size, col):
    c.setFont(font, size); set_fill(c, col)
    c.drawString(x_centre - text_w(s, font, size) / 2, y, s)

def draw_left(c, x, y, s, font, size, col):
    c.setFont(font, size); set_fill(c, col)
    c.drawString(x, y, s)

def draw_right(c, x_right, y, s, font, size, col):
    c.setFont(font, size); set_fill(c, col)
    c.drawString(x_right - text_w(s, font, size), y, s)

def draw_rotated(c, x, y, s, font, size, col, angle):
    c.saveState(); c.translate(x, y); c.rotate(angle)
    set_fill(c, col); c.setFont(font, size); c.drawString(0, 0, s)
    c.restoreState()

# ─────────────────────────── COMPOSITION ───────────────────────────────────
def build():
    out_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "Kairo_Hiring_Poster.pdf")
    )
    c = rl_canvas.Canvas(out_path, pagesize=(PAGE_W, PAGE_H))

    # ── 0. Field: ink background ────────────────────────────────────────
    set_fill(c, INK)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # ── 1. TOP MASTHEAD STRIP ───────────────────────────────────────────
    bar_y = PAGE_H - MARGIN
    set_stroke(c, PAPER, 0.8)
    c.line(MARGIN, bar_y, PAGE_W - MARGIN, bar_y)

    draw_left(c, MARGIN, bar_y + 7,
              "KAIRO · EDU-OS", MONO_B, 12, PAPER)
    draw_left(c, MARGIN, bar_y + 7 + 16,
              "ISSUE Nº 01  ·  CHENNAI · IN", MONO, 10, DIM)

    draw_centered(c, PAGE_W / 2, bar_y + 7,
                  "— A CALL TO BUILDERS —", MONO, 11, PURPLE_SO)

    draw_right(c, PAGE_W - MARGIN, bar_y + 7,
               "MAY · 2026", MONO_B, 12, PAPER)
    draw_right(c, PAGE_W - MARGIN, bar_y + 7 + 16,
               "VOL. ONE", MONO, 10, DIM)

    # ── 2. THE DISC — Constructivist circle in upper-right ─────────────
    # Tucked in the right column so the SHOUT owns the left.
    disc_cx = PAGE_W - MARGIN - 165 * mm
    disc_cy = PAGE_H - MARGIN - 175 * mm
    disc_r  = 110 * mm

    # Deep outer ring
    set_stroke(c, PURPLE, 5)
    c.circle(disc_cx, disc_cy, disc_r, stroke=1, fill=0)
    # Solid inner
    set_fill(c, PURPLE)
    c.circle(disc_cx, disc_cy, disc_r - 8, fill=1, stroke=0)
    # Concentric soft rings
    set_stroke(c, PURPLE_SO, 0.8)
    c.circle(disc_cx, disc_cy, disc_r - 26 * mm, stroke=1, fill=0)
    c.circle(disc_cx, disc_cy, disc_r - 46 * mm, stroke=1, fill=0)

    # Bone-white SLASH — the Constructivist diagonal bar
    c.saveState()
    c.translate(disc_cx, disc_cy)
    c.rotate(-22)
    set_fill(c, PAPER)
    c.rect(-disc_r * 0.95, -4 * mm, disc_r * 1.9, 8 * mm, fill=1, stroke=0)
    c.restoreState()

    # Inside disc — single power-word
    draw_centered(c, disc_cx, disc_cy + 22, "BUILD", DISP, 76, PAPER)
    draw_centered(c, disc_cx, disc_cy - 36, "·  WITH  US  ·", MONO_B, 12, PAPER)

    # Tiny registration crosshair at disc centre
    set_stroke(c, PAPER, 0.6)
    c.line(disc_cx - 6, disc_cy, disc_cx + 6, disc_cy)
    c.line(disc_cx, disc_cy - 6, disc_cx, disc_cy + 6)

    # Rotated label hugging the disc's upper rim
    draw_rotated(
        c, disc_cx + disc_r * 0.10, disc_cy + disc_r + 22,
        "—— OPEN POSITIONS · 04", MONO, 11, PURPLE_SO, -8,
    )

    # ── 3. THE SHOUT — left-aligned, three condensed lines, no overlap ──
    # Calibrated for BigShoulders-Bold so adjacent baselines don't touch.
    SHOUT_PT  = 200
    LINE_H    = 178          # tight but safe (BigShoulders cap-h ≈ 144)
    shout_x   = MARGIN
    # Anchor the shout so the bottom line "BUILDERS." sits a safe distance
    # above the italic paragraph block.
    italic_block_top = PAGE_H * 0.35
    base_y = italic_block_top + 38      # gap between BUILDERS. and italic

    # Three condensed lines:
    draw_left(c, shout_x, base_y + LINE_H * 2, "WE",        SHOUT, SHOUT_PT, PAPER)
    draw_left(c, shout_x, base_y + LINE_H * 1, "WANT",      SHOUT, SHOUT_PT, PAPER)
    draw_left(c, shout_x, base_y + LINE_H * 0, "BUILDERS.", SHOUT, SHOUT_PT, PURPLE_SO)

    # Tight underline bar beneath BUILDERS. Calibrated to the visual width
    # of the word so the bar reads as a typographic detail, not decoration.
    set_fill(c, PURPLE_HI)
    underline_w = text_w("BUILDERS.", SHOUT, SHOUT_PT) * 0.78
    c.rect(shout_x, base_y - 18, underline_w, 6, fill=1, stroke=0)

    # ── 4. Italic editorial paragraph below the SHOUT ───────────────────
    italic_y = italic_block_top - 8
    draw_left(c, shout_x, italic_y,
              "Designers, engineers, and inventors —",
              SERIF, 36, PAPER)
    draw_left(c, shout_x, italic_y - 44,
              "for an AI learning operating system.",
              SERIF, 36, PAPER)
    draw_left(c, shout_x, italic_y - 88,
              "No pay. Equity. All craft.",
              SERIF, 36, PURPLE_SO)

    # Small "since 2026" mark
    draw_left(c, shout_x, italic_y - 130,
              "SINCE  ·  MAY 2026", MONO, 11, DIM)

    # ── 5. CONSTRUCTIVIST DIAGONAL — bottom-right purple wedge ─────────
    # Soviet-poster style geometric mass.
    c.saveState()
    set_fill(c, PURPLE_IN)
    p = c.beginPath()
    p.moveTo(PAGE_W, 0)
    p.lineTo(PAGE_W, PAGE_H * 0.30)
    p.lineTo(PAGE_W * 0.20, 0)
    p.close()
    c.drawPath(p, fill=1, stroke=0)
    c.restoreState()

    # Thin diagonal accent line on top of the wedge (purple highlight)
    set_stroke(c, PURPLE_HI, 2.2)
    c.line(PAGE_W * 0.20, 0, PAGE_W, PAGE_H * 0.30)

    # ── 6. NUMBERED MODULES — sitting above the wedge ──────────────────
    band_y = MARGIN + 180
    rule_y = band_y + 152

    # Top hairline above the module band
    set_stroke(c, PAPER, 0.5)
    c.line(MARGIN, rule_y, PAGE_W - MARGIN, rule_y)
    # Label above the rule
    draw_left(c, MARGIN, rule_y + 8,
              "—  TO APPLY  —", MONO_B, 11, PURPLE_SO)
    draw_right(c, PAGE_W - MARGIN, rule_y + 8,
               "FOUR ROLES · REMOTE · ASYNC", MONO, 10, DIM)

    col_w = (PAGE_W - 2 * MARGIN - 3 * GRID_GAP) / 4
    modules = [
        ("01", "MISSION",
         "Build Kairo —",
         "an AI tutor that",
         "remembers minds."),
        ("02", "TERMS",
         "Volunteer. Equity.",
         "Remote. Async.",
         "Credit on every ship."),
        ("03", "STACK",
         "React · TS · Vite",
         "Express · Supabase",
         "Three.js · Framer"),
        ("04", "APPLY",
         "quro.cor@gmail.com",
         "kairo-daily-edu.app",
         "subject: I'LL BUILD."),
    ]
    for i, (num, head, l1, l2, l3) in enumerate(modules):
        x = MARGIN + i * (col_w + GRID_GAP)

        # Big folio number (Constructivist marginalia)
        draw_left(c, x, band_y + 116, num, MONO_B, 38, PURPLE_SO)
        # Marker square
        set_fill(c, PURPLE_HI)
        c.rect(x + 64, band_y + 130, 8, 8, fill=1, stroke=0)

        # Section heading
        draw_left(c, x, band_y + 92, head, MONO_B, 12, PAPER)
        # Hairline under heading
        set_stroke(c, RULE, 1.2)
        c.line(x, band_y + 84, x + 24, band_y + 84)
        # Body lines
        draw_left(c, x, band_y + 60, l1, SANS, 13, PAPER)
        draw_left(c, x, band_y + 40, l2, SANS, 13, PAPER)
        draw_left(c, x, band_y + 20, l3, SANS, 13, DIM)

    # ── 7. Side rails (rotated marginalia, like a manuscript folio) ────
    # Pushed firmly outside the content column so they never collide with
    # right-aligned text from the masthead or modules.
    draw_rotated(
        c, MARGIN - 18 * mm, PAGE_H - MARGIN - 50 * mm,
        "¶  FILE / RECRUITMENT / VOL.01",
        MONO, 9, DIM, 90,
    )
    draw_rotated(
        c, PAGE_W - MARGIN + 18 * mm, MARGIN + 70 * mm,
        "¶  OPEN UNTIL FILLED  /  CHENNAI",
        MONO, 9, DIM, -90,
    )

    # ── 8. BOTTOM UTILITY STRIP ────────────────────────────────────────
    foot_y = MARGIN - 6
    set_stroke(c, PAPER, 0.4)
    c.line(MARGIN, foot_y + 36, PAGE_W - MARGIN, foot_y + 36)
    draw_left(c, MARGIN, foot_y + 14,
              "KAIRO  ·  ACCELERATE YOUR ACADEMICS",
              MONO_B, 11, PAPER)
    draw_centered(c, PAGE_W / 2, foot_y + 14,
                  "P. 01 / 01", MONO_B, 11, PURPLE_SO)
    draw_right(c, PAGE_W - MARGIN, foot_y + 14,
               "© 2026  ·  TYPESET BY HAND",
               MONO, 10, DIM)

    c.save()
    print(f"wrote {os.path.basename(out_path)}")


if __name__ == "__main__":
    build()
