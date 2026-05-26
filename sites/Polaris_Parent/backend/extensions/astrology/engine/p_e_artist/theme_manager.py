import os
import json
from typing import Dict, List

THEMES_DIR = os.path.join(os.path.dirname(__file__), "themes")

class ThemeManager:
    """主題管理器：負責讀取與列出所有可用的主題。"""

    @classmethod
    def list_themes(cls) -> List[Dict]:
        """列出所有可用的主題資訊。"""
        themes = []
        if not os.path.exists(THEMES_DIR):
            return themes

        for theme_id in os.listdir(THEMES_DIR):
            theme_path = os.path.join(THEMES_DIR, theme_id)
            json_path = os.path.join(theme_path, "theme.json")
            
            if os.path.isdir(theme_path) and os.path.exists(json_path):
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        themes.append({
                            "id": theme_id,
                            "name": meta.get("name", theme_id),
                            "description": meta.get("description", ""),
                            "path": theme_path
                        })
                except Exception as e:
                    print(f"無法讀取主題 {theme_id}: {e}")
        return themes

    @classmethod
    def load_theme(cls, theme_id: str) -> dict:
        """載入指定主題的設定字典 (config)。"""
        json_path = os.path.join(THEMES_DIR, theme_id, "theme.json")
        if not os.path.exists(json_path):
            raise FileNotFoundError(f"找不到主題設定檔: {json_path}")
            
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("config", {})
