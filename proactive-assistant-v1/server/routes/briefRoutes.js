const router = require('express').Router();
const Brief = require('../models/Brief');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const dailyBriefJob = require('../jobs/dailyBriefJob');

// GET /api/briefs/today - Get today's brief
router.get('/today', asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const brief = await Brief.findOne({
    date: { $gte: today }
  }).sort({ date: -1 });

  if (!brief) {
    return res.json({ 
      message: 'No brief generated yet for today',
      date: new Date()
    });
  }

  res.json(brief);
}));

// GET /api/briefs/latest - Get most recent brief
router.get('/latest', asyncHandler(async (req, res) => {
  const brief = await Brief.findOne().sort({ date: -1 });

  if (!brief) {
    return res.json({ message: 'No briefs found yet' });
  }

  res.json(brief);
}));

// GET /api/briefs/history - Get brief history
router.get('/history', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 7, 50); // Max 50
  const skip = parseInt(req.query.skip) || 0;
  
  const [briefs, count] = await Promise.all([
    Brief.find()
      .sort({ date: -1 })
      .limit(limit)
      .skip(skip)
      .select('-__v'), // Exclude version key
    Brief.countDocuments()
  ]);
  
  res.json({ 
    briefs,
    total: count,
    limit,
    skip
  });
}));

// GET /api/briefs/stats - Get brief statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await Brief.aggregate([
    {
      $group: {
        _id: null,
        totalBriefs: { $sum: 1 },
        avgGenerationTime: { $avg: '$generationTime' },
        totalImprovements: { $sum: { $size: '$improvements' } },
        totalNews: { $sum: { $size: '$news' } },
        totalMvpIdeas: { $sum: { $size: '$mvpIdea' } }
      }
    }
  ]);

  const latestBrief = await Brief.findOne().sort({ date: -1 });
  
  res.json({
    ...stats[0],
    latestBriefDate: latestBrief ? latestBrief.date : null,
    totalBriefs: stats[0]?.totalBriefs || 0
  });
}));

// GET /api/briefs/:id - Get specific brief
router.get('/:id', asyncHandler(async (req, res) => {
  const brief = await Brief.findById(req.params.id);

  if (!brief) {
    throw new AppError('Brief not found', 404, 'NOT_FOUND');
  }

  res.json(brief);
}));

// POST /api/briefs/generate - Trigger brief generation
router.post('/generate', asyncHandler(async (req, res) => {
  if (dailyBriefJob.isRunning) {
    return res.status(409).json({ 
      message: 'Brief generation already in progress',
      status: 'running'
    });
  }

  // Start generation in background
  dailyBriefJob.runNow().catch(err => {
    console.error('Error in manual brief generation:', err);
  });

  res.json({ 
    message: 'Brief generation triggered successfully',
    status: 'started'
  });
}));

// DELETE /api/briefs/:id - Delete brief
router.delete('/:id', asyncHandler(async (req, res) => {
  const brief = await Brief.findByIdAndDelete(req.params.id);

  if (!brief) {
    throw new AppError('Brief not found', 404, 'NOT_FOUND');
  }

  res.json({ message: 'Brief deleted successfully' });
}));

module.exports = router;
