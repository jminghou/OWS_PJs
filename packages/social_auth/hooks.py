"""
站台掛勾：社群登入的通用流程不知道各站台的領域規則，由站台在自己的 extension 登記。

    from packages.social_auth import hooks

    @hooks.on_member_created
    def _created(user, profile): ...      # 社群註冊、剛建立會員之後（同一個交易內，尚未 commit）

    @hooks.on_signed_in
    def _signed_in(user, profile): ...    # 每次社群登入成功（含剛註冊），尚未 commit

hook 拋出的例外會被記 log 後吞掉：站台的附加動作失敗不該擋住登入本身。
hook 不要自己 commit，跟著模組的交易一起提交。

Email 驗證碼（選配）：社群帳號沒給信箱、或信箱已是會員時，要寄一組驗證碼證明信箱是本人的。
寄信與驗碼用站台既有的機制，站台這樣登記：

    hooks.set_email_codes(send=send_fn, verify=verify_fn)
    # send(email)：寄出驗證碼；太頻繁時拋 hooks.CodeRateLimited(retry_after 秒)
    # verify(email, code)：驗證並消耗；錯誤時拋 hooks.CodeInvalid(給使用者看的訊息)

沒登記的站台，遇到這兩種情況只能請對方先用原本的方式登入。
"""
from typing import Callable, List, Optional, Tuple

from flask import current_app

_created: List[Callable] = []
_signed_in: List[Callable] = []
_email_codes: Optional[Tuple[Callable, Callable]] = None


class CodeRateLimited(Exception):
    def __init__(self, retry_after: int):
        super().__init__(retry_after)
        self.retry_after = retry_after


class CodeInvalid(Exception):
    """驗證碼錯誤或失效；message 直接顯示給使用者。"""


def set_email_codes(*, send: Callable, verify: Callable) -> None:
    global _email_codes
    _email_codes = (send, verify)


def email_codes() -> Optional[Tuple[Callable, Callable]]:
    return _email_codes


def on_member_created(fn):
    if fn not in _created:
        _created.append(fn)
    return fn


def on_signed_in(fn):
    if fn not in _signed_in:
        _signed_in.append(fn)
    return fn


def _run(hooks, user, profile):
    for fn in list(hooks):
        try:
            fn(user, profile)
        except Exception as exc:  # noqa: BLE001
            current_app.logger.error(f'social_auth hook {getattr(fn, "__name__", fn)} 失敗：{exc}')


def run_member_created(user, profile):
    _run(_created, user, profile)


def run_signed_in(user, profile):
    _run(_signed_in, user, profile)
