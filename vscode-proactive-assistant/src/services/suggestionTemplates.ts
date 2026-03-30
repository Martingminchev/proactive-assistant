import { 
  ActivityContext, 
  Suggestion, 
  DiagnosticInfo,
  SuggestionType
} from '../types';

export type SuggestionTemplate = (context: ActivityContext, data?: unknown) => Suggestion | null | undefined;

export const SUGGESTION_TEMPLATES: Record<SuggestionType, SuggestionTemplate[]> = {
  stuck: [
    (_ctx, data) => {
      const error = (data as DiagnosticInfo[])?.[0];
      return {
        id: `stuck-${Date.now()}`,
        title: error ? `Stuck on "${error.message.slice(0, 40)}..."?` : 'Stuck? Here\'s a fix...',
        description: error 
          ? `I noticed you've been working on this error for a while. Would you like me to help fix it?`
          : 'You seem to be struggling with this section. Let me help you find a solution.',
        priority: 'high',
        actions: [
          {
            id: 'fix',
            label: 'Get Fix',
            type: 'apply',
            isPrimary: true,
            icon: '$(lightbulb)'
          },
          {
            id: 'explain',
            label: 'Explain',
            type: 'show',
            icon: '$(info)'
          },
          {
            id: 'dismiss',
            label: 'Dismiss',
            type: 'dismiss'
          }
        ],
        timestamp: new Date(),
        confidence: 0.8,
        category: 'stuck'
      };
    },
    (ctx) => ({
      id: `stuck-search-${Date.now()}`,
      title: '🔍 Search for solutions?',
      description: `I can search for solutions related to ${ctx.language || 'your current code'}. Would you like me to look up relevant documentation or examples?`,
      priority: 'medium',
      actions: [
        { id: 'search', label: 'Search', type: 'run', isPrimary: true, icon: '$(search)' },
        { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
      ],
      timestamp: new Date(),
      confidence: 0.7,
      category: 'stuck'
    })
  ],

  context_recovery: [
    (ctx) => ({
      id: `recovery-${Date.now()}`,
      title: 'Continue where you left off?',
      description: `You were working on ${ctx.previousFile ? ctx.previousFile.split(/[\\/]/).pop() : 'another file'} earlier. Want to jump back?`,
      priority: 'low',
      actions: [
        { 
          id: 'open', 
          label: 'Open File', 
          type: 'open', 
          payload: ctx.previousFile,
          isPrimary: true,
          icon: '$(file-code)'
        },
        { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
      ],
      timestamp: new Date(),
      confidence: 0.6,
      category: 'context_recovery'
    }),
    (_ctx) => ({
      id: `recovery-clipboard-${Date.now()}`,
      title: '📋 Use clipboard content?',
      description: 'I noticed you copied some code earlier. Would you like me to help integrate it here?',
      priority: 'low',
      actions: [
        { id: 'paste', label: 'Paste & Format', type: 'apply', isPrimary: true, icon: '$(clippy)' },
        { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
      ],
      timestamp: new Date(),
      confidence: 0.5,
      category: 'context_recovery'
    })
  ],

  wellness: [
    (ctx, data) => {
      const duration = data as number || ctx.duration || 0;
      const hours = Math.floor(duration / (60 * 60 * 1000));
      
      return {
        id: `wellness-${Date.now()}`,
        title: hours > 2 ? '☕ Time for a break?' : '🧘 Take a breath',
        description: hours > 2 
          ? `You've been coding for ${hours} hours. Consider taking a short break to recharge!`
          : 'You\'ve been working steadily. A quick stretch might help you stay focused.',
        priority: 'low',
        actions: [
          { id: 'remind', label: 'Remind in 15min', type: 'run', isPrimary: true, icon: '$(clock)' },
          { id: 'snooze', label: 'Snooze', type: 'dismiss', icon: '$(bell-slash)' },
          { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
        ],
        timestamp: new Date(),
        confidence: 0.6,
        category: 'wellness'
      };
    },
    (_ctx) => ({
      id: `wellness-eyes-${Date.now()}`,
      title: '👀 20-20-20 rule',
      description: 'Every 20 minutes, look at something 20 feet away for 20 seconds. Your eyes will thank you!',
      priority: 'low',
      actions: [
        { id: 'ok', label: 'Got it!', type: 'dismiss', isPrimary: true },
        { id: 'disable', label: 'Disable reminders', type: 'run' }
      ],
      timestamp: new Date(),
      confidence: 0.5,
      category: 'wellness'
    })
  ],

  celebration: [
    (_ctx, data) => {
      const streak = data as number || 3;
      return {
        id: `celebration-${Date.now()}`,
        title: `🔥 ${streak}-day streak!`,
        description: `You've been coding consistently for ${streak} days. Keep up the great work!`,
        priority: 'medium',
        actions: [
          { id: 'share', label: 'Share', type: 'run', isPrimary: true, icon: '$(share)' },
          { id: 'dismiss', label: 'Thanks!', type: 'dismiss' }
        ],
        timestamp: new Date(),
        confidence: 0.9,
        category: 'celebration'
      };
    },
    (_ctx) => ({
      id: `celebration-fix-${Date.now()}`,
      title: '🎉 Error resolved!',
      description: 'Great job fixing that error! Your persistence paid off.',
      priority: 'low',
      actions: [
        { id: 'thanks', label: 'Thanks!', type: 'dismiss', isPrimary: true },
        { id: 'learn', label: 'What did I learn?', type: 'show' }
      ],
      timestamp: new Date(),
      confidence: 0.8,
      category: 'celebration'
    }),
    (ctx) => ({
      id: `celebration-milestone-${Date.now()}`,
      title: '🏆 Milestone reached!',
      description: `You've worked on ${ctx.file ? '10 different files today' : 'a lot of code today'}. Impressive productivity!`,
      priority: 'low',
      actions: [
        { id: 'cool', label: 'Cool!', type: 'dismiss', isPrimary: true }
      ],
      timestamp: new Date(),
      confidence: 0.7,
      category: 'celebration'
    })
  ],

  error_fix: [
    (ctx, data) => {
      const error = (data as DiagnosticInfo) || ctx.errors?.[0];
      if (!error) return null;

      return {
        id: `error-${Date.now()}`,
        title: `⚠️ Fix: ${error.message.slice(0, 40)}${error.message.length > 40 ? '...' : ''}`,
        description: `I found an error on line ${error.line}. I can suggest a fix for you.`,
        priority: 'urgent',
        actions: [
          { 
            id: 'apply', 
            label: 'Apply Fix', 
            type: 'apply', 
            isPrimary: true,
            icon: '$(wrench)',
            payload: JSON.stringify(error)
          },
          { id: 'explain', label: 'Explain', type: 'show', icon: '$(info)' },
          { id: 'ignore', label: 'Ignore', type: 'dismiss' }
        ],
        timestamp: new Date(),
        confidence: 0.85,
        category: 'error_fix'
      };
    }
  ],

  productivity: [
    (_ctx) => ({
      id: `productivity-snippet-${Date.now()}`,
      title: '💡 Reuse this pattern?',
      description: 'I noticed you\'ve written similar code before. Want to create a snippet?',
      priority: 'medium',
      actions: [
        { id: 'create', label: 'Create Snippet', type: 'run', isPrimary: true, icon: '$(symbol-snippet)' },
        { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
      ],
      timestamp: new Date(),
      confidence: 0.6,
      category: 'productivity'
    }),
    (_ctx) => ({
      id: `productivity-refactor-${Date.now()}`,
      title: '🔄 Refactor suggestion',
      description: 'This code block could be simplified. Would you like me to suggest a refactoring?',
      priority: 'medium',
      actions: [
        { id: 'show', label: 'Show Me', type: 'show', isPrimary: true, icon: '$(lightbulb)' },
        { id: 'later', label: 'Maybe Later', type: 'dismiss' }
      ],
      timestamp: new Date(),
      confidence: 0.65,
      category: 'productivity'
    })
  ],

  learning: [
    (ctx) => ({
      id: `learning-tip-${Date.now()}`,
      title: '💡 Did you know?',
      description: `Here's a ${ctx.language || 'coding'} tip that might help you: Use keyboard shortcuts to boost productivity!`,
      priority: 'low',
      actions: [
        { id: 'learn', label: 'Learn More', type: 'open', isPrimary: true, icon: '$(book)' },
        { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
      ],
      timestamp: new Date(),
      confidence: 0.5,
      category: 'learning'
    })
  ]
};
