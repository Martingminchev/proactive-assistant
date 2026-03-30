const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  // Suggestion type
  type: {
    type: String,
    enum: ['tip', 'reminder', 'insight', 'action', 'warning'],
    required: true
  },
  
  // Core content
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Priority (1-10, higher = more important)
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  
  // Category for grouping/filtering
  category: {
    type: String,
    enum: [
      'productivity', 'code_quality', 'learning', 'health', 
      'focus', 'tools', 'collaboration', 'documentation',
      'testing', 'debugging', 'optimization', 'general'
    ],
    default: 'general'
  },
  
  // Action buttons
  actions: [{
    label: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['link', 'copy', 'dismiss', 'snooze', 'execute'],
      required: true
    },
    payload: {
      type: String  // URL, text to copy, or action identifier
    }
  }],
  
  // Context that triggered this suggestion
  triggerContext: {
    application: String,
    visionEventId: String,
    anchorPath: String,
    keywords: [String],
    screenText: String
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['active', 'dismissed', 'snoozed', 'actioned'],
    default: 'active',
    index: true
  },
  
  // Snooze until this time
  snoozedUntil: {
    type: Date
  },
  
  // When the suggestion was created
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Expiration time (suggestions auto-expire)
  expiresAt: {
    type: Date,
    index: true
  },
  
  // AI provider that generated this
  provider: {
    type: String,
    enum: ['zai', 'gemini', 'pieces'],
    default: 'pieces'
  },
  
  // Generation metadata
  generationTime: {
    type: Number,
    default: 0
  }
});

// Index for finding active, non-expired suggestions
suggestionSchema.index({ status: 1, expiresAt: 1, createdAt: -1 });

// Static method to get active suggestions
suggestionSchema.statics.getActive = async function(limit = 10) {
  const now = new Date();
  return this.find({
    status: 'active',
    $or: [
      { expiresAt: { $gt: now } },
      { expiresAt: null }
    ]
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit);
};

// Static method to reactivate snoozed suggestions
suggestionSchema.statics.reactivateSnoozed = async function() {
  const now = new Date();
  return this.updateMany(
    { 
      status: 'snoozed',
      snoozedUntil: { $lte: now }
    },
    { 
      $set: { status: 'active' },
      $unset: { snoozedUntil: 1 }
    }
  );
};

// Static method to clean up expired suggestions
suggestionSchema.statics.cleanupExpired = async function() {
  const now = new Date();
  return this.deleteMany({
    expiresAt: { $lte: now }
  });
};

module.exports = mongoose.model('Suggestion', suggestionSchema);
