#!/bin/bash
set -e

# Proactive AI Assistant - Publishing Script
# Usage: ./scripts/publish.sh [marketplace|openvsx|both]

EXTENSION_DIR="vscode-proactive-assistant"
TARGET=${1:-"marketplace"}

echo "🚀 Proactive AI Assistant - Publishing Script"
echo "=============================================="
echo ""

# Check for VSCE_PAT if publishing to marketplace
if [ "$TARGET" == "marketplace" ] || [ "$TARGET" == "both" ]; then
    if [ -z "$VSCE_PAT" ]; then
        echo "❌ Error: VSCE_PAT environment variable is required for VS Code Marketplace"
        echo "Get your Personal Access Token from: https://dev.azure.com/"
        echo ""
        exit 1
    fi
fi

# Check for OVSX_PAT if publishing to Open VSX
if [ "$TARGET" == "openvsx" ] || [ "$TARGET" == "both" ]; then
    if [ -z "$OVSX_PAT" ]; then
        echo "❌ Error: OVSX_PAT environment variable is required for Open VSX"
        echo "Get your token from: https://open-vsx.org/"
        echo ""
        exit 1
    fi
fi

# Validate extension directory
if [ ! -d "$EXTENSION_DIR" ]; then
    echo "❌ Error: Extension directory '$EXTENSION_DIR' not found"
    exit 1
fi

cd "$EXTENSION_DIR"

# Get current version
VERSION=$(node -p "require('./package.json').version")
echo "📋 Publishing version: $VERSION"
echo ""

# Check if version is already published (VS Code Marketplace)
if [ "$TARGET" == "marketplace" ] || [ "$TARGET" == "both" ]; then
    echo "🔍 Checking if version $VERSION already exists on VS Code Marketplace..."
    PUBLISHED=$(npx @vscode/vsce show proactive-assistant.proactive-ai-assistant --json 2>/dev/null | grep -o '"version":"[^"]*"' | grep -o '"'$VERSION'"' || true)
    
    if [ -n "$PUBLISHED" ]; then
        echo "⚠️  Version $VERSION is already published!"
        echo "    Please update the version number in package.json"
        exit 1
    fi
    
    echo "✅ Version $VERSION is new"
    echo ""
fi

# Final confirmation
read -p "Are you sure you want to publish version $VERSION? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Publishing cancelled"
    exit 0
fi

echo ""
echo "📦 Packaging extension..."
npx @vscode/vsce package --no-dependencies

# Publish to VS Code Marketplace
if [ "$TARGET" == "marketplace" ] || [ "$TARGET" == "both" ]; then
    echo ""
    echo "🚀 Publishing to VS Code Marketplace..."
    npx @vscode/vsce publish -p "$VSCE_PAT"
    echo "✅ Published to VS Code Marketplace"
fi

# Publish to Open VSX
if [ "$TARGET" == "openvsx" ] || [ "$TARGET" == "both" ]; then
    echo ""
    echo "🚀 Publishing to Open VSX Registry..."
    npx ovsx publish -p "$OVSX_PAT"
    echo "✅ Published to Open VSX Registry"
fi

echo ""
echo "🎉 Publishing complete!"
echo ""
echo "Next steps:"
echo "  1. Check the extension page on the marketplace"
echo "  2. Verify the extension installs correctly"
echo "  3. Create a GitHub release with the VSIX file"
