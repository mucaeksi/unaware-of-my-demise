param(
    [string]$GodotPath,
    [switch]$ImportOnly,
    [switch]$Headless,
    [switch]$Online,
    [switch]$ResetReview,
    [ValidateRange(0, 100000)][int]$QuitAfter = 0
)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskGame = Join-Path $taskRepo 'game'
$taskPin = (Get-Content -LiteralPath (Join-Path $taskGame 'GODOT_VERSION') -Raw).Trim()
if ($taskPin -notmatch '^\d+\.\d+\.\d+-stable$') { throw 'Invalid game/GODOT_VERSION.' }
$taskExpected = $taskPin.Replace('-', '.') + '.'
$taskLocal = $env:LOCALAPPDATA
if (!$taskLocal) { $taskLocal = [Environment]::GetFolderPath('LocalApplicationData') }
$taskState = Join-Path $taskLocal 'UnawareOfMyDemise/desktop-launcher'
New-Item -ItemType Directory -Path $taskState -Force | Out-Null
$taskCache = Join-Path $taskState 'godot-path.txt'

function Join-GodotArguments([string[]]$Arguments) {
    # Windows paths cannot contain quotes. Quote each token for Start-Process,
    # which otherwise joins an ArgumentList array without preserving spaces.
    return (($Arguments | ForEach-Object { '"' + $_ + '"' }) -join ' ')
}

function Invoke-GodotAndWait([string]$Executable, [string[]]$Arguments, [string]$LogName) {
    $taskOptions = @{
        FilePath = $Executable
        ArgumentList = (Join-GodotArguments $Arguments)
        WorkingDirectory = $taskGame
        RedirectStandardOutput = (Join-Path $taskState ($LogName + '.stdout.log'))
        RedirectStandardError = (Join-Path $taskState ($LogName + '.stderr.log'))
        Wait = $true
        PassThru = $true
    }
    if ($env:OS -eq 'Windows_NT') { $taskOptions.WindowStyle = 'Hidden' }
    $taskProcess = Start-Process @taskOptions
    if ($taskProcess.ExitCode -ne 0) {
        throw "Godot $LogName failed (exit $($taskProcess.ExitCode)). Logs: $taskState"
    }
    return Get-Content -LiteralPath $taskOptions.RedirectStandardOutput -Raw
}

function Test-GodotPin([string]$Candidate) {
    if (!$Candidate -or !(Test-Path -LiteralPath $Candidate -PathType Leaf)) { return $false }
    try {
        $taskVersion = Invoke-GodotAndWait $Candidate @('--version') 'version'
        return [bool]($taskVersion -match ('(?m)^' + [regex]::Escape($taskExpected)))
    } catch { return $false }
}

try {
    if (!(Test-Path -LiteralPath (Join-Path $taskGame 'project.godot'))) {
        throw 'game/project.godot is missing. Run this launcher from the complete repository.'
    }
    $taskGodot = $null
    if ($GodotPath) {
        if (!(Test-GodotPin $GodotPath)) { throw "Select Godot $taskPin. Executable/version check failed: $GodotPath" }
        $taskGodot = (Resolve-Path -LiteralPath $GodotPath).Path
    } else {
        $taskCandidates = @()
        if ($env:GODOT_EXE) { $taskCandidates += $env:GODOT_EXE }
        if (Test-Path -LiteralPath $taskCache) { $taskCandidates += (Get-Content -LiteralPath $taskCache -Raw).Trim() }
        foreach ($taskName in @('godot', 'godot4', "Godot_v${taskPin}_win64.exe")) {
            $taskCommand = Get-Command $taskName -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($taskCommand) { $taskCandidates += $taskCommand.Source }
        }
        if ($env:LOCALAPPDATA) {
            $taskPattern = Join-Path $env:LOCALAPPDATA "Microsoft/WinGet/Packages/GodotEngine.GodotEngine_*/Godot_v${taskPin}_win64.exe"
            $taskCandidates += @(Get-ChildItem -Path $taskPattern -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
        }
        foreach ($taskCandidate in ($taskCandidates | Select-Object -Unique)) {
            if (Test-GodotPin $taskCandidate) { $taskGodot = $taskCandidate; break }
        }
        if (!$taskGodot) {
            if ($env:OS -ne 'Windows_NT') { throw "Provide -GodotPath for Godot $taskPin." }
            Add-Type -AssemblyName System.Windows.Forms
            $taskPicker = New-Object System.Windows.Forms.OpenFileDialog
            $taskPicker.Title = "Select Godot $taskPin (remembered for future launches)"
            $taskPicker.Filter = 'Godot executable (*.exe)|*.exe'
            try {
                if ($taskPicker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
                    Write-Host 'Selection cancelled; no game started.'
                    exit 0
                }
                $taskGodot = $taskPicker.FileName
            } finally { $taskPicker.Dispose() }
            if (!(Test-GodotPin $taskGodot)) { throw "The selected executable must be Godot $taskPin." }
        }
    }
    Set-Content -LiteralPath $taskCache -Value $taskGodot -Encoding UTF8
    Write-Host "Preparing the pulled game source with Godot $taskPin..."
    $taskImport = @('--headless', '--editor', '--import', '--path', $taskGame, '--log-file', (Join-Path $taskState 'import.log'))
    Invoke-GodotAndWait $taskGodot $taskImport 'import' | Out-Null
    if ($ImportOnly) { Write-Host 'Imports complete.'; exit 0 }
    $taskRun = @('--path', $taskGame, '--resolution', '540x960', '--log-file', (Join-Path $taskState 'game.log'))
    if (!$Online) {
        $taskRun += @('--scene', 'res://scenes/art_review/desktop_opening_review.tscn')
        Write-Host 'Desktop review: Google sign-in is skipped; opening and tutorial use local data.'
    }
    if ($Headless) { $taskRun += '--headless' }
    if ($QuitAfter -gt 0) { $taskRun += @('--quit-after', [string]$QuitAfter) }
    if ($ResetReview -and !$Online) { $taskRun += @('--', '--reset-review') }
    if ($Headless -or $QuitAfter -gt 0) {
        Invoke-GodotAndWait $taskGodot $taskRun 'game' | Out-Null
    } else {
        Start-Process -FilePath $taskGodot -ArgumentList (Join-GodotArguments $taskRun) -WorkingDirectory $taskGame
    }
    Write-Host 'Current game source launched.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
