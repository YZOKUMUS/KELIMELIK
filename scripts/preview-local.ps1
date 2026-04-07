param([int]$Port = 5500)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Sunucu ayağa kalkmadan önce tarayıcı açılmasın diye kısa gecikme
$browserCmd = "Start-Sleep -Seconds 1; Start-Process 'http://127.0.0.1:$Port/index.html'"
Start-Process powershell -ArgumentList '-NoProfile', '-Command', $browserCmd -WindowStyle Hidden

python -m http.server $Port
