"""顧客看得到的 OrderError 文案：改為引導寄信到 service@ 信箱（讀原始碼斷言，不觸發寄信）。"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / 'sites' / 'Polaris_Parent' / 'backend' / 'extensions' / 'report_orders'


def _src(name):
    return (EXT / name).read_text(encoding='utf-8')


def test_proofs_no_revisions_left_message():
    src = _src('proofs.py')
    new = "raise OrderError('免費修改次數已用完；如果還需要修改，請寄信到 service@polaris-parent.com，並附上訂單編號', 409, 'no_revisions_left')"
    assert new in src
    assert '免費修改次數已用完；若仍需修改，請直接回信與我們聯絡' not in src


def test_physical_reschedule_invalid_status_message():
    src = _src('physical.py')
    new = "raise OrderError('目前無法在這裡更改時段；已約好時間的話，請回覆確認信，或寄信到 service@polaris-parent.com 並附上訂單編號。', 409, 'invalid_status')"
    assert new in src
    assert '目前無法更改時段；已約好時間的話，請直接回覆確認信' not in src


def test_payment_expired_message():
    src = _src('payment.py')
    new = "raise OrderError('已超過匯款期限，訂單將會取消；若已轉帳請寄信到 service@polaris-parent.com', 409, 'expired')"
    assert new in src
    assert '若已轉帳請聯絡客服' not in src


def test_service_chart_service_error_message():
    src = _src('service.py')
    new = "raise OrderError('系統暫時無法建立訂單，請稍後再試；若持續發生請寄信到 service@polaris-parent.com。', 502, 'chart_service_error')"
    assert new in src
    assert '若持續發生請聯絡客服' not in src
