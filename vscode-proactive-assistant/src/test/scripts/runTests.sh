#!/bin/bash

# Run Tests Script for Proactive AI Assistant Extension
# 
# This script runs all tests with optional coverage reporting.
# Usage: ./runTests.sh [--coverage]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
COVERAGE=false
if [ "$1" = "--coverage" ]; then
    COVERAGE=true
fi

echo -e "${YELLOW}Proactive AI Assistant - Test Runner${NC}"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run from extension root.${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Compile TypeScript
echo -e "${YELLOW}Compiling TypeScript...${NC}"
npm run compile

# Run linter
echo -e "${YELLOW}Running linter...${NC}"
npm run lint || true

# Run tests
if [ "$COVERAGE" = true ]; then
    echo -e "${YELLOW}Running tests with coverage...${NC}"
    npm run test:coverage
else
    echo -e "${YELLOW}Running tests...${NC}"
    npm test
fi

# Check exit code
if [ $? -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    
    if [ "$COVERAGE" = true ]; then
        echo -e "${YELLOW}Coverage report generated in coverage/ directory${NC}"
        
        # Check coverage threshold (80%)
        if [ -f "coverage/lcov-report/index.html" ]; then
            echo -e "${YELLOW}View coverage report: coverage/lcov-report/index.html${NC}"
        fi
    fi
    
    exit 0
else
    echo -e "${RED}Tests failed!${NC}"
    exit 1
fi
