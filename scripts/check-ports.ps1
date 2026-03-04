# PowerShell Port Checker Script
# Checks which ports are in use and suggests available ports

Write-Host "🔍 Checking port availability...`n" -ForegroundColor Cyan

# Common development ports to check
$commonPorts = @(3000, 3001, 3002, 5173, 5174, 8080, 4000, 5000, 5001)
$availablePorts = @()
$usedPorts = @()

foreach ($port in $commonPorts) {
    $result = netstat -ano | Select-String ":$port" | Select-String "LISTENING"
    
    if ($result) {
        Write-Host "Port $($port.ToString().PadRight(5)): ❌ IN USE" -ForegroundColor Red
        $usedPorts += $port
    } else {
        Write-Host "Port $($port.ToString().PadRight(5)): ✅ AVAILABLE" -ForegroundColor Green
        $availablePorts += $port
    }
}

Write-Host "`n📊 Summary:" -ForegroundColor Cyan

if ($availablePorts.Count -gt 0) {
    Write-Host "`n✅ Available ports: $($availablePorts -join ', ')" -ForegroundColor Green
    Write-Host "💡 Recommended: Use port $($availablePorts[0])" -ForegroundColor Yellow
}

if ($usedPorts.Count -gt 0) {
    Write-Host "`n❌ Ports in use: $($usedPorts -join ', ')" -ForegroundColor Red
}

Write-Host "`n💡 To change the port in vite.config.js, edit the 'port' value." -ForegroundColor Yellow
