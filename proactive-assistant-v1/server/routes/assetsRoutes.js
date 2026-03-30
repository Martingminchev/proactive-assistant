const router = require('express').Router();
const piecesCopilotService = require('../services/piecesCopilotService');

router.get('/', async (req, res) => {
  try {
    console.log('📦 GET /assets');
    
    const limit = parseInt(req.query.limit) || 20;
    const assets = await piecesCopilotService.getRecentAssets(limit);
    
    res.json({ 
      assets,
      count: assets.length 
    });
  } catch (error) {
    console.error('✗ Error fetching assets:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch assets',
      details: error.message 
    });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Query parameter is required' 
      });
    }

    console.log(`🔍 GET /assets/search?q=${query}`);
    
    const assets = await piecesCopilotService.searchAssets(query);
    
    res.json({ 
      assets,
      count: assets.length 
    });
  } catch (error) {
    console.error('✗ Error searching assets:', error.message);
    res.status(500).json({ 
      error: 'Failed to search assets',
      details: error.message 
    });
  }
});

router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    
    console.log(`📦 GET /assets/type/${type}?limit=${limit}`);
    
    const assets = await piecesCopilotService.getAssetsByType(type, limit);
    
    res.json({ 
      assets,
      count: assets.length 
    });
  } catch (error) {
    console.error('✗ Error fetching assets by type:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch assets by type',
      details: error.message 
    });
  }
});

module.exports = router;
