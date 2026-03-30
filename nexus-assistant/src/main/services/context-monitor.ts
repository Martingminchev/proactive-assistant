// =============================================================================
// NEXUS - Context Monitor
// Gathers real-time system context for AI awareness
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import * as si from 'systeminformation';
import activeWin from 'active-win';
import chokidar, { FSWatcher } from 'chokidar';
import { clipboard } from 'electron';
import crypto from 'crypto';
import {
  SystemContext,
  ActiveWindowInfo,
  SystemResources,
  FileChangeEvent,
  ClipboardItem,
} from '../../shared/types';

interface ContextMonitorOptions {
  trackActiveWindow?: boolean;
  trackFileChanges?: boolean;
  trackClipboard?: boolean;
  trackedDirectories?: string[];
  updateInterval?: number;
  maxClipboardHistory?: number;
  maxFileHistory?: number;
}

interface SysteminformationCpuData {
  currentLoad: number;
  cpus: Array<{
    load: number;
  }>;
}

interface SysteminformationMemData {
  total: number;
  used: number;
  free: number;
}

interface SysteminformationBatteryData {
  hasBattery: boolean;
  isCharging: boolean;
  percent: number;
  timeRemaining: number | null;
}

interface SysteminformationTimeData {
  uptime: number;
}

export class ContextMonitor extends EventEmitter {
  private options: Required<ContextMonitorOptions>;
  private currentContext: SystemContext;
  private fileWatcher: FSWatcher | null = null;
  private updateTimer: NodeJS.Timeout | null = null;
  private clipboardTimer: NodeJS.Timeout | null = null;
  private lastClipboardHash: string = '';
  private isRunning: boolean = false;

  constructor(options: ContextMonitorOptions = {}) {
    super();
    
    this.options = {
      trackActiveWindow: true,
      trackFileChanges: false,
      trackClipboard: false,
      trackedDirectories: [],
      updateInterval: 5000,
      maxClipboardHistory: 10,
      maxFileHistory: 20,
      ...options,
    };

    this.currentContext = {
      timestamp: Date.now(),
      clipboardHistory: [],
      recentFiles: [],
    };
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Initial context gathering
    await this.updateContext();
    
    // Start periodic updates
    this.updateTimer = setInterval(() => {
      this.updateContext();
    }, this.options.updateInterval);
    
    // Setup file watching if enabled
    if (this.options.trackFileChanges && this.options.trackedDirectories.length > 0) {
      this.setupFileWatcher();
    }
    
    // Setup clipboard monitoring if enabled
    if (this.options.trackClipboard) {
      this.setupClipboardMonitor();
    }
    
    this.emit('started');
  }

  stop(): void {
    this.isRunning = false;
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    if (this.clipboardTimer) {
      clearInterval(this.clipboardTimer);
      this.clipboardTimer = null;
    }
    
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    
    this.emit('stopped');
  }

  // ===========================================================================
  // Context Updates
  // ===========================================================================
  
  private async updateContext(): Promise<void> {
    try {
      if (this.options.trackActiveWindow) {
        await this.updateActiveWindow();
      }
      
      await this.updateSystemResources();
      
      this.currentContext.timestamp = Date.now();
      this.emit('update', this.currentContext);
    } catch (error) {
      log.error('Context update error:', error);
    }
  }

  private async updateActiveWindow(): Promise<void> {
    try {
      const window = await activeWin();
      
      if (window) {
        this.currentContext.activeWindow = {
          platform: window.platform,
          title: window.title,
          application: window.owner.name,
          pid: window.owner.processId,
          path: window.owner.path,
        };
      }
    } catch (error) {
      // Permission errors are common on macOS
      if ((error as Error).message?.includes('screen recording')) {
        log.warn('Screen recording permission required for active window tracking');
      }
    }
  }

