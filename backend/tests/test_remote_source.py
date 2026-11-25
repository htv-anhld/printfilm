"""未开 OSS 时复用 Seedream 公网原图给 Seedance。"""
from app.services.remote_source import REMOTE_SOURCE_TTL_SEC, fresh_remote_source, remember_remote_source


def test_remember_and_expire(tmp_path):
    img = tmp_path / "shot.png"
    img.write_bytes(b"x")
    remember_remote_source(img, "https://cdn.example.com/a.jpeg?sig=1")
    assert fresh_remote_source(img) == "https://cdn.example.com/a.jpeg?sig=1"
    import time

    assert fresh_remote_source(img, now=time.time() + REMOTE_SOURCE_TTL_SEC + 1) is None


def test_ignores_non_https_and_missing(tmp_path):
    img = tmp_path / "shot.png"
    img.write_bytes(b"x")
    assert fresh_remote_source(img) is None
    remember_remote_source(img, "/static/local.png")
    assert fresh_remote_source(img) is None


def test_normalize_tokenfree_seedance():
    from app.services.tokenfree_video import normalize_tokenfree_seedance as n

    assert n("seedance-2-5") == "seedance-2.5"
    assert n("seedance-2-0") == "seedance-2.0"
    assert n("doubao-seedance-2-0-fast-260128") == "seedance-2.0-fast"
    assert n("seedance-2.5") == "seedance-2.5"
    assert n("veo-3") == "veo-3"
