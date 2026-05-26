"""
紫微斗數地基工程 - 特殊編碼解析模組
處理元資訊編碼 (身宮、命主/身主、亮度、性別)
不使用 Bitmask，保持原始字串格式
"""

from typing import Dict


class SpecialCodeDecoder:
    """特殊編碼解析器 (不使用 Bitmask)"""

    def decode(self, code: str) -> Dict:
        """
        解析特殊編碼並返回結構化資料

        Args:
            code: 特殊編碼字串 (Q/L/M/I/G 開頭)

        Returns:
            解析後的字典，包含 type 和相關欄位

        Raises:
            ValueError: 若編碼格式不正確
        """
        if not code:
            raise ValueError("編碼不能為空")

        if code.startswith('Q'):
            return self._decode_body_palace(code)
        elif code.startswith('L'):
            return self._decode_life_master(code)
        elif code.startswith('M'):
            return self._decode_body_master(code)
        elif code.startswith('I'):
            return self._decode_brightness(code)
        elif code.startswith('G'):
            return self._decode_gender(code)
        else:
            raise ValueError(f"未知的特殊編碼: {code}")

    def _decode_body_palace(self, code: str) -> Dict:
        """
        解析身宮編碼
        - Q5: 身宮在財帛宮 (2碼)
        - QSUN: 身宮太陽 (4碼)
        - QPOL01: 身宮有紫微在子位 (6碼)
        """
        if len(code) == 2:
            # 短格式: 身宮宮位
            return {
                'type': 'body_palace_location',
                'palace': code[1]
            }
        elif len(code) == 4:
            # 中格式: 身宮星曜 (例如 QSUN)
            return {
                'type': 'body_palace_star_only',
                'star': code[1:4]
            }
        elif len(code) == 6:
            # 長格式: 身宮星曜位置
            return {
                'type': 'body_palace_star',
                'star': code[1:4],
                'branch': code[4:6]
            }
        else:
            raise ValueError(f"身宮編碼格式錯誤 (應為 2, 4 或 6 碼): {code}")

    def _decode_life_master(self, code: str) -> Dict:
        """
        解析命主編碼
        - LPOL: 命主紫微 (4碼)
        """
        if len(code) != 4:
            raise ValueError(f"命主編碼格式錯誤 (應為 4 碼): {code}")

        return {
            'type': 'life_master',
            'star': code[1:4]
        }

    def _decode_body_master(self, code: str) -> Dict:
        """
        解析身主編碼
        - MAAC: 身主文昌 (4碼)
        """
        if len(code) != 4:
            raise ValueError(f"身主編碼格式錯誤 (應為 4 碼): {code}")

        return {
            'type': 'body_master',
            'star': code[1:4]
        }

    def _decode_brightness(self, code: str) -> Dict:
        """
        解析亮度編碼
        - IPOLP3: 紫微亮度正3 (6碼)
        - IHPIN1: 天機亮度負1 (6碼)
        """
        if len(code) != 6:
            raise ValueError(f"亮度編碼格式錯誤 (應為 6 碼): {code}")

        star = code[1:4]
        sign = code[4]
        value_str = code[5]

        if sign not in ['P', 'N']:
            raise ValueError(f"亮度符號錯誤 (應為 P 或 N): {sign}")

        if not value_str.isdigit():
            raise ValueError(f"亮度數值錯誤 (應為數字): {value_str}")

        value = int(value_str)
        brightness = value if sign == 'P' else -value

        return {
            'type': 'brightness',
            'star': star,
            'value': brightness
        }

    def _decode_gender(self, code: str) -> Dict:
        """
        解析性別編碼
        - GF: 女性 (2碼)
        - GM: 男性 (2碼)
        """
        if len(code) != 2:
            raise ValueError(f"性別編碼格式錯誤 (應為 2 碼): {code}")

        gender_code = code[1]
        if gender_code == 'F':
            gender = 'female'
        elif gender_code == 'M':
            gender = 'male'
        else:
            raise ValueError(f"性別代碼錯誤 (應為 F 或 M): {gender_code}")

        return {
            'type': 'gender',
            'value': gender
        }
