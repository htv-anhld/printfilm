"""TokenFree 预扣费失败（insufficient_user_quota）转成可读提示。"""

from app.i18n import use_locale
from app.services.ark import _format_seedance_create_error

BODY = (
    '{"code":"insufficient_user_quota","message":"预扣费额度失败, 用户剩余额度: ＄4.046638, '
    '需要预扣费额度: ＄4.613672","data":null}'
)


def test_quota_error_shows_balance_and_hold_vi():
    """越南语：带出剩余额度与预扣额度。"""
    with use_locale("vi"):
        msg = _format_seedance_create_error(403, BODY)
    assert "TokenFree" in msg and "$4.05" in msg and "$4.61" in msg
    assert "Số dư" in msg


def test_quota_error_without_amounts_en():
    """无金额时返回通用提示。"""
    with use_locale("en"):
        msg = _format_seedance_create_error(403, '{"code":"insufficient_user_quota"}')
    assert msg.startswith("TokenFree balance is too low")
