const mongoose = require('mongoose');

// Sub-schema for feedback items
const feedbackSchema = new mongoose.Schema({
  itemId: {
    type: String,
    required: true
  },
  itemTitle: {
    type: String,
    required: true
  },
  category: {
    type: String
  },
  format: {
    type: String
  },
  liked: {
    type: Boolean,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Sub-schema for goals
const goalSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  active: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
}, { _id: true });

// Sub-schema for chat messages
const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Sub-schema for conversations
const conversationSchema = new mongoose.Schema({
  // What item this conversation relates to (null for general chat)
  itemId: {
    type: String,
    default: null
  },
  itemTitle: {
    type: String,
    default: null
  },
  itemCategory: {
    type: String,
    default: null
  },
  // Conversation title (auto-generated or user-defined)
  title: {
    type: String,
    default: 'New Conversation'
  },
  // Messages in this conversation
  messages: [messageSchema],
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Is this conversation pinned/starred
  pinned: {
    type: Boolean,
    default: false
  }
}, { _id: true });

// Main UserPreference schema
const userPreferenceSchema = new mongoose.Schema({
  // Singleton identifier (always 'default' for single-user app)
  _id: {
    type: String,
    default: 'default'
  },
  
  // Feedback history (like/dislike)
  feedback: [feedbackSchema],
  
  // Inferred preferences (auto-calculated from feedback)
  preferredCategories: {
    type: [String],
    default: []
  },
  dislikedCategories: {
    type: [String],
    default: []
  },
  preferredFormats: {
    type: [String],
    default: []
  },
  dislikedFormats: {
    type: [String],
    default: []
  },
  
  // User-defined goals
  goals: [goalSchema],
  
  // Conversation history
  conversations: [conversationSchema],
  
  // Current active conversation ID (for continuing chats)
  activeConversationId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
userPreferenceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get preferences (creates default if not exists)
userPreferenceSchema.statics.getPreferences = async function() {
  let prefs = await this.findById('default');
  if (!prefs) {
    prefs = await this.create({ _id: 'default' });
  }
  return prefs;
};

// Method to add feedback and recalculate preferences
userPreferenceSchema.methods.addFeedback = async function(feedbackItem) {
  // Add feedback
  this.feedback.push(feedbackItem);
  
  // Recalculate preferences based on recent feedback (last 100 items)
  const recentFeedback = this.feedback.slice(-100);
  
  // Count likes/dislikes per category
  const categoryStats = {};
  const formatStats = {};
  
  recentFeedback.forEach(f => {
    if (f.category) {
      if (!categoryStats[f.category]) {
        categoryStats[f.category] = { likes: 0, dislikes: 0 };
      }
      if (f.liked) {
        categoryStats[f.category].likes++;
      } else {
        categoryStats[f.category].dislikes++;
      }
    }
    
    if (f.format) {
      if (!formatStats[f.format]) {
        formatStats[f.format] = { likes: 0, dislikes: 0 };
      }
      if (f.liked) {
        formatStats[f.format].likes++;
      } else {
        formatStats[f.format].dislikes++;
      }
    }
  });
  
  // Determine preferred/disliked categories
  this.preferredCategories = [];
  this.dislikedCategories = [];
  
  Object.entries(categoryStats).forEach(([category, stats]) => {
    const ratio = stats.likes / (stats.likes + stats.dislikes);
    if (ratio >= 0.7 && stats.likes >= 2) {
      this.preferredCategories.push(category);
    } else if (ratio <= 0.3 && stats.dislikes >= 2) {
      this.dislikedCategories.push(category);
    }
  });
  
  // Determine preferred/disliked formats
  this.preferredFormats = [];
  this.dislikedFormats = [];
  
  Object.entries(formatStats).forEach(([format, stats]) => {
    const ratio = stats.likes / (stats.likes + stats.dislikes);
    if (ratio >= 0.7 && stats.likes >= 2) {
      this.preferredFormats.push(format);
    } else if (ratio <= 0.3 && stats.dislikes >= 2) {
      this.dislikedFormats.push(format);
    }
  });
  
  await this.save();
  return this;
};

// Method to add a goal
userPreferenceSchema.methods.addGoal = async function(goalData) {
  this.goals.push(goalData);
  await this.save();
  return this.goals[this.goals.length - 1];
};

// Method to update a goal
userPreferenceSchema.methods.updateGoal = async function(goalId, updates) {
  const goal = this.goals.id(goalId);
  if (!goal) {
    throw new Error('Goal not found');
  }
  
  Object.assign(goal, updates);
  await this.save();
  return goal;
};

// Method to remove a goal
userPreferenceSchema.methods.removeGoal = async function(goalId) {
  const goal = this.goals.id(goalId);
  if (goal) {
    goal.deleteOne();
    await this.save();
  }
  return this;
};

// Method to get active goals
userPreferenceSchema.methods.getActiveGoals = function() {
  return this.goals.filter(g => g.active && !g.completedAt);
};

// Method to start or get a conversation
userPreferenceSchema.methods.getOrCreateConversation = async function(itemId = null, itemTitle = null, itemCategory = null) {
  // Look for existing conversation for this item
  let conversation;
  
  if (itemId) {
    conversation = this.conversations.find(c => c.itemId === itemId);
  }
  
  // Create new conversation if not found
  if (!conversation) {
    const newConvo = {
      itemId,
      itemTitle,
      itemCategory,
      title: itemTitle || 'General Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.conversations.push(newConvo);
    await this.save();
    conversation = this.conversations[this.conversations.length - 1];
  }
  
  return conversation;
};

// Method to add message to conversation
userPreferenceSchema.methods.addMessage = async function(conversationId, role, content) {
  const conversation = this.conversations.id(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  conversation.messages.push({ role, content, timestamp: new Date() });
  conversation.updatedAt = new Date();
  
  // Auto-generate title from first user message if still default
  if (conversation.title === 'New Conversation' && role === 'user' && conversation.messages.length === 1) {
    // Take first 50 chars of first message as title
    conversation.title = content.length > 50 ? content.substring(0, 47) + '...' : content;
  }
  
  await this.save();
  return conversation;
};

// Method to get recent conversations
userPreferenceSchema.methods.getRecentConversations = function(limit = 10) {
  return this.conversations
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, limit);
};

// Method to get conversation for an item
userPreferenceSchema.methods.getConversationByItemId = function(itemId) {
  return this.conversations.find(c => c.itemId === itemId);
};

// Method to get preference summary for AI context
userPreferenceSchema.methods.getPreferenceSummary = function() {
  const activeGoals = this.getActiveGoals();
  const recentFeedback = this.feedback.slice(-20);
  const recentLikes = recentFeedback.filter(f => f.liked).map(f => f.category).filter(Boolean);
  const recentDislikes = recentFeedback.filter(f => !f.liked).map(f => f.category).filter(Boolean);
  
  // Get recent conversation topics
  const recentConversations = this.getRecentConversations(5);
  const conversationTopics = recentConversations
    .filter(c => c.itemTitle)
    .map(c => c.itemTitle);
  
  return {
    goals: activeGoals.map(g => ({
      title: g.title,
      description: g.description,
      priority: g.priority
    })),
    preferences: {
      likedCategories: [...new Set(recentLikes)],
      dislikedCategories: [...new Set(recentDislikes)],
      preferredCategories: this.preferredCategories,
      dislikedCategories: this.dislikedCategories,
      preferredFormats: this.preferredFormats
    },
    recentConversationTopics: conversationTopics,
    feedbackCount: this.feedback.length
  };
};

module.exports = mongoose.model('UserPreference', userPreferenceSchema);
