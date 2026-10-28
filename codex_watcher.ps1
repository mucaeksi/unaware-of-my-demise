Write-Host "Codex Unity Koruyucusu Başlatıldı..." -ForegroundColor Green

# Doğrudan projenizin dizinini hedef alıyoruz ve sürücü geçişini garanti ediyoruz
$TargetDir = "E:\Unity\unaware-of-my-demise"
Set-Location -Path $TargetDir

while ($true) {
    Write-Host "[$(Get-Date)] Codex Unity projenizde çalıştırılıyor..." -ForegroundColor Cyan
    
    # Codex'i mevcut Unity klasöründe tetikler (. mevcut klasör demektir)
    codex .
    
    Write-Host "[$(Get-Date)] Bağlantı koptu veya Codex durdu. 5 saniye içinde otomatik yeniden başlatılıyor..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}
