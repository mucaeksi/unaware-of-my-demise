# Windows cloud VM variant of unity_ci.sh. Usage: powershell -File apps/unity/cloud/unity_ci.ps1 [import|test|build|all]
# Install first: Unity Hub -> Editor 6000.3.27f1 (changeset 672d562a42a7) + Android Build Support (with SDK/NDK + OpenJDK),
# or: "C:\Program Files\Unity Hub\Unity Hub.exe" -- --headless install --version 6000.3.27f1 --changeset 672d562a42a7 --module android --childModules
param([ValidateSet('import', 'test', 'build', 'all')][string]$Step = 'all')
$ErrorActionPreference = 'Stop'

$Root = (git -C $PSScriptRoot rev-parse --show-toplevel)
$Project = Join-Path $Root 'apps/unity'
$Version = ((Get-Content (Join-Path $Project 'ProjectSettings/ProjectVersion.txt'))[0] -replace '^m_EditorVersion:\s*', '').Trim()
$Unity = if ($env:UNITY_PATH) { $env:UNITY_PATH } else { "C:\Program Files\Unity\Hub\Editor\$Version\Editor\Unity.exe" }
$HubInstall = Join-Path $env:APPDATA 'UnityHub\secondaryInstallPath.json' # Hub's custom editor folder, e.g. "E:\Unity"
if (-not (Test-Path $Unity) -and -not $env:UNITY_PATH -and (Test-Path $HubInstall)) {
  $Unity = Join-Path (Get-Content $HubInstall -Raw | ConvertFrom-Json) "$Version\Editor\Unity.exe"
}
$Logs = Join-Path $Project 'Logs/ci'
New-Item -ItemType Directory -Force $Logs | Out-Null
if (-not (Test-Path $Unity)) { throw "Unity $Version not found at $Unity (set UNITY_PATH)" }

function Invoke-Unity([string]$Name, [string[]]$UnityArgs) {
  $log = Join-Path $Logs "$Name.log"
  $p = Start-Process -FilePath $Unity -Wait -PassThru -NoNewWindow -ArgumentList (@('-batchmode', '-nographics', '-projectPath', "`"$Project`"", '-logFile', "`"$log`"") + $UnityArgs)
  Select-String -Path $log -Pattern 'error CS\d+|Scripts have compiler errors|BuildFailedException|Exception:' | Select-Object -First 80 | ForEach-Object { $_.Line }
  if ($p.ExitCode -ne 0) { throw "Unity step '$Name' failed (exit $($p.ExitCode)); see $log" }
}

function Step-Import {
  Push-Location $Root
  if (-not (Test-Path node_modules)) { npm ci }
  npm run export:unity
  Pop-Location
  Invoke-Unity 'import' @('-executeMethod', 'Uomd.EditorTools.UomdProjectSetup.ApplyBatch')
  Write-Host 'Import OK. Commit the generated .meta files, ProjectSettings/*.asset, Packages/packages-lock.json and Assets/_UOMD/Settings.'
}
function Step-Test { Invoke-Unity 'test' @('-runTests', '-testPlatform', 'EditMode', '-testResults', "`"$Logs/editmode-results.xml`"") }
function Step-Build { Invoke-Unity 'build' @('-buildTarget', 'Android', '-executeMethod', 'Uomd.EditorTools.UomdBuild.BuildAndroidBatch') }

switch ($Step) {
  'import' { Step-Import }
  'test' { Step-Test }
  'build' { Step-Build }
  'all' { Step-Import; Step-Test; Step-Build }
}
