"""Chuyển chữ 'Prismreel' (Plus Jakarta Sans ExtraBold) thành path SVG, có kerning GPOS cơ bản."""
import json, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

text = sys.argv[1] if len(sys.argv) > 1 else "Prismreel"
track = float(sys.argv[2]) if len(sys.argv) > 2 else -20  # font units, khoảng cách chữ
font = instantiateVariableFont(TTFont("fonts/PJS.ttf"), {"wght": 800})
cmap = font.getBestCmap(); gs = font.getGlyphSet(); hmtx = font["hmtx"]
upm = font["head"].unitsPerEm; asc = font["hhea"].ascent

# Kerning cặp từ GPOS PairPos format 1 (đủ cho chữ Latin cơ bản)
kern = {}
try:
    for lookup in font["GPOS"].table.LookupList.Lookup:
        for st in lookup.SubTable:
            st = getattr(st, "ExtSubTable", st)
            if getattr(st, "Format", None) == 1 and hasattr(st, "PairSet"):
                for i, first in enumerate(st.Coverage.glyphs):
                    for pvr in st.PairSet[i].PairValueRecord:
                        v = getattr(pvr.Value1, "XAdvance", 0) if pvr.Value1 else 0
                        if v: kern[(first, pvr.SecondGlyph)] = v
            elif getattr(st, "Format", None) == 2:
                c1 = st.ClassDef1.classDefs; c2 = st.ClassDef2.classDefs
                for first in st.Coverage.glyphs:
                    for second in [cmap[ord(ch)] for ch in text]:
                        rec = st.Class1Record[c1.get(first, 0)].Class2Record[c2.get(second, 0)]
                        v = getattr(rec.Value1, "XAdvance", 0) if rec.Value1 else 0
                        if v and (first, second) not in kern: kern[(first, second)] = v
except Exception as e:
    print("kern skipped", e, file=sys.stderr)

x = 0; d = []; names = [cmap[ord(ch)] for ch in text]
for i, g in enumerate(names):
    pen = SVGPathPen(gs)
    gs[g].draw(TransformPen(pen, (1, 0, 0, -1, x, asc)))
    d.append(pen.getCommands())
    adv = hmtx[g][0] + track
    if i + 1 < len(names): adv += kern.get((g, names[i + 1]), 0)
    x += adv
x -= track
print(json.dumps({"d": " ".join(d), "width": round(x), "ascent": asc, "capHeight": getattr(font["OS/2"], "sCapHeight", 0), "upm": upm}))
