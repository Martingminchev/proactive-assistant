#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Checking Pieces Copilot Service file...\n');

const filePath = path.join(__dirname, 'server', 'services', 'piecesCopilotService.js');

let fileContent = fs.readFileSync(filePath, 'utf8');

console.log('Current connect() method:');
const connectMatch = fileContent.match(/async connect\(\) \{[\s\S]*?\n([\s\S]*?)\n\s+await /);
if (connectMatch) {
  console.log(connectMatch[1]);
  console.log('\n');
}

if (fileContent.includes('await this.connectorApi.connect({})')) {
  console.log('❌ ERROR: Found problematic code: await this.connectorApi.connect({})');
  console.log('   This will cause "this.middleware is not iterable" error\n');
  
  const fixedContent = fileContent.replace(
    /await this\.connectorApi\.connect\(\{\})/,
    'await this.connectorApi.connect()'
  );
  
  console.log('🔧 Fixing...\n');
  fs.writeFileSync(filePath, fixedContent);
  console.log('✅ Fixed! The empty object {} has been removed.\n');
  console.log('⚠ IMPORTANT: You must restart the server for changes to take effect!\n');
} else if (fileContent.includes('await this.connectorApi.connect();')) {
  console.log('✅ Good! connect() method is already fixed.\n');
} else {
  console.log('⚠ Warning: Could not find connect() method\n');
}

console.log('Please restart the server with:');
console.log('  cd server');
console.log('  npm start');
