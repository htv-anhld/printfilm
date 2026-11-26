"""防回归：函数体内把 `_` 当局部变量赋值会遮蔽 i18n 的 `_()`，导致该函数所有 `_()` 调用抛 UnboundLocalError（对外表现为 500）。"""

from __future__ import annotations

import ast
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1] / "app"


def _function_shadows_gettext(fn: ast.AST) -> bool:
    """只看函数自身作用域（不进入嵌套函数/推导式），判断是否既赋值 `_` 又调用 `_()`。"""
    assigns = calls = False
    stack = list(ast.iter_child_nodes(fn))
    while stack:
        node = stack.pop()
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
            continue
        if isinstance(node, ast.Name) and node.id == "_" and isinstance(node.ctx, ast.Store):
            assigns = True
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "_":
            calls = True
        stack.extend(ast.iter_child_nodes(node))
    return assigns and calls


def test_no_function_shadows_gettext_underscore() -> None:
    offenders = []
    for path in APP_ROOT.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for fn in ast.walk(tree):
            if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)) and _function_shadows_gettext(fn):
                offenders.append(f"{path.relative_to(APP_ROOT.parent)}:{fn.lineno} {fn.name}")
    assert offenders == [], "函数内赋值 `_` 遮蔽了 _()：" + ", ".join(offenders)
