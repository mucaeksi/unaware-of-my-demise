param(
    [Parameter(Mandatory=$true)][string]$Godot,
    [Parameter(Mandatory=$true)][string]$Python,
    [Parameter(Mandatory=$true)][string]$BundletoolJar,
    [string]$BuildDirectory = ''
)
# The default always builds fresh. BuildDirectory only reuses an already attested local build.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path $PSScriptRoot -Parent
$releaseRoot = Join-Path $projectRoot 'release'
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
$lockPath = Join-Path $releaseRoot '.current-update.lock'
$lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
$candidate = ''
try {
    $runId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
    if (-not $BuildDirectory) {
        $BuildDirectory = "build/current-aab-$runId"
        & (Join-Path $PSScriptRoot 'Build-OpeningBundle.ps1') -Godot $Godot -Python $Python -BundletoolJar $BundletoolJar -OutputDirectory $BuildDirectory
    }
    $buildRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot $BuildDirectory))
    $arguments = @((Join-Path $PSScriptRoot 'materialize_aab.py'),'build','--project-root',$projectRoot,'--build-dir',$buildRoot,'--no-promote')
    foreach ($file in @('tools/Build-CurrentAAB.ps1','tools/pck_inventory.py','tools/verify_opening_base.gd','tools/verify_aab_native.py','docs/release/CURRENT_AAB.md','docs/release/ASSET_PROVENANCE.json')) {
        $arguments += @('--support-file', ($file + ':' + $file.Replace('docs/release/','docs/')))
    }
    $resultText = & $Python @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Candidate extraction failed; current remains unchanged' }
    $candidate = ($resultText | ConvertFrom-Json).output
    # Validate a separate copy so editor caches never contaminate sealed current.
    $validationRoot = Join-Path $projectRoot "build/current-source-check-$runId"
    New-Item -ItemType Directory -Path $validationRoot | Out-Null
    foreach ($directory in @('game','tools')) {
        Copy-Item -LiteralPath (Join-Path $candidate $directory) -Destination $validationRoot -Recurse
    }
    & (Join-Path $validationRoot 'tools/Build-CurrentAAB.ps1') -Godot $Godot -Python $Python -PacksOnly -OutputDirectory 'build/validation'
    $rebuiltPack = Join-Path $validationRoot 'build/validation/opening-base.pck'
    $sceneList = Join-Path $buildRoot 'scene-list.json'
    $originalScenes = Join-Path $buildRoot 'original-scenes.json'
    $rebuiltScenes = Join-Path $buildRoot 'rebuilt-scenes.json'
    & $Python (Join-Path $PSScriptRoot 'compare_opening_packs.py') (Join-Path $candidate 'artifacts/opening-base.pck') $rebuiltPack --write-scene-list $sceneList
    if ($LASTEXITCODE -ne 0) { throw 'Scene list extraction failed' }
    & $Godot --headless --main-pack (Join-Path $candidate 'artifacts/opening-base.pck') --script (Join-Path $PSScriptRoot 'inspect_pack_scenes.gd') -- $sceneList $originalScenes
    if ($LASTEXITCODE -ne 0) { throw 'Original packed scene inspection failed' }
    & $Godot --headless --main-pack $rebuiltPack --script (Join-Path $PSScriptRoot 'inspect_pack_scenes.gd') -- $sceneList $rebuiltScenes
    if ($LASTEXITCODE -ne 0) { throw 'Rebuilt packed scene inspection failed' }
    & $Python (Join-Path $PSScriptRoot 'compare_opening_packs.py') (Join-Path $candidate 'artifacts/opening-base.pck') $rebuiltPack --original-scenes $originalScenes --rebuilt-scenes $rebuiltScenes --report (Join-Path $buildRoot 'source-rebuild-acceptance.json')
    if ($LASTEXITCODE -ne 0) { throw 'Clean source rebuild differs; current remains unchanged' }
    & $Godot --headless --main-pack (Join-Path $candidate 'artifacts/opening-base.pck') --script (Join-Path $PSScriptRoot 'verify_opening_base.gd') -- (Join-Path $buildRoot 'base-privacy-acceptance.json')
    if ($LASTEXITCODE -ne 0) { throw 'Base runtime/privacy acceptance failed; current remains unchanged' }
    & $Python (Join-Path $PSScriptRoot 'materialize_aab.py') record-validation $candidate --project-root $projectRoot --build-dir $buildRoot
    if ($LASTEXITCODE -ne 0) { throw 'Candidate validation seal refused' }
    & $Python (Join-Path $PSScriptRoot 'materialize_aab.py') promote $candidate --project-root $projectRoot
    if ($LASTEXITCODE -ne 0) { throw 'Promotion refused; previous current preserved' }
    $candidate = ''
    & $Python (Join-Path $PSScriptRoot 'project_catalog.py') build --root $projectRoot
    if ($LASTEXITCODE -ne 0) { throw 'Current installed, but catalogue refresh failed' }
    Write-Output 'Latest verified test build: release/current/artifacts/game.aab'
} finally {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
        & $Python (Join-Path $PSScriptRoot 'materialize_aab.py') discard $candidate --project-root $projectRoot
    }
    $lock.Dispose()
}
