"""
Генерация демо-обложек статей (1200×630, JPEG) и служебных изображений.
Иллюстрации абстрактные, в фирменных цветах Юнит-Ресурс (тёмно-синий #00122E, зелёный #68BC25).
Запуск: python3 scripts/make-covers.py  (нужен Pillow)
"""
import math
import random
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "covers"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = (0, 18, 46)
NAVY2 = (16, 47, 64)
GREEN = (104, 188, 37)
LIGHT = (248, 248, 249)
GRAY = (225, 228, 233)
W, H = 1200, 630
S = 2  # суперсэмплинг


def gradient(c1, c2):
    img = Image.new("RGB", (W * S, H * S), c1)
    d = ImageDraw.Draw(img)
    for y in range(H * S):
        t = y / (H * S)
        d.line([(0, y), (W * S, y)], fill=tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)))
    return img


def rack(d, x, y, w, h, rnd, dark=True):
    body = NAVY2 if dark else (210, 214, 220)
    d.rectangle([x, y, x + w, y + h], fill=body)
    inner = (x + 14 * S, y + 14 * S, x + w - 14 * S, y + h - 14 * S)
    d.rectangle(inner, fill=(10, 30, 50) if dark else (236, 238, 241))
    uy = inner[1] + 8 * S
    while uy < inner[3] - 30 * S:
        uh = rnd.choice([1, 1, 2, 2, 3]) * 18 * S
        if uy + uh > inner[3] - 8 * S:
            break
        if rnd.random() < 0.85:
            d.rectangle([inner[0] + 8 * S, uy, inner[2] - 8 * S, uy + uh - 4 * S], fill=(28, 52, 74) if dark else (250, 250, 251))
            for k in range(rnd.randint(1, 4)):
                lx = inner[0] + 20 * S + k * 14 * S
                col = GREEN if rnd.random() < 0.7 else (240, 180, 40)
                d.ellipse([lx, uy + 6 * S, lx + 6 * S, uy + 12 * S], fill=col)
            for k in range(rnd.randint(0, 10)):
                px = inner[2] - 24 * S - k * 12 * S
                d.rectangle([px, uy + 5 * S, px + 8 * S, uy + 11 * S], fill=(60, 84, 106) if dark else (200, 205, 212))
        uy += uh


