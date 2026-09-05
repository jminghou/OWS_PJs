"""
顯示名稱查詢（代碼 → 中文）—— API 視圖層共用
===============================================

星／宮／地支／四化／取樣關係的中文對照，查不到一律回原碼（不拋例外、不猜）。

刻意不從 `report_md` 匯入：那會把 Markdown 產出層拉進相依鏈，
而 API 視圖（star_energy / palace_readings）要能在只 vendor 最小集的
環境（例如 OWS 網站後端）獨立運作。

取樣關係的中文取自 `sampling_window.json` 的 `labels_zh`——與權重同一個檔，
改調參時不會出現「權重改了、標籤沒改」的漂移。
"""

from .config import load_sampling_window

#: 運限層 → 中文
LAYER_ZH = {"natal": "生年", "decade": "大限", "year": "流年", "small": "小限"}


class Names:
    def __init__(self, registry, data_dir: str = None):
        from p_a_foundation.core.mapping import get_mapping
        self._m = get_mapping()
        self.registry = registry
        self._rel = load_sampling_window(data_dir).get("labels_zh", {})

    def star(self, code):
        return self._m.get_star_name(code) or code

    def palace(self, code):
        return self._m.get_palace_name(code) or code

    def branch(self, code):
        return (self._m.get_branch_name(code) or code) if code else ""

    def sihua(self, code):
        return self._m.get_sihua_name(code) or code

    def relation(self, code):
        """main/opposite/trine → 主宮/對宮/三方（真源＝sampling_window.labels_zh）。"""
        return self._rel.get(code, code)

    def layer_zh(self, layer):
        return LAYER_ZH.get(layer, layer)

    def dim_zh(self, slug):
        """維度 slug → 中文（主星＝天格屬性；輔星＝組名）。"""
        d = self.registry.by_name.get(slug)
        return d.name_zh if d is not None else slug

    def dim_kind(self, slug):
        d = self.registry.by_name.get(slug)
        return d.kind if d is not None else None
