"""
金額與幣別（多幣別資料基礎，2026-10-20；docs/external-proxy-orders-plan.md 第 5 節）。

報告訂單的金額一律存「最小單位」的整數：台幣、日圓、韓圜是 1 元（小數位數 0），美金、歐元、挪威克朗等是 1 分
（小數位數 2）。台幣的小數位數本來就是 0，所以既有資料不必轉換。

注意：共用 commerce 套件的商品價格管理（PriceManager、ProductPrice）仍是「整數元」慣例，Claire 也在用，
這裡不改它。官網自己結帳目前只有台幣；外幣結帳要等選定國際金流，屆時再處理外幣商品價格。
"""

from decimal import Decimal, InvalidOperation

# code → (小數位數, 顯示符號)。要開新幣別只要加在這裡（前端 lib/money.ts 的 CURRENCIES 也要同步）
CURRENCIES = {
    'TWD': (0, 'NT$'),
    'USD': (2, 'US$'),
    'EUR': (2, '€'),
    'GBP': (2, '£'),
    'NOK': (2, 'NOK '),
    'SEK': (2, 'SEK '),
    'DKK': (2, 'DKK '),
    'CNY': (2, 'CN¥'),
    'HKD': (2, 'HK$'),
    'JPY': (0, '¥'),
    'AUD': (2, 'A$'),
    'CAD': (2, 'C$'),
}

LABELS = {
    'TWD': '新台幣', 'USD': '美元', 'EUR': '歐元', 'GBP': '英鎊', 'NOK': '挪威克朗', 'SEK': '瑞典克朗',
    'DKK': '丹麥克朗', 'CNY': '人民幣', 'HKD': '港幣', 'JPY': '日圓', 'AUD': '澳幣', 'CAD': '加幣',
}


def supported(code):
    return code in CURRENCIES


def exponent(code):
    if code not in CURRENCIES:
        raise ValueError(f'不支援的幣別：{code}')
    return CURRENCIES[code][0]


def to_minor(value, code):
    """把使用者輸入的金額（'49.99'、49、'1,980'）換成最小單位整數。小數位數超過幣別允許的範圍就拒絕（不四捨五入）。"""
    exp = exponent(code)
    try:
        d = Decimal(str(value).replace(',', '').strip())
    except (InvalidOperation, ValueError):
        raise ValueError('金額格式不正確')
    if not d.is_finite() or d < 0:
        raise ValueError('金額格式不正確')
    scaled = d.scaleb(exp)
    if scaled != scaled.to_integral_value():
        raise ValueError(f'{LABELS.get(code, code)}最多只能有 {exp} 位小數' if exp else f'{LABELS.get(code, code)}不能有小數')
    return int(scaled)


def to_major(minor, code):
    """最小單位 → 金額字串（不含符號、不加千分位），例：4999, 'USD' → '49.99'。"""
    exp = exponent(code)
    return f'{Decimal(minor).scaleb(-exp):.{exp}f}'


def fmt(minor, code):
    """顯示用：NT$1,980／US$49.99／€1,234.50／NOK 499.00。None 顯示「-」。"""
    if minor is None:
        return '-'
    if code not in CURRENCIES:
        return f'{code} {minor:,}'
    exp, symbol = CURRENCIES[code]
    return f'{symbol}{Decimal(minor).scaleb(-exp):,.{exp}f}'


def catalog():
    """前端選單用。"""
    return [{'code': c, 'label': LABELS.get(c, c), 'exponent': e, 'symbol': s.strip()} for c, (e, s) in CURRENCIES.items()]
