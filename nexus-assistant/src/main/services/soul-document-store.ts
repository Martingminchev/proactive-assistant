// =============================================================================
// NEXUS - Soul Document Store
// Manages the AI's personality document that both user and AI can update
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { SoulDocument, DEFAULT_SOUL_DOCUMENT } from '../../shared/types';

// =============================================================================
// Soul Document Store Class
// =============================================================================

export class SoulDocumentStore extends EventEmitter {
  private document: SoulDocument;
  private filePath: string;
  private saveTimer: NodeJS.Timeout | null = null;
  private saveDebounceMs: number = 1000;
  private isDirty: boolean = false;

  constructor(fileName: string = 'soul-document.md') {
    super();
    
    // Store in user data directory
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, fileName);
    
    // Initialize with defaults
    this.document = { ...DEFAULT_SOUL_DOCUMENT };
    
    // Load existing document
    this.load();
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  private load(): void {
    try {
      // Check for the markdown file
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        
        // Try to load metadata from a companion JSON file
        const metaPath = this.filePath.replace('.md', '.meta.json');
        let metadata = {
          lastUpdated: Date.now(),
          lastUpdatedBy: 'user' as const,
          version: 1,
        };
        
        if (fs.existsSync(metaPath)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          } catch {
            // Use defaults if metadata is corrupted
          }
        }
        
        this.document = {
          content,
          ...metadata,
        };
        
        log.debug('[SoulDocumentStore] Loaded soul document');
      } else {
        // Create the default document
        this.save();
        log.debug('[SoulDocumentStore] Created default soul document');
      }
    } catch (error) {
      log.error('[SoulDocumentStore] Error loading document:', error);
      this.document = { ...DEFAULT_SOUL_DOCUMENT };
    }
  }

  private scheduleSave(): void {
    this.isDirty = true;
    
    if (this.saveTimer) {
      return; // Already scheduled
    }

    this.saveTimer = setTimeout(() => {
      this.save();
      this.saveTimer = null;
    }, this.saveDebounceMs);
  }

  private save(): void {
    try {
      // Save the markdown content
      fs.writeFileSync(this.filePath, this.document.content, 'utf-8');
      
      // Save metadata separately
      const metaPath = this.filePath.replace('.md', '.meta.json');
      const metadata = {
        lastUpdated: this.document.lastUpdated,
        lastUpdatedBy: this.document.lastUpdatedBy,
        version: this.document.version,
      };
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
      
      this.isDirty = false;
      log.debug('[SoulDocumentStore] Saved soul document');
    } catch (error) {
      log.error('[SoulDocumentStore] Error saving document:', error);
    }
  }

  // Force immediate save
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.save();
  }

  // ===========================================================================
  // Document Operations
  // ===========================================================================

  getDocument(): SoulDocument {
    return { ...this.document };
  }

  getContent(): string {
    return this.document.content;
  }

  updateDocument(content: string, updatedBy: 'user' | 'ai' = 'user'): SoulDocument {
    this.document = {
      content,
      lastUpdated: Date.now(),
      lastUpdatedBy: updatedBy,
      version: this.document.version + 1,
    };
    
    this.scheduleSave();
    this.emit('updated', this.document);
    
    return { ...this.document };
  }

  // ===========================================================================
  // AI Updates
  // ===========================================================================

  /**
   * Append a section to the document (used by AI to add learned preferences)
   */
  appendSection(sectionTitle: string, content: string): SoulDocument {
    const newSection = `\n\n## ${sectionTitle}\n${content}`;
    
    // Check if section already exists and update it
    const sectionRegex = new RegExp(`## ${sectionTitle}[\\s\\S]*?(?=\\n## |$)`, 'i');
    
    if (sectionRegex.test(this.document.content)) {
      // Replace existing section
      this.document.content = this.document.content.replace(
        sectionRegex,
        `## ${sectionTitle}\n${content}`
      );
    } else {
      // Append new section
      this.document.content += newSection;
    }
    
    this.document.lastUpdated = Date.now();
    this.document.lastUpdatedBy = 'ai';
    this.document.version++;
    
    this.scheduleSave();
    this.emit('updated', this.document);
    
    return { ...this.document };
  }

  /**
   * Update a specific section of the document
   */
  updateSection(sectionTitle: string, newContent: string, updatedBy: 'user' | 'ai' = 'ai'): SoulDocument {
    const sectionRegex = new RegExp(`(## ${sectionTitle}\\n)[\\s\\S]*?(?=\\n## |$)`, 'i');
    
    if (sectionRegex.test(this.document.content)) {
      this.document.content = this.document.content.replace(
        sectionRegex,
        `## ${sectionTitle}\n${newContent}\n`
      );
      
      this.document.lastUpdated = Date.now();
      this.document.lastUpdatedBy = updatedBy;
      this.document.version++;
      
      this.scheduleSave();
      this.emit('updated', this.document);
    }
    
    return { ...this.document };
  }

  /**
   * Add a learned preference to the "What I've Learned About You" section
   */
  addLearnedPreference(category: string, value: string): SoulDocument {
    const learnedSectionTitle = "What I've Learned About You";
    const sectionRegex = new RegExp(`(## ${learnedSectionTitle}[\\s\\S]*?)(- ${category}:.*?)(?=\\n|$)`, 'i');
    
    if (sectionRegex.test(this.document.content)) {
      // Update existing preference
      this.document.content = this.document.content.replace(
        sectionRegex,
        `$1- ${category}: ${value}`
      );
    } else {
      // Add new preference to the section
      const insertRegex = new RegExp(`(## ${learnedSectionTitle}[\\s\\S]*?)(?=\\n## |$)`, 'i');
      const match = this.document.content.match(insertRegex);
      
      if (match) {
        const updatedSection = match[1].trim() + `\n- ${category}: ${value}\n`;
        this.document.content = this.document.content.replace(insertRegex, updatedSection + '\n');
      }
    }
    
    this.document.lastUpdated = Date.now();
    this.document.lastUpdatedBy = 'ai';
    this.document.version++;
    
    this.scheduleSave();
    this.emit('updated', this.document);
    
    return { ...this.document };
  }

  // ===========================================================================
  // Reset
  // ===========================================================================

  reset(): SoulDocument {
    this.document = { ...DEFAULT_SOUL_DOCUMENT, version: this.document.version + 1 };
    this.save();
    this.emit('reset', this.document);
    return { ...this.document };
  }

  // ===========================================================================
  // Parsing Helpers
  // ===========================================================================

  /**
   * Extract a specific section from the document
   */
  getSection(sectionTitle: string): string | null {
    const sectionRegex = new RegExp(`## ${sectionTitle}\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = this.document.content.match(sectionRegex);
    return match ? match[1].trim() : null;
  }

  /**
   * Get all section titles from the document
   */
  getSectionTitles(): string[] {
    const regex = /## (.+)/g;
    const titles: string[] = [];
    let match;
    
    while ((match = regex.exec(this.document.content)) !== null) {
      titles.push(match[1]);
    }
    
    return titles;
  }

  /**
   * Get file path for external access (e.g., opening in editor)
   */
  getFilePath(): string {
    return this.filePath;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let soulDocumentStoreInstance: SoulDocumentStore | null = null;

export function getSoulDocumentStore(): SoulDocumentStore {
  if (!soulDocumentStoreInstance) {
    soulDocumentStoreInstance = new SoulDocumentStore();
  }
  return soulDocumentStoreInstance;
}

export default SoulDocumentStore;
