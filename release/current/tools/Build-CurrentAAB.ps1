param(
    [Parameter(Mandatory=$true)][string]$Godot,
    [Parameter(Mandatory=$true)][string]$Python,
    [string]$OutputDirectory = 'build/standalone-review',
    [string]$BundletoolJar = '',
    [string]$DebugKeystore = (Join-Path $env:APPDATA 'Godot/keystores/debug.keystore'),
    [switch]$PacksOnly
)
# Works from the generated folder too: only the opening preset and base are needed.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$snapshotRoot = Split-Path $PSScriptRoot -Parent
$gameRoot = Join-Path $snapshotRoot 'game'
$outputRoot = [IO.Path]::GetFullPath((Join-Path $snapshotRoot $OutputDirectory))
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
function Invoke-Step([string]$name, [string]$executable, [string[]]$arguments) {
    & $executable @arguments 2>&1 | Tee-Object -FilePath (Join-Path $outputRoot ($name + '.log'))
    if ($LASTEXITCODE -ne 0) { throw "$name failed ($LASTEXITCODE)" }
}
function Artifact([string]$path) {
    return @{path=[IO.Path]::GetFileName($path); bytes=(Get-Item -LiteralPath $path).Length; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
}
Invoke-Step 'import' $Godot @('--headless','--path',$gameRoot,'--editor','--import')
$basePack = Join-Path $outputRoot 'opening-base.pck'
Invoke-Step 'base-pack' $Godot @('--headless','--path',$gameRoot,'--quit','--export-pack','Android AAB',$basePack)
Invoke-Step 'inventory' $Python @((Join-Path $PSScriptRoot 'pck_inventory.py'),$basePack,'--json',($basePack+'.inventory.json'))
Invoke-Step 'base-acceptance' $Godot @('--headless','--main-pack',$basePack,'--script',(Join-Path $PSScriptRoot 'verify_opening_base.gd'),'--',(Join-Path $outputRoot 'base-acceptance.json'))
$report = @{created_at=(Get-Date).ToUniversalTime().ToString('o'); base=(Artifact $basePack); base_acceptance='passed'; distribution='local_review'; device_test='pending_no_device'}
if (-not $PacksOnly) {
    $templateArguments = @()
    if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'android/build/build.gradle'))) {
        # Godot only processes this flag together with an actual Android export.
        $templateArguments = @('--install-android-build-template')
    }
    foreach ($variant in @('debug','release')) {
        $aar = Join-Path $gameRoot "addons/uomd_native/bin/$variant/uomd_native-$variant.aar"
        if (-not (Test-Path -LiteralPath $aar)) { throw 'Native AAR missing. Rebuild with game/tools/build_uomd_native.sh (JDK 17, SDK 36, Gradle 8.11.1).' }
    }
    $bundle = Join-Path $outputRoot 'game.aab'
    $previousGradleOptions = $env:GRADLE_OPTS
    try {
        $env:GRADLE_OPTS = ($previousGradleOptions + ' -Dorg.gradle.daemon=false').Trim()
        # --export-debug exits on completion. An extra --quit can end plugin
        # initialization before the native exporter is registered on a clean copy.
        Invoke-Step 'android-aab' $Godot (@('--headless','--path',$gameRoot) + $templateArguments + @('--export-debug','Android AAB',$bundle))
    } finally { $env:GRADLE_OPTS = $previousGradleOptions }
    if (-not (Test-Path -LiteralPath $DebugKeystore)) { throw 'Existing external Godot debug keystore required' }
    $previousPassword = $env:UOMD_REVIEW_KEY_PASS
    try {
        $env:UOMD_REVIEW_KEY_PASS = 'android'
        Invoke-Step 'debug-signing' (Get-Command jarsigner).Source @('-keystore',$DebugKeystore,'-storepass:env','UOMD_REVIEW_KEY_PASS','-keypass:env','UOMD_REVIEW_KEY_PASS','-sigalg','SHA256withRSA','-digestalg','SHA-256',$bundle,'androiddebugkey')
    } finally { $env:UOMD_REVIEW_KEY_PASS = $previousPassword }
    Invoke-Step 'signature' (Get-Command jarsigner).Source @('-verify',$bundle)
    if ((Get-Content -LiteralPath (Join-Path $outputRoot 'signature.log') -Raw) -notmatch 'jar verified') { throw 'Debug signature verification failed' }
    if (-not $BundletoolJar -or -not (Test-Path -LiteralPath $BundletoolJar)) { throw 'Pass an existing bundletool 1.18.2 JAR' }
    if ((Get-FileHash -LiteralPath $BundletoolJar -Algorithm SHA256).Hash.ToLowerInvariant() -ne '378b5434cd1378bef6b2bc527b8c7f0ff2584b273830335bce54d6d0813c8584') { throw 'Pinned bundletool checksum mismatch' }
    Invoke-Step 'bundle-validation' (Get-Command java).Source @('-jar',$BundletoolJar,'validate',('--bundle='+$bundle))
    Invoke-Step 'native-packaging' $Python @((Join-Path $PSScriptRoot 'verify_aab_native.py'),$bundle,'--report',(Join-Path $outputRoot 'native-packaging.json'))
    $report.bundle = Artifact $bundle
    $report.signing = 'local debug only'
    $report.bundletool_validation = 'passed'
    $report.native_packaging = 'passed'
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'build-report.json') -Encoding utf8
Write-Output "Standalone opening verified: $outputRoot"
