[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$canonicalSkills = Join-Path $projectRoot '.codex/skills'
if (-not (Test-Path -LiteralPath $canonicalSkills -PathType Container)) { throw 'Canonical skills are missing. No changes made.' }
$skills = @(Get-ChildItem -LiteralPath $canonicalSkills -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md') -PathType Leaf })
if ($skills.Count -eq 0) { throw 'No canonical skills. No changes made.' }
$specs = @(@{ Path = (Join-Path $projectRoot '.agents/skills'); Target = $canonicalSkills; Relative = '../.codex/skills' })
foreach ($skill in $skills) {
    $specs += @{ Path = (Join-Path $projectRoot ".claude/skills/$($skill.Name)"); Target = $skill.FullName; Relative = "../../.codex/skills/$($skill.Name)" }
}
$pending = @()
foreach ($spec in $specs) {
    $parent = Split-Path $spec.Path -Parent
    while ($parent -ne $projectRoot) {
        $parentItem = Get-Item -LiteralPath $parent -Force -ErrorAction SilentlyContinue
        if ($parentItem -and (-not $parentItem.PSIsContainer -or $parentItem.LinkType -in @('Junction', 'SymbolicLink'))) {
            throw "Discovery parent must be a normal directory: $parent. No changes made."
        }
        $parent = Split-Path $parent -Parent
    }
    $existing = Get-Item -LiteralPath $spec.Path -Force -ErrorAction SilentlyContinue
    if ($existing) {
        if ($existing.LinkType -in @('Junction', 'SymbolicLink')) {
            $target = [string](@($existing.Target)[0])
            if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path (Split-Path $spec.Path -Parent) $target }
            if ([IO.Path]::GetFullPath($target) -eq $spec.Target -and (Test-Path -LiteralPath $spec.Path)) { continue }
            throw "Conflicting discovery link: $($spec.Path). No changes made."
        }
        $isPlaceholder = $false
        if ($env:OS -eq 'Windows_NT' -and -not $existing.PSIsContainer) {
            $bytes = [IO.File]::ReadAllBytes($spec.Path)
            $isPlaceholder = [Convert]::ToBase64String($bytes) -eq [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($spec.Relative))
        }
        if (-not $isPlaceholder) { throw "Existing user file/folder: $($spec.Path). No changes made." }
    }
    $pending += $spec
}
foreach ($spec in $pending) {
    New-Item -ItemType Directory -Path (Split-Path $spec.Path -Parent) -Force | Out-Null
    if (Test-Path -LiteralPath $spec.Path -PathType Leaf) { Remove-Item -LiteralPath $spec.Path -Force }
    try {
        Push-Location (Split-Path $spec.Path -Parent)
        try { New-Item -ItemType SymbolicLink -Path (Split-Path $spec.Path -Leaf) -Target $spec.Relative | Out-Null }
        finally { Pop-Location }
    } catch {
        if ($env:OS -ne 'Windows_NT' -or (Get-Item -LiteralPath $spec.Path -Force -ErrorAction SilentlyContinue)) { throw }
        New-Item -ItemType Junction -Path $spec.Path -Target $spec.Target | Out-Null
    }
    $created = Get-Item -LiteralPath $spec.Path -Force
    $target = [string](@($created.Target)[0])
    if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path (Split-Path $spec.Path -Parent) $target }
    if (-not (Test-Path -LiteralPath $spec.Path -PathType Container) -or [IO.Path]::GetFullPath($target) -ne $spec.Target) { throw "Bridge verification failed: $($spec.Path)" }
}
Write-Output "Verified $($skills.Count) canonical skills for Codex and Claude; created $($pending.Count) links."
