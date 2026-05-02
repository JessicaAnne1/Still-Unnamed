#!/usr/bin/env python3
"""Generate Still Unnamed PWA icons from scratch with PIL."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, math, random

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
IMPACT = "/System/Library/Fonts/Supplemental/Impact.ttf"
HELVETICA = "/System/Library/Fonts/HelveticaNeue.ttc"

# Colors (matching the app)
BG = (10, 8, 12)
BG_2 = (21, 19, 14)
WARM = (232, 200, 120)
WARM_DEEP = (184, 144, 72)
INK = (244, 236, 216)
INK_DIM = (138, 129, 112)


def make_icon(size: int, maskable: bool = False):
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img, "RGBA")
    s = size

    # Subtle noise/grain
    rnd = random.Random(42)
    for _ in range(int(s * s * 0.08)):
        x = rnd.randint(0, s - 1)
        y = rnd.randint(0, s - 1)
        v = rnd.randint(-12, 12)
        r, g, b = img.getpixel((x, y))
        img.putpixel((x, y), (max(0, min(255, r + v)), max(0, min(255, g + v)), max(0, min(255, b + v))))

    # Warm radial glow top-center
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = s // 2, int(s * 0.32)
    for r in range(int(s * 0.55), 0, -8):
        a = int(60 * (1 - r / (s * 0.55)) ** 2)
        gd.ellipse((cx - r, cy - r, cx + r, cy - r // 2), fill=(232, 200, 120, a))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=s * 0.04))
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    draw = ImageDraw.Draw(img, "RGBA")

    # Darker vignette around edges
    vign = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vign)
    iters = min(40, max(1, s // 4))
    for i in range(iters):
        a = int(80 * (i / iters) ** 2)
        if i < s - 1 - i:
            vd.rectangle((i, i, s - 1 - i, s - 1 - i), outline=(0, 0, 0, a))
    vign = vign.filter(ImageFilter.GaussianBlur(radius=s * 0.04))
    img = Image.alpha_composite(img, vign)
    draw = ImageDraw.Draw(img, "RGBA")

    # Inner frame border (poster-stamp feel) — skip on maskable
    if not maskable:
        pad = int(s * 0.06)
        draw.rectangle((pad, pad, s - pad, s - pad), outline=WARM_DEEP, width=max(1, int(s * 0.005)))

    # "EST. RECENTLY" stamp at top
    try:
        small_font = ImageFont.truetype(HELVETICA, int(s * 0.045), index=2)
    except Exception:
        small_font = ImageFont.load_default()
    stamp_text = "EST. RECENTLY"
    bbox = draw.textbbox((0, 0), stamp_text, font=small_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    stamp_pad_x = int(s * 0.025)
    stamp_pad_y = int(s * 0.012)
    stamp_w = tw + 2 * stamp_pad_x
    stamp_h = th + 2 * stamp_pad_y
    stamp_layer = Image.new("RGBA", (stamp_w + 8, stamp_h + 8), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stamp_layer)
    sd.rectangle((4, 4, stamp_w + 4, stamp_h + 4), outline=WARM, width=max(1, int(s * 0.0035)))
    sd.text((4 + stamp_pad_x - bbox[0], 4 + stamp_pad_y - bbox[1]), stamp_text, font=small_font, fill=WARM)
    stamp_layer = stamp_layer.rotate(-3, resample=Image.BICUBIC, expand=True)
    sx = (s - stamp_layer.width) // 2
    sy = int(s * 0.16)
    img.paste(stamp_layer, (sx, sy), stamp_layer)

    # Wordmark "STILL" / "UNNAMED" — auto-sized to fit ~78% of canvas width
    target_w = int(s * 0.78)

    def best_font(text, max_size):
        size_px = max(8, max_size)
        f = ImageFont.load_default()
        while size_px >= 8:
            try:
                f = ImageFont.truetype(IMPACT, size_px)
            except Exception:
                return ImageFont.load_default()
            bb = draw.textbbox((0, 0), text, font=f)
            if bb[2] - bb[0] <= target_w:
                return f
            size_px -= 2
        return f

    f_still = best_font("STILL", int(s * 0.28))
    f_unnamed = best_font("UNNAMED", int(s * 0.22))

    def centered_text(text, y, fill, font):
        bb = draw.textbbox((0, 0), text, font=font)
        w = bb[2] - bb[0]
        x = (s - w) // 2 - bb[0]
        draw.text((x, y - bb[1]), text, font=font, fill=fill)
        return bb[3] - bb[1]

    block_top = int(s * 0.34)
    h1 = centered_text("STILL", block_top, INK, f_still)
    centered_text("UNNAMED", block_top + h1 + int(s * 0.02), WARM, f_unnamed)

    # Tiny italic tagline at bottom
    try:
        tag_font = ImageFont.truetype(HELVETICA, int(s * 0.034), index=10)  # italic
    except Exception:
        try:
            tag_font = ImageFont.truetype(HELVETICA, int(s * 0.034))
        except Exception:
            tag_font = ImageFont.load_default()
    tag = "formerly someone else's idea"
    tb = draw.textbbox((0, 0), tag, font=tag_font)
    tw2 = tb[2] - tb[0]
    draw.text(((s - tw2) // 2 - tb[0], int(s * 0.86) - tb[1]), tag, font=tag_font, fill=INK_DIM)

    # Subtle bottom-right decorative tick line (signature of the warm accent)
    if not maskable:
        line_y = int(s * 0.92)
        line_x1 = int(s * 0.62)
        line_x2 = int(s * 0.86)
        draw.line((line_x1, line_y, line_x2, line_y), fill=WARM, width=max(1, int(s * 0.005)))

    return img.convert("RGB")


def main():
    sizes = [
        ("icon-512.png", 512, False),
        ("icon-192.png", 192, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
        ("favicon-32.png", 32, False),
    ]
    for name, size, maskable in sizes:
        img = make_icon(size, maskable=maskable)
        path = os.path.join(OUT_DIR, name)
        img.save(path, "PNG", optimize=True)
        print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    main()