def perforation(d, x, y, w, h, color):
    step = 9 * S
    for yy in range(y, y + h, step):
        for xx in range(x + ((yy // step) % 2) * step // 2, x + w, step):
            d.ellipse([xx, yy, xx + 3 * S, yy + 3 * S], fill=color)


def cables(d, rnd, n=10, colors=None):
    colors = colors or [GREEN, (80, 140, 210), (240, 180, 40), (220, 225, 230)]
    for i in range(n):
        x0 = rnd.randint(-100, W) * S
        y0 = (H + 40) * S
        x3 = rnd.randint(0, W) * S
        y3 = -40 * S
        x1 = x0 + rnd.randint(-300, 300) * S
        y1 = rnd.randint(200, 500) * S
        x2 = x3 + rnd.randint(-300, 300) * S
        y2 = rnd.randint(100, 400) * S
        pts = []
        for t in [k / 60 for k in range(61)]:
            x = (1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3 * x3
            y = (1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3 * y3
            pts.append((x, y))
        d.line(pts, fill=rnd.choice(colors), width=rnd.choice([6, 8, 10, 14]) * S, joint="curve")


def grid_bg(d, color, step=40):
    for x in range(0, W * S, step * S):
        d.line([(x, 0), (x, H * S)], fill=color, width=1 * S)
    for y in range(0, H * S, step * S):
        d.line([(0, y), (W * S, y)], fill=color, width=1 * S)


def scene(kind, seed):
    rnd = random.Random(seed)
    if kind in ("rack", "rack-light"):
        dark = kind == "rack"
        img = gradient(NAVY, (8, 40, 70)) if dark else gradient(LIGHT, (226, 230, 236))
        d = ImageDraw.Draw(img)
        grid_bg(d, (14, 36, 62) if dark else (232, 234, 238))
        n = rnd.choice([2, 3, 4])
        rw = (180 + rnd.randint(0, 60)) * S
        gap = 40 * S
        total = n * rw + (n - 1) * gap
        x = (W * S - total) // 2 + rnd.randint(-120, 120) * S
        for i in range(n):
            top = (60 + rnd.randint(0, 50)) * S
            rack(d, x + i * (rw + gap), top, rw, H * S - top + 20 * S, rnd, dark)
        d.rectangle([0, H * S - 10 * S, W * S, H * S], fill=GREEN)
    elif kind == "cables":
        img = gradient(NAVY, (4, 30, 58))
        d = ImageDraw.Draw(img)
        grid_bg(d, (12, 34, 60), 30)
        cables(d, rnd, 14)
    elif kind == "power":
        img = gradient(LIGHT, (230, 233, 238))
        d = ImageDraw.Draw(img)
        bx, by, bw, bh = 140 * S, 230 * S, 920 * S, 170 * S
        d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=10 * S, fill=NAVY2)
        d.rectangle([bx + 20 * S, by + 30 * S, bx + 160 * S, by + bh - 30 * S], fill=(10, 30, 50))
        d.text((bx + 34 * S, by + 60 * S), "", fill=GREEN)
        for k in range(3):
            d.rectangle([bx + 34 * S, by + (48 + k * 26) * S, bx + (110 - k * 18) * S, by + (60 + k * 26) * S], fill=GREEN)
        for i in range(8):
            sx = bx + (200 + i * 92) * S
            d.rounded_rectangle([sx, by + 40 * S, sx + 70 * S, by + 130 * S], radius=8 * S, fill=(235, 238, 242))
            d.ellipse([sx + 18 * S, by + 70 * S, sx + 28 * S, by + 80 * S], fill=NAVY)
            d.ellipse([sx + 42 * S, by + 70 * S, sx + 52 * S, by + 80 * S], fill=NAVY)
            d.ellipse([sx + 30 * S, by + 50 * S, sx + 40 * S, by + 58 * S], fill=GREEN if rnd.random() < 0.7 else (200, 200, 200))
        for i in range(rnd.randint(3, 6)):
            sx = bx + (235 + rnd.randint(0, 7) * 92) * S
            d.line([(sx, by), (sx + rnd.randint(-120, 120) * S, 0)], fill=rnd.choice([NAVY, (60, 70, 90), GREEN]), width=12 * S)
    elif kind == "aisle":
        img = gradient((214, 236, 250), (240, 246, 250))
        d = ImageDraw.Draw(img)
        vx, vy = W * S // 2, int(H * S * 0.42)
        for side in (-1, 1):
            for i in range(6):
                f0 = 1 - i / 6
                f1 = 1 - (i + 1) / 6
                x0 = vx + side * int((W * S // 2) * f0)
                x1 = vx + side * int((W * S // 2) * f1)
                y0t = vy - int(vy * f0)
                y1t = vy - int(vy * f1)
                y0b = vy + int((H * S - vy) * f0)
                y1b = vy + int((H * S - vy) * f1)
                d.polygon([(x0, y0t), (x1, y1t), (x1, y1b), (x0, y0b)], fill=NAVY2 if i % 2 == 0 else (24, 58, 78))
                for k in range(8):
                    ty = y1t + (y1b - y1t) * (k + 1) / 9
                    d.ellipse([x1 - side * 10 * S - 3 * S, ty - 3 * S, x1 - side * 10 * S + 3 * S, ty + 3 * S], fill=GREEN)
        d.polygon([(0, H * S), (W * S, H * S), (vx + 40 * S, vy + 30 * S), (vx - 40 * S, vy + 30 * S)], fill=(200, 210, 220))
        for k in range(12):
            y = vy + 30 * S + int((H * S - vy) * (k / 12) ** 2)
            d.line([(0, y), (W * S, y)], fill=(185, 196, 208), width=2 * S)
    elif kind == "fiber":
        img = gradient((2, 10, 26), NAVY)
        d = ImageDraw.Draw(img)
        for i in range(26):
            y = rnd.randint(0, H) * S
            amp = rnd.randint(20, 90) * S
            ph = rnd.random() * math.pi * 2
            freq = rnd.randint(180, 420) * S
            col = rnd.choice([GREEN, (120, 220, 80), (80, 160, 255), (255, 255, 255)])
            pts = [(x, y + amp * math.sin(x / freq + ph)) for x in range(0, W * S + 20, 20)]
            d.line(pts, fill=col, width=rnd.choice([1, 2, 2, 3]) * S)
        img = img.filter(ImageFilter.GaussianBlur(0.6 * S))
    else:  # blueprint
        img = gradient((10, 40, 74), NAVY)
        d = ImageDraw.Draw(img)
        grid_bg(d, (26, 62, 98), 24)
        grid_bg(d, (40, 82, 124), 120)
        for i in range(rnd.randint(4, 7)):
            x = rnd.randint(80, 900) * S
            y = rnd.randint(60, 420) * S
            w = rnd.randint(120, 300) * S
            h = rnd.randint(80, 180) * S
            d.rectangle([x, y, x + w, y + h], outline=(180, 210, 240), width=2 * S)
            perforation(d, x + 10 * S, y + 10 * S, min(w - 20 * S, 120 * S), min(h - 20 * S, 60 * S), (90, 130, 170))
        for i in range(5):
            x = rnd.randint(60, 1100) * S
            d.line([(x, 40 * S), (x, (H - 40) * S)], fill=GREEN, width=3 * S)
    return img.resize((W, H), Image.LANCZOS)


def article_covers():
    src = (ROOT / "src" / "content" / "mock" / "articles.ts").read_text(encoding="utf-8")
    names = sorted(set(re.findall(r'cover: "([a-z0-9-]+)"', src)))
    kinds = {
        "server-rack-choice": "rack", "pdu-types": "power", "cold-aisle": "aisle", "copper-vs-fiber": "fiber",
        "grounding": "blueprint", "wall-cabinet": "rack-light", "ups-calc": "power", "cable-labels": "cables",
        "colocation": "rack", "cable-management": "cables", "server-room-checklist": "blueprint",
        "patch-panels": "rack-light", "climate-sensors": "aisle", "outdoor-cabinet": "rack-light",
        "redundancy": "power", "rack-mounting": "rack", "fiber-patch": "fiber", "heat-load": "aisle",
        "rack-vs-cabinet": "rack-light", "datasheet": "blueprint", "pue": "aisle", "industrial-cable": "cables",
        "blanking-panels": "rack", "access-control": "rack-light", "cable-entry": "cables",
    }
    for i, name in enumerate(names):
        scene(kinds.get(name, "blueprint"), seed=1000 + i * 17).save(OUT / f"{name}.jpg", quality=84, optimize=True, progressive=True)
    print(f"обложек: {len(names)}")


def logo(size):
    img = Image.new("RGBA", (27 * 40, 24 * 40), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)
    k = 40
    d.polygon([(0, 0), (4 * k, 0), (4 * k, 20 * k), (7 * k, 20 * k), (7 * k, 9 * k), (11 * k, 9 * k), (11 * k, 24 * k), (0, 24 * k)], fill=NAVY2)
    d.rectangle([8 * k, 0, 12 * k, 6 * k], fill=NAVY2)
    d.rectangle([14 * k, 0, 18 * k, 24 * k], fill=GREEN)
    d.pieslice([14 * k, 0, 27 * k, int(11.4 * k)], -90, 90, fill=GREEN)
    d.rectangle([14 * k, 0, 21 * k, int(11.4 * k)], fill=GREEN)
    d.ellipse([18 * k, int(3.6 * k), int(23.4 * k), 8 * k], fill=(255, 255, 255, 0))
    d.rectangle([18 * k, int(3.6 * k), 21 * k, 8 * k], fill=(255, 255, 255, 0))
    d.polygon([(int(19.5 * k), int(11.4 * k)), (int(23.4 * k), int(10.8 * k)), (27 * k, 24 * k), (int(22.7 * k), 24 * k)], fill=GREEN)
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    lw = int(size * 0.7)
    lg = img.resize((lw, int(lw * 24 / 27)), Image.LANCZOS)
    canvas.alpha_composite(lg, ((size - lg.width) // 2, (size - lg.height) // 2))
    return canvas


def og_default():
    img = scene("rack", 7).convert("RGBA")
    ov = Image.new("RGBA", img.size, (0, 18, 46, 150))
    img = Image.alpha_composite(img, ov)
    lg = logo(240)
    img.alpha_composite(lg, (W // 2 - 120, H // 2 - 120))
    img.convert("RGB").save(ROOT / "public" / "og-default.jpg", quality=86)


if __name__ == "__main__":
    article_covers()
    logo(512).convert("RGB").save(ROOT / "public" / "logo-unitr.png")
    og_default()
