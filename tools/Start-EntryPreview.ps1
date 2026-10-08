param([switch]$LargeText)
$ErrorActionPreference = 'Stop'
$taskGamePath = Join-Path (Split-Path $PSScriptRoot -Parent) 'game'
$taskGodot = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\GodotEngine.GodotEngine_*\Godot_v4.7.2-stable_win64.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (!$taskGodot) { throw 'Godot 4.7.2 executable not found.' }
$taskArguments = @('--path', ('"' + $taskGamePath + '"'), '--resolution', '540x960', 'res://scenes/art_review/production_ui_preview.tscn', '--', '--ui-page=entry', '--entry-only')
if ($LargeText) { $taskArguments += '--ui-large-text' }
Start-Process -FilePath $taskGodot.FullName -ArgumentList $taskArguments
