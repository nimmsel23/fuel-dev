#!/usr/bin/env python3
"""Erzeugt die App-Icons der Fuel-Mini-Apps (log, supplements, micros, report) nach solo-icons/<app>/.

Quelle ist das SVG je App; PNGs werden mit rsvg-convert gerendert und eingecheckt, damit
der Build selbst kein rsvg braucht. Neu erzeugen: pnpm run solo:icons
Dateien je App: icon.svg (rund, "any"), icon-192/512.png, icon-maskable-512.png und
icon-180.png (vollflächig, ohne transparente Ecken — iOS rundet selbst).
Gleiches Raster/Hintergrund wie fitness-dev/scripts/solo-icons.py, damit die Fuel-Icons
neben den Fitness-Icons als Familie erkennbar sind.
"""
import math
import subprocess
from pathlib import Path

BG = "#090b10"
ROOT = Path(__file__).resolve().parent.parent / "solo-icons"


def log(accent):
    # Teller (Ring + Innenfläche) mit Gabel links und Messer rechts
    fork = "".join(
        f'<rect x="{x}" y="132" width="10" height="64" rx="5" fill="{accent}"/>' for x in (92, 112, 132)
    ) + (
        f'<path d="M92 190h50v22a25 25 0 0 1-25 25a25 25 0 0 1-25-25Z" fill="{accent}"/>'
        f'<rect x="107" y="230" width="20" height="150" rx="10" fill="{accent}"/>'
    )
    knife = (
        f'<path d="M392 132c34 20 40 86 18 128h-34V132Z" fill="{accent}"/>'
        f'<rect x="376" y="248" width="20" height="132" rx="10" fill="{accent}"/>'
    )
    plate = (
        f'<circle cx="256" cy="256" r="98" fill="none" stroke="{accent}" stroke-width="18"/>'
        f'<circle cx="256" cy="256" r="58" fill="{accent}" opacity="0.35"/>'
    )
    return fork + knife + plate


def supplements(accent):
    # Kapsel (halb gefüllt) schräg, daneben eine runde Tablette
    cap = (
        f'<g transform="rotate(-38 236 276)">'
        f'<rect x="116" y="226" width="240" height="100" rx="50" fill="none" stroke="{accent}" stroke-width="16"/>'
        f'<path d="M236 226h70a50 50 0 0 1 0 100h-70Z" fill="{accent}"/>'
        f'</g>'
    )
    pill = (
        f'<circle cx="370" cy="148" r="46" fill="none" stroke="{accent}" stroke-width="14" opacity="0.7"/>'
        f'<rect x="334" y="141" width="72" height="14" rx="7" fill="{accent}" opacity="0.7"/>'
    )
    return cap + pill


def micros(accent):
    # Molekül: Zentrum + 6 Knoten im Sechseck, Stege dazwischen, Knoten unterschiedlich stark (= % DACH)
    cx, cy, r = 256, 256, 118
    pts = [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in range(-90, 270, 60)]
    out = [
        f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="{accent}" stroke-width="10" opacity="0.4"/>'
        for x, y in pts
    ]
    out.append(f'<circle cx="{cx}" cy="{cy}" r="38" fill="{accent}"/>')
    for (x, y), op in zip(pts, (1.0, 0.75, 0.5, 1.0, 0.6, 0.35)):
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="26" fill="{accent}" opacity="{op}"/>')
    return "".join(out)


def report(accent):
    # Blatt mit Eselsohr, Titelzeile und Tabelle (3 Zeilen, Spaltentrenner)
    out = [
        f'<path d="M148 100h150l66 66v246H148Z" fill="none" stroke="{accent}" stroke-width="16" stroke-linejoin="round"/>',
        f'<path d="M298 100v66h66" fill="none" stroke="{accent}" stroke-width="16" stroke-linejoin="round"/>',
        f'<rect x="184" y="196" width="96" height="14" rx="7" fill="{accent}"/>',
    ]
    for i, y in enumerate((246, 292, 338)):
        out.append(f'<rect x="184" y="{y}" width="144" height="12" rx="6" fill="{accent}" opacity="{0.9 - 0.2 * i:.2f}"/>')
        out.append(f'<rect x="262" y="{y - 6}" width="6" height="24" rx="3" fill="{BG}"/>')
    return "".join(out)


APPS = {
    "log": (log, "#fb923c"),
    "supplements": (supplements, "#a3e635"),
    "micros": (micros, "#f472b6"),
    "report": (report, "#38bdf8"),
}


def svg(body, rounded):
    rx = 120 if rounded else 0
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
            f'<rect width="512" height="512" rx="{rx}" fill="{BG}"/>{body}</svg>\n')


def render(src, dst, size):
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(dst), str(src)], check=True)


for name, (draw, accent) in APPS.items():
    d = ROOT / name
    d.mkdir(parents=True, exist_ok=True)
    body = draw(accent)
    (d / "icon.svg").write_text(svg(body, True))
    square = d / "_square.svg"
    square.write_text(svg(body, False))
    render(d / "icon.svg", d / "icon-192.png", 192)
    render(d / "icon.svg", d / "icon-512.png", 512)
    render(square, d / "icon-maskable-512.png", 512)
    render(square, d / "icon-180.png", 180)
    square.unlink()
    print("ok", name)
