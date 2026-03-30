/**
 * Unified API Client
 * Centralizes all API calls with consistent error handling
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function handleResponse(response) {
  const data = await response.json().catch(() => null);
  
  if (!response.ok) {
    throw new ApiError(
      data?.error || `Request failed with status ${response.status}`,
      response.status,
      data
    );
  }
  
  return data;
}

export const api = {
  // Briefs
  briefs: {
    getToday: () => fetch(`${API_BASE}/briefs/today`).then(handleResponse),
    getLatest: () => fetch(`${API_BASE}/briefs/latest`).then(handleResponse),
    getHistory: (limit = 10) => 
      fetch(`${API_BASE}/briefs/history?limit=${limit}`).then(handleResponse),
    getStats: () => fetch(`${API_BASE}/briefs/stats`).then(handleResponse),
    generate: () => 
      fetch(`${API_BASE}/briefs/generate`, { method: 'POST' }).then(handleResponse),
  },

  // Goals
  goals: {
    getAll: () => fetch(`${API_BASE}/preferences/goals`).then(handleResponse),
    getActive: () => fetch(`${API_BASE}/preferences/goals?active=true`).then(handleResponse),
    create: (goal) => 
      fetch(`${API_BASE}/preferences/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goal),
      }).then(handleResponse),
    delete: (id) => 
      fetch(`${API_BASE}/preferences/goals/${id}`, { method: 'DELETE' }).then(handleResponse),
  },

  // Settings
  settings: {
    get: () => fetch(`${API_BASE}/settings`).then(handleResponse),
    update: (settings) => 
      fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      }).then(handleResponse),
    testPieces: () => 
      fetch(`${API_BASE}/settings/test-pieces`, { method: 'POST' }).then(handleResponse),
  },

  // Chat
  chat: {
    send: (message, conversationId) => 
      fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId }),
      }).then(handleResponse),
    sendContextual: (message, context) => 
      fetch(`${API_BASE}/chat/contextual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, ...context }),
      }).then(handleResponse),
    getConversations: () => fetch(`${API_BASE}/chat/conversations`).then(handleResponse),
  },

  // Feedback
  feedback: {
    submit: (itemId, itemTitle, category, format, liked) => 
      fetch(`${API_BASE}/preferences/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, itemTitle, category, format, liked }),
      }).then(handleResponse),
  },

  // Health check
  health: {
    check: () => fetch('http://localhost:3001/health').then(handleResponse),
  },

  // New endpoints for enhanced components
  
  // Current Focus - real-time activity data
  focus: {
    getCurrent: () => fetch(`${API_BASE}/focus/current`).then(handleResponse),
    getRecentFiles: (limit = 5) => 
      fetch(`${API_BASE}/focus/recent-files?limit=${limit}`).then(handleResponse),
    getRecentWebsites: (limit = 5) => 
      fetch(`${API_BASE}/focus/recent-websites?limit=${limit}`).then(handleResponse),
  },

  // Action Center - immediate actions
  actions: {
    getPending: () => fetch(`${API_BASE}/actions/pending`).then(handleResponse),
    complete: (id) => 
      fetch(`${API_BASE}/actions/${id}/complete`, { method: 'POST' }).then(handleResponse),
    dismiss: (id) => 
      fetch(`${API_BASE}/actions/${id}/dismiss`, { method: 'POST' }).then(handleResponse),
    snooze: (id, duration) => 
      fetch(`${API_BASE}/actions/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
      }).then(handleResponse),
  },

  // Insights - patterns and analytics
  insights: {
    getPatterns: () => fetch(`${API_BASE}/insights/patterns`).then(handleResponse),
    getWeeklyTrends: () => fetch(`${API_BASE}/insights/weekly`).then(handleResponse),
    getProductivityPeaks: () => fetch(`${API_BASE}/insights/peaks`).then(handleResponse),
    getRecommendations: () => fetch(`${API_BASE}/insights/recommendations`).then(handleResponse),
  },

  // Data Quality - Pieces integration status
  dataQuality: {
    getStatus: () => fetch(`${API_BASE}/data-quality/status`).then(handleResponse),
    getSources: () => fetch(`${API_BASE}/data-quality/sources`).then(handleResponse),
    fixIssue: (issueId) => 
      fetch(`${API_BASE}/data-quality/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId }),
      }).then(handleResponse),
  },

  // Smart Brief - enhanced brief items
  briefItems: {
    getPending: () => fetch(`${API_BASE}/brief-items/pending`).then(handleResponse),
    complete: (id) => 
      fetch(`${API_BASE}/brief-items/${id}/complete`, { method: 'POST' }).then(handleResponse),
    dismiss: (id) => 
      fetch(`${API_BASE}/brief-items/${id}/dismiss`, { method: 'POST' }).then(handleResponse),
  },
};

export { ApiError };
