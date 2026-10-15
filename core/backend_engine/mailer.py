"""
寄信：設了 RESEND_API_KEY 就改走 Resend 的 HTTPS API，否則維持 Flask-Mail 的 SMTP。

為什麼需要：Railway 的 Hobby 方案封鎖對外 SMTP（25/465/587/2525），正式站用 SMTP 會連線逾時；
HTTPS API 不受方案限制。呼叫端照舊 `mail.send(Message(...))`，不需要知道底下走哪一條。
用標準函式庫 urllib，core 不因此多一個相依套件。
"""

import json
import urllib.error
import urllib.request

from flask import current_app
from flask_mail import Mail

RESEND_ENDPOINT = 'https://api.resend.com/emails'


class MailSendError(Exception):
    pass


def _format_address(value):
    """Flask-Mail 的寄件者可以是字串或 (名稱, 地址)。"""
    if isinstance(value, (tuple, list)):
        name, address = value
        return f'{name} <{address}>' if name else address
    return value


class OwsMail(Mail):
    def send(self, message):
        api_key = current_app.config.get('RESEND_API_KEY')
        if not api_key:
            return super().send(message)

        sender = _format_address(message.sender or current_app.config.get('MAIL_DEFAULT_SENDER'))
        if not sender:
            raise MailSendError('MAIL_DEFAULT_SENDER 未設定')
        payload = {'from': sender, 'to': list(message.recipients), 'subject': message.subject}
        if message.body:
            payload['text'] = message.body
        if message.html:
            payload['html'] = message.html
        if message.cc:
            payload['cc'] = list(message.cc)
        if message.bcc:
            payload['bcc'] = list(message.bcc)
        if message.reply_to:
            payload['reply_to'] = _format_address(message.reply_to)

        request = urllib.request.Request(
            RESEND_ENDPOINT,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json',
                     'User-Agent': 'ows-mailer/1.0'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(request, timeout=current_app.config.get('RESEND_TIMEOUT', 10)) as resp:
                return json.loads(resp.read() or b'{}')
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode('utf-8', 'replace')[:300]
            raise MailSendError(f'Resend 回應 {exc.code}：{detail}') from exc
        except urllib.error.URLError as exc:
            raise MailSendError(f'無法連線 Resend：{exc.reason}') from exc
