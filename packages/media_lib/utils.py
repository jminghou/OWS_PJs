"""
Media Library - Utilities
"""

import re


def slugify(text: str) -> str:
    """將文字轉為 URL-safe 的 slug。"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')
