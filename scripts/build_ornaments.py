"""Generate the decorative SVG ornaments (mandala, jali lattice, toran garland, lotus).

Run once after changing a motif: python scripts/build_ornaments.py
The outputs are plain SVG files in assets/images/ and need no runtime script.
"""
from math import cos, sin, pi, radians
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'images'


def f(v):
    return f'{v:.2f}'.rstrip('0').rstrip('.')


def petal(r1, r2, w, bulge=0.45):
    """A pointed lotus petal pointing up (negative y), from radius r1 to r2."""
    mid = r1 + (r2 - r1) * bulge
    return (f'M0 {f(-r1)} C{f(w)} {f(-mid)} {f(w * .55)} {f(-r2 + (r2 - r1) * .18)} 0 {f(-r2)} '
            f'C{f(-w * .55)} {f(-r2 + (r2 - r1) * .18)} {f(-w)} {f(-mid)} 0 {f(-r1)}Z')


def ring(count, shape, offset=0):
    return ''.join(f'<path transform="rotate({f(offset + i * 360 / count)})" d="{shape}"/>' for i in range(count))


def dots(count, r, size, offset=0):
    out = []
    for i in range(count):
        a = radians(offset + i * 360 / count) - pi / 2
        out.append(f'<circle cx="{f(cos(a) * r)}" cy="{f(sin(a) * r)}" r="{f(size)}"/>')
    return ''.join(out)


def scallops(count, r, depth):
    """Outward arches around a circle, like the rim of a rangoli."""
    pts = []
    for i in range(count):
        a0 = 2 * pi * i / count - pi / 2
        a1 = 2 * pi * (i + 1) / count - pi / 2
        am = (a0 + a1) / 2
        x0, y0 = cos(a0) * r, sin(a0) * r
        x1, y1 = cos(a1) * r, sin(a1) * r
        cx, cy = cos(am) * (r + depth * 2), sin(am) * (r + depth * 2)
        pts.append(f'{"M" if i == 0 else "L"}{f(x0)} {f(y0)} Q{f(cx)} {f(cy)} {f(x1)} {f(y1)}')
    return ''.join(pts) + 'Z'


def mandala():
    g = []
    g.append('<circle r="14"/><circle r="22"/>')
    g.append(ring(8, petal(22, 58, 19)))
    g.append(ring(8, petal(30, 50, 6), 22.5))
    g.append('<circle r="64"/>')
    g.append(f'<g class="fill">{dots(16, 71, 2.6)}</g>')
    g.append('<circle r="78"/>')
    g.append(ring(16, petal(78, 132, 22)))
    g.append(ring(16, petal(86, 118, 6), 11.25))
    g.append(ring(16, petal(92, 112, 2.6)))
    g.append('<circle r="140"/><circle r="146" stroke-dasharray="2 5"/>')
    g.append(f'<path d="{scallops(32, 152, 8)}"/>')
    g.append(f'<g class="fill">{dots(32, 168, 2.4, 5.625)}</g>')
    g.append('<circle r="178"/>')
    g.append(ring(32, petal(178, 228, 16)))
    g.append(ring(32, petal(186, 216, 4.5), 5.625))
    g.append('<circle r="236"/><circle r="242"/>')
    g.append(f'<path d="{scallops(48, 248, 9)}"/>')
    g.append(ring(48, petal(266, 300, 6.5), 3.75))
    g.append(f'<g class="fill">{dots(96, 310, 1.8)}</g>')
    g.append('<circle r="318" stroke-dasharray="1 7"/>')
    body = ''.join(g)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-330 -330 660 660">'
            '<style>g{fill:none;stroke:#f2c46d;stroke-width:1.4;stroke-linejoin:round}.fill{fill:#f2c46d;stroke:none}</style>'
            f'<g>{body}</g></svg>')


def star(cx, cy, r):
    """An eight-pointed Mughal star: two interlaced squares."""
    a = [(cx + cos(radians(45 * i)) * r, cy + sin(radians(45 * i)) * r) for i in range(8)]
    sq1 = ' '.join(f'{f(x)},{f(y)}' for x, y in a[0::2])
    sq2 = ' '.join(f'{f(x)},{f(y)}' for x, y in a[1::2])
    return f'<polygon points="{sq1}"/><polygon points="{sq2}"/><circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * .3)}"/>'


