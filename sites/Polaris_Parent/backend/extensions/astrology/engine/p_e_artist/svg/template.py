"""
SVG 文件容器 (V0.2)
支援 <style> 區塊注入。
"""


class SvgDocument:
    """SVG 文件外殼，收集子元素後一次輸出完整 XML。"""

    def __init__(self, width: float, height: float, css: str = ""):
        self._width = width
        self._height = height
        self._css = css
        self._children: list[str] = []

    def add(self, svg_fragment: str) -> "SvgDocument":
        if svg_fragment:
            self._children.append(svg_fragment)
        return self

    def to_string(self) -> str:
        header = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg"'
            f' viewBox="0 0 {self._width} {self._height}"'
            f' width="{self._width}" height="{self._height}">\n'
        )

        # <defs> + <style>
        defs = ""
        if self._css:
            defs = f"<defs>\n<style>\n{self._css}\n</style>\n</defs>\n"
        # EXTENSION POINT: 在 <defs> 中加入漸層、濾鏡、marker

        body = "\n".join(self._children)
        footer = "\n</svg>\n"
        return header + defs + body + footer
