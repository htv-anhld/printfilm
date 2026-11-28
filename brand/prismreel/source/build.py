"""Dựng bộ logo Prismreel (SVG) từ biểu tượng chữ P dải phim + chữ đã chuyển nét."""
import json, pathlib, sys
OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
W = json.load(open(pathlib.Path(__file__).parent / "word.json"))
INK, VIOLET, MAGENTA, ORANGE, NIGHT, PAPER = "#1A1530", "#8B3DFF", "#E23D9B", "#FF8A1A", "#14102A", "#F7F5FB"

HOLES = [(46, 19.5), (57, 18), (68, 16.5), (79, 15), (69, 74.5), (58, 76), (47, 77.7)]
TOP = "M30 69 V48 Q30 28 50 25 L78 21 Q106 17 106 47 Q106 74 82 78"
LOW = "M88 77.2 L48 82.6 Q30 85 30 103 V134"
CUT = "M0 0 H140 V126 L48 120 L0 132 Z"

def holes(fill, opacity="0.82"):
    rects = "".join(f'<rect x="{x-3}" y="{y-2.3}" width="6" height="4.6" rx="1.2" transform="rotate(-8 {x} {y})"/>' for x, y in HOLES)
    return f'<g fill="{fill}" fill-opacity="{opacity}">{rects}</g>'

def mark(uid, mono=None, hole_fill="#FFFFFF"):
    """Biểu tượng trong hệ toạ độ 0..140. mono = màu đơn sắc (lỗ khoét trong suốt)."""
    if mono:
        mask = (f'<mask id="m{uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="140" height="140">'
                f'<rect width="140" height="140" fill="#fff"/>{holes("#000", "1")}</mask>')
        body = (f'<g clip-path="url(#c{uid})" mask="url(#m{uid})" fill="none" stroke="{mono}" stroke-width="24">'
                f'<path d="{TOP}" stroke-linejoin="round"/><path d="{LOW}" stroke-linejoin="round"/></g>')
        return f'<defs><clipPath id="c{uid}"><path d="{CUT}"/></clipPath>{mask}</defs>{body}'
    defs = (f'<defs><linearGradient id="t{uid}" x1="30" y1="0" x2="106" y2="0" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="#C026FF"/><stop offset="0.6" stop-color="{VIOLET}"/><stop offset="1" stop-color="#7A35F0"/></linearGradient>'
            f'<linearGradient id="l{uid}" x1="90" y1="76" x2="26" y2="130" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="#8239F8"/><stop offset="0.12" stop-color="#8239F8"/><stop offset="0.38" stop-color="{MAGENTA}"/><stop offset="1" stop-color="{ORANGE}"/></linearGradient>'
            f'<clipPath id="c{uid}"><path d="{CUT}"/></clipPath></defs>')
    body = (f'<g clip-path="url(#c{uid})" fill="none" stroke-width="24" stroke-linejoin="round">'
            f'<path d="{TOP}" stroke="url(#t{uid})"/><path d="{LOW}" stroke="url(#l{uid})"/></g>{holes(hole_fill)}')
    return defs + body

def word(color, x, baseline, cap):
    s = cap / W["capHeight"]
    return f'<path transform="translate({x:.2f} {baseline - W["ascent"]*s:.2f}) scale({s:.5f})" fill="{color}" d="{W["d"]}"/>'

def svg(vb, inner, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{inner}</svg>\n')

MARK_VB = "12 2 112 134"  # khung bao biểu tượng có lề
CAP = 50; WW = W["width"] * CAP / W["capHeight"]
files = {
  "prismreel-mark.svg": svg(MARK_VB, mark("a"), "Prismreel"),
  "prismreel-mark-black.svg": svg(MARK_VB, mark("b", mono="#000000"), "Prismreel"),
  "prismreel-mark-white.svg": svg(MARK_VB, mark("w", mono="#FFFFFF"), "Prismreel"),
  # ngang: biểu tượng trái, chữ phải; baseline ~ giữa biểu tượng + nửa chiều cao chữ hoa
  "prismreel-logo.svg": svg(f"12 2 {140+WW:.0f} 134", mark("h") + word(INK, 132, 69 + CAP/2, CAP), "Prismreel"),
  "prismreel-logo-white.svg": svg(f"12 2 {140+WW:.0f} 134", mark("hw") + word("#FFFFFF", 132, 69 + CAP/2, CAP), "Prismreel"),
  "prismreel-logo-black.svg": svg(f"12 2 {140+WW:.0f} 134", mark("hb", mono="#000000") + word("#000000", 132, 69 + CAP/2, CAP), "Prismreel"),
}
# dọc: biểu tượng trên, chữ dưới căn giữa
VCAP = CAP * 0.72; VW = W["width"] * VCAP / W["capHeight"]
vw = max(VW, 112) + 40; cx = vw / 2
files["prismreel-logo-vertical.svg"] = svg(f"0 0 {vw:.0f} 214", f'<g transform="translate({cx-68:.1f} 0)">{mark("v")}</g>' + word(INK, cx - VW/2, 196, VCAP), "Prismreel")
# icon app: nền đêm, biểu tượng căn giữa
icon_inner = (f'<rect width="1024" height="1024" rx="228" fill="{NIGHT}"/>'
              f'<g transform="translate(512 512) scale(5.2) translate(-68 -69)">{mark("i")}</g>')
files["prismreel-app-icon.svg"] = svg("0 0 1024 1024", icon_inner, "Prismreel")
# favicon: không có lỗ răng cưa (16–32 px sẽ nhoè), nền bo góc
fav = (f'<rect width="64" height="64" rx="14" fill="{NIGHT}"/>'
       f'<g transform="translate(32 32) scale(0.36) translate(-68 -69)">{mark("f").replace(holes("#FFFFFF"), "")}</g>')
files["favicon.svg"] = svg("0 0 64 64", fav, "Prismreel")
for name, content in files.items():
    (OUT / name).write_text(content)
print("\n".join(sorted(files)))
print("wordmark width", round(WW))
