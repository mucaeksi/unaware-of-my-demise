param([string]$SourceDirectory = '')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$repository = 'https://github.com/gdquest-demos/godot-4-VFX-assets.git'
$revision = 'f6034a88877f6ea144ae487694cc8fde82d4da7f'
$reference = Join-Path $workspace 'references/gdquest_vfx/upstream'
$library = Join-Path $workspace 'game/assets/vfx/gdquest_reference'
if (-not $SourceDirectory) {
    $SourceDirectory = Join-Path $workspace 'build/gdquest-vfx-review-20261008/upstream'
    if (-not (Test-Path -LiteralPath (Join-Path $SourceDirectory '.git'))) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $SourceDirectory) | Out-Null
        & git clone --no-checkout $repository $SourceDirectory
        if ($LASTEXITCODE -ne 0) { throw 'GDQuest clone failed.' }
        & git -C $SourceDirectory checkout --detach $revision
        if ($LASTEXITCODE -ne 0) { throw 'Pinned GDQuest checkout failed.' }
    }
}
$actualRevision = & git -C $SourceDirectory rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $actualRevision.Trim() -ne $revision) { throw 'Source must match the pinned revision.' }
$sourceChanges = & git -C $SourceDirectory status --porcelain
if ($sourceChanges) { throw 'Source checkout contains changes; refusing to copy altered upstream assets.' }
$utf8 = [System.Text.UTF8Encoding]::new($false)
$files = @(& git -C $SourceDirectory ls-files)
if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate upstream files.' }
$shaderInventory = @()
foreach ($relative in $files) {
    $source = Join-Path $SourceDirectory $relative
    $destinations = @((Join-Path $reference $relative))
    if ([System.IO.Path]::GetExtension($relative) -eq '.gdshader') {
        $destinations += Join-Path $library ('shaders/' + $relative)
        $shaderInventory += [ordered]@{ path = 'shaders/' + $relative; sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() }
    }
    foreach ($destination in $destinations) {
        if (Test-Path -LiteralPath $destination) {
            # Godot rewrites importer sidecars when the isolated demo is opened.
            if ($relative.EndsWith('.import')) { continue }
            if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $destination).Hash) {
                throw "Existing reference differs: $destination. Preserving it; resolve before reinstalling."
            }
        } else {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
            Copy-Item -LiteralPath $source -Destination $destination
        }
    }
}
$licenseText = [System.IO.File]::ReadAllText((Join-Path $SourceDirectory 'LICENSE'))
$mitText = ($licenseText -split '## MIT License', 2)[1] -split '## Creative Commons', 2
[System.IO.File]::WriteAllText((Join-Path $library 'LICENSE-MIT.txt'), $mitText[0].Trim() + "`n", $utf8)
$metadata = [ordered]@{
    repository = $repository; commit = $revision; installed = '2026-10-08'
    status = 'REFERENCE_ONLY_NOT_INTEGRATED'; shaders_license = 'MIT'
    original_art_license = 'CC-BY-NC-SA-4.0'; original_project = 'references/gdquest_vfx/upstream/project.godot'
    export_excluded = $true; upstream_files = $files.Count; shader_count = $shaderInventory.Count
    shaders = $shaderInventory
}
[System.IO.File]::WriteAllText((Join-Path $library 'SOURCE.json'), ($metadata | ConvertTo-Json -Depth 6) + "`n", $utf8)
Write-Output "Installed $($shaderInventory.Count) MIT shaders; preserved $($files.Count) upstream files in the separate reference project."
