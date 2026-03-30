/**
 * Simple validation middleware
 */

const validate = (schema) => (req, res, next) => {
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = req.body[field];
    
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    if (value !== undefined && value !== null) {
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      }
      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push(`${field} must be a number`);
      }
      if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push(`${field} must be an array`);
      }
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      messages: errors,
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

// Common schemas
const schemas = {
  goal: {
    title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 1000 },
    priority: { type: 'number' }
  },
  
  chat: {
    message: { required: true, type: 'string', minLength: 1, maxLength: 5000 },
    conversationId: { type: 'string' }
  },
  
  feedback: {
    itemId: { required: true, type: 'string' },
    itemTitle: { required: true, type: 'string' },
    category: { type: 'string' },
    format: { type: 'string' },
    liked: { required: true, type: 'boolean' }
  },
  
  settings: {
    aiProvider: { type: 'string' },
    geminiApiKey: { type: 'string' },
    zaiApiKey: { type: 'string' }
  }
};

module.exports = {
  validate,
  schemas
};
