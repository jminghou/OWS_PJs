"""
將所有中文警告訊息改為英文，避免編碼問題
"""
from pathlib import Path

base_dir = Path(__file__).parent

replacements = [
    ('print(f"警告:', 'print(f"[WARNING]:'),
    ('print("警告:', 'print("[WARNING]:'),
    ('警告: 无法导入', '[WARNING] Cannot import'),
    ('警告: 使用', '[WARNING] Using fallback function for'),
    ('模块的替代函数', ''),
]

count = 0
for py_file in base_dir.rglob('*.py'):
    if py_file.name.startswith('fix_'):
        continue

    try:
        with open(py_file, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        for old, new in replacements:
            content = content.replace(old, new)

        if content != original_content:
            with open(py_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'[OK] Modified: {py_file.relative_to(base_dir)}')
            count += 1
    except Exception as e:
        print(f'[ERROR] {py_file.relative_to(base_dir)}: {e}')

print(f'\nFixed {count} files!')
