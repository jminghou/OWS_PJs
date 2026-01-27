import os
import sys

# 確保根目錄在路徑中
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    from sites.Polaris_Parent.backend.app import app
except ImportError as e:
    print(f"匯入失敗詳情: {e}")
    raise

if __name__ == "__main__":
    app.run()
