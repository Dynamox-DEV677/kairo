"""
Kairo · Global theme migration (May 2026).

Replaces the legacy purple-neon palette with the new Apple × Arc × Linear
blue/cyan/indigo system. Walks every source file in the repo and applies
the colour mapping defined below. Idempotent — safe to re-run.

  python tools/migrate_to_blue_theme.py [--dry-run]
"""
from __future__ import annotations
import re, sys
from pathlib import Path
from collections import Counter

REPO = Path(__file__).resolve().parents[1]
DRY  = '--dry-run' in sys.argv

# Where to look. We scope explicitly to keep node_modules / dist / .git out.
ROOTS = [
    REPO / 'kairo-dashboard' / 'src',
    REPO / 'kairo-dashboard' / 'index.html',
    REPO / 'kairo-dashboard' / 'server' / 'email',
    REPO / 'kairo-electron'  / 'main.js',
    REPO / 'kairo-electron'  / 'splash.html',
    REPO / 'kairo-electron'  / 'updater.js',
    REPO / 'kairo-electron'  / 'preload.js',
]
EXTS = {'.tsx', '.ts', '.css', '.js', '.html', '.cjs'}

# ════════════════════════════════════════════════════════════════════════════
#  PALETTE MAP — old → new
# ════════════════════════════════════════════════════════════════════════════
# Hex codes are matched case-insensitively. Order matters only for prefix
# overlaps (longest first). The mapping is the heart of this migration —
# every rule below was chosen so colour relationships hold across the UI.
# ════════════════════════════════════════════════════════════════════════════
HEX = {
    # ── purple primary stack → electric-blue / cyan ──
    '#7c3aed': '#4F7CFF',   # PURPLE_HI       → PRIMARY ACCENT (electric blue)
    '#a78bfa': '#66D9FF',   # PURPLE          → SECONDARY ACCENT (cyan)
    '#c4b5fd': '#A5B4FC',   # PURPLE_SOFT     → SOFT HIGHLIGHT (indigo)
    '#e9d5ff': '#DBE7FF',   # PURPLE_LITE     → very-soft blue
    '#5b21b6': '#2046C2',   # PURPLE_DEEP     → deep blue
    '#3b0764': '#0B1530',   # PURPLE_INK      → near-black indigo
    '#1f1147': '#0B1530',   # purple selection bg → indigo
    # ── indigo-stack (some palettes used these) ──
    '#6366f1': '#4F7CFF',   # indigo-500      → PRIMARY ACCENT
    '#818cf8': '#A5B4FC',   # indigo-400      → SOFT HIGHLIGHT
    '#a5b4fc': '#A5B4FC',   # idempotent
    # ── neutrals: align to the new palette ──
    '#0a0a0a': '#050505',   # page bg         → new BG
    '#06060a': '#050505',
    '#0a0a10': '#050505',
    '#111111': '#0E1117',   # panel
    '#111':    '#0E1117',
    '#0d0d0d': '#0E1117',
    '#0c0c14': '#0E1117',
    '#0e0e16': '#0E1117',
    '#0f0f0f': '#0E1117',
    '#13131d': '#151922',   # elev surface
    '#14141f': '#151922',
    '#16161f': '#151922',
    '#161616': '#151922',
    '#1a1a1a': '#1a1f2e',
    '#1c1c1c': '#1a1f2e',
    '#1e1e1e': '#1f2532',   # hover
    '#1e1e2e': '#1f2532',
    '#1a1a26': 'rgba(255,255,255,0.06)',   # hairline border
    '#1d1d29': 'rgba(255,255,255,0.06)',
    '#22222e': 'rgba(255,255,255,0.08)',
    '#2a2a3a': 'rgba(255,255,255,0.10)',
    '#2d2d2d': 'rgba(255,255,255,0.08)',
    # ── orange / yellow streak + XP → silver / electric-blue ──
    '#fb923c': '#4F7CFF',   # streak flame    → electric blue
    '#f59e0b': '#4F7CFF',   # amber XP        → electric blue
    '#fbbf24': '#C7D2E8',   # gold XP star    → silver
    '#facc15': '#C7D2E8',
    '#78350f': '#6B7280',   # streak dim      → grey
    # ── greys: keep close, nudge to the new scale ──
    '#8a8a96': '#9CA3AF',
    '#71717a': '#9CA3AF',
    '#52525b': '#6B7280',
    '#3f3f46': '#4B5563',
    '#5a5a66': '#6B7280',
    '#c1c1c8': '#CBD5E1',
    '#a1a1aa': '#B1B5BA',
    # ── text whites/off-whites: keep as-is (#fff, #fafafa)
}