  private async updateSystemResources(): Promise<void> {
    try {
      const [cpu, mem, battery, time] = await Promise.all([
        si.currentLoad() as Promise<SysteminformationCpuData>,
        si.mem() as Promise<SysteminformationMemData>,
        si.battery() as Promise<SysteminformationBatteryData>,
        Promise.resolve().then(() => si.time() as SysteminformationTimeData),
      ]);

      this.currentContext.systemResources = {
        cpu: {
          usage: Math.round(cpu.currentLoad),
          cores: cpu.cpus.length,
          model: 'CPU', // systeminformation doesn't provide model in currentLoad
        },
        memory: {
          total: mem.total,
          used: mem.used,
          free: mem.free,
          percentage: Math.round((mem.used / mem.total) * 100),
        },
        battery: battery.hasBattery ? {
          hasBattery: true,
          isCharging: battery.isCharging,
          percent: Math.round(battery.percent),
          timeRemaining: battery.timeRemaining ?? undefined,
        } : {
          hasBattery: false,
          isCharging: false,
          percent: 100,
        },
        uptime: time.uptime,
      };
    } catch (error) {
      log.error('System resources error:', error);
    }
  }

  // ===========================================================================
  // File Watching
  // ===========================================================================
  
  private setupFileWatcher(): void {
    if (this.options.trackedDirectories.length === 0) return;
    
    const validDirs = this.options.trackedDirectories.filter(dir => {
      // Basic validation - ensure it's an absolute path
      return dir && (dir.startsWith('/') || dir.includes(':\\'));
    });
    
    if (validDirs.length === 0) return;

    this.fileWatcher = chokidar.watch(validDirs, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.tmp',
        '**/.DS_Store',
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 3,
    });

    this.fileWatcher
      .on('add', (path) => this.handleFileChange(path, 'add'))
      .on('change', (path) => this.handleFileChange(path, 'change'))
      .on('unlink', (path) => this.handleFileChange(path, 'unlink'));
  }

  private handleFileChange(path: string, event: FileChangeEvent['event']): void {
    const change: FileChangeEvent = {
      path,
      event,
      timestamp: Date.now(),
    };

    this.currentContext.recentFiles = this.currentContext.recentFiles || [];
    this.currentContext.recentFiles.unshift(change);
    
    // Keep only recent changes
    if (this.currentContext.recentFiles.length > this.options.maxFileHistory) {
      this.currentContext.recentFiles = this.currentContext.recentFiles.slice(0, this.options.maxFileHistory);
    }

    this.emit('fileChange', change);
  }

  // ===========================================================================
  // Clipboard Monitoring
  // ===========================================================================
  
  private setupClipboardMonitor(): void {
    // Check clipboard every second
    this.clipboardTimer = setInterval(() => {
      this.checkClipboard();
    }, 1000);
  }

  private checkClipboard(): void {
    try {
      const text = clipboard.readText();
      const image = clipboard.readImage();
      const html = clipboard.readHTML();
      
      let content: string;
      let type: ClipboardItem['type'];
      
      // Check for image first (if not empty)
      if (!image.isEmpty()) {
        content = image.toDataURL();
        type = 'image';
      } else if (html && html !== text) {
        content = html;
        type = 'html';
      } else if (text) {
        content = text;
        type = 'text';
      } else {
        return; // Nothing in clipboard
      }
      
      // Hash to detect changes
      const hash = crypto.createHash('md5').update(content).digest('hex');
      
      if (hash !== this.lastClipboardHash) {
        this.lastClipboardHash = hash;
        
        const item: ClipboardItem = {
          type,
          content,
          timestamp: Date.now(),
          hash,
        };

        this.currentContext.clipboardHistory = this.currentContext.clipboardHistory || [];
        this.currentContext.clipboardHistory.unshift(item);
        
        // Keep only recent items
        if (this.currentContext.clipboardHistory.length > this.options.maxClipboardHistory) {
          this.currentContext.clipboardHistory = this.currentContext.clipboardHistory.slice(0, this.options.maxClipboardHistory);
        }

        this.emit('clipboardChange', item);
      }
    } catch (error) {
      log.error('Clipboard check error:', error);
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================
  
  getCurrentContext(): SystemContext {
    return { ...this.currentContext };
  }

  isTracking(): boolean {
    return this.isRunning;
  }

  updateOptions(newOptions: Partial<ContextMonitorOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    // Restart to apply changes
    const wasRunning = this.isRunning;
    this.stop();
    
    if (wasRunning) {
      this.start();
    }
  }
}

export default ContextMonitor;
