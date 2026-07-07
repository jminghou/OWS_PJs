<#
.SYNOPSIS
    將紫微斗數排盤核心從 P_Union 同步（vendoring）到 Polaris_Parent 後端。

.DESCRIPTION
    來源：D:\P_Polaris_Parent\1_run\P_Union（可用 -Source 覆蓋）
    目標：sites/Polaris_Parent/backend/extensions/astrology/engine

    同步下列 vendored 核心，並重新套用必要的「最小 __init__ 覆蓋」與「import 修補」，
    使 engine 可獨立於 P_Union 執行（Docker build context 只含 OWS repo）：
      - p01_count/(__init__ + 01_basic_count)   排盤核心 calculate_chart
      - solar/s3_solar_time.py                  真太陽時
      - geo/geo_manager.py                      地點→經緯度
      - p_e_artist/                             SVG/HTML 繪圖引擎
      - p_a_foundation/(core/mapping + data)    繪圖用編碼對照（最小集）
      - p_d_graph/exporter/code_registry.py     code→名稱對照（最小集）
      - convert/(special_decoder + chart_parser + chart_serializer + palace_stems)  encoded_array→繪圖格式

    每次更動 P_Union 排盤邏輯後重跑本腳本即可同步。

.EXAMPLE
    pwsh -File scripts/publish_ziwei_engine.ps1
#>
param(
    [string]$Source = "D:\P_Polaris_Parent\1_run\P_Union",
    [string]$Engine = (Join-Path $PSScriptRoot "..\sites\Polaris_Parent\backend\extensions\astrology\engine")
)

$ErrorActionPreference = "Stop"
$Engine = [System.IO.Path]::GetFullPath($Engine)
Write-Host "來源 P_Union : $Source"
Write-Host "目標 engine  : $Engine"
if (-not (Test-Path $Source)) { throw "找不到來源 P_Union：$Source" }

function Copy-Tree($from, $to) {
    if (Test-Path $to) { Remove-Item $to -Recurse -Force }
    Copy-Item $from $to -Recurse -Force
}
function Replace-InFile($path, $old, $new) {
    # 正規化行尾，避免 CRLF/LF 差異導致 literal 比對失敗
    $c = (Get-Content $path -Raw -Encoding utf8).Replace("`r`n", "`n")
    $old = $old.Replace("`r`n", "`n")
    $new = $new.Replace("`r`n", "`n")
    if (-not $c.Contains($old)) {
        throw "patch 套用失敗（找不到比對片段）：$path"
    }
    $c = $c.Replace($old, $new)
    Set-Content -Path $path -Value $c -Encoding utf8 -NoNewline
}
function Clean-Junk($root) {
    Get-ChildItem $root -Recurse -Directory -Force |
        Where-Object { $_.Name -in @('__pycache__','tests','examples','output','Doc','demo') } |
        ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
}

New-Item -ItemType Directory -Force -Path $Engine | Out-Null

# 1) 排盤核心 p01_count（只取 __init__ + 01_basic_count）
New-Item -ItemType Directory -Force -Path "$Engine\p01_count" | Out-Null
Copy-Item "$Source\p01_count\__init__.py" "$Engine\p01_count\__init__.py" -Force
Copy-Tree "$Source\p01_count\01_basic_count" "$Engine\p01_count\01_basic_count"

# 2) 真太陽時 + 地理（單檔）
New-Item -ItemType Directory -Force -Path "$Engine\solar","$Engine\geo" | Out-Null
Copy-Item "$Source\p01_count\02_scraper_updated\s3_solar_time.py" "$Engine\solar\s3_solar_time.py" -Force
Copy-Item "$Source\p01_count\04_ui_web\geo_manager.py" "$Engine\geo\geo_manager.py" -Force

# 3) 繪圖引擎 p_e_artist
Copy-Tree "$Source\p_e_artist" "$Engine\p_e_artist"
Remove-Item "$Engine\p_e_artist\__main__.py" -Force -ErrorAction SilentlyContinue

# 4) p_a_foundation（繪圖用最小集：core/mapping + data）
New-Item -ItemType Directory -Force -Path "$Engine\p_a_foundation\core","$Engine\p_a_foundation\data" | Out-Null
Copy-Item "$Source\p_a_foundation\core\mapping.py" "$Engine\p_a_foundation\core\mapping.py" -Force
foreach ($f in @("palace_codes.json","earthly_branch_codes.json","heavenly_stem_codes.json","sihua_codes.json","dim_stars.csv","star_properties.csv","star_codes.json")) {
    if (Test-Path "$Source\p_a_foundation\data\$f") { Copy-Item "$Source\p_a_foundation\data\$f" "$Engine\p_a_foundation\data\$f" -Force }
}
Set-Content "$Engine\p_a_foundation\__init__.py" "# minimal vendored stub (rendering deps only)" -Encoding utf8
Set-Content "$Engine\p_a_foundation\core\__init__.py" "# minimal vendored stub" -Encoding utf8

