#!/bin/bash
# Setup script for Proactive AI Assistant VS Code Extension
# Usage: ./scripts/setup.sh

set -e

echo "🤖 Proactive AI Assistant - Setup Script"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
echo -n "📦 Checking Node.js version... "
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "   Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version too old ($NODE_VERSION)${NC}"
    echo "   Please upgrade to Node.js 18+"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Check npm
echo -n "📦 Checking npm... "
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v)${NC}"

# Check VS Code
echo -n "💻 Checking VS Code... "
if command -v code &> /dev/null; then
    echo -e "${GREEN}✓ VS Code installed${NC}"
elif command -v codium &> /dev/null; then
    echo -e "${GREEN}✓ VSCodium installed${NC}"
else
    echo -e "${YELLOW}⚠️ VS Code not found in PATH${NC}"
    echo "   You can still use the extension but 'code' command won't work"
fi

# Install root dependencies
echo ""
echo "📥 Installing extension dependencies..."
npm install

# Install webview dependencies
echo ""
echo "📥 Installing webview dependencies..."
cd webview
npm install
cd ..

# Compile TypeScript
echo ""
echo "🔨 Compiling TypeScript..."
npm run compile

# Build webview
echo ""
echo "🎨 Building webview..."
npm run build:webview

# Verify build
echo ""
echo "✅ Verifying build..."
if [ -d "out" ] && [ -f "out/extension.js" ]; then
    echo -e "${GREEN}✓ Extension compiled successfully${NC}"
else
    echo -e "${RED}❌ Extension compilation failed${NC}"
    exit 1
fi

if [ -d "out/webview" ] && [ -f "out/webview/index.html" ]; then
    echo -e "${GREEN}✓ Webview built successfully${NC}"
else
    echo -e "${RED}❌ Webview build failed${NC}"
    exit 1
fi

# Check for Pieces OS
echo ""
echo -n "🔌 Checking Pieces OS... "
if curl -s http://localhost:1000/.health > /dev/null 2>&1 || \
   curl -s http://localhost:39300/.health > /dev/null 2>&1 || \
   curl -s http://localhost:5323/.health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Pieces OS detected${NC}"
else
    echo -e "${YELLOW}⚠️ Pieces OS not detected${NC}"
    echo "   The extension will work but suggestions need Pieces OS."
    echo "   Download from: https://pieces.app/"
fi

echo ""
echo "========================================="
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Open this folder in VS Code"
echo "  2. Press F5 to run the extension"
echo "  3. Or run: npm run package"
echo ""
echo "Documentation:"
echo "  📖 QUICKSTART.md - Get started quickly"
echo "  📖 README.md - Full documentation"
echo "  📖 docs/USAGE.md - Usage guide"
echo ""
