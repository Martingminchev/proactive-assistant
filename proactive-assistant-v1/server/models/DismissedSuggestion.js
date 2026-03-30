const mongoose = require('mongoose');

/**
 * DismissedSuggestion Model
 * Tracks user dismissals to implement the "3-strike rule"
 * - 3 dismissals of similar suggestions = blacklisted for the day
 */
const dismissedSuggestionSchema = new mongoose.Schema({
  // Hash identifying similar suggestions (e.g., category + type hash)
  suggestionHash: {
    type: String,
    required: true,
    index: true
  },
  
  // Original suggestion reference (if available)
  suggestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Suggestion',
    default: null
  },
  
  // User identifier (for future multi-user support)
  userId: {
    type: String,
    default: 'default',
    index: true
  },
  
  // Suggestion metadata for pattern analysis
  category: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  
  // Dismissal tracking
  dismissalCount: {
    type: Number,
    default: 1,
    min: 1
  },
  
  // When this dismissal record expires (typically end of day)
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  // Last dismissal timestamp
  dismissedAt: {
    type: Date,
    default: Date.now
  },
  
  // First dismissal timestamp
  firstDismissedAt: {
    type: Date,
    default: Date.now
  },
  
  // Context at time of dismissal (for learning)
  context: {
    flowState: String,
    interruptionLevel: Number,
    timeOfDay: String, // 'morning', 'afternoon', 'evening', 'night'
    dayOfWeek: Number // 0-6
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
dismissedSuggestionSchema.index({ suggestionHash: 1, userId: 1 });
dismissedSuggestionSchema.index({ userId: 1, expiresAt: 1 });

/**
 * Generate a hash for a suggestion based on its characteristics
 * Used to group "similar" suggestions together
 */
dismissedSuggestionSchema.statics.generateHash = function(suggestion) {
  const crypto = require('crypto');
  
  // Create a string combining category, type, and keywords
  const hashInput = [
    suggestion.category || 'general',
    suggestion.type || 'tip',
    ...(suggestion.keywords || [])
  ].join('|').toLowerCase();
  
  // Create a short hash (first 16 chars of md5)
  return crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 16);
};

/**
 * Record a dismissal of a suggestion
 * Implements the 3-strike rule logic
 */
dismissedSuggestionSchema.statics.recordDismissal = async function(suggestion, userContext = {}) {
  const hash = this.generateHash(suggestion);
  const userId = userContext.userId || 'default';
  
  // Calculate expiration (end of current day)
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setHours(23, 59, 59, 999);
  
  // Determine time of day
  const hour = now.getHours();
  let timeOfDay = 'night';
  if (hour >= 6 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
  
  const context = {
    flowState: userContext.flowState || 'unknown',
    interruptionLevel: userContext.interruptionLevel || 1,
    timeOfDay,
    dayOfWeek: now.getDay()
  };
  
  // Try to find existing record
  let dismissed = await this.findOne({
    suggestionHash: hash,
    userId,
    expiresAt: { $gt: now }
  });
  
  if (dismissed) {
    // Increment count
    dismissed.dismissalCount += 1;
    dismissed.dismissedAt = now;
    dismissed.context = context;
    await dismissed.save();
  } else {
    // Create new record
    dismissed = await this.create({
      suggestionHash: hash,
      suggestionId: suggestion._id,
      userId,
      category: suggestion.category,
      type: suggestion.type,
      title: suggestion.title,
      dismissalCount: 1,
      expiresAt,
      dismissedAt: now,
      firstDismissedAt: now,
      context
    });
  }
  
  return dismissed;
};

/**
 * Check if a suggestion should be blocked due to too many dismissals
 * Returns true if suggestion should be blocked (3+ dismissals)
 */
dismissedSuggestionSchema.statics.isBlacklisted = async function(suggestion, userId = 'default') {
  const hash = this.generateHash(suggestion);
  const now = new Date();
  
  const dismissed = await this.findOne({
    suggestionHash: hash,
    userId,
    expiresAt: { $gt: now }
  });
  
  // Block if 3 or more dismissals
  return dismissed && dismissed.dismissalCount >= 3;
};

/**
 * Get dismissal count for a suggestion type
 */
dismissedSuggestionSchema.statics.getDismissalCount = async function(suggestion, userId = 'default') {
  const hash = this.generateHash(suggestion);
  const now = new Date();
  
  const dismissed = await this.findOne({
    suggestionHash: hash,
    userId,
    expiresAt: { $gt: now }
  });
  
  return dismissed ? dismissed.dismissalCount : 0;
};

/**
 * Get all blacklisted suggestion hashes for a user
 */
dismissedSuggestionSchema.statics.getBlacklistedHashes = async function(userId = 'default') {
  const now = new Date();
  
  const blacklisted = await this.find({
    userId,
    dismissalCount: { $gte: 3 },
    expiresAt: { $gt: now }
  }).select('suggestionHash');
  
  return blacklisted.map(d => d.suggestionHash);
};

/**
 * Clean up expired dismissal records
 */
dismissedSuggestionSchema.statics.cleanupExpired = async function() {
  const now = new Date();
  const result = await this.deleteMany({
    expiresAt: { $lte: now }
  });
  
  return result.deletedCount;
};

/**
 * Get dismissal statistics for analysis
 */
dismissedSuggestionSchema.statics.getStatistics = async function(userId = 'default', days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$category',
        totalDismissals: { $sum: '$dismissalCount' },
        uniqueSuggestions: { $sum: 1 },
        avgDismissals: { $avg: '$dismissalCount' }
      }
    },
    {
      $sort: { totalDismissals: -1 }
    }
  ]);
  
  return stats;
};

module.exports = mongoose.model('DismissedSuggestion', dismissedSuggestionSchema);