# 5) p_d_graph（繪圖用最小集：exporter/code_registry + data）
New-Item -ItemType Directory -Force -Path "$Engine\p_d_graph\exporter","$Engine\p_d_graph\data" | Out-Null
Copy-Item "$Source\p_d_graph\exporter\code_registry.py" "$Engine\p_d_graph\exporter\code_registry.py" -Force
if (Test-Path "$Source\p_d_graph\data\dimension_definitions.csv") {
    Copy-Item "$Source\p_d_graph\data\dimension_definitions.csv" "$Engine\p_d_graph\data\dimension_definitions.csv" -Force
}
Set-Content "$Engine\p_d_graph\__init__.py" "# minimal vendored stub (code_registry only)" -Encoding utf8
Set-Content "$Engine\p_d_graph\exporter\__init__.py" "# minimal vendored stub: avoid heavy engine import chain" -Encoding utf8

# 6) convert（encoded_array → 繪圖格式）+ 重新套用 import 修補
New-Item -ItemType Directory -Force -Path "$Engine\convert" | Out-Null
Copy-Item "$Source\p_a_foundation\core\special_decoder.py" "$Engine\convert\special_decoder.py" -Force
Copy-Item "$Source\p_d_graph\bridge\chart_parser.py"        "$Engine\convert\chart_parser.py" -Force
Copy-Item "$Source\p_d_graph\bridge\palace_stems.py"        "$Engine\convert\palace_stems.py" -Force
Copy-Item "$Source\p_d_graph\exporter\chart_serializer.py"  "$Engine\convert\chart_serializer.py" -Force

# palace_stems.py：修正根目錄深度（bridge 在 P_Union 深一層；vendored convert 的上兩層即 engine 目錄，
# p01_count 與 p_a_foundation 皆在 engine 下）
Replace-InFile "$Engine\convert\palace_stems.py" "_union_root = Path(__file__).parent.parent.parent" "_union_root = Path(__file__).parent.parent"

# chart_parser.py：移除 p_a_foundation 套件依賴，改用本地 special_decoder
Replace-InFile "$Engine\convert\chart_parser.py" @'
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List

# 確保 p_a_foundation 可被導入
_union_root = Path(__file__).parent.parent.parent
if str(_union_root) not in sys.path:
    sys.path.insert(0, str(_union_root))

from p_a_foundation.core.special_decoder import SpecialCodeDecoder
from p_a_foundation.core.mapping import get_mapping
'@ @'
from dataclasses import dataclass, field
from typing import Optional, List

# vendored 自 P_Union/p_a_foundation/core/special_decoder.py（純 stdlib、零外部依賴）
from .special_decoder import SpecialCodeDecoder
'@
Replace-InFile "$Engine\convert\chart_parser.py" @'
        self._special = SpecialCodeDecoder()
        self._mapping = get_mapping()
'@ @'
        self._special = SpecialCodeDecoder()
'@
# chart_serializer.py：改用本地 chart_parser 與 palace_stems
Replace-InFile "$Engine\convert\chart_serializer.py" "from ..bridge.chart_parser import ChartState" "from .chart_parser import ChartState"
Replace-InFile "$Engine\convert\chart_serializer.py" "from ..bridge.palace_stems import build_palace_branch_map, compute_palace_stems" "from .palace_stems import build_palace_branch_map, compute_palace_stems"

Set-Content "$Engine\convert\__init__.py" @'
"""編碼 → 繪圖格式轉換層（vendored 自 P_Union）。"""
from .special_decoder import SpecialCodeDecoder
from .chart_parser import ChartParser, ChartState
from .chart_serializer import serialize_chart

__all__ = ["SpecialCodeDecoder", "ChartParser", "ChartState", "serialize_chart"]
'@ -Encoding utf8

# 7) 清掉所有 __pycache__/tests/examples/output/Doc/demo
Clean-Junk $Engine

# 8) 記錄來源版本
$commit = ""
try { $commit = (git -C "D:\P_Polaris_Parent\1_run" rev-parse --short HEAD 2>$null) } catch {}
$stamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Set-Content "$Engine\VENDOR_VERSION.txt" "source: $Source`ncommit: $commit`nsynced: $stamp`n" -Encoding utf8

$parent = Split-Path -Parent $Engine
Write-Host ""
Write-Host "[OK] 同步完成。請在 backend venv 重跑驗證（import engine 後呼叫 render_natal_svg）。" -ForegroundColor Green
Write-Host ("  engine 路徑父層： " + $parent)
