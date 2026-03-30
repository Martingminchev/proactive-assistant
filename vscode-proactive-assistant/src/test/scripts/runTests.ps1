# Run Tests Script for Proactive AI Assistant Extension
# 
# This script runs all tests with optional coverage reporting.
# Usage: .\runTests.ps1 [-Coverage]

param(
    [switch]$Coverage
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"

Write-Host "Proactive AI Assistant - Test Runner" -ForegroundColor $Yellow
Write-Host "======================================"

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Please run from extension root." -ForegroundColor $Red
    exit 1
}

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor $Yellow
    npm install
}

# Compile TypeScript
Write-Host "Compiling TypeScript..." -ForegroundColor $Yellow
$compileResult = npm run compile 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Compilation failed!" -ForegroundColor $Red
    Write-Host $compileResult
    exit 1
}

# Run linter
Write-Host "Running linter..." -ForegroundColor $Yellow
$lintResult = npm run lint 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Linting warnings (non-blocking):" -ForegroundColor $Yellow
    Write-Host $lintResult
}

# Run tests
if ($Coverage) {
    Write-Host "Running tests with coverage..." -ForegroundColor $Yellow
    npm run test:coverage
} else {
    Write-Host "Running tests..." -ForegroundColor $Yellow
    npm test
}

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host "All tests passed!" -ForegroundColor $Green
    
    if ($Coverage) {
        Write-Host "Coverage report generated in coverage/ directory" -ForegroundColor $Yellow
        
        # Check coverage threshold (80%)
        $coverageReport = "coverage/lcov-report/index.html"
        if (Test-Path $coverageReport) {
            Write-Host "View coverage report: $coverageReport" -ForegroundColor $Yellow
        }
    }
    
    exit 0
} else {
    Write-Host "Tests failed!" -ForegroundColor $Red
    exit 1
}
