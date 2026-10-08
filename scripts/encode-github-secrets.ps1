param(
  [Parameter(Mandatory=$true)][string]$KeystorePath,
  [Parameter(Mandatory=$false)][string]$PlayServiceAccountJsonPath
)

if (!(Test-Path $KeystorePath)) { throw "Keystore bulunamadı: $KeystorePath" }
$keystoreB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $KeystorePath)))
Set-Clipboard $keystoreB64
Write-Host "ANDROID_KEYSTORE_BASE64 hazırlandı ve panoya kopyalandı."
Write-Host "GitHub > Settings > Secrets and variables > Actions > New repository secret"
Write-Host "Secret name: ANDROID_KEYSTORE_BASE64"
Write-Host "Value: panodan yapıştır"

if ($PlayServiceAccountJsonPath) {
  if (!(Test-Path $PlayServiceAccountJsonPath)) { throw "Service account JSON bulunamadı: $PlayServiceAccountJsonPath" }
  $jsonB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $PlayServiceAccountJsonPath)))
  Set-Clipboard $jsonB64
  Write-Host "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64 hazırlandı ve panoya kopyalandı."
  Write-Host "Secret name: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64"
  Write-Host "Value: panodan yapıştır"
}
