param([Parameter(Mandatory=$true)][string]$Version,[string]$Godot="godot",[string]$BasePack="..\release\base.pck")
$out="..\patch\files\patch_$Version.pck"; New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null; & $Godot --headless --path ..\game --patches $BasePack --export-patch "Android" $out; if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}; Get-FileHash $out -Algorithm SHA256
