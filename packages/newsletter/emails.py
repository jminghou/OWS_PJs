"""確認信：四語系純文字範本＋寄送（best-effort，寫法比照 core services/member_auth 的設定密碼信）。"""
import os

from flask import current_app

DEFAULT_LOCALE = 'zh-TW'

# {brand}、{confirm}、{unsubscribe} 由 send_confirmation 代入
TEMPLATES = {
    'zh-TW': {
        'subject': '請確認訂閱 {brand} 電子報',
        'body': (
            '您好，\n\n'
            '感謝您訂閱 {brand} 電子報。請點擊下方連結完成訂閱（7 天內有效）：\n{confirm}\n\n'
            '如果這不是您本人的操作，忽略這封信即可，我們不會再寄信給您。\n\n'
            '隨時可以退訂：\n{unsubscribe}\n'
        ),
    },
    'zh-CN': {
        'subject': '请确认订阅 {brand} 电子报',
        'body': (
            '您好，\n\n'
            '感谢您订阅 {brand} 电子报。请点击下方链接完成订阅（7 天内有效）：\n{confirm}\n\n'
            '如果这不是您本人的操作，忽略这封邮件即可，我们不会再给您发信。\n\n'
            '随时可以退订：\n{unsubscribe}\n'
        ),
    },
    'en': {
        'subject': 'Please confirm your subscription to {brand}',
        'body': (
            'Hi,\n\n'
            'Thanks for subscribing to the {brand} newsletter. Please confirm your subscription '
            'by opening the link below (valid for 7 days):\n{confirm}\n\n'
            "If this wasn't you, just ignore this email and you won't hear from us again.\n\n"
            'You can unsubscribe at any time:\n{unsubscribe}\n'
        ),
    },
    'ja': {
        'subject': '{brand} ニュースレターの登録確認',
        'body': (
            'こんにちは。\n\n'
            '{brand} のニュースレターにご登録いただきありがとうございます。'
            '下のリンクを開いて登録を完了してください（7日間有効）：\n{confirm}\n\n'
            'お心当たりがない場合は、このメールを無視してください。今後メールが届くことはありません。\n\n'
            '配信停止はいつでも可能です：\n{unsubscribe}\n'
        ),
    },
}


def _frontend_base() -> str:
    return os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')


def _locale_of(subscriber) -> str:
    return subscriber.locale if subscriber.locale in TEMPLATES else DEFAULT_LOCALE


def confirm_url(subscriber) -> str:
    # 一律帶語系前綴（含預設語系）：前台 middleware 對無前綴路徑做語系 cookie 導向時會丟掉 query string
    return f'{_frontend_base()}/{_locale_of(subscriber)}/newsletter/confirm?token={subscriber.token}'


def unsubscribe_url(subscriber) -> str:
    return f'{_frontend_base()}/{_locale_of(subscriber)}/newsletter/unsubscribe?token={subscriber.token}'


def send_confirmation(subscriber) -> None:
    """寄確認信（best-effort；無 SMTP 時記 log 含連結，方便本機開發）。"""
    link = confirm_url(subscriber)
    try:
        from flask_mail import Message

        from core.backend_engine.factory import mail

        template = TEMPLATES[_locale_of(subscriber)]
        brand = current_app.config.get('NEWSLETTER_BRAND_NAME') or current_app.config.get('SITE_NAME', '')
        values = {'brand': brand, 'confirm': link, 'unsubscribe': unsubscribe_url(subscriber)}
        mail.send(Message(
            subject=template['subject'].format(**values),
            recipients=[subscriber.email],
            sender=current_app.config.get('MAIL_DEFAULT_SENDER'),
            body=template['body'].format(**values),
        ))
        current_app.logger.info(f'newsletter confirmation sent to {subscriber.email}')
    except Exception as send_err:  # noqa: BLE001
        current_app.logger.warning(
            f'newsletter 確認信無法寄出（本機可能無 SMTP）：{send_err}；連結：{link}')
