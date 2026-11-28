"""暗色主题文字兜底：扫描手写 CSS 里写死的深色文字（为浅底设计），为缺少 html.dark 覆盖的选择器
生成同色相、足够亮的文字颜色，避免「深字压深底」读不清（错误提示、状态标签、弹窗等难以逐页走查的状态）。

规则
- 只处理 color / caret-color / -webkit-text-fill-color 的写死颜色（hex / rgb），不动背景、边框
- 只处理暗色下会看不清的颜色：HLS 明度 < 0.6；输出明度：彩色 ≥0.70、灰色 ≥0.74（深底上约 ≥7:1）
- 同一规则里有浅色/强调色背景（白卡、青柠按钮）时跳过：那种底上深字本来就对
- 已有 html.dark 同选择器覆盖、或属于自动生成暗色文件的，跳过
- 输出选择器加 `html.dark` 前缀，特异性高于原规则，不依赖加载顺序（!important 原样保留）

用法（仓库根目录）：
  python3 scripts/gen_dark_text_css.py frontend/src frontend/src/styles/darkText.generated.css
上游改了 CSS 后重新运行即可。
"""
import colorsys, pathlib, re, sys

ROOT = pathlib.Path(sys.argv[1]); OUT = pathlib.Path(sys.argv[2])
SKIP_NAMES = {'generationDark.generated.css', 'studioDark.generated.css', 'darkText.generated.css', 'studioDark.css'}
HEX = re.compile(r'#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b')
RGB = re.compile(r'rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)')
TEXT_PROPS = {'color', 'caret-color', '-webkit-text-fill-color'}
BG_PROPS = {'background', 'background-color'}
MIN_L_CHROMA, MIN_L_GRAY, DARK_L = 0.70, 0.74, 0.6


def strip_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)


def rules(css):
    """扁平化 (prelude 链, 声明体)；@media 等嵌套保留外层 prelude。"""
    out, stack, buf, i = [], [], '', 0
    while i < len(css):
        c = css[i]
        if c == '{':
            pre = buf.strip(); buf = ''
            if pre.startswith('@') and not pre.startswith(('@media', '@supports', '@container', '@layer')):
                depth, j = 1, i + 1  # @keyframes / @font-face：整块跳过
                while depth and j < len(css):
                    depth += {'{': 1, '}': -1}.get(css[j], 0); j += 1
                i = j; continue
            if pre.startswith('@'):
                stack.append(pre); i += 1; continue
            depth, j = 1, i + 1
            while depth and j < len(css):
                depth += {'{': 1, '}': -1}.get(css[j], 0); j += 1
            out.append((tuple(stack), pre, css[i + 1:j - 1])); i = j; continue
        if c == '}':
            if stack: stack.pop()
            buf = ''
        elif c == ';' and buf.strip().startswith('@'):
            buf = ''
        else:
            buf += c
        i += 1
    return out


def parse_color(v):
    m = HEX.search(v)
    if m:
        x = m.group(1)
        if len(x) in (3, 4): x = ''.join(ch * 2 for ch in x)
        a = int(x[6:8], 16) / 255 if len(x) == 8 else 1
        return int(x[0:2], 16), int(x[2:4], 16), int(x[4:6], 16), a, m
    m = RGB.search(v)
    if m:
        a = m.group(4); a = 1 if a is None else (float(a[:-1]) / 100 if a.endswith('%') else float(a))
        return float(m.group(1)), float(m.group(2)), float(m.group(3)), a, m
    return None


def light_bg(body):
    """规则自带浅色/强调色背景 → 深字是对的，不处理。"""
    for d in body.split(';'):
        if ':' not in d: continue
        p, v = (x.strip() for x in d.split(':', 1))
        if p not in BG_PROPS: continue
        if re.search(r'var\(--[\w-]*(lime|accent|primary|brand|card|bg|paper|white)', v): return True
        c = parse_color(v)
        if c:
            h, l, s = colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)
            if c[3] > 0.5 and (l > 0.6 or (s > 0.35 and 0.28 < l < 0.72)): return True
    return False


def brighten(r, g, b, a):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    target = MIN_L_CHROMA if s > 0.2 else MIN_L_GRAY
    l = max(target, 0.93 - l * 0.83) if s <= 0.2 else max(target, l)
    s = min(s, 0.85)
    r2, g2, b2 = (round(x * 255) for x in colorsys.hls_to_rgb(h, l, s))
    return f'#{r2:02x}{g2:02x}{b2:02x}' + ('' if a >= 0.999 else f'{round(max(a, 0.85) * 255):02x}')


def main():
    files = sorted(p for p in ROOT.rglob('*.css') if p.name not in SKIP_NAMES and 'node_modules' not in p.parts)
    all_rules = []
    covered = set()
    # 已有覆盖：手写 html.dark 规则 + 其他生成文件（本脚本自己的输出不算，否则重跑会全部跳过）
    for f in files + [p for p in ROOT.rglob('*.css') if p.name in SKIP_NAMES and p.name != OUT.name]:
        for at, pre, body in rules(strip_comments(f.read_text())):
            for sel in pre.split(','):
                sel = sel.strip()
                if sel.startswith('html.dark '): covered.add(sel[len('html.dark '):].strip())
                if sel.startswith(':root.dark ') or sel.startswith('.dark '): covered.add(sel.split(' ', 1)[1].strip())
        if f.name not in SKIP_NAMES:
            all_rules.append((f, rules(strip_comments(f.read_text()))))
    out = ['/* 自动生成：scripts/gen_dark_text_css.py — 暗色主题文字兜底（勿手改） */']
    count = 0
    for f, rs in all_rules:
        chunk = []
        for at, pre, body in rs:
            sels = [s.strip() for s in pre.split(',') if s.strip()]
            if any(s.startswith(('html', ':root', 'body.dark', '.dark')) for s in sels): continue
            sels = [s for s in sels if s not in covered and not s.startswith('@')]
            if not sels or light_bg(body): continue
            decls = []
            for d in body.split(';'):
                if ':' not in d: continue
                p, v = (x.strip() for x in d.split(':', 1))
                if p not in TEXT_PROPS or 'var(' in v: continue
                c = parse_color(v)
                if not c: continue
                h, l, s = colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)
                if l >= DARK_L: continue
                new = v[:c[4].start()] + brighten(*c[:4]) + v[c[4].end():]
                decls.append(f'{p}:{new}')
            if not decls: continue
            rule = ','.join('html.dark ' + s for s in sels) + '{' + ';'.join(decls) + '}'
            for a in reversed(at): rule = f'{a}{{{rule}}}'
            chunk.append(rule); count += 1
        if chunk: out.append(f'/* {f.relative_to(ROOT)} */\n' + '\n'.join(chunk))
    OUT.write_text('\n'.join(out) + '\n')
    print('rules', count, 'files', len(all_rules))


main()
