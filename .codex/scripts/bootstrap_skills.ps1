[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$canonicalSkills = [IO.Path]::GetFullPath((Join-Path $projectRoot '.codex/skills'))
$discoverySkills = [IO.Path]::GetFullPath((Join-Path $projectRoot '.agents/skills'))
$rootPrefix = $projectRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
foreach ($checkedPath in @($canonicalSkills, $discoverySkills)) {
    if (-not $checkedPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escaped the project root: $checkedPath"
    }
}
if (-not (Test-Path -LiteralPath $canonicalSkills -PathType Container)) {
    throw 'Canonical .codex/skills is missing. No changes made.'
}
New-Item -ItemType Directory -Path (Join-Path $projectRoot '.agents') -Force | Out-Null
$existingBridge = Get-Item -LiteralPath $discoverySkills -Force -ErrorAction SilentlyContinue
if ($existingBridge) {
    if ($existingBridge.LinkType -notin @('Junction', 'SymbolicLink')) {
        throw 'Existing .agents/skills is a normal folder. Back up and verify its contents before moving it; this bootstrap will not replace it.'
    }
    $bridgeTarget = [string](@($existingBridge.Target)[0])
    if (-not [IO.Path]::IsPathRooted($bridgeTarget)) {
        $bridgeTarget = Join-Path (Split-Path $discoverySkills -Parent) $bridgeTarget
    }
    $bridgeTarget = [IO.Path]::GetFullPath($bridgeTarget)
    if ($bridgeTarget -eq $canonicalSkills -and (Test-Path -LiteralPath $discoverySkills)) {
        Write-Output "Verified $($existingBridge.LinkType): .agents/skills -> .codex/skills"
        return
    }
    # Remove only the checked link node, never recurse into its target.
    Remove-Item -LiteralPath $discoverySkills -Force
}
try {
    # The native API stores this target relative to the link's parent directory.
    [IO.Directory]::CreateSymbolicLink($discoverySkills, '../.codex/skills') | Out-Null
    Write-Output 'Created relative symbolic link: .agents/skills -> ../.codex/skills'
} catch {
    if ($env:OS -ne 'Windows_NT') { throw }
    if (Get-Item -LiteralPath $discoverySkills -Force -ErrorAction SilentlyContinue) { throw }
    New-Item -ItemType Junction -Path $discoverySkills -Target $canonicalSkills | Out-Null
    Write-Output 'Created local Windows junction. Run this bootstrap again after cloning or moving the checkout.'
}
$createdBridge = Get-Item -LiteralPath $discoverySkills -Force
if ($createdBridge.LinkType -notin @('Junction', 'SymbolicLink') -or -not (Test-Path -LiteralPath $discoverySkills)) {
    throw 'Discovery bridge verification failed.'
}
$createdTarget = [string](@($createdBridge.Target)[0])
if (-not [IO.Path]::IsPathRooted($createdTarget)) {
    $createdTarget = Join-Path (Split-Path $discoverySkills -Parent) $createdTarget
}
if ([IO.Path]::GetFullPath($createdTarget) -ne $canonicalSkills) {
    throw 'Discovery bridge target does not match canonical .codex/skills.'
}
