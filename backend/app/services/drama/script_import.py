"""上传剧本：从 txt / md / docx / pdf 取出纯文本，并按「第N集 / Tập N / Episode N」标题切分集。

原文逐字保留为每集剧本正文，系统只负责分集；人物与梗概由后续剧本摘要任务提取。
"""

from __future__ import annotations

import io
import re
import zipfile
from xml.etree import ElementTree

from app.i18n import _

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_SCRIPT_CHARS = 200_000
MIN_SCRIPT_CHARS = 200
ALLOWED_SUFFIXES = (".txt", ".md", ".docx", ".pdf")

_W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

# 集标题：独占一行的「第3集」「Tập 3」「TẬP 3:」「Episode 3」「EP 3」「Ep.3」等
_EPISODE_HEADING = re.compile(
    r"^[ \t#*【\[]*"
    r"(?:第\s*(?P<zh>[0-9０-９一二三四五六七八九十百零两]+)\s*[集话話]"
    r"|(?:tập|tap|episode|ep\.?)\s*(?P<num>\d{1,3}))"
    r"[ \t]*(?:[:：.\-—–】\]][^\n]*|[ \t]+[^\n]*)?$",
    re.IGNORECASE | re.MULTILINE,
)

_HEADING_PREFIX = re.compile(
    r"^(?:第\s*[0-9０-９一二三四五六七八九十百零两]+\s*[集话話]|(?:tập|tap|episode|ep\.?)\s*\d{1,3})"
    r"\s*[:：.\-—–】\]]*\s*",
    re.IGNORECASE,
)


def _decode_text(raw: bytes) -> str:
    """txt / md：按 BOM 与常见编码依次尝试。"""
    for enc in ("utf-8-sig", "utf-16", "gb18030"):
        try:
            text = raw.decode(enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
        if enc == "utf-16" and not raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
            continue
        return text
    return raw.decode("utf-8", errors="replace")


def _docx_text(raw: bytes) -> str:
    """docx：读 word/document.xml，每个段落一行（不依赖 python-docx）。"""
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            xml = zf.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError) as exc:
        raise ValueError(_("无法读取 Word 文件，请另存为 .docx 后重试")) from exc
    root = ElementTree.fromstring(xml)
    lines: list[str] = []
    for para in root.iter(f"{_W_NS}p"):
        parts: list[str] = []
        for node in para.iter():
            if node.tag == f"{_W_NS}t" and node.text:
                parts.append(node.text)
            elif node.tag == f"{_W_NS}tab":
                parts.append("\t")
            elif node.tag in (f"{_W_NS}br", f"{_W_NS}cr"):
                parts.append("\n")
        lines.append("".join(parts))
    return "\n".join(lines)


def _pdf_text(raw: bytes) -> str:
    """pdf：逐页抽取文本层（扫描件无文本层时报错）。"""
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(raw))
        pages = [(page.extract_text() or "") for page in reader.pages]
    except (PdfReadError, ValueError) as exc:
        raise ValueError(_("无法读取 PDF 文件")) from exc
    return "\n".join(pages)


def extract_script_text(filename: str, raw: bytes) -> str:
    """
    从上传文件取出剧本纯文本。
    @raises ValueError 格式不支持 / 文件过大 / 内容过短或过长
    """
    name = (filename or "").lower().strip()
    if not name.endswith(ALLOWED_SUFFIXES):
        raise ValueError(_("仅支持 .txt / .md / .docx / .pdf 文件"))
    if len(raw) > MAX_FILE_BYTES:
        raise ValueError(_("文件不能超过 5 MB"))
    if name.endswith(".docx"):
        text = _docx_text(raw)
    elif name.endswith(".pdf"):
        text = _pdf_text(raw)
    else:
        text = _decode_text(raw)
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace(" ", " ")
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < MIN_SCRIPT_CHARS:
        raise ValueError(_("剧本内容过短（至少 {n} 字），PDF 若是扫描件请先转成文字", n=MIN_SCRIPT_CHARS))
    if len(text) > MAX_SCRIPT_CHARS:
        raise ValueError(_("剧本过长（最多 {n} 字），请拆分后分别上传", n=MAX_SCRIPT_CHARS))
    return text


def split_script_episodes(text: str) -> tuple[str, list[dict]]:
    """
    按集标题切分。
    @returns (header, episodes)：header 为第一集之前的内容（片名、人物表等）；
             episodes 每项 {episodeNumber, title, body}，正文为原文；无标题时整篇作为第 1 集
    """
    matches = list(_EPISODE_HEADING.finditer(text))
    if not matches:
        return "", [{"episodeNumber": 1, "title": "", "body": text.strip()}]
    header = text[: matches[0].start()].strip()
    episodes: list[dict] = []
    for idx, m in enumerate(matches):
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        # 只保留集号后的名称（「TẬP 1: Tín hiệu lạ」→「Tín hiệu lạ」），没有名称时由调用方补默认标题
        heading = _HEADING_PREFIX.sub("", m.group(0).strip().strip("#*【】[] ")).strip()
        body = text[m.end() : end].strip()
        if not body:
            continue
        episodes.append({"episodeNumber": len(episodes) + 1, "title": heading, "body": body})
    if not episodes:
        return "", [{"episodeNumber": 1, "title": "", "body": text.strip()}]
    return header, episodes
