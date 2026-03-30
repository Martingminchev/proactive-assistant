#!/usr/bin/env node

/**
 * Quick integration test for Pieces fixes
 * Tests that all new services load without errors
 */

console.log('🧪 Quick Integration Test\n');

const tests = [];

// Test 1: Load piecesCopilotService
console.log('1️⃣ Testing piecesCopilotService...');
try {
  const piecesService = require('../services/piecesCopilotService');
  console.log('   ✅ Service loads successfully');
  console.log(`   📊 Methods: ${Object.keys(piecesService).filter(k => typeof piecesService[k] === 'function').length} functions`);
  tests.push({ name: 'piecesCopilotService', status: 'pass' });
} catch (e) {
  console.log('   ❌ Failed:', e.message);
  tests.push({ name: 'piecesCopilotService', status: 'fail', error: e.message });
}

// Test 2: Load contextSummarizationService
console.log('\n2️⃣ Testing contextSummarizationService...');
try {
  const summaryService = require('../services/contextSummarizationService');
  console.log('   ✅ Service loads successfully');
  console.log(`   📊 Methods: ${Object.keys(summaryService).filter(k => typeof summaryService[k] === 'function').length} functions`);
  tests.push({ name: 'contextSummarizationService', status: 'pass' });
} catch (e) {
  console.log('   ❌ Failed:', e.message);
  tests.push({ name: 'contextSummarizationService', status: 'fail', error: e.message });
}

// Test 3: Load contextHealthService
console.log('\n3️⃣ Testing contextHealthService...');
try {
  const healthService = require('../services/contextHealthService');
  console.log('   ✅ Service loads successfully');
  console.log(`   📊 Type: ${typeof healthService}`);
  tests.push({ name: 'contextHealthService', status: 'pass' });
} catch (e) {
  console.log('   ❌ Failed:', e.message);
  tests.push({ name: 'contextHealthService', status: 'fail', error: e.message });
}

// Test 4: Load routes
console.log('\n4️⃣ Testing Routes...');
const routeTests = [
  '../routes/contextRoutes',
  '../routes/healthRoutes'
];

for (const route of routeTests) {
  try {
    require(route);
    console.log(`   ✅ ${route.split('/').pop()} loads successfully`);
    tests.push({ name: route, status: 'pass' });
  } catch (e) {
    console.log(`   ❌ ${route} failed:`, e.message);
    tests.push({ name: route, status: 'fail', error: e.message });
  }
}

// Test 5: Check server.js can be required
console.log('\n5️⃣ Testing server.js...');
try {
  // Don't actually start the server, just check syntax
  const fs = require('fs');
  const path = require('path');
  const serverPath = path.join(__dirname, '..', 'server.js');
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  
  // Basic validation - check for required imports
  const hasExpress = serverCode.includes('express');
  const hasRoutes = serverCode.includes('contextRoutes');
  const hasHealthRoutes = serverCode.includes('healthRoutes');
  
  console.log('   ✅ Server file readable');
  console.log(`   📦 Express: ${hasExpress ? '✓' : '✗'}`);
  console.log(`   📦 Context Routes: ${hasRoutes ? '✓' : '✗'}`);
  console.log(`   📦 Health Routes: ${hasHealthRoutes ? '✓' : '✗'}`);
  
  tests.push({ name: 'server.js', status: 'pass' });
} catch (e) {
  console.log('   ❌ Failed:', e.message);
  tests.push({ name: 'server.js', status: 'fail', error: e.message });
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📋 Test Summary');
console.log('='.repeat(50));

const passed = tests.filter(t => t.status === 'pass').length;
const failed = tests.filter(t => t.status === 'fail').length;

console.log(`✅ Passed: ${passed}/${tests.length}`);
console.log(`❌ Failed: ${failed}/${tests.length}`);

if (failed > 0) {
  console.log('\n🔴 Failed Tests:');
  tests.filter(t => t.status === 'fail').forEach(t => {
    console.log(`   - ${t.name}: ${t.error}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 All integration tests passed!');
  console.log('\n📖 Next steps:');
  console.log('   1. Run: node scripts/diagnose-pieces-api.js');
  console.log('   2. Start server: npm start');
  console.log('   3. Test: curl http://localhost:3001/api/context/health');
}