def jali(color, opacity):
    s = 96
    parts = []
    for cx, cy in [(0, 0), (s, 0), (0, s), (s, s), (s / 2, s / 2)]:
        parts.append(star(cx, cy, 20))
    # Lattice bars linking the stars, and a quatrefoil at each edge midpoint.
    parts.append(f'<path d="M20 0H76M20 {s}H76M0 20V76M{s} 20V76"/>')
    parts.append(f'<path d="M14 14L34 34M82 14L62 34M14 82L34 62M82 82L62 62"/>')
    for cx, cy in [(s / 2, 0), (s / 2, s), (0, s / 2), (s, s / 2)]:
        parts.append(''.join(f'<ellipse cx="{f(cx + dx)}" cy="{f(cy + dy)}" rx="{rx}" ry="{ry}"/>'
                             for dx, dy, rx, ry in [(0, -6, 3, 6), (0, 6, 3, 6), (-6, 0, 6, 3), (6, 0, 6, 3)]))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{s}" height="{s}" viewBox="0 0 {s} {s}">'
            f'<g fill="none" stroke="{color}" stroke-opacity="{opacity}" stroke-width="1.1">{"".join(parts)}</g></svg>')


def toran():
    """One repeatable bay of a marigold garland: a swag and a hanging strand."""
    w, beads = 160, []
    marigold = ['#f59e0b', '#ea580c', '#fbbf24']
    for i in range(17):
        t = i / 16
        x = t * w
        y = 6 + 26 * 4 * t * (1 - t)
        beads.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="6.2" fill="{marigold[i % 3]}"/>'
                     f'<circle cx="{f(x)}" cy="{f(y)}" r="2.2" fill="#9a3412" fill-opacity=".45"/>')
    for j in range(6):
        y = 10 + j * 11.5
        beads.append(f'<circle cx="0" cy="{f(y)}" r="5.6" fill="{marigold[(j + 1) % 3]}"/>')
    leaves = ''.join(
        f'<path transform="translate({x} 4) rotate({r})" d="M0 0C6 6 6 16 0 24C-6 16-6 6 0 0Z" fill="#15803d"/>'
        f'<path transform="translate({x} 4) rotate({r})" d="M0 3V21" stroke="#bbf7d0" stroke-opacity=".5" stroke-width="1"/>'
        for x, r in [(40, -12), (80, 0), (120, 12)])
    bell = ('<path d="M-6 82Q0 70 6 82L8 88H-8Z" fill="#d4a24c"/><circle cy="91" r="2.4" fill="#d4a24c"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="96" viewBox="0 0 {w} 96">'
            f'<path d="M0 6Q{w / 2} 58 {w} 6" fill="none" stroke="#7c2d12" stroke-width="1.2"/>'
            f'{leaves}{"".join(beads)}<g>{bell}</g><g transform="translate({w} 0)">'
            + ''.join(f'<circle cx="0" cy="{f(10 + j * 11.5)}" r="5.6" fill="{marigold[(j + 1) % 3]}"/>' for j in range(6))
            + f'{bell}</g></svg>')


def lotus():
    p = ''.join(f'<path transform="rotate({a} 32 44)" d="M32 44C24 34 24 18 32 8C40 18 40 34 32 44Z"/>' for a in (-60, -30, 0, 30, 60))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 52">'
            f'<g fill="none" stroke="#c2410c" stroke-width="2" stroke-linejoin="round">{p}'
            '<path d="M8 46H56"/><circle cx="32" cy="49" r="1.6" fill="#c2410c"/></g></svg>')


files = {
    'mandala.svg': mandala(),
    'jali-light.svg': jali('#9a6a21', .5),
    'jali-dark.svg': jali('#f2c46d', .55),
    'toran.svg': toran(),
    'lotus.svg': lotus(),
}
for name, svg in files.items():
    (OUT / name).write_text(svg + '\n', encoding='utf-8')
    print(f'{name}: {len(svg)} bytes')
