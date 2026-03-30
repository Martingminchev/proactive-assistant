# Proactive AI Assistant - VSIX Packaging Script (PowerShell)
# Usage: .\scripts\package.ps1 [version]

param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$ExtensionDir = "vscode-proactive-assistant"

Write-Host "📦 Proactive AI Assistant - Packaging Script" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Validate extension directory
if (-not (Test-Path $ExtensionDir)) {
    Write-Host "❌ Error: Extension directory '$ExtensionDir' not found" -ForegroundColor Red
    exit 1
}

Set-Location $ExtensionDir

# Get current version from package.json
$PackageJson = Get-Content "package.json" | ConvertFrom-Json
$CurrentVersion = $PackageJson.version
Write-Host "📋 Current version: $CurrentVersion"

# Update version if provided
if ($Version) {
    Write-Host "📝 Updating version to: $Version"
    npm version $Version --no-git-tag-version
}

# Check for required files
Write-Host "🔍 Checking required files..."
$RequiredFiles = @("package.json", "README.md", "CHANGELOG.md")
foreach ($file in $RequiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "⚠️  Warning: $file not found" -ForegroundColor Yellow
    }
}

# Install dependencies
Write-Host "📥 Installing dependencies..."
npm ci

# Run linting
Write-Host "🔍 Running linter..."
try {
    npm run lint
} catch {
    Write-Host "⚠️  Linting failed, continuing..." -ForegroundColor Yellow
}

# Compile TypeScript
Write-Host "🔨 Compiling TypeScript..."
npm run compile

# Run tests
Write-Host "🧪 Running tests..."
try {
    npm test
} catch {
    Write-Host "⚠️  Tests failed, continuing..." -ForegroundColor Yellow
}

# Build webview if exists
if (Test-Path "webview/package.json") {
    Write-Host "🎨 Building webview..."
    Set-Location webview
    npm ci
    npm run build
    Set-Location ..
}

# Package extension
Write-Host "📦 Creating VSIX package..."
npx @vscode/vsce package --no-dependencies

# Get the created VSIX filename
$VsixFile = Get-ChildItem -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host ""
Write-Host "✅ Package created: $($VsixFile.Name)" -ForegroundColor Green
Write-Host ""

# Validate package contents
Write-Host "🔍 Validating package contents..."
Expand-Archive -Path $VsixFile.FullName -DestinationPath "_temp_extract" -Force
Get-ChildItem "_temp_extract" -Recurse | Select-Object -First 20 | ForEach-Object {
    $indent = "  " * ($_.FullName.Split('\').Count - 3)
    if ($_.PSIsContainer) {
        Write-Host "$indent📁 $($_.Name)"
    } else {
        Write-Host "$indent📄 $($_.Name)"
    }
}
Remove-Item "_temp_extract" -Recurse -Force
Write-Host "..."
Write-Host ""

# Calculate file size
$Size = [math]::Round($VsixFile.Length / 1KB, 2)
Write-Host "📊 Package size: $Size KB"
Write-Host ""

Write-Host "🎉 Packaging complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To install locally:"
Write-Host "  code --install-extension $($VsixFile.Name)"
Write-Host ""
Write-Host "To publish to marketplace:"
Write-Host "  npm run publish"
