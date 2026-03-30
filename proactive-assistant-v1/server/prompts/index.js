/**
 * Enhanced Prompts Module
 * 
 * Export all prompt functionality from a single entry point
 */

const { prompts, SCENARIOS, confidenceCalculators } = require('./enhancedPrompts');

module.exports = {
  prompts,
  SCENARIOS,
  confidenceCalculators
};
