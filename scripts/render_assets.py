"""Renders the plugin icon and the Framer Marketplace thumbnails.

    python3 scripts/render_assets.py      (needs Pillow and node; run after `npm install`)

public/icon.png                  90 x 90 plugin icon (framer.json "icon"; Framer recommends 90 x 90 for images and
                                 rounds the corners itself), from brand/gunsnprices-icon-512.png
assets/icon-512.png              the same square icon at 512 x 512, in case a form asks for a larger icon
assets/avatar-400.png            400 x 400 creator profile picture (the size the Marketplace shows)
assets/thumbnail-1-1600x1200.png a "Guns and ammo" collection as the CMS shows it, with the values the plugin syncs
assets/thumbnail-2-1600x1200.png a "Calibers" collection and the canvas cost-per-round text

Marketplace plugin thumbnails are 1600 x 1200 (4:3): that is the size of the listing images of published plugins.
The values in the tables come from the plugin's own code (scripts/listing-data.mjs). The tables are drawn here, so
they are labeled as a mock; screenshots of the real panel are taken in Framer (see PUBLISHING_framer.md).
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND_ICON = os.environ.get("GNP_ICON", os.path.join(ROOT, "..", "brand", "gunsnprices-icon-512.png"))
ASSETS = os.path.join(ROOT, "assets")
PUBLIC = os.path.join(ROOT, "public")

ORANGE = (241, 90, 41)
INK = (30, 30, 30)
MUTED = (110, 110, 110)
LINE = (226, 226, 226)
PAPER = (247, 245, 242)
WHITE = (255, 255, 255)
HEAD = (246, 246, 246)
TINT = (0, 153, 255)

W, H = 1600, 1200

FONT_FILES = [
    ("/System/Library/Fonts/HelveticaNeue.ttc", 0, 1),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", None, None),
]


def font(size, bold=False):
    for path, regular, heavy in FONT_FILES:
        if os.path.exists(path):
            if regular is None:
                path = path.replace("DejaVuSans.ttf", "DejaVuSans-Bold.ttf") if bold else path
                return ImageFont.truetype(path, size)
            return ImageFont.truetype(path, size, index=heavy if bold else regular)
    sys.exit("no font found; edit FONT_FILES")


def fit(draw, text, fnt, width):
    """text cut with an ellipsis to fit width"""
    if draw.textlength(text, font=fnt) <= width:
        return text
    while text and draw.textlength(text + "…", font=fnt) > width:
        text = text[:-1]
    return text.rstrip(" ,") + "…"


def square_icon():
    """the brand icon as a full-bleed square: Framer masks plugin icons with its own rounded corners"""
    src = Image.open(BRAND_ICON).convert("RGBA")
    px = src.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = px[x, y]
            # the transparent corners and the dark red outer border (and its anti-aliased edge) become orange
            if a < 255 or (r < 225 and g < 80 and b > 35):
                px[x, y] = ORANGE + (255,)
    return src


def icon():
    sq = square_icon()
    os.makedirs(PUBLIC, exist_ok=True)
    sq.resize((90, 90), Image.LANCZOS).save(os.path.join(PUBLIC, "icon.png"), optimize=True)
    sq.save(os.path.join(ASSETS, "icon-512.png"), optimize=True)
    sq.resize((400, 400), Image.LANCZOS).save(os.path.join(ASSETS, "avatar-400.png"), optimize=True)
    return Image.open(BRAND_ICON).convert("RGBA")


def header(img, d, brand, subtitle):
    x, y = 90, 80
    ic = brand.resize((112, 112), Image.LANCZOS)
    img.paste(ic, (x, y), ic)
    d.text((x + 140, y + 4), "Gun & Ammo ", font=font(68, True), fill=INK)
    w = d.textlength("Gun & Ammo ", font=font(68, True))
    d.text((x + 140 + w, y + 4), "Data", font=font(68, True), fill=ORANGE)
    d.text((x + 142, y + 82), subtitle, font=font(32), fill=MUTED)
    cx, cy = x, y + 150
    for chip in ["Free", "Works offline", "Framer CMS + canvas"]:
        w = d.textlength(chip, font=font(26, True)) + 36
        d.rounded_rectangle((cx, cy, cx + w, cy + 48), radius=24, outline=ORANGE, width=3)
        d.text((cx + 18, cy + 10), chip, font=font(26, True), fill=ORANGE)
        cx += w + 14


def footer(d, counts):
    d.text(
        (90, H - 70),
        f"Data: GunsNPrices (gunsnprices.com), CC BY 4.0. Prices from the {counts['snapshot']} snapshot.",
        font=font(22),
        fill=MUTED,
    )


def table(d, x, y, w, title, meta, columns, rows, row_h=64):
    """a CMS-style table: columns = [(label, width, align)], rows = [[cell, ...]]"""
    h = 70 + 54 + row_h * len(rows) + 10
    d.rounded_rectangle((x, y, x + w, y + h), radius=16, fill=WHITE, outline=LINE, width=2)
    d.text((x + 28, y + 22), title, font=font(28, True), fill=INK)
    d.text((x + w - 28, y + 26), meta, font=font(22), fill=MUTED, anchor="ra")
    hy = y + 70
    d.rectangle((x + 2, hy, x + w - 2, hy + 54), fill=HEAD)
    cx = x + 28
    for label, cw, align in columns:
        tx = cx + cw if align == "r" else cx
        d.text((tx, hy + 15), label, font=font(21, True), fill=MUTED, anchor="ra" if align == "r" else "la")
        cx += cw + 24
    ry = hy + 54
    for row in rows:
        d.line((x + 2, ry, x + w - 2, ry), fill=LINE, width=2)
        cx = x + 28
        for (label, cw, align), cell in zip(columns, row):
            text, color, bold = cell if isinstance(cell, tuple) else (cell, INK, False)
            fnt = font(23, bold)
            text = fit(d, text, fnt, cw)
            tx = cx + cw if align == "r" else cx
            d.text((tx, ry + row_h / 2), text, font=fnt, fill=color, anchor="rm" if align == "r" else "lm")
            cx += cw + 24
        ry += row_h
    return h


CATEGORY = {"handgun": "Handgun", "rifle": "Rifle", "shotgun": "Shotgun", "ammo": "Ammo"}
CALIBER_TYPE = {"handgun": "Handgun", "rifle": "Rifle", "rimfire": "Rimfire", "shotgun": "Shotgun"}


def thumbnail_products(brand, data):
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    header(img, d, brand, "Real gun and ammo data for your Framer CMS")
    d.text((90, 330), "DESIGN MOCK · a collection synced by the plugin", font=font(22, True), fill=MUTED)
    rows = []
    for p in data["products"][:8]:
        rows.append(
            [
                (p["title"], INK, True),
                p["caliber"],
                CATEGORY[p["category"]],
                (p["priceText"], INK, True),
                (p["costPerRoundText"] or "—", ORANGE if p["costPerRoundText"] else MUTED, False),
            ]
        )
    columns = [("Title", 560, "l"), ("Caliber", 250, "l"), ("Category", 130, "l"), ("Price text", 140, "r"), ("Cost/round", 140, "r")]
    meta = f"{data['defaults']['products']['items']} items · {data['defaults']['products']['fields']} fields"
    table(d, 90, 372, W - 180, "Guns and ammo", meta, columns, rows, row_h=72)
    footer(d, data["counts"])
    img.save(os.path.join(ASSETS, "thumbnail-1-1600x1200.png"), optimize=True)


def thumbnail_calibers(brand, data):
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    header(img, d, brand, "Calibers for your CMS, cost per round on the canvas")
    d.text((90, 330), "DESIGN MOCK · a collection synced by the plugin", font=font(22, True), fill=MUTED)
    rows = []
    for c in data["calibers"][:7]:
        rows.append([(c["name"], INK, True), CALIBER_TYPE.get(c["type"], c["type"]), c["aliases"], (c["slug"], MUTED, False)])
    columns = [("Name", 240, "l"), ("Type", 110, "l"), ("Aliases", 290, "l"), ("Slug", 250, "l")]
    tw = 1020
    th = table(d, 90, 372, tw, "Calibers", f"{data['defaults']['calibers']['items']} items", columns, rows, row_h=72)

    # canvas: the text layer the plugin adds
    cx, cy, cw = 90 + tw + 40, 372, W - 180 - tw - 40
    d.rounded_rectangle((cx, cy, cx + cw, cy + th), radius=16, fill=WHITE, outline=LINE, width=2)
    d.text((cx + 28, cy + 22), "Canvas", font=font(28, True), fill=INK)
    box = data["canvas"]
    ty = cy + 90
    for line in wrap(d, box["title"], font(22), cw - 56)[:3]:
        d.text((cx + 28, ty), line, font=font(22), fill=MUTED)
        ty += 30
    # selected text layer with its blue frame
    big = box["texts"][0]
    fy = ty + 40
    tw2 = d.textlength(big, font=font(72, True))
    d.rectangle((cx + 18, fy - 12, cx + 42 + tw2, fy + 92), outline=TINT, width=3)
    d.text((cx + 30, fy), big, font=font(72, True), fill=INK)
    ly = fy + 130
    d.text((cx + 28, ly), "Other formats", font=font(21, True), fill=MUTED)
    ly += 38
    for t in box["texts"][1:]:
        for line in wrap(d, t, font(23), cw - 56):
            d.text((cx + 28, ly), line, font=font(23), fill=INK)
            ly += 32
        ly += 6
    footer(d, data["counts"])
    img.save(os.path.join(ASSETS, "thumbnail-2-1600x1200.png"), optimize=True)


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split(" "):
        test = (line + " " + word).strip()
        if draw.textlength(test, font=fnt) <= width:
            line = test
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def main():
    os.makedirs(ASSETS, exist_ok=True)
    data = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "scripts", "listing-data.mjs")], cwd=ROOT))
    brand = icon()
    thumbnail_products(brand, data)
    thumbnail_calibers(brand, data)
    for path in (
        "public/icon.png",
        "assets/icon-512.png",
        "assets/avatar-400.png",
        "assets/thumbnail-1-1600x1200.png",
        "assets/thumbnail-2-1600x1200.png",
    ):
        with Image.open(os.path.join(ROOT, path)) as im:
            print(path, im.size, os.path.getsize(os.path.join(ROOT, path)), "bytes")


if __name__ == "__main__":
    main()