# Regex-based replacements — for rgba() and gradient stops we can't
# enumerate every alpha value, so apply via patterns.
#
# The alpha slot is matched as `([^)]+?)` (any non-paren chars, lazy) so it
# also captures JS template literal expressions like `${0.4 + audioLevel}`.
RGBA_RULES: list[tuple[re.Pattern, str]] = [
    # purple → electric-blue (any alpha)
    (re.compile(r'rgba\(\s*124\s*,\s*58\s*,\s*237\s*,\s*([^)]+?)\s*\)', re.I),
     r'rgba(79, 124, 255, \1)'),
    # purple-soft / a78bfa → cyan
    (re.compile(r'rgba\(\s*167\s*,\s*139\s*,\s*250\s*,\s*([^)]+?)\s*\)', re.I),
     r'rgba(102, 217, 255, \1)'),
    # purple-lite / c4b5fd (196,181,253) → soft indigo
    (re.compile(r'rgba\(\s*196\s*,\s*181\s*,\s*253\s*,\s*([^)]+?)\s*\)', re.I),
     r'rgba(165, 180, 252, \1)'),
    # indigo 99 102 241 → electric blue
    (re.compile(r'rgba\(\s*99\s*,\s*102\s*,\s*241\s*,\s*([^)]+?)\s*\)', re.I),
     r'rgba(79, 124, 255, \1)'),
    # indigo-400 129 140 248 → soft indigo
    (re.compile(r'rgba\(\s*129\s*,\s*140\s*,\s*248\s*,\s*([^)]+?)\s*\)', re.I),
     r'rgba(165, 180, 252, \1)'),
    # purple-deep 91 33 182 → deep blue
    (re.compile(r'rgba\(\s*91\s*,\s*33\s*,\s*182\s*,\s*([^)]+?)\s*\)', re.I),
     r'rgba(32, 70, 194, \1)'),
    # purple-ink 59 7 100 → near-black indigo
    (re.compile(r'rgba\(\s*59\s*,\s*7\s*,\s*100\s*,\s*([^)]+?)\s*\)', re.I),
     r'rgba(11, 21, 48, \1)'),
    # orange flame 251 146 60 → electric blue
    (re.compile(r'rgba\(\s*251\s*,\s*146\s*,\s*60\s*,\s*([^)]+?)\s*\)', re.I),
     r'rgba(79, 124, 255, \1)'),
    # amber 251 191 36 → silver
    (re.compile(r'rgba\(\s*251\s*,\s*191\s*,\s*36\s*,\s*([^)]+?)\s*\)', re.I),
     r'rgba(199, 210, 232, \1)'),
    # amber 250 204 21 → silver
    (re.compile(r'rgba\(\s*250\s*,\s*204\s*,\s*21\s*,\s*([^)]+?)\s*\)', re.I),
     r'rgba(199, 210, 232, \1)'),
    # Soften the glow on any rgba(79,124,255, > 0.45) — Apple-feel calls for restraint.
    # Done in a second pass below.
]

# Cap glow intensity — anything above 0.40 alpha on the new blue gets clamped.
GLOW_CLAMP = re.compile(r'rgba\(\s*79\s*,\s*124\s*,\s*255\s*,\s*0\.([5-9]\d?|4[5-9])\s*\)', re.I)


def migrate_file(p: Path, stats: Counter) -> bool:
    try:
        original = p.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        return False
    body = original

    # ── 1. hex codes (case-insensitive) ──
    # Matches both 6-char (#rrggbb) and 8-char (#rrggbbaa, alpha baked-in).
    # When an 8-char hit is found, we look up the 6-char prefix and preserve
    # the alpha suffix on the replacement (so `#7c3aed30` → `#4F7CFF30`).
    def hex_sub(m: re.Match) -> str:
        h = m.group(0).lower()
        if h in HEX:
            stats[h] += 1
            return HEX[h]
        # 8-char variant: try the 6-char prefix, keep alpha intact
        if len(h) == 9:                     # '#' + 6 + 2
            base, alpha = h[:7], h[7:]
            if base in HEX:
                new = HEX[base]
                if new.startswith('#') and len(new) == 7:
                    stats[base + '+aa'] += 1
                    return new + alpha
        return m.group(0)
    body = re.sub(r'#[0-9a-fA-F]{3,8}\b', hex_sub, body)

    # ── 2. rgba() rules ──
    for pat, repl in RGBA_RULES:
        body, n = pat.subn(repl, body)
        if n: stats[f'rgba {pat.pattern[:20]}'] += n

    # ── 3. clamp aggressive blue glows ──
    body, n = GLOW_CLAMP.subn('rgba(79, 124, 255, 0.32)', body)
    if n: stats['glow-clamp'] += n

    if body == original:
        return False
    if not DRY:
        p.write_text(body, encoding='utf-8')
    return True


def iter_files():
    for root in ROOTS:
        if root.is_file():
            if root.suffix in EXTS: yield root
        elif root.is_dir():
            for f in root.rglob('*'):
                if f.is_file() and f.suffix in EXTS:
                    yield f


def main():
    stats   = Counter()
    changed = 0
    seen    = 0
    for f in iter_files():
        seen += 1
        if migrate_file(f, stats):
            changed += 1
            try:
                print(f'  · {f.relative_to(REPO)}')
            except UnicodeEncodeError:
                pass

    print(f'\n{"DRY RUN — " if DRY else ""}{changed} of {seen} files updated.')
    if stats:
        print('Top replacements:')
        for k, v in stats.most_common(15):
            print(f'  {v:6}  {k}')


if __name__ == '__main__':
    main()
