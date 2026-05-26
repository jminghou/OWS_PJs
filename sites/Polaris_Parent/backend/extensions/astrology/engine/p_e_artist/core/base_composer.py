"""
抽象基底 Composer (V0.4)
所有圖表類型的 Composer 都繼承此類，實作 compose() → ChartLayout。
"""

from abc import ABC, abstractmethod
from ..theme import ThemeConfig
from .elements import ChartLayout


class BaseComposer(ABC):
    """
    圖表佈局計算的抽象基底。

    子類需實作:
        compose() → ChartLayout
    """

    def __init__(self, data, theme: ThemeConfig, **kwargs):
        self._data = data
        self._theme = theme
        self._kwargs = kwargs

    @abstractmethod
    def compose(self) -> ChartLayout:
        """計算佈局，回傳格式無關的 ChartLayout。"""
        ...
