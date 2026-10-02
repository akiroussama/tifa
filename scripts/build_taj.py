"""Generate the hero illustration: the Taj Mahal seen from the reflecting pool at dusk.

Run once after changing the drawing: python scripts/build_taj.py
The geometry follows the real front elevation (in metres, 1 m = S px):
plinth 95 m wide, mausoleum 57 m wide with chamfered corners, central iwan
about 33 m high, onion dome on its drum up to the finial at about 73 m, four
minarets about 42 m high. The output is a static SVG with no script or style.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'images' / 'taj-mahal.svg'
W, H = 1200, 1000
CX = 600          # axis of symmetry
GY = 600          # top of the marble plinth
S = 7.2           # pixels per metre


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def X(m):
    return CX + m * S


def Y(m):
    return GY - m * S


def mirror(build):
    """Draw a motif for x >= 0 and its mirror image."""
    return build(1) + build(-1)


def rect(x0, y0, x1, y1, fill, extra=''):
    """A rectangle given in metres (x left/right, y bottom/top)."""
    xa, xb = sorted((X(x0), X(x1)))
    ya, yb = sorted((Y(y0), Y(y1)))
    return f'<rect x="{f(xa)}" y="{f(ya)}" width="{f(xb - xa)}" height="{f(yb - ya)}" fill="{fill}"{extra}/>'


def arch(cx, hw, y0, spring, apex, fill, extra=''):
    """A Mughal four-centred pointed arch opening, in metres."""
    l, r = X(cx - hw), X(cx + hw)
    ys, ya, yb = Y(spring), Y(apex), Y(y0)
    mx = X(cx)
    k = (ys - ya)
    return (f'<path d="M{f(l)} {f(yb)}V{f(ys)}C{f(l)} {f(ys - k * .55)} {f(mx - hw * S * .35)} {f(ya + k * .18)} {f(mx)} {f(ya)}'
            f'C{f(mx + hw * S * .35)} {f(ya + k * .18)} {f(r)} {f(ys - k * .55)} {f(r)} {f(ys)}V{f(yb)}Z" fill="{fill}"{extra}/>')


def niche(cx, hw, y0, y1, depth_fill='url(#recess)', frame='#e7cfc4'):
    """A recessed arched niche with its rectangular frame (spandrels)."""
    spring = y0 + (y1 - y0) * .62
    return (rect(cx - hw - .6, y0 - .4, cx + hw + .6, y1 + .9, frame)
            + f'<g fill="none" stroke="#c8aca6" stroke-width=".7">'
            + rect(cx - hw - .6, y0 - .4, cx + hw + .6, y1 + .9, 'none') + '</g>'
            + arch(cx, hw, y0, spring, y1, depth_fill)
            + arch(cx, hw * .62, y0, y0 + (spring - y0) * .9, y0 + (y1 - y0) * .8, '#5a4256', ' opacity=".55"'))


def kiosk(cx, base, hw, pillar_h, dome_h, finial_h, shade=False):
    """A chhatri: a domed open pavilion on slender pillars."""
    out = []
    out.append(rect(cx - hw * 1.12, base, cx + hw * 1.12, base + .9, '#ead6c9'))
    top = base + .9 + pillar_h
    out.append(rect(cx - hw, base + .9, cx + hw, top, '#59405a', ' opacity=".42"'))
    n = 4
    for i in range(n):
        px = cx - hw + (2 * hw) * i / (n - 1)
        out.append(rect(px - .28, base + .9, px + .28, top, '#f3e2d6'))
    out.append(rect(cx - hw * 1.2, top, cx + hw * 1.2, top + .7, '#efdccf'))
    # chajja (sloping eave)
    out.append(f'<path d="M{f(X(cx - hw * 1.35))} {f(Y(top))}L{f(X(cx - hw * 1.1))} {f(Y(top + .7))}H{f(X(cx + hw * 1.1))}L{f(X(cx + hw * 1.35))} {f(Y(top))}Z" fill="#dcc3b6"/>')
    db = top + .7
    l, r, m = X(cx - hw * .95), X(cx + hw * .95), X(cx)
    yb, yt = Y(db), Y(db + dome_h)
    out.append(f'<path d="M{f(l)} {f(yb)}C{f(l - hw * S * .25)} {f(yb - dome_h * S * .55)} {f(m - hw * S * .25)} {f(yt + dome_h * S * .2)} {f(m)} {f(yt)}'
               f'C{f(m + hw * S * .25)} {f(yt + dome_h * S * .2)} {f(r + hw * S * .25)} {f(yb - dome_h * S * .55)} {f(r)} {f(yb)}Z" fill="url(#{"domeSmallShade" if shade else "domeSmall"})"/>')
    out.append(f'<path d="M{f(m)} {f(yt)}V{f(Y(db + dome_h + finial_h))}" stroke="#c9a15a" stroke-width="{f(max(.9, hw * .35))}"/>')
    out.append(f'<circle cx="{f(m)}" cy="{f(yt - 1.5)}" r="{f(max(1.2, hw * .45))}" fill="#c9a15a"/>')
    return ''.join(out)


def guldasta(cx, base, h, w=.75):
    """Slender corner pinnacle crowned by a tiny bud."""
    return (rect(cx - w / 2, base, cx + w / 2, base + h, '#f1dfd3')
            + f'<path d="M{f(X(cx - w * .8))} {f(Y(base + h))}Q{f(X(cx))} {f(Y(base + h + 2.6))} {f(X(cx + w * .8))} {f(Y(base + h))}Z" fill="#ecd6c8"/>'
            + f'<path d="M{f(X(cx))} {f(Y(base + h + 2.2))}V{f(Y(base + h + 3.4))}" stroke="#c9a15a" stroke-width="1"/>')


def minaret(cx):
    out = []
    base_hw, top_hw, shaft = 2.9, 2.2, 33.5

    def hw_at(y):
        return base_hw + (top_hw - base_hw) * y / shaft
    # shaft as a slightly tapering cylinder, shaded from left (lit) to right
    out.append(f'<path d="M{f(X(cx - base_hw))} {f(Y(0))}L{f(X(cx - top_hw))} {f(Y(shaft))}H{f(X(cx + top_hw))}L{f(X(cx + base_hw))} {f(Y(0))}Z" fill="url(#cylinder)"/>')
    for frac in (-.5, 0, .5):
        out.append(f'<path d="M{f(X(cx + frac * base_hw))} {f(Y(0))}L{f(X(cx + frac * top_hw))} {f(Y(shaft))}" stroke="#c6a9a3" stroke-width=".5" opacity=".6"/>')
    # three balconies with corbels and railings
    for y in (11.5, 23, 33.5):
        hw = hw_at(y) + 1.2
        out.append(f'<path d="M{f(X(cx - hw + .9))} {f(Y(y - 1.6))}L{f(X(cx - hw))} {f(Y(y))}H{f(X(cx + hw))}L{f(X(cx + hw - .9))} {f(Y(y - 1.6))}Z" fill="#cbb0aa"/>')
        out.append(rect(cx - hw, y, cx + hw, y + .55, '#f2e1d5'))
        out.append(rect(cx - hw + .15, y + .55, cx + hw - .15, y + 1.6, '#e7d1c5'))
        out.append(f'<path d="M{f(X(cx - hw + .15))} {f(Y(y + 1.08))}H{f(X(cx + hw - .15))}" stroke="#bfa19c" stroke-width=".5"/>')
    out.append(kiosk(cx, 35.1, 2.4, 3.1, 2.6, 1.6))
    return ''.join(out)


def mausoleum():
    out = []
    # chamfered corners, drawn first and slightly in shadow
    for side in (1, -1):
        x0, x1 = 20 * side, 28.5 * side
        out.append(rect(x0, 0, x1, 29.5, 'url(#chamfer)'))
        out.append(niche(24.25 * side, 2.5, 1.4, 12.6, frame='#d9bdb4'))
        out.append(niche(24.25 * side, 2.5, 15.3, 26.4, frame='#d9bdb4'))
    # front face
    out.append(rect(-20, 0, 20, 29.5, 'url(#facade)'))
    for side in (1, -1):
        out.append(niche(14.25 * side, 3.7, 1.4, 12.6))
        out.append(niche(14.25 * side, 3.7, 15.3, 26.4))
        out.append(rect(13.9 * side, 13.3, 14.6 * side, 14.6, '#d8bcb2'))
    # string course between the two storeys
    out.append(f'<path d="M{f(X(-28.5))} {f(Y(14))}H{f(X(28.5))}" stroke="#d3b7ad" stroke-width="1"/>')
    # parapet with a fine merlon line
    out.append(rect(-28.5, 29.5, 28.5, 30.6, '#efdcd0'))
    out.append(f'<path d="M{f(X(-28.5))} {f(Y(29.5))}H{f(X(28.5))}" stroke="#c9ada6" stroke-width=".8"/>')
    # central iwan (pishtaq), rising above the flanking bays
    out.append(rect(-9, 0, 9, 33.4, 'url(#facade)'))
    out.append(rect(-9, 33.4, 9, 34.4, '#f2e1d6'))
    # calligraphy frame: two thin bands with a dark inlay between them
    out.append(f'<g fill="none" stroke-width=".8"><path d="M{f(X(-8))} {f(Y(0))}V{f(Y(32.3))}H{f(X(8))}V{f(Y(0))}" stroke="#bf9f99"/>'
               f'<path d="M{f(X(-7.1))} {f(Y(0))}V{f(Y(31.4))}H{f(X(7.1))}V{f(Y(0))}" stroke="#bf9f99"/></g>')
    out.append(f'<path d="M{f(X(-7.55))} {f(Y(0))}V{f(Y(31.85))}H{f(X(7.55))}V{f(Y(0))}" fill="none" stroke="#7d6470" stroke-width="1.6" stroke-dasharray="3 1.6 1 1.6" opacity=".7"/>')
    # the great arch, its deep recess and the doorways inside it
    out.append(arch(0, 6.2, 0, 18.5, 29.2, 'url(#recess)'))
    out.append(arch(0, 6.2, 0, 18.5, 29.2, 'none', ' stroke="#f5e6dc" stroke-width="1.6"'))
    out.append(arch(0, 4.6, 0, 16.2, 25.4, '#6b5266', ' opacity=".55"'))
    out.append(rect(-4.6, 11.4, 4.6, 12.1, '#c9adaa', ' opacity=".6"'))
    out.append(arch(0, 2.6, 0, 7.4, 10.6, '#3f2b40', ' opacity=".8"'))
    out.append(arch(-3.4, .7, 13.2, 15.4, 16.6, '#3f2b40', ' opacity=".6"'))
    out.append(arch(3.4, .7, 13.2, 15.4, 16.6, '#3f2b40', ' opacity=".6"'))
    # pinnacles flanking the iwan and marking the corners
    for side in (1, -1):
        out.append(guldasta(9 * side, 30.6, 6.2))
        out.append(guldasta(20 * side, 30.6, 3.4, .6))
        out.append(guldasta(28.5 * side, 30.6, 3.4, .6))
    return ''.join(out)


def dome():
    out = []
    # drum
    out.append(rect(-11.6, 34.4, 11.6, 41.6, 'url(#drum)'))
    out.append(rect(-12.1, 41.6, 12.1, 42.4, '#eedbcf'))
    for i in range(-3, 4):
        out.append(arch(i * 3.1, .75, 35.6, 38.4, 40, '#9d8090', ' opacity=".45"'))
    # onion dome: base 42.4 m, widest about 49 m, neck near 63 m
    # profile: slight overhang above the drum, widest at about 48.5 m, ogee to a point
    pts = [(11.0, 42.4)]
    segs = [((12.6, 43.6), (13.4, 46), (13.4, 48.5)),
            ((13.4, 53.5), (11.5, 57.2), (7.5, 60)),
            ((4.5, 62), (1.5, 63.4), (0, 66.5))]
    m = X(0)
    left = f'M{f(X(-11.0))} {f(Y(42.4))}' + ''.join(
        f'C{f(X(-a[0]))} {f(Y(a[1]))} {f(X(-b_[0]))} {f(Y(b_[1]))} {f(X(-c[0]))} {f(Y(c[1]))}' for a, b_, c in segs)
    back = [((1.5, 63.4), (4.5, 62), (7.5, 60)),
            ((11.5, 57.2), (13.4, 53.5), (13.4, 48.5)),
            ((13.4, 46), (12.6, 43.6), (11.0, 42.4))]
    right = ''.join(f'C{f(X(a[0]))} {f(Y(a[1]))} {f(X(b_[0]))} {f(Y(b_[1]))} {f(X(c[0]))} {f(Y(c[1]))}' for a, b_, c in back)
    d = left + right + 'Z'
    top_y = Y(66.5)
    out.append(f'<path d="{d}" fill="url(#dome)"/>')
    out.append(f'<path d="{d}" fill="url(#domeGlow)"/>')
    # lotus crown at the top
    out.append(f'<path d="M{f(X(-3.2))} {f(Y(61.6))}Q{f(X(-1.2))} {f(Y(62.6))} {f(X(0))} {f(Y(64.6))}Q{f(X(1.2))} {f(Y(62.6))} {f(X(3.2))} {f(Y(61.6))}" fill="none" stroke="#cfb3ad" stroke-width=".9"/>')
    # finial (kalash) in gilded bronze, ending in a crescent
    out.append(f'<path d="M{f(m)} {f(top_y)}V{f(Y(72.2))}" stroke="#c9a15a" stroke-width="1.8"/>')
    for yy, r in ((67.2, .95), (68.5, .8), (69.7, .65), (70.8, .5)):
        out.append(f'<ellipse cx="{f(m)}" cy="{f(Y(yy))}" rx="{f(r * S)}" ry="{f(r * S * .72)}" fill="#c9a15a"/>')
    cy = Y(72.6)
    out.append(f'<path d="M{f(m - 6)} {f(cy - 3)}Q{f(m)} {f(cy + 6)} {f(m + 6)} {f(cy - 3)}Q{f(m)} {f(cy + 2.4)} {f(m - 6)} {f(cy - 3)}Z" fill="#c9a15a"/>')
    return ''.join(out)


def plinth():
    out = []
    out.append(rect(-47.5, -6.6, 47.5, 0, 'url(#plinth)'))
    out.append(rect(-48.3, -.7, 48.3, 0, '#efdcd0'))
    # row of blind arches along the plinth face
    n = 30
    for i in range(n):
        cx = -45.5 + 91 * i / (n - 1)
        if abs(cx) < 3:
            continue
        out.append(arch(cx, 1.05, -5.6, -3.3, -1.7, '#c3a6a4', ' opacity=".55"'))
    out.append(rect(-50, -8.3, 50, -6.6, '#a35a4f'))
    return ''.join(out)


def cypress(x, y, h):
    w = h * .15
    return (f'<path d="M{f(x)} {f(y)}C{f(x - w * 1.05)} {f(y - h * .3)} {f(x - w * .75)} {f(y - h * .75)} {f(x)} {f(y - h)}'
            f'C{f(x + w * .75)} {f(y - h * .75)} {f(x + w * 1.05)} {f(y - h * .3)} {f(x)} {f(y)}Z" fill="url(#tree)"/>')


def treeline(y):
    """Soft canopy of the garden trees behind the terrace, on both sides."""
    out = []
    for side in (-1, 1):
        x0 = CX + side * 360
        d = f'M{f(x0)} {f(y)}'
        steps = 12
        for i in range(1, steps + 1):
            x = x0 + side * i * 22
            h = 24 + 6 * ((i * 7) % 3) - i * .8
            d += f'C{f(x - side * 20)} {f(y - h - 14)} {f(x - side * 4)} {f(y - h - 14)} {f(x)} {f(y - h)}'
        d += f'V{f(y)}Z'
        out.append(f'<path d="{d}" fill="#3a3f35" opacity=".55"/>')
    return ''.join(out)


def garden():
    """Reflecting pool, walkways and cypress rows in simple one-point perspective."""
    top = Y(-8.3)
    bot = H
    out = []
    out.append(f'<rect x="0" y="{f(top)}" width="{W}" height="{f(bot - top)}" fill="url(#lawn)"/>')

    walk = (44, 300)
    pool = (30, 190)
    for side in (1, -1):
        out.append(f'<path d="M{f(CX + side * pool[0])} {f(top)}L{f(CX + side * walk[0])} {f(top)}L{f(CX + side * walk[1])} {bot}L{f(CX + side * pool[1])} {bot}Z" fill="url(#walk)"/>')
    out.append(f'<path id="pool" d="M{f(CX - pool[0])} {f(top)}H{f(CX + pool[0])}L{f(CX + pool[1])} {bot}H{f(CX - pool[1])}Z" fill="url(#water)"/>')
    # cypress rows, larger as they come closer
    for t in (.03, .09, .16, .25, .36, .5, .68):
        y = top + (bot - top) * t
        off = walk[0] + (walk[1] - walk[0]) * t + 8 + 14 * t
        h = 22 + 120 * t
        for side in (-1, 1):
            out.append(cypress(CX + side * off, y, h))
    return ''.join(out)


def defs():
    return '''<defs>
<linearGradient id="facade" x1="0" x2="1"><stop offset="0" stop-color="#fbeadf"/><stop offset=".55" stop-color="#f3dcd0"/><stop offset="1" stop-color="#e2c5bd"/></linearGradient>
<linearGradient id="chamfer" x1="0" x2="1"><stop offset="0" stop-color="#e4c9c0"/><stop offset="1" stop-color="#cfb1ab"/></linearGradient>
<linearGradient id="plinth" x1="0" x2="1"><stop offset="0" stop-color="#f1ddd2"/><stop offset="1" stop-color="#d9bdb5"/></linearGradient>
<linearGradient id="drum" x1="0" x2="1"><stop offset="0" stop-color="#f7e5da"/><stop offset=".6" stop-color="#ead2c6"/><stop offset="1" stop-color="#cdb0ab"/></linearGradient>
<linearGradient id="cylinder" x1="0" x2="1"><stop offset="0" stop-color="#e3c9c1"/><stop offset=".3" stop-color="#fbebe0"/><stop offset=".75" stop-color="#e6cdc4"/><stop offset="1" stop-color="#c7a9a6"/></linearGradient>
<radialGradient id="dome" cx=".36" cy=".38" r=".75"><stop offset="0" stop-color="#fff3e8"/><stop offset=".45" stop-color="#f2dbcf"/><stop offset=".8" stop-color="#d9bbb4"/><stop offset="1" stop-color="#b996a0"/></radialGradient>
<linearGradient id="domeGlow" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="#f6b38a" stop-opacity=".22"/><stop offset=".5" stop-color="#f6b38a" stop-opacity="0"/></linearGradient>
<radialGradient id="domeSmall" cx=".35" cy=".4" r=".8"><stop offset="0" stop-color="#fbebe0"/><stop offset="1" stop-color="#cdb0ab"/></radialGradient>
<radialGradient id="domeSmallShade" cx=".35" cy=".4" r=".8"><stop offset="0" stop-color="#ead4c9"/><stop offset="1" stop-color="#bfa0a2"/></radialGradient>
<linearGradient id="recess" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8d6f80"/><stop offset="1" stop-color="#a8899a"/></linearGradient>
<linearGradient id="water" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f3b996"/><stop offset=".45" stop-color="#b9839a"/><stop offset="1" stop-color="#4b3463"/></linearGradient>
<linearGradient id="walk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c9a196"/><stop offset="1" stop-color="#6e5059"/></linearGradient>
<linearGradient id="lawn" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5d5f42"/><stop offset=".5" stop-color="#3f4434"/><stop offset="1" stop-color="#4a3c3a"/></linearGradient>
<linearGradient id="tree" x1="0" x2="1"><stop offset="0" stop-color="#34402f"/><stop offset="1" stop-color="#161d19"/></linearGradient>
<linearGradient id="reflFade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".55" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="fadeY" x1="0" x2="0" y1="0" y2="1"><stop offset=".72" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="fadeX" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="haze" cx=".5" cy="1" r=".6"><stop offset="0" stop-color="#ffd9b0" stop-opacity=".55"/><stop offset="1" stop-color="#ffd9b0" stop-opacity="0"/></radialGradient>
<mask id="groundFade" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="1000"><rect width="1200" height="1000" fill="url(#fadeX)"/><rect width="1200" height="1000" fill="url(#fadeY)" style="mix-blend-mode:multiply"/></mask>
<mask id="reflMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="1000"><rect x="0" y="BASE" width="1200" height="400" fill="url(#reflFadeAbs)"/></mask>
</defs>'''


def build():
    # draw order: dome behind the facade so the drum base tucks behind the iwan
    monument = (f'<g id="minarets">{minaret(-44)}{minaret(44)}</g>'
                f'{dome()}'
                f'{kiosk(-17.2, 30.6, 3.1, 4.2, 4.3, 2.4)}{kiosk(17.2, 30.6, 3.1, 4.2, 4.3, 2.4, shade=True)}'
                f'{mausoleum()}{plinth()}')
    horizon = Y(-8.3)
    top_svg = defs().replace('BASE', f(horizon)).replace(
        '</defs>',
        f'<linearGradient id="reflFadeAbs" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="{f(horizon)}" y2="{f(horizon + 330)}">'
        '<stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
        '<clipPath id="poolClip"><use href="#pool"/></clipPath></defs>')
    # the mask's style attribute would need CSP style-src; use nested groups instead
    top_svg = top_svg.replace(
        '<mask id="groundFade" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="1000"><rect width="1200" height="1000" fill="url(#fadeX)"/><rect width="1200" height="1000" fill="url(#fadeY)" style="mix-blend-mode:multiply"/></mask>',
        '<mask id="fadeYMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="1000"><rect width="1200" height="1000" fill="url(#fadeY)"/></mask>'
        '<mask id="fadeXMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="1000"><rect width="1200" height="1000" fill="url(#fadeX)"/></mask>')
    ground = garden()
    reflection = (f'<g clip-path="url(#poolClip)"><g mask="url(#reflMask)">'
                  f'<g transform="translate(0 {f(2 * horizon)}) scale(1 -1)"><use href="#monument"/></g></g>'
                  f'<path d="M{CX - 28} {f(horizon + 30)}h56M{CX - 44} {f(horizon + 80)}h88M{CX - 66} {f(horizon + 150)}h132M{CX - 98} {f(horizon + 240)}h196" stroke="#ffe6cc" stroke-width="1.2" opacity=".35"/></g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t d">'
            '<title id="t">Le Taj Mahal au crépuscule</title>'
            '<desc id="d">Vue de face du Taj Mahal depuis le bassin de réflexion : le mausolée de marbre blanc, son dôme, ses quatre minarets, les cyprès et le reflet dans l’eau.</desc>'
            f'{top_svg}'
            f'<g mask="url(#fadeXMask)"><g mask="url(#fadeYMask)">'
            f'<ellipse cx="{CX}" cy="{f(horizon)}" rx="520" ry="90" fill="url(#haze)"/>'
            f'{treeline(horizon)}<g id="monument">{monument}</g>'
            f'{ground}{reflection}'
            '</g></g></svg>\n')


if __name__ == '__main__':
    OUT.write_text(build(), encoding='utf-8')
    print(f'Wrote {OUT.relative_to(OUT.parents[2])} ({OUT.stat().st_size} bytes)')
