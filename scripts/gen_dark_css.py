"""从亮色 CSS 生成暗色颜色覆盖：取出所有颜色声明，反转明度（保留强调色、遮罩保持深色），
选择器加 `html.dark` 前缀（portal 挂到 body 上也能覆盖）。

用法（在仓库根目录）：
  # 画布（按 PrintfilmStudioPage 的 import 顺序）
  python3 scripts/gen_dark_css.py frontend/src/features/printfilm-studio frontend/src/features/printfilm-studio/studioDark.generated.css
  # 生成工具页 / 任务页（按加载顺序列出文件）
  python3 scripts/gen_dark_css.py --files frontend/src/styles/generationDark.generated.css \
    frontend/src/styles/generation.css frontend/src/styles/generation-controls.css frontend/src/styles/generation-references.css
上游改了这些 CSS 后重新运行即可；手工修正写在 studioDark.css 等非生成文件里。
"""
import re, colorsys, sys, pathlib
FILES_MODE = sys.argv[1] == '--files'
if FILES_MODE:
    OUT = sys.argv[2]; explicit = [pathlib.Path(x) for x in sys.argv[3:]]; root = explicit[0].parent
else:
    root = pathlib.Path(sys.argv[1]); OUT = sys.argv[2]
PAGE_ORDER = ['printfilmStudio.css','studioEditors.css','sourceParity.css','agent/agentPanel.css','canvas/canvasRefinements.css','workspaceChrome.css']
allf = sorted(p for p in root.rglob('*.css') if not p.name.startswith('studioDark'))
# 组件内 import 的样式先于页面样式加载，保持原有层叠顺序
files = explicit if FILES_MODE else [p for p in allf if str(p.relative_to(root)) not in PAGE_ORDER] + [root/x for x in PAGE_ORDER if (root/x).exists()]
COLOR_PROPS = re.compile(r'^(--[\w-]+|background(-color|-image)?|color|border(-top|-right|-bottom|-left|-block|-inline)?(-color)?|outline(-color)?|fill|stroke|caret-color|accent-color|text-decoration-color|box-shadow|text-shadow|scrollbar-color)$')
HEX = re.compile(r'#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b')
RGB = re.compile(r'rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)')
NAMED = re.compile(r'(?<![\w-])(white|black)(?![\w-])')

def fmt(r, g, b, a):
    r, g, b = (max(0, min(255, round(x))) for x in (r, g, b))
    return f'#{r:02x}{g:02x}{b:02x}' + ('' if a >= 0.999 else f'{round(a*255):02x}')

KEEP_LIGHT_TEXT = [False]

def is_accent(v):
    if re.search(r"var\(--[\w-]*(accent|primary|brand|lime)", v): return True
    for m in HEX.finditer(v):
        x = m.group(1)
        if len(x) in (3, 4): x = ''.join(c*2 for c in x)
        h, l, sat = colorsys.rgb_to_hls(int(x[0:2],16)/255, int(x[2:4],16)/255, int(x[4:6],16)/255)
        if sat > 0.35 and 0.28 < l < 0.72: return True
    return False

def map_color(r, g, b, a, shadow):
    if shadow:  # bóng đổ: luôn đen, đậm hơn
        return fmt(0, 0, 0, min(1, a * 2.2 + 0.08))
    h, l, s = colorsys.rgb_to_hls(r/255, g/255, b/255)
    if KEEP_LIGHT_TEXT[0]:  # 强调色按钮上的文字保持原色（紫底白字、青柠底深字）
        return fmt(r, g, b, a)
    if a < 0.9 and l < 0.3:  # 半透明深色＝遮罩/阴影层，暗色下保持深色
        return fmt(r * 0.4, g * 0.4, b * 0.4, min(1, a * 1.3))
    if s > 0.35 and 0.28 < l < 0.72:  # màu nhấn (tím/xanh/đỏ) giữ nguyên, sáng lên chút
        l = min(0.72, l + 0.06)
    else:
        l = 0.93 - l * 0.83  # trắng→~0.10, đen→~0.93
        s = s * 0.55 if l < 0.3 else s
    r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
    return fmt(r2*255, g2*255, b2*255, a)

