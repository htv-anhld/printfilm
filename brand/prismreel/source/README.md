# Dựng lại bộ logo

```bash
cd brand/prismreel/source
python3 -m venv .venv && ./.venv/bin/pip install fonttools
mkdir -p fonts && curl -L -o fonts/PJS.ttf "https://github.com/google/fonts/raw/main/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf"
./.venv/bin/python word.py Prismreel -15 > word.json   # chữ → đường nét
python3 build.py ..                                     # sinh lại các file SVG
```

PNG xuất bằng Chrome headless (`--default-background-color=00000000`) và `magick` cho `favicon.ico`.
