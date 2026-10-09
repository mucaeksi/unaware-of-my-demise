param(
    [Parameter(Mandatory=$true)][string]$Godot,
    [Parameter(Mandatory=$true)][string]$Python,
    [string]$OutputDirectory = "build/opening-aab-20261008",
    [string]$BundletoolJar = "",
    [string]$DebugKeystore = '',
    [switch]$PacksOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $DebugKeystore) {
    $configRoot = if ($env:APPDATA) { $env:APPDATA } elseif ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { Join-Path $HOME '.config' }
    $DebugKeystore = Join-Path $configRoot $(if (([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT)) { 'Godot/keystores/debug.keystore' } else { 'godot/debug.keystore' })
}
$projectRoot = Split-Path $PSScriptRoot -Parent
$gameRoot = Join-Path $projectRoot 'game'
$outputRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$basePack = Join-Path $outputRoot 'opening-base.pck'
$storyPack = Join-Path $outputRoot 'story-content.pck'
$reviewBundle = Join-Path $outputRoot 'opening-review.aab'
function Invoke-BuildStep([string]$name, [string]$executable, [string[]]$arguments) {
    $stepLog = Join-Path $outputRoot ($name + '.log')
    & $executable @arguments 2>&1 | Tee-Object -FilePath $stepLog
    if ($LASTEXITCODE -ne 0) { throw "$name failed ($LASTEXITCODE). See $stepLog" }
}
function Get-Artifact([string]$path) {
    $item = Get-Item -LiteralPath $path
    return @{path=$item.FullName; bytes=$item.Length; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
}
Invoke-BuildStep 'import' $Godot @('--headless','--path',$gameRoot,'--editor','--import')
Invoke-BuildStep 'base-pack' $Godot @('--headless','--path',$gameRoot,'--quit','--export-pack','Android AAB',$basePack)
Invoke-BuildStep 'base-inventory' $Python @((Join-Path $PSScriptRoot 'pck_inventory.py'),$basePack,'--json',($basePack+'.inventory.json'))
Invoke-BuildStep 'story-patch' $Godot @('--headless','--path',$gameRoot,'--quit','--patches',$basePack,'--export-patch','Content Full',$storyPack)
Invoke-BuildStep 'patch-policy' $Python @((Join-Path $PSScriptRoot 'pck_inventory.py'),$storyPack,'--patch-policy','--base',$basePack,'--json',($storyPack+'.inventory.json'))
Invoke-BuildStep 'pack-acceptance' $Godot @('--headless','--main-pack',$basePack,'--script',(Join-Path $PSScriptRoot 'verify_opening_pack.gd'),'--',$storyPack,(Join-Path $outputRoot 'pack-acceptance.json'))
$report = @{created_at=(Get-Date).ToUniversalTime().ToString('o'); base=(Get-Artifact $basePack); patch=(Get-Artifact $storyPack); patch_policy='passed'; distribution='local_review'; device_test='pending_no_device'}
if (-not $PacksOnly) {
    # An idle Windows Gradle daemon can retain the exporter pipe after completion.
    # Use an ephemeral daemon for this build; preserve the owner's shell settings.
    $previousGradleOptions = $env:GRADLE_OPTS
    try {
        $env:GRADLE_OPTS = ($previousGradleOptions + ' -Dorg.gradle.daemon=false').Trim()
        Invoke-BuildStep 'android-aab' $Godot @('--headless','--path',$gameRoot,'--export-debug','Android AAB',$reviewBundle)
    } finally { $env:GRADLE_OPTS = $previousGradleOptions }
    if (-not (Test-Path -LiteralPath $DebugKeystore)) { throw "Existing Godot debug keystore missing: $DebugKeystore" }
    # Godot's AAB output can be unsigned even for --export-debug. Apply only the
    # public Android debug identity, never a production upload key.
    $previousReviewPassword = $env:UOMD_REVIEW_KEY_PASS
    try {
        $env:UOMD_REVIEW_KEY_PASS = 'android'
        Invoke-BuildStep 'debug-signing' (Get-Command jarsigner).Source @('-keystore',$DebugKeystore,'-storepass:env','UOMD_REVIEW_KEY_PASS','-keypass:env','UOMD_REVIEW_KEY_PASS','-sigalg','SHA256withRSA','-digestalg','SHA-256',$reviewBundle,'androiddebugkey')
    } finally { $env:UOMD_REVIEW_KEY_PASS = $previousReviewPassword }
    Invoke-BuildStep 'jar-signature' (Get-Command jarsigner).Source @('-verify',$reviewBundle)
    if ((Get-Content -LiteralPath (Join-Path $outputRoot 'jar-signature.log') -Raw) -notmatch 'jar verified') { throw 'Review bundle signature was not verified' }
    if (-not $BundletoolJar) {
        $BundletoolJar = Join-Path $outputRoot 'bundletool-all-1.18.2.jar'
        $expectedHash = '378b5434cd1378bef6b2bc527b8c7f0ff2584b273830335bce54d6d0813c8584'
        if (-not (Test-Path -LiteralPath $BundletoolJar)) {
            Invoke-WebRequest -Uri 'https://github.com/google/bundletool/releases/download/1.18.2/bundletool-all-1.18.2.jar' -OutFile $BundletoolJar
        }
    }
    if ((Get-FileHash -LiteralPath $BundletoolJar -Algorithm SHA256).Hash.ToLowerInvariant() -ne '378b5434cd1378bef6b2bc527b8c7f0ff2584b273830335bce54d6d0813c8584') { throw 'Pinned bundletool checksum mismatch' }
    Invoke-BuildStep 'bundle-validation' (Get-Command java).Source @('-jar',$BundletoolJar,'validate',('--bundle='+$reviewBundle))
    Invoke-BuildStep 'native-packaging' $Python @((Join-Path $PSScriptRoot 'verify_aab_native.py'),$reviewBundle,'--report',(Join-Path $outputRoot 'native-packaging.json'))
    Invoke-BuildStep 'bundle-manifest' (Get-Command java).Source @('-jar',$BundletoolJar,'dump','manifest',('--bundle='+$reviewBundle),'--module=base')
    $report.bundle = Get-Artifact $reviewBundle
    $report.signing = 'Godot debug key: local review only; production upload signing remains a release step'
    $report.bundletool_validation = 'passed'
    $report.native_packaging = 'passed'
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'build-report.json') -Encoding utf8
Write-Output "Local opening build ready: $outputRoot"
