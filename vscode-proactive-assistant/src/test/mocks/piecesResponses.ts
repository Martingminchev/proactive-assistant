import { VisionEvent } from '../../types';

export interface HealthResponse {
  status: string;
  version?: string;
  name?: string;
  uptime?: number;
}

export const mockHealthResponses: Record<string, HealthResponse> = {
  healthy: {
    status: 'healthy',
    version: '2.5.1',
    name: 'Pieces OS',
    uptime: 86400000
  },
  degraded: {
    status: 'degraded',
    version: '2.5.1',
    name: 'Pieces OS',
    uptime: 3600000
  },
  starting: {
    status: 'starting',
    version: '2.5.1',
    name: 'Pieces OS'
  }
};

export interface WorkstreamSummary {
  id: string;
  summary: string;
  timestamp: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export const mockWorkstreamSummaries: WorkstreamSummary[] = [
  {
    id: 'ws-001',
    summary: 'User was working on authentication logic in auth.ts',
    timestamp: '2024-01-15T10:30:00Z',
    source: 'VS Code',
    metadata: { file: 'src/auth.ts', language: 'typescript' }
  }
];

export const mockVisionEvents: VisionEvent[] = [
  {
    id: 've-001',
    text: 'function calculateTotal(items: Item[]): number { return items.reduce((sum, item) => sum + item.price, 0); }',
    timestamp: '2024-01-15T10:32:00Z',
    application: 'VS Code',
    transferable: true,
    metadata: { file: 'src/utils.ts', line: 45 }
  },
  {
    id: 've-002',
    text: 'Error: Type \'string\' is not assignable to type \'number\'',
    timestamp: '2024-01-15T10:47:00Z',
    application: 'VS Code',
    transferable: true,
    metadata: { file: 'src/types.ts', line: 12, severity: 'error' }
  }
];

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  name?: string;
  messages: ConversationMessage[];
  updated: string;
  metadata?: Record<string, unknown>;
}

export const mockConversations: Conversation[] = [
  {
    id: 'conv-001',
    name: 'TypeScript Type Help',
    updated: '2024-01-15T10:50:00Z',
    messages: [
      {
        id: 'msg-001',
        role: 'user',
        content: 'How do I define a generic type?',
        timestamp: '2024-01-15T10:30:00Z'
      },
      {
        id: 'msg-002',
        role: 'assistant',
        content: 'You can use the `extends` keyword in your generic constraint.',
        timestamp: '2024-01-15T10:31:00Z'
      }
    ]
  }
];

export interface CopilotResponse {
  answer: string;
  confidence?: number;
  suggestions?: string[];
  codeBlocks?: string[];
}

export const mockCopilotResponses: Record<string, CopilotResponse> = {
  fixError: {
    answer: 'The error occurs when you try to assign a string value to a variable that expects a number.',
    confidence: 0.95,
    suggestions: [
      'Use parseInt() to convert the string to a number',
      'Change the type annotation to string'
    ],
    codeBlocks: [
      'const numValue = parseInt(stringValue, 10);'
    ]
  },
  stuckHelp: {
    answer: 'Here are some steps that might help:',
    confidence: 0.88,
    suggestions: [
      'Check if the JWT secret is correctly configured',
      'Verify the token expiration time'
    ]
  },
  wellness: {
    answer: 'You\'ve been coding for over 2 hours straight. Consider taking a short break!',
    confidence: 0.75,
    suggestions: [
      'Take a 5-minute walk',
      'Look away from the screen'
    ]
  }
};

export interface ApiError {
  error: string;
  message: string;
  code?: number;
  details?: Record<string, unknown>;
}

export const mockApiErrors: Record<string, ApiError> = {
  notFound: {
    error: 'Not Found',
    message: 'The requested resource was not found',
    code: 404
  },
  unauthorized: {
    error: 'Unauthorized',
    message: 'Invalid or missing API key',
    code: 401
  },
  rateLimited: {
    error: 'Rate Limited',
    message: 'Too many requests, please try again later',
    code: 429,
    details: { retryAfter: 60 }
  },
  serverError: {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    code: 500
  }
};
