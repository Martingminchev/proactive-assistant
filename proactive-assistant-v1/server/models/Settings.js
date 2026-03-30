const mongoose = require('mongoose');
const crypto = require('crypto');

// Simple encryption for API keys at rest
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'proactive-assistant-default-key-32';
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
    console.error('Encryption error:', e.message);
    return text;
  }
}

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.error('Decryption error:', e.message);
    return text;
  }
}

const settingsSchema = new mongoose.Schema({
  // Singleton identifier (always 'default')
  _id: {
    type: String,
    default: 'default'
  },
  
  // AI Provider Configuration
  aiProvider: {
    type: String,
    enum: ['zai', 'gemini', 'pieces'],
    default: 'gemini'
  },
  
  // z.ai Configuration
  zaiApiKey: {
    type: String,
    default: '',
    set: encrypt,
    get: decrypt
  },
  zaiModel: {
    type: String,
    default: 'glm-4.7'
  },
  
  // Google Gemini Configuration
  geminiApiKey: {
    type: String,
    default: '',
    set: encrypt,
    get: decrypt
  },
  geminiModel: {
    type: String,
    default: 'gemini-2.5-flash'
  },
  
  // News API Configuration
  newsApiKey: {
    type: String,
    default: '',
    set: encrypt,
    get: decrypt
  },
  
  // Pieces OS Configuration
  piecesPort: {
    type: Number,
    default: 39300
  },
  usePiecesSummary: {
    type: Boolean,
    default: false
  },
  
  // Generation Settings
  briefSchedule: {
    type: String,
    default: '0 8 * * *'  // cron format: 8 AM daily
  },
  autoGenerate: {
    type: Boolean,
    default: true
  },
  historyDepth: {
    type: String,
    enum: ['1day', '3days', '7days', '14days', '30days'],
    default: '7days'
  },
  
  // Content Preferences
  maxRecommendations: {
    type: Number,
    default: 7,
    min: 3,
    max: 15
  },
  enabledCategories: {
    type: [String],
    default: [
      'productivity_tips', 'software_tools', 'videos', 'articles',
      'learning_resources', 'books', 'podcasts', 'communities',
      'events', 'wellness', 'project_ideas', 'automations',
      'people_to_follow', 'challenges', 'quick_wins'
    ]
  },
  
  // Proactive Assistant Settings
  proactiveInterval: {
    type: Number,
    default: 5,  // minutes between checks
    min: 1,
    max: 60
  },
  proactiveEnabled: {
    type: Boolean,
    default: true
  },
  
  // Focus Mode - suppress all interruptions when enabled
  focusMode: {
    type: Boolean,
    default: false
  },
  
  // UI Preferences
  theme: {
    type: String,
    enum: ['light', 'dark', 'system'],
    default: 'system'
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
}, {
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Update timestamp on save
settingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get settings (creates default if not exists)
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findById('default');
  if (!settings) {
    settings = await this.create({ _id: 'default' });
  }
  return settings;
};

// Static method to update settings
settingsSchema.statics.updateSettings = async function(updates) {
  const settings = await this.findByIdAndUpdate(
    'default',
    { $set: updates },
    { new: true, upsert: true, runValidators: true }
  );
  return settings;
};

// Method to get safe settings (without decrypted keys, just masked)
settingsSchema.methods.toSafeJSON = function() {
  const obj = this.toObject();
  
  // Mask API keys for display
  const maskKey = (key) => {
    if (!key || key.length < 8) return key ? '••••••••' : '';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };
  
  return {
    ...obj,
    zaiApiKey: maskKey(obj.zaiApiKey),
    geminiApiKey: maskKey(obj.geminiApiKey),
    newsApiKey: maskKey(obj.newsApiKey),
    hasZaiKey: !!obj.zaiApiKey && obj.zaiApiKey.length > 0,
    hasGeminiKey: !!obj.geminiApiKey && obj.geminiApiKey.length > 0,
    hasNewsKey: !!obj.newsApiKey && obj.newsApiKey.length > 0
  };
};

// Convert history depth to days
settingsSchema.methods.getHistoryDays = function() {
  const map = {
    '1day': 1,
    '3days': 3,
    '7days': 7,
    '14days': 14,
    '30days': 30
  };
  return map[this.historyDepth] || 7;
};

module.exports = mongoose.model('Settings', settingsSchema);
