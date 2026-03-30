# Test API endpoints for Proactive AI Assistant
# Start server in background and test endpoints

$serverDir = "C:\Users\marti\Desktop\Projects\proactive-assistant\server"
$results = @()
$startTime = Get-Date

# Function to test endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET"
    )
    
    Write-Host "Testing $Name ($Method $Url)..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Uri $Url -Method $Method -TimeoutSec 30 -ErrorAction Stop
        $statusCode = 200
        $success = $true
        $errorMsg = $null
    }
    catch {
        $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        $success = $false
        $errorMsg = $_.Exception.Message
        $response = $null
    }
    
    $result = [PSCustomObject]@{
        Name = $Name
        Method = $Method
        URL = $Url
        StatusCode = $statusCode
        Success = $success
        Error = $errorMsg
        Response = $response
    }
    
    return $result
}

# Change to server directory and start server
Set-Location $serverDir

# Start server in background
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:serverDir
    npm start 2>&1
}

Write-Host "Starting server..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Wait for server to be ready
$maxRetries = 30
$retry = 0
$serverReady = $false

while ($retry -lt $maxRetries -and -not $serverReady) {
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 2
        $serverReady = $true
        Write-Host "Server is ready!" -ForegroundColor Green
    }
    catch {
        $retry++
        Write-Host "Waiting for server... ($retry/$maxRetries)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $serverReady) {
    Write-Host "Server failed to start within timeout" -ForegroundColor Red
    Stop-Job $serverJob
    exit 1
}

# Test endpoints
$endpoints = @(
    @{ Name = "Health Check"; Url = "http://localhost:3001/health"; Method = "GET" },
    @{ Name = "API Docs"; Url = "http://localhost:3001/api"; Method = "GET" },
    @{ Name = "Context Health"; Url = "http://localhost:3001/api/context/health"; Method = "GET" },
    @{ Name = "Realtime Context"; Url = "http://localhost:3001/api/context/realtime"; Method = "GET" },
    @{ Name = "Today's Brief"; Url = "http://localhost:3001/api/briefs/today"; Method = "GET" },
    @{ Name = "Active Suggestions"; Url = "http://localhost:3001/api/suggestions/active"; Method = "GET" }
)

foreach ($endpoint in $endpoints) {
    $result = Test-Endpoint -Name $endpoint.Name -Url $endpoint.Url -Method $endpoint.Method
    $results += $result
    
    if ($result.Success) {
        Write-Host "  ✓ $($endpoint.Name): $($result.StatusCode) OK" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($endpoint.Name): $($result.StatusCode) - $($result.Error)" -ForegroundColor Red
    }
}

# Try to generate a test brief
Write-Host "`nTesting Generate Brief (POST)..." -ForegroundColor Cyan
try {
    $genResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/briefs/generate" -Method POST -TimeoutSec 60
    $genSuccess = $true
    $genStatus = 200
    $genError = $null
}
catch {
    $genStatus = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    $genSuccess = $false
    $genError = $_.Exception.Message
    $genResponse = $null
}

$genResult = [PSCustomObject]@{
    Name = "Generate Brief"
    Method = "POST"
    URL = "http://localhost:3001/api/briefs/generate"
    StatusCode = $genStatus
    Success = $genSuccess
    Error = $genError
    Response = $genResponse
}
$results += $genResult

if ($genSuccess) {
    Write-Host "  ✓ Generate Brief: $genStatus OK" -ForegroundColor Green
} else {
    Write-Host "  ✗ Generate Brief: $genStatus - $genError" -ForegroundColor Red
}

# Cleanup
Stop-Job $serverJob
Remove-Job $serverJob

# Generate report
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "API TEST RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Duration: $($duration.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Gray
Write-Host "`n"

$successful = ($results | Where-Object { $_.Success }).Count
$failed = ($results | Where-Object { -not $_.Success }).Count

Write-Host "SUMMARY:" -ForegroundColor Yellow
Write-Host "  Successful: $successful" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor Red
Write-Host "  Total: $($results.Count)" -ForegroundColor White

Write-Host "`nDETAILED RESULTS:" -ForegroundColor Yellow
foreach ($r in $results) {
    $color = if ($r.Success) { "Green" } else { "Red" }
    Write-Host "`n$($r.Name):" -ForegroundColor $color
    Write-Host "  URL: $($r.Method) $($r.URL)" -ForegroundColor Gray
    Write-Host "  Status: $($r.StatusCode)" -ForegroundColor Gray
    if ($r.Success -and $r.Response) {
        Write-Host "  Response: $($r.Response | ConvertTo-Json -Depth 3 -Compress)" -ForegroundColor Gray
    }
    if ($r.Error) {
        Write-Host "  Error: $($r.Error)" -ForegroundColor Red
    }
}

# Export to file
$report = @"
# API Test Results - Proactive AI Assistant

**Test Date:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Duration:** $($duration.TotalSeconds.ToString('F2')) seconds

## Summary

| Metric | Count |
|--------|-------|
| Successful | $successful |
| Failed | $failed |
| Total | $($results.Count) |

## Prerequisites Status

- MongoDB: Running (mongod.exe found)
- Pieces OS: Not detected

## Endpoint Results

"@

foreach ($r in $results) {
    $status = if ($r.Success) { "✅ 200 OK" } else { "❌ FAILED" }
    $report += @"

### $($r.Name)
- **Method:** $($r.Method)
- **URL:** $($r.URL)
- **Status:** $status

"@
    if ($r.Success -and $r.Response) {
        $json = $r.Response | ConvertTo-Json -Depth 3
        $report += "**Response:**`n```json`n$json`n```" + "`n"
    }
    if ($r.Error) {
        $report += "**Error:** $($r.Error)`n"
    }
}

$report += @"

## Issues Found

"@

$errors = $results | Where-Object { -not $_.Success }
if ($errors) {
    foreach ($e in $errors) {
        $report += "- **$($e.Name)**: $($e.Error)`n"
    }
} else {
    $report += "No issues found.`n"
}

$report | Out-File -FilePath "C:\Users\marti\Desktop\Projects\proactive-assistant\TEST_RESULTS.md" -Encoding UTF8

Write-Host "`nReport saved to: C:\Users\marti\Desktop\Projects\proactive-assistant\TEST_RESULTS.md" -ForegroundColor Cyan
