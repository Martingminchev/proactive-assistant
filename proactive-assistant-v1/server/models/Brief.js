const mongoose = require('mongoose');

const briefSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // New universal fields
  greeting: {
    type: String
  },
  activitySummary: {
    type: String
  },
  
  // NEW: Varied format items (primary content structure)
  items: [{
    format: {
      type: String,
      enum: [
        'quick_tip', 'tool_recommendation', 'article', 'stack_upgrade',
        'learning_path', 'action_item', 'insight', 'challenge'
      ]
    },
    category: {
      type: String,
      enum: [
        'productivity_tips', 'software_tools', 'videos', 'articles',
        'learning_resources', 'books', 'podcasts', 'communities',
        'events', 'wellness', 'project_ideas', 'automations',
        'people_to_follow', 'challenges', 'quick_wins'
      ]
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    summary: {
      type: String
    },
    fullContent: {
      type: String
    },
    url: {
      type: String
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    relevanceScore: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    },
    timeToComplete: {
      type: String
    }
  }],
  
  // Legacy: Dynamic recommendations (kept for backward compatibility)
  recommendations: [{
    category: {
      type: String
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    actionItem: {
      type: String
    },
    url: {
      type: String
    },
    relevanceScore: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    },
    timeToComplete: {
      type: String
    }
  }],
  
  // Daily challenge
  dailyChallenge: {
    title: String,
    description: String,
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard']
    }
  },
  
  // Reflection question
  reflection: {
    question: String,
    context: String
  },
  
  // Quick tip
  quickTip: {
    type: String
  },
  
  // Legacy fields (kept for backward compatibility)
  improvements: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    relevanceScore: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    }
  }],
  news: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    source: {
      type: String,
      default: 'NewsAPI'
    },
    publishedAt: {
      type: Date
    },
    relevanceScore: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    }
  }],
  mvpIdea: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    }
  }],
  
  // Focus Area (new advanced field)
  focusArea: {
    title: String,
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low']
    },
    evidence: String
  },

  // Metadata
  contextSummary: {
    languages: [String],
    tags: [String],
    assetCount: Number,
    activityCount: Number,
    workstreamSummaryCount: Number,
    filesAccessed: Number,
    websitesVisited: Number,
    totalActivities: Number,
    topApplications: [String],
    goalsCount: Number,
    intelligenceStages: Number
  },
  provider: {
    type: String,
    enum: ['zai', 'gemini', 'pieces'],
    default: 'pieces'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  generationTime: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('Brief', briefSchema);