def conv_value(v, shadow):
    def hx(m):
        x = m.group(1)
        if len(x) in (3, 4): x = ''.join(c*2 for c in x)
        r, g, b = int(x[0:2],16), int(x[2:4],16), int(x[4:6],16)
        a = int(x[6:8],16)/255 if len(x) == 8 else 1
        return map_color(r, g, b, a, shadow)
    def rg(m):
        a = m.group(4); a = 1 if a is None else (float(a[:-1])/100 if a.endswith('%') else float(a))
        return map_color(float(m.group(1)), float(m.group(2)), float(m.group(3)), a, shadow)
    out = HEX.sub(hx, v); out = RGB.sub(rg, out)
    out = NAMED.sub(lambda m: map_color(255,255,255,1,shadow) if m.group(1)=='white' else map_color(0,0,0,1,shadow), out)
    return out

def strip_comments(s): return re.sub(r'/\*.*?\*/', '', s, flags=re.S)

def parse(s, i=0):
    """返回 [(prelude, body_or_children)]；body 为字符串（声明）或列表（嵌套 at-rule）"""
    items = []; buf = ''
    while i < len(s):
        c = s[i]
        if c == '{':
            pre = buf.strip(); buf = ''
            if pre.startswith('@media') or pre.startswith('@supports') or pre.startswith('@container') or pre.startswith('@layer'):
                kids, i = parse(s, i+1); items.append((pre, kids))
            else:
                depth = 1; j = i+1
                while depth:
                    if s[j] == '{': depth += 1
                    elif s[j] == '}': depth -= 1
                    j += 1
                items.append((pre, s[i+1:j-1])); i = j; continue
        elif c == '}':
            return items, i+1
        elif c == ';' and buf.strip().startswith('@'):
            buf = ''
        else:
            buf += c
        i += 1
    return items, i

def split_decls(body):
    parts, depth, cur = [], 0, ''
    for ch in body:
        if ch == '(': depth += 1
        elif ch == ')': depth -= 1
        if ch == ';' and depth == 0: parts.append(cur); cur = ''
        else: cur += ch
    if cur.strip(): parts.append(cur)
    return parts

def split_sel(pre):
    out, depth, cur = [], 0, ''
    for ch in pre:
        if ch == '(': depth += 1
        elif ch == ')': depth -= 1
        if ch == ',' and depth == 0: out.append(cur.strip()); cur = ''
        else: cur += ch
    out.append(cur.strip()); return [x for x in out if x]

def wrap_sel(sel):
    if sel.startswith(':root') or sel.startswith('html'): return None
    return 'html.dark ' + sel

def emit(items, ind=''):
    out = []
    for pre, body in items:
        if isinstance(body, list):
            if pre.startswith('@keyframes'): continue
            inner = emit(body, ind + '  ')
            if inner: out.append(f'{ind}{pre}{{\n' + '\n'.join(inner) + f'\n{ind}}}')
            continue
        if pre.startswith('@'): continue
        decls = []
        raw = split_decls(body)
        accent_bg = any(d.split(':',1)[0].strip() in ('background','background-color') and is_accent(d.split(':',1)[1]) for d in raw if ':' in d)
        for d in raw:
            if ':' not in d: continue
            p, v = d.split(':', 1); p = p.strip(); v = v.strip()
            if not COLOR_PROPS.match(p): continue
            has = HEX.search(v) or RGB.search(v) or NAMED.search(v)
            if not has:
                # 无颜色的同类声明原样保留（transparent/var()/none），保证层叠胜负与原样式一致
                if not p.startswith('--'): decls.append(f'{p}:{v}')
                continue
            KEEP_LIGHT_TEXT[0] = accent_bg and p in ('color', 'fill', 'stroke')
            decls.append(f'{p}:{conv_value(v, shadow=p in ("box-shadow", "text-shadow"))}')
            KEEP_LIGHT_TEXT[0] = False
        if not decls or not any(HEX.search(d) or RGB.search(d) or d.split(':',1)[1].strip().startswith('#') for d in decls) and not any('var(' in d or 'transparent' in d or 'none' in d for d in decls): continue
        sels = [w for w in (wrap_sel(s) for s in split_sel(pre)) if w]
        if sels: out.append(f'{ind}{",".join(sels)}{{{";".join(decls)}}}')
    return out

chunks = [f'/* 自动生成：scripts/gen_dark_css.py — 暗色主题颜色覆盖（勿手改） */']
for f in files:
    items, _ = parse(strip_comments(f.read_text()))
    rules = emit(items)
    if rules: chunks.append(f'/* {f.name if FILES_MODE else f.relative_to(root)} */\n' + '\n'.join(rules))
pathlib.Path(OUT).write_text('\n'.join(chunks) + '\n')
print('files', len(files), 'bytes', sum(len(c) for c in chunks))
