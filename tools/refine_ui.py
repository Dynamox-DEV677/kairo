"""
Kairo · UI refinement pass (May 2026).

Second-stage migration that runs after `migrate_to_blue_theme.py`. The
theme migration recolours the system; this pass *quiets* it. The goal
is Apple/Arc/Linear/AI-OS — premium software, not gaming UI. We do that
by:

  1. Cutting glow intensity ~70% on every blue box-shadow.
  2. Cutting icon bloom ~70% on every blue drop-shadow filter.
  3. Pulling the brightest border tints down a notch.

Steps that involve real layout work (glass surfaces, spacing, selected
fills) are applied as targeted edits on a few showcase components —
this script only handles the diffusable, regex-friendly stuff.

  python tools/refine_ui.py [--dry-run]
"""
from __future__ import annotations
import re, sys
from pathlib import Path
from collections import Counter

REPO = Path(__file__).resolve().parents[1]
DRY  = '--dry-run' in sys.argv

ROOTS = [
    REPO / 'kairo-dashboard' / 'src',
    REPO / 'kairo-dashboard' / 'index.html',
    REPO / 'kairo-dashboard' / 'server' / 'email',
    REPO / 'kairo-electron'  / 'splash.html',
]
EXTS = {'.tsx', '.ts', '.css', '.js', '.html', '.cjs'}

# Two blue families we want to dim. Anything else (whites, blacks) is
# left alone — premium software still has crisp text shadows.
BLUE_RGB = re.compile(
    r'rgba\(\s*(?:79\s*,\s*124\s*,\s*255|42\s*,\s*79\s*,\s*224|31\s*,\s*63\s*,\s*207|32\s*,\s*70\s*,\s*194|102\s*,\s*217\s*,\s*255|165\s*,\s*180\s*,\s*252)\s*,\s*([0-9.]+)\s*\)',
    re.I,
)


def reduce_alpha(value: str, factor: float) -> tuple[str, int]:
    """Dim every blue rgba alpha inside `value` by `factor`."""
    n = 0
    def repl(m: re.Match) -> str:
        nonlocal n
        try:
            a = float(m.group(1))
        except ValueError:
            return m.group(0)
        new = a * factor
        # Round to 2 dp, drop trailing zero. Keep at least .01 visible.
        new = max(0.01, round(new, 2))
        # Format without trailing zeros: 0.10 → 0.1, 0.09 → 0.09
        text = f'{new:g}'
        # Make sure we keep a leading zero
        if text.startswith('.'):
            text = '0' + text
        n += 1
        # Replace just the alpha portion of the original rgba(...)
        original = m.group(0)
        start_alpha = original.rfind(',') + 1
        return original[:start_alpha] + f' {text})'
    return BLUE_RGB.sub(repl, value), n


# Matches  boxShadow: '...'  /  boxShadow: "..."  /  boxShadow: `...`
# Also catches the CSS `box-shadow: ...;` form.
SHADOW_RE = re.compile(
    r"""(box[Ss]hadow|box-shadow)(\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[^;,}\n]+[;,}\n])""",
    re.VERBOSE,
)
# Same idea for `filter: ...` / `filter: \`...\``
FILTER_RE = re.compile(
    r"""(filter)(\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[^;,}\n]+[;,}\n])""",
    re.VERBOSE,
)


def refine_shadows(body: str, stats: Counter) -> str:
    """Cut blue box-shadow alphas by ~70%."""
    def sub(m: re.Match) -> str:
        prop, sep, value = m.group(1), m.group(2), m.group(3)
        new_value, n = reduce_alpha(value, 0.30)
        if n:
            stats['box-shadow alphas reduced'] += n
        return prop + sep + new_value
    return SHADOW_RE.sub(sub, body)


def refine_filters(body: str, stats: Counter) -> str:
    """Cut blue drop-shadow alphas inside `filter: ...` by ~70%."""
    def sub(m: re.Match) -> str:
        prop, sep, value = m.group(1), m.group(2), m.group(3)
        # Only touch values that actually mention drop-shadow.
        if 'drop-shadow' not in value:
            return m.group(0)
        new_value, n = reduce_alpha(value, 0.30)
        if n:
            stats['drop-shadow alphas reduced'] += n
        return prop + sep + new_value
    return FILTER_RE.sub(sub, body)


# A handful of opaque-border tints can be pulled inward too, so the
# overall surface stops "glowing" along the edge.
BORDER_TINTS = {
    'rgba(79, 124, 255, 0.5)':  'rgba(79, 124, 255, 0.18)',
    'rgba(79, 124, 255, 0.4)':  'rgba(79, 124, 255, 0.14)',
    'rgba(102, 217, 255, 0.5)': 'rgba(102, 217, 255, 0.18)',
    'rgba(102, 217, 255, 0.4)': 'rgba(102, 217, 255, 0.14)',
}


def cool_borders(body: str, stats: Counter) -> str:
    for src, dst in BORDER_TINTS.items():
        n = body.count(src)
        if n:
            body = body.replace(src, dst)
            stats[f'border tint {src[:24]}…'] += n
    return body


# Match `const card[: ...] = { ... background: '#0E1117', border: '1px solid #1f2532' ... }`
# and swap the bg + border to glass. Scoped to *card* variables only so input
# fields (which share the same bg/border) stay solid and read as form fields.
CARD_BLOCK = re.compile(
    r"(const\s+card\b[^=]*=\s*\{[^}]*?)"
    r"background:\s*'#0E1117'(\s*,\s*)border:\s*'1px solid #1f2532'",
    re.S,
)
CARD_GLASS = (
    r"\1"
    r"background: 'rgba(255,255,255,0.03)',"
    r" backdropFilter: 'blur(14px) saturate(140%)',"
    r" WebkitBackdropFilter: 'blur(14px) saturate(140%)',"
    # Note: \2 already contains the original comma+space between bg and
    # border — we intentionally DON'T re-emit it. Earlier versions did
    # and produced a `,,` parse error.
    r" border: '1px solid rgba(255,255,255,0.06)'"
)


def glass_cards(body: str, stats: Counter) -> str:
    """Convert local `card` style defs to frosted-glass surfaces."""
    body, n = CARD_BLOCK.subn(CARD_GLASS, body)
    if n:
        stats['card → glass'] += n
    return body


def process(p: Path, stats: Counter) -> bool:
    try:
        original = p.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        return False
    body = original
    body = refine_shadows(body, stats)
    body = refine_filters(body, stats)
    body = cool_borders(body, stats)
    body = glass_cards(body, stats)
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
        if process(f, stats):
            changed += 1
            try:
                print(f'  · {f.relative_to(REPO)}')
            except UnicodeEncodeError:
                pass

    print(f'\n{"DRY RUN - " if DRY else ""}{changed} of {seen} files refined.')
    if stats:
        print('Summary:')
        for k, v in stats.most_common():
            # encode/decode so Windows cp1252 console doesn't choke on
            # rule labels that contain unicode arrows / ellipses
            try:
                print(f'  {v:6}  {k}')
            except UnicodeEncodeError:
                safe = k.encode('ascii', 'replace').decode('ascii')
                print(f'  {v:6}  {safe}')


if __name__ == '__main__':
    main()
