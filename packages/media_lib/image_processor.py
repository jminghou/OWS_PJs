"""
Media Library - Image Processor

使用 Pillow 產生圖片變體（thumbnail, small, medium, large）。
只在記憶體中處理，不寫入本機磁碟。
"""

import io
from typing import List, Tuple, Optional

from PIL import Image

from packages.media_lib.config import IMAGE_VARIANTS, SUPPORTED_IMAGE_TYPES


def is_image(mime_type: str) -> bool:
    """判斷是否為可處理的圖片類型。"""
    return mime_type in SUPPORTED_IMAGE_TYPES


def get_image_dimensions(file_data: bytes) -> Tuple[Optional[int], Optional[int]]:
    """
    取得圖片的寬高。

    Returns:
        (width, height) 或 (None, None)
    """
    try:
        img = Image.open(io.BytesIO(file_data))
        w, h = img.size
        # 確保寬高是合理的整數值
        if not (0 < w < 1e8 and 0 < h < 1e8):
            return None, None
        return int(w), int(h)
    except Exception:
        return None, None


def generate_variants(
    file_data: bytes,
    mime_type: str,
) -> List[dict]:
    """
    產生圖片的各尺寸變體。

    Args:
        file_data: 原始圖片的 bytes
        mime_type: 圖片的 MIME type

    Returns:
        list of dict, 每個 dict 包含:
        {
            'variant_type': 'thumbnail',
            'data': bytes,
            'width': 245,
            'height': 163,
            'file_size': 12345,
            'content_type': 'image/jpeg',
            'ext': '.jpg',
        }
    """
    if not is_image(mime_type):
        return []

    try:
        img = Image.open(io.BytesIO(file_data))
    except Exception:
        return []

    # 保留原始模式，轉換 RGBA 為 RGB（JPEG 不支援 alpha）
    original_width, original_height = img.size
    output_format, ext, content_type = _get_output_format(mime_type)

    results = []

    for variant_type, spec in IMAGE_VARIANTS.items():
        max_w = spec['max_width']
        max_h = spec['max_height']
        quality = spec['quality']

        # 如果原圖比目標小，跳過這個變體
        if original_width <= max_w and original_height <= max_h:
            continue

        # 等比例縮放
        resized = img.copy()
        resized.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)

        # 轉為 bytes
        buffer = io.BytesIO()
        save_img = resized
        if output_format == 'JPEG' and save_img.mode in ('RGBA', 'P'):
            save_img = save_img.convert('RGB')

        # 清除可能導致 "cannot convert float infinity to integer" 的異常 DPI 元數據
        save_kwargs = {'format': output_format, 'optimize': True}
        if output_format in ('JPEG', 'WEBP'):
            save_kwargs['quality'] = quality
        if 'dpi' in save_img.info:
            dpi = save_img.info['dpi']
            try:
                if any(not (0 < d < 1e6) for d in dpi):
                    del save_img.info['dpi']
            except (TypeError, ValueError):
                del save_img.info['dpi']

        save_img.save(buffer, **save_kwargs)
        data = buffer.getvalue()

        results.append({
            'variant_type': variant_type,
            'data': data,
            'width': resized.size[0],
            'height': resized.size[1],
            'file_size': len(data),
            'content_type': content_type,
            'ext': ext,
        })

    return results


def crop_image(file_data: bytes, mime_type: str, box: Tuple[float, float, float, float]):
    """
    依「比例座標」裁切圖片。

    box = (x, y, width, height)，皆為 0~1、相對於**已套用 EXIF 方向**的圖片
    （瀏覽器顯示的就是轉正後的樣子，前端量到的座標也是以它為準）。

    Returns:
        (data, width, height, ext, content_type)；無法處理時回 None。
    """
    try:
        from PIL import ImageOps
        img = Image.open(io.BytesIO(file_data))
        img = ImageOps.exif_transpose(img)
        w, h = img.size
        x, y, bw, bh = box
        left, top = round(x * w), round(y * h)
        right, bottom = round((x + bw) * w), round((y + bh) * h)
        left, top = max(0, left), max(0, top)
        right, bottom = min(w, right), min(h, bottom)
        if right - left < 2 or bottom - top < 2:
            return None
        cropped = img.crop((left, top, right, bottom))

        pil_format, ext, content_type = _get_output_format(mime_type)
        if pil_format == 'GIF':  # 動圖裁切後只剩一格，改存 PNG 比較誠實
            pil_format, ext, content_type = 'PNG', '.png', 'image/png'
        if pil_format == 'JPEG' and cropped.mode in ('RGBA', 'P', 'LA'):
            cropped = cropped.convert('RGB')
        buf = io.BytesIO()
        save_kwargs = {'quality': 92, 'optimize': True} if pil_format in ('JPEG', 'WEBP') else {}
        cropped.save(buf, format=pil_format, **save_kwargs)
        return buf.getvalue(), cropped.size[0], cropped.size[1], ext, content_type
    except Exception:
        return None


def _get_output_format(mime_type: str) -> Tuple[str, str, str]:
    """
    根據 MIME type 決定輸出格式。

    Returns:
        (PIL_format, file_extension, content_type)
    """
    mapping = {
        'image/jpeg': ('JPEG', '.jpg', 'image/jpeg'),
        'image/png': ('PNG', '.png', 'image/png'),
        'image/webp': ('WEBP', '.webp', 'image/webp'),
        'image/gif': ('GIF', '.gif', 'image/gif'),
    }
    return mapping.get(mime_type, ('JPEG', '.jpg', 'image/jpeg'))


__all__ = ['is_image', 'get_image_dimensions', 'generate_variants', 'crop_image']
