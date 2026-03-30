require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Routes
const briefRoutes = require('./routes/briefRoutes');
const assetsRoutes = require('./routes/assetsRoutes');
const suggestionRoutes = require('./routes/suggestionRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const preferencesRoutes = require('./routes/preferencesRoutes');
const chatRoutes = require('./routes/chatRoutes');
const contextRoutes = require('./routes/contextRoutes');
const healthRoutes = require('./routes/healthRoutes');
const userCenteredRoutes = require('./routes/userCenteredRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Jobs
const dailyBriefJob = require('./jobs/dailyBriefJob');
const proactiveAssistantJob = require('./jobs/proactiveAssistantJob');

// Middleware
const { logger } = require('./middleware/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Services
const notificationService = require('./services/notificationService');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(logger);

// Health check endpoint
app.get('/health', (req, res) => {
  const dailyBriefStatus = dailyBriefJob.getStatus();
  const proactiveStatus = proactiveAssistantJob.getStatus();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    piecesConnected: dailyBriefStatus.piecesConnected,
    jobs: {
      dailyBrief: {
        scheduled: dailyBriefStatus.scheduled,
        isRunning: dailyBriefStatus.isRunning
      },
      proactiveAssistant: {
        scheduled: proactiveStatus.scheduled,
        isRunning: proactiveStatus.isRunning,
        lastRun: proactiveStatus.lastRun,
        lastError: proactiveStatus.lastError
      }
    }
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Proactive AI Assistant API',
    version: '3.0.0',
    endpoints: {
      briefs: {
        today: 'GET /api/briefs/today - Get today\'s brief',
        latest: 'GET /api/briefs/latest - Get latest brief',
        history: 'GET /api/briefs/history - Get brief history',
        generate: 'POST /api/briefs/generate - Trigger brief generation',
        stats: 'GET /api/briefs/stats - Get statistics'
      },
      suggestions: {
        active: 'GET /api/suggestions/active - Get active suggestions',
        history: 'GET /api/suggestions/history - Get suggestion history',
        stats: 'GET /api/suggestions/stats - Get suggestion statistics',
        dismiss: 'POST /api/suggestions/:id/dismiss - Dismiss a suggestion',
        snooze: 'POST /api/suggestions/:id/snooze - Snooze a suggestion',
        action: 'POST /api/suggestions/:id/action - Mark suggestion as actioned',
        trigger: 'POST /api/suggestions/trigger - Manually trigger suggestion generation',
        jobStatus: 'GET /api/suggestions/job/status - Get proactive job status'
      },
      settings: {
        get: 'GET /api/settings - Get current settings',
        update: 'PUT /api/settings - Update settings',
        validateKey: 'POST /api/settings/validate-key - Validate API key',
        testPieces: 'POST /api/settings/test-pieces - Test Pieces connection',
        reset: 'POST /api/settings/reset - Reset to defaults',
        options: 'GET /api/settings/schedule-options - Get available options'
      },
      preferences: {
        get: 'GET /api/preferences - Get user preferences',
        summary: 'GET /api/preferences/summary - Get preference summary for AI',
        feedback: 'POST /api/preferences/feedback - Submit feedback',
        goals: 'GET/POST /api/preferences/goals - Manage goals'
      },
      chat: {
        send: 'POST /api/chat - Send chat message',
        contextual: 'POST /api/chat/contextual - Chat about specific item',
        conversations: 'GET /api/chat/conversations - Get conversations',
        quick: 'POST /api/chat/quick - Quick question without saving'
      },
      assets: {
        all: 'GET /api/assets - Get recent assets',
        search: 'GET /api/assets/search?q=query - Search assets',
        byType: 'GET /api/assets/type/:type - Get assets by type'
      },
      context: {
        realtime: 'GET /api/context/realtime?detailLevel=2 - Current user context (app, file, task)',
        patterns: 'GET /api/context/patterns?period=7d - Work patterns and coding habits',
        focusHistory: 'GET /api/context/focus-history?period=24h - Focus sessions timeline',
        blockers: 'GET /api/context/blockers?sensitivity=5 - Detected blockers and issues',
        search: 'GET /api/context/search?q=query - Unified search across all Pieces data'
      },
      contextHealth: {
        summary: 'GET /api/context/health - Context API health snapshot',
        detailed: 'GET /api/context/health/detailed - Full diagnostics with history',
        history: 'GET /api/context/health/history - Historical trend data',
        refresh: 'POST /api/context/health/refresh - Force refresh'
      },
      assistant: {
        assistance: 'GET /api/assistant/assistance - Get personalized assistance',
        activity: 'POST /api/assistant/activity - Record user activity',
        stuckCheck: 'GET /api/assistant/stuck-check - Check if stuck',
        contextRecovery: 'GET /api/assistant/context-recovery - Get context after absence',
        patterns: 'GET /api/assistant/patterns - Detect work patterns',
        wellness: 'GET /api/assistant/wellness - Check wellness status',
        stats: 'GET /api/assistant/stats - Get suggestion statistics',
        preferences: 'POST /api/assistant/preferences - Update preferences',
        sessionReport: 'GET /api/assistant/session-report - Get session report'
      },
      notifications: {
        send: 'POST /api/notifications/send - Send custom notification',
        stuck: 'POST /api/notifications/stuck - Send stuck notification',
        contextRecovery: 'POST /api/notifications/context-recovery - Send context recovery',
        wellness: 'POST /api/notifications/wellness - Send wellness notification',
        celebration: 'POST /api/notifications/celebration - Send celebration',
        suggestion: 'POST /api/notifications/suggestion - Send suggestion',
        focusComplete: 'POST /api/notifications/focus-complete - Send focus complete',
        action: 'POST /api/notifications/:id/action - Handle notification action',
        history: 'GET /api/notifications/history - Get notification history',
        stats: 'GET /api/notifications/stats - Get notification stats',
        settings: 'GET/PUT /api/notifications/settings - Manage settings',
        dndStatus: 'GET /api/notifications/dnd-status - Check Do Not Disturb',
        templates: 'GET /api/notifications/templates - Get available templates'
      },
      health: 'GET /health - API health check'
    }
  });
});

// API routes
app.use('/api/briefs', briefRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/context', contextRoutes);
app.use('/api/context/health', healthRoutes);
app.use('/api/assistant', userCenteredRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    const server = app.listen(PORT, () => {
      console.log('\n========================================');
      console.log('🚀 Proactive AI Assistant Server');
      console.log('   User-Centered Mode Enabled');
      console.log('========================================');
      console.log(`🌐 Server running on http://localhost:${PORT}`);
      console.log(`📋 API Documentation: http://localhost:${PORT}/api`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
      console.log('========================================\n');

      // Start scheduled jobs
      dailyBriefJob.start();
      proactiveAssistantJob.start();
    });

    // Setup WebSocket for notifications
    server.on('upgrade', (request, socket, head) => {
      const { pathname } = new URL(request.url, `http://${request.headers.host}`);
      
      if (pathname === '/notifications') {
        // Create a simple WebSocket-like handler using the notification service
        const ws = {
          readyState: 1, // OPEN
          send: (data) => {
            if (socket.writable) {
              socket.write(`data: ${data}\n\n`);
            }
          },
          close: () => socket.end()
        };
        
        notificationService.addWebSocketClient(ws);
        
        socket.write('HTTP/1.1 101 Switching Protocols\r\n');
        socket.write('Upgrade: websocket\r\n');
        socket.write('Connection: Upgrade\r\n');
        socket.write('\r\n');
        
        socket.on('close', () => {
          ws.readyState = 3; // CLOSED
        });
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
