<#
.SYNOPSIS
    安裝 .gitattributes 並把 repo 的換行統一為 LF（一次性掃描）。

.DESCRIPTION
    為什麼需要：Polaris 的原始碼是 CRLF、Claire 是 LF。實測 197 行的
    CategorySelector.tsx 在 `diff` 下顯示 394 行全異，實際差異是 0 —— 也就是
    「兩份檔案早就一模一樣」這件事，任何工具、任何 code review 都看不出來。
    模組化過程要大量搬檔案、比對「搬過去的跟原本的是否等價」，換行不統一
    會讓每一次比對都是噪音。

    為什麼做成腳本而不是直接放 .gitattributes：
    `text=auto eol=lf` 一旦存在，下一次 `git add` 就會把碰到的檔案全部重寫，
    正在進行中的工作會被混進一堆無意義的全檔 diff。所以這件事必須是
    「乾淨工作區 + 獨立 commit」，本腳本會強制檢查。

    範圍：只正規化 core / packages / sites/Polaris_Parent / scripts / docs /
    .github。**刻意不含 sites/Claire_Project** —— Claire 在本階段凍結
    （見 docs/FROZEN_CONTRACT.md），不製造無謂的 diff。

.EXAMPLE
    pwsh -File scripts/normalize-eol.ps1 -WhatIf   # 只看會動到哪些檔
    pwsh -File scripts/normalize-eol.ps1           # 實際執行
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    # 略過乾淨工作區檢查（不建議；只有你確定要把正規化混進現有變更時才用）
    [switch]$AllowDirty
)

$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repo

Write-Host "Repo: $repo" -ForegroundColor Cyan

# --- 1. 乾淨工作區檢查 ---------------------------------------------------------
$dirty = @(git status --porcelain)
if ($dirty.Count -gt 0 -and -not $AllowDirty) {
    Write-Host ""
    Write-Host "✗ 工作區有 $($dirty.Count) 項未提交變更。" -ForegroundColor Red
    Write-Host ""
    Write-Host "  換行正規化會重寫大量檔案，必須是獨立的一個 commit，" -ForegroundColor Yellow
    Write-Host "  否則你正在進行的工作會被混進數百個全檔 diff 裡面。" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  請先 commit 或 stash 現有變更，再重跑本腳本。"
    Write-Host "  （確定要混在一起的話：-AllowDirty）"
    exit 1
}

# --- 2. 寫入 .gitattributes ----------------------------------------------------
$gitattributes = @'
# 換行統一為 LF —— 見 scripts/normalize-eol.ps1 的說明。
#
# 背景：Polaris 原本是 CRLF、Claire 是 LF，導致兩份內容完全相同的檔案在 diff
# 下顯示為「每一行都不同」。模組化要靠比對來確認搬移等價，所以換行必須統一。

* text=auto eol=lf

# Claire_Project 在模組化期間凍結（docs/FROZEN_CONTRACT.md），
# 不納入正規化，避免產生與凍結無關的雜訊 diff。
sites/Claire_Project/** -text

# Windows 專用腳本保留 CRLF，否則某些 PowerShell 執行環境會出問題。
*.ps1   text eol=crlf
*.bat   text eol=crlf
*.cmd   text eol=crlf

# 二進位：明確標記，避免 Git 誤判成文字而做換行轉換。
*.png   binary
*.jpg   binary
*.jpeg  binary
*.gif   binary
*.webp  binary
*.ico   binary
*.pdf   binary
*.woff  binary
*.woff2 binary
*.ttf   binary
*.otf   binary
*.zip   binary
*.whl   binary

# SVG 是文字（紫微星曜圖示需要能 diff），但體積大、由腳本產生，
# 在 PR 上摺疊起來以免淹沒 review。
*.svg   text eol=lf linguist-generated=true

# Lock 檔同理。
package-lock.json  text eol=lf linguist-generated=true
'@

$target = Join-Path $repo '.gitattributes'
if ($PSCmdlet.ShouldProcess($target, '寫入 .gitattributes')) {
    # 用 UTF8 無 BOM 寫入（Git 對 .gitattributes 的 BOM 容忍度不一致）
    [System.IO.File]::WriteAllText($target, $gitattributes, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "✓ 已寫入 .gitattributes" -ForegroundColor Green
}

# --- 3. 重新正規化索引 ---------------------------------------------------------
# 只掃指定路徑；Claire 已在 .gitattributes 以 -text 排除，這裡再排一次以求明確。
$paths = @('core', 'packages', 'sites/Polaris_Parent', 'scripts', 'docs', '.github', '*.md', '*.json', '*.yml')
$existing = $paths | Where-Object { $_ -match '\*' -or (Test-Path $_) }

if ($PSCmdlet.ShouldProcess("$($existing -join ', ')", 'git add --renormalize')) {
    git add --renormalize -- $existing
    if ($LASTEXITCODE -ne 0) { throw "git add --renormalize 失敗" }

    git add -- .gitattributes

    $staged = @(git diff --cached --name-only)
    Write-Host ""
    Write-Host "✓ 已正規化 $($staged.Count) 個檔案（僅換行，內容未變）" -ForegroundColor Green
    Write-Host ""
    Write-Host "驗證（應該顯示 0 行實質差異）：" -ForegroundColor Cyan
    $realDiff = git diff --cached --ignore-cr-at-eol --numstat |
        Where-Object { $_ -notmatch '^0\s+0\s' }
    if ($realDiff) {
        Write-Host "  ⚠ 以下檔案有換行以外的差異，請人工確認：" -ForegroundColor Yellow
        $realDiff | ForEach-Object { Write-Host "    $_" }
    } else {
        Write-Host "  ✓ 純換行變更，無任何實質內容改動" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "接著："
    Write-Host '  git commit -m "chore: 換行統一為 LF（純機械變更，Claire 除外）"'
}
