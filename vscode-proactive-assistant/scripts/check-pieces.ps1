# Check if Pieces OS is running
$ports = @(1000, 39300, 5323)
$found = $false

Write-Host "Checking for Pieces OS..." -ForegroundColor Cyan
Write-Host ""

foreach ($port in $ports) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port/.well-known/health" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Pieces OS found on port $port" -ForegroundColor Green
            Write-Host "   Response: $($response.Content)"
            $found = $true
            break
        }
    } catch {
        Write-Host "❌ Port $port - not responding" -ForegroundColor Red
    }
}

if (-not $found) {
    Write-Host ""
    Write-Host "⚠️  Pieces OS not found on any port!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Possible solutions:" -ForegroundColor White
    Write-Host "  1. Make sure Pieces OS is installed" -ForegroundColor White
    Write-Host "     Download: https://pieces.app/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  2. Start Pieces OS manually:" -ForegroundColor White
    Write-Host "     Press Win+S, type 'Pieces', click 'Pieces OS'" -ForegroundColor White
    Write-Host ""
    Write-Host "  3. Check Windows Services:" -ForegroundColor White
    Write-Host "     Press Win+R, type 'services.msc', look for 'Pieces OS'" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: The extension works without Pieces OS, but AI features won't be available." -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "✅ Pieces OS is running! The extension should connect automatically." -ForegroundColor Green
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")"}几滴I have created documentation and a PowerShell script to help the user check if Pieces OS is running. Let me provide a summary in the chat.散## 🔍 How to Check Pieces OS Status### Quick Methods:1. **Browser Test**: Open http://localhost:39300/.well-known/healthIf Pieces is running, you'll see `{