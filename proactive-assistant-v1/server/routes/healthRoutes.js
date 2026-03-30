/**
 * Health Routes
 * 
 * Provides endpoints for monitoring Pieces context integration health:
 * - GET /api/context/health - Current health snapshot
 * - GET /api/context/health/detailed - Full diagnostic data
 */

const express = require('express');
const router = express.Router();
const contextHealthService = require('../services/contextHealthService');

/**
 * GET /api/context/health
 * 
 * Returns current health snapshot of the Pieces context integration.
 * Results are cached for 45 seconds to avoid hammering APIs.
 * 
 * Response structure:
 * {
 *   status: "healthy|degraded|unhealthy",
 *   piecesConnected: true,
 *   lastUpdated: "2026-01-29T...",
 *   apis: { ... },
 *   overallContextQuality: 0.35,
 *   recommendations: ["..."],
 *   summary: { ... }
 * }
 */
router.get('/', async (req, res) => {
  try {
    console.log('💚 GET /api/context/health');
    
    const health = await contextHealthService.getHealthSnapshot();
    
    res.json(health);
  } catch (error) {
    console.error('✗ Error in health endpoint:', error.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve health status',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/context/health/detailed
 * 
 * Returns comprehensive diagnostic information including:
 * - Full health snapshot
 * - Historical trends
 * - Detailed API diagnostics
 * - Configuration info
 * 
 * This endpoint is useful for troubleshooting and deep analysis.
 */
router.get('/detailed', async (req, res) => {
  try {
    console.log('💚 GET /api/context/health/detailed');
    
    const diagnostics = await contextHealthService.getDetailedDiagnostics();
    
    res.json(diagnostics);
  } catch (error) {
    console.error('✗ Error in detailed health endpoint:', error.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve detailed diagnostics',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/context/health/history
 * 
 * Returns historical health data for trend analysis.
 * Limited to last 50 data points.
 */
router.get('/history', async (req, res) => {
  try {
    console.log('💚 GET /api/context/health/history');
    
    const limit = parseInt(req.query.limit) || 50;
    const history = contextHealthService.history.slice(-limit);
    
    res.json({
      history,
      count: history.length,
      summary: contextHealthService.getHistorySummary()
    });
  } catch (error) {
    console.error('✗ Error in health history endpoint:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve health history',
      details: error.message
    });
  }
});

/**
 * POST /api/context/health/refresh
 * 
 * Forces an immediate health check refresh.
 * Bypasses the cache to get fresh data.
 */
router.post('/refresh', async (req, res) => {
  try {
    console.log('💚 POST /api/context/health/refresh');
    
    // Force a fresh health check
    const health = await contextHealthService.performHealthCheck();
    
    res.json({
      success: true,
      message: 'Health check refreshed',
      health
    });
  } catch (error) {
    console.error('✗ Error refreshing health check:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh health check',
      details: error.message
    });
  }
});

/**
 * GET /api/context/health/apis/:apiName
 * 
 * Returns detailed information about a specific API.
 * Available APIs: assets, workstreamSummaries, visionEvents, 
 * activities, workstreamEvents, ocrAnalyses, imageAnalyses, 
 * conversations, anchors, websites
 */
router.get('/apis/:apiName', async (req, res) => {
  try {
    const { apiName } = req.params;
    console.log(`💚 GET /api/context/health/apis/${apiName}`);
    
    const health = await contextHealthService.getHealthSnapshot();
    
    const apiData = health.apis?.[apiName];
    
    if (!apiData) {
      return res.status(404).json({
        error: `API '${apiName}' not found`,
        availableApis: Object.keys(health.apis || {})
      });
    }
    
    res.json({
      api: apiName,
      data: apiData,
      checkedAt: health.lastUpdated
    });
  } catch (error) {
    console.error('✗ Error in API detail endpoint:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve API details',
      details: error.message
    });
  }
});

module.exports = router;
