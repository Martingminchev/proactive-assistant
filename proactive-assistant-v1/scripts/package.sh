#!/bin/bash
set -e

# Proactive AI Assistant - VSIX Packaging Script
# Usage: ./scripts/package.sh [version]

EXTENSION_DIR="vscode-proactive-assistant"
VERSION=${1:-}

echo "📦 Proactive AI Assistant - Packaging Script"
echo "=============================================="

# Validate extension directory
if [ ! -d "$EXTENSION_DIR" ]; then
    echo "❌ Error: Extension directory '$EXTENSION_DIR' not found"
    exit 1
fi

cd "$EXTENSION_DIR"

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📋 Current version: $CURRENT_VERSION"

# Update version if provided
if [ -n "$VERSION" ]; then
    echo "📝 Updating version to: $VERSION"
    npm version "$VERSION" --no-git-tag-version
fi

# Check for required files
echo "🔍 Checking required files..."
REQUIRED_FILES=("package.json" "README.md" "CHANGELOG.md")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "⚠️  Warning: $file not found"
    fi
done

# Install dependencies
echo "📥 Installing dependencies..."
npm ci

# Run linting
echo "🔍 Running linter..."
npm run lint || echo "⚠️  Linting failed, continuing..."

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

# Run tests
echo "🧪 Running tests..."
if command -v xvfb-run &> /dev/null; then
    xvfb-run -a npm test || echo "⚠️  Tests failed, continuing..."
else
    npm test || echo "⚠️  Tests failed, continuing..."
fi

# Build webview if exists
if [ -f "webview/package.json" ]; then
    echo "🎨 Building webview..."
    cd webview
    npm ci
    npm run build
    cd ..
fi

# Package extension
echo "📦 Creating VSIX package..."
npx @vscode/vsce package --no-dependencies

# Get the created VSIX filename
VSIX_FILE=$(ls -t *.vsix | head -1)
echo ""
echo "✅ Package created: $VSIX_FILE"
echo ""

# Validate package contents
echo "🔍 Validating package contents..."
unzip -l "$VSIX_FILE" | head -20
echo "..."
echo ""

# Calculate file size
SIZE=$(du -h "$VSIX_FILE" | cut -f1)
echo "📊 Package size: $SIZE"
echo ""

echo "🎉 Packaging complete!"
echo ""
echo "To install locally:"
echo "  code --install-extension $VSIX_FILE"
echo ""
echo "To publish to marketplace:"
echo "  npm run publish"
