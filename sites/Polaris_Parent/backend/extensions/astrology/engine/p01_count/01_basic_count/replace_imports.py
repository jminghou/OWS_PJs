"""
全域替換模組導入路徑的腳本
"""
import os
from pathlib import Path

# 取得當前目錄
base_dir = Path(__file__).parent

# 定義替換規則
replacements = [
    ('from app.core.', 'from ..core.'),
    ('from app.palace.', 'from ..palace.'),
    ('from app.stars.', 'from ..stars.'),
    ('from app.flow.', 'from ..flow.'),
    ('from app.function.', 'from ..function.'),
    ('from app.utils.', 'from ..utils.'),
]

# 遍歷所有 Python 檔案
for py_file in base_dir.rglob('*.py'):
    # 跳過此腳本本身
    if py_file.name == 'replace_imports.py':
        continue

    try:
        # 讀取檔案
        with open(py_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # 執行替換
        original_content = content
        for old, new in replacements:
            content = content.replace(old, new)

        # 如果有修改才寫入
        if content != original_content:
            with open(py_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'[OK] Modified: {py_file.relative_to(base_dir)}')
    except Exception as e:
        print(f'[ERROR] {py_file.relative_to(base_dir)}: {e}')

print('\nReplacement completed!')
