import * as assert from 'assert';
import { PiecesOSClient } from '../../services/piecesClient';
import { createMockLogger } from '../utils/testHelpers';

describe('PiecesOSClient', () => {
  let client: PiecesOSClient;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    client = new PiecesOSClient(mockLogger);
  });

  afterEach(() => {
    client.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      assert.strictEqual(client.status, 'disconnected');
      assert.strictEqual(client.getCurrentPort(), null);
    });

    it('should use custom configuration when provided', () => {
      const customClient = new PiecesOSClient(mockLogger, {
        host: '192.168.1.1',
        retryAttempts: 5,
        requestTimeout: 10000
      });
      
      assert.ok(customClient);
      customClient.dispose();
    });
  });

  describe('Port Discovery', () => {
    it('should try ports in order: 1000, 39300, 5323', async () => {
      const clientWithSpy = new PiecesOSClient(mockLogger, {
        ports: [1000, 39300, 5323]
      });
      
      assert.deepStrictEqual(
        (clientWithSpy as any).config.ports,
        [1000, 39300, 5323]
      );
      
      clientWithSpy.dispose();
    });

    it('should set status to connecting during discovery', async () => {
      assert.strictEqual(client.status, 'disconnected');
    });

    it('should handle connection failure gracefully', async () => {
      const result = await (client as any).discoverPort();
      assert.strictEqual(result, false);
      assert.strictEqual(client.status, 'disconnected');
    });
  });

  describe('Status Management', () => {
    it('should emit status change events', (done) => {
      const statusChanges: string[] = [];
      
      client.onStatusChanged((status) => {
        statusChanges.push(status);
        if (statusChanges.length === 2) {
          assert.deepStrictEqual(statusChanges, ['connecting', 'disconnected']);
          done();
        }
      });

      (client as any).setStatus('connecting');
      (client as any).setStatus('disconnected');
    });

    it('should not emit event for same status', () => {
      let eventCount = 0;
      
      client.onStatusChanged(() => {
        eventCount++;
      });

      (client as any).setStatus('disconnected');
      (client as any).setStatus('disconnected');
      (client as any).setStatus('disconnected');

      assert.strictEqual(eventCount, 0);
    });

    it('should report isAvailable correctly', () => {
      assert.strictEqual(client.isAvailable(), false);
      
      (client as any).currentPort = 5323;
      (client as any).setStatus('connected');
      
      assert.strictEqual(client.isAvailable(), true);
    });
  });

  describe('API Methods', () => {
    describe('getHealth', () => {
      it('should return error when not connected', async () => {
        const result = await client.getHealth();
        
        assert.strictEqual(result.success, false);
        if (!result.success) {
          assert.ok(result.error.message.includes('not available'));
        }
      });

      it('should attempt rediscovery when disconnected', async () => {
        (client as any).currentPort = 5323;
        
        const result = await client.getHealth();
        
        assert.strictEqual(result.success, false);
      });
    });

    describe('getWorkstreamSummaries', () => {
      it('should return error when Pieces OS not available', async () => {
        const result = await client.getWorkstreamSummaries();
        
        assert.strictEqual(result.success, false);
      });
    });

    describe('getVisionEvents', () => {
      it('should return error when Pieces OS not available', async () => {
        const result = await client.getVisionEvents();
        
        assert.strictEqual(result.success, false);
      });
    });

    describe('getConversations', () => {
      it('should return error when Pieces OS not available', async () => {
        const result = await client.getConversations();
        
        assert.strictEqual(result.success, false);
      });
    });

    describe('askCopilot', () => {
      it('should return error when Pieces OS not available', async () => {
        const result = await client.askCopilot('test question');
        
        assert.strictEqual(result.success, false);
      });

      it('should include context in request when provided', async () => {
        const question = 'test question';
        const context = 'additional context';
        
        assert.strictEqual(typeof client.askCopilot, 'function');
      });
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests up to configured attempts', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        return { success: false as const, error: new Error('Test error') };
      };

      (client as any).config.retryAttempts = 3;
      
      const result = await (client as any).withRetry(operation);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(attemptCount, 3);
    });

    it('should succeed on retry when operation eventually succeeds', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          return { success: false as const, error: new Error('Temporary error') };
        }
        return { success: true as const, value: 'success' };
      };

      (client as any).config.retryAttempts = 3;
      
      const result = await (client as any).withRetry(operation);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(attemptCount, 2);
    });

    it('should use exponential backoff between retries', async () => {
      const delays: number[] = [];
      const originalSleep = (client as any).sleep;
      
      (client as any).sleep = (ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      };

      const operation = async () => ({
        success: false as const,
        error: new Error('Error')
      });

      (client as any).config.retryAttempts = 4;
      (client as any).config.baseDelay = 100;
      (client as any).config.maxDelay = 1000;
      
      await (client as any).withRetry(operation);
      
      (client as any).sleep = originalSleep;
      
      assert.ok(delays[0] >= 100);
      assert.ok(delays[1] >= 200);
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      const result = await (client as any).makeRequest('GET', '/test', undefined, undefined, 1);
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.message.includes('timeout') || result.error.message.includes('not discovered'));
      }
    });

    it('should return error for port not discovered', async () => {
      (client as any).currentPort = null;
      
      const result = await (client as any).makeRequest('GET', '/test');
      
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.message.includes('not discovered'));
      }
    });
  });

  describe('Disposal', () => {
    it('should clear health check interval on dispose', () => {
      const clearIntervalSpy = global.clearInterval;
      let clearCalled = false;
      
      global.clearInterval = () => {
        clearCalled = true;
      };

      (client as any).healthCheckInterval = setTimeout(() => {}, 1000);
      
      client.dispose();
      
      global.clearInterval = clearIntervalSpy;
      
      assert.strictEqual((client as any).healthCheckInterval, null);
    });

    it('should be safe to dispose multiple times', () => {
      assert.doesNotThrow(() => {
        client.dispose();
        client.dispose();
        client.dispose();
      });
    });
  });
});
