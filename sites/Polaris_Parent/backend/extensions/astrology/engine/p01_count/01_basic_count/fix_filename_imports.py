"""
修正檔案內部對舊檔名的導入
處理重新命名後的檔案導入問題
"""
import os
from pathlib import Path

# 取得當前目錄
base_dir = Path(__file__).parent

# 定義檔案名替換規則
filename_replacements = [
    # function/ 目錄的檔案重新命名
    ('from .f00_basic ', 'from .basic '),
    ('from .f01_lunar ', 'from .lunar '),
    ('from .f02_palace ', 'from .palace_helper '),
    ('from .f03_stars ', 'from .stars_helper '),
    ('from .f04_stars_main ', 'from .stars_main '),
    ('from .fn_rawdata ', 'from .rawdata '),
    ('from .fn_encoder ', 'from .encoder '),

    # palace/ 目錄的檔案重新命名
    ('from .p01_ming_shen ', 'from .ming_shen '),
    ('from .p02_subject ', 'from .subject '),
    ('from .p03_gz ', 'from .gz '),
    ('from .p05_bureau ', 'from .bureau '),
    ('from .p06_body ', 'from .body '),

    # stars/ 目錄的檔案重新命名
    ('from .s01_ziwei ', 'from .ziwei '),
    ('from .s02_major ', 'from .major '),
    ('from .s03_moon ', 'from .moon '),
    ('from .s04_hour ', 'from .hour '),
    ('from .s05_year_g ', 'from .year_g '),
    ('from .s05_year_z ', 'from .year_z '),
    ('from .s06_fire_ring ', 'from .fire_ring '),
    ('from .s07_general ', 'from .general '),
    ('from .s08_birth12 ', 'from .birth12 '),
    ('from .s09_days ', 'from .days '),
    ('from .s10_branch ', 'from .branch '),
    ('from .s11_ten ', 'from .ten '),
    ('from .s_brightness ', 'from .brightness '),
    ('from .s_4trans ', 'from .four_trans '),

    # flow/ 目錄的檔案重新命名
    ('from .ten_palace ', 'from .decade_palace '),
    ('from .ten_star ', 'from .decade_star '),
    ('from .ten_4trans ', 'from .decade_trans '),
    ('from .one_palace ', 'from .small_limit_palace '),
    ('from .one_star ', 'from .small_limit_star '),
    ('from ..flow.ten_palace ', 'from ..flow.decade_palace '),
    ('from ..flow.ten_star ', 'from ..flow.decade_star '),
    ('from ..flow.ten_4trans ', 'from ..flow.decade_trans '),
    ('from ..flow.one_palace ', 'from ..flow.small_limit_palace '),
    ('from ..flow.one_star ', 'from ..flow.small_limit_star '),
    # 移除不存在的 core_import
    ('from ..core.core_import ', '# from ..core.core_import '),
    ('from .core_import ', '# from .core_import '),

    # core/ 目錄的檔案重新命名
    ('from ..core.core_sxtwl ', 'from ..core.sxtwl_utils '),
    ('from .core_sxtwl ', 'from .sxtwl_utils '),

    # 跨目錄導入
    ('from ..function.f00_basic ', 'from ..function.basic '),
    ('from ..function.f01_lunar ', 'from ..function.lunar '),
    ('from ..function.f02_palace ', 'from ..function.palace_helper '),
    ('from ..function.f03_stars ', 'from ..function.stars_helper '),
    ('from ..function.f04_stars_main ', 'from ..function.stars_main '),
    ('from ..function.fn_rawdata ', 'from ..function.rawdata '),

    ('from ..palace.p01_ming_shen ', 'from ..palace.ming_shen '),
    ('from ..palace.p02_subject ', 'from ..palace.subject '),
    ('from ..palace.p03_gz ', 'from ..palace.gz '),
    ('from ..palace.p05_bureau ', 'from ..palace.bureau '),
    ('from ..palace.p06_body ', 'from ..palace.body '),

    ('from ..stars.s01_ziwei ', 'from ..stars.ziwei '),
    ('from ..stars.s02_major ', 'from ..stars.major '),
    ('from ..stars.s03_moon ', 'from ..stars.moon '),
    ('from ..stars.s04_hour ', 'from ..stars.hour '),
    ('from ..stars.s05_year_g ', 'from ..stars.year_g '),
    ('from ..stars.s05_year_z ', 'from ..stars.year_z '),
    ('from ..stars.s06_fire_ring ', 'from ..stars.fire_ring '),
    ('from ..stars.s07_general ', 'from ..stars.general '),
    ('from ..stars.s08_birth12 ', 'from ..stars.birth12 '),
    ('from ..stars.s09_days ', 'from ..stars.days '),
    ('from ..stars.s10_branch ', 'from ..stars.branch '),
    ('from ..stars.s11_ten ', 'from ..stars.ten '),
    ('from ..stars.s_brightness ', 'from ..stars.brightness '),
    ('from ..stars.s_4trans ', 'from ..stars.four_trans '),
]

# 遍歷所有 Python 檔案
count = 0
for py_file in base_dir.rglob('*.py'):
    # 跳過此腳本本身和其他輔助腳本
    if py_file.name in ['fix_filename_imports.py', 'replace_imports.py']:
        continue

    try:
        # 讀取檔案
        with open(py_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # 執行替換
        original_content = content
        for old, new in filename_replacements:
            content = content.replace(old, new)

        # 如果有修改才寫入
        if content != original_content:
            with open(py_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'[OK] Modified: {py_file.relative_to(base_dir)}')
            count += 1
    except Exception as e:
        print(f'[ERROR] {py_file.relative_to(base_dir)}: {e}')

print(f'\nFixed {count} files!')
